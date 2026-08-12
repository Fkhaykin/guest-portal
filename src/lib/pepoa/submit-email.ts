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
  note,
}: {
  registrationId: string;
  isUpdate?: boolean;
  changeSummary?: string;
  /** Bypass the per-reservation HOA-email off switch (manual admin override). */
  force?: boolean;
  /** Free-text note added by the admin, included in the email body. */
  note?: string;
}): Promise<void> {
  const data = await fetchRegistrationData(registrationId);
  if (!data) throw new Error("Registration not found");

  // Per-reservation off switch: skip automatic sends. A manual admin send
  // passes force=true to override.
  if (!force && data.reg.hoa_email_disabled) return;

  // Don't email the HOA a blank form. Lodgify-imported bookings auto-create a
  // registration shell the guest may never complete, so a later date-change (or
  // any other auto-trigger) would otherwise send an [UPDATE] with an empty
  // tenant/guest and vehicle table. A registration the guest actually completed
  // carries a signature and/or a filled guest list. Manual sends (force) bypass.
  const guestList = (data.reg.guest_list as unknown[] | null) ?? [];
  const hasContent =
    !!data.reg.signature_url || guestList.length > 0 || data.vehicles.length > 0;
  if (!force && !hasContent) {
    console.log(
      `[pepoa-email] Skipping ${isUpdate ? "update" : "initial"} send for ${registrationId} — guest has not completed the registration (form would be blank)`
    );
    return;
  }

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

  const adminDb = createAdminClient();

  // Idempotency: several paths call this (register flow, vehicle edits, Lodgify
  // date-change webhook bursts) and a guest double-submit or Vercel retry can
  // re-run any of them, so the HOA can receive duplicates. Atomically claim a
  // send slot. Initial sends are claimed effectively permanently (huge window);
  // update sends key on the change summary with a short window so a genuinely
  // different change later still goes out. Manual admin sends (force) bypass it.
  if (!force) {
    const eventKey = isUpdate ? `update:${(changeSummary || "").slice(0, 180)}` : "new";
    const windowSeconds = isUpdate ? 300 : 315_360_000; // 10y ≈ permanent for initial
    const { data: maySend, error: claimErr } = await adminDb.rpc("claim_hoa_email", {
      p_registration_id: registrationId,
      p_event_key: eventKey,
      p_window_seconds: windowSeconds,
    });
    if (claimErr) {
      // Fail open — a missed HOA registration is worse than a rare duplicate.
      console.error(`[pepoa-email] Claim failed for ${registrationId}/${eventKey}:`, claimErr);
    } else if (maySend === false) {
      console.log(`[pepoa-email] Duplicate ${eventKey} for ${registrationId} suppressed`);
      return;
    }
  }

  // Keep the Summitlakeside team on the thread so replies from the HOA can be
  // answered. Override via HOA_SUBMISSION_CC.
  const teamCc = (process.env.HOA_SUBMISSION_CC || "contact@summitlakeside.com").trim();

  const pdfBuffer = await generateRegistrationPDF(data);

  try {
    await sendPEPOAPDF({
      to: hoaEmail,
      cc: [teamCc, ...afterHoursCc],
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
      note,
    });
  } catch (err) {
    // The claim was taken above but nothing went out — release it so a retry or
    // a later trigger isn't permanently suppressed.
    if (!force) {
      const eventKey = isUpdate ? `update:${(changeSummary || "").slice(0, 180)}` : "new";
      await adminDb.from("hoa_email_claim").delete()
        .eq("registration_id", registrationId).eq("event_key", eventKey);
    }
    throw err;
  }

  await adminDb.from("email_send_log").insert({
    registration_id: registrationId,
    sent_to: [...hoaEmail, ...afterHoursCc],
    subject,
    body_summary:
      [changeSummary, note?.trim() ? `Note: ${note.trim()}` : null]
        .filter(Boolean)
        .join(" — ") || null,
    email_type: "pepoa",
    is_update: !!isUpdate,
  });
}
