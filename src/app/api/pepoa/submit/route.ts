import { NextResponse } from "next/server";
import { fetchRegistrationData, generateRegistrationPDF } from "@/lib/pdf/generate-for-registration";
import { sendPEPOAPDF } from "@/lib/email/send-pepoa-pdf";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
