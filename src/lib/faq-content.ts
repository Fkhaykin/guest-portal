// Curated guest-facing FAQ for the public /faq page. Sourced from
// policy-content.ts, house-rules.ts, and the questions guests actually ask.
// Operational details (door codes, wifi passwords) deliberately stay in the
// private guest portal. Keep answers consistent with /rental-policies — that
// page is the authority.

export type FaqItem = { q: string; a: string; href?: string };
export type FaqCategory = { key: string; title: string; items: FaqItem[] };

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    key: "booking",
    title: "Booking & Payment",
    items: [
      {
        q: "Is booking direct really cheaper than Airbnb or Vrbo?",
        a: "Yes. The nightly rate is the same or lower, and you skip the platform's guest service fee — typically around 14% of the booking. Returning guests also get a loyalty discount when they book direct: just message us before you book.",
        href: "/why-summit",
      },
      {
        q: "When is payment due?",
        a: "The full amount — nightly rate, cleaning fee, taxes, and any add-ons — is charged when you book. Your reservation is confirmed as soon as payment clears. We accept cards, Apple Pay, and Google Pay.",
        href: "/rental-policies#payment",
      },
      {
        q: "What is the cancellation policy?",
        a: "Cancel 60+ days before check-in for a full refund less a 5% processing fee. 30–59 days out: 50% refund. Under 30 days the rental fee is non-refundable, though a future-stay credit may be possible 14–29 days out. Full details on the policies page.",
        href: "/rental-policies#cancellation",
      },
      {
        q: "Is there a security deposit?",
        a: "Some stays carry a refundable security deposit or card pre-authorization, typically $500–$2,000 depending on the home and length of stay. The exact amount is disclosed at booking, and it's released after a normal, damage-free stay.",
        href: "/rental-policies#deposit",
      },
      {
        q: "How old do I have to be to book?",
        a: "The booking guest must be at least 21, provide a valid ID before access codes go out, and stay on-site for the whole reservation.",
        href: "/rental-policies#eligibility",
      },
    ],
  },
  {
    key: "getting-in",
    title: "Getting In & The Communities",
    items: [
      {
        q: "What time are check-in and check-out?",
        a: "Check-in is 4 PM, check-out is 11 AM. Those times are firm — our cleaning crews turn the homes the same day — but ask about early check-in or late check-out and we'll confirm in writing when the calendar allows it.",
        href: "/rental-policies#checkin",
      },
      {
        q: "How does the gated community entrance work?",
        a: "Four of our homes are inside Penn Estates and one is in Blue Mountain Lake — both gated communities in East Stroudsburg. We register your name (and your guests' names) with the gate before arrival; you show ID at the gatehouse and drive straight in.",
        href: "/penn-estates",
      },
      {
        q: "How far are the houses from New York City?",
        a: "About 90 minutes to two hours by car from the George Washington Bridge, straight out I-80 West. Philadelphia is a similar drive. You'll want a car during your stay — the Poconos spread out.",
      },
      {
        q: "Can day visitors join us at the house?",
        a: "Yes, with a heads-up — day guests count toward the home's posted occupancy limit, gate access needs their names, and overnight guests must be on the reservation.",
        href: "/rental-policies#visitors",
      },
    ],
  },
  {
    key: "lake",
    title: "The Lake & Boats",
    items: [
      {
        q: "Are the boats really included?",
        a: "Really included. Kayaks, canoes, and pedal boats (varies by house) are free to use, right off each home's dock or shoreline. Non-swimmers must wear a flotation device, and flip the boats over when you're done so they don't fill with rain.",
        href: "/rental-policies#watercraft",
      },
      {
        q: "Can we swim in the lake?",
        a: "Our Penn Estates homes sit on Lower Twin Lake, which is for boating and fishing rather than swimming. The sandy swimming beach is at Hyland Lake, a few minutes away inside the community, and two Olympic-size pools are open Memorial Day through Labor Day. Blue Mountain Lake is paddle-only, with the same community pools.",
        href: "/penn-estates",
      },
      {
        q: "Can we fish?",
        a: "Yes — the community lakes are stocked, catch-and-release only. Bring your gear and cast right from the dock or the boats.",
      },
      {
        q: "Is the lake frozen in winter?",
        a: "Often, and it's beautiful — but staying off the ice is the rule. Winter stays are about the hot tub, the fire pit, the game room, and the ski mountains 20–30 minutes away.",
        href: "/things-to-do",
      },
    ],
  },
  {
    key: "amenities",
    title: "Amenities & Hot Tubs",
    items: [
      {
        q: "Do all the houses have hot tubs?",
        a: "Yes — every home has a private hot tub, open year-round. It's serviced between every stay.",
      },
      {
        q: "Which homes have saunas?",
        a: "Several of our homes have saunas — the Chalet's is the guest favorite after a ski day. Each listing page shows the full amenity list for that home.",
        href: "/search",
      },
      {
        q: "What's in the game rooms?",
        a: "It varies by house — pool tables, arcade machines, foosball, board games, and smart TVs. The Mansion adds a full bar area, and there's even an outdoor projector screen for backyard movie nights.",
        href: "/search",
      },
      {
        q: "Is firewood provided for the fire pit?",
        a: "Every home has a fire pit. Starter firewood varies by season; you can buy more at Archie's Corner inside Penn Estates or add firewood to your stay when you register.",
      },
      {
        q: "Is there fast wifi?",
        a: "Yes — every home has high-speed internet that comfortably handles streaming and remote work. If anything acts up mid-stay, message us and we'll fix it fast.",
      },
    ],
  },
  {
    key: "pets",
    title: "Pets",
    items: [
      {
        q: "Are dogs allowed?",
        a: "Dogs are welcome — up to three per stay for a flat $100 pet fee. Tell us about your dogs when you book. Cats and other pets can't come.",
        href: "/rental-policies#pets",
      },
      {
        q: "Which house is best with a dog?",
        a: "The Manor — it has a fully fenced yard, rare for the Poconos. The other homes are dog-friendly too; you'll just want the leash for the unfenced lakefront yards.",
        href: "/book/lake-adjacent-home-w-hot-tub-game-room-boats-fenced-yard",
      },
      {
        q: "Any pet rules we should know?",
        a: "Pick up after your dog immediately, don't leave dogs unattended in the house, and keep them off the furniture and beds. The full pet policy is on the policies page.",
        href: "/rental-policies#pets",
      },
    ],
  },
  {
    key: "policies",
    title: "House Rules",
    items: [
      {
        q: "Can we host a party or event?",
        a: "No — parties and events aren't allowed at any home, and there's a $2,500 minimum fee plus removal if one happens. Family reunions, birthday dinners, and celebration weekends with your registered guests are absolutely welcome; blowout parties are not.",
        href: "/rental-policies#parties",
      },
      {
        q: "What are quiet hours?",
        a: "10 PM to 8 AM, per community rules. The homes have outdoor noise sensors (no cameras indoors, ever) that alert us before a neighbor has to.",
        href: "/rental-policies#noise",
      },
      {
        q: "Is smoking allowed?",
        a: "Not indoors, anywhere — there's a $500 minimum remediation fee. Outside, use the provided ash cans and fully extinguish everything.",
        href: "/rental-policies#smoking",
      },
      {
        q: "How many people can stay?",
        a: "Each home's listing shows its maximum occupancy — most of our homes sleep 12, the Cottage sleeps 8. The limit is set by the township and the septic systems, so it's a hard cap that includes children.",
        href: "/search",
      },
    ],
  },
];

/** Flat list for FAQPage JSON-LD. */
export const ALL_FAQS: FaqItem[] = FAQ_CATEGORIES.flatMap((c) => c.items);
