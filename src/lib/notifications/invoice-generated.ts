import { Resend } from "resend";
import { sendSms } from "@/lib/sms/notify-cleaners";
import type { InvoiceLineItem } from "@/types/database";

const FROM = "Summit Lakeside <contact@summitlakeside.com>";

function formatMoney(cents: number): string {
  return (
    "$" +
    (cents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type InvoiceGeneratedParams = {
  invoiceNumber: string;
  cleanerName: string;
  cleanerCompany?: string | null;
  kind: string; // e.g. "Weekly — Summit" or "Monthly — Bianca's"
  periodStart: string;
  periodEnd: string;
  lineItems: InvoiceLineItem[];
  total: number;
  ownerEmails: string[];
  ownerPhones: string[];
};

/**
 * Email + text the property owner(s) when a cleaner invoice is generated.
 * Never throws — a notification failure must not abort invoice generation.
 */
export async function notifyOwnersOfInvoiceGenerated(
  params: InvoiceGeneratedParams
) {
  const cleanerLabel = params.cleanerCompany
    ? `${params.cleanerName} (${params.cleanerCompany})`
    : params.cleanerName;
  const period = `${formatDate(params.periodStart)} – ${formatDate(params.periodEnd)}`;

  const cleanings = params.lineItems.filter((i) => i.type === "cleaning").length;
  const petFees = params.lineItems.filter((i) => i.type === "pet_fee").length;
  const monthlyFee = params.lineItems.find((i) => i.type === "monthly_fee");

  const summaryParts = [`${cleanings} cleaning${cleanings === 1 ? "" : "s"}`];
  if (petFees > 0) {
    summaryParts.push(`${petFees} pet fee${petFees === 1 ? "" : "s"}`);
  }
  if (monthlyFee) {
    summaryParts.push(`monthly fee ${formatMoney(monthlyFee.amount)}`);
  }
  const summary = summaryParts.join(", ");

  // --- Email ---
  if (params.ownerEmails.length > 0 && process.env.RESEND_API_KEY) {
    const itemLines = params.lineItems.map(
      (i) => `  • ${i.description}: ${formatMoney(i.amount)}`
    );
    const text = [
      `A new cleaner invoice was generated.`,
      ``,
      `Invoice: ${params.invoiceNumber}`,
      `Cleaner: ${cleanerLabel}`,
      `Type: ${params.kind}`,
      `Period: ${period}`,
      ``,
      `Line items:`,
      ...itemLines,
      ``,
      `Total: ${formatMoney(params.total)}`,
    ].join("\n");

    try {
      const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: FROM,
        to: params.ownerEmails,
        subject: `New cleaner invoice ${params.invoiceNumber} — ${formatMoney(params.total)} (${params.kind})`,
        text,
      });
      if (error) {
        console.error("[invoice-notify] Resend error:", error.message);
      }
    } catch (err) {
      console.error("[invoice-notify] email failed:", err);
    }
  }

  // --- SMS ---
  const smsBody = [
    `New cleaner invoice ${params.invoiceNumber} — ${formatMoney(params.total)}.`,
    `${params.kind}, ${period}: ${summary}.`,
  ].join("\n");

  for (const phone of params.ownerPhones) {
    try {
      await sendSms(phone, smsBody, {
        eventType: "owner_invoice_generated",
      });
    } catch (err) {
      console.error("[invoice-notify] sms failed:", err);
    }
  }
}
