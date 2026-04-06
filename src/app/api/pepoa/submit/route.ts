import { NextResponse } from "next/server";
import { fetchRegistrationData, generateRegistrationPDF } from "@/lib/pdf/generate-for-registration";
import { sendPEPOAPDF } from "@/lib/email/send-pepoa-pdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { registration_id: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id } = body;
  if (!registration_id) {
    return NextResponse.json({ error: "Missing registration_id" }, { status: 400 });
  }

  const data = await fetchRegistrationData(registration_id);
  if (!data) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const pdfBuffer = await generateRegistrationPDF(data);

  // Email to HOA office if configured
  const hoaEmail = data.property.hoa_submission_email as string | null;
  if (hoaEmail) {
    try {
      await sendPEPOAPDF({
        to: hoaEmail,
        pdfBuffer,
        guestName: (data.guest.full_name as string) || "Guest",
        propertyName: (data.property.name as string) || "Property",
        leaseStart: data.reg.check_in_date as string,
        leaseEnd: data.reg.check_out_date as string,
      });
    } catch (err) {
      console.error("Failed to send registration PDF email:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
