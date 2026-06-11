// Quick replies for the admin messenger — canned answers distilled from the
// full Airbnb/Lodgify message history (docs/automessages/08-quick-replies.md).
// Bodies use {{var}} placeholders compatible with interpolate() from templates.ts.

export interface QuickReply {
  id: string;
  title: string;
  category: string;
  /** Lowercase keywords/phrases matched against the guest's last message. */
  keywords: string[];
  body: string;
}

export const QUICK_REPLY_CATEGORIES = [
  "Pricing & Booking",
  "Check-in / Checkout",
  "Pets",
  "Amenities",
  "During the Stay",
  "Cancellations & Refunds",
] as const;

export const QUICK_REPLIES: QuickReply[] = [
  // --- Pricing & Booking ---
  {
    id: "discount-decline",
    title: "Discount — not available",
    category: "Pricing & Booking",
    keywords: ["discount", "lower price", "best price", "deal", "cheaper", "price match", "negotiate", "budget"],
    body: `Hi {{guest_first_name}}, thanks for your inquiry. We'd be happy to host, but do not have discounts available for those dates at this time.`,
  },
  {
    id: "discount-special-offer",
    title: "Discount — send special offer",
    category: "Pricing & Booking",
    keywords: ["discount", "lower price", "best price", "offer", "cheaper", "budget"],
    body: `Hi {{guest_first_name}}, I spoke to the owner and am able to send a slightly lower rate if you are able to book today :) I'll send along a special offer with our best possible rate.`,
  },
  {
    id: "discount-military",
    title: "Military discount",
    category: "Pricing & Booking",
    keywords: ["military", "veteran", "army", "navy", "marine", "air force", "service member"],
    body: `Yes, we provide a 10% discount to veterans with proof of military ID :)`,
  },
  {
    id: "returning-guest",
    title: "Returning guest discount",
    category: "Pricing & Booking",
    keywords: ["come back", "return", "book again", "next time", "rebook", "stay again"],
    body: `Thanks so much for staying with us! If you'd ever like to come back, feel free to text or email us directly at contact@summitlakeside.com and we will extend a returning guest discount :)`,
  },
  {
    id: "hold-dates",
    title: "Can't hold dates",
    category: "Pricing & Booking",
    keywords: ["hold", "reserve the dates", "hold the dates", "keep the dates", "save the dates"],
    body: `We aren't able to hold dates, but I'll send a special offer now — it expires after 24 hours. The days will remain available to others until a booking is confirmed.`,
  },
  {
    id: "duplicate-listing",
    title: "Duplicate listing explanation",
    category: "Pricing & Booking",
    keywords: ["two listings", "same house", "same home", "other listing", "different price", "duplicate"],
    body: `It's the same home! We have two listings with seasonal photos, and the calendars are synced. The pricing is managed by Airbnb's algorithm — definitely feel free to request/book the cheaper of the two :)`,
  },
  {
    id: "age-policy",
    title: "Age requirement (21+)",
    category: "Pricing & Booking",
    keywords: ["age", "years old", "under 25", "young", "21", "old do you have to be", "minimum age"],
    body: `Hi {{guest_first_name}}, we ask the person booking be 21; if under 25, we'd like to know the ages of all guests at the home.`,
  },
  {
    id: "party-policy",
    title: "Party / event policy",
    category: "Pricing & Booking",
    keywords: ["party", "event", "birthday", "celebration", "gathering", "bbq", "get together", "bachelorette", "bachelor"],
    body: `A BBQ or small get-together is fine, but we do not permit parties with loud music or excessive drinking. Our community permit allows a maximum of {{max_guests}} guests at the home, and all guests must be on the registration form.`,
  },
  {
    id: "party-flag",
    title: "Airbnb blocked the booking",
    category: "Pricing & Booking",
    keywords: ["won't let me book", "wont let me book", "blocked", "can't book", "cant book", "error when booking", "airbnb support", "flagged"],
    body: `I'm so sorry about that — unfortunately it is Airbnb's algorithm flagging the booking, and prior guests have had very little luck dealing with their support. If you search my username you will find our site, where you can book directly (it'll also be a bit cheaper).`,
  },
  {
    id: "cross-sell",
    title: "Dates unavailable — other homes",
    category: "Pricing & Booking",
    keywords: ["available", "availability", "other dates", "anything else", "other properties", "other homes"],
    body: `Unfortunately those dates are booked, but if you go to my profile we have a few other homes nearby with very similar amenities. I'd be happy to send a special offer for whichever fits your group!`,
  },
  {
    id: "extra-guests",
    title: "Extra guests / occupancy cap",
    category: "Pricing & Booking",
    keywords: ["extra guest", "more people", "more guests", "add a guest", "occupancy", "max guests", "how many people", "visitors", "day guest"],
    body: `Our community permit allows a maximum of {{max_guests}} registered guests, and the gate will not admit anyone who isn't on the registration form. Day visitors are fine as long as they're registered and we stay within the limit — just send me the names here and I'll add them on the back end.`,
  },

  // --- Check-in / Checkout ---
  {
    id: "early-checkin",
    title: "Early check-in",
    category: "Check-in / Checkout",
    keywords: ["early check", "check in early", "arrive early", "earlier check", "check in at", "come early", "early arrival"],
    body: `We're usually able to accommodate a 3pm check-in, but I'll need to confirm around 11:30am that morning once the cleaners have arrived for turnover. Early check-in can also be guaranteed ahead of time for $25/hr (up to 3 hours) — otherwise, if the home is ready early, we'll always let you in at no charge :)`,
  },
  {
    id: "early-checkin-ready",
    title: "Early check-in — home ready",
    category: "Check-in / Checkout",
    keywords: ["on our way", "heading over", "early today"],
    body: `Good news — the home is all ready, so you are welcome to check in as early as you arrive :)`,
  },
  {
    id: "late-checkout-free",
    title: "Late checkout — 12pm free",
    category: "Check-in / Checkout",
    keywords: ["late check", "check out late", "checkout late", "extra hour", "leave later", "extend checkout", "late departure"],
    body: `Hi! Yes, we can accommodate a complimentary 12pm late checkout :) Anything later would be $25/hr for up to 3 hours — just let me know.`,
  },
  {
    id: "late-checkout-no",
    title: "Late checkout — same-day turnover",
    category: "Check-in / Checkout",
    keywords: ["late check", "check out late", "checkout late", "leave later"],
    body: `Unfortunately we have another group checking in that day, so we would have to stick to the 11am standard checkout. Thanks for understanding!`,
  },
  {
    id: "address-request",
    title: "Address before arrival",
    category: "Check-in / Checkout",
    keywords: ["address", "exact location", "where is the house", "where is the home", "directions"],
    body: `We don't provide the exact address prior to the day of check-in, for the safety of our current guests. For directions you can use the Penn Estates welcome center at 525 Penn Estates Dr, East Stroudsburg PA 18301 — you'll receive the full address and door code the morning of your stay.`,
  },

  // --- Pets ---
  {
    id: "pet-policy",
    title: "Pet policy ($100 flat)",
    category: "Pets",
    keywords: ["pet", "dog", "puppy", "bring our dog", "pet fee", "pet friendly"],
    body: `Yes, we are pet friendly! There is a flat $100 pet fee per stay, which covers up to 3 dogs (not per pet). I'll send the fee as a reservation adjustment.`,
  },
  {
    id: "pet-docs",
    title: "Pet vaccination docs",
    category: "Pets",
    keywords: ["vaccination", "vaccine", "vet record", "rabies", "pet document", "shot record", "vax"],
    body: `No stress on the documents — the office isn't too strict. A vet receipt or even a photo of a dog tag will do :)`,
  },
  {
    id: "service-animal",
    title: "Service animal",
    category: "Pets",
    keywords: ["service animal", "service dog", "esa", "emotional support"],
    body: `Service dogs do not have any pet fees. We'd just need to know what service the dog is trained to provide, and note they cannot be left at the home while the owner is away.`,
  },

  // --- Amenities ---
  {
    id: "firewood",
    title: "Firewood",
    category: "Amenities",
    keywords: ["firewood", "fire wood", "fire pit", "firepit", "bonfire", "wood for the fire"],
    body: `We don't supply firewood, but there's often some left over from previous guests. If not, our community store Archie's Corner sells it (you'll pass it on your way in), as do Weis and the local gas stations. I'd recommend grabbing some starter logs as well! Propane for the grill IS provided.`,
  },
  {
    id: "boats-lake",
    title: "Boats / lake / fishing",
    category: "Amenities",
    keywords: ["kayak", "canoe", "boat", "fishing", "fish", "paddle", "lake access", "life jacket"],
    body: `Yes! The home comes with kayaks and a canoe, free to use anytime — life jackets are provided too (kid sizes as well). The lake by the home is for boating and fishing (catch and release, no license needed — it's a private community lake, stocked with bass, pike, sunnies and catfish). There's also a swimmable beach lake about a 12-minute walk away.`,
  },
  {
    id: "swimming",
    title: "Swimming / pools",
    category: "Amenities",
    keywords: ["swim", "swimming", "pool", "beach"],
    body: `I wouldn't recommend the near lake for swimming — it's treated for boating and fishing only. There's a swimmable beach lake a short walk away, plus two community pools (open Memorial Day–Labor Day, 11am–7pm), all included with the amenity passes at the home.`,
  },
  {
    id: "hot-tub",
    title: "Hot tub",
    category: "Amenities",
    keywords: ["hot tub", "hottub", "jacuzzi", "spa", "tub working", "tub on"],
    body: `The hot tub is on and ready to use 24/7, all year round :) Just no food or drinks in the tub, keep the lid closed when not in use, and drop one of the chlorine cups (cabinet above the kitchen microwave) in after each use.`,
  },
  {
    id: "crib",
    title: "Crib / pack and play",
    category: "Amenities",
    keywords: ["crib", "pack and play", "pack n play", "high chair", "baby", "infant", "toddler"],
    body: `Yes, we have a pack and play with fitted sheets — I'll make sure it is set up for your arrival :)`,
  },
  {
    id: "distances",
    title: "Distances (ski / waterparks)",
    category: "Amenities",
    keywords: ["how far", "distance", "camelback", "kalahari", "shawnee", "great wolf", "ski", "minutes away", "close to"],
    body: `We're about 20 minutes from Camelback and Shawnee, 25 from Kalahari, 10 from downtown Stroudsburg, and ~45 to Blue Mountain.`,
  },
  {
    id: "restaurants",
    title: "Restaurant recommendations",
    category: "Amenities",
    keywords: ["restaurant", "eat", "food recommendation", "dinner", "breakfast spot", "places to eat", "recommendations"],
    body: `My personal favorites: The Farmhouse for dinner (my favorite in the area), Cure Cafe for breakfast, and Yusan for sushi. Happy to send the full list of restaurants, hikes, and rainy-day spots if you'd like!`,
  },

  // --- During the Stay ---
  {
    id: "delivery-pass",
    title: "Delivery gate pass",
    category: "During the Stay",
    keywords: ["doordash", "door dash", "uber eats", "ubereats", "instacart", "delivery", "deliver", "pizza", "grubhub", "uber", "lyft", "taxi"],
    body: `No problem — just let me know the restaurant or service (Uber Eats, DoorDash, etc.) when you order and I'll call a pass into the gate :)`,
  },
  {
    id: "add-guest-vehicle",
    title: "Add guest / vehicle",
    category: "During the Stay",
    keywords: ["add a car", "add a vehicle", "add a guest", "another car", "license plate", "registration form", "add to the list", "at the gate", "stuck at the gate"],
    body: `No problem, you can just send me the info here and I will add it on the back end. Vehicles can also be added at the gate on arrival — it's really only the guest names they need ahead of time.`,
  },
  {
    id: "maintenance",
    title: "Maintenance issue — first response",
    category: "During the Stay",
    keywords: ["broken", "not working", "doesn't work", "doesnt work", "issue with", "problem with", "leak", "clogged", "no hot water", "heat is", "ac is", "wifi is", "tv is", "stopped working"],
    body: `Oh no, I'm so sorry about that — thank you for letting me know! Would you like me to send maintenance over now, or we can wait until after your checkout, whatever is most convenient for you. They can usually be there within 10–15 minutes.`,
  },
  {
    id: "damage-report-thanks",
    title: "Guest reports pre-existing damage",
    category: "During the Stay",
    keywords: ["was already broken", "already damaged", "we noticed", "want to report", "heads up", "before we arrived", "when we got here"],
    body: `Thank you so much for the heads up — noted that this was there prior to your arrival, so no worries at all, you won't be charged. This is super helpful for scheduling a repair!`,
  },
  {
    id: "smoking",
    title: "Smoking policy",
    category: "During the Stay",
    keywords: ["smoke", "smoking", "cigarette", "vape", "cigar"],
    body: `Smoking outdoors is totally fine — we just ask that you're mindful not to leave cigarette butts behind. No smoking inside the home, please.`,
  },
  {
    id: "lost-found",
    title: "Lost & found",
    category: "During the Stay",
    keywords: ["left behind", "forgot", "left my", "left our", "lost", "left a"],
    body: `Let me check with our cleaners! If found, we can ship it back — it's a flat $50 fee for shipping and handling, or you can send a pre-paid shipping label. Just let me know the address.`,
  },

  // --- Cancellations & Refunds ---
  {
    id: "cancellation",
    title: "Cancellation request",
    category: "Cancellations & Refunds",
    keywords: ["cancel", "cancellation", "refund", "money back"],
    body: `You would need to cancel on your end through the Airbnb app, and Airbnb handles all payments and refunds per the cancellation policy on the listing. We don't have the ability to refund their fees — you'd need to contact Airbnb for that portion.`,
  },
  {
    id: "cancellation-sympathy",
    title: "Cancellation — illness/emergency",
    category: "Cancellations & Refunds",
    keywords: ["sick", "illness", "emergency", "funeral", "passed away", "hospital", "covid", "family emergency"],
    body: `I'm so sorry to hear that. While I can not alter our cancellation policy, I would recommend contacting your trip insurance if you have it (many credit cards include it), and otherwise reaching out to Airbnb to see if they will assist given the circumstances.`,
  },
  {
    id: "weather",
    title: "Weather concerns",
    category: "Cancellations & Refunds",
    keywords: ["snow", "storm", "weather", "blizzard", "road conditions", "driving conditions", "hurricane", "rain"],
    body: `We're keeping an eye on the weather too! Per our policy we aren't able to refund while the home is available for use, and Airbnb acts as the intermediary for situations like this — if they determine your concerns fall within their policy, they would handle any refund directly. We're happy to offer flexibility on check-in/checkout times to help you travel at the safest hours.`,
  },
];

/** Properties capped at 8 guests; everything else is 12. */
export function maxGuestsForProperty(propertyName: string | null | undefined): string {
  if (propertyName && /cozy lakefront/i.test(propertyName)) return "8";
  return "12";
}

export interface ScoredReply {
  reply: QuickReply;
  score: number;
}

/**
 * Score quick replies against the guest's last message. Multi-word keyword
 * hits weigh more than single-word hits. Returns top matches, best first.
 */
export function suggestQuickReplies(guestMessage: string, max = 3): QuickReply[] {
  const text = guestMessage.toLowerCase();
  const scored: ScoredReply[] = [];

  for (const reply of QUICK_REPLIES) {
    let score = 0;
    for (const kw of reply.keywords) {
      if (text.includes(kw)) {
        score += kw.includes(" ") ? 2 : 1;
      }
    }
    if (score > 0) scored.push({ reply, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Keep one reply per category among suggestions so close variants
  // (e.g. both late-checkout answers) don't crowd out other topics.
  const seen = new Set<string>();
  const result: QuickReply[] = [];
  for (const { reply } of scored) {
    const key = reply.id.split("-").slice(0, 2).join("-");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(reply);
    if (result.length >= max) break;
  }
  return result;
}
