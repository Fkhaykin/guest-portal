export type GuestMessageType =
  | "booking_confirmation"
  | "pre_arrival"
  | "day_of_checkin"
  | "settling_in"
  | "pulse_check"
  | "checkout_morning"
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
    subject: "Your stay is just a few days away!",
    body: `Hi {{guest_name}},

Your stay at {{property_name}} starts on {{check_in_date}} — we can't wait to host you!

You'll receive the exact address, check-in instructions, and everything else you need the morning of your check-in.

If you haven't completed your guest registration yet, please do so before arrival (required to enter the community):
{{portal_link}}

If you have any questions before then, don't hesitate to reach out — we're here to help.

See you soon!`,
  },
  day_of_checkin: {
    subject: "Welcome — check-in day!",
    body: `Hi {{guest_name}},

Today's the day! Your stay at {{property_name}} begins today ({{check_in_date}}) at {{check_in_time}}.

If you still need to complete your registration:
{{portal_link}}

Enjoy your stay!`,
  },
  settling_in: {
    subject: "Welcome — we hope you're settling in!",
    body: `Hi {{guest_name}},

Welcome to {{property_name}}! I hope you had a smooth arrival and are settling in comfortably.

If there's anything you need during your stay, don't hesitate to reach out by replying to this message or calling +1 732-213-8571.

Enjoy your time at {{property_name}}!

Warm regards,
Summit Lakeside Rentals`,
  },
  pulse_check: {
    subject: "How is everything going?",
    body: `Hi {{guest_name}},

Just checking in — how is everything going at {{property_name}} so far?

If anything isn't perfect or you have any questions, just reply here and we'll take care of it.

Enjoy the rest of your stay!`,
  },
  checkout_morning: {
    subject: "Check-out today at {{check_out_time}}",
    body: `Hi {{guest_name}},

We hope you've had a great time at {{property_name}}! Thank you so much for staying with us.

Your check-out time today is {{check_out_time}}.

Need a later check-out? Availability and booking are in our guest portal (guest.summitlakeside.com). Leaving after check-out without prior notice will incur a $50 fee.

Before you head out, please be sure to:

1. Remove all personal belongings. Items left behind can be shipped back to you if you provide a pre-paid shipping label ($50 processing fee).

2. Remove all trash. The cleaning fee covers basic whole-house cleaning only — excessive dirt, stains, and garbage left behind will incur additional cleaning fees. If the bins outside are full, place bags next to them and we'll handle it.

3. Report any damages, or if you received a citation from security. Unreported citations incur a $25 processing fee.

All bedding, linens, and towels can be left as they are on beds or floors — we'll take care of them.

Thank you again for staying with us, and we hope to host you again soon!

Thanks,
Feliks
Summit Lakeside Rentals`,
  },
  post_checkout: {
    subject: "Thanks for staying with us!",
    body: `Hi {{guest_name}},

Thanks so much for staying at {{property_name}}. We really appreciate you choosing us and we hope you had a wonderful time.

If everything was to your liking, please consider leaving a 5-star review — it means a lot to us.

If anything was not as described or unsatisfactory, please let us know so we can make it right. We take guest feedback seriously and rely on it to keep improving the home for future guests.

Hope to host you again soon!

Feliks
Summit Lakeside Rentals`,
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

// Messages greet guests by first name only — never "Hi Deven Roucroft,".
// Applied wherever a full name is turned into the {{guest_name}} variable.
export function firstNameOf(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

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
  settling_in: ["guest_name", "property_name", "check_in_date", "check_out_date", "check_in_time", "check_out_time", "portal_link"],
  pulse_check: ["guest_name", "property_name", "check_in_date", "check_out_date", "portal_link"],
  checkout_morning: ["guest_name", "property_name", "check_in_date", "check_out_date", "check_in_time", "check_out_time", "portal_link"],
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
