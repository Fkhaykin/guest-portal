import { Resend } from "resend";

const FROM = "Summit Lakeside <contact@summitlakeside.com>";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function formatMoney(cents: number): string {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

interface InvoiceParams {
  to: string;
  guestName: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  amountCents: number;
  totalCents: number;
  hostedInvoiceUrl: string;
  isDeposit: boolean;
  balanceDueDate?: string;
}

export async function sendBookingInvoiceEmail(params: InvoiceParams) {
  const subject = params.isDeposit
    ? `Action required: 50% deposit for your stay at ${params.propertyName}`
    : `Action required: payment for your stay at ${params.propertyName}`;

  const balanceLine = params.isDeposit && params.balanceDueDate
    ? `\n\nThe remaining ${formatMoney(params.totalCents - params.amountCents)} balance will be automatically charged to your saved card on ${formatDate(params.balanceDueDate)} (30 days before check-in).`
    : "";

  const text = [
    `Hi ${params.guestName},`,
    "",
    `Your booking at ${params.propertyName} for ${formatDate(params.checkInDate)} – ${formatDate(params.checkOutDate)} is reserved pending payment.`,
    "",
    `Booking total: ${formatMoney(params.totalCents)}`,
    params.isDeposit ? `Due now (50% deposit): ${formatMoney(params.amountCents)}` : `Due now: ${formatMoney(params.amountCents)}`,
    "",
    `Pay your invoice here: ${params.hostedInvoiceUrl}` + balanceLine,
    "",
    "Reply to this email if you have any questions.",
  ].join("\n");

  const { error } = await getResend().emails.send({
    from: FROM,
    to: params.to,
    subject,
    text,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

interface BalanceFailedParams {
  to: string;
  guestName: string;
  propertyName: string;
  checkInDate: string;
  amountCents: number;
  attemptNumber: number;
  hostedInvoiceUrl: string | null;
}

export async function sendBalanceChargeFailedEmail(params: BalanceFailedParams) {
  const remaining = 3 - params.attemptNumber;
  const subject = `Payment failed for your stay at ${params.propertyName}`;
  const text = [
    `Hi ${params.guestName},`,
    "",
    `We were unable to charge the remaining ${formatMoney(params.amountCents)} for your booking at ${params.propertyName} (check-in ${formatDate(params.checkInDate)}).`,
    "",
    `Attempt ${params.attemptNumber} of 3 failed.${remaining > 0 ? ` We'll retry tomorrow. After 3 failed attempts the booking will be cancelled and the deposit forfeited.` : ""}`,
    "",
    params.hostedInvoiceUrl ? `Update your payment method or pay now: ${params.hostedInvoiceUrl}` : "Please contact us to update your payment method.",
  ].join("\n");

  const { error } = await getResend().emails.send({
    from: FROM,
    to: params.to,
    subject,
    text,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

interface BookingCancelledParams {
  to: string;
  guestName: string;
  propertyName: string;
  checkInDate: string;
  depositCents: number;
}

export async function sendBookingCancelledNonpaymentEmail(params: BookingCancelledParams) {
  const subject = `Your booking at ${params.propertyName} has been cancelled`;
  const text = [
    `Hi ${params.guestName},`,
    "",
    `After 3 failed attempts to charge the remaining balance for your booking at ${params.propertyName} (check-in ${formatDate(params.checkInDate)}), the booking has been cancelled.`,
    "",
    `Per our terms, the ${formatMoney(params.depositCents)} deposit is forfeited.`,
    "",
    "If you'd like to rebook, please reply to this email.",
  ].join("\n");

  const { error } = await getResend().emails.send({
    from: FROM,
    to: params.to,
    subject,
    text,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
