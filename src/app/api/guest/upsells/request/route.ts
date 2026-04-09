import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { verifyGuestToken } from "@/lib/guest-token";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: Request) {
  let body: { registration_id: string; type: "early_checkin" | "late_checkout" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, type } = body;
  if (!registration_id || !["early_checkin", "late_checkout"].includes(type)) {
    return NextResponse.json({ error: "registration_id and valid type required" }, { status: 400 });
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Get registration details
    const { data: reg, error: regError } = await supabase
      .from("registration")
      .select("id, check_in_date, check_out_date, num_guests, property_id, guest_id")
      .eq("id", registration_id)
      .single();

    if (regError || !reg) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Get guest name
    const { data: guest } = await supabase
      .from("guest")
      .select("first_name, last_name")
      .eq("id", reg.guest_id)
      .single();

    const guestName = guest ? `${guest.first_name} ${guest.last_name}` : "Unknown guest";

    // Get property details + host email
    const { data: property } = await supabase
      .from("property")
      .select("name, nickname, host_id, lot_section")
      .eq("id", reg.property_id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const { data: host } = await supabase
      .from("host")
      .select("email, full_name")
      .eq("id", property.host_id)
      .single();

    if (!host?.email) {
      return NextResponse.json({ error: "Host email not found" }, { status: 500 });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 });
    }

    const propertyName = property.nickname || property.name;
    const isEarly = type === "early_checkin";
    const relevantDate = isEarly ? reg.check_in_date : reg.check_out_date;
    const formattedDate = new Date(relevantDate + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const label = isEarly ? "Early Check-In (1:00 PM)" : "Late Check-Out (2:00 PM)";
    const subject = `${label} Request — ${propertyName} — ${formattedDate}`;

    const bodyLines = [
      `Hi ${host.full_name.split(" ")[0]},`,
      "",
      `${guestName} has requested a ${label.toLowerCase()} at ${propertyName}${property.lot_section ? ` (Lot ${property.lot_section})` : ""}.`,
      "",
      `Date: ${formattedDate}`,
      `Check-in: ${reg.check_in_date}`,
      `Check-out: ${reg.check_out_date}`,
      `Guests: ${reg.num_guests}`,
      "",
      "This was a high-turnover day so the guest was not able to purchase this add-on directly. Please review the schedule and let the guest know if this can be accommodated.",
      "",
      "Thanks,",
      "Summit Lakeside Guest Portal",
    ];

    const resend = getResend();
    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: host.email,
      subject,
      text: bodyLines.join("\n"),
    });

    if (emailError) {
      console.error("Request email failed:", emailError);
      return NextResponse.json({ error: "Failed to send request" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Upsell request error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
