import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendDeliveryNotification({
  to,
  lotSection,
  category,
  provider,
  quantity,
  arrivalDate,
  ownerPhone,
  ownerEmail,
  hoaType,
}: {
  to: string | string[];
  lotSection: string;
  category: "rideshare" | "food_grocery" | "other";
  provider: string;
  quantity: number;
  arrivalDate: string;
  ownerPhone: string;
  ownerEmail: string;
  hoaType?: string;
}) {
  const fromEmail = "contact@summitlakeside.com";

  const cc: string[] = [];
  if (ownerEmail && ownerEmail.toLowerCase() !== fromEmail.toLowerCase()) {
    cc.push(ownerEmail);
  }

  const typeLabel = category === "rideshare" ? "car service" : "delivery";
  const formattedDate = new Date(arrivalDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  const isBML = hoaType === "bmlc";
  const lotPart = isBML ? "" : ` — Lot/Section ${lotSection}`;
  const subject = `${provider} ${typeLabel[0].toUpperCase() + typeLabel.slice(1)}${lotPart} — ${formattedDate}`;

  const contactLines: string[] = [];
  if (ownerPhone) contactLines.push(`  Phone: ${ownerPhone}`);
  if (ownerEmail) contactLines.push(`  Email: ${ownerEmail}`);

  const bodyLines = [
    "Hello,",
    "",
    `We have a ${quantity} ${typeLabel} from ${provider} on ${formattedDate}. Please register and allow them through.`,
    "",
    "If you have any questions please contact us:",
    ...contactLines,
    "",
    "Thanks,",
    "Summit Lakeside Rentals",
  ];

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: fromEmail,
    to,
    ...(cc.length > 0 ? { cc } : {}),
    subject,
    text: bodyLines.join("\n"),
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
}
