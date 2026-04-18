import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendContactInquiryEmail({
  to,
  name,
  email,
  phone,
  topic,
  message,
}: {
  to: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  message: string;
}) {
  const subject = `New inquiry from ${name} — ${topic}`;

  const textLines = [
    `New inquiry received via summitlakeside.com`,
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    `Topic: ${topic}`,
    "",
    "--- Message ---",
    message,
    "",
    "— Summit Lakeside contact form",
  ].filter(Boolean);

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: "contact@summitlakeside.com",
    to,
    replyTo: email,
    subject,
    text: textLines.join("\n"),
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
}
