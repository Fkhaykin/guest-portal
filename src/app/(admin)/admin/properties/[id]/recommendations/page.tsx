"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const categories = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "bar", label: "Bar & Brewery" },
  { value: "bakery", label: "Bakery & Sweets" },
  { value: "attraction", label: "Attraction" },
  { value: "activity", label: "Activity" },
  { value: "nature", label: "Nature" },
  { value: "family", label: "Family Fun" },
  { value: "sports", label: "Sports & Recreation" },
  { value: "spa", label: "Spa & Wellness" },
  { value: "shopping", label: "Shopping" },
  { value: "nightlife", label: "Nightlife" },
  { value: "other", label: "Other" },
] as const;

export default function AdminRecommendationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [recs, setRecs] = useState<Tables<"recommendation">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"recommendation"> | null>(null);
  const [category, setCategory] = useState<string>("restaurant");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadRecs();
  }, [id]);

  async function loadRecs() {
    const { data } = await supabase
      .from("recommendation")
      .select("*")
      .eq("property_id", id)
      .order("sort_order");
    if (data) setRecs(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      property_id: id,
      name: formData.get("name") as string,
      category: category as Tables<"recommendation">["category"],
      description: (formData.get("description") as string) || null,
      address: (formData.get("address") as string) || null,
      website_url: (formData.get("website_url") as string) || null,
      map_url: (formData.get("map_url") as string) || null,
      image_url: (formData.get("image_url") as string) || null,
      youtube_url: (formData.get("youtube_url") as string) || null,
      tips: (formData.get("tips") as string) || null,
    };

    if (editing) {
      await supabase.from("recommendation").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("recommendation").insert(payload);
    }

    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    loadRecs();
  }

  async function handleDelete(recId: string) {
    if (!confirm("Delete this recommendation?")) return;
    await supabase.from("recommendation").delete().eq("id", recId);
    loadRecs();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Recommendations</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}>
          <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-2" />
              Add Place
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Recommendation" : "New Recommendation"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  placeholder="Joe's Pizza"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editing?.category ?? category}
                  onValueChange={(v) => v && setCategory(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={editing?.address ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website_url">Website URL</Label>
                <Input
                  id="website_url"
                  name="website_url"
                  type="url"
                  defaultValue={editing?.website_url ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="map_url">Google Maps Link</Label>
                <Input
                  id="map_url"
                  name="map_url"
                  type="url"
                  defaultValue={editing?.map_url ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  name="image_url"
                  type="url"
                  defaultValue={editing?.image_url ?? ""}
                  placeholder="https://images.unsplash.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube_url">YouTube Video URL</Label>
                <Input
                  id="youtube_url"
                  name="youtube_url"
                  type="url"
                  defaultValue={editing?.youtube_url ?? ""}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tips">Insider Tip</Label>
                <Textarea
                  id="tips"
                  name="tips"
                  defaultValue={editing?.tips ?? ""}
                  rows={2}
                  placeholder="Pro tip for guests visiting this place..."
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {recs.length > 0 ? (
        <div className="grid gap-3">
          {recs.map((rec) => (
            <Card key={rec.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-base">{rec.name}</CardTitle>
                  {rec.description && (
                    <p className="text-sm text-muted-foreground">
                      {rec.description}
                    </p>
                  )}
                  <Badge variant="outline" className="mt-1">
                    {rec.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(rec);
                      setCategory(rec.category);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(rec.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No recommendations yet.</p>
      )}
    </div>
  );
}
