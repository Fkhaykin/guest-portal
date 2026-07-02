"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getGuestToken } from "@/lib/guest-session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CalendarPlus, CalendarDays, Loader2, Check, PartyPopper, Info, ArrowRight } from "lucide-react";

type SessionData = {
  guestName: string;
  reservation: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    num_guests: number;
    property: { slug: string; name?: string; nickname?: string };
  };
};

type NightlyRate = { date: string; price_cents: number; min_stay: number };

type Quote = {
  currentCheckOutDate: string;
  newCheckOutDate: string;
  extraNights: number;
  nightlyRates: NightlyRate[];
  roomRateCents: number;
  taxTotalCents: number;
  totalCents: number;
};

const SESSION_KEY = "guest-portal-session";

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default function ExtendStayPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newDate, setNewDate] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  // Post-payment states
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<{ newCheckOutDate: string } | null>(null);

  const confirmExtension = useCallback(async (registrationId: string, sessionId: string) => {
    setConfirming(true);
    try {
      const res = await fetch("/api/guest/extend-stay/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ session_id: sessionId, registration_id: registrationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setConfirmed({ newCheckOutDate: data.new_check_out_date });
        // Reflect the new checkout everywhere the session drives the UI.
        try {
          const raw = sessionStorage.getItem(SESSION_KEY);
          if (raw) {
            const s = JSON.parse(raw);
            if (s?.reservation) {
              s.reservation.check_out_date = data.new_check_out_date;
              sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
            }
          }
        } catch {
          /* non-critical */
        }
      } else {
        setError(data.error || "We couldn't confirm your extension. If you were charged, it will be refunded — please contact us.");
      }
    } catch {
      setError("Network error confirming your extension. Please contact us.");
    } finally {
      setConfirming(false);
    }
  }, []);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      setError("No active booking found. Please look up your booking first.");
      setLoading(false);
      return;
    }
    setSession(s);
    setLoading(false);

    const params = new URLSearchParams(window.location.search);
    const success = params.get("extend_success");
    const sessionId = params.get("session_id");
    const cancelled = params.get("extend_cancelled");
    if (success && sessionId) {
      confirmExtension(s.reservation.id, sessionId);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (cancelled) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [confirmExtension]);

  async function fetchQuote(date: string) {
    if (!session) return;
    setQuoting(true);
    setQuoteError("");
    setQuote(null);
    try {
      const res = await fetch("/api/guest/extend-stay/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ registration_id: session.reservation.id, new_check_out_date: date }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        setQuoteError(data.error || "Couldn't price those dates.");
        return;
      }
      setQuote(data as Quote);
    } catch {
      setQuoteError("Couldn't check those dates. Please try again.");
    } finally {
      setQuoting(false);
    }
  }

  function onDateChange(date: string) {
    setNewDate(date);
    setQuote(null);
    setQuoteError("");
    if (session && date && date > session.reservation.check_out_date) {
      fetchQuote(date);
    }
  }

  async function handleExtend() {
    if (!session || !quote) return;
    setCheckingOut(true);
    try {
      const res = await fetch("/api/guest/extend-stay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({
          registration_id: session.reservation.id,
          new_check_out_date: quote.newCheckOutDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setQuoteError(data.error || "Couldn't start checkout. Please try again.");
    } catch {
      setQuoteError("Network error starting checkout. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading || confirming) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {confirming ? "Confirming your extension…" : "Loading…"}
        </p>
      </div>
    );
  }

  // Success screen after a confirmed extension.
  if (confirmed) {
    return (
      <div className="max-w-md mx-auto space-y-6 text-center py-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
          <PartyPopper className="h-7 w-7 text-green-600" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Your stay is extended!</h1>
          <p className="text-muted-foreground text-sm">
            Your new checkout is <strong className="text-foreground">{fmtDate(confirmed.newCheckOutDate)}</strong>. A confirmation is on its way.
          </p>
        </div>
        <Link href="/checkin">
          <Button className="w-full">Back to My Booking</Button>
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Extend Your Stay</h1>
          <p className="text-sm text-destructive">{error}</p>
        </div>
        <Link href="/checkin">
          <Button variant="outline" className="w-full">Back to My Booking</Button>
        </Link>
      </div>
    );
  }

  if (!session) return null;

  const current = session.reservation.check_out_date;
  const minDate = addDays(current, 1);
  const avgNightly =
    quote && quote.nightlyRates.length
      ? Math.round(quote.roomRateCents / quote.nightlyRates.length)
      : 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarPlus className="h-7 w-7" /> Extend Your Stay
        </h1>
        <p className="text-muted-foreground text-sm">
          Not ready to leave? Add extra nights to your trip.
        </p>
      </div>

      {/* Current stay */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Your current stay
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Check-in</p>
            <p className="font-medium">{fmtDate(session.reservation.check_in_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Current checkout</p>
            <p className="font-medium">{fmtDate(current)}</p>
          </div>
        </CardContent>
      </Card>

      {/* New checkout picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Choose a new checkout date</CardTitle>
          <CardDescription>We&apos;ll check availability and price the extra nights.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="date"
            min={minDate}
            value={newDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {quoting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
            </div>
          )}

          {quoteError && !quoting && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{quoteError}</span>
            </div>
          )}

          {quote && !quoting && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {avgNightly > 0 ? `${fmt(avgNightly)} × ${quote.extraNights} night${quote.extraNights !== 1 ? "s" : ""}` : `${quote.extraNights} extra night${quote.extraNights !== 1 ? "s" : ""}`}
                  </span>
                  <span>{fmt(quote.roomRateCents)}</span>
                </div>
                {quote.taxTotalCents > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Taxes</span>
                    <span>{fmt(quote.taxTotalCents)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex items-center justify-between font-semibold">
                  <span>Total for {quote.extraNights} extra night{quote.extraNights !== 1 ? "s" : ""}</span>
                  <span>{fmt(quote.totalCents)}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  New checkout: <strong className="text-foreground">{fmtDate(quote.newCheckOutDate)}</strong>
                </p>
              </div>

              <Button className="w-full" size="lg" disabled={checkingOut} onClick={handleExtend}>
                {checkingOut ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Redirecting to checkout…</>
                ) : (
                  <>Extend &amp; Pay {fmt(quote.totalCents)} <ArrowRight className="h-4 w-4 ml-1.5" /></>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Check className="h-3 w-3" /> Cleaning &amp; pet fees already covered — you only pay for the extra nights.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
