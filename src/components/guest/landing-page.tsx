"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Reservation = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  notes: string | null;
  status: string;
  signature_url: string | null;
  booking_source: string | null;
  property: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    description: string | null;
    cover_image_url: string | null;
    timezone: string;
  };
  lodgify: {
    check_in_time: string | null;
    check_out_time: string | null;
    total_amount: number | null;
    currency_code: string | null;
    source: string | null;
    guest_breakdown: {
      adults: number;
      children: number;
      infants: number;
      pets: number;
    } | null;
  } | null;
};

/* ------------------------------------------------------------------ */
/*  Landing Page                                                       */
/* ------------------------------------------------------------------ */

export function LandingPage({
  onFound,
}: {
  onFound: (data: { guestName: string; reservation: Reservation; guestToken?: string }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [useCode, setUseCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let body: Record<string, string>;

      if (useCode) {
        if (!confirmationCode.trim()) {
          setError("Please enter your confirmation code.");
          setLoading(false);
          return;
        }
        body = { confirmation_code: confirmationCode.trim() };
      } else {
        if (!lastName.trim()) {
          setError("Last name is required.");
          setLoading(false);
          return;
        }
        if (!fullName) {
          setError("Please enter your name.");
          setLoading(false);
          return;
        }
        body = { check_in_date: checkInDate, last_name: lastName.trim(), full_name: fullName };
      }

      const res = await fetch("/api/guest/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        onFound({ guestName: data.guest_name, reservation: data.reservation, guestToken: data.guest_token });
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero / Booking lookup */}
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <a href="https://summitlakeside.com" target="_blank" rel="noopener noreferrer">
              <Image
                src="/logo.png"
                alt="Summit Lakeside Rentals"
                width={200}
                height={100}
                className="h-16 w-auto invert dark:invert-0"
                priority
              />
            </a>
          </div>

          {/* Booking lookup form */}
          <Card>
            <CardHeader>
              <CardTitle>Find Your Booking</CardTitle>
              <CardDescription>
                {useCode
                  ? "Enter your confirmation code to access your guest portal"
                  : "Enter your details to access your guest portal"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {useCode ? (
                  <div className="space-y-2">
                    <Label htmlFor="confirmation-code">Confirmation Code</Label>
                    <Input
                      id="confirmation-code"
                      type="text"
                      placeholder="e.g. 12345678"
                      value={confirmationCode}
                      onChange={(e) => setConfirmationCode(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="first-name">First Name</Label>
                        <Input
                          id="first-name"
                          type="text"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last-name">
                          Last Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="last-name"
                          type="text"
                          placeholder="Smith"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="check-in">Check-in Date</Label>
                      <Input
                        id="check-in"
                        type="date"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter your full name and check-in date to find your
                      reservation.
                    </p>
                  </>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Searching..." : "Find My Booking"}
                </Button>
              </form>
              <button
                type="button"
                className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setUseCode(!useCode);
                  setError(null);
                }}
              >
                {useCode ? "I don\u2019t have a code" : "I have a confirmation code"}
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upscale Experience */}
      <section className="w-full bg-white dark:bg-zinc-950 py-16 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Upscale experience
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Each lakehouse is thoughtfully designed with premium furnishings,
                elegant d&eacute;cor, and modern amenities to ensure a comfortable and
                sophisticated stay. From serene lakeside views to private outdoor
                spaces, every detail is curated for relaxation and indulgence.
                Personalized services and exclusive features, such as gourmet
                kitchens and hot tubs, elevate the guest experience, making Summit
                Lakeside the ideal retreat for those seeking both tranquility and
                luxury.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-amber-500">
                Thoughtful convenience
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                From seamless check-ins to fully stocked essentials, every aspect is
                designed to ensure effortless comfort. Modern amenities like
                high-speed Wi-Fi, smart home features, and curated local
                recommendations make it easy for guests to relax and enjoy their
                time without hassle.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-amber-500">
                What you can expect at Summit
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-zinc-600 dark:text-zinc-400">
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Stocked Linens &amp; Towels</li>
                  <li>Kitchen utensils</li>
                  <li>Toiletries</li>
                  <li>Blankets</li>
                </ul>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>USB outlets</li>
                  <li>Newly Renovated</li>
                  <li>Games &amp; Toys</li>
                  <li>Boats &amp; Kayaks</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="relative w-full aspect-4/5 rounded-lg overflow-hidden">
            <Image
              src="/landing/bathroom.jpg"
              alt="Luxury bathroom with freestanding tub"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* Pet Friendly */}
      <section className="w-full relative overflow-hidden">
        <div className="relative w-full aspect-16/7 min-h-100">
          <Image
            src="/landing/pet-friendly.jpg"
            alt="French bulldog relaxing in living room"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-center px-6 sm:px-12 md:px-20">
            <div className="max-w-lg space-y-3">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
                No need for a dog sitter.
              </h2>
              <p className="text-lg sm:text-xl text-white/90 font-medium">
                Summit Lakeside properties are pet friendly, so you can bring the
                whole family along!
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
