"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, EyeOff, Phone } from "lucide-react";
import type { Tables } from "@/types/database";

type CleanerWithCount = Tables<"cleaner"> & { property_count: number };

export default function AdminCleanersPage() {
  const [cleaners, setCleaners] = useState<CleanerWithCount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"cleaner"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadCleaners();
  }, []);

  async function loadCleaners() {
    // Get cleaners
    const { data: cleanerRows } = await supabase
      .from("cleaner")
      .select("*")
      .order("created_at", { ascending: false });

    if (!cleanerRows) {
      setCleaners([]);
      return;
    }

    // Get property counts per cleaner
    const { data: assignments } = await supabase
      .from("cleaner_property")
      .select("cleaner_id");

    const counts: Record<string, number> = {};
    for (const a of assignments || []) {
      counts[a.cleaner_id] = (counts[a.cleaner_id] || 0) + 1;
    }

    setCleaners(
      cleanerRows.map((c) => ({ ...c, property_count: counts[c.id] || 0 }))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const phone = (formData.get("phone") as string)?.trim() || null;
    const password = formData.get("password") as string;

    if (editing) {
      // Update name and phone
      await supabase
        .from("cleaner")
        .update({ name, phone })
        .eq("id", editing.id);

      // Update password if provided
      if (password && password.length >= 6) {
        const res = await fetch("/api/cleaner/hash-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const { hash } = await res.json();
        if (hash) {
          await supabase
            .from("cleaner")
            .update({ password_hash: hash })
            .eq("id", editing.id);
        }
      }
    } else {
      // Create new cleaner
      if (!password || password.length < 6) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/cleaner/hash-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const { hash } = await res.json();
      if (!hash) {
        setLoading(false);
        return;
      }

      // Get current host id
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: host } = await supabase
        .from("host")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (!host) {
        setLoading(false);
        return;
      }

      await supabase.from("cleaner").insert({
        host_id: host.id,
        name,
        phone,
        password_hash: hash,
      });
    }

    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    setShowPassword(false);
    loadCleaners();
  }

  async function handleDelete(cleanerId: string) {
    if (!confirm("Delete this cleaner? This cannot be undone.")) return;
    await supabase.from("cleaner").delete().eq("id", cleanerId);
    loadCleaners();
  }

  async function toggleActive(cleaner: Tables<"cleaner">) {
    await supabase
      .from("cleaner")
      .update({ is_active: !cleaner.is_active })
      .eq("id", cleaner.id);
    loadCleaners();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Cleaners</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditing(null);
              setShowPassword(false);
            }
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cleaner
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Cleaner" : "New Cleaner"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  placeholder="Maria"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (for SMS notifications)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={editing?.phone ?? ""}
                  placeholder="+1 555 123 4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password{editing ? " (leave blank to keep current)" : ""}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    minLength={editing ? undefined : 6}
                    required={!editing}
                    placeholder={editing ? "••••••" : "Min 6 characters"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {cleaners.length > 0 ? (
        <div className="grid gap-3">
          {cleaners.map((cleaner) => (
            <Card key={cleaner.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div
                  className="cursor-pointer flex-1"
                  onClick={() => router.push(`/admin/cleaners/${cleaner.id}`)}
                >
                  <CardTitle className="text-base">{cleaner.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {cleaner.property_count} propert{cleaner.property_count === 1 ? "y" : "ies"} assigned
                    {cleaner.phone && (
                      <span className="inline-flex items-center gap-1 ml-2">
                        <Phone className="h-3 w-3" />
                        {cleaner.phone}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={cleaner.is_active ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => toggleActive(cleaner)}
                  >
                    {cleaner.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(cleaner);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(cleaner.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No cleaners yet. Add a cleaner to give them access to reservation schedules.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
