import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Hammer, MessageCircle, Quote } from "lucide-react";
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
  ReviewQuoteGrid,
  type PropertyCardData,
} from "@/components/marketing/content-blocks";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Us — The Family Behind the Homes",
  description:
    "Summit Lakeside is a family-run collection of five lakefront vacation homes in the Poconos — run hands-on, with a local crew behind every stay and a standard we refuse to drop.",
  alternates: { canonical: "/why-summit" },
  openGraph: ogMeta({
    title: "About Summit Lakeside Rentals",
    description:
      "A family-run collection of five lakefront homes in the Poconos — and the people who take care of them.",
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
    tags: [],
  },
  {
    slug: "luxury-lakefront-chalet-in-poconos-1-5hrs-from-nyc",
    title: "The Chalet",
    blurb: "The A-frame with the sauna — ski-season headquarters.",
    tags: [],
  },
  {
    slug: "lake-adjacent-home-w-hot-tub-game-room-boats-fenced-yard",
    title: "The Manor",
    blurb: "Fully fenced yard — the pick for dog families.",
    tags: [],
  },
  {
    slug: "cozy-lakefront-home-w-game-room-hot-tub-fire-pit-boats",
    title: "The Cottage",
    blurb: "The cozy one, with an arcade and a fire pit at the water.",
    tags: [],
  },
  {
    slug: "lakefront-mansion-w-3-decks-hot-tub-boats-game-room",
    title: "The Mansion",
    blurb: "3,400+ sq ft and three decks over Blue Mountain Lake.",
    tags: [],
  },
];

const CARE_PROOF = [
  {
    image: HOTTUB,
    alt: "Hot tub overlooking the lake in fall",
    title: "Serviced between every stay",
    body: "Hot tubs drained, cleaned, and rebalanced on every turnover — not on a schedule, on principle.",
  },
  {
    image: GAMEROOM,
    alt: "Game room with pool table, foosball, arcade and karaoke",
    title: "Restocked like we're coming",
    body: "Game rooms audited, batteries replaced, the missing 8-ball found. Small stuff, every week.",
  },
  {
    image: SAUNA,
    alt: "Barrel sauna glowing in the snow",
    title: "Always adding something",
    body: "The barrel sauna is the newest addition. Every season, each house gets an upgrade it didn't need — because good enough isn't the standard.",
  },
];

export default async function AboutPage() {
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

  // Specific, host-name-free quotes only — the about page shouldn't put
  // individual first names in guests' mouths.
  const quotes = pickReviewQuotes(
    [
      "Poconos Lakefront with Hot Tub, boats, and more!",
      "Lakefront Mansion w/ 3 Decks, Hot Tub, Boats, & Game Room!",
      "Cozy Lakefront Home w/ Game Room, Hot Tub, Fire Pit, & Boats",
      "Lakeview Chalet w/ hot tub, sauna, fire pit & decks",
    ],
    8
  )
    .filter((r) => !/sharon|vera/i.test(r.text))
    .slice(0, 2);

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "About Us" },
          ],
        }}
      />

      {/* 1 — The place, then the promise */}
      <ContentHero
        image={HERO}
        alt="Aerial view over the lakes and forests of Penn Estates"
        eyebrow="About Summit Lakeside"
        title="Five homes. Two lakes. One family minding all of it."
        lede="A family-run collection of lakefront vacation homes in the Pocono Mountains of Pennsylvania."
      />

      {/* 2 — The thesis */}
      <section className="py-20 sm:py-28 border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
            What We Believe
          </span>
          <p className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-balance">
            A lake house should work like a good hotel — and feel nothing like
            one.
          </p>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Reliable like a hotel: spotless, stocked, someone always answering.
            Personal like a home: boats out back, board games worn from use,
            nobody in a uniform.
          </p>
        </div>
      </section>

      {/* 3 — Our story */}
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
            <SectionLabel eyebrow="Our Story" title="It started with one house and a long punch list." />
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed -mt-8">
              <p>
                We'd been the guests too many times: the lake house with the
                key under the mat and nobody answering the phone, the "sleeps
                12" that meant four real beds, the hot tub that was somehow
                always "being serviced."
              </p>
              <p>
                So when our family took on our first house here, we ran it the
                way we wished someone had run those: answer fast, fix it today,
                stock it like you're staying the weekend yourself. One house
                became five — four on one street in Penn Estates, one over
                Blue Mountain Lake.
              </p>
              <p className="text-foreground font-medium">
                We're not the hosts next door, and we won't pretend to be. We're
                the family on the other end of the text — with a local crew in
                the houses all week, every week.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4 — Who takes care of you */}
      <section className="py-20 sm:py-28 bg-card border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="Who Takes Care of You"
            title="Real people, minutes from every door."
            sub="The question every rental guest actually has: if something breaks Saturday night, who shows up? Here's the answer."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-3xl border bg-background p-8 sm:p-10">
              <MessageCircle className="h-7 w-7 text-primary mb-4" />
              <h3 className="text-2xl font-bold">The family</h3>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                Every message — before, during, and after your stay — is
                answered by us, not a call center, usually within minutes. We
                set the standard, pick every couch and kayak, and read every
                review. If your stay isn't right, you're talking to the people
                who can actually fix it.
              </p>
            </div>
            <div className="rounded-3xl border bg-background p-8 sm:p-10">
              <Hammer className="h-7 w-7 text-primary mb-4" />
              <h3 className="text-2xl font-bold">The local crew</h3>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                Our cleaning and maintenance team lives and works right here in
                the Poconos. They turn the homes between every stay, walk them
                before every check-in, plow the snow, split the firewood, and
                handle mid-stay fixes the same day — often the same hour.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {CARE_PROOF.map((card) => (
              <div key={card.title} className="rounded-3xl overflow-hidden border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.image} alt={card.alt} className="aspect-4/3 w-full object-cover" />
                <div className="p-6">
                  <h3 className="font-bold text-lg">{card.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{card.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 — Numbers + guest words */}
      <TrustStrip />
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="In Guests' Words"
            title="The reviews say it better than we can."
          />
          <ReviewQuoteGrid reviews={quotes} />
        </div>
      </section>

      {/* Full-bleed breather — the real fire pit */}
      <section className="relative h-[60vh] min-h-110 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FIREPIT}
          alt="String lights over the fire pit and red Adirondack chairs at night"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/40 to-black/15" />
        <div className="absolute inset-0 flex items-center px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <div className="max-w-2xl">
              <Quote className="h-10 w-10 text-white/40 mb-5" />
              <p className="text-3xl sm:text-4xl font-medium text-white leading-tight">
                We run every house like we're checking in behind you.
              </p>
              <p className="text-white/70 mt-6 text-xs tracking-[0.3em] uppercase">
                — The Summit Lakeside family
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6 — The lake & the neighborhood */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionLabel eyebrow="The Neighborhood" title="We're guests of this lake too." />
          </div>
          <div className="lg:col-span-7 space-y-5 text-lg text-muted-foreground leading-relaxed">
            <p>
              These homes sit inside real communities —{" "}
              <Link href="/penn-estates" className="text-primary font-medium hover:underline">
                Penn Estates
              </Link>{" "}
              and{" "}
              <Link href="/blue-mountain-lake" className="text-primary font-medium hover:underline">
                Blue Mountain Lake
              </Link>{" "}
              — with neighbors who live there year-round. We register every
              guest with the homeowners' associations, enforce quiet hours with
              noise sensors instead of apologies, and keep the boats flipped
              and the docks tidy.
            </p>
            <p>
              And we'd rather send you to the places we actually love than a
              tourist trap:{" "}
              <Link href="/east-stroudsburg-restaurants" className="text-primary font-medium hover:underline">
                where we eat
              </Link>
              ,{" "}
              <Link href="/things-to-do" className="text-primary font-medium hover:underline">
                what's worth the drive
              </Link>
              , and the{" "}
              <Link href="/faq" className="text-primary font-medium hover:underline">
                straight answers
              </Link>{" "}
              to everything guests ask. The Poconos has been good to our
              family. We try to return the favor.
            </p>
          </div>
        </div>
      </section>

      {/* 7 — The five homes */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="The Collection"
            title="The five we mind."
            sub="Four on Lakeside Drive in Penn Estates, one over Blue Mountain Lake."
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

      {/* 8 — Soft close */}
      <section className="relative h-[75vh] min-h-120 overflow-hidden">
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
              The water's the same for everyone. Come see.
            </h2>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/search"
                className="inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-7 py-3.5 hover:opacity-90 transition-opacity"
              >
                See the five homes <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-white/50 text-white font-semibold px-7 py-3.5 hover:bg-white/10 transition-colors"
              >
                Say hello
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
