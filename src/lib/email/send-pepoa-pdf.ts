import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendPEPOAPDF({
  to,
  pdfBuffer,
  guestName,
  propertyName,
  leaseStart,
  leaseEnd,
}: {
  to: string;
  pdfBuffer: Buffer;
  guestName: string;
  propertyName: string;
  leaseStart: string;
  leaseEnd: string;
}) {
  const subject = `Short-Term Tenant Registration — ${guestName} — ${propertyName}`;

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL environment variable is not set");
  }

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    text: [
      `A new tenant registration form has been submitted for ${propertyName}.`,
      "",
      `Registered Guest: ${guestName}`,
      `Lease Period: ${leaseStart} — ${leaseEnd}`,
      "",
      "The completed PEPOA Short-Term Tenant Registration Form and Lease is attached as a PDF.",
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
