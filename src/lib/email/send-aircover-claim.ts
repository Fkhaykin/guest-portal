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
  guestName,
  checkInDate,
  checkOutDate,
  portalBookingUrl,
  airbnbUrl,
}: {
  to: string;
  hostName: string;
  propertyName: string;
  claimType: string;
  claimId: string;
  guestName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  portalBookingUrl?: string;
  airbnbUrl?: string | null;
}) {
  const typeLabel =
    claimType === "damage" ? "Damage Report" : "Pet Discrepancy";

  const subject = `New Potential Claim: ${typeLabel} — ${propertyName}`;

  const bodyLines = [
    `Hi ${hostName},`,
    "",
    `A new potential claim has been filed by your cleaner for ${propertyName}.`,
    "",
    `Claim Type: ${typeLabel}`,
    `Claim ID: ${claimId}`,
    "",
    "--- Booking Details ---",
    `Guest: ${guestName || "Unknown"}`,
    `Property: ${propertyName}`,
    `Check-in: ${checkInDate || "N/A"}`,
    `Check-out: ${checkOutDate || "N/A"}`,
  ];

  if (portalBookingUrl) {
    bodyLines.push(`Portal: ${portalBookingUrl}`);
  }
  if (airbnbUrl) {
    bodyLines.push(`Airbnb Listing: ${airbnbUrl}`);
  }

  bodyLines.push(
    "",
    "Please review this claim in your admin dashboard under Potential Claims.",
    "",
    "— Summit Lakeside",
  );

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
