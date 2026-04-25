import { NextResponse } from "next/server";
import { fetchRegistrationData, generateRegistrationPDF } from "@/lib/pdf/generate-for-registration";
import { sendPEPOAPDF } from "@/lib/email/send-pepoa-pdf";
import { createClient } from "@/lib/supabase/server";
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
  const dayIndex = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(weekday);
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

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Allow internal server-to-server calls (service role) or authenticated admin sessions
  const authHeader = request.headers.get("authorization");
  const isInternalCall =
    authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

  if (!isInternalCall) {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { registration_id: string; is_update?: boolean; change_summary?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, is_update, change_summary } = body;
  if (!registration_id) {
    return NextResponse.json({ error: "Missing registration_id" }, { status: 400 });
  }

  const data = await fetchRegistrationData(registration_id);
  if (!data) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const pdfBuffer = await generateRegistrationPDF(data);

  // Email to HOA office if configured
  const hoaEmailRaw = data.property.hoa_submission_email as string | null;
  if (hoaEmailRaw) {
    const hoaEmail = hoaEmailRaw.split(",").map((e) => e.trim()).filter(Boolean);

    // Include after-hours emails if configured and current time is within the window
    const afterHoursEmailRaw = data.property.hoa_after_hours_email as string | null;
    if (afterHoursEmailRaw) {
      const afterHoursEmails = afterHoursEmailRaw.split(",").map((e) => e.trim()).filter(Boolean);
      const sched = data.property.hoa_after_hours_schedule as { enabled: boolean; timezone: string; days: Record<string, { enabled: boolean; start: string; end: string }> } | null;
      if (afterHoursEmails.length > 0 && (!sched || !sched.enabled || isAfterHours(sched))) {
        afterHoursEmails.forEach((e) => { if (!hoaEmail.includes(e)) hoaEmail.push(e); });
      }
    }
    try {
      const lotSection = (data.property.lot_section as string) || "N/A";
      const hoaType = (data.property.hoa_type as string) || "pepoa";
      const isBML = hoaType === "bmlc";
      const lotPart = isBML ? "" : ` — Lot/Section ${lotSection}`;
      const subject = `Short-Term Tenant Registration${lotPart} — Check-in ${data.reg.check_in_date as string}`;

      await sendPEPOAPDF({
        to: hoaEmail,
        pdfBuffer,
        guestName: (data.guest.full_name as string) || "Guest",
        lotSection,
        checkInDate: data.reg.check_in_date as string,
        ownerPhone: (data.property.owner_phone as string) || "",
        ownerEmail: (data.property.owner_email as string) || (data.host.email as string) || "",
        registrationId: registration_id,
        hoaType,
        isUpdate: is_update,
        changeSummary: change_summary,
      });

      const adminDb = createAdminClient();
      await adminDb.from("email_send_log").insert({
        registration_id,
        sent_to: hoaEmail,
        subject,
        body_summary: change_summary || null,
        email_type: "pepoa",
        is_update: !!is_update,
      });
    } catch (err) {
      console.error("Failed to send registration PDF email:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
