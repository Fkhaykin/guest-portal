export type GuestMessageType =
  | "booking_confirmation"
  | "pre_arrival"
  | "day_of_checkin"
  | "post_checkout";

export type GuestMessageChannel = "lodgify" | "email";

interface TemplateVars {
  guest_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  portal_link: string;
}

const TEMPLATES: Record<GuestMessageType, { subject: string; body: string }> = {
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
};

export function renderTemplate(
  type: GuestMessageType,
  vars: TemplateVars
): { subject: string; body: string } {
  const tpl = TEMPLATES[type];
  const replace = (s: string) =>
    s
      .replace(/\{\{guest_name\}\}/g, vars.guest_name)
      .replace(/\{\{property_name\}\}/g, vars.property_name)
      .replace(/\{\{check_in_date\}\}/g, vars.check_in_date)
      .replace(/\{\{check_out_date\}\}/g, vars.check_out_date)
      .replace(/\{\{portal_link\}\}/g, vars.portal_link);

  return { subject: replace(tpl.subject), body: replace(tpl.body) };
}
