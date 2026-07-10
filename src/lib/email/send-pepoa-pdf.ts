import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendPEPOAPDF({
  to,
  cc: extraCc = [],
  pdfBuffer,
  guestName,
  lotSection,
  propertyAddress,
  checkInDate,
  ownerPhone,
  ownerEmail,
  registrationId,
  hoaType,
  isUpdate,
  changeSummary,
}: {
  to: string | string[];
  cc?: string[];
  pdfBuffer: Buffer;
  guestName: string;
  lotSection: string;
  propertyAddress: string;
  checkInDate: string;
  ownerPhone: string;
  ownerEmail: string;
  registrationId: string;
  hoaType?: string;
  isUpdate?: boolean;
  changeSummary?: string;
}) {
  const isBML = hoaType === "bmlc";
  const lotPart = isBML ? "" : ` — Lot/Section ${lotSection}`;
  const subject = isUpdate
    ? `[UPDATE] Short-Term Tenant Registration${lotPart} — Check-in ${checkInDate}`
    : `Short-Term Tenant Registration${lotPart} — Check-in ${checkInDate}`;

  const fromEmail = "contact@summitlakeside.com";
  const originalMessageId = `<pepoa-${registrationId}@summitlakeside.com>`;

  const cc: string[] = [...extraCc];
  if (ownerEmail && ownerEmail.toLowerCase() !== fromEmail.toLowerCase() && !cc.includes(ownerEmail.toLowerCase())) {
    cc.push(ownerEmail);
  }

  const contactLines = [
    "",
    "If you have any questions, please contact us:",
  ];
  if (ownerPhone) contactLines.push(`  Phone: ${ownerPhone}`);
  if (ownerEmail) contactLines.push(`  Email: ${ownerEmail}`);

  const changeLine = changeSummary ? `Changes: ${changeSummary}` : "";

  // The HOA's mail system can't search subject lines, so everything they file
  // by — the subject itself, the property address, and the lot/section — must
  // also appear in the searchable body.
  const detailLines = [
    ...(propertyAddress ? [`Property Address: ${propertyAddress}`] : []),
    ...(isBML ? [] : [`Lot/Section: ${lotSection}`]),
    `Registered Guest: ${guestName}`,
    `Check-in Date: ${checkInDate}`,
  ];

  const bodyLines = isUpdate
    ? [
        subject,
        "",
        `An updated tenant registration form has been submitted${isBML ? "" : ` for Lot/Section ${lotSection}`}.`,
        "",
        ...detailLines,
        ...(changeLine ? ["", changeLine] : []),
        "",
        "The updated Short-Term Tenant Registration Form and Lease is attached as a PDF.",
        ...contactLines,
      ]
    : [
        subject,
        "",
        `A new tenant registration form has been submitted${isBML ? "" : ` for Lot/Section ${lotSection}`}.`,
        "",
        ...detailLines,
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
    ...(cc.length > 0 ? { cc } : {}),
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
