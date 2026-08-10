import type { Metadata } from "next";
import Link from "next/link";
import { Waves, Trophy, Droplets, Store, BadgeCheck } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL, ogMeta } from "@/lib/seo";
import { COMMUNITIES } from "@/lib/things-to-do-content";
import { pickReviewQuotes } from "@/lib/review-quotes";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ContentHero,
  TrustStrip,
  SectionLabel,
  PropertyCardGrid,
  ReviewQuoteGrid,
  FaqAccordion,
  BookDirectCta,
  type PropertyCardData,
} from "@/components/marketing/content-blocks";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Penn Estates Vacation Rentals — 4 Lake Homes on Lakeside Drive",
  description:
    "Stay inside Penn Estates, a gated 1,200-acre Poconos community in East Stroudsburg, PA. Four Summit Lakeside homes on Lower Twin Lake — hot tubs, boats, game rooms — plus three lakes, two Olympic pools, and sports courts.",
  alternates: { canonical: "/penn-estates" },
  openGraph: ogMeta({
    title: "Penn Estates Vacation Rentals | Summit Lakeside",
    description:
      "Four lakefront vacation homes inside the gated Penn Estates community — with three lakes, two Olympic pools, and courts a few steps from your door.",
  }),
};

const HERO =
  "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-355872/airbnb/46-lake-dock.jpg";

const PE_HOUSES: Array<Omit<PropertyCardData, "image" | "sleeps"> & { slug: string }> = [
  {
    slug: "poconos-lakefront-with-hot-tub-boats-and-more",
    title: "The Lakehouse",
    blurb:
      "Right on Lower Twin Lake — hot tub, game room, big deck, and the boats tied up out back.",
    tags: ["Lakefront", "Hot Tub", "Game Room"],
  },
  {
    slug: "luxury-lakefront-chalet-in-poconos-1-5hrs-from-nyc",
    title: "The Chalet",
    blurb:
      "The A-frame with the sauna. Lake views from stacked decks, fire pit below — ski-day recovery headquarters.",
    tags: ["Sauna", "Hot Tub", "Lake Views"],
  },
  {
    slug: "lake-adjacent-home-w-hot-tub-game-room-boats-fenced-yard",
    title: "The Manor",
    blurb:
      "Lake-adjacent with a fully fenced yard — the pick for dog families, with water access two doors down.",
    tags: ["Fenced Yard", "Dog Families", "Hot Tub"],
  },
  {
    slug: "cozy-lakefront-home-w-game-room-hot-tub-fire-pit-boats",
    title: "The Cottage",
    blurb:
      "The cozy one. Arcade game room, hot tub, and a fire pit at the water's edge — perfect for one or two families.",
    tags: ["Sleeps 8", "Game Room", "Fire Pit"],
  },
];

const PE_FAQ = [
  {
    q: "Is Penn Estates a gated community?",
    a: "Yes — Penn Estates is a gated, roughly 1,200-acre community in East Stroudsburg. We register your name (and your guests') with the gate before arrival; you show ID at the gatehouse and drive in. Every stay includes the HOA amenity badges that unlock the pools, beach, and shared facilities.",
  },
  {
    q: "Can you swim in the lakes at Penn Estates?",
    a: "Swimming happens at Highland Lake's sandy beach and at the two Olympic-size community pools (open Memorial Day through Labor Day). Lower Twin Lake — where our houses sit — is for boating and catch-and-release fishing, right off the dock.",
  },
  {
    q: "Where are the Penn Estates front gate and Welcome Center?",
    a: "All arrivals check in at the main gate at 525 Penn Estates Drive, East Stroudsburg — set your GPS there, have your driver's license ready, and pick up your printed gate pass. The Welcome Center sits at the same entrance. If your GPS suggests the back gate, re-route to the main gate: visitor passes are only issued at the front.",
  },
  {
    q: "Which Summit Lakeside homes are inside Penn Estates?",
    a: "Four of our five: the Lakehouse, the Chalet, the Manor, and the Cottage — all on Lakeside Drive along Lower Twin Lake. The Mansion is in the neighboring Blue Mountain Lake community, about 15 minutes away.",
  },
  {
    q: "How far is Penn Estates from NYC?",
    a: "About 90 minutes to two hours by car via I-80 — close enough for a Friday-after-work arrival. Delaware Water Gap hiking is 20 minutes away, and Camelback and Shawnee ski areas are both under half an hour.",
  },
  {
    q: "Can a large group book several houses together?",
    a: "Yes — our four Penn Estates homes are on the same street, so multi-family groups and reunions of 40+ can stay two doors apart and share the docks, fire pits, and game rooms. Message us and we'll coordinate the calendars.",
  },
];

const ICONS = { sports: Trophy, lakes: Waves, pools: Droplets, store: Store };

export default async function PennEstatesPage() {
  const pennEstates = COMMUNITIES.find((c) => c.id === "penn-estates")!;

  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("property")
    .select("slug, cover_image_url, max_guests")
    .in("slug", PE_HOUSES.map((h) => h.slug));
  const bySlug = new Map((rows ?? []).map((r) => [r.slug, r]));
  const cards: PropertyCardData[] = PE_HOUSES.map((h) => ({
    ...h,
    image: bySlug.get(h.slug)?.cover_image_url ?? null,
    sleeps: bySlug.get(h.slug)?.max_guests ?? null,
  }));

  const quotes = pickReviewQuotes(
    [
      "Poconos Lakefront with Hot Tub, boats, and more!",
      "Lakeview Chalet w/ hot tub, sauna, fire pit & decks",
      "Lake Adjacent Home w/ Hot Tub, Game Room, Boats, Fenced Yard",
      "Cozy Lakefront Home w/ Game Room, Hot Tub, Fire Pit, & Boats",
    ],
    4
  );

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: PE_FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Penn Estates" },
          ],
        }}
      />

      <ContentHero
        image={HERO}
        alt="Private dock on Lower Twin Lake in Penn Estates"
        eyebrow="Our Home Community · East Stroudsburg, PA"
        title="Penn Estates: four lake homes inside the gate."
        lede="A gated, 1,200-acre Poconos community with three lakes, two Olympic pools, and courts for every sport — and our four houses sitting right on the water."
      />

      <TrustStrip />

      {/* Intro */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionLabel
              eyebrow="The Community"
              title="A resort's worth of amenities, none of the resort."
            />
          </div>
          <div className="lg:col-span-7 space-y-5 text-lg text-muted-foreground leading-relaxed">
            <p>
              Penn Estates is where we've hosted since day one. Behind the gatehouse
              you'll find quiet wooded streets, {pennEstates.stats[0].num}{" "}
              community lakes, {pennEstates.stats[1].num} Olympic-size pools,
              and {pennEstates.stats[2].num} freshly rebuilt courts and fields
              — tennis, pickleball, basketball, baseball, soccer, sand
              volleyball, wallball, even horseshoe pits and outdoor fitness
              stations. Every
              Summit Lakeside stay includes the HOA amenity badges that unlock
              all of it.
            </p>
            <p>
              Our four homes here — the Lakehouse, the Chalet, the Manor, and
              the Cottage — sit together on Lakeside Drive along Lower Twin
              Lake. That's not marketing shorthand: step out the back door and
              you're on the dock, where the kayaks, canoes, and pedal boats
              are waiting.
            </p>
            <p>
              And right outside the gate sits the ForEvergreen Nature Preserve
              — 42 acres of meadow and woods with an easy mile loop down to
              the Brodhead Creek, the stream where American trout fishing was
              born. First-morning coffee walk, solved.
            </p>
            <p className="text-foreground font-medium">
              It's the rare setup where a big group can book multiple houses on
              one street and spend the weekend two doors apart.
            </p>
          </div>
        </div>
      </section>

      {/* Three lakes */}
      <section className="py-4 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="The Lakes"
            title="Three lakes, three different moods."
            sub="All three are stocked — catch and release only."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pennEstates.groups
              .find((g) => g.key === "lakes")!
              .items.map((lake) => (
                <div key={lake.name} className="rounded-3xl overflow-hidden border bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lake.image} alt={lake.name} className="aspect-4/3 w-full object-cover" />
                  <div className="p-6">
                    <h3 className="font-bold text-xl">{lake.name}</h3>
                    <p className="text-muted-foreground mt-2 leading-relaxed">{lake.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {(lake.tags ?? []).map((t) => (
                        <span key={t} className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground border rounded-full px-2.5 py-0.5">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Amenities strip */}
      <section className="py-20 sm:py-28 bg-card border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="Inside the Gate"
            title="Pools, courts, and the corner store."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {pennEstates.groups
              .filter((g) => g.key !== "lakes")
              .flatMap((g) =>
                g.items.map((item) => ({ group: g, item }))
              )
              .slice(0, 4)
              .map(({ group, item }) => {
                const Icon = ICONS[group.key as keyof typeof ICONS] ?? BadgeCheck;
                return (
                  <div key={item.name}>
                    <Icon className="h-6 w-6 text-primary mb-3" />
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
          </div>
          <p className="text-muted-foreground mt-10">
            Want the full picture of the area beyond the gate?{" "}
            <Link href="/things-to-do" className="text-primary font-medium hover:underline">
              See our Poconos guide →
            </Link>
          </p>
        </div>
      </section>

      {/* The four houses */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="Stay Here"
            title="The four houses on Lakeside Drive."
            sub="Every home comes with a hot tub, a fire pit, free boats, and the community badges."
          />
          <PropertyCardGrid cards={cards} />
        </div>
      </section>

      {/* Reviews */}
      <section className="py-4 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel eyebrow="Guest Words" title="From stays on this street." />
          <ReviewQuoteGrid reviews={quotes} />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-28 bg-card border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          <div className="lg:col-span-4">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.05] lg:sticky lg:top-24">
              Penn Estates questions
            </h2>
          </div>
          <div className="lg:col-span-8">
            <FaqAccordion items={PE_FAQ} />
          </div>
        </div>
      </section>

      <BookDirectCta heading="Stay inside the gate" />
      <SiteFooter />
    </div>
  );
}
