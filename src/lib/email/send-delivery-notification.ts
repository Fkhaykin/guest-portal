import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendDeliveryNotification({
  to,
  lotSection,
  propertyAddress,
  category,
  provider,
  quantity,
  arrivalDate,
  ownerName,
  ownerPhone,
  ownerEmail,
  housePassword,
  hoaType,
}: {
  to: string | string[];
  lotSection: string;
  propertyAddress: string;
  category: "rideshare" | "food_grocery" | "other";
  provider: string;
  quantity: number;
  arrivalDate: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  housePassword: string;
  hoaType?: string;
}) {
  const fromEmail = "contact@summitlakeside.com";

  const toList = Array.isArray(to) ? to : [to];
  const toLower = new Set(toList.map((e) => e.toLowerCase()));

  const cc: string[] = [];
  if (
    ownerEmail &&
    ownerEmail.toLowerCase() !== fromEmail.toLowerCase() &&
    !toLower.has(ownerEmail.toLowerCase())
  ) {
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
  if (ownerName) contactLines.push(`  Name: ${ownerName}`);
  if (ownerPhone) contactLines.push(`  Phone: ${ownerPhone}`);
  if (ownerEmail) contactLines.push(`  Email: ${ownerEmail}`);

  // The HOA's mail system can't search subject lines, so the subject is
  // repeated in the body along with the address and lot/section they file by.
  const bodyLines = [
    subject,
    "",
    "Hello,",
    "",
    `We have a ${quantity} ${typeLabel} from ${provider} on ${formattedDate}. Please register and allow them through.`,
    "",
    ...(propertyAddress ? [`Property Address: ${propertyAddress}`] : []),
    ...(isBML ? [] : [`Lot/Section: ${lotSection}`]),
    `House Password: ${housePassword}`,
    "",
    "If you have any questions please contact us:",
    ...contactLines,
    "",
    "Thanks,",
    "Summit Lakeside Rentals",
  ];

  const body = bodyLines.join("\n");

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: fromEmail,
    to,
    ...(cc.length > 0 ? { cc } : {}),
    subject,
    text: body,
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }

  return { subject, body };
}
