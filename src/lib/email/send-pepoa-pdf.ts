import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendPEPOAPDF({
  to,
  pdfBuffer,
  guestName,
  lotSection,
  checkInDate,
  ownerPhone,
  ownerEmail,
}: {
  to: string;
  pdfBuffer: Buffer;
  guestName: string;
  lotSection: string;
  checkInDate: string;
  ownerPhone: string;
  ownerEmail: string;
}) {
  const subject = `Short-Term Tenant Registration — Lot/Section ${lotSection} — Check-in ${checkInDate}`;

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL environment variable is not set");
  }

  const contactLines = [
    "",
    "If you have any questions, please contact us:",
  ];
  if (ownerPhone) contactLines.push(`  Phone: ${ownerPhone}`);
  if (ownerEmail) contactLines.push(`  Email: ${ownerEmail}`);

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    text: [
      `A new tenant registration form has been submitted for Lot/Section ${lotSection}.`,
      "",
      `Registered Guest: ${guestName}`,
      `Check-in Date: ${checkInDate}`,
      "",
      "The completed Short-Term Tenant Registration Form and Lease is attached as a PDF.",
      ...contactLines,
    ].join("\n"),
    attachments: [
      {
        filename: `PEPOA-Registration-${guestName.replace(/\s+/g, "-")}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
}
