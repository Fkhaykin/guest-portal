"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site-nav";
import {
  Heart,
  Sparkles,
  ArrowRight,
  Quote,
  Star,
  ChevronDown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Imagery — pulled from real listing photography                     */
/* ------------------------------------------------------------------ */

const IMG = (id: string, w: 720 | 1200 | 1920 = 1200) =>
  `https://a0.muscache.com/im/pictures/${id}.jpg?im_w=${w}`;

const HERO = IMG("ec9df551-d43c-4294-ad20-7d1ba43b4840", 1920);
const ORIGIN = IMG("f5f31bab-faec-4b26-b3c9-cb356293126a");
const PULLQUOTE_BG = IMG("0f3c2d87-7cd0-45bc-bf57-efdcbda6ac7e", 1920);
const HOSPITALITY_A = IMG("19bc7783-e053-41be-baf7-5588ee941de9");
const HOSPITALITY_B = IMG("86f5afc5-cfd5-4a5e-8dad-b9585d9d38a6");
const HOMEPLACE = IMG("5ce084b8-38ea-4bd9-9bbd-d16629eb6a21", 1920);
const CLOSING = IMG("11d2c493-87e1-4534-acdc-e1ff0f1f5832", 1920);

const COLLECTION = [
  IMG("2a8bbc05-e02f-48e0-93b9-fe37adeaee3a"),
  IMG("ca104183-2a19-4800-99d2-4b34ba9ea23c"),
  IMG("6e8e7f2f-dd7b-4e29-8719-6e0d6ab78688"),
  IMG("bb8633bf-fe15-4b03-84a4-d5174bea0515"),
  IMG("5e71465d-8c6e-426b-9717-3bc0b117bdbf"),
];

/* ------------------------------------------------------------------ */
/*  Story content                                                      */
/* ------------------------------------------------------------------ */

const VALUES = [
  {
    title: "Thoughtfulness in every detail",
    body:
      "From the linens on the beds to the firewood stacked by the pit, we sweat the small stuff so you don't have to think about it.",
    image: IMG("5a38ed1b-c546-4f5b-963c-10f1e60dd5ab"),
  },
  {
    title: "Reliability you can count on",
    body:
      "What you see is what you get — clean, well-kept, and exactly as described. Every house gets a walkthrough before every check-in.",
    image: IMG("274c65ab-6fa5-4834-8985-31f9a87bdaf6"),
  },
  {
    title: "Hospitality, not just hosting",
    body:
      "There's a difference between renting a house and welcoming someone into one. We answer at 10pm, leave local notes, and actually want to hear how it went.",
    image: IMG("3b7adad4-1ede-468d-9b72-e09b20428a06"),
  },
  {
    title: "Every guest is family",
    body:
      "Couples' weekend or twenty-person reunion — same warmth, same attention. We remember repeat guests and quietly accommodate the special asks.",
    image: IMG("14ab5084-0a96-4d1d-9c02-4110a02e33e1"),
  },
  {
    title: "A standard we refuse to drop",
    body:
      "We constantly upgrade the homes, refine the process, and ask how to do better. The five-star reviews are a reflection of that, not the goal.",
    image: IMG("4e2cbe1c-3b67-4177-9b5c-0ebe802dd548"),
  },
  {
    title: "Respect for this place",
    body:
      "The Poconos isn't just where we work — it's where we live and raise our families. We take care of these lakes, and we ask our guests to share that.",
    image: IMG("38da1540-5998-4132-8b2e-131bfe1c9bb7"),
  },
];

const PROMISES = [
  {
    title: "Real responses, fast",
    body: "No chatbots. No call centers. A real person, usually within minutes.",
  },
  {
    title: "Spotless every time",
    body: "Professional cleans with our own checklist. Inspected before you arrive.",
  },
  {
    title: "Stocked and ready",
    body: "Coffee, essentials, firewood, board games, and a real local guide waiting.",
  },
  {
    title: "Personal touches",
    body: "Celebrating something? Tell us. We love adding small surprises.",
  },
  {
    title: "Honest and transparent",
    body: "No hidden fees, no fine-print. What we quote is what you pay.",
  },
  {
    title: "Insider local knowledge",
    body: "Restaurants, trails, swim spots, and tips you won't find on Google.",
  },
];

const STATS = [
  { value: "5", label: "Lakehouses, hand-picked" },
  { value: "4.9", label: "Average guest rating" },
  { value: "1,200+", label: "Stays hosted" },
  { value: "100%", label: "Locally run" },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function WhySummitPage() {
  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      {/* === HERO === */}
      <section className="relative h-screen min-h-160 overflow-hidden">
        <img
          src={HERO}
          alt="Firepit by the lake at golden hour"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/30 to-black/85" />

        <div className="absolute inset-0 flex flex-col justify-end pb-20 sm:pb-28 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <Badge
              variant="secondary"
              className="mb-6 gap-1.5 bg-white/15 text-white border border-white/30 backdrop-blur-md px-4 py-1.5"
            >
              <Heart className="h-3.5 w-3.5" />
              Our Story
            </Badge>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[0.95] max-w-5xl">
              We built this for the people who get it.
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mt-8 max-w-2xl leading-relaxed">
              Summit Lakeside isn't a hotel. It isn't a corporation. It's a
              small collection of Poconos lakehouses, kept by people who
              actually live here — and who want your stay to feel like it
              belongs to you.
            </p>
            <div className="mt-12 flex items-center gap-3 text-white/60 text-xs uppercase tracking-[0.25em]">
              <span className="h-px w-12 bg-white/40" />
              <span>Read the story</span>
              <ChevronDown className="h-4 w-4 animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* === CHAPTER 1 — origin === */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-center">
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="relative">
              <img
                src={ORIGIN}
                alt="Lakefront mansion at the heart of Summit Lakeside"
                className="w-full aspect-4/5 object-cover rounded-3xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -right-6 hidden sm:block bg-background border rounded-2xl px-5 py-4 shadow-xl">
                <div className="flex items-center gap-2 text-amber-500 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground max-w-44 leading-snug">
                  &ldquo;Felt more like a friend's place than a rental.&rdquo;
                </p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 order-1 lg:order-2 space-y-6">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Chapter One
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
              It started with one cabin on the lake.
            </h2>
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed">
              <p>
                Years ago, our family bought a small lakefront place in the
                Poconos. Not as an investment — as a refuge. Somewhere to leave
                the city behind, watch the kids learn to fish, and end every
                night around the firepit.
              </p>
              <p>
                Friends started asking if they could borrow it. Then friends of
                friends. Pretty soon we realized we weren't just sharing a
                house — we were sharing a feeling.
              </p>
              <p className="text-foreground font-medium">
                That feeling is what Summit Lakeside is built around.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === FULL-BLEED PULLQUOTE === */}
      <section className="relative h-[80vh] min-h-130 overflow-hidden">
        <img
          src={PULLQUOTE_BG}
          alt="Lakeside at twilight"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/85 via-black/55 to-black/20" />
        <div className="absolute inset-0 flex items-center px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <div className="max-w-2xl">
              <Quote className="h-12 w-12 text-white/40 mb-6" />
              <p className="text-3xl sm:text-4xl lg:text-5xl font-medium text-white leading-tight">
                Every house we run, we run like it's our own. Because at one
                point, every one of them was.
              </p>
              <p className="text-white/70 mt-8 text-xs tracking-[0.3em] uppercase">
                — The Summit Lakeside team
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === CHAPTER 2 — the collection (mosaic) === */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-14 sm:mb-20">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Chapter Two
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mt-4 leading-[1.05]">
              One cabin became a collection.
            </h2>
            <p className="text-lg text-muted-foreground mt-6 leading-relaxed">
              We didn't grow by buying anything we could find. We grew by
              adding only the houses that made us feel the same way the first
              one did — homes with good light, a great view, and room for
              everyone who matters.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-4">
            <div className="col-span-2 sm:col-span-8 row-span-2">
              <img
                src={COLLECTION[0]}
                alt="Lake adjacent home"
                className="w-full h-full aspect-16/10 object-cover rounded-2xl"
              />
            </div>
            <div className="col-span-1 sm:col-span-4">
              <img
                src={COLLECTION[1]}
                alt="Cozy lakehouse"
                className="w-full aspect-4/5 object-cover rounded-2xl"
              />
            </div>
            <div className="col-span-1 sm:col-span-4">
              <img
                src={COLLECTION[2]}
                alt="Lakefront home"
                className="w-full aspect-4/5 object-cover rounded-2xl"
              />
            </div>
            <div className="col-span-1 sm:col-span-6">
              <img
                src={COLLECTION[3]}
                alt="Lakeview chalet"
                className="w-full aspect-16/10 object-cover rounded-2xl"
              />
            </div>
            <div className="col-span-1 sm:col-span-6">
              <img
                src={COLLECTION[4]}
                alt="Another Summit Lakeside property"
                className="w-full aspect-16/10 object-cover rounded-2xl"
              />
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              render={<Link href="/search" />}
            >
              See every house
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* === STATS STRIP === */}
      <section className="border-y bg-muted/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-6">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center sm:text-left">
                <div className="text-4xl sm:text-5xl font-bold tracking-tight">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-2 leading-snug">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === CHAPTER 3 — hospitality === */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Chapter Three
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
              Hospitality, not hosting.
            </h2>
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed">
              <p>
                There's a real difference between renting someone a house and
                welcoming them into one. The big platforms forgot that. We
                didn't.
              </p>
              <p>
                You'll text a real person. You'll get a real reply. The
                espresso machine will already be set up, the firewood will
                already be split, and the note on the counter will already
                know your name.
              </p>
              <p>
                It's not magic. It's just hospitality, done by people who
                actually care.
              </p>
            </div>
          </div>
          <div className="lg:col-span-7 grid grid-cols-2 gap-3 sm:gap-4">
            <img
              src={HOSPITALITY_A}
              alt="Welcoming interior detail"
              className="w-full aspect-3/4 object-cover rounded-2xl translate-y-8 sm:translate-y-12"
            />
            <img
              src={HOSPITALITY_B}
              alt="Cozy living space"
              className="w-full aspect-3/4 object-cover rounded-2xl"
            />
          </div>
        </div>
      </section>

      {/* === CHAPTER 4 — values, image-led cards === */}
      <section className="py-24 sm:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-14 sm:mb-20">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              What we believe
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mt-4 leading-[1.05]">
              Six things we never cut corners on.
            </h2>
            <p className="text-lg text-muted-foreground mt-6 leading-relaxed">
              These aren't marketing copy. They're the standard we hold every
              house, every clean, and every guest interaction to.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {VALUES.map((value, i) => (
              <div
                key={value.title}
                className="group rounded-2xl overflow-hidden bg-card border shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="aspect-4/3 overflow-hidden">
                  <img
                    src={value.image}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="p-6 space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground tabular-nums">
                    0{i + 1}
                  </div>
                  <h3 className="text-xl font-bold leading-snug">
                    {value.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {value.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === CHAPTER 5 — full-bleed: this is home === */}
      <section className="relative h-[90vh] min-h-150 overflow-hidden">
        <img
          src={HOMEPLACE}
          alt="The Poconos at golden hour"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="max-w-7xl mx-auto">
            <span className="text-xs uppercase tracking-[0.3em] text-white/60 font-semibold">
              Chapter Four
            </span>
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mt-4 max-w-3xl leading-[1.05]">
              This is our home, too.
            </h2>
            <p className="text-lg text-white/80 mt-6 max-w-2xl leading-relaxed">
              We hike these trails on Saturdays. We eat at these restaurants
              on Friday nights. We know which lake spot has the best
              swimming, which has the best fishing, and which diner has the
              pancakes worth waking up for. The recommendations we share are
              the ones we actually use.
            </p>
          </div>
        </div>
      </section>

      {/* === CHAPTER 6 — promise === */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-14">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Our Promise
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mt-4 leading-[1.05]">
              What you get, every time.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border">
            {PROMISES.map((item, i) => (
              <div
                key={item.title}
                className="bg-background p-7 sm:p-8 hover:bg-muted/40 transition-colors"
              >
                <div className="text-sm font-semibold text-muted-foreground tabular-nums mb-4">
                  0{i + 1}
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === FINAL CTA === */}
      <section className="relative h-[85vh] min-h-140 overflow-hidden">
        <img
          src={CLOSING}
          alt="Lakehouse at sunset"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/30 via-black/50 to-black/85" />
        <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-6 text-center">
          <div className="max-w-2xl space-y-7">
            <Sparkles className="h-10 w-10 text-white/80 mx-auto" />
            <h2 className="text-5xl sm:text-7xl font-bold tracking-tight text-white leading-[0.95]">
              Come stay with us.
            </h2>
            <p className="text-lg text-white/80 leading-relaxed">
              Find your lakehouse. Plan your weekend. Make it the trip your
              friends won't stop talking about.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                size="lg"
                className="gap-2 bg-white text-black hover:bg-white/90 px-8"
                render={<Link href="/search" />}
              >
                Browse Lakehouses
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white px-8"
                render={<Link href="/contact" />}
              >
                Talk to a real person
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
