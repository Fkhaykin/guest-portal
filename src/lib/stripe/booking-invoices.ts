import { stripe } from "@/lib/stripe/client";
import type Stripe from "stripe";

export type InvoicePhase = "deposit" | "balance" | "full";

interface CreateBookingInvoiceParams {
  customerId: string;
  registrationId: string;
  amountCents: number;
  phase: InvoicePhase;
  description: string;
  daysUntilDue: number;
  collectAutomatically?: boolean;
  defaultPaymentMethodId?: string;
}

// Creates and finalizes a Stripe Invoice for a booking deposit, balance, or full payment.
// Returns the finalized Invoice (with hosted_invoice_url and id).
export async function createAndFinalizeBookingInvoice(
  params: CreateBookingInvoiceParams
): Promise<Stripe.Invoice> {
  const collectionMethod: Stripe.InvoiceCreateParams.CollectionMethod = params.collectAutomatically
    ? "charge_automatically"
    : "send_invoice";

  const invoice = await stripe.invoices.create({
    customer: params.customerId,
    collection_method: collectionMethod,
    ...(collectionMethod === "send_invoice" ? { days_until_due: params.daysUntilDue } : {}),
    auto_advance: false,
    description: params.description,
    metadata: {
      registration_id: params.registrationId,
      booking_phase: params.phase,
    },
    payment_settings: {
      payment_method_types: ["card"],
    },
    ...(params.defaultPaymentMethodId
      ? { default_payment_method: params.defaultPaymentMethodId }
      : {}),
  });

  await stripe.invoiceItems.create({
    customer: params.customerId,
    invoice: invoice.id,
    amount: params.amountCents,
    currency: "usd",
    description: params.description,
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);
  return finalized;
}

// Get or create a Stripe customer for a guest by email.
export async function getOrCreateStripeCustomer(args: {
  existingCustomerId: string | null;
  email: string;
  name: string;
  phone?: string | null;
  guestId: string;
}): Promise<string> {
  if (args.existingCustomerId) {
    try {
      const c = await stripe.customers.retrieve(args.existingCustomerId);
      if (!c.deleted) return c.id;
    } catch {
      // fall through to create
    }
  }

  const customer = await stripe.customers.create({
    email: args.email,
    name: args.name,
    ...(args.phone ? { phone: args.phone } : {}),
    metadata: { guest_id: args.guestId },
  });
  return customer.id;
}
