"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SiteNav } from "@/components/site-nav";
import {
  Heart,
  Sparkles,
  Users,
  Clock,
  ShieldCheck,
  MessageCircleHeart,
  TreePine,
  Home,
  ArrowRight,
  Star,
  Coffee,
  Gift,
  Handshake,
  Mountain,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const OUR_STORY_POINTS = [
  {
    title: "Born from a love of the Poconos",
    description:
      "Summit Lakeside started with a single lakefront cabin and a simple belief: the Poconos deserves more than cookie-cutter vacation rentals. What began as a family passion project has grown into a collection of thoughtfully curated lakehouse properties — each one a place we'd want to stay ourselves.",
  },
  {
    title: "Hands-on from day one",
    description:
      "We're not a faceless management company. We personally select every property, oversee every detail of its setup, and stay involved in every guest experience. When you book with us, you're booking with people who genuinely care about your trip.",
  },
  {
    title: "Rooted in community",
    description:
      "We live here. We know the best trails, the hidden restaurants, the lake spots the tourists don't find. Our recommendations come from years of exploring these mountains — and we love sharing them with our guests.",
  },
];

const VALUES = [
  {
    icon: Heart,
    title: "Thoughtfulness in Every Detail",
    description:
      "From the linens on the beds to the firewood stacked by the pit, we sweat the small stuff. We think about what would make your morning coffee better, your evening by the fire warmer, and your kids' first lake day unforgettable.",
  },
  {
    icon: ShieldCheck,
    title: "Reliability You Can Count On",
    description:
      "No surprises, no bait-and-switch. The home you see is the home you get — clean, well-maintained, and exactly as described. We do walkthrough inspections before every check-in because we hold ourselves to a higher standard.",
  },
  {
    icon: MessageCircleHeart,
    title: "Hospitality, Not Just Hosting",
    description:
      "There's a difference between renting a house and welcoming someone into one. We answer texts at 10pm, leave local tips in every home, and genuinely want to hear how your stay went. Your vacation matters to us.",
  },
  {
    icon: Users,
    title: "Every Guest Is Family",
    description:
      "Whether you're here for a quiet couples' retreat or a 20-person family reunion, you'll be treated with the same warmth and attention. We remember returning guests, accommodate special requests, and go out of our way to make every group feel at home.",
  },
  {
    icon: Sparkles,
    title: "Commitment to Excellence",
    description:
      "Good enough isn't good enough. We constantly upgrade our properties, refine our processes, and ask ourselves how we can do better. Our 5-star reviews aren't a marketing goal — they're a reflection of a standard we refuse to drop.",
  },
  {
    icon: TreePine,
    title: "Respect for This Place",
    description:
      "The Poconos isn't just where we work — it's where we live and raise our families. We take care of these lakes, trails, and neighborhoods, and we ask our guests to share that respect. Great vacations and good stewardship go hand in hand.",
  },
];

const COMMITMENTS = [
  {
    icon: Clock,
    title: "Fast, Real Responses",
    description: "No chatbots, no call centers. You'll hear back from a real person — usually within minutes, not hours.",
  },
  {
    icon: Home,
    title: "Spotless, Every Time",
    description: "Professional cleaning with our own quality checklist. We inspect before you arrive so you never have to worry.",
  },
  {
    icon: Coffee,
    title: "Stocked & Ready",
    description: "Coffee, essentials, firewood, games, and local guides waiting for you. We think ahead so you can just relax.",
  },
  {
    icon: Gift,
    title: "Personal Touches",
    description: "Celebrating something special? Let us know. We love adding small surprises that make a big trip even bigger.",
  },
  {
    icon: Handshake,
    title: "Honest & Transparent",
    description: "No hidden fees, no fine-print gotchas. What we quote is what you pay. We believe trust is earned, not assumed.",
  },
  {
    icon: Mountain,
    title: "Local Knowledge",
    description: "Every property comes with our curated guide to the Poconos — restaurants, trails, activities, and insider tips you won't find on Google.",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function WhySummitPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      {/* Hero */}
      <div className="relative h-[50vh] min-h-80 max-h-120 overflow-hidden">
        <img
          src="https://a0.muscache.com/im/pictures/ec9df551-d43c-4294-ad20-7d1ba43b4840.jpg?im_w=1200"
          alt="Firepit by the lake at sunset"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

        <div className="absolute inset-0 flex items-end">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-8">
            <Badge variant="secondary" className="mb-3 gap-1.5 text-xs">
              <Heart className="h-3 w-3" />
              Our Story
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              Why Summit Lakeside?
            </h1>
            <p className="text-base text-white/70 mt-3 max-w-xl">
              We're not the biggest rental company in the Poconos — and that's
              the point. Here's what makes staying with us different.
            </p>
          </div>
        </div>
      </div>

      {/* Our Story */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-14 space-y-14">
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10">
              <Star className="h-5.5 w-5.5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Our Story</h2>
              <p className="text-muted-foreground text-sm">
                How a family passion became your perfect getaway
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {OUR_STORY_POINTS.map((point) => (
              <div key={point.title} className="space-y-2">
                <h3 className="text-lg font-semibold">{point.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* Our Values */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10">
              <Heart className="h-5.5 w-5.5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                What We Believe
              </h2>
              <p className="text-muted-foreground text-sm">
                The values behind every stay
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <Card
                  key={value.title}
                  className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-bold text-base">{value.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {value.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <Separator />

        {/* Our Commitment */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10">
              <Handshake className="h-5.5 w-5.5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Our Promise to You
              </h2>
              <p className="text-muted-foreground text-sm">
                What you can expect every time you book with us
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMMITMENTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer CTA */}
      <Separator />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 text-center space-y-4">
        <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/30" />
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
          Ready to experience the difference?
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          Browse our lakefront properties and book your Poconos getaway
          directly — no middlemen, no markup, just us and you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button size="lg" className="gap-2" render={<Link href="/search" />}>
            Browse Properties
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
