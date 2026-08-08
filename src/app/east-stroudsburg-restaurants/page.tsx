import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, UtensilsCrossed } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL, ogMeta } from "@/lib/seo";
import { CATEGORIES, img } from "@/lib/things-to-do-content";
import {
  ContentHero,
  TrustStrip,
  SectionLabel,
  BookDirectCta,
} from "@/components/marketing/content-blocks";

export const metadata: Metadata = {
  title: "The Best Restaurants in East Stroudsburg & the Poconos",
  description:
    "Where we actually send our guests to eat near East Stroudsburg, PA: farm-to-table brunch, wood-fired pizza, fine dining, a cliffside wine bar, and the brewery with live music — picked by the hosts who live here.",
  alternates: { canonical: "/east-stroudsburg-restaurants" },
  openGraph: ogMeta({
    title: "The Best Restaurants in East Stroudsburg & the Poconos",
    description:
      "Farm-to-table brunch, wood-fired pizza, fine dining, and a cliffside wine bar — the places we text our guests about.",
  }),
};

export default function RestaurantsPage() {
  const dining = CATEGORIES.find((c) => c.key === "dining")!;

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "The Best Restaurants in East Stroudsburg & the Poconos",
          itemListElement: dining.activities.map((r, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Restaurant",
              name: r.name,
              description: r.description,
              ...(r.website ? { url: r.website } : {}),
            },
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
            { "@type": "ListItem", position: 3, name: "Restaurants" },
          ],
        }}
      />

      <ContentHero
        image={img("photo-1414235077428-338989a2e8c0", 2000)}
        alt="A long candlelit restaurant table"
        eyebrow="Local Guide · From Your Hosts"
        title="Where to eat in East Stroudsburg."
        lede="We live here, we host here, and these are the places we actually text our guests about — from farm-table brunch to a wine bar hanging over a waterfall."
      />

      <TrustStrip />

      {/* The list */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionLabel
            eyebrow="The Short List"
            title="The spots worth the drive."
            sub="Distances are from our homes in Penn Estates. Weekends book up — reserve ahead where you can."
          />
          <div className="space-y-16 sm:space-y-24">
            {dining.activities.map((r, i) => (
              <div
                key={r.name}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center"
              >
                <div className={`lg:col-span-7 ${i % 2 ? "lg:order-2" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image}
                    alt={r.name}
                    className="w-full aspect-16/10 object-cover rounded-3xl shadow-xl"
                  />
                </div>
                <div className={`lg:col-span-5 ${i % 2 ? "lg:order-1" : ""}`}>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-primary font-semibold">
                    <UtensilsCrossed className="h-4 w-4" />
                    {(r.tags ?? []).join(" · ")}
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3">
                    {r.name}
                  </h3>
                  <p className="text-lg text-muted-foreground mt-4 leading-relaxed">
                    {r.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm font-semibold">
                    <span className="flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                      <MapPin className="h-4 w-4" /> {r.distance} from our homes
                    </span>
                    {r.website && (
                      <a
                        href={r.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Website →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closer to the house */}
      <section className="py-20 sm:py-28 bg-card border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionLabel
              eyebrow="Zero-Effort Nights"
              title="Or don't leave the lake at all."
            />
          </div>
          <div className="lg:col-span-7 space-y-5 text-lg text-muted-foreground leading-relaxed">
            <p>
              Half our guests cook more than they eat out — every home has a
              full kitchen and a BBQ, and{" "}
              <Link href="/penn-estates" className="text-primary font-medium hover:underline">
                Archie's Corner inside Penn Estates
              </Link>{" "}
              covers sandwiches, snacks, and the firewood you forgot. Downtown
              Stroudsburg's Main Street — boutiques, galleries, and more
              restaurants — is fifteen minutes away when you want a stroll
              with dinner.
            </p>
            <p>
              For the full area rundown beyond food — waterfalls, skiing,
              lake days —{" "}
              <Link href="/things-to-do" className="text-primary font-medium hover:underline">
                see the complete Poconos guide
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 text-primary font-semibold hover:underline text-lg"
          >
            Stay 15 minutes from all of it — check availability
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <BookDirectCta heading="Eat well. Sleep on the lake." />
      <SiteFooter />
    </div>
  );
}
