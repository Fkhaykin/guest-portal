"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function NewPropertyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const address = formData.get("address") as string;
    const description = formData.get("description") as string;

    const supabase = createClient();

    // Get current host
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data: host } = await supabase
      .from("host")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!host) {
      setError("Host profile not found");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("property").insert({
      host_id: host.id,
      name,
      slug,
      address: address || null,
      description: description || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      router.push("/admin/properties");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-6">
        New Property
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Property Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Lake House Retreat"
                required
                onChange={(e) => {
                  const slugInput = document.getElementById(
                    "slug"
                  ) as HTMLInputElement;
                  if (slugInput) {
                    slugInput.value = slugify(e.target.value);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="lake-house-retreat"
                required
                pattern="[a-z0-9-]+"
              />
              <p className="text-xs text-muted-foreground">
                Guests will access your property at /p/your-slug
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="123 Lakeview Dr, Somewhere, ST 12345"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="A cozy lakefront retreat with stunning views..."
                rows={3}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Property"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
