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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/types/database";

/** Human-readable list of what a promotion actually gives the guest. */
function promoOffer(promo: Tables<"promotion">): string[] {
  const perks: string[] = [];
  if (promo.discount_percent) perks.push(`${promo.discount_percent}% off`);
  if (promo.discount_amount) perks.push(`$${promo.discount_amount} off`);
  if (promo.free_cleaning) perks.push("Free cleaning");
  if (promo.free_pet_fee) perks.push("Free pet fee");
  return perks;
}

export default function AdminPromotionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [promotions, setPromotions] = useState<Tables<"promotion">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"promotion"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [freeCleaning, setFreeCleaning] = useState(false);
  const [freePetFee, setFreePetFee] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadPromotions();
  }, [id]);

  // Seed the (controlled) checkboxes whenever the dialog opens for a promo.
  useEffect(() => {
    setFreeCleaning(editing?.free_cleaning ?? false);
    setFreePetFee(editing?.free_pet_fee ?? false);
  }, [editing]);

  async function loadPromotions() {
    const { data } = await supabase
      .from("promotion")
      .select("*")
      .eq("property_id", id)
      .order("sort_order");
    if (data) setPromotions(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      property_id: id,
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      promo_code: (formData.get("promo_code") as string) || null,
      discount_percent: Number(formData.get("discount_percent")) || null,
      discount_amount: Number(formData.get("discount_amount")) || null,
      free_cleaning: freeCleaning,
      free_pet_fee: freePetFee,
      valid_from: (formData.get("valid_from") as string) || null,
      valid_until: (formData.get("valid_until") as string) || null,
      is_active: true,
    };

    if (editing) {
      await supabase.from("promotion").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("promotion").insert(payload);
    }

    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    loadPromotions();
  }

  async function handleDelete(promoId: string) {
    if (!confirm("Delete this promotion?")) return;
    await supabase.from("promotion").delete().eq("id", promoId);
    loadPromotions();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Promotions</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}>
          <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-2" />
              Add Promotion
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Promotion" : "New Promotion"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={editing?.title ?? ""}
                  placeholder="20% Off Kayak Rentals"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editing?.description ?? ""}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo_code">Promo Code (optional)</Label>
                <Input
                  id="promo_code"
                  name="promo_code"
                  defaultValue={editing?.promo_code ?? ""}
                  placeholder="KAYAK20"
                />
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">The Offer</p>
                <p className="text-xs text-muted-foreground">
                  Set one or more. Leave blank for a code-only / informational
                  promotion.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="discount_percent">% Off</Label>
                    <Input
                      id="discount_percent"
                      name="discount_percent"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={editing?.discount_percent ?? ""}
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount_amount">Amount Off ($)</Label>
                    <Input
                      id="discount_amount"
                      name="discount_amount"
                      type="number"
                      min="0"
                      defaultValue={editing?.discount_amount ?? ""}
                      placeholder="50"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={freeCleaning}
                    onCheckedChange={(checked) => setFreeCleaning(checked === true)}
                  />
                  Free cleaning fee
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={freePetFee}
                    onCheckedChange={(checked) => setFreePetFee(checked === true)}
                  />
                  Free pet fee
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="valid_from">Valid From</Label>
                  <Input
                    id="valid_from"
                    name="valid_from"
                    type="date"
                    defaultValue={editing?.valid_from?.split("T")[0] ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                    defaultValue={editing?.valid_until?.split("T")[0] ?? ""}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {promotions.length > 0 ? (
        <div className="grid gap-3">
          {promotions.map((promo) => (
            <Card key={promo.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-base">{promo.title}</CardTitle>
                  {promo.description && (
                    <p className="text-sm text-muted-foreground">
                      {promo.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {promo.promo_code && (
                      <Badge variant="outline">{promo.promo_code}</Badge>
                    )}
                    {promoOffer(promo).map((perk) => (
                      <Badge key={perk} variant="outline" className="font-medium">
                        {perk}
                      </Badge>
                    ))}
                    <Badge variant={promo.is_active ? "default" : "secondary"}>
                      {promo.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(promo);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(promo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No promotions yet.</p>
      )}
    </div>
  );
}
