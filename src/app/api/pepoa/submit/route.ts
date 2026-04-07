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
  const hoaEmailRaw = data.property.hoa_submission_email as string | null;
  if (hoaEmailRaw) {
    const hoaEmail = hoaEmailRaw.split(",").map((e) => e.trim()).filter(Boolean);
    try {
      await sendPEPOAPDF({
        to: hoaEmail,
        pdfBuffer,
        guestName: (data.guest.full_name as string) || "Guest",
        lotSection: (data.property.lot_section as string) || "N/A",
        checkInDate: data.reg.check_in_date as string,
        ownerPhone: (data.property.owner_phone as string) || "",
        ownerEmail: (data.property.owner_email as string) || (data.host.email as string) || "",
      });
    } catch (err) {
      console.error("Failed to send registration PDF email:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
