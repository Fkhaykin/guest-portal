"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/types/database";

export default function AdminServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [services, setServices] = useState<Tables<"service">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"service"> | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadServices();
  }, [id]);

  async function loadServices() {
    const { data } = await supabase
      .from("service")
      .select("*")
      .eq("property_id", id)
      .order("sort_order");
    if (data) setServices(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      property_id: id,
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      price_cents: Math.round(parseFloat(formData.get("price") as string) * 100),
      is_active: true,
    };

    if (editing) {
      await supabase.from("service").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("service").insert(payload);
    }

    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    loadServices();
  }

  async function handleDelete(serviceId: string) {
    if (!confirm("Delete this service?")) return;
    await supabase.from("service").delete().eq("id", serviceId);
    loadServices();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Services</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}>
          <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Service" : "New Service"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  placeholder="Late Checkout"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editing?.description ?? ""}
                  placeholder="Extend your checkout until 2 PM"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editing ? (editing.price_cents / 100).toFixed(2) : ""}
                  placeholder="25.00"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {services.length > 0 ? (
        <div className="grid gap-3">
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-base">{service.name}</CardTitle>
                  {service.description && (
                    <p className="text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    ${(service.price_cents / 100).toFixed(2)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(service);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(service.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">
          No services yet. Add services guests can purchase.
        </p>
      )}
    </div>
  );
}
