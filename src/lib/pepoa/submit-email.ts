import { fetchRegistrationData, generateRegistrationPDF } from "@/lib/pdf/generate-for-registration";
import { sendPEPOAPDF } from "@/lib/email/send-pepoa-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

function isAfterHours(sched: { enabled: boolean; timezone: string; days: Record<string, { enabled: boolean; start: string; end: string }> }): boolean {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: sched.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const day = sched.days[String(dayIndex)];
  if (!day || !day.enabled) return false;
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const current = h * 60 + m;
  const [sh, sm] = day.start.split(":").map(Number);
  const [eh, em] = day.end.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start > end
    ? current >= start || current < end
    : current >= start && current < end;
}

export async function submitPEPOAEmail({
  registrationId,
  isUpdate,
  changeSummary,
  force,
}: {
  registrationId: string;
  isUpdate?: boolean;
  changeSummary?: string;
  /** Bypass the per-reservation HOA-email off switch (manual admin override). */
  force?: boolean;
}): Promise<void> {
  const data = await fetchRegistrationData(registrationId);
  if (!data) throw new Error("Registration not found");

  // Per-reservation off switch: skip automatic sends. A manual admin send
  // passes force=true to override.
  if (!force && data.reg.hoa_email_disabled) return;

  const pdfBuffer = await generateRegistrationPDF(data);

  const hoaEmailRaw = data.property.hoa_submission_email as string | null;
  if (!hoaEmailRaw) return;

  const hoaEmail = hoaEmailRaw.split(",").map((e) => e.trim()).filter(Boolean);

  const afterHoursCc: string[] = [];
  const afterHoursEmailRaw = data.property.hoa_after_hours_email as string | null;
  if (afterHoursEmailRaw) {
    const afterHoursEmails = afterHoursEmailRaw.split(",").map((e) => e.trim()).filter(Boolean);
    const sched = data.property.hoa_after_hours_schedule as { enabled: boolean; timezone: string; days: Record<string, { enabled: boolean; start: string; end: string }> } | null;
    const checkInDate = data.reg.check_in_date as string | null;
    const daysUntilCheckIn = checkInDate
      ? Math.ceil((new Date(checkInDate).getTime() - Date.now()) / 86400000)
      : Infinity;
    const withinWindow = !sched || !sched.enabled || isAfterHours(sched);
    if (afterHoursEmails.length > 0 && withinWindow && daysUntilCheckIn <= 2) {
      afterHoursEmails.forEach((e) => { if (!hoaEmail.includes(e)) afterHoursCc.push(e); });
    }
  }

  const lotSection = (data.property.lot_section as string) || "N/A";
  const hoaType = (data.property.hoa_type as string) || "pepoa";
  const isBML = hoaType === "bmlc";
  const lotPart = isBML ? "" : ` — Lot/Section ${lotSection}`;
  const subject = isUpdate
    ? `[UPDATE] Short-Term Tenant Registration${lotPart} — Check-in ${data.reg.check_in_date as string}`
    : `Short-Term Tenant Registration${lotPart} — Check-in ${data.reg.check_in_date as string}`;

  await sendPEPOAPDF({
    to: hoaEmail,
    cc: afterHoursCc,
    pdfBuffer,
    guestName: (data.guest.full_name as string) || "Guest",
    lotSection,
    propertyAddress: (data.property.address as string) || "",
    checkInDate: data.reg.check_in_date as string,
    ownerPhone: (data.property.owner_phone as string) || "",
    ownerEmail: (data.property.owner_email as string) || (data.host.email as string) || "",
    registrationId,
    hoaType,
    isUpdate,
    changeSummary,
  });

  const adminDb = createAdminClient();
  await adminDb.from("email_send_log").insert({
    registration_id: registrationId,
    sent_to: [...hoaEmail, ...afterHoursCc],
    subject,
    body_summary: changeSummary || null,
    email_type: "pepoa",
    is_update: !!isUpdate,
  });
}
