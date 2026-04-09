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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [useCode, setUseCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const hasIdentifier = fullName || email.trim() || phone.trim();

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
        if (!hasIdentifier) {
          setError("Please enter at least your name, email, or phone number.");
          setLoading(false);
          return;
        }
        body = { check_in_date: checkInDate, last_name: lastName.trim() };
        if (fullName) body.full_name = fullName;
        if (email.trim()) body.email = email.trim();
        if (phone.trim()) body.phone = phone.trim();
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Summit Lakeside Rentals"
            width={200}
            height={100}
            className="h-16 w-auto invert dark:invert-0"
            priority
          />
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
                  <div className="grid grid-cols-2 gap-3">
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
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
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
                    Enter your last name plus email or phone, along with your
                    check-in date.
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
  );
}
