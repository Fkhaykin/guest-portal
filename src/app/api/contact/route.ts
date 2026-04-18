import { NextResponse } from "next/server";
import { sendContactInquiryEmail } from "@/lib/email/send-contact-inquiry";

const CONTACT_TO = process.env.CONTACT_INBOX_EMAIL || "contact@summitlakeside.com";

export async function POST(request: Request) {
  let body: {
    name?: string;
    email?: string;
    phone?: string;
    topic?: string;
    message?: string;
    website?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot — bots fill hidden fields.
  if (body.website && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const topic = body.topic?.trim() || "General inquiry";
  const message = body.message?.trim();
  const phone = body.phone?.trim();

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email, and message are required." },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email." },
      { status: 400 },
    );
  }

  try {
    await sendContactInquiryEmail({
      to: CONTACT_TO,
      name,
      email,
      phone,
      topic,
      message,
    });
  } catch (err) {
    console.error("Failed to send contact inquiry email", err);
    return NextResponse.json(
      { error: "Could not send message. Please try again or email us directly." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
