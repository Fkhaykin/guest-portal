import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Waves, Droplets, Trophy, Gamepad2 } from "lucide-react";
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
  ReviewQuoteGrid,
  FaqAccordion,
  BookDirectCta,
} from "@/components/marketing/content-blocks";

export const revalidate = 3600;

const MANSION_SLUG = "lakefront-mansion-w-3-decks-hot-tub-boats-game-room";

const HERO =
  "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368901/airbnb/28-backyard-image-1.jpg";

export const metadata: Metadata = {
  title: "Blue Mountain Lake, PA Vacation Rental — The Lakefront Mansion",
  description:
    "Stay on Blue Mountain Lake in East Stroudsburg, PA: a 3,400+ sq ft lakefront mansion with three decks, hot tub, arcade game room, pool table, and bar — in a quiet gated community with a paddle-only lake and Olympic pools.",
  alternates: { canonical: "/blue-mountain-lake" },
  openGraph: ogMeta({
    title: "Blue Mountain Lake Vacation Rental | Summit Lakeside",
    description:
      "The Lakefront Mansion: three decks over a paddle-only lake, hot tub, arcade, pool table & bar — sleeps 12 in gated Blue Mountain Lake.",
    images: [{ url: HERO }],
  }),
};

const INTERIOR =
  "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368901/airbnb/01-living-room-image-1.jpg";

const BML_FAQ = [
  {
    q: "Can you swim in Blue Mountain Lake?",
    a: "The lake itself is paddle-only — no swimming — but that's what the community's two Olympic-size pools are for (open Memorial Day through Labor Day, badges included with your stay). The lake is for the kayaks, canoes, and pedal boats, all free to use, plus catch-and-release fishing.",
  },
  {
    q: "How big is the Lakefront Mansion?",
    a: "Just over 3,400 square feet across three levels, sleeping 12 — with three decks stacked toward the water, a hot tub, an arcade game room with a pool table, and a bar.",
  },
  {
    q: "Is Blue Mountain Lake a gated community?",
    a: "Yes — it's a quiet, gated community in East Stroudsburg. We register your names with the gate before arrival, and your stay includes the amenity badges for the pools and courts at the community center.",
  },
  {
    q: "How much parking is there?",
    a: "The driveway fits up to six cars. Heads up: it's an S-shaped, fairly steep driveway — take it slow, especially in winter, and leave the lowest spots for the last cars out.",
  },
  {
    q: "How far is it from the other Summit Lakeside homes?",
    a: "About 15 minutes from our four Penn Estates houses. Groups too big for one home sometimes book the Mansion plus a Penn Estates house and split the crew between the two communities.",
  },
];

export default async function BlueMountainLakePage() {
  const bml = COMMUNITIES.find((c) => c.id === "blue-mountain-lake")!;

  const supabase = createAdminClient();
  const { data: mansion } = await supabase
    .from("property")
    .select("slug, cover_image_url, max_guests")
    .eq("slug", MANSION_SLUG)
    .maybeSingle();

  const quotes = pickReviewQuotes(
    ["Lakefront Mansion w/ 3 Decks, Hot Tub, Boats, & Game Room!"],
    4
  );

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: BML_FAQ.map((f) => ({
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
            { "@type": "ListItem", position: 2, name: "Blue Mountain Lake" },
          ],
        }}
      />

      <ContentHero
        image={HERO}
        alt="Backyard of the Lakefront Mansion on Blue Mountain Lake"
        eyebrow="Blue Mountain Lake · East Stroudsburg, PA"
        title="One house. Three decks. A paddle-only lake."
        lede="The Lakefront Mansion is our biggest home — 3,400+ square feet over Blue Mountain Lake, in a gated community where the loudest thing on the water is a pedal boat."
      />

      <TrustStrip />

      {/* The house */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-center">
          <div className="lg:col-span-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mansion?.cover_image_url ?? INTERIOR}
              alt="The Lakefront Mansion"
              className="w-full aspect-4/5 object-cover rounded-3xl shadow-2xl"
            />
          </div>
          <div className="lg:col-span-6 space-y-6">
            <SectionLabel
              eyebrow="The Mansion"
              title="Built for the whole crew."
            />
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed -mt-8">
              <p>
                Sleeping {mansion?.max_guests ?? 12} across three levels, the
                Mansion is the house we hand to multi-family groups and
                reunions. Three stacked decks step down toward the water; the
                hot tub looks over the lake; and the game room downstairs runs
                deep — arcade cabinets, a pool table, and a proper bar.
              </p>
              <p>
                Out back it's all lake: kayaks, canoes, and pedal boats are
                free to use, and the fishing is catch-and-release right off
                the shore. Wintertime, the same backyard turns into sledding
                and snowman territory with the hot tub waiting.
              </p>
            </div>
            <Link
              href={`/book/${MANSION_SLUG}`}
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background font-semibold px-7 py-3.5 hover:opacity-90 transition-opacity"
            >
              See the Mansion <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Community amenities */}
      <section className="py-20 sm:py-28 bg-card border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="The Community"
            title={bml.description}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <Waves className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">The paddle-only lake</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                No motors, no wake — just kayaks, canoes, and pedal boats
                (provided), and stocked catch-and-release fishing.
              </p>
            </div>
            <div>
              <Droplets className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">Two Olympic pools</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Full-length lanes and plenty of deck at the community center,
                open Memorial Day through Labor Day. Badges included.
              </p>
            </div>
            <div>
              <Trophy className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">Courts &amp; field</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Tennis, basketball, sand volleyball, and an open soccer field
                — all a short drive from the house.
              </p>
            </div>
          </div>
          <p className="text-muted-foreground mt-10">
            Planning days out? Bushkill Falls, the Delaware Water Gap, and the
            ski mountains are all close —{" "}
            <Link href="/things-to-do" className="text-primary font-medium hover:underline">
              see the full Poconos guide →
            </Link>
          </p>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel eyebrow="Guest Words" title="From stays at the Mansion." />
          <ReviewQuoteGrid reviews={quotes} />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-28 bg-card border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          <div className="lg:col-span-4">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.05] lg:sticky lg:top-24 flex items-start gap-3">
              <Gamepad2 className="h-8 w-8 text-primary mt-1 shrink-0" />
              Blue Mountain Lake questions
            </h2>
          </div>
          <div className="lg:col-span-8">
            <FaqAccordion items={BML_FAQ} />
          </div>
        </div>
      </section>

      <BookDirectCta heading="Take the whole crew to the lake" />
      <SiteFooter />
    </div>
  );
}
