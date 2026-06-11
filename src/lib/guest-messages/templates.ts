export type GuestMessageType =
  | "booking_confirmation"
  | "pre_arrival"
  | "day_of_checkin"
  | "post_checkout"
  | "registration_reminder"
  | "booking_invoice_full"
  | "booking_invoice_deposit"
  | "booking_plan_picker";

export type GuestMessageChannel = "lodgify" | "email";

export type TemplateVars = {
  guest_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  // Effective times — shifted when the guest paid for early check-in / late
  // check-out (see stayTimeVars in @/lib/upsells/timing).
  check_in_time: string;
  check_out_time: string;
  portal_link: string;
} & Record<string, string>;

export type BookingInvoiceVars = {
  guest_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  total: string;
  amount_due: string;
  invoice_url: string;
  discount_line: string;
  balance_line: string;
} & Record<string, string>;

export type BookingPlanPickerVars = {
  guest_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  total: string;
  options_line: string;
  pick_plan_url: string;
} & Record<string, string>;

export const TEMPLATES: Record<GuestMessageType, { subject: string; body: string }> = {
  booking_confirmation: {
    subject: "Your booking is confirmed",
    body: `Hi {{guest_name}},

Your stay at {{property_name}} is confirmed for {{check_in_date}}–{{check_out_date}}.

Please complete your guest registration (required before check-in):
{{portal_link}}

We look forward to hosting you!`,
  },
  pre_arrival: {
    subject: "Your stay is 3 days away",
    body: `Hi {{guest_name}},

Just a reminder — your stay at {{property_name}} starts on {{check_in_date}}.

If you haven't completed your guest registration yet, please do so before arrival:
{{portal_link}}

See you soon!`,
  },
  day_of_checkin: {
    subject: "Welcome — check-in day!",
    body: `Hi {{guest_name}},

Today's the day! Your stay at {{property_name}} begins today ({{check_in_date}}).

If you still need to complete your registration:
{{portal_link}}

Enjoy your stay!`,
  },
  post_checkout: {
    subject: "Thanks for staying with us!",
    body: `Hi {{guest_name}},

Thank you for staying at {{property_name}}! We hope you had a wonderful time.

If you have a moment, we'd really appreciate a review — it means a lot to us.

Hope to host you again soon!`,
  },
  registration_reminder: {
    subject: "Please complete your guest registration",
    body: `Hi {{guest_name}}, your stay at {{property_name}} starts {{check_in_date}}. Please complete your guest registration to avoid delays at check-in: {{portal_link}}`,
  },
  booking_invoice_full: {
    subject: "Action required: payment for your stay at {{property_name}}",
    body: `Hi {{guest_name}},

Your booking at {{property_name}} for {{check_in_date}} – {{check_out_date}} is reserved pending payment.

Booking total: {{total}}{{discount_line}}
Due now: {{amount_due}}

Pay your invoice here: {{invoice_url}}

Reply to this email if you have any questions.`,
  },
  booking_invoice_deposit: {
    subject: "Action required: 50% deposit for your stay at {{property_name}}",
    body: `Hi {{guest_name}},

Your booking at {{property_name}} for {{check_in_date}} – {{check_out_date}} is reserved pending payment.

Booking total: {{total}}{{discount_line}}
Due now (50% deposit): {{amount_due}}

Pay your invoice here: {{invoice_url}}{{balance_line}}

Reply to this email if you have any questions.`,
  },
  booking_plan_picker: {
    subject: "Action required: choose how to pay for your stay at {{property_name}}",
    body: `Hi {{guest_name}},

Your booking at {{property_name}} for {{check_in_date}} – {{check_out_date}} is reserved pending payment.

Booking total: {{total}}
{{options_line}}

Pick your payment plan: {{pick_plan_url}}

Reply to this email if you have any questions.`,
  },
};

// Generic substitution: replace every {{key}} with vars[key]. Unknown keys
// pass through unchanged so previewing/editing is forgiving.
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return key in vars ? vars[key] : `{{${key}}}`;
  });
}

export function renderTemplate(
  type: GuestMessageType,
  vars: Record<string, string>,
  override?: { subject?: string; message?: string }
): { subject: string; body: string } {
  const tpl = TEMPLATES[type];
  return {
    subject: interpolate(override?.subject ?? tpl.subject, vars),
    body: interpolate(override?.message ?? tpl.body, vars),
  };
}

// Variables exposed in the admin editor for each template, used to populate
// the "available variables" badges. Keep in sync with the *Vars interfaces.
export const TEMPLATE_VARIABLES: Record<GuestMessageType, string[]> = {
  booking_confirmation: ["guest_name", "property_name", "check_in_date", "check_out_date", "check_in_time", "check_out_time", "portal_link"],
  pre_arrival: ["guest_name", "property_name", "check_in_date", "check_out_date", "check_in_time", "check_out_time", "portal_link"],
  day_of_checkin: ["guest_name", "property_name", "check_in_date", "check_out_date", "check_in_time", "check_out_time", "portal_link"],
  post_checkout: ["guest_name", "property_name", "check_in_date", "check_out_date", "portal_link"],
  registration_reminder: ["guest_name", "property_name", "check_in_date", "check_out_date", "check_in_time", "check_out_time", "portal_link"],
  booking_invoice_full: [
    "guest_name",
    "property_name",
    "check_in_date",
    "check_out_date",
    "total",
    "amount_due",
    "discount_line",
    "invoice_url",
  ],
  booking_invoice_deposit: [
    "guest_name",
    "property_name",
    "check_in_date",
    "check_out_date",
    "total",
    "amount_due",
    "discount_line",
    "balance_line",
    "invoice_url",
  ],
  booking_plan_picker: [
    "guest_name",
    "property_name",
    "check_in_date",
    "check_out_date",
    "total",
    "options_line",
    "pick_plan_url",
  ],
};
