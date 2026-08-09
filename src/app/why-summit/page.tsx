import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus, Quote } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL, ogMeta } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickReviewQuotes } from "@/lib/review-quotes";
import {
  ContentHero,
  TrustStrip,
  SectionLabel,
  PropertyCardGrid,
  ReviewQuoteGrid,
  type PropertyCardData,
} from "@/components/marketing/content-blocks";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Why Book Direct With Us",
  description:
    "Family-run lakefront rentals in the Poconos. Book direct for the lowest rates, no platform service fees, flexible stays, and hosts who answer within minutes.",
  alternates: { canonical: "/why-summit" },
  openGraph: ogMeta({
    title: "Why Book Direct With Summit Lakeside",
    description:
      "The same lakefront homes you see on Airbnb and Vrbo — without the service fees, and with the owners a text away.",
  }),
};

/* Real photos of the real houses, self-hosted. */
const P = "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images";
const HERO = `${P}/lodgify-355871/airbnb/07-listing-image-7.jpg`; // aerial over the lakes
const ORIGIN = `${P}/lodgify-368901/airbnb/69-additional-photos-image-5.jpg`; // Mansion at dusk
const FIREPIT = `${P}/lodgify-355872/airbnb/44-newly-landscaped-fire-pit-area.jpg`; // string-lit fire pit
const HOTTUB = `${P}/lodgify-355872/airbnb/56-hot-tub-image-1.jpg`; // hot tub over the lake
const GAMEROOM = `${P}/lodgify-368827/airbnb/30-game-room-image-1.jpg`; // Cottage game room
const SAUNA = `${P}/lodgify-355871/airbnb/56-newly-installed-back-yard-sauna.jpg`; // barrel sauna in snow
const DOCK = `${P}/lodgify-355872/airbnb/46-lake-dock.jpg`; // dock at night

const HOUSES: Array<Omit<PropertyCardData, "image" | "sleeps"> & { slug: string }> = [
  {
    slug: "poconos-lakefront-with-hot-tub-boats-and-more",
    title: "The Lakehouse",
    blurb: "Lakefront with the dock, the boats, and the game room.",
    tags: ["Lakefront", "Hot Tub"],
  },
  {
    slug: "luxury-lakefront-chalet-in-poconos-1-5hrs-from-nyc",
    title: "The Chalet",
    blurb: "The A-frame with the sauna — ski-season headquarters.",
    tags: ["Sauna", "Lake Views"],
  },
  {
    slug: "lake-adjacent-home-w-hot-tub-game-room-boats-fenced-yard",
    title: "The Manor",
    blurb: "Fully fenced yard — the pick for dog families.",
    tags: ["Fenced Yard", "Hot Tub"],
  },
  {
    slug: "cozy-lakefront-home-w-game-room-hot-tub-fire-pit-boats",
    title: "The Cottage",
    blurb: "The cozy one, with an arcade and a fire pit at the water.",
    tags: ["Sleeps 8", "Game Room"],
  },
  {
    slug: "lakefront-mansion-w-3-decks-hot-tub-boats-game-room",
    title: "The Mansion",
    blurb: "3,400+ sq ft and three decks over Blue Mountain Lake.",
    tags: ["Sleeps 12", "Three Decks"],
  },
];

const AMENITY_CARDS = [
  {
    image: HOTTUB,
    alt: "Hot tub overlooking the lake in fall",
    title: "Hot tubs with a view",
    body: "Every home has one, serviced between every stay — most of them steps from the water.",
  },
  {
    image: GAMEROOM,
    alt: "Game room with pool table, foosball, arcade and karaoke",
    title: "Game rooms that go hard",
    body: "Pool tables, arcade cabinets, foosball, karaoke — rainy days are somebody's favorite days here.",
  },
  {
    image: SAUNA,
    alt: "Barrel sauna glowing in the snow",
    title: "Built for all four seasons",
    body: "Saunas after ski days, fire pits in October, the lake all summer. We keep adding — the barrel sauna is the newest.",
  },
];

const PROMISES = [
  { title: "Real responses, fast", body: "No chatbots. No call centers. A real person, usually within minutes." },
  { title: "Spotless every time", body: "Professional cleans with our own checklist. Inspected before you arrive." },
  { title: "Stocked and ready", body: "Coffee, essentials, board games, and a real local guide waiting." },
  { title: "Personal touches", body: "Celebrating something? Tell us. We love adding small surprises." },
  { title: "Honest and transparent", body: "No hidden fees, no fine-print. What we quote is what you pay." },
  { title: "Insider local knowledge", body: "Restaurants, trails, swim spots, and tips you won't find on Google." },
];

const COMPARISON = [
  {
    name: "Airbnb / Vrbo",
    highlight: false,
    rows: [
      { ok: true, text: "The same five lakefront homes" },
      { ok: false, text: "Guest service fee (~14%) on top" },
      { ok: false, text: "Messages relayed through the platform" },
      { ok: false, text: "No returning-guest discount" },
    ],
  },
  {
    name: "Book direct with us",
    highlight: true,
    rows: [
      { ok: true, text: "The same five lakefront homes" },
      { ok: true, text: "No platform service fees — ever" },
      { ok: true, text: "Text or call the actual owners" },
      { ok: true, text: "Loyalty discount when you come back" },
    ],
  },
  {
    name: "Either way",
    highlight: false,
    rows: [
      { ok: true, text: "Hot tubs, boats, fire pits included" },
      { ok: true, text: "Same cleaning standards, same crew" },
      { ok: true, text: "Same house rules & quiet hours" },
      { ok: true, text: "Same 4.91-star hosting" },
    ],
  },
];

export default async function WhySummitPage() {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("property")
    .select("slug, cover_image_url, max_guests")
    .in("slug", HOUSES.map((h) => h.slug));
  const bySlug = new Map((rows ?? []).map((r) => [r.slug, r]));
  const cards: PropertyCardData[] = HOUSES.map((h) => ({
    ...h,
    image: bySlug.get(h.slug)?.cover_image_url ?? null,
    sleeps: bySlug.get(h.slug)?.max_guests ?? null,
  }));

  const quotes = pickReviewQuotes(
    [
      "Poconos Lakefront with Hot Tub, boats, and more!",
      "Lakefront Mansion w/ 3 Decks, Hot Tub, Boats, & Game Room!",
      "Cozy Lakefront Home w/ Game Room, Hot Tub, Fire Pit, & Boats",
    ],
    2
  );

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Why Summit" },
          ],
        }}
      />

      <ContentHero
        image={HERO}
        alt="Aerial view over the lakes and forests of Penn Estates"
        eyebrow="Our Story · Family-Run Since Day One"
        title="We built this for the people who get it."
        lede="Five lakefront homes on two quiet lakes, kept by a family that actually lives here — and priced better when you book them straight from us."
      />

      <TrustStrip />

      {/* Chapter One — origin */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-center">
          <div className="lg:col-span-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ORIGIN}
              alt="The Lakefront Mansion and its decks from above at dusk"
              className="w-full aspect-4/5 object-cover rounded-3xl shadow-2xl"
            />
          </div>
          <div className="lg:col-span-6 space-y-6">
            <SectionLabel eyebrow="Chapter One" title="It started with one cabin on the lake." />
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed -mt-8">
              <p>
                When we bought our first Poconos house, the test was simple:
                would we actually want to stay here — not someday, this
                weekend? The right beds, the right layout, the boats already
                on the water.
              </p>
              <p>
                We've held that test for every house since. Five homes later,
                we still live here, still do the walkthroughs ourselves, and
                still notice everything.
              </p>
              <p className="text-foreground font-medium">
                That firsthand standard is what Summit Lakeside is built
                around.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Full-bleed pullquote — the real fire pit */}
      <section className="relative h-[70vh] min-h-120 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FIREPIT}
          alt="String lights over the fire pit and red Adirondack chairs at night"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/45 to-black/15" />
        <div className="absolute inset-0 flex items-center px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <div className="max-w-2xl">
              <Quote className="h-12 w-12 text-white/40 mb-6" />
              <p className="text-3xl sm:text-4xl lg:text-5xl font-medium text-white leading-tight">
                We run every house the way we'd want to stay in it. Because we
                do.
              </p>
              <p className="text-white/70 mt-8 text-xs tracking-[0.3em] uppercase">
                — The Summit Lakeside team
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What staying here means — real amenity photos */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="The Standard"
            title="What staying with us actually means."
            sub="Every photo on this page is one of our houses — nothing staged, nothing borrowed."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AMENITY_CARDS.map((card) => (
              <div key={card.title} className="rounded-3xl overflow-hidden border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.image} alt={card.alt} className="aspect-4/3 w-full object-cover" />
                <div className="p-6">
                  <h3 className="font-bold text-xl">{card.title}</h3>
                  <p className="text-muted-foreground mt-2 leading-relaxed">{card.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The five homes */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="The Collection"
            title="Five homes. Two lakes. One street, mostly."
            sub="Four in Penn Estates on Lakeside Drive, one on Blue Mountain Lake — big groups book several and spend the weekend two doors apart."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {cards.map((card) => (
              <Link
                key={card.slug}
                href={`/book/${card.slug}`}
                className="group block rounded-3xl overflow-hidden border bg-card shadow-sm hover:shadow-xl transition-shadow"
              >
                <div className="relative aspect-4/3 overflow-hidden">
                  {card.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.image}
                      alt={card.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  {card.sleeps && (
                    <span className="absolute top-3 left-3 rounded-full bg-black/60 text-white text-xs font-semibold px-3 py-1 backdrop-blur-sm">
                      Sleeps {card.sleeps}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold leading-snug group-hover:text-primary transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-snug">{card.blurb}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Book direct, pay less */}
      <section className="py-20 sm:py-28 bg-muted/30 border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="Book Direct, Pay Less"
            title="Same homes. Same beds. Smaller bill."
            sub="You've seen these houses on Airbnb and Vrbo — they're ours. Book here and the platform's ~14% guest service fee simply never gets charged."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border">
            {COMPARISON.map((col) => (
              <div
                key={col.name}
                className={`p-7 sm:p-8 ${col.highlight ? "bg-foreground text-background" : "bg-background"}`}
              >
                <h3 className="text-lg font-bold mb-5">{col.name}</h3>
                <ul className="space-y-3.5">
                  {col.rows.map((row) => (
                    <li key={row.text} className="flex items-start gap-2.5 text-sm leading-snug">
                      {row.ok ? (
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${col.highlight ? "text-background" : "text-primary"}`} />
                      ) : (
                        <Minus className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className={col.highlight || row.ok ? "" : "text-muted-foreground"}>
                        {row.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            Questions before you book? Start with the{" "}
            <Link href="/faq" className="text-primary font-medium hover:underline">
              guest FAQ
            </Link>{" "}
            or the{" "}
            <Link href="/rental-policies" className="text-primary font-medium hover:underline">
              full policies
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Promises */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel eyebrow="Our Promise" title="What you get, every time." />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border">
            {PROMISES.map((item, i) => (
              <div key={item.title} className="bg-background p-7 sm:p-8 hover:bg-muted/40 transition-colors">
                <div className="text-sm font-semibold text-muted-foreground tabular-nums mb-4">
                  0{i + 1}
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guest words */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel eyebrow="Guest Words" title="Don't take ours for it." />
          <ReviewQuoteGrid reviews={quotes} />
        </div>
      </section>

      {/* Final CTA — the real dock at night */}
      <section className="relative h-[80vh] min-h-130 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={DOCK}
          alt="Adirondack chairs on the lakeside dock under string lights at night"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/20" />
        <div className="absolute inset-0 flex items-end pb-16 sm:pb-24 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white max-w-3xl text-balance">
              The lake's ready when you are.
            </h2>
            <p className="text-lg text-white/80 mt-5 max-w-xl">
              Book direct and save — no platform fees, and returning guests get
              a loyalty discount.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/search"
                className="inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-7 py-3.5 hover:opacity-90 transition-opacity"
              >
                Check availability <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-white/50 text-white font-semibold px-7 py-3.5 hover:bg-white/10 transition-colors"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
