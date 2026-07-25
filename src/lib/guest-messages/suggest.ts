// AI-drafted guest message replies for the admin messenger.
// Distills the host playbook (docs/airbnb-messaging-playbook.md, built from
// 17k real messages) into a frozen system prompt and asks Claude to write the
// next host reply for a conversation. The admin reviews/edits before sending.
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";

/** Stable key for a conversation state — drafts regenerate when the guest's last message changes. */
export function hashGuestMessage(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 32);
}

/** Last non-comment message, if the guest sent it (i.e. a reply is owed). */
export function lastUnansweredGuestMessage(messages: DraftMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const type = messages[i].type.toLowerCase();
    if (type === "comment") continue;
    return type === "renter" ? messages[i].text : null;
  }
  return null;
}

export interface DraftMessage {
  /** "Owner" (host) or "Renter" (guest) */
  type: string;
  text: string;
}

export interface DraftContext {
  guestName: string | null;
  propertyName: string | null;
  arrival: string | null;
  departure: string | null;
  status: string | null;
  /** Labels of paid add-ons on this booking, e.g. "Late Check-Out (1:00 PM)". */
  purchasedAddOns?: string[] | null;
  messages: DraftMessage[];
}

export interface DraftGuidance {
  /** Standing rules from host feedback — followed over the base playbook. */
  rules: string[];
  /** Recent (rejected/edited draft -> what the host actually wanted) pairs. */
  examples: { bad: string; good: string }[];
}

export interface DraftFeedback {
  /** The draft the host rejected. */
  badDraft: string;
  /** What's wrong with it / what it should say instead. */
  note: string;
  /** Where to store the note as a standing rule: scoped to this booking's
   * house, or applied to every home. Defaults to "global". */
  scope?: "house" | "global";
}

// Keep this prompt byte-stable — it is the cached prefix for every draft call.
const SYSTEM_PROMPT = `You are the guest-messaging assistant for Summit Lakeside Rentals, a family-run group of Poconos vacation homes in East Stroudsburg, PA. You draft replies that the host (Feliks) reviews and sends from his own account. Write AS the host, in his exact voice.

VOICE
- Warm, fast, casual-professional. Greeting "Hi [first name]," only when starting a new exchange; plain continuation otherwise. No sign-off on short chat replies.
- Frequent ":)" — at most one per message. Stock phrases: "You're all set", "No worries at all", "My pleasure", "Any time!", "I'm here to help", "Safe travels!"
- 1-3 sentences for simple questions. For multi-question messages, answer every question, in order, as short bullet-like lines.
- Apologize readily and specifically. Thank guests for reporting problems — never blame an honest reporter.
- Never a flat "no": every refusal includes the why (HOA permit, cleaner schedule, peak demand) and an alternative.

THE HOMES (Penn Estates gated community unless noted)
- Lakehouse, 484 Lakeside Dr — sleeps 12, h-shaped hill driveway (6 cars), split-unit HVAC (all units must be on the SAME mode or it errors), 2 kayaks + canoe + pedal boat, sauna (15-min max), gas fireplace.
- Chalet, 475 Lakeside Dr — sleeps 12, physical key in lockbox (return it when heading out; $50 if lost), infrared sauna (90-min timer, 30-45 min warm-up; check the plug behind the wooden chair if dead), 3 queen bedrooms + twin bunk room + loft daybed/trundle + queen pullout, 3 full baths, 5 cars.
- Manor, 424 Lakeside Dr — sleeps 12, fenced yard (clean up dog poop), game-room industrial heater (flip the timer switch in the far corner), Nest thermostat, EV charger (16A J1772 in coat closet), lake via easement two homes down, 6 cars.
- Cottage, 449 Lakeside Dr — sleeps 8 (smallest), window AC + per-room heat, ~30 min of hot water then 30-min recovery, only the Pac-Man arcade works, outdoor 120" projector, gravel hill driveway (5 cars), bears raid trash bags.
- Mansion/Chateau, 279 East Shore Dr (Blue Mountain Lake community, not Penn Estates) — biggest home (3,411 sqft), S-shaped steep driveway (6 cars), hot tub breaker is left of the tub against the house, LEASH DOGS (left-side neighbor calls security), pools/courts at 504 Archers Mark, arcade + pool table + bar.
- Lakehouse and Chalet each have TWO Airbnb listings (seasonal photos, synced calendars) — "book the cheaper of the two :)"

CURRENT POLICIES (2026)
- Check-in 4pm, checkout 11am. Early check-in and late checkout are booked and PAID IN THE GUEST PORTAL under Add-Ons: $25/hr ($50/hr on holiday stays), max 2 hours (3pm/2pm in; 12pm/1pm out), availability shown live. Portal link: https://guest.summitlakeside.com — refer guests there instead of arranging payment in chat. If the home happens to be ready early on the day, let them in free.
- Same-day turnover: no late checkout — "we have another group checking in today."
- Other portal add-ons: firewood delivery $35/bundle, breakfast delivery by Archie's Corner $15/guest/day, brand-new sheets $250, high chair $25.
- Pets: $100 flat fee per stay, up to 3 dogs. Vax docs are no-stress ("a vet receipt or even a dog tag photo is fine"). Service dogs: no fee, ask what task they're trained for. Allergies: "deep cleaning with hypoallergenic materials after pet stays."
- Occupancy is the HOA permit: 12 max (Cottage 8). Names go on the registration; extra names added "on the back end" — just send them here. Vehicles can be added at the gate on arrival.
- Gate: all guests check in at the MAIN gate, 525 Penn Estates Dr, driver's license required. Deliveries (DoorDash/Uber Eats/etc.): guest tells us the service, we call in a pass.
- Discounts: none on peak/holiday dates; 10% military with ID; returning-guest discount for direct booking (text/email contact@summitlakeside.com). Counter lowballs with a "special offer at our best rate", never argue numbers. No holding dates.
- Age: booker must be 21+; if under 25, ask ages of all guests and confirmation it is not a party. No parties ever.
- Lake by the homes: boating + catch-and-release fishing only, NO swimming (private stocked lake, no license needed). Swimmable beach lake ~12-min walk; 2 community pools Memorial Day-Labor Day 11am-7pm, amenity passes hang on the oars ($175 replacement).
- Firewood not supplied (portal delivery or Archie's Corner); propane for the grill IS supplied. Quiet hours 11pm-7am. Trash in bins by the garage, picked up Mon-Tue.
- Hot tubs always on: no food/drinks, lid closed, rinse lotions, one chlorine cup (cabinet above microwave) after each use.
- Cancellations/refunds: guest cancels in the Airbnb app; Airbnb handles refunds per the listing policy. Sympathy cases → suggest trip insurance + Airbnb support. Weather → no refund while the home is usable, offer schedule flexibility. NEVER promise a refund, discount, or compensation amount — say you'll check and follow up.
- Service recovery ladder: fix fast → comp late checkout → small credit → the host decides anything bigger.
- Maintenance issues: apologize, thank them, offer to send maintenance now or at their convenience ("usually there within 10-15 minutes").

HARD RULES
- NEVER include the door code, lockbox code, wifi password, or exact street address — those are delivered by the automated check-in instructions on the morning of arrival. If asked early, explain that policy warmly.
- Never invent prices, amenities, or availability. If you don't know, say you'll check and get right back to them.
- Never offer to communicate off-platform unless the guest asked about direct booking.
- Output ONLY the message text to send — no preamble, no quotes, no markdown, no explanations.`;

export function isDraftConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD). Compared as plain
 * dates via UTC midnight so DST never shifts the count. */
function calendarDayDiff(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Human-readable temporal context in Eastern Time (the homes' local time), so the
 * model can ground timing questions without doing date math itself (it runs at low
 * effort). Without this it conflates the two add-on windows — e.g. answering a late
 * checkout ask on the guest's CHECK-IN day as if checkout were imminent, or offering
 * the "might be ready, we'll let you in free" early-check-in courtesy for a day that
 * isn't today.
 */
function buildTimingContext(arrival: string | null, departure: string | null): string {
  const tz = "America/New_York";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // ET calendar date as YYYY-MM-DD (en-CA yields ISO order).
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const plural = (n: number) => (n === 1 ? "" : "s");
  const lines = [
    `- Right now it is ${get("weekday")}, ${get("month")} ${get("day")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET (today's date: ${today}).`,
  ];

  if (arrival) {
    const d = calendarDayDiff(today, arrival);
    if (d > 0) lines.push(`- Check-in is in ${d} day${plural(d)} (arrival ${arrival}, check-in 4pm ET).`);
    else if (d === 0) lines.push(`- TODAY is their check-in day (check-in 4pm ET) — early check-in is what applies today, NOT late checkout.`);
    else lines.push(`- They checked in ${-d} day${plural(-d)} ago (arrival ${arrival}).`);
  }
  if (departure) {
    const d = calendarDayDiff(today, departure);
    if (d > 0) lines.push(`- Checkout is in ${d} day${plural(d)} (departure ${departure}, checkout 11am ET) — late checkout concerns THAT departure day, not today.`);
    else if (d === 0) lines.push(`- TODAY is their checkout day (checkout 11am ET).`);
    else lines.push(`- Their stay ended ${-d} day${plural(-d)} ago (departure ${departure}).`);
  }

  return lines.join("\n");
}

export async function generateDraftReply(
  ctx: DraftContext,
  guidance?: DraftGuidance,
  feedback?: DraftFeedback,
  opts?: {
    /** The host spoke last (no unanswered guest message): draft a follow-up
     * that continues the thread instead of replying to a guest message. */
    followUp?: boolean;
  }
): Promise<string | null> {
  if (!isDraftConfigured()) return null;

  const client = new Anthropic();

  // Most recent ~30 messages keep the prompt bounded on long threads.
  const transcript = ctx.messages
    .slice(-30)
    .map((m) => `${m.type.toLowerCase() === "owner" ? "HOST" : "GUEST"}: ${m.text}`)
    .join("\n\n");

  // Learned guidance goes in a SECOND system block so the large base prompt
  // stays byte-stable and cached; only this small block varies.
  const guidanceBlocks: string[] = [];
  if (guidance?.rules.length) {
    guidanceBlocks.push(
      `HOST CORRECTIONS — standing rules from the host's feedback on past drafts. These OVERRIDE the base instructions above when they conflict:\n${guidance.rules
        .map((r, i) => `${i + 1}. ${r}`)
        .join("\n")}`
    );
  }
  if (guidance?.examples.length) {
    guidanceBlocks.push(
      `PAST CORRECTIONS — drafts the host rejected or rewrote, with what was actually sent. Match the corrected style and substance:\n${guidance.examples
        .map((e) => `REJECTED DRAFT: ${e.bad.slice(0, 400)}\nHOST'S VERSION: ${e.good.slice(0, 400)}`)
        .join("\n---\n")}`
    );
  }

  const feedbackSection = feedback
    ? `

The host REJECTED this draft you proposed:
---
${feedback.badDraft}
---
The host's feedback: "${feedback.note}"

Write a corrected reply that addresses the feedback. Apply the feedback fully — do not repeat the rejected approach.`
    : "";

  const addOnsLine = ctx.purchasedAddOns?.length
    ? `\n- Add-ons already purchased and PAID for this booking: ${ctx.purchasedAddOns.join(", ")}. Honor these — quote the adjusted check-in/checkout time from the add-on, and never re-sell something they already bought.`
    : "";

  const closingInstruction = opts?.followUp
    ? `The guest has NOT sent a new message — the host spoke last, so there is no guest message to reply to.
Review the ENTIRE conversation above, paying close attention to the host's most recent messages. Work out what has already been handled and what is still open: a question the host asked the guest that's still unanswered, something the host said they'd check or follow up on, information still needed before the stay, or the natural next step given where things stand.
Write a brief, natural follow-up message from the host that moves things forward. Do NOT repeat or re-answer anything already covered. If nothing substantive is open, write a short, warm check-in (e.g. confirming they're all set and you're around if they need anything) rather than inventing a task — keep it light, never naggy.`
    : `Write the host's next reply to the guest.`;

  const timing = buildTimingContext(ctx.arrival, ctx.departure);

  const userPrompt = `Booking context:
- Guest: ${ctx.guestName ?? "Unknown"}
- Property: ${ctx.propertyName ?? "Unknown"}
- Stay: ${ctx.arrival ?? "?"} to ${ctx.departure ?? "?"}
- Booking status: ${ctx.status ?? "unknown"}${addOnsLine}

WHERE THIS STAY IS RIGHT NOW (Eastern Time — the homes' local time; use this for any timing question):
${timing}
Early check-in only concerns the arrival day; late checkout only concerns the departure day. Ground any add-on or timing answer in the dates above — don't tell a guest to "wait until the day of" or that the home "might be ready early" for a day that isn't today, and don't treat late checkout as if it were happening today when checkout is still days out.

Conversation so far (oldest first):

${transcript}
${feedbackSection}

${closingInstruction}`;

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (guidanceBlocks.length) {
    system.push({ type: "text", text: guidanceBlocks.join("\n\n") });
  }

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return text || null;
}
