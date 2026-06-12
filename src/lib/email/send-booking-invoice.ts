import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderTemplate,
  firstNameOf,
  type GuestMessageType,
  type BookingInvoiceVars,
  type BookingPlanPickerVars,
} from "@/lib/guest-messages/templates";
import type { GuestMessageSettings } from "@/types/database";

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

async function loadOverride(
  hostId: string | undefined,
  type: GuestMessageType
): Promise<{ enabled: boolean; subject?: string; message?: string }> {
  if (!hostId) return { enabled: true };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("host")
    .select("guest_message_settings")
    .eq("id", hostId)
    .single();
  const settings = (data?.guest_message_settings ?? null) as GuestMessageSettings | null;
  const event = settings?.[type];
  if (!event) return { enabled: true };
  return { enabled: event.enabled !== false, subject: event.subject, message: event.message };
}

async function logEmail(params: {
  registrationId: string | undefined;
  to: string;
  subject: string;
  body: string;
  emailType: string;
}) {
  if (!params.registrationId) return;
  const supabase = createAdminClient();
  await supabase.from("email_send_log").insert({
    registration_id: params.registrationId,
    sent_to: [params.to],
    subject: params.subject,
    body_summary: params.body,
    email_type: params.emailType,
    is_update: false,
  });
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
  discountLabel?: string | null;
  discountCents?: number;
  hostId?: string;
  registrationId?: string;
}

export async function sendBookingInvoiceEmail(params: InvoiceParams) {
  const type: GuestMessageType = params.isDeposit ? "booking_invoice_deposit" : "booking_invoice_full";
  const override = await loadOverride(params.hostId, type);
  if (!override.enabled) return;

  const discountLine =
    params.discountLabel && params.discountCents && params.discountCents > 0
      ? `\n${params.discountLabel}: −${formatMoney(params.discountCents)}`
      : "";

  const balanceLine =
    params.isDeposit && params.balanceDueDate
      ? `\n\nThe remaining ${formatMoney(params.totalCents - params.amountCents)} balance will be automatically charged to your saved card on ${formatDate(params.balanceDueDate)} (30 days before check-in).`
      : "";

  const vars: BookingInvoiceVars = {
    guest_name: firstNameOf(params.guestName),
    property_name: params.propertyName,
    check_in_date: formatDate(params.checkInDate),
    check_out_date: formatDate(params.checkOutDate),
    total: formatMoney(params.totalCents),
    amount_due: formatMoney(params.amountCents),
    invoice_url: params.hostedInvoiceUrl,
    discount_line: discountLine,
    balance_line: balanceLine,
  };

  const { subject, body } = renderTemplate(type, vars, {
    subject: override.subject,
    message: override.message,
  });

  const { error } = await getResend().emails.send({
    from: FROM,
    to: params.to,
    subject,
    text: body,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);

  await logEmail({
    registrationId: params.registrationId,
    to: params.to,
    subject,
    body,
    emailType: type,
  });
}

interface PlanPickerParams {
  to: string;
  guestName: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  totalCents: number;
  splitAllowed: boolean;
  pickPlanUrl: string;
  hostId?: string;
  registrationId?: string;
}

export async function sendBookingPlanPickerEmail(params: PlanPickerParams) {
  const type: GuestMessageType = "booking_plan_picker";
  const override = await loadOverride(params.hostId, type);
  if (!override.enabled) return;

  const optionsLine = params.splitAllowed
    ? "You can pay in full now, or split it 50% now and 50% auto-charged 30 days before check-in."
    : "You can pay in full now (your check-in is too close for our split-pay option).";

  const vars: BookingPlanPickerVars = {
    guest_name: firstNameOf(params.guestName),
    property_name: params.propertyName,
    check_in_date: formatDate(params.checkInDate),
    check_out_date: formatDate(params.checkOutDate),
    total: formatMoney(params.totalCents),
    options_line: optionsLine,
    pick_plan_url: params.pickPlanUrl,
  };

  const { subject, body } = renderTemplate(type, vars, {
    subject: override.subject,
    message: override.message,
  });

  const { error } = await getResend().emails.send({
    from: FROM,
    to: params.to,
    subject,
    text: body,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);

  await logEmail({
    registrationId: params.registrationId,
    to: params.to,
    subject,
    body,
    emailType: type,
  });
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

