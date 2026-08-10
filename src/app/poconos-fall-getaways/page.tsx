import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Flame, Leaf, Mountain, TentTree } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL, ogMeta } from "@/lib/seo";
import { img, guideImg, IMAGE_CREDITS } from "@/lib/things-to-do-content";
import { pickReviewQuotes } from "@/lib/review-quotes";
import {
  ContentHero,
  TrustStrip,
  SectionLabel,
  ReviewQuoteGrid,
  BookDirectCta,
  PhotoCredits,
} from "@/components/marketing/content-blocks";

export const metadata: Metadata = {
  title: "Poconos Fall Getaways — Foliage, Fire Pits & Lake Mornings",
  description:
    "Plan a Poconos fall weekend from a lakefront home in East Stroudsburg: peak foliage timing, Jim Thorpe and the Delaware Water Gap, Bushkill Falls, Hickory Run — then back to the hot tub and fire pit.",
  alternates: { canonical: "/poconos-fall-getaways" },
  openGraph: ogMeta({
    title: "Poconos Fall Getaways | Summit Lakeside",
    description:
      "Peak foliage, waterfall hikes, and small-town leaf-peeping — from a lakefront home with a hot tub and fire pit.",
  }),
};

const STOPS = [
  {
    name: "Jim Thorpe",
    when: "Peak: mid–late October",
    text: "The Poconos' postcard town — Victorian storefronts squeezed into a mountain gap, with the Lehigh Gorge Scenic Railway running leaf-peeping trains through the canyon (~$24 adults; October Saturdays sell out, so book the open-air cars ahead). On Fall Foliage Festival weekends, skip the downtown parking hunt: park at Mauch Chunk Lake Park and ride the shuttle in.",
    image: guideImg("jimthorpe"),
    drive: "~45 min from our homes",
  },
  {
    name: "Delaware Water Gap",
    when: "Peak: early–mid October",
    text: "Twenty minutes from the houses and the best bang-for-effort foliage around. Drive Route 209 through the National Recreation Area, or climb Mount Tammany if your crew wants to earn the view — the red-and-gold river bend from the top is the fall photo. Trailhead lots fill by 8 AM on October weekends; go midweek, start at sunrise, or take quieter Mt. Minsi instead.",
    image: guideImg("tammany"),
    drive: "~20 min",
  },
  {
    name: "Bushkill Falls",
    when: "Peak: early–mid October",
    text: "The 'Niagara of Pennsylvania' — eight waterfalls strung together with wooden boardwalks and bridges. Fall turns the whole gorge amber; the upper trails get you above the canopy. It's paid entry (~$20), and a 9 AM weekday start has the boardwalks nearly to yourself. Prefer free? Raymondskill Falls — PA's tallest — is 20 minutes further up Route 209.",
    image: guideImg("bushkill"),
    drive: "~25 min",
  },
  {
    name: "Hickory Run Boulder Field",
    when: "Great all October",
    text: "A 16-acre field of ice-age boulders that looks borrowed from another planet — surrounded by state-park forest that goes full crimson in October. Pair it with the Hawk Falls trail for an easy family hike.",
    image: guideImg("boulderfield"),
    drive: "~40 min",
  },
  {
    name: "U-Pick Orchards & the 1890s Farm",
    when: "Late September – October",
    text: "Twenty minutes west, Gould's Produce in Brodheadsville and Heckman Orchards in Effort run u-pick apples and pumpkins on fall weekends — cider, farm stands, the whole ritual. Pair either with Quiet Valley Living Historical Farm in Stroudsburg, an 1890s farmstead with animals, and its early-October Harvest Festival weekend.",
    image: img("photo-1570913149827-d2ac84ab3f9a"),
    drive: "~15-25 min",
  },
];

export default function FallGetawaysPage() {
  const quotes = pickReviewQuotes(
    [
      "Poconos Lakefront with Hot Tub, boats, and more!",
      "Lakefront Mansion w/ 3 Decks, Hot Tub, Boats, & Game Room!",
      "Lakeview Chalet w/ hot tub, sauna, fire pit & decks",
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
            { "@type": "ListItem", position: 2, name: "Things to Do", item: `${SITE_URL}/things-to-do` },
            { "@type": "ListItem", position: 3, name: "Poconos Fall Getaways" },
          ],
        }}
      />

      <ContentHero
        image={img("photo-1476820865390-c52aeebb9891", 2000)}
        alt="Road through peak fall foliage in the Pocono Mountains"
        eyebrow="Seasonal Guide · Updated for this fall"
        title="Fall in the Poconos, done right."
        lede="Foliage hikes and leaf-peeping towns by day — then back to a lakefront house with the fire pit going and the hot tub steaming. This is the season the Poconos was built for."
      />

      <TrustStrip />

      {/* When to come */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionLabel eyebrow="Timing" title="When the color peaks." />
          </div>
          <div className="lg:col-span-7 space-y-5 text-lg text-muted-foreground leading-relaxed">
            <p>
              Poconos foliage typically starts turning in late September at the
              higher elevations and peaks across our corner of Monroe County in
              the <span className="text-foreground font-medium">first three weeks of October</span>.
              The lake adds a bonus round: still mornings double the color in
              the reflection, right off the back deck.
            </p>
            <p>
              Weekends in October book out first — especially the Chalet and
              the Mansion — so if you're eyeing peak color, lock dates early.
              Midweek stays are quieter on the trails and gentler on the
              nightly rate.
            </p>
          </div>
        </div>
      </section>

      {/* The four stops */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="The Itinerary"
            title="Five stops worth the drive."
            sub="All are day trips from the houses — pick one per day and leave the afternoons for the lake."
          />
          <div className="space-y-16 sm:space-y-24">
            {STOPS.map((stop, i) => (
              <div
                key={stop.name}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center"
              >
                <div className={`lg:col-span-7 ${i % 2 ? "lg:order-2" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={stop.image}
                    alt={stop.name}
                    className="w-full aspect-16/10 object-cover rounded-3xl shadow-xl"
                  />
                </div>
                <div className={`lg:col-span-5 ${i % 2 ? "lg:order-1" : ""}`}>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-primary font-semibold">
                    <Leaf className="h-4 w-4" /> {stop.when}
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3">
                    {stop.name}
                  </h3>
                  <p className="text-lg text-muted-foreground mt-4 leading-relaxed">
                    {stop.text}
                  </p>
                  <p className="text-sm font-semibold text-muted-foreground mt-4 uppercase tracking-wide">
                    {stop.drive}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Back at the house */}
      <section className="py-20 sm:py-28 bg-card border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="Back at the House"
            title="The second half of a fall day."
            sub="Shoulder season is the houses at their best — crowds gone, lake glassy, evenings cool enough to earn the fire."
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <Flame className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">Fire pit nights</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Every home has a fire pit near the water. October is
                sweatshirts, s'mores, and no bugs.
              </p>
            </div>
            <div>
              <TentTree className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">Hot tubs &amp; saunas</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Hot tubs at every house, saunas at several — the right way to
                end a Mount Tammany day.
              </p>
            </div>
            <div>
              <Mountain className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">Empty morning lake</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Take a kayak out at 8 AM through the mist and have Lower Twin
                Lake to yourself.
              </p>
            </div>
          </div>
          <p className="text-muted-foreground mt-10">
            Want more options — restaurants, rainy-day saves, the waterparks?{" "}
            <Link href="/things-to-do" className="text-primary font-medium hover:underline">
              The full Poconos guide has 40+ picks →
            </Link>
          </p>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel eyebrow="Guest Words" title="Fall &amp; winter stays, reviewed." />
          <ReviewQuoteGrid reviews={quotes} />
          <div className="mt-10">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
            >
              Check October availability <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <BookDirectCta heading="Book your foliage weekend" />
      <PhotoCredits
        credits={IMAGE_CREDITS.filter((c) =>
          ["Jim Thorpe station", "Delaware Water Gap from Mt. Tammany", "Bushkill Falls", "Boulder Field, Hickory Run"].includes(c.subject)
        )}
      />
      <SiteFooter />
    </div>
  );
}
