import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo";
import { FAQ_CATEGORIES, ALL_FAQS } from "@/lib/faq-content";
import {
  ContentHero,
  TrustStrip,
  BookDirectCta,
  FaqAccordion,
} from "@/components/marketing/content-blocks";

export const metadata: Metadata = {
  title: "Guest FAQ — Booking, the Lake, Pets & House Rules",
  description:
    "Quick answers about staying at a Summit Lakeside home: booking direct, check-in and the gate, the lake and free boats, hot tubs, bringing your dog, and house rules.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Summit Lakeside Guest FAQ",
    description:
      "Booking direct, check-in, the lake and boats, hot tubs, dogs, and house rules — answered by the hosts.",
  },
};

const HERO =
  "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368901/airbnb/01-living-room-image-1.jpg";

export default function FaqPage() {
  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: ALL_FAQS.map((f) => ({
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
            { "@type": "ListItem", position: 2, name: "Guest FAQ" },
          ],
        }}
      />

      <ContentHero
        image={HERO}
        alt="Living room of the Lakefront Mansion"
        eyebrow="Guest FAQ"
        title="Everything guests ask us, answered straight."
        lede="Booking, the gate, the lake, the hot tubs, your dog — if it's been asked twice, it's on this page. Anything else, just message us."
      />

      <TrustStrip />

      {/* Category jump nav */}
      <nav className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-14 sm:pt-20">
        <div className="flex flex-wrap gap-2.5">
          {FAQ_CATEGORIES.map((cat) => (
            <a
              key={cat.key}
              href={`#${cat.key}`}
              className="rounded-full border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
            >
              {cat.title}
            </a>
          ))}
        </div>
      </nav>

      {/* Categories */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-24 sm:pb-32">
        {FAQ_CATEGORIES.map((cat) => (
          <section key={cat.key} id={cat.key} className="pt-16 sm:pt-20 scroll-mt-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
              <div className="lg:col-span-4">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.05] lg:sticky lg:top-24">
                  {cat.title}
                </h2>
              </div>
              <div className="lg:col-span-8">
                <FaqAccordion items={cat.items} />
              </div>
            </div>
          </section>
        ))}

        <p className="text-muted-foreground mt-16 text-lg">
          The fine print lives on the{" "}
          <Link href="/rental-policies" className="text-primary font-medium hover:underline">
            rental policies page
          </Link>
          {" "}— it's the authority if anything here ever disagrees.
        </p>
      </div>

      <BookDirectCta />
      <SiteFooter />
    </div>
  );
}
