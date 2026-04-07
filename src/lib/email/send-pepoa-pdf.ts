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
  registrationId,
  isUpdate,
  changeSummary,
}: {
  to: string | string[];
  pdfBuffer: Buffer;
  guestName: string;
  lotSection: string;
  checkInDate: string;
  ownerPhone: string;
  ownerEmail: string;
  registrationId: string;
  isUpdate?: boolean;
  changeSummary?: string;
}) {
  const subject = `Short-Term Tenant Registration — Lot/Section ${lotSection} — Check-in ${checkInDate}`;

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL environment variable is not set");
  }

  const fromDomain = fromEmail.split("@")[1] || "summitlakeside.com";
  const originalMessageId = `<pepoa-${registrationId}@${fromDomain}>`;

  const contactLines = [
    "",
    "If you have any questions, please contact us:",
  ];
  if (ownerPhone) contactLines.push(`  Phone: ${ownerPhone}`);
  if (ownerEmail) contactLines.push(`  Email: ${ownerEmail}`);

  const changeLine = changeSummary ? `Changes: ${changeSummary}` : "";

  const bodyLines = isUpdate
    ? [
        `An updated tenant registration form has been submitted for Lot/Section ${lotSection}.`,
        "",
        `Registered Guest: ${guestName}`,
        `Check-in Date: ${checkInDate}`,
        ...(changeLine ? ["", changeLine] : []),
        "",
        "The updated Short-Term Tenant Registration Form and Lease is attached as a PDF.",
        ...contactLines,
      ]
    : [
        `A new tenant registration form has been submitted for Lot/Section ${lotSection}.`,
        "",
        `Registered Guest: ${guestName}`,
        `Check-in Date: ${checkInDate}`,
        "",
        "The completed Short-Term Tenant Registration Form and Lease is attached as a PDF.",
        ...contactLines,
      ];

  const headers: Record<string, string> = {};
  if (isUpdate) {
    headers["In-Reply-To"] = originalMessageId;
    headers["References"] = originalMessageId;
  } else {
    headers["Message-ID"] = originalMessageId;
  }

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    headers,
    text: bodyLines.join("\n"),
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
