"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save } from "lucide-react";

export default function PropertySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("property")
        .select("name, address, description")
        .eq("id", id)
        .single();

      if (data) {
        setName(data.name || "");
        setAddress(data.address || "");
        setDescription(data.description || "");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await supabase
      .from("property")
      .update({
        name: name.trim(),
        address: address.trim() || null,
        description: description.trim() || null,
      })
      .eq("id", id);

    setSaving(false);
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
        <p className="text-muted-foreground">
          General property details visible to guests
        </p>
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
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved successfully</span>}
        </div>
      </form>
    </div>
  );
}
