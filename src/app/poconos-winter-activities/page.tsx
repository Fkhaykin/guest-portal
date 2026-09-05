import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Dog, Flame, Mountain, Snowflake, Sparkles } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL, ogMeta } from "@/lib/seo";
import { guideImg, IMAGE_CREDITS } from "@/lib/things-to-do-content";
import { pickReviewQuotes } from "@/lib/review-quotes";
import {
  ContentHero,
  TrustStrip,
  SectionLabel,
  ReviewQuoteGrid,
  BookDirectCta,
  FaqAccordion,
  PhotoCredits,
} from "@/components/marketing/content-blocks";

export const metadata: Metadata = {
  title: "Poconos Winter Activities — Snowmobiling, Skiing, Tubing & Ice Skating",
  description:
    "The honest winter guide: snowmobile rentals no longer exist in the Poconos (here's what to do instead), plus the three ski mountains, free ice rinks and sledding hills, dog sledding at Shawnee, and winter UTV tours.",
  alternates: { canonical: "/poconos-winter-activities" },
  openGraph: ogMeta({
    title: "Poconos Winter Activities | Summit Lakeside",
    description:
      "Skiing, tubing, dog sledding, free ice rinks — and the truth about snowmobile rentals. A local's winter guide.",
  }),
};

/* Real photos of the real places, self-hosted. */
const P = "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images";
const SAUNA = `${P}/lodgify-355871/airbnb/56-newly-installed-back-yard-sauna.jpg`;
const FIREPIT = `${P}/lodgify-355872/airbnb/44-newly-landscaped-fire-pit-area.jpg`;

const SKI = [
  {
    image: guideImg("camelback"),
    alt: "Camelback Mountain ski trails from above",
    title: "Camelback Mountain",
    drive: "~25 min",
    body: "The big one — 39 trails, 16 lifts, night skiing, and the largest snow-tubing park in the US. Tubing tip from experience: book the first morning slot online; holiday-weekend lines get brutal by 11.",
  },
  {
    image: guideImg("jackfrost"),
    alt: "Skier in fresh snow at Jack Frost Mountain",
    title: "Jack Frost Big Boulder",
    drive: "~20 min",
    body: "Two mountains on one ticket: Jack Frost for cruisers, Big Boulder for terrain parks and night sessions. Usually the calmest lift lines of the three.",
  },
  {
    image: guideImg("shawnee-host"),
    alt: "Skiers on a groomed run at Shawnee Mountain",
    title: "Shawnee Mountain",
    drive: "~30 min",
    body: "Closest to our homes and the family favorite — 23 trails, a genuinely good ski school, smaller crowds, gentler prices. First-timers start here.",
  },
];

const WFAQ = [
  {
    q: "Can you rent snowmobiles in the Poconos?",
    a: "No — there are currently no public snowmobile rentals or guided snowmobile tours in the Poconos. The last operator (near Pocono Manor) switched to UTV tours back in 2017, and Skytop Lodge's snowmobiling is for its overnight guests only. The closest experience open to everyone is a guided winter UTV tour with Pocono Outdoor Adventure Tours near the Raceway — enclosed side-by-sides that run year-round, snow days included, with kids 5+ welcome to ride along.",
  },
  {
    q: "Where can you go ice skating in the Poconos?",
    a: "Three good options: Stroudsburg borough runs a free outdoor rink (bring your own skates, 9 AM–9 PM, weather permitting), Pocono Township has a free rink at TLC Park in Tannersville (Routes 611 & 715, also BYO skates), and Skytop Lodge opens its pavilion rink to the public from late November — about $10 to skate, $20 with rentals.",
  },
  {
    q: "Is there dog sledding in the Poconos?",
    a: "Yes — Arctic Paws Dog Sled Tours runs at the Shawnee Inn on winter weekends, roughly mid-December through early March, snow permitting. It books out fast and is weather-dependent, so reserve ahead and have a plan B.",
  },
  {
    q: "Which ski mountain is closest to East Stroudsburg?",
    a: "Shawnee Mountain, about 30 minutes from our homes and the most beginner-friendly of the three. Jack Frost Big Boulder is ~20 minutes and Camelback ~25 — all close enough to ski a half-day and still have the afternoon at the house.",
  },
  {
    q: "Where can kids go sledding for free?",
    a: "The hills locals actually use are right in Stroudsburg — the big one at Wesleyan Church on N 5th Street and another behind the junior high. Bring your own sleds; after a fresh snowfall they beat any paid tubing line.",
  },
];

export default function WinterActivitiesPage() {
  const quotes = pickReviewQuotes(
    [
      "Lakeview Chalet w/ hot tub, sauna, fire pit & decks",
      "Lakeview Chalet w/ Hot Tub, Sauna, Decks, Boats, & Fire Pit!",
      "Lakefront Mansion w/ 3 Decks, Hot Tub, Boats, & Game Room!",
    ],
    2
  );

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: WFAQ.map((f) => ({
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
            { "@type": "ListItem", position: 2, name: "Things to Do", item: `${SITE_URL}/things-to-do` },
            { "@type": "ListItem", position: 3, name: "Winter Activities" },
          ],
        }}
      />

      <ContentHero
        image={guideImg("camelback")}
        alt="Ski trails carving down Camelback Mountain in winter"
        eyebrow="Seasonal Guide · Winter"
        title="Winter in the Poconos, honestly."
        lede="Three ski mountains within half an hour, dog sledding, free ice rinks and sledding hills — and the straight answer about snowmobile rentals nobody else will give you."
      />

      <TrustStrip />

      {/* The snowmobile answer — the query this page exists for */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionLabel
              eyebrow="The Straight Answer"
              title="Snowmobile rentals in the Poconos: there aren't any."
            />
          </div>
          <div className="lg:col-span-7 space-y-5 text-lg text-muted-foreground leading-relaxed">
            <p>
              We get asked constantly, so here it is plainly:{" "}
              <span className="text-foreground font-medium">
                no one publicly rents snowmobiles in the Poconos anymore.
              </span>{" "}
              The last rental operation, near Pocono Manor, switched to UTVs
              back in 2017, and Skytop Lodge's snowmobile trails are reserved
              for its own overnight guests.
            </p>
            <p>
              The closest thing open to everyone: a guided{" "}
              <span className="text-foreground font-medium">winter UTV tour</span>{" "}
              with Pocono Outdoor Adventure Tours near the Raceway — enclosed
              side-by-sides that run all year including snow days, no
              experience needed, kids 5+ ride along. Book ahead on snowy
              weekends.
            </p>
            <p>
              Want the machine-free version of a white-knuckle winter day?
              That's what the tubing parks and the terrain at Big Boulder are
              for — read on.
            </p>
          </div>
        </div>
      </section>

      {/* Ski areas */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="The Mountains"
            title="Three ski areas within half an hour."
            sub="Ski a full day and still beat the hot tub crowd home."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SKI.map((s) => (
              <div key={s.title} className="rounded-3xl overflow-hidden border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt={s.alt} className="aspect-4/3 w-full object-cover" />
                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary font-semibold">
                    <Mountain className="h-4 w-4" /> {s.drive}
                  </div>
                  <h3 className="font-bold text-xl mt-2">{s.title}</h3>
                  <p className="text-muted-foreground mt-2 leading-relaxed text-sm">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free & local + dog sledding */}
      <section className="py-20 sm:py-28 bg-card border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="Free & Nearly Free"
            title="The winter the locals do."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <Snowflake className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">Free sledding hills</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Right in Stroudsburg: the big hill at Wesleyan Church on N 5th
                Street, and another behind the junior high. Bring sleds.
              </p>
            </div>
            <div>
              <Sparkles className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">Ice skating</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Free outdoor rinks in Stroudsburg borough and at TLC Park in
                Tannersville (bring skates, 9–9, weather permitting). Skytop
                Lodge opens its rink to the public — ~$10, or $20 with rentals.
              </p>
            </div>
            <div>
              <Dog className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">Dog sledding</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Arctic Paws runs real dog-sled tours at the Shawnee Inn on
                winter weekends, mid-December to early March, snow permitting.
                Books out fast — reserve early.
              </p>
            </div>
            <div>
              <Flame className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-lg">Snowshoes, free</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                PEEC lends snowshoes at no charge — take them up the McDade
                Trail for the quietest winter walk in the Water Gap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Après at the house */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="Back at the House"
            title="The après is the point."
            sub="Every home has a year-round hot tub and a fire pit; the Chalet and the Manor add saunas. Ski all day, thaw all night."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SAUNA} alt="Barrel sauna glowing in the snow at the Manor" className="aspect-16/10 w-full object-cover rounded-3xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FIREPIT} alt="String-lit fire pit with red Adirondack chairs at night" className="aspect-16/10 w-full object-cover rounded-3xl" />
          </div>
          <div className="mt-10">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 text-primary font-semibold hover:underline text-lg"
            >
              Check winter availability <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Winter FAQ */}
      <section className="py-20 sm:py-28 bg-card border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          <div className="lg:col-span-4">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.05] lg:sticky lg:top-24">
              Winter questions, answered straight
            </h2>
          </div>
          <div className="lg:col-span-8">
            <FaqAccordion items={WFAQ} />
          </div>
        </div>
      </section>

      {/* Guest words */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel eyebrow="Guest Words" title="Winter stays, reviewed." />
          <ReviewQuoteGrid reviews={quotes} />
        </div>
      </section>

      <BookDirectCta heading="Book your ski weekend" />
      <PhotoCredits
        credits={IMAGE_CREDITS.filter((c) =>
          ["Camelback Mountain", "Jack Frost Mountain"].includes(c.subject)
        )}
      />
      <SiteFooter />
    </div>
  );
}
