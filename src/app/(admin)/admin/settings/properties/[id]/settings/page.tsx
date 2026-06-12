"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, Plus, X, GripVertical } from "lucide-react";

export default function PropertySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [cleaningFee, setCleaningFee] = useState("");
  const [petFee, setPetFee] = useState("");
  const [guestCleaningFee, setGuestCleaningFee] = useState("");
  const [guestPetFee, setGuestPetFee] = useState("");
  const [maxOccupancy, setMaxOccupancy] = useState("12");
  const [maxVehicles, setMaxVehicles] = useState("6");
  const [photoAreas, setPhotoAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("property")
        .select("name, nickname, address, description, cleaning_fee_cents, pet_fee_cents, guest_cleaning_fee_cents, guest_pet_fee_cents, max_guests, max_vehicles, cleaning_photo_areas")
        .eq("id", id)
        .single();

      if (data) {
        setName(data.name || "");
        setNickname(data.nickname || "");
        setAddress(data.address || "");
        setDescription(data.description || "");
        setCleaningFee(data.cleaning_fee_cents ? (data.cleaning_fee_cents / 100).toFixed(2) : "");
        setPetFee(data.pet_fee_cents ? (data.pet_fee_cents / 100).toFixed(2) : "");
        setGuestCleaningFee(data.guest_cleaning_fee_cents ? (data.guest_cleaning_fee_cents / 100).toFixed(2) : "");
        setGuestPetFee(data.guest_pet_fee_cents ? (data.guest_pet_fee_cents / 100).toFixed(2) : "");
        setMaxOccupancy(String(data.max_guests ?? 12));
        setMaxVehicles(String(data.max_vehicles ?? 6));
        setPhotoAreas(data.cleaning_photo_areas || []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const { error } = await supabase
      .from("property")
      .update({
        name: name.trim(),
        nickname: nickname.trim() || null,
        address: address.trim() || null,
        description: description.trim() || null,
        cleaning_fee_cents: cleaningFee ? Math.round(parseFloat(cleaningFee) * 100) : 0,
        pet_fee_cents: petFee ? Math.round(parseFloat(petFee) * 100) : 0,
        guest_cleaning_fee_cents: guestCleaningFee ? Math.round(parseFloat(guestCleaningFee) * 100) : 0,
        guest_pet_fee_cents: guestPetFee ? Math.round(parseFloat(guestPetFee) * 100) : 0,
        max_guests: parseInt(maxOccupancy) || 12,
        max_vehicles: parseInt(maxVehicles) || 6,
        cleaning_photo_areas: photoAreas,
      })
      .eq("id", id);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Property Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              Basic property information shown on the guest portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Property Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summit Lakeside Retreat"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Nickname</Label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. The Lake House"
              />
              <p className="text-xs text-muted-foreground">
                An informal name shown to cleaners and staff (optional).
              </p>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 279 East Shore Drive, Hampton Bays, NY 11946"
              />
              <p className="text-xs text-muted-foreground">
                Full address including city, state, and ZIP. Shown to guests 7 days before check-in.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of the property"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Max Occupancy</Label>
              <Input
                type="number"
                min="1"
                value={maxOccupancy}
                onChange={(e) => setMaxOccupancy(e.target.value)}
                placeholder="12"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of guests allowed during registration.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Max Vehicles</Label>
              <Input
                type="number"
                min="1"
                value={maxVehicles}
                onChange={(e) => setMaxVehicles(e.target.value)}
                placeholder="6"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of vehicles guests may register for this property.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cleaner Fees</CardTitle>
            <CardDescription>
              Default fee amounts used when generating cleaner invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Cleaning Fee ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cleaningFee}
                  onChange={(e) => setCleaningFee(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label>Pet Fee ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={petFee}
                  onChange={(e) => setPetFee(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guest Pricing</CardTitle>
            <CardDescription>
              Amounts charged to guests at checkout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Cleaning Fee ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={guestCleaningFee}
                  onChange={(e) => setGuestCleaningFee(e.target.value)}
                  placeholder="275.00"
                />
              </div>
              <div className="space-y-1">
                <Label>Pet Fee ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={guestPetFee}
                  onChange={(e) => setGuestPetFee(e.target.value)}
                  placeholder="100.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cleaning Photo Areas</CardTitle>
            <CardDescription>
              Areas the cleaner must photograph when completing a cleaning. Add or remove areas specific to this property.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {photoAreas.map((area, i) => (
              <div key={i} className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <Input
                  value={area}
                  onChange={(e) => {
                    const updated = [...photoAreas];
                    updated[i] = e.target.value;
                    setPhotoAreas(updated);
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPhotoAreas(photoAreas.filter((_, idx) => idx !== i))}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                placeholder="Add new area..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newArea.trim()) {
                    e.preventDefault();
                    setPhotoAreas([...photoAreas, newArea.trim()]);
                    setNewArea("");
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!newArea.trim()}
                onClick={() => {
                  setPhotoAreas([...photoAreas, newArea.trim()]);
                  setNewArea("");
                }}
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved successfully</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
