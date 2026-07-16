"use client";

import { useState, useEffect } from "react";
import { getGuestToken } from "@/lib/guest-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ShoppingCart, X, Loader2, Check, Send, Trash2, ArrowRight, HandCoins } from "lucide-react";
import { toneBadge } from "@/lib/status-styles";

type UpsellOption = {
  type: string;
  group: string;
  label: string;
  description: string;
  price_cents: number;
  image?: string;
  available: boolean;
  purchased?: boolean;
  unavailable_reason?: string | null;
  request_only?: boolean;
  meta?: {
    dates?: string[];
    num_guests?: number;
    per_guest_cost?: number;
    per_guest_per_day_cost?: number;
    vendor_url?: string;
    duration_options?: Array<{ hours: number; time_label: string; price_cents: number }>;
    menu_options?: Array<{
      menu: string;
      ingredient_cost_per_guest: number;
      total_ingredient_cost: number;
      total_price: number;
    }>;
  };
};

type CartItem = {
  type: string;
  label: string;
  price_cents: number;
  meta?: Record<string, unknown>;
};

type SessionData = {
  guestName: string;
  reservation: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    num_guests: number;
    property: { slug: string };
  };
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

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function fmtDateFull(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const configTypes = new Set(["private_chef", "luxury_picnic", "breakfast_delivery"]);
function hasConfig(type: string) {
  return configTypes.has(type);
}

/** Short price shown on the tile. */
function priceLabel(opt: UpsellOption): string {
  if (opt.meta?.duration_options?.length) return `from ${formatCents(opt.meta.duration_options[0].price_cents)}`;
  if (opt.type === "private_chef") return `from ${formatCents(opt.price_cents)}`;
  if (opt.type === "breakfast_delivery") return `${formatCents(opt.price_cents)}/guest/day`;
  if (opt.meta?.per_guest_cost) return `${formatCents(opt.meta.per_guest_cost)}/guest`;
  return formatCents(opt.price_cents);
}

export default function UpgradesPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [upsellOptions, setUpsellOptions] = useState<UpsellOption[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);

  // Config state for complex items
  const [chefDate, setChefDate] = useState("");
  const [chefMenu, setChefMenu] = useState("");
  const [picnicDate, setPicnicDate] = useState("");
  const [breakfastDays, setBreakfastDays] = useState<Array<{ date: string; servings: number; time: string }>>([]);
  const [timingHours, setTimingHours] = useState<Record<string, number>>({});
  const [tips, setTips] = useState({ breakfast: "", delivery: "", cleaning: "" });
  const [requestSending, setRequestSending] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState<Set<string>>(new Set());

  // Tile → detail modal ("tip_cleaning" is the crew-tip tile), and cart drawer.
  const [openType, setOpenType] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      setError("No active session found. Please look up your booking first.");
      setLoading(false);
      return;
    }
    setSession(s);
    loadUpsells(s.reservation.id);

    const params = new URLSearchParams(window.location.search);
    const success = params.get("upsell_success");
    const sessionId = params.get("session_id");
    if (success && sessionId) {
      fetch("/api/guest/upsells/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ session_id: sessionId, registration_id: s.reservation.id }),
      }).then((res) => {
        if (res.ok) {
          setCart([]);
          loadUpsells(s.reservation.id);
        }
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("upsell_cancelled")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function loadUpsells(registrationId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/guest/upsells", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ registration_id: registrationId }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem(SESSION_KEY);
          window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        const data = await res.json().catch(() => null);
        setError(data?.error || "Could not load upgrades. Please try again.");
        return;
      }
      const data = await res.json();
      setUpsellOptions(data.upsells || []);
    } catch {
      setError("Could not load upgrades. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpsellRequest(type: "early_checkin" | "late_checkout") {
    if (!session) return;
    setRequestSending(type);
    try {
      const res = await fetch("/api/guest/upsells/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ registration_id: session.reservation.id, type }),
      });
      if (res.ok) setRequestSent((prev) => new Set(prev).add(type));
    } catch {
      // Non-critical
    } finally {
      setRequestSending(null);
    }
  }

  function addToCart(item: CartItem) {
    if (cart.some((c) => c.type === item.type)) return;
    setCart([...cart, item]);
  }

  function removeFromCart(type: string) {
    setCart(cart.filter((c) => c.type !== type));
  }

  async function handleCheckout() {
    if (!session || cart.length === 0) return;
    setCheckingOut(true);
    try {
      const res = await fetch("/api/guest/upsells/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({
          registration_id: session.reservation.id,
          items: cart,
          return_path: "add-ons",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) window.location.href = data.url;
      }
    } catch {
      // Handle error
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading upgrades...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Upgrades</h1>
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  const selected = openType && openType !== "tip_cleaning" ? upsellOptions.find((o) => o.type === openType) ?? null : null;
  const inCart = (type: string) => cart.some((c) => c.type === type);
  const cartTotal = cart.reduce((sum, i) => sum + i.price_cents, 0);

  // The config UI for a single upgrade, rendered inside the detail modal.
  function renderConfig(opt: UpsellOption) {
    const cartHas = inCart(opt.type);

    if (opt.purchased) {
      return (
        <Badge variant="secondary" className={`border-transparent ${toneBadge("success")}`}>
          <Check className="h-3 w-3 mr-1" /> Already purchased
        </Badge>
      );
    }

    // Timing tiers (early check-in / late check-out)
    if (opt.meta?.duration_options && opt.available) {
      const durations = opt.meta.duration_options;
      const selectedHours = timingHours[opt.type] ?? durations[0].hours;
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {durations.map((d) => {
              const sel = selectedHours === d.hours;
              return (
                <button
                  key={d.hours}
                  type="button"
                  disabled={cartHas}
                  onClick={() => setTimingHours((prev) => ({ ...prev, [opt.type]: d.hours }))}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-60 ${sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <span className="block font-medium">+{d.hours} hr{d.hours !== 1 ? "s" : ""} · {d.time_label}</span>
                  <span className="block font-semibold">{formatCents(d.price_cents)}</span>
                </button>
              );
            })}
          </div>
          {cartHas ? (
            <Button variant="outline" className="w-full" onClick={() => removeFromCart(opt.type)}>
              <X className="h-4 w-4 mr-1" /> Remove from cart
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => {
                const tier = durations.find((d) => d.hours === selectedHours) || durations[0];
                addToCart({ type: opt.type, label: `${opt.label} (${tier.time_label})`, price_cents: tier.price_cents, meta: { hours: tier.hours } });
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-1" /> Add to cart
            </Button>
          )}
        </div>
      );
    }

    // Request-only timing (turnover too tight to sell outright)
    if (opt.request_only && !opt.available) {
      return (
        <div className="space-y-2">
          {opt.unavailable_reason && <p className="text-sm text-muted-foreground">{opt.unavailable_reason}</p>}
          {requestSent.has(opt.type) ? (
            <Badge variant="secondary" className={`border-transparent ${toneBadge("success")}`}>
              <Check className="h-3 w-3 mr-1" /> Request sent
            </Badge>
          ) : (
            <Button
              variant="outline"
              disabled={requestSending === opt.type}
              onClick={() => handleUpsellRequest(opt.type as "early_checkin" | "late_checkout")}
            >
              {requestSending === opt.type ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-1" /> Request {opt.type === "early_checkin" ? "Early Check-In" : "Late Check-Out"}</>
              )}
            </Button>
          )}
        </div>
      );
    }

    // Private chef
    if (opt.type === "private_chef" && opt.available) {
      const m = opt.meta?.menu_options?.find((o) => o.menu === chefMenu);
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Select value={chefDate} onValueChange={(v) => setChefDate(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Select a date" /></SelectTrigger>
              <SelectContent>
                {(opt.meta?.dates || []).map((d) => (
                  <SelectItem key={d} value={d}>{fmtDateFull(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Menu</Label>
            <Select value={chefMenu} onValueChange={(v) => setChefMenu(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Select a menu" /></SelectTrigger>
              <SelectContent>
                {(opt.meta?.menu_options || []).map((mo) => (
                  <SelectItem key={mo.menu} value={mo.menu}>{mo.menu} — {formatCents(mo.total_price)} total</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {m && (
            <div className="rounded-lg bg-muted/50 p-2 text-xs space-y-1">
              <div className="flex justify-between"><span>Chef fee</span><span>{formatCents(50000)}</span></div>
              <div className="flex justify-between">
                <span>Ingredients ({opt.meta?.num_guests} guests × {formatCents(m.ingredient_cost_per_guest)})</span>
                <span>{formatCents(m.total_ingredient_cost)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCents(m.total_price)}</span></div>
            </div>
          )}
          {cartHas ? (
            <Button variant="outline" className="w-full" onClick={() => { removeFromCart("private_chef"); setChefDate(""); setChefMenu(""); }}>
              <X className="h-4 w-4 mr-1" /> Remove from cart
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={!chefDate || !chefMenu}
              onClick={() => {
                if (!m) return;
                addToCart({ type: "private_chef", label: `Private Chef — ${chefMenu} (${fmtDateShort(chefDate)})`, price_cents: m.total_price, meta: { date: chefDate, menu: chefMenu, num_guests: opt.meta?.num_guests } });
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-1" /> Add to cart
            </Button>
          )}
        </div>
      );
    }

    // Luxury picnic
    if (opt.type === "luxury_picnic" && opt.available) {
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Select value={picnicDate} onValueChange={(v) => setPicnicDate(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Select a date" /></SelectTrigger>
              <SelectContent>
                {(opt.meta?.dates || []).map((d) => (
                  <SelectItem key={d} value={d}>{fmtDateFull(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cartHas ? (
            <Button variant="outline" className="w-full" onClick={() => { removeFromCart("luxury_picnic"); setPicnicDate(""); }}>
              <X className="h-4 w-4 mr-1" /> Remove from cart
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={!picnicDate}
              onClick={() => addToCart({ type: "luxury_picnic", label: `Luxury Picnic (${fmtDateShort(picnicDate)}) — ${opt.meta?.num_guests} guests`, price_cents: opt.price_cents, meta: { date: picnicDate, num_guests: opt.meta?.num_guests } })}
            >
              <ShoppingCart className="h-4 w-4 mr-1" /> Add to cart
            </Button>
          )}
        </div>
      );
    }

    // Breakfast delivery configurator
    if (opt.type === "breakfast_delivery" && opt.available) {
      const perServing = (opt.meta?.per_guest_per_day_cost as number) || 1500;
      const totalServings = breakfastDays.reduce((s, b) => s + b.servings, 0);
      return (
        <div className="space-y-3">
          {opt.meta?.vendor_url && (
            <p className="text-xs text-muted-foreground">
              Served by{" "}
              <a href={opt.meta.vendor_url} target="_blank" rel="noopener noreferrer" className="underline text-primary">Archie&apos;s Corner</a>
            </p>
          )}
          {(opt.meta?.dates || []).map((d) => {
            const existing = breakfastDays.find((b) => b.date === d);
            return (
              <div key={d} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{fmtDateFull(d)}</span>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!existing}
                      className="rounded border-input"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBreakfastDays([...breakfastDays, { date: d, servings: Math.max(3, opt.meta?.num_guests || 3), time: "8:00 AM" }]);
                        } else {
                          setBreakfastDays(breakfastDays.filter((b) => b.date !== d));
                        }
                      }}
                    />
                    Order
                  </label>
                </div>
                {existing && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Servings</Label>
                      <Input
                        type="number" min={3} max={20}
                        value={existing.servings}
                        onChange={(e) => setBreakfastDays(breakfastDays.map((b) => b.date === d ? { ...b, servings: Math.max(3, parseInt(e.target.value) || 3) } : b))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Delivery Time</Label>
                      <Select value={existing.time} onValueChange={(v) => setBreakfastDays(breakfastDays.map((b) => b.date === d ? { ...b, time: v ?? "8:00 AM" } : b))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {breakfastDays.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span>Total servings</span>
                <span>{totalServings} across {breakfastDays.length} day{breakfastDays.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between"><span>Delivery fee</span><span>{formatCents(breakfastDays.length * 500)}</span></div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCents(totalServings * perServing + breakfastDays.length * 500)}</span>
              </div>
            </div>
          )}
          {breakfastDays.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Add a tip for the breakfast crew (optional)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  type="number" min="0" step="1" value={tips.breakfast}
                  onChange={(e) => setTips({ ...tips, breakfast: e.target.value })}
                  placeholder="0" className="max-w-24 h-8 text-sm"
                />
                {[10, 20, 30].map((amt) => (
                  <Button key={amt} type="button" variant="outline" size="sm" className={`h-8 text-xs ${tips.breakfast === String(amt) ? "border-primary bg-primary/5" : ""}`} onClick={() => setTips({ ...tips, breakfast: String(amt) })}>${amt}</Button>
                ))}
              </div>
            </div>
          )}
          {cartHas ? (
            <Button variant="outline" className="w-full" onClick={() => { removeFromCart("breakfast_delivery"); setBreakfastDays([]); setTips((t) => ({ ...t, breakfast: "" })); }}>
              <X className="h-4 w-4 mr-1" /> Remove from cart
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={breakfastDays.length === 0}
              onClick={() => addToCart({ type: "breakfast_delivery", label: `Breakfast Delivery — ${totalServings} servings across ${breakfastDays.length} day${breakfastDays.length !== 1 ? "s" : ""}`, price_cents: totalServings * perServing + breakfastDays.length * 500, meta: { days: breakfastDays, tip: tips.breakfast ? parseInt(tips.breakfast) * 100 : 0 } })}
            >
              <ShoppingCart className="h-4 w-4 mr-1" /> Add to cart
            </Button>
          )}
        </div>
      );
    }

    // Simple items (new sheets, baby chair, firewood)
    if (opt.available && !hasConfig(opt.type)) {
      return (
        <div className="space-y-3">
          {cartHas ? (
            <Button
              variant="outline" className="w-full"
              onClick={() => {
                removeFromCart(opt.type);
                if (opt.type === "firewood") {
                  setTips((t) => ({ ...t, delivery: "" }));
                  setCart((prev) => prev.filter((c) => c.type !== "tip_delivery"));
                }
              }}
            >
              <X className="h-4 w-4 mr-1" /> Remove from cart
            </Button>
          ) : (
            <Button className="w-full" onClick={() => addToCart({ type: opt.type, label: opt.label, price_cents: opt.price_cents })}>
              <ShoppingCart className="h-4 w-4 mr-1" /> Add to cart · {formatCents(opt.price_cents)}
            </Button>
          )}

          {opt.type === "firewood" && cartHas && (
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs">Add a tip for the delivery crew (optional)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  type="number" min="0" step="1" value={tips.delivery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTips({ ...tips, delivery: val });
                    const cents = parseInt(val || "0") * 100;
                    setCart((prev) => {
                      const without = prev.filter((c) => c.type !== "tip_delivery");
                      return cents > 0 ? [...without, { type: "tip_delivery", label: "Tip — Delivery Crew", price_cents: cents }] : without;
                    });
                  }}
                  placeholder="0" className="max-w-24 h-8 text-sm"
                />
                {[10, 20, 30].map((amt) => (
                  <Button
                    key={amt} type="button" variant="outline" size="sm"
                    className={`h-8 text-xs ${tips.delivery === String(amt) ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => {
                      setTips({ ...tips, delivery: String(amt) });
                      setCart((prev) => [...prev.filter((c) => c.type !== "tip_delivery"), { type: "tip_delivery", label: "Tip — Delivery Crew", price_cents: amt * 100 }]);
                    }}
                  >
                    ${amt}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (!opt.available && opt.unavailable_reason) {
      return <p className="text-sm text-amber-600">{opt.unavailable_reason}</p>;
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header + cart button */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upgrades</h1>
          <p className="text-muted-foreground text-sm">Tap an upgrade to see details and add it to your cart.</p>
        </div>
        <Button variant="outline" className="relative shrink-0" onClick={() => setCartOpen(true)}>
          <ShoppingCart className="h-4 w-4" />
          Cart
          {cart.length > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
              {cart.length}
            </span>
          )}
        </Button>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {upsellOptions.map((opt) => {
          const cartHas = inCart(opt.type);
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => setOpenType(opt.type)}
              className="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-shadow hover:shadow-md"
            >
              {opt.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={opt.image} alt={opt.label} className="aspect-4/3 w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-3">
                <p className="text-sm font-medium leading-tight">{opt.label}</p>
                <p className="mt-1.5 text-sm font-semibold text-muted-foreground">{priceLabel(opt)}</p>
              </div>
              {opt.purchased && (
                <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                  Purchased
                </span>
              )}
              {!opt.purchased && cartHas && (
                <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                  In cart
                </span>
              )}
            </button>
          );
        })}

        {/* Tip the cleaning crew — a tile of its own */}
        <button
          type="button"
          onClick={() => setOpenType("tip_cleaning")}
          className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card p-4 text-center transition-shadow hover:shadow-md"
        >
          <HandCoins className="h-8 w-8 text-primary" />
          <p className="text-sm font-medium leading-tight">Tip the Cleaning Crew</p>
          {inCart("tip_cleaning") && (
            <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">In cart</span>
          )}
        </button>
      </div>

      {/* Detail modal */}
      <Dialog open={!!openType} onOpenChange={(o) => { if (!o) setOpenType(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {openType === "tip_cleaning" ? (
            <>
              <DialogHeader>
                <DialogTitle>Tip the Cleaning Crew</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                For the team who prepares the property before your arrival and cleans up after checkout.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number" min="0" step="1" value={tips.cleaning}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTips({ ...tips, cleaning: val });
                    const cents = parseInt(val || "0") * 100;
                    setCart((prev) => {
                      const without = prev.filter((c) => c.type !== "tip_cleaning");
                      return cents > 0 ? [...without, { type: "tip_cleaning", label: "Tip — Cleaning Crew", price_cents: cents }] : without;
                    });
                  }}
                  placeholder="0" className="max-w-24 h-9 text-sm"
                />
                {[20, 40, 60, 100].map((amt) => (
                  <Button
                    key={amt} type="button" variant="outline" size="sm"
                    className={`h-9 text-xs ${tips.cleaning === String(amt) ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => {
                      setTips({ ...tips, cleaning: String(amt) });
                      setCart((prev) => [...prev.filter((c) => c.type !== "tip_cleaning"), { type: "tip_cleaning", label: "Tip — Cleaning Crew", price_cents: amt * 100 }]);
                    }}
                  >
                    ${amt}
                  </Button>
                ))}
              </div>
              {inCart("tip_cleaning") && (
                <p className="flex items-center gap-1 text-sm text-emerald-600">
                  <Check className="h-4 w-4" /> Added to your cart.
                </p>
              )}
            </>
          ) : selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.label}</DialogTitle>
              </DialogHeader>
              {selected.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.image} alt={selected.label} className="aspect-video w-full rounded-lg object-cover" />
              )}
              <p className="text-sm text-muted-foreground">{selected.description}</p>
              {renderConfig(selected)}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Cart drawer */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Your Cart
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Your cart is empty. Tap an upgrade to add it.
              </p>
            ) : (
              <div className="space-y-3 py-4">
                {cart.map((item) => (
                  <div key={item.type} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">{item.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-medium">{formatCents(item.price_cents)}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.type)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <SheetFooter className="border-t">
              <div className="w-full space-y-3 pt-2">
                <div className="flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCents(cartTotal)}</span>
                </div>
                <Button className="w-full" size="lg" disabled={checkingOut} onClick={handleCheckout}>
                  {checkingOut ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Redirecting to checkout…</>
                  ) : (
                    <>Checkout {formatCents(cartTotal)} <ArrowRight className="h-4 w-4 ml-1.5" /></>
                  )}
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
