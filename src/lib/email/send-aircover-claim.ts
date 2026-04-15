import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendAircoverClaimEmail({
  to,
  hostName,
  propertyName,
  claimType,
  claimId,
}: {
  to: string;
  hostName: string;
  propertyName: string;
  claimType: string;
  claimId: string;
}) {
  const typeLabel =
    claimType === "damage" ? "Damage Report" : "Pet Discrepancy";

  const subject = `New AirCover Claim: ${typeLabel} — ${propertyName}`;

  const bodyLines = [
    `Hi ${hostName},`,
    "",
    `A new AirCover claim has been filed by your cleaner for ${propertyName}.`,
    "",
    `Claim Type: ${typeLabel}`,
    `Claim ID: ${claimId}`,
    "",
    "Please review this claim in your admin dashboard under AirCover Claims.",
    "",
    "— Summit Lakeside",
  ];

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: "contact@summitlakeside.com",
    to,
    subject,
    text: bodyLines.join("\n"),
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
}
