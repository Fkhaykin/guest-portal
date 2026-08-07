"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import {
  ArrowRight,
  Sparkles,
  Home,
  MessageSquare,
  Wrench,
  Calendar,
  Shield,
  BarChart3,
  Camera,
  Star,
  Check,
  Quote,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Imagery                                                            */
/* ------------------------------------------------------------------ */

const IMG = (id: string, w: 720 | 1200 | 1920 = 1200) =>
  `https://a0.muscache.com/im/pictures/${id}.jpg?im_w=${w}`;

const HERO = IMG("5ce084b8-38ea-4bd9-9bbd-d16629eb6a21", 1920);
const INTRO = IMG("1f3f8cb2-8db6-450c-93de-1404b66853df", 1200);
const TECH_BG = IMG("11d2c493-87e1-4534-acdc-e1ff0f1f5832", 1920);
const PULLQUOTE_BG = IMG("0f3c2d87-7cd0-45bc-bf57-efdcbda6ac7e", 1920);
const CLOSING = IMG("f5f31bab-faec-4b26-b3c9-cb356293126a", 1920);

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

const SERVICES = [
  {
    icon: Camera,
    title: "Listing & marketing",
    body:
      "Professional photography, airtight copy, and distribution across Airbnb, VRBO, Booking.com, and our own direct-booking site. We keep your listings ranked and booked.",
  },
  {
    icon: BarChart3,
    title: "Dynamic pricing",
    body:
      "Nightly rates adjusted by season, local events, demand, and year-over-year data. No more leaving revenue on the table on a Friday in July — or discounting too late in November.",
  },
  {
    icon: MessageSquare,
    title: "24/7 guest communication",
    body:
      "Real humans, fast replies — pre-booking questions, during-stay issues, post-stay reviews. Your phone stops ringing at 11pm on a Saturday. Ours is always on.",
  },
  {
    icon: Home,
    title: "Turnover & cleaning",
    body:
      "Our in-house cleaning team works off a property-specific checklist, inspects every room, and photographs every turnover. Every stay, same standard.",
  },
  {
    icon: Wrench,
    title: "Maintenance coordination",
    body:
      "Trusted local plumbers, electricians, HVAC, landscapers — already vetted and on-call. We handle triage, scheduling, and follow-through. You get the invoice, not the headache.",
  },
  {
    icon: Shield,
    title: "PEPOA & HOA compliance",
    body:
      "We handle guest registration, PEPOA submissions, and HOA paperwork on your behalf. Every booking is documented and compliant — so your good standing stays good.",
  },
  {
    icon: Calendar,
    title: "Calendar & channel sync",
    body:
      "One calendar across every platform. No double-bookings, no manual updates, no guesswork. We manage every channel so your availability is always right.",
  },
  {
    icon: Sparkles,
    title: "Branded guest portal",
    body:
      "Your guests get a branded check-in portal with house info, WiFi, local recs, and instructional videos — the same platform we built for our own homes.",
  },
  {
    icon: Star,
    title: "Review & reputation",
    body:
      "We chase every review, address every concern, and protect your rating. Our portfolio averages 4.9 stars — we manage your home to the same bar.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Walk the property with us",
    body:
      "We visit, take a look, and tell you honestly what your home will do on the market. No hard sell — just a realistic revenue estimate and a plan for any prep work.",
  },
  {
    step: "02",
    title: "We onboard everything",
    body:
      "Photography, listing copy, channel setup, smart locks, welcome materials, cleaning rotation, and vendor contacts — we handle the whole build in under 2 weeks.",
  },
  {
    step: "03",
    title: "You get monthly reports",
    body:
      "Transparent statements, occupancy breakdowns, revenue vs. forecast, and a running maintenance log. Your home. Your numbers. No surprises.",
  },
];

const DIFFERENTIATORS = [
  {
    title: "We live here",
    body:
      "Our team lives and works in the Poconos. When your guest locks themselves out at 10pm, a real person is 20 minutes away — not a call center in another state.",
  },
  {
    title: "We run our own homes the same way",
    body:
      "We manage five of our own lakehouses on the same platform, with the same team, to the same standard. The standard isn't theoretical — we live it.",
  },
  {
    title: "Built on our own software",
    body:
      "Custom guest portal, automated check-in, QR-coded house guides, and an owner dashboard we built from the ground up. Not duct-taped off-the-shelf tools.",
  },
  {
    title: "Transparent, fair pricing",
    body:
      "One management rate. No hidden markups on cleaning, no cuts on upsells, no lock-in contracts. If we're not earning our fee, you can walk.",
  },
  {
    title: "Direct bookings, not just OTAs",
    body:
      "Every guest funnels back to our own site and database, so you're not renting your audience from Airbnb forever. Repeat guests belong to you.",
  },
  {
    title: "Local vendor network",
    body:
      "Plumbers, handymen, HVAC, landscapers, snow removal — the people we've spent years vetting are the ones we send to your house. You inherit our rolodex.",
  },
];

const INCLUDED = [
  "Full-service property management",
  "Professional photography & listings",
  "Multi-channel distribution (Airbnb, VRBO, direct)",
  "Dynamic pricing & revenue optimization",
  "24/7 guest communication",
  "In-house cleaning team",
  "Maintenance coordination",
  "PEPOA / HOA registration handling",
  "Smart lock & access management",
  "Branded guest portal per property",
  "Monthly owner statements",
  "Direct-line access to your account manager",
];

const FAQS = [
  {
    q: "What does management cost?",
    a: "Our standard rate is a percentage of booking revenue — not a flat fee. We only make money when you make money. Onboarding and photography are included. Exact pricing depends on the property, so we quote after the walkthrough.",
  },
  {
    q: "How long is the contract?",
    a: "Our standard agreement is month-to-month after a 90-day ramp-up. No multi-year lock-ins. If we're not performing, you're not trapped.",
  },
  {
    q: "What kind of homes do you manage?",
    a: "Lakefront cabins, mountain chalets, larger family compounds — anywhere in the Poconos region. We're selective: we take on homes we'd be proud to put our own name on, and turn down ones that don't fit.",
  },
  {
    q: "Do I keep my existing Airbnb reviews?",
    a: "Yes. We co-host from your existing listings where possible, so your review history and Superhost status stay intact. For homes launching fresh, we build your reputation from day one.",
  },
  {
    q: "What if I want to use the house myself?",
    a: "Your calendar is yours. Block dates directly in our owner portal any time — for family, friends, or personal stays. We work around you.",
  },
  {
    q: "Who handles taxes and permits?",
    a: "We collect and remit lodging taxes where required, and keep your PEPOA/HOA registrations current. Income reporting is on you, but we provide clean monthly statements that make it straightforward.",
  },
];

const STATS = [
  { value: "5", label: "Own homes managed" },
  { value: "4.9", label: "Portfolio average rating" },
  { value: "1,200+", label: "Stays hosted" },
  { value: "< 10 min", label: "Average guest response" },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ManagementServicesPage() {
  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      {/* === HERO === */}
      <section className="relative h-screen min-h-160 overflow-hidden">
        <img
          src={HERO}
          alt="Lakefront property at golden hour"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/35 to-black/90" />

        <div className="absolute inset-0 flex flex-col justify-end pb-20 sm:pb-28 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <Badge
              variant="secondary"
              className="mb-6 gap-1.5 bg-white/15 text-white border border-white/30 backdrop-blur-md px-4 py-1.5"
            >
              <Home className="h-3.5 w-3.5" />
              For Poconos Homeowners
            </Badge>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[0.95] max-w-5xl">
              Your Poconos home, managed like our own.
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mt-8 max-w-2xl leading-relaxed">
              Summit Lakeside manages short-term rentals for select Poconos
              owners — from listing and pricing to cleaning, maintenance, and
              guest care. Run by the same team, on the same platform, to the
              same standard we hold our own lakehouses to.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="gap-2 bg-white text-black hover:bg-white/90 px-8"
                render={<Link href="#inquire" />}
              >
                Get a free property assessment
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white px-8"
                render={<Link href="#services" />}
              >
                See what's included
              </Button>
            </div>
            <div className="mt-12 flex items-center gap-3 text-white/60 text-xs uppercase tracking-[0.25em]">
              <span className="h-px w-12 bg-white/40" />
              <span>How it works</span>
              <ChevronDown className="h-4 w-4 animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* === INTRO === */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Why owners work with us
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
              Hosting is a full-time job. We already have that job.
            </h2>
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed">
              <p>
                If you've tried managing a Poconos rental yourself, you already
                know — the listing is the easy part. It's the 11pm texts, the
                burst pipe in February, the last-minute cancellations, and the
                cleaner who ghosts on a turnover day that burn you out.
              </p>
              <p>
                And if you've tried a national management company, you know
                the other side of it — slow responses, middling cleans, flat
                revenue, and nobody who actually lives within an hour of your
                house.
              </p>
              <p className="text-foreground font-medium">
                We built Summit Lakeside to do it the right way — local,
                responsive, and obsessed with the details. Now we do it for
                other owners, too.
              </p>
            </div>
          </div>
          <div className="lg:col-span-7 order-first lg:order-0">
            <div className="relative">
              <img
                src={INTRO}
                alt="Poconos lakehouse"
                className="w-full aspect-4/5 object-cover rounded-3xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -right-6 hidden sm:block bg-background border rounded-2xl px-5 py-4 shadow-xl max-w-64">
                <div className="flex items-center gap-2 text-amber-500 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  &ldquo;They doubled our booking revenue in one season and I
                  haven't thought about the house since.&rdquo;
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-1.5 uppercase tracking-wider">
                  — Owner, Lake Wallenpaupack
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === STATS === */}
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

      {/* === SERVICES === */}
      <section id="services" className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-14 sm:mb-20">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Full service
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mt-4 leading-[1.05]">
              Everything that happens between bookings. And during them.
            </h2>
            <p className="text-lg text-muted-foreground mt-6 leading-relaxed">
              One team handles the whole operation — marketing, guest care,
              turnovers, maintenance, and compliance. You get a single point
              of contact and a home that runs without you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
                  className="group rounded-2xl bg-card border p-7 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold leading-snug mb-2">
                    {service.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {service.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* === PULLQUOTE === */}
      <section className="relative h-[70vh] min-h-120 overflow-hidden">
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
                We only take on homes we'd be proud to put our own name on.
              </p>
              <p className="text-white/70 mt-8 text-xs tracking-[0.3em] uppercase">
                — Selective by design
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === HOW IT WORKS === */}
      <section className="py-24 sm:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-14 sm:mb-20">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              How it works
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mt-4 leading-[1.05]">
              From first call to first guest in under two weeks.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.step}
                className="relative rounded-2xl bg-background border p-8"
              >
                <div className="text-6xl font-bold tracking-tight text-primary/20 mb-4 tabular-nums">
                  {step.step}
                </div>
                <h3 className="text-xl font-bold leading-snug mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === DIFFERENTIATORS === */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-14 sm:mb-20">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Why us
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mt-4 leading-[1.05]">
              Six things you won't get from anyone else in the Poconos.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border">
            {DIFFERENTIATORS.map((item, i) => (
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

      {/* === TECH SECTION === */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <img
          src={TECH_BG}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-linear-to-b from-background via-background/95 to-background" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-6 space-y-6">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Built in-house
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
              The tech most managers don't have.
            </h2>
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed">
              <p>
                Other managers run off spreadsheets, group texts, and a dozen
                disconnected tools. We built our own platform because we got
                tired of that too.
              </p>
              <p>
                Every home we manage gets a branded guest portal, automated
                check-in, digital house manuals, QR-coded local guides, and a
                real-time owner dashboard. Your guests stay informed. You stay
                in the loop. We stay out of your inbox.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              {[
                "Branded guest portal per property",
                "Automated check-in & PEPOA",
                "QR-coded house manuals",
                "Real-time owner dashboard",
                "Dynamic pricing engine",
                "Unified channel calendar",
              ].map((feat) => (
                <div key={feat} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">{feat}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-6">
            <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-2xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="size-2.5 rounded-full bg-red-500/70" />
                <div className="size-2.5 rounded-full bg-yellow-500/70" />
                <div className="size-2.5 rounded-full bg-green-500/70" />
                <div className="ml-3 text-xs text-muted-foreground">
                  owner.summitlakeside.com
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      This month
                    </div>
                    <div className="text-3xl font-bold tracking-tight">
                      $14,280
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-emerald-600">
                    +22% vs last year
                  </Badge>
                </div>
                <div className="h-px bg-border" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Occupancy</div>
                    <div className="text-lg font-semibold">87%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">ADR</div>
                    <div className="text-lg font-semibold">$412</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Reviews</div>
                    <div className="text-lg font-semibold flex items-center gap-1">
                      4.9
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    </div>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="space-y-2">
                  {[
                    { label: "Upcoming check-ins", value: "6" },
                    { label: "Pending maintenance", value: "1" },
                    { label: "Pending reviews", value: "2" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === INCLUDED / PRICING === */}
      <section className="py-24 sm:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              What's included
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
              One rate. Everything covered.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              No tiered plans, no a-la-carte add-ons, no surprise invoices.
              One percentage of booking revenue covers the entire operation.
              Pricing varies by property — we quote after the walkthrough.
            </p>
            <div className="pt-4">
              <Button
                size="lg"
                className="gap-2"
                render={<Link href="#inquire" />}
              >
                Request a property quote
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-background border shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8 border-b">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Summit full-service
                    </div>
                    <div className="text-2xl font-bold">
                      All-inclusive management
                    </div>
                  </div>
                  <Badge>Most owners</Badge>
                </div>
              </div>
              <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INCLUDED.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === FAQ === */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              FAQ
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mt-4 leading-[1.05]">
              The questions owners actually ask.
            </h2>
            <p className="text-lg text-muted-foreground mt-6 leading-relaxed">
              Didn't see yours? Reach out below and we'll answer directly.
            </p>
          </div>
          <div className="lg:col-span-8">
            <div className="divide-y border-y">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group py-6">
                  <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
                    <h3 className="text-lg font-semibold leading-snug">
                      {faq.q}
                    </h3>
                    <ChevronDown className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="text-muted-foreground mt-4 leading-relaxed">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* === INQUIRE / CONTACT === */}
      <section
        id="inquire"
        className="relative overflow-hidden py-24 sm:py-32"
      >
        <img
          src={CLOSING}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/85 via-black/80 to-black/90" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <Sparkles className="h-10 w-10 text-white/80 mx-auto mb-6" />
          <h2 className="text-5xl sm:text-6xl font-bold tracking-tight text-white leading-[0.95]">
            Ready to hand it off?
          </h2>
          <p className="text-lg text-white/80 mt-6 max-w-2xl mx-auto leading-relaxed">
            Tell us a little about your home and we'll get back to you within
            one business day with a realistic revenue estimate and next steps.
          </p>

          <form
            action="mailto:contact@summitlakeside.com"
            method="post"
            encType="text/plain"
            className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left"
          >
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-white/70 font-semibold">
                Your name
              </span>
              <input
                name="name"
                required
                className="h-11 rounded-lg bg-white/10 border border-white/20 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-white/60 focus:bg-white/15 transition"
                placeholder="Jane Homeowner"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-white/70 font-semibold">
                Email
              </span>
              <input
                name="email"
                type="email"
                required
                className="h-11 rounded-lg bg-white/10 border border-white/20 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-white/60 focus:bg-white/15 transition"
                placeholder="you@email.com"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-white/70 font-semibold">
                Phone
              </span>
              <input
                name="phone"
                type="tel"
                className="h-11 rounded-lg bg-white/10 border border-white/20 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-white/60 focus:bg-white/15 transition"
                placeholder="(732) 213-8571"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-white/70 font-semibold">
                Property location
              </span>
              <input
                name="location"
                required
                className="h-11 rounded-lg bg-white/10 border border-white/20 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-white/60 focus:bg-white/15 transition"
                placeholder="Lake Wallenpaupack, PA"
              />
            </label>
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-xs uppercase tracking-wider text-white/70 font-semibold">
                Tell us about your home
              </span>
              <textarea
                name="message"
                rows={4}
                className="rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/60 focus:bg-white/15 transition resize-none"
                placeholder="Bedrooms, bathrooms, whether you're currently listed, and what's not working about your current setup."
              />
            </label>
            <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                size="lg"
                type="submit"
                className="gap-2 bg-white text-black hover:bg-white/90 px-8 flex-1"
              >
                Send inquiry
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                type="button"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white px-8"
                render={<a href="tel:+17322138571" />}
              >
                <Phone className="h-4 w-4" />
                Or call (732) 213-8571
              </Button>
            </div>
          </form>

          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-sm text-white/60">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Serving the Poconos, PA
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              contact@summitlakeside.com
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              (732) 213-8571
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
