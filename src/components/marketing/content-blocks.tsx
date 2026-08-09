import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronDown, Quote, ShieldCheck, Star, Users } from "lucide-react";
import { REVIEW_STATS, type Review } from "@/lib/reviews-data";

/* Server-safe building blocks shared by the marketing content pages
   (/penn-estates, /blue-mountain-lake, /faq, /poconos-fall-getaways).
   Visual language mirrors the why-summit / things-to-do pages. */

export function ContentHero({
  image,
  alt,
  eyebrow,
  title,
  lede,
}: {
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <section className="relative h-[75vh] min-h-140 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/30 to-black/85" />
      <div className="absolute inset-0 flex flex-col justify-end pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto w-full">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-white/70 font-semibold mb-5">
            {eyebrow}
          </span>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[0.98] max-w-4xl text-balance">
            {title}
          </h1>
          <p className="text-lg sm:text-xl text-white/80 mt-6 max-w-2xl leading-relaxed">
            {lede}
          </p>
          <div className="mt-10 flex items-center gap-3 text-white/60 text-xs uppercase tracking-[0.25em]">
            <span className="h-px w-12 bg-white/40" />
            <span>Keep reading</span>
            <ChevronDown className="h-4 w-4 animate-bounce" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Server-rendered credibility strip (static counterpart of the homepage TrustBar). */
export function TrustStrip() {
  const stats = [
    { icon: Star, value: REVIEW_STATS.averageRating.toFixed(2), label: "Average guest rating" },
    { icon: BadgeCheck, value: `${REVIEW_STATS.totalCount}+`, label: "Verified reviews" },
    { icon: Users, value: "Family-run", label: "Hands-on hosts" },
    { icon: ShieldCheck, value: "Book direct", label: "No platform fees" },
  ];
  return (
    <section className="border-y bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        {stats.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex flex-col items-center gap-1 px-4 py-6 text-center sm:py-8">
            <Icon className={`h-5 w-5 ${Icon === Star ? "fill-amber-400 text-amber-400" : "text-primary"}`} />
            <div className="text-xl sm:text-2xl font-bold tracking-tight">{value}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionLabel({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-3xl mb-12 sm:mb-16">
      <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
        {eyebrow}
      </span>
      <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mt-4 leading-[1.05] text-balance">
        {title}
      </h2>
      {sub && (
        <p className="text-lg text-muted-foreground mt-5 leading-relaxed">{sub}</p>
      )}
    </div>
  );
}

export type PropertyCardData = {
  slug: string;
  title: string;
  blurb: string;
  image: string | null;
  sleeps: number | null;
  tags: string[];
};

export function PropertyCardGrid({ cards }: { cards: PropertyCardData[] }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${cards.length > 2 ? "lg:grid-cols-4" : ""} gap-6`}>
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
          <div className="p-5">
            <h3 className="font-bold text-lg leading-snug group-hover:text-primary transition-colors">
              {card.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{card.blurb}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {card.tags.map((t) => (
                <span key={t} className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground border rounded-full px-2.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary mt-4">
              See the house <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ReviewQuoteGrid({ reviews }: { reviews: Review[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {reviews.map((r) => (
        <figure key={r.id} className="rounded-3xl border bg-card p-7 sm:p-8">
          <Quote className="h-7 w-7 text-primary/30 mb-4" />
          <div className="flex items-center gap-1 text-amber-500 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-current" />
            ))}
          </div>
          <blockquote className="text-base sm:text-lg leading-relaxed">
            &ldquo;{r.text}&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-sm text-muted-foreground">
            {r.name} · {r.date} · {r.platform}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function FaqAccordion({ items }: { items: { q: string; a: string; href?: string }[] }) {
  return (
    <div className="divide-y border-y">
      {items.map((faq) => (
        <details key={faq.q} className="group py-6">
          <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
            <h3 className="text-lg font-semibold leading-snug">{faq.q}</h3>
            <ChevronDown className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <p className="text-muted-foreground mt-3 leading-relaxed max-w-3xl">
            {faq.a}
            {faq.href && (
              <>
                {" "}
                <Link href={faq.href} className="text-primary font-medium hover:underline">
                  More&nbsp;→
                </Link>
              </>
            )}
          </p>
        </details>
      ))}
    </div>
  );
}

export function BookDirectCta({
  heading = "Book direct and save",
  sub = "Same homes, better price — no platform service fees, and returning guests get a loyalty discount. Questions first? Text, call, or email anytime.",
}: {
  heading?: string;
  sub?: string;
}) {
  return (
    <section className="py-20 sm:py-28 bg-foreground text-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-balance">{heading}</h2>
        <p className="text-lg opacity-80 mt-5 max-w-2xl mx-auto leading-relaxed">{sub}</p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full bg-background text-foreground font-semibold px-7 py-3.5 hover:opacity-90 transition-opacity"
          >
            Check availability <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-background/40 font-semibold px-7 py-3.5 hover:bg-background/10 transition-colors"
          >
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}
