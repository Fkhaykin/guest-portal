"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import {
  Mail,
  MessageCircle,
  ArrowRight,
  CalendarCheck,
  ScrollText,
  HelpCircle,
  Phone,
  MapPin,
  Clock,
  Loader2,
  CheckCircle2,
} from "lucide-react";

const HERO_IMG =
  "https://a0.muscache.com/im/pictures/11d2c493-87e1-4534-acdc-e1ff0f1f5832.jpg?im_w=1920";

const TOPICS = [
  "General inquiry",
  "Booking question",
  "Existing reservation",
  "Group / event booking",
  "Property management",
  "Press / partnership",
] as const;

const QUICK_LINKS = [
  {
    title: "Check availability",
    description:
      "Search our lakehouses by date, guest count, and amenity. Book direct and save.",
    href: "/search",
    cta: "Browse dates",
    icon: CalendarCheck,
  },
  {
    title: "View rental policies",
    description:
      "Check-in times, cancellation, pet policy, and everything else before you book.",
    href: "/#policies",
    cta: "Read policies",
    icon: ScrollText,
  },
  {
    title: "Visit our FAQs",
    description:
      "Quick answers to the most common questions from past and prospective guests.",
    href: "/#faq",
    cta: "Open FAQs",
    icon: HelpCircle,
  },
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, topic, message, website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send message.");
      setSent(true);
      setName("");
      setEmail("");
      setPhone("");
      setTopic(TOPICS[0]);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <SiteNav />

      {/* === HERO === */}
      <section className="relative h-[60vh] min-h-120 overflow-hidden">
        <img
          src={HERO_IMG}
          alt="Lakehouse at sunset"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/40 to-black/80" />

        <div className="absolute inset-0 flex flex-col justify-end pb-16 sm:pb-24 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <Badge
              variant="secondary"
              className="mb-6 gap-1.5 bg-white/15 text-white border border-white/30 backdrop-blur-md px-4 py-1.5"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Contact Us
            </Badge>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white leading-[0.95] max-w-4xl">
              Talk to a real person.
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mt-6 max-w-2xl leading-relaxed">
              Questions about a stay, a property, or anything else? Send us a
              note and we&rsquo;ll get back to you, usually within a few hours.
            </p>
          </div>
        </div>
      </section>

      {/* === QUICK LINKS === */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-10 sm:mb-14">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
              Before you write
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4 leading-[1.05]">
              You might find your answer here first.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.title}
                  href={link.href}
                  className="group relative flex flex-col rounded-2xl border bg-card p-6 sm:p-7 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary mb-5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold leading-snug mb-2">
                    {link.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    {link.description}
                  </p>
                  <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {link.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* === FORM + DETAILS === */}
      <section className="pb-24 sm:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          {/* Form */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border bg-card p-6 sm:p-10 shadow-sm">
              <div className="mb-8">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                  Send us a message
                </h2>
                <p className="text-muted-foreground mt-3 leading-relaxed">
                  Tell us a little about what you&rsquo;re looking for. We&rsquo;ll
                  reply personally.
                </p>
              </div>

              {sent ? (
                <div className="flex flex-col items-center text-center py-10 gap-4">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-bold">Message sent.</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Thanks for reaching out. We&rsquo;ll get back to you at the
                    email you provided, usually within a few hours.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => setSent(false)}
                  >
                    Send another
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Honeypot */}
                  <input
                    type="text"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        Phone{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 555-5555"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="topic">What&rsquo;s this about?</Label>
                      <select
                        id="topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      >
                        {TOPICS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us what you're looking for — dates, group size, special requests, anything helpful."
                      className="min-h-36"
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm px-4 py-3">
                      {error}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                    <p className="text-xs text-muted-foreground leading-relaxed sm:max-w-xs">
                      By sending, you agree to let us email you back about your
                      inquiry. We never share your info.
                    </p>
                    <Button
                      type="submit"
                      size="lg"
                      className="gap-2 min-w-44"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send message
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl border bg-muted/30 p-6 sm:p-8">
              <h3 className="text-lg font-bold mb-6">Other ways to reach us</h3>
              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-background border shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                      Email
                    </div>
                    <a
                      href="mailto:contact@summitlakeside.com"
                      className="text-sm font-medium hover:underline"
                    >
                      contact@summitlakeside.com
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-background border shrink-0">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                      Text or call
                    </div>
                    <p className="text-sm font-medium">
                      We respond fastest over text.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-background border shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                      Hours
                    </div>
                    <p className="text-sm font-medium">
                      Mon – Sun, 8am – 10pm ET
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Active guests: 24/7 support
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-background border shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                      Where we are
                    </div>
                    <p className="text-sm font-medium">
                      The Poconos, Pennsylvania
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border bg-card p-6 sm:p-8">
              <h3 className="text-lg font-bold mb-2">Already a guest?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                If you&rsquo;re mid-stay or have an upcoming reservation, the
                fastest path is to open your booking.
              </p>
              <Button
                variant="outline"
                className="w-full gap-2"
                render={<Link href="/checkin" />}
              >
                Find my booking
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
