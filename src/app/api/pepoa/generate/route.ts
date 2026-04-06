import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchRegistrationData, generateRegistrationPDF } from "@/lib/pdf/generate-for-registration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const registrationId = searchParams.get("registration_id");

  if (!registrationId) {
    return NextResponse.json({ error: "Missing registration_id" }, { status: 400 });
  }

  // Verify caller is authenticated host
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await fetchRegistrationData(registrationId);
  if (!data) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Verify ownership
  if (data.host.auth_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const pdfBuffer = await generateRegistrationPDF(data);
    const guestName = (data.guest.full_name as string) || "Guest";

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Registration-${guestName.replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
