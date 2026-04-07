"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/hooks/use-property";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingCart, Sparkles, X, Clock, Loader2, Check, Flame, BedDouble, UtensilsCrossed, TreePine, Baby, Coffee, DoorOpen, DoorClosed } from "lucide-react";

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
  meta?: {
    dates?: string[];
    num_guests?: number;
    per_guest_cost?: number;
    per_guest_per_day_cost?: number;
    vendor_url?: string;
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

type PurchasedUpsell = {
  type: string;
  label: string;
  price_cents: number;
  status: string;
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

const configTypes = new Set(["private_chef", "luxury_picnic", "breakfast_delivery"]);
function hasConfig(type: string) { return configTypes.has(type); }

const upsellIcons: Record<string, React.ReactNode> = {
  early_checkin: <DoorOpen className="h-5 w-5 text-blue-600" />,
  late_checkout: <DoorClosed className="h-5 w-5 text-blue-600" />,
  new_sheets: <BedDouble className="h-5 w-5 text-purple-600" />,
  firewood: <Flame className="h-5 w-5 text-orange-600" />,
  baby_chair: <Baby className="h-5 w-5 text-pink-500" />,
  private_chef: <UtensilsCrossed className="h-5 w-5 text-amber-600" />,
  luxury_picnic: <TreePine className="h-5 w-5 text-green-600" />,
  breakfast_delivery: <Coffee className="h-5 w-5 text-amber-700" />,
};

export default function AddOnsPage() {
  const property = useProperty();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Upsells
  const [upsellOptions, setUpsellOptions] = useState<UpsellOption[]>([]);
  const [purchasedUpsells, setPurchasedUpsells] = useState<PurchasedUpsell[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);

  // Config state for complex items
  const [chefDate, setChefDate] = useState("");
  const [chefMenu, setChefMenu] = useState("");
  const [picnicDate, setPicnicDate] = useState("");
  const [breakfastDays, setBreakfastDays] = useState<Array<{ date: string; servings: number; time: string }>>([]);
  const [tips, setTips] = useState({ breakfast: "", delivery: "", cleaning: "" });

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      setError("No active session found. Please look up your booking first.");
      setLoading(false);
      return;
    }
    setSession(s);
    loadUpsells(s.reservation.id);

    // Handle Stripe return
    const params = new URLSearchParams(window.location.search);
    const success = params.get("upsell_success");
    const sessionId = params.get("session_id");
    if (success && sessionId) {
      fetch("/api/guest/upsells/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, registration_id: s.reservation.id }),
      }).then((res) => {
        if (res.ok) {
          setCart([]);
          loadUpsells(s.reservation.id);
        }
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
    const cancelled = params.get("upsell_cancelled");
    if (cancelled) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function loadUpsells(registrationId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/guest/upsells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId }),
      });
      const data = await res.json();
      if (res.ok) {
        const options = data.upsells || [];
        setUpsellOptions(options);
        setPurchasedUpsells(data.purchased || []);
      } else {
        console.error("Add-ons API error:", data);
        setError(data?.error || "Could not load add-ons. Please try again.");
      }
    } catch (err) {
      console.error("Add-ons fetch error:", err);
      setError("Could not load add-ons. Please try again.");
    } finally {
      setLoading(false);
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
        headers: { "Content-Type": "application/json" },
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
        <p className="text-sm text-muted-foreground">Loading add-ons...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Add-Ons</h1>
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add-Ons</h1>
        <p className="text-muted-foreground text-sm">
          Enhance your stay with extras and experiences
        </p>
      </div>



      {/* Upsell groups */}
      {[
        { group: "timing", title: "Check-In & Check-Out", description: "Adjust your arrival and departure times", icon: <Clock className="h-5 w-5" /> },
        { group: "convenience", title: "Convenience", description: "Little extras to make your stay easier", icon: <Sparkles className="h-5 w-5" /> },
        { group: "experience", title: "Experiences", description: "Unforgettable moments during your stay", icon: <Sparkles className="h-5 w-5" /> },
      ].map(({ group, title, description, icon }) => {
        const groupOptions = upsellOptions.filter((o) => o.group === group);
        if (groupOptions.length === 0) return null;
        return (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {icon} {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupOptions.map((option) => {
                const inCart = cart.some((c) => c.type === option.type);

                return (
                  <div key={option.type} className="rounded-lg border overflow-hidden">
                    <div className="flex">
                      {option.image && (
                        <div className="w-24 h-24 shrink-0">
                          <img src={option.image} alt={option.label}
                            className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 px-4 py-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-medium text-sm">{option.label}</p>
                            <p className="text-xs text-muted-foreground leading-snug">{option.description}</p>
                          </div>
                          {option.type !== "private_chef" && (
                            <span className="text-sm font-semibold whitespace-nowrap shrink-0">
                              {formatCents(option.price_cents)}
                              {option.meta?.per_guest_cost && (
                                <span className="block text-xs font-normal text-muted-foreground text-right">
                                  {formatCents(option.meta.per_guest_cost)}/guest
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {/* Inline button for simple items */}
                        {option.purchased && (
                          <div className="mt-2">
                            <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
                              <Check className="h-3 w-3 mr-1" /> Purchased
                            </Badge>
                          </div>
                        )}
                        {!option.purchased && option.available && !hasConfig(option.type) && (
                          <div className="mt-2">
                            {inCart ? (
                              <Button type="button" variant="outline" size="sm"
                                onClick={() => {
                                  removeFromCart(option.type);
                                  if (option.type === "firewood") {
                                    setTips((t) => ({ ...t, delivery: "" }));
                                    setCart((prev) => prev.filter((c) => c.type !== "tip_delivery"));
                                  }
                                }}>
                                <X className="h-3 w-3 mr-1" /> Remove
                              </Button>
                            ) : (
                              <Button type="button" variant="secondary" size="sm"
                                className="hover:bg-primary hover:text-primary-foreground transition-colors"
                                onClick={() => addToCart({ type: option.type, label: option.label, price_cents: option.price_cents })}>
                                <ShoppingCart className="h-3 w-3 mr-1" /> Add to cart
                              </Button>
                            )}
                          </div>
                        )}
                        {!option.purchased && !option.available && option.unavailable_reason && (
                          <p className="text-xs text-amber-600 mt-2">{option.unavailable_reason}</p>
                        )}
                      </div>
                    </div>

                    {/* Firewood delivery tip */}
                    {option.type === "firewood" && inCart && (
                      <div className="px-4 pb-3 pt-2 border-t">
                        <div className="space-y-2">
                          <Label className="text-xs">Add a tip for the delivery crew (optional)</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">$</span>
                            <Input
                              type="number" min="0" step="1"
                              value={tips.delivery}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTips({ ...tips, delivery: val });
                                const cents = parseInt(val || "0") * 100;
                                if (cents > 0) {
                                  setCart((prev) => {
                                    const without = prev.filter((c) => c.type !== "tip_delivery");
                                    return [...without, { type: "tip_delivery", label: `Tip — Delivery Crew`, price_cents: cents }];
                                  });
                                } else {
                                  setCart((prev) => prev.filter((c) => c.type !== "tip_delivery"));
                                }
                              }}
                              placeholder="0"
                              className="max-w-24 h-8 text-sm"
                            />
                            {[10, 20, 30].map((amt) => (
                              <Button key={amt} type="button" variant="outline" size="sm" className={`h-8 text-xs ${tips.delivery === String(amt) ? "border-primary bg-primary/5" : ""}`}
                                onClick={() => {
                                  setTips({ ...tips, delivery: String(amt) });
                                  setCart((prev) => {
                                    const without = prev.filter((c) => c.type !== "tip_delivery");
                                    return [...without, { type: "tip_delivery", label: `Tip — Delivery Crew`, price_cents: amt * 100 }];
                                  });
                                }}>
                                ${amt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expandable config for complex items */}
                    {hasConfig(option.type) && !option.purchased && (
                      <div className="px-4 pb-4 pt-2 border-t space-y-3">

                        {/* Private chef config */}
                        {option.type === "private_chef" && option.available && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <Label className="text-xs">Date</Label>
                              <Select value={chefDate} onValueChange={(v) => setChefDate(v ?? "")}>
                                <SelectTrigger><SelectValue placeholder="Select a date" /></SelectTrigger>
                                <SelectContent>
                                  {(option.meta?.dates || []).map((d) => (
                                    <SelectItem key={d} value={d}>
                                      {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Menu</Label>
                              <Select value={chefMenu} onValueChange={(v) => setChefMenu(v ?? "")}>
                                <SelectTrigger><SelectValue placeholder="Select a menu" /></SelectTrigger>
                                <SelectContent>
                                  {(option.meta?.menu_options || []).map((m) => (
                                    <SelectItem key={m.menu} value={m.menu}>
                                      {m.menu} — {formatCents(m.total_price)} total
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {chefMenu && (
                              <div className="rounded-lg bg-muted/50 p-2 text-xs space-y-1">
                                {(() => {
                                  const m = option.meta?.menu_options?.find((o) => o.menu === chefMenu);
                                  if (!m) return null;
                                  return (
                                    <>
                                      <div className="flex justify-between">
                                        <span>Chef fee</span><span>{formatCents(50000)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Ingredients ({option.meta?.num_guests} guests × {formatCents(m.ingredient_cost_per_guest)})</span>
                                        <span>{formatCents(m.total_ingredient_cost)}</span>
                                      </div>
                                      <Separator />
                                      <div className="flex justify-between font-semibold">
                                        <span>Total</span><span>{formatCents(m.total_price)}</span>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Luxury picnic date picker */}
                        {option.type === "luxury_picnic" && option.available && (
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Select value={picnicDate} onValueChange={(v) => setPicnicDate(v ?? "")}>
                              <SelectTrigger><SelectValue placeholder="Select a date" /></SelectTrigger>
                              <SelectContent>
                                {(option.meta?.dates || []).map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Breakfast delivery configurator */}
                        {option.type === "breakfast_delivery" && option.available && (
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Served by <a href={option.meta?.vendor_url as string} target="_blank" rel="noopener noreferrer" className="underline text-primary">Archie&apos;s Corner</a>
                            </p>
                            {(option.meta?.dates || []).map((d) => {
                              const existing = breakfastDays.find((b) => b.date === d);
                              return (
                                <div key={d} className="rounded-lg border p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                      {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                    </span>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!!existing}
                                        className="rounded border-input"
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setBreakfastDays([...breakfastDays, { date: d, servings: Math.max(3, option.meta?.num_guests || 3), time: "8:00 AM" }]);
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
                                          onChange={(e) => {
                                            setBreakfastDays(breakfastDays.map((b) =>
                                              b.date === d ? { ...b, servings: Math.max(3, parseInt(e.target.value) || 3) } : b
                                            ));
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Delivery Time</Label>
                                        <Select
                                          value={existing.time}
                                          onValueChange={(v) => {
                                            setBreakfastDays(breakfastDays.map((b) =>
                                              b.date === d ? { ...b, time: v ?? "8:00 AM" } : b
                                            ));
                                          }}
                                        >
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
                              <>
                                <div className="rounded-lg bg-muted/50 p-2 text-xs space-y-1">
                                  <div className="flex justify-between">
                                    <span>Total servings</span>
                                    <span>{breakfastDays.reduce((s, b) => s + b.servings, 0)} across {breakfastDays.length} day{breakfastDays.length !== 1 ? "s" : ""}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Delivery fee</span>
                                    <span>{formatCents(breakfastDays.length * 500)}</span>
                                  </div>
                                  <div className="flex justify-between font-semibold">
                                    <span>Total</span>
                                    <span>{formatCents(breakfastDays.reduce((s, b) => s + b.servings * (option.meta?.per_guest_per_day_cost as number || 1500), 0) + breakfastDays.length * 500)}</span>
                                  </div>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                  <Label className="text-xs">Add a tip for the breakfast crew (optional)</Label>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">$</span>
                                    <Input
                                      type="number" min="0" step="1"
                                      value={tips.breakfast}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTips({ ...tips, breakfast: val });
                                        const cents = parseInt(val || "0") * 100;
                                        if (cents > 0) {
                                          setCart((prev) => {
                                            const without = prev.filter((c) => c.type !== "tip_breakfast");
                                            return [...without, { type: "tip_breakfast", label: "Tip — Breakfast Crew", price_cents: cents }];
                                          });
                                        } else {
                                          setCart((prev) => prev.filter((c) => c.type !== "tip_breakfast"));
                                        }
                                      }}
                                      placeholder="0"
                                      className="max-w-24 h-8 text-sm"
                                    />
                                    {[10, 20, 30].map((amt) => (
                                      <Button key={amt} type="button" variant="outline" size="sm" className={`h-8 text-xs ${tips.breakfast === String(amt) ? "border-primary bg-primary/5" : ""}`}
                                        onClick={() => {
                                          setTips({ ...tips, breakfast: String(amt) });
                                          setCart((prev) => {
                                            const without = prev.filter((c) => c.type !== "tip_breakfast");
                                            return [...without, { type: "tip_breakfast", label: "Tip — Breakfast Crew", price_cents: amt * 100 }];
                                          });
                                        }}>
                                        ${amt}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Add to cart for config items */}
                        {option.available && hasConfig(option.type) && (
                          <div>
                            {inCart ? (
                              <Button type="button" variant="outline" size="sm"
                                onClick={() => {
                                  removeFromCart(option.type);
                                  if (option.type === "private_chef") { setChefDate(""); setChefMenu(""); }
                                  if (option.type === "luxury_picnic") { setPicnicDate(""); }
                                  if (option.type === "breakfast_delivery") { setBreakfastDays([]); setTips((t) => ({ ...t, breakfast: "" })); setCart((prev) => prev.filter((c) => c.type !== "tip_breakfast")); }
                                }}>
                                <X className="h-3 w-3 mr-1" /> Remove from cart
                              </Button>
                            ) : (
                              <Button type="button" variant="secondary" size="sm"
                                className="hover:bg-primary hover:text-primary-foreground transition-colors"
                                disabled={
                                  (option.type === "private_chef" && (!chefDate || !chefMenu)) ||
                                  (option.type === "luxury_picnic" && !picnicDate) ||
                                  (option.type === "breakfast_delivery" && breakfastDays.length === 0)
                                }
                                onClick={() => {
                                  if (option.type === "private_chef") {
                                    const m = option.meta?.menu_options?.find((o) => o.menu === chefMenu);
                                    if (!m) return;
                                    addToCart({
                                      type: option.type,
                                      label: `Private Chef — ${chefMenu} (${new Date(chefDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
                                      price_cents: m.total_price,
                                      meta: { date: chefDate, menu: chefMenu, num_guests: option.meta?.num_guests },
                                    });
                                  } else if (option.type === "luxury_picnic") {
                                    addToCart({
                                      type: option.type,
                                      label: `Luxury Picnic (${new Date(picnicDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}) — ${option.meta?.num_guests} guests`,
                                      price_cents: option.price_cents,
                                      meta: { date: picnicDate, num_guests: option.meta?.num_guests },
                                    });
                                  } else if (option.type === "breakfast_delivery") {
                                    const totalServings = breakfastDays.reduce((s, b) => s + b.servings, 0);
                                    const perServing = option.meta?.per_guest_per_day_cost as number || 1500;
                                    addToCart({
                                      type: option.type,
                                      label: `Breakfast Delivery — ${totalServings} servings across ${breakfastDays.length} day${breakfastDays.length !== 1 ? "s" : ""}`,
                                      price_cents: totalServings * perServing + breakfastDays.length * 500,
                                      meta: { days: breakfastDays, tip: tips.breakfast ? parseInt(tips.breakfast) * 100 : 0 },
                                    });
                                  }
                                }}>
                                <ShoppingCart className="h-3 w-3 mr-1" /> Add to cart
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Cleaning crew tip */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tip the Cleaning Crew</CardTitle>
          <CardDescription>
            For the team who prepares the property before your arrival and cleans up after checkout. Added to your cart.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number" min="0" step="1"
              value={tips.cleaning}
              onChange={(e) => {
                const val = e.target.value;
                setTips({ ...tips, cleaning: val });
                const cents = parseInt(val || "0") * 100;
                if (cents > 0) {
                  setCart((prev) => {
                    const without = prev.filter((c) => c.type !== "tip_cleaning");
                    return [...without, { type: "tip_cleaning", label: "Tip — Cleaning Crew", price_cents: cents }];
                  });
                } else {
                  setCart((prev) => prev.filter((c) => c.type !== "tip_cleaning"));
                }
              }}
              placeholder="0"
              className="max-w-24 h-8 text-sm"
            />
            {[20, 40, 60, 100].map((amt) => (
              <Button key={amt} type="button" variant="outline" size="sm" className={`h-8 text-xs ${tips.cleaning === String(amt) ? "border-primary bg-primary/5" : ""}`}
                onClick={() => {
                  setTips({ ...tips, cleaning: String(amt) });
                  setCart((prev) => {
                    const without = prev.filter((c) => c.type !== "tip_cleaning");
                    return [...without, { type: "tip_cleaning", label: "Tip — Cleaning Crew", price_cents: amt * 100 }];
                  });
                }}>
                ${amt}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Shopping cart */}
      {cart.length > 0 && (
        <Card className="border-primary sticky bottom-20 md:bottom-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Your Cart
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.map((item) => (
              <div key={item.type} className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCents(item.price_cents)}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => removeFromCart(item.type)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>{formatCents(cart.reduce((sum, i) => sum + i.price_cents, 0))}</span>
            </div>
            <Button className="w-full" size="lg" disabled={checkingOut} onClick={handleCheckout}>
              {checkingOut ? "Redirecting to checkout..." : "Checkout"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
