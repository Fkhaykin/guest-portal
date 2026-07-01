"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X, Sparkles } from "lucide-react";
import {
  type Offer,
  type OfferKind,
  type PromoConditions,
  type Promo,
  normalizePromo,
  UPSELL_OPTIONS,
} from "@/lib/promo/types";
import { ACCENTS, summarySentence, headlineFromOffers, offerLabel } from "@/lib/promo/display";

const ACCENT_SWATCH: Record<string, string> = {
  emerald: "bg-emerald-400",
  indigo: "bg-indigo-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  orange: "bg-orange-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  slate: "bg-slate-400",
};

const EMOJI_CHOICES = ["🎁", "🌿", "🌙", "✨", "🎂", "🛒", "🔥", "🏷️", "💎", "☀️", "❄️", "🥂"];
const DOW = [
  { v: 0, l: "Sun" },
  { v: 1, l: "Mon" },
  { v: 2, l: "Tue" },
  { v: 3, l: "Wed" },
  { v: 4, l: "Thu" },
  { v: 5, l: "Fri" },
  { v: 6, l: "Sat" },
];

const OFFER_KINDS: { kind: OfferKind; label: string }[] = [
  { kind: "percent_off", label: "% off" },
  { kind: "amount_off", label: "$ off" },
  { kind: "free_nights", label: "Free nights" },
  { kind: "free_cleaning", label: "Free cleaning" },
  { kind: "free_pet_fee", label: "Free pet fee" },
  { kind: "free_upsell", label: "Free add-on" },
  { kind: "percent_off_upsell", label: "% off add-on" },
  { kind: "perk", label: "Perk (display only)" },
];

function defaultOffer(kind: OfferKind): Offer {
  switch (kind) {
    case "percent_off": return { kind, value: 10, applies_to: "room" };
    case "amount_off": return { kind, cents: 5000, applies_to: "total" };
    case "free_nights": return { kind, count: 1, scope: "any" };
    case "free_cleaning": return { kind };
    case "free_pet_fee": return { kind };
    case "free_upsell": return { kind, upsell_type: UPSELL_OPTIONS[0].type };
    case "percent_off_upsell": return { kind, upsell_type: UPSELL_OPTIONS[0].type, value: 50 };
    case "perk": return { kind, label: "" };
  }
}

type Draft = {
  id?: string;
  title: string;
  description: string;
  emoji: string;
  accent: string;
  redemption: "auto" | "code";
  code: string;
  stackable: boolean;
  scope: "this" | "global";
  offers: Offer[];
  conditions: PromoConditions;
  terms: string;
  show_on_marketing: boolean;
  featured: boolean;
  sort_order: string;
  valid_from: string;
  valid_until: string;
  max_uses: string;
  max_uses_per_guest: string;
};

function emptyDraft(): Draft {
  return {
    title: "",
    description: "",
    emoji: "🎁",
    accent: "emerald",
    redemption: "code",
    code: "",
    stackable: false,
    scope: "this",
    offers: [],
    conditions: {},
    terms: "",
    show_on_marketing: true,
    featured: false,
    sort_order: "0",
    valid_from: "",
    valid_until: "",
    max_uses: "",
    max_uses_per_guest: "",
  };
}

function draftFromPromo(p: Promo): Draft {
  return {
    id: p.id,
    title: p.title ?? "",
    description: p.description ?? "",
    emoji: p.emoji ?? "🎁",
    accent: p.accent ?? "emerald",
    redemption: p.auto_apply ? "auto" : "code",
    code: p.code ?? "",
    stackable: p.stackable,
    scope: p.property_id || (p.property_ids && p.property_ids.length) ? "this" : "global",
    offers: p.offers ?? [],
    conditions: p.conditions ?? {},
    terms: (p.terms ?? []).join("\n"),
    show_on_marketing: p.show_on_marketing,
    featured: p.featured,
    sort_order: String(p.sort_order ?? 0),
    valid_from: p.valid_from?.split("T")[0] ?? "",
    valid_until: p.valid_until?.split("T")[0] ?? "",
    max_uses: p.max_uses != null ? String(p.max_uses) : "",
    max_uses_per_guest: p.max_uses_per_guest != null ? String(p.max_uses_per_guest) : "",
  };
}

function cleanConditions(c: PromoConditions): PromoConditions {
  const out: PromoConditions = {};
  if (c.min_nights) out.min_nights = c.min_nights;
  if (c.max_nights) out.max_nights = c.max_nights;
  if (c.min_guests) out.min_guests = c.min_guests;
  if (c.max_guests) out.max_guests = c.max_guests;
  if (c.stay_start_after) out.stay_start_after = c.stay_start_after;
  if (c.stay_start_before) out.stay_start_before = c.stay_start_before;
  if (c.checkin_days && c.checkin_days.length) out.checkin_days = c.checkin_days;
  if (c.weeknights_only) out.weeknights_only = true;
  if (c.guest_type && c.guest_type !== "any") out.guest_type = c.guest_type;
  if (c.min_spend_cents) out.min_spend_cents = c.min_spend_cents;
  return out;
}

export default function AdminPromosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  async function load() {
    const { data } = await supabase
      .from("promo_code")
      .select("*")
      .or(`property_id.eq.${id},property_id.is.null`)
      .order("sort_order")
      .order("created_at", { ascending: false });
    setPromos(((data as Record<string, unknown>[]) ?? []).map(normalizePromo));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openNew() {
    setDraft(emptyDraft());
    setDialogOpen(true);
  }
  function openEdit(p: Promo) {
    setDraft(draftFromPromo(p));
    setDialogOpen(true);
  }

  async function save() {
    const payload = {
      property_id: draft.scope === "this" ? id : null,
      property_ids: draft.scope === "this" ? [id] : null,
      code: draft.redemption === "code" ? draft.code.toUpperCase().trim() || null : null,
      auto_apply: draft.redemption === "auto",
      stackable: draft.stackable,
      offers: draft.offers,
      conditions: cleanConditions(draft.conditions),
      title: draft.title || null,
      description: draft.description || null,
      emoji: draft.emoji || null,
      accent: draft.accent || null,
      terms: draft.terms.split("\n").map((t) => t.trim()).filter(Boolean),
      show_on_marketing: draft.show_on_marketing,
      featured: draft.featured,
      sort_order: parseInt(draft.sort_order) || 0,
      valid_from: draft.valid_from || null,
      valid_until: draft.valid_until || null,
      max_uses: draft.max_uses ? parseInt(draft.max_uses) : null,
      max_uses_per_guest: draft.max_uses_per_guest ? parseInt(draft.max_uses_per_guest) : null,
      is_active: true,
    };
    if (draft.id) {
      await supabase.from("promo_code").update(payload).eq("id", draft.id);
    } else {
      await supabase.from("promo_code").insert(payload);
    }
    setDialogOpen(false);
    load();
  }

  async function remove(promoId: string) {
    if (!confirm("Delete this promo?")) return;
    await supabase.from("promo_code").delete().eq("id", promoId);
    load();
  }
  async function toggle(p: Promo) {
    await supabase.from("promo_code").update({ is_active: !p.is_active }).eq("id", p.id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Promos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            One builder for every offer — codes, automatic discounts, free nights, add-ons, and marketing perks.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={openNew} />}>
            <Plus className="h-4 w-4 mr-1" /> New Promo
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Edit Promo" : "Build a Promo"}</DialogTitle>
            </DialogHeader>
            <PromoBuilder draft={draft} setDraft={setDraft} onSave={save} />
          </DialogContent>
        </Dialog>
      </div>

      {promos.length > 0 ? (
        <div className="grid gap-3">
          {promos.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{p.emoji ?? "🎁"}</span>
                    <span className="truncate">{p.title || (p.code ?? "Untitled promo")}</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {summarySentence({ offers: p.offers, conditions: p.conditions, auto_apply: p.auto_apply, stackable: p.stackable, code: p.code })}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge
                      variant={p.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggle(p)}
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {p.code && <Badge variant="outline" className="font-mono">{p.code}</Badge>}
                    {p.auto_apply && <Badge variant="outline">Auto</Badge>}
                    {p.stackable && <Badge variant="outline">Stackable</Badge>}
                    {!p.property_id && <Badge variant="outline">Global</Badge>}
                    {p.show_on_marketing && <Badge variant="outline">On promos page</Badge>}
                    {p.max_uses != null && (
                      <Badge variant="outline">{p.times_used}/{p.max_uses} used</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No promos yet. Build your first one.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builder form
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function PromoBuilder({
  draft,
  setDraft,
  onSave,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setCond = (patch: Partial<PromoConditions>) => set({ conditions: { ...draft.conditions, ...patch } });

  const numCond = (v: number | undefined) => (v == null ? "" : String(v));
  const addOffer = (kind: OfferKind) => set({ offers: [...draft.offers, defaultOffer(kind)] });
  const updateOffer = (i: number, offer: Offer) =>
    set({ offers: draft.offers.map((o, j) => (j === i ? offer : o)) });
  const removeOffer = (i: number) => set({ offers: draft.offers.filter((_, j) => j !== i) });

  const headline = headlineFromOffers(draft.offers);

  return (
    <div className="space-y-4">
      {/* Identity */}
      <Section title="Identity">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Midweek Escape" />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Sunday–Thursday stays, third night on us." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => set({ emoji: e })}
                  className={`h-8 w-8 rounded-md border text-lg leading-none ${draft.emoji === e ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Accent</Label>
            <div className="flex flex-wrap gap-1.5">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set({ accent: a })}
                  className={`h-7 w-7 rounded-full ${ACCENT_SWATCH[a]} ${draft.accent === a ? "ring-2 ring-offset-2 ring-foreground/40" : ""}`}
                  aria-label={a}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Redemption */}
      <Section title="How guests get it">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => set({ redemption: "auto" })}
            className={`rounded-lg border p-3 text-left text-sm ${draft.redemption === "auto" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <span className="font-medium">Automatic</span>
            <span className="block text-xs text-muted-foreground">Applies when conditions are met — no code.</span>
          </button>
          <button
            type="button"
            onClick={() => set({ redemption: "code" })}
            className={`rounded-lg border p-3 text-left text-sm ${draft.redemption === "code" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <span className="font-medium">Code</span>
            <span className="block text-xs text-muted-foreground">Guest enters a code at checkout.</span>
          </button>
        </div>
        {draft.redemption === "code" && (
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input value={draft.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="SUMMER20" className="uppercase font-mono" />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={draft.stackable} onCheckedChange={(c) => set({ stackable: c === true })} />
          Stackable — can combine with other stackable promos
        </label>
        <div className="space-y-1.5">
          <Label>Applies to</Label>
          <Select value={draft.scope} onValueChange={(v) => set({ scope: (v as "this" | "global") ?? "this" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this">This property only</SelectItem>
              <SelectItem value="global">All properties (global)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* Offers */}
      <Section title="Offers — stack as many as you like">
        {draft.offers.length === 0 && (
          <p className="text-xs text-muted-foreground">No offers yet. Add one or more below.</p>
        )}
        <div className="space-y-2">
          {draft.offers.map((offer, i) => (
            <OfferEditor key={i} offer={offer} onChange={(o) => updateOffer(i, o)} onRemove={() => removeOffer(i)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {OFFER_KINDS.map((k) => (
            <Button key={k.kind} type="button" variant="outline" size="sm" onClick={() => addOffer(k.kind)}>
              <Plus className="h-3 w-3 mr-1" /> {k.label}
            </Button>
          ))}
        </div>
      </Section>

      {/* Conditions */}
      <Section title="Conditions — all must be met (optional)">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Min nights" value={numCond(draft.conditions.min_nights)} onChange={(n) => setCond({ min_nights: n })} />
          <NumberField label="Max nights" value={numCond(draft.conditions.max_nights)} onChange={(n) => setCond({ max_nights: n })} />
          <NumberField label="Min guests" value={numCond(draft.conditions.min_guests)} onChange={(n) => setCond({ min_guests: n })} />
          <NumberField label="Max guests" value={numCond(draft.conditions.max_guests)} onChange={(n) => setCond({ max_guests: n })} />
          <div className="space-y-1.5">
            <Label className="text-xs">Stay starts on/after</Label>
            <Input type="date" value={draft.conditions.stay_start_after ?? ""} onChange={(e) => setCond({ stay_start_after: e.target.value || undefined })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Stay starts on/before</Label>
            <Input type="date" value={draft.conditions.stay_start_before ?? ""} onChange={(e) => setCond({ stay_start_before: e.target.value || undefined })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Min spend ($)</Label>
            <Input
              type="number"
              min={0}
              value={draft.conditions.min_spend_cents != null ? String(draft.conditions.min_spend_cents / 100) : ""}
              onChange={(e) => setCond({ min_spend_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Guest</Label>
            <Select value={draft.conditions.guest_type ?? "any"} onValueChange={(v) => setCond({ guest_type: (v as PromoConditions["guest_type"]) ?? "any" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any guest</SelectItem>
                <SelectItem value="first_time">First-time only</SelectItem>
                <SelectItem value="returning">Returning only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Check-in days</Label>
          <div className="flex flex-wrap gap-1">
            {DOW.map((d) => {
              const active = (draft.conditions.checkin_days ?? []).includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => {
                    const cur = draft.conditions.checkin_days ?? [];
                    setCond({ checkin_days: active ? cur.filter((x) => x !== d.v) : [...cur, d.v].sort() });
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs ${active ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={draft.conditions.weeknights_only ?? false} onCheckedChange={(c) => setCond({ weeknights_only: c === true ? true : undefined })} />
          Weeknight stays only (every night Sun–Thu)
        </label>
      </Section>

      {/* Limits */}
      <Section title="Limits & window">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Valid from</Label>
            <Input type="date" value={draft.valid_from} onChange={(e) => set({ valid_from: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valid until</Label>
            <Input type="date" value={draft.valid_until} onChange={(e) => set({ valid_until: e.target.value })} />
          </div>
          <NumberField label="Max total uses" value={draft.max_uses} onChange={(n) => set({ max_uses: n == null ? "" : String(n) })} placeholder="Unlimited" />
          <NumberField label="Max uses / guest" value={draft.max_uses_per_guest} onChange={(n) => set({ max_uses_per_guest: n == null ? "" : String(n) })} placeholder="Unlimited" />
        </div>
      </Section>

      {/* Presentation */}
      <Section title="Marketing page">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={draft.show_on_marketing} onCheckedChange={(c) => set({ show_on_marketing: c === true })} />
          Show this on the guest promotions page
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={draft.featured} onCheckedChange={(c) => set({ featured: c === true })} />
          Featured
        </label>
        <div className="space-y-1.5">
          <Label className="text-xs">Fine print (one line each)</Label>
          <Textarea rows={3} value={draft.terms} onChange={(e) => set({ terms: e.target.value })} placeholder={"Direct bookings only\nHoliday weeks excluded"} />
        </div>
        <NumberField label="Sort order" value={draft.sort_order} onChange={(n) => set({ sort_order: n == null ? "0" : String(n) })} />
      </Section>

      {/* Live preview */}
      <div className="rounded-lg border border-dashed p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Preview
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium flex items-center gap-1.5">
              <span>{draft.emoji}</span>
              <span className="truncate">{draft.title || "Untitled promo"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {summarySentence({
                offers: draft.offers,
                conditions: cleanConditions(draft.conditions),
                auto_apply: draft.redemption === "auto",
                stackable: draft.stackable,
                code: draft.redemption === "code" ? draft.code.toUpperCase() || null : null,
              })}
            </p>
          </div>
          {headline && (
            <div className="text-center shrink-0">
              <div className="text-2xl font-semibold leading-none">{headline.big}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{headline.sub}</div>
            </div>
          )}
        </div>
        {draft.offers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {draft.offers.map((o, i) => (
              <span key={i} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px]">{offerLabel(o)}</span>
            ))}
          </div>
        )}
      </div>

      <Button className="w-full" onClick={onSave}>{draft.id ? "Update Promo" : "Create Promo"}</Button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : undefined)}
      />
    </div>
  );
}

function OfferEditor({
  offer,
  onChange,
  onRemove,
}: {
  offer: Offer;
  onChange: (o: Offer) => void;
  onRemove: () => void;
}) {
  const targetSelect = (value: string, onValue: (v: string) => void) => (
    <Select value={value} onValueChange={(v) => onValue(v ?? "room")}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="room">Room</SelectItem>
        <SelectItem value="total">Total</SelectItem>
        <SelectItem value="cleaning">Cleaning</SelectItem>
        <SelectItem value="pet_fee">Pet fee</SelectItem>
      </SelectContent>
    </Select>
  );
  const upsellSelect = (value: string, onValue: (v: string) => void) => (
    <Select value={value} onValueChange={(v) => onValue(v ?? UPSELL_OPTIONS[0].type)}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        {UPSELL_OPTIONS.map((u) => <SelectItem key={u.type} value={u.type}>{u.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{OFFER_KINDS.find((k) => k.kind === offer.kind)?.label}</span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {offer.kind === "percent_off" && (
          <>
            <Input type="number" min={0} max={100} value={offer.value} onChange={(e) => onChange({ ...offer, value: parseInt(e.target.value) || 0 })} placeholder="%" />
            {targetSelect(offer.applies_to, (v) => onChange({ ...offer, applies_to: v as typeof offer.applies_to }))}
          </>
        )}
        {offer.kind === "amount_off" && (
          <>
            <Input type="number" min={0} value={offer.cents / 100} onChange={(e) => onChange({ ...offer, cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} placeholder="$" />
            {targetSelect(offer.applies_to, (v) => onChange({ ...offer, applies_to: v as typeof offer.applies_to }))}
          </>
        )}
        {offer.kind === "free_nights" && (
          <>
            <Input type="number" min={1} value={offer.count} onChange={(e) => onChange({ ...offer, count: parseInt(e.target.value) || 1 })} placeholder="# nights" />
            <Select value={offer.scope} onValueChange={(v) => onChange({ ...offer, scope: (v as typeof offer.scope) ?? "any" })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any nights</SelectItem>
                <SelectItem value="weeknight">Weeknights (Sun–Thu)</SelectItem>
                <SelectItem value="weekend">Weekends (Fri/Sat)</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        {offer.kind === "free_upsell" && upsellSelect(offer.upsell_type, (v) => onChange({ ...offer, upsell_type: v }))}
        {offer.kind === "percent_off_upsell" && (
          <>
            <Input type="number" min={0} max={100} value={offer.value} onChange={(e) => onChange({ ...offer, value: parseInt(e.target.value) || 0 })} placeholder="%" />
            {upsellSelect(offer.upsell_type, (v) => onChange({ ...offer, upsell_type: v }))}
          </>
        )}
        {offer.kind === "perk" && (
          <Input className="col-span-2" value={offer.label} onChange={(e) => onChange({ ...offer, label: e.target.value })} placeholder="Free bottle of wine on arrival" />
        )}
      </div>
    </div>
  );
}
