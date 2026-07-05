import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { AlertTriangle, ArrowRight, Mail, Phone } from "lucide-react";
import { QUICK_RULES } from "@/lib/house-rules";
import { SECTIONS, CHAPTERS, type PolicySection } from "@/lib/policy-content";
import {
  ChapterNav,
  HeroMedia,
  ParallaxBand,
  ReadingProgress,
} from "./visuals";

export const metadata = {
  title: "Rental Policies & Terms — Summit Lakeside",
  description:
    "The complete terms, conditions, and house rules for staying at a Summit Lakeside property. Please read carefully before booking.",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function PolicyArticle({ section }: { section: PolicySection }) {
  return (
    <article id={section.id} className="relative scroll-mt-32">
      <div className="flex items-baseline gap-4 mb-5">
        {/* Number hangs in the margin on desktop so heading + body share one axis */}
        <span className="text-sm tabular-nums font-semibold text-primary sm:absolute sm:-left-12 sm:top-1.5">
          {section.number}
        </span>
        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
          {section.title}
        </h3>
      </div>
      <div className="space-y-4 text-lg text-foreground/80 leading-relaxed">
        {section.paragraphs?.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {section.items && section.items.length > 0 && (
          <ul className="space-y-3 pt-2">
            {section.items.map((item, i) => (
              <li key={i} className="flex gap-3 border-l-2 border-primary/30 py-0.5">
                <span className="pl-4 block">
                  {item.label && (
                    <span className="font-semibold text-foreground">
                      {item.label}.{" "}
                    </span>
                  )}
                  {item.body}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export default function RentalPoliciesPage() {
  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <a
        href="#short-version"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-70 focus:bg-background focus:px-3 focus:py-2 focus:rounded-lg"
      >
        Skip to content
      </a>
      <SiteNav />
      <ReadingProgress />
      <main id="content">

      {/* === HERO — full-viewport lake video === */}
      <HeroMedia video="/videos/boatlake.mp4" poster="/videos/boatlake.jpg">
        <div className="absolute inset-0 flex flex-col justify-end pb-20 sm:pb-28 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              <span className="h-1 w-1 rounded-full bg-white/70" />
              Rental policies
            </span>
            <h1 className="mt-5 text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[0.92] max-w-4xl text-balance">
              The full terms of staying{" "}
              <span className="whitespace-nowrap">with us.</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mt-6 max-w-2xl leading-relaxed text-pretty">
              Forty-five sections, seven chapters, zero surprises. Eight rules
              cover almost everything — start there.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#short-version"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
              >
                Skip to the 8 rules
                <ArrowRight className="h-4 w-4" />
              </a>
              <p className="text-sm text-white/50">Last updated April 19, 2026</p>
            </div>
          </div>
        </div>
      </HeroMedia>

      {/* === CHAPTER NAV — scrollspy bar === */}
      <ChapterNav
        chapters={CHAPTERS.map((c) => ({ id: c.id, index: c.index, title: c.title }))}
      />

      {/* === THE SHORT VERSION === */}
      <section id="short-version" className="relative overflow-hidden bg-[#101820] scroll-mt-16 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                <span className="h-1 w-1 rounded-full bg-primary" />
                The short version
              </span>
              <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-white text-balance">
                Eight rules cover 90% of it.
              </h2>
            </div>
            <p className="text-sm text-white/50 max-w-xs leading-relaxed">
              Tap any card for the full section. The other 10% lives in the
              chapters below.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            {QUICK_RULES.map((r) => (
              <a
                key={r.rule}
                href={r.href}
                className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.07] p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/12 hover:border-white/25 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <r.icon className="h-6 w-6 text-primary" />
                  <ArrowRight className="h-4 w-4 text-white/60 opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                </div>
                <p className="mt-4 font-semibold text-white leading-snug">{r.rule}</p>
                <p className="mt-1.5 text-sm text-white/65 leading-relaxed">{r.detail}</p>
                <span className="mt-auto pt-4 text-xs font-medium tabular-nums text-white/70 group-hover:text-primary transition-colors">
                  Read §{r.section}
                </span>
              </a>
            ))}
          </div>
          {/* Binding notice, folded into the band */}
          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 sm:p-5">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-100/90 leading-relaxed">
              <span className="font-semibold text-amber-200">This is a legally binding agreement.</span>{" "}
              By booking or occupying any Summit Lakeside property you agree to
              every provision on this page — the short version included.
            </p>
          </div>
        </div>
      </section>

      {/* === CHAPTERS === */}
      {CHAPTERS.map((chapter) => {
        const sections = SECTIONS.slice(chapter.range[0], chapter.range[1] + 1);
        return (
          <section key={chapter.id} id={chapter.id} className="scroll-mt-28">
            <ParallaxBand img={chapter.img} alt={chapter.alt}>
              <div className="relative flex items-end justify-between gap-6">
                {/* Watermark numeral blends with the plate instead of floating over it */}
                <span
                  aria-hidden
                  className="pointer-events-none select-none absolute -left-2 -top-40 sm:-top-64 text-[11rem] sm:text-[19rem] font-bold leading-none text-white/40 mix-blend-overlay"
                >
                  {chapter.index}
                </span>
                <div className="relative">
                  <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white text-balance [text-shadow:0_1px_24px_rgb(0_0_0/0.45)]">
                    {chapter.title}
                  </h2>
                  <p className="mt-3 text-base sm:text-lg text-white/80 max-w-xl leading-relaxed text-pretty [text-shadow:0_1px_16px_rgb(0_0_0/0.5)]">
                    {chapter.blurb}
                  </p>
                </div>
                <span className="hidden sm:block shrink-0 text-sm text-white/75 tabular-nums pb-2 [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
                  §{sections[0].number}–{sections[sections.length - 1].number}
                </span>
              </div>
            </ParallaxBand>
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 space-y-14 sm:space-y-20">
              {sections.map((s) => (
                <div key={s.id} className="space-y-14 sm:space-y-20">
                  <PolicyArticle section={s} />
                  {chapter.pullquote?.afterId === s.id && (
                    <aside className="relative left-1/2 -ml-[50vw] w-screen bg-[#101820] py-16 sm:py-24 print:hidden">
                      <div className="max-w-4xl mx-auto px-6 text-center">
                        <p className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight text-balance">
                          “{chapter.pullquote.text}”
                        </p>
                        <p className="mt-5 text-sm text-white/50 tabular-nums">
                          {chapter.pullquote.cite}
                        </p>
                      </div>
                    </aside>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* === ACKNOWLEDGEMENT === */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 w-full">
        <div className="rounded-3xl border bg-muted/30 p-6 sm:p-10">
          <h3 className="text-2xl font-bold mb-3">Acknowledgement on booking</h3>
          <p className="text-base text-foreground/80 leading-relaxed">
            When you complete the registration step for your reservation, you
            will be asked to sign electronically to confirm that you have read
            and agreed to this Agreement in its entirety. Your electronic
            signature has the same legal force as a handwritten one under the
            federal E-SIGN Act and the Pennsylvania Uniform Electronic
            Transactions Act.
          </p>
        </div>
      </section>

      {/* === CONTACT CTA — dusk bookend to the hero === */}
      <ParallaxBand
        img="https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/site/policies/cta-dusk.jpg"
        alt="The lake at dusk"
        align="center"
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white text-balance [text-shadow:0_1px_24px_rgb(0_0_0/0.45)]">
            Questions about any of this?
          </h2>
          <p className="text-white/80 mt-5 text-lg leading-relaxed [text-shadow:0_1px_16px_rgb(0_0_0/0.5)]">
            Before you book, we&rsquo;re happy to walk through any section,
            clarify what applies to a specific property, or work with you on
            reasonable accommodations. A real person will reply.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              variant="outline"
              className="gap-2 border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              render={<a href="mailto:contact@summitlakeside.com" />}
            >
              <Mail className="h-4 w-4" />
              Email us
            </Button>
            <Button
              size="lg"
              className="gap-2 bg-white text-black hover:bg-white/90"
              render={<Link href="/contact" />}
            >
              <Phone className="h-4 w-4" />
              Contact form
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </ParallaxBand>
      </main>

      <SiteFooter />
    </div>
  );
}
