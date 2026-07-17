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
import { CalendarPlus, CalendarDays, Loader2, Check, PartyPopper, Info, ArrowRight, Clock, Send, DoorClosed } from "lucide-react";
import { timingUpsellTime } from "@/lib/upsells/timing";

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

type ExtendOption = {
  date: string;
  extraNights: number;
  roomRateCents: number;
  taxTotalCents: number;
  totalCents: number;
};

type OptionsData = {
  checkInDate: string;
  currentCheckOutDate: string;
  maxCheckOutDate: string;
  options: ExtendOption[];
};

type DurationOption = { hours: number; time_label: string; price_cents: number };
type LateCheckoutOption = {
  type: string;
  label: string;
  description: string;
  price_cents: number;
  available: boolean;
  purchased?: boolean;
  request_only?: boolean;
  unavailable_reason?: string | null;
  meta?: { duration_options?: DurationOption[] };
};

const SESSION_KEY = "guest-portal-session";
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

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

/** Compact "+$210" / "+$1.9k" for the small calendar cells. */
function compactPrice(cents: number) {
  const dollars = cents / 100;
  if (dollars >= 1000) {
    return `+$${(dollars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `+$${Math.round(dollars)}`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoOf(y: number, m0: number, day: number) {
  return `${y}-${pad(m0 + 1)}-${pad(day)}`;
}
function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}
function firstWeekday(y: number, m0: number) {
  return new Date(y, m0, 1).getDay();
}
function monthLabel(y: number, m0: number) {
  return new Date(y, m0, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function ExtendStayPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [data, setData] = useState<OptionsData | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [selected, setSelected] = useState<ExtendOption | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // Late checkout (a fallback when no nights are open — you can still buy hours)
  const [lateOption, setLateOption] = useState<LateCheckoutOption | null>(null);
  const [lateHours, setLateHours] = useState<number>(1);
  const [lateSelected, setLateSelected] = useState(false);
  const [lateRequesting, setLateRequesting] = useState(false);
  const [lateRequested, setLateRequested] = useState(false);
  const [lateConfirmedTime, setLateConfirmedTime] = useState<string | null>(null);

  // Post-payment states
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<{ newCheckOutDate: string; lateTime?: string | null } | null>(null);

  const fetchLateCheckout = useCallback(async (registrationId: string) => {
    try {
      const res = await fetch("/api/guest/upsells", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ registration_id: registrationId }),
      });
      if (!res.ok) return;
      const resData = await res.json().catch(() => ({}));
      const opt = (resData.upsells || []).find(
        (o: LateCheckoutOption) => o.type === "late_checkout"
      ) as LateCheckoutOption | undefined;
      if (opt) {
        setLateOption(opt);
        const first = opt.meta?.duration_options?.[0]?.hours;
        if (first) setLateHours(first);
      }
    } catch {
      // Non-critical — extending nights still works without the late-checkout add-on.
    }
  }, []);

  const confirmLateCheckout = useCallback(async (registrationId: string, sessionId: string) => {
    setConfirming(true);
    try {
      const res = await fetch("/api/guest/upsells/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ session_id: sessionId, registration_id: registrationId }),
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok && resData.ok) {
        const paid = (resData.upsells || []).find(
          (u: { type: string }) => u.type === "late_checkout"
        );
        setLateConfirmedTime((paid && timingUpsellTime(paid)) || "later than usual");
      } else {
        setError(resData.error || "We couldn't confirm your late checkout. If you were charged, it will be refunded — please contact us.");
      }
    } catch {
      setError("Network error confirming your late checkout. Please contact us.");
    } finally {
      setConfirming(false);
    }
  }, []);

  const confirmExtension = useCallback(async (registrationId: string, sessionId: string) => {
    setConfirming(true);
    try {
      const res = await fetch("/api/guest/extend-stay/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ session_id: sessionId, registration_id: registrationId }),
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok && resData.ok) {
        setConfirmed({ newCheckOutDate: resData.new_check_out_date, lateTime: resData.late_checkout_time ?? null });
        // Reflect the new checkout everywhere the session drives the UI.
        try {
          const raw = sessionStorage.getItem(SESSION_KEY);
          if (raw) {
            const s = JSON.parse(raw);
            if (s?.reservation) {
              s.reservation.check_out_date = resData.new_check_out_date;
              sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
            }
          }
        } catch {
          /* non-critical */
        }
      } else {
        setError(resData.error || "We couldn't confirm your extension. If you were charged, it will be refunded — please contact us.");
      }
    } catch {
      setError("Network error confirming your extension. Please contact us.");
    } finally {
      setConfirming(false);
    }
  }, []);

  const fetchOptions = useCallback(async (registrationId: string) => {
    setOptionsLoading(true);
    setOptionsError("");
    try {
      const res = await fetch("/api/guest/extend-stay/options", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ registration_id: registrationId }),
      });
      const resData = await res.json().catch(() => ({}));
      if (res.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        setOptionsError(resData.error || "Couldn't load available dates. Please try again.");
        return;
      }
      setData(resData as OptionsData);
    } catch {
      setOptionsError("Couldn't load available dates. Please try again.");
    } finally {
      setOptionsLoading(false);
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
    const upsellSuccess = params.get("upsell_success");
    const sessionId = params.get("session_id");
    const cancelled = params.get("extend_cancelled") || params.get("upsell_cancelled");
    if (success && sessionId) {
      confirmExtension(s.reservation.id, sessionId);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (upsellSuccess && sessionId) {
      confirmLateCheckout(s.reservation.id, sessionId);
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      if (cancelled) window.history.replaceState({}, "", window.location.pathname);
      fetchOptions(s.reservation.id);
      fetchLateCheckout(s.reservation.id);
    }
  }, [confirmExtension, confirmLateCheckout, fetchOptions, fetchLateCheckout]);

  // One button, one payment: nights, late checkout, or both. Bundled purchases
  // ride a single Stripe session (the extend-stay checkout route re-quotes and
  // validates both server-side); a late checkout alone uses the upsell path.
  async function handlePay(lateTier: DurationOption | null) {
    if (!session) return;
    const wantsLate = !!lateTier;
    if (!selected && !wantsLate) return;
    setCheckingOut(true);
    try {
      if (selected) {
        const res = await fetch("/api/guest/extend-stay/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
          body: JSON.stringify({
            registration_id: session.reservation.id,
            new_check_out_date: selected.date,
            ...(wantsLate ? { late_checkout_hours: lateTier!.hours } : {}),
          }),
        });
        const resData = await res.json().catch(() => ({}));
        if (res.ok && resData.url) {
          window.location.href = resData.url;
          return;
        }
        if (resData.late_unavailable) {
          // Nights are still fine — drop the add-on and let the guest retry.
          setLateSelected(false);
        }
        setOptionsError(resData.error || "Couldn't start checkout. Please try again.");
      } else {
        const res = await fetch("/api/guest/upsells/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
          body: JSON.stringify({
            registration_id: session.reservation.id,
            items: [
              {
                type: "late_checkout",
                label: `Late Check-Out (until ${lateTier!.time_label})`,
                price_cents: lateTier!.price_cents,
                meta: { hours: lateTier!.hours },
              },
            ],
            return_path: "extend-stay",
          }),
        });
        const resData = await res.json().catch(() => ({}));
        if (res.ok && resData.url) {
          window.location.href = resData.url;
          return;
        }
        setOptionsError(resData.error || "Couldn't start checkout. Please try again.");
      }
    } catch {
      setOptionsError("Network error starting checkout. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleLateRequest() {
    if (!session) return;
    setLateRequesting(true);
    try {
      const res = await fetch("/api/guest/upsells/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ registration_id: session.reservation.id, type: "late_checkout" }),
      });
      if (res.ok) setLateRequested(true);
    } catch {
      // Non-critical
    } finally {
      setLateRequesting(false);
    }
  }

  if (loading || confirming) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {confirming ? "Confirming your payment…" : "Loading…"}
        </p>
      </div>
    );
  }

  // Success screen after a confirmed late checkout.
  if (lateConfirmedTime) {
    return (
      <div className="max-w-md mx-auto space-y-6 text-center py-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
          <Clock className="h-7 w-7 text-green-600" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Late checkout confirmed!</h1>
          <p className="text-muted-foreground text-sm">
            You can now check out as late as <strong className="text-foreground">{lateConfirmedTime}</strong>. A confirmation is on its way.
          </p>
        </div>
        <Link href="/checkin">
          <Button className="w-full">Back to My Booking</Button>
        </Link>
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
            Your new checkout is <strong className="text-foreground">{fmtDate(confirmed.newCheckOutDate)}</strong>
            {confirmed.lateTime ? (
              <> — and you can stay until <strong className="text-foreground">{confirmed.lateTime}</strong> that day.</>
            ) : (
              "."
            )}{" "}
            A confirmation is on its way.
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

  const optMap = new Map((data?.options ?? []).map((o) => [o.date, o]));

  // Today (local) — the calendar drops any week entirely before this one.
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Which months to render: the current month (or check-in's, if the stay hasn't
  // started yet) through the last bookable month — never a fully-past month.
  const months: { y: number; m: number }[] = [];
  if (data) {
    const ciY = Number(data.checkInDate.slice(0, 4));
    const ciM = Number(data.checkInDate.slice(5, 7)) - 1;
    const startInFuture = ciY > now.getFullYear() || (ciY === now.getFullYear() && ciM > now.getMonth());
    let y = startInFuture ? ciY : now.getFullYear();
    let m = startInFuture ? ciM : now.getMonth();
    const lastRef =
      data.maxCheckOutDate >= data.currentCheckOutDate ? data.maxCheckOutDate : data.currentCheckOutDate;
    const loY = Number(lastRef.slice(0, 4));
    const loM = Number(lastRef.slice(5, 7)) - 1;
    while ((y < loY || (y === loY && m <= loM)) && months.length < 4) {
      months.push({ y, m });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }

  function cellState(iso: string): "pre" | "stay" | "option" | "post" {
    if (!data) return "post";
    if (iso < data.checkInDate) return "pre";
    if (iso <= data.currentCheckOutDate) return "stay";
    if (optMap.has(iso)) return "option";
    return "post"; // beyond the last bookable date — greyed out
  }

  const lateTiers = lateOption?.meta?.duration_options ?? [];
  const activeLateTier = lateTiers.find((t) => t.hours === lateHours) ?? lateTiers[0] ?? null;
  const lateBuyable = !!lateOption?.available && !lateOption?.purchased && !!activeLateTier;
  const lateInBasket = lateSelected && lateBuyable;
  const basketTotal = (selected?.totalCents ?? 0) + (lateInBasket ? activeLateTier!.price_cents : 0);
  const canPay = (!!selected || lateInBasket) && !checkingOut;
  const lastBookable = data
    ? data.maxCheckOutDate >= data.currentCheckOutDate
      ? data.maxCheckOutDate
      : data.currentCheckOutDate
    : "";

  return (
    <div className="space-y-4 max-w-5xl mx-auto kiosk-wide kiosk-fill gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarPlus className="h-7 w-7" /> Extend Your Stay
        </h1>
        <p className="text-muted-foreground text-sm">
          Add extra nights, a later checkout, or both — one payment covers everything.
        </p>
      </div>

      {/* Calendar left, basket right. The rail is ALWAYS rendered at a fixed
          width and the calendar's weeks never change, so picking a date recolors
          cells without moving a single pixel of layout. */}
      <div className="grid gap-4 min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <Card className="min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose a new checkout date</CardTitle>
            <CardDescription>
              Tap an available date — the price shown is the total for all added nights.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {optionsLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
              </div>
            )}

            {optionsError && !optionsLoading && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{optionsError}</span>
              </div>
            )}

            {data && !optionsLoading && (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-primary/15 border border-primary/20" /> Your stay
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm border border-primary/50" /> Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-muted" /> Unavailable
                  </span>
                </div>

                {data.options.length === 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>No additional nights are open right after your stay — but a late checkout may still be available on the right.</span>
                  </div>
                )}

                <div className="space-y-5">
                  {months.map(({ y, m }) => {
                    const total = daysInMonth(y, m);
                    const lead = firstWeekday(y, m);
                    const cells: (number | null)[] = [
                      ...Array(lead).fill(null),
                      ...Array.from({ length: total }, (_, i) => i + 1),
                    ];
                    // Keep only the weeks that matter: from this week through the
                    // last bookable date — no dead trailing rows.
                    const weeks: (number | null)[][] = [];
                    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
                    const visibleCells = weeks
                      .filter(
                        (week) =>
                          week.some((day) => day !== null && isoOf(y, m, day) >= todayIso) &&
                          week.some((day) => day !== null && isoOf(y, m, day) <= lastBookable)
                      )
                      .flat();
                    if (visibleCells.length === 0) return null;
                    return (
                      <div key={`${y}-${m}`}>
                        <p className="text-sm font-medium mb-2">{monthLabel(y, m)}</p>
                        <div className="grid grid-cols-7 gap-1.5">
                          {WEEKDAYS.map((d, i) => (
                            <div key={i} className="text-center text-[10px] font-medium text-muted-foreground pb-1">
                              {d}
                            </div>
                          ))}
                          {visibleCells.map((day, i) => {
                            if (day === null) return <div key={i} />;
                            const iso = isoOf(y, m, day);
                            const state = cellState(iso);
                            const opt = optMap.get(iso);
                            const isSelected = selected?.date === iso;
                            const isCheckIn = iso === data.checkInDate;
                            const isCurrentOut = iso === data.currentCheckOutDate;

                            if (state === "option" && opt) {
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setSelected(isSelected ? null : opt)}
                                  className={`aspect-square rounded-md flex flex-col items-center justify-center leading-none transition-colors ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm"
                                      : "border border-primary/50 hover:bg-primary/10"
                                  }`}
                                >
                                  <span className="text-sm font-semibold lg:text-base">{day}</span>
                                  <span
                                    className={`text-[10px] mt-1 lg:text-xs ${
                                      isSelected ? "text-primary-foreground/90" : "text-primary"
                                    }`}
                                  >
                                    {compactPrice(opt.totalCents)}
                                  </span>
                                </button>
                              );
                            }

                            const base = "aspect-square rounded-md flex flex-col items-center justify-center leading-none";
                            if (state === "stay") {
                              return (
                                <div
                                  key={i}
                                  className={`${base} bg-primary/15 text-foreground ${isCheckIn || isCurrentOut ? "ring-1 ring-primary/40" : ""}`}
                                >
                                  <span className="text-sm font-semibold lg:text-base">{day}</span>
                                  {(isCheckIn || isCurrentOut) && (
                                    <span className="text-[9px] uppercase tracking-wide text-primary mt-1">
                                      {isCheckIn ? "In" : "Out"}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div key={i} className={`${base} ${state === "post" ? "bg-muted/40 text-muted-foreground/40" : "text-muted-foreground/30"}`}>
                                <span className="text-sm">{day}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Basket rail — one place to review and pay for everything. */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Your extension
            </CardTitle>
            <CardDescription>
              {fmtDate(session.reservation.check_in_date)} → {fmtDate(session.reservation.check_out_date)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Extra nights line */}
            {selected ? (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {selected.extraNights} extra night{selected.extraNights !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      New checkout {fmtDate(selected.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{fmt(selected.totalCents)}</p>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-xs text-muted-foreground underline underline-offset-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Tap a date on the calendar to add extra nights.
              </div>
            )}

            {/* Late checkout — part of the same basket */}
            {lateOption && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <DoorClosed className="h-4 w-4" /> Late checkout
                  {selected && <span className="text-xs font-normal text-muted-foreground">on {fmtDate(selected.date)}</span>}
                </p>
                {lateOption.purchased ? (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                    <Check className="h-4 w-4 shrink-0" /> Already confirmed for this stay.
                  </div>
                ) : lateBuyable ? (
                  <div className="grid grid-cols-2 gap-2">
                    {lateTiers.map((d) => {
                      const on = lateInBasket && lateHours === d.hours;
                      return (
                        <button
                          key={d.hours}
                          type="button"
                          onClick={() => {
                            if (on) {
                              setLateSelected(false);
                            } else {
                              setLateHours(d.hours);
                              setLateSelected(true);
                            }
                          }}
                          className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                            on ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <Clock className="h-3.5 w-3.5" /> {d.time_label}
                          </span>
                          <span className="block text-xs text-muted-foreground">+{d.hours} hr{d.hours !== 1 ? "s" : ""}</span>
                          <span className="block font-semibold">{fmt(d.price_cents)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : lateOption.request_only ? (
                  <div className="space-y-2">
                    {lateOption.unavailable_reason && (
                      <p className="text-xs text-muted-foreground">{lateOption.unavailable_reason}</p>
                    )}
                    {lateRequested ? (
                      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                        <Check className="h-4 w-4" /> Request sent — we&apos;ll be in touch.
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" disabled={lateRequesting} onClick={handleLateRequest}>
                        {lateRequesting ? (
                          <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending…</>
                        ) : (
                          <><Send className="h-4 w-4 mr-1.5" /> Request late checkout</>
                        )}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {lateOption.unavailable_reason || "Not available for this stay."}
                  </p>
                )}
              </div>
            )}

            {/* Total + one pay button, pinned to the bottom of the rail */}
            <div className="mt-auto space-y-3 border-t pt-4">
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{fmt(basketTotal)}</span>
              </div>
              <Button
                className="w-full"
                size="lg"
                disabled={!canPay}
                onClick={() => handlePay(lateInBasket ? activeLateTier : null)}
              >
                {checkingOut ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Redirecting to checkout…</>
                ) : !selected && !lateInBasket ? (
                  <>Select nights or a late checkout</>
                ) : (
                  <>Pay {fmt(basketTotal)} <ArrowRight className="h-4 w-4 ml-1.5" /></>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Check className="h-3 w-3" /> Cleaning &amp; pet fees already covered.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
