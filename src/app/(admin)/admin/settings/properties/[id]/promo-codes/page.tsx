"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

type PromoCode = {
  id: string;
  property_id: string | null;
  code: string;
  discount_type: string;
  discount_value: number;
  min_nights: number;
  max_uses: number | null;
  times_used: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
};

const DISCOUNT_TYPES = [
  { value: "percentage", label: "Percentage Off" },
  { value: "flat", label: "Flat Amount Off" },
  { value: "free_nights", label: "Free Nights" },
  { value: "free_cleaning", label: "Free Cleaning Fee" },
];

function discountLabel(type: string, value: number) {
  switch (type) {
    case "percentage": return `${value}% off`;
    case "flat": return `$${(value / 100).toFixed(2)} off`;
    case "free_nights": return `${value} free night${value !== 1 ? "s" : ""}`;
    case "free_cleaning": return "Free cleaning";
    default: return type;
  }
}

export default function AdminPromoCodesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function loadCodes() {
    const { data } = await supabase
      .from("promo_code")
      .select("*")
      .or(`property_id.eq.${id},property_id.is.null`)
      .order("created_at", { ascending: false });
    setCodes((data as PromoCode[]) || []);
  }

  useEffect(() => { loadCodes(); }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const discountType = form.get("discount_type") as string;
    let discountValue = parseInt(form.get("discount_value") as string) || 0;
    // For flat amounts, convert dollars to cents
    if (discountType === "flat") discountValue = Math.round(discountValue * 100);

    const isGlobal = form.get("is_global") === "on";

    const payload = {
      property_id: isGlobal ? null : id,
      code: (form.get("code") as string).toUpperCase().trim(),
      discount_type: discountType,
      discount_value: discountValue,
      min_nights: parseInt(form.get("min_nights") as string) || 1,
      max_uses: (form.get("max_uses") as string) ? parseInt(form.get("max_uses") as string) : null,
      valid_from: (form.get("valid_from") as string) || null,
      valid_until: (form.get("valid_until") as string) || null,
      is_active: true,
    };

    if (editing) {
      await supabase.from("promo_code").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("promo_code").insert(payload);
    }

    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    loadCodes();
  }

  async function handleDelete(promoId: string) {
    if (!confirm("Delete this promo code?")) return;
    await supabase.from("promo_code").delete().eq("id", promoId);
    loadCodes();
  }

  async function toggleActive(promo: PromoCode) {
    await supabase.from("promo_code").update({ is_active: !promo.is_active }).eq("id", promo.id);
    loadCodes();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Promo Codes</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-1" /> Add Promo Code
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Promo Code" : "New Promo Code"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code *</Label>
                <Input id="code" name="code" defaultValue={editing?.code || ""} placeholder="SUMMER20" required className="uppercase" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="discount_type">Discount Type *</Label>
                  <Select name="discount_type" defaultValue={editing?.discount_type || "percentage"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCOUNT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount_value">Value *</Label>
                  <Input
                    id="discount_value"
                    name="discount_value"
                    type="number"
                    min={1}
                    defaultValue={editing ? (editing.discount_type === "flat" ? editing.discount_value / 100 : editing.discount_value) : ""}
                    placeholder="e.g. 10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="min_nights">Min Nights</Label>
                  <Input id="min_nights" name="min_nights" type="number" min={1} defaultValue={editing?.min_nights || 1} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max_uses">Max Uses</Label>
                  <Input id="max_uses" name="max_uses" type="number" min={1} defaultValue={editing?.max_uses || ""} placeholder="Unlimited" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="valid_from">Valid From</Label>
                  <Input id="valid_from" name="valid_from" type="date" defaultValue={editing?.valid_from?.split("T")[0] || ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input id="valid_until" name="valid_until" type="date" defaultValue={editing?.valid_until?.split("T")[0] || ""} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input id="is_global" name="is_global" type="checkbox" defaultChecked={editing?.property_id === null} className="h-4 w-4" />
                <Label htmlFor="is_global" className="text-sm">Global (applies to all properties)</Label>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {codes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {codes.map((promo) => (
            <Card key={promo.id}>
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-mono">{promo.code}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {discountLabel(promo.discount_type, promo.discount_value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditing(promo); setDialogOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge
                    variant={promo.is_active ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => toggleActive(promo)}
                  >
                    {promo.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {promo.property_id === null && (
                    <Badge variant="outline">Global</Badge>
                  )}
                  {promo.min_nights > 1 && (
                    <Badge variant="outline">{promo.min_nights}+ nights</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Used: {promo.times_used}{promo.max_uses ? `/${promo.max_uses}` : ""}
                  {promo.valid_from && ` · From ${promo.valid_from.split("T")[0]}`}
                  {promo.valid_until && ` · Until ${promo.valid_until.split("T")[0]}`}
                </p>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No promo codes yet.</p>
      )}
    </div>
  );
}
