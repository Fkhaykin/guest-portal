"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Mail, Phone, Trash2, Pencil, Loader2, RefreshCw, CalendarRange } from "lucide-react";
import { SegmentBuilder } from "./segment-builder";
import { toast } from "sonner";
import type { SegmentFilter } from "@/types/database";

interface Property {
  id: string;
  name: string;
  nickname: string | null;
}

interface Segment {
  id: string;
  name: string;
  description: string | null;
  filter: SegmentFilter;
  member_count: number;
  reachable_email: number;
  reachable_sms: number;
  created_at: string;
}

function windowSummary(f: SegmentFilter): { label: string; rolling: boolean } | null {
  if (f.stayed_within_days != null) {
    return { label: `Last ${f.stayed_within_days} days · auto-updates`, rolling: true };
  }
  if (f.stayed_from && f.stayed_until) return { label: `${f.stayed_from} – ${f.stayed_until}`, rolling: false };
  if (f.stayed_from) return { label: `Since ${f.stayed_from}`, rolling: false };
  if (f.stayed_until) return { label: `Until ${f.stayed_until}`, rolling: false };
  return null;
}

export function SegmentsTab({ properties }: { properties: Property[] }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/segments");
      const data = await res.json();
      if (res.ok) setSegments(data.segments);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(payload: { name: string; description: string; filter: SegmentFilter }) {
    const res = await fetch("/api/admin/marketing/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to create segment");
      return;
    }
    toast.success("Segment created");
    setCreateOpen(false);
    load();
  }

  async function handleUpdate(payload: { name: string; description: string; filter: SegmentFilter }) {
    if (!editing) return;
    const res = await fetch(`/api/admin/marketing/segments/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to update segment");
      return;
    }
    toast.success("Segment updated");
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this segment? Any drafts using it will be unaffected.")) return;
    const res = await fetch(`/api/admin/marketing/segments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to delete");
      return;
    }
    toast.success("Segment deleted");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Group guests by stay date, property, and how many times they&apos;ve stayed. Segments
          are live — new guests join automatically as they meet the conditions.
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-1.5" />
            New segment
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create segment</DialogTitle>
            </DialogHeader>
            <SegmentBuilder
              properties={properties}
              onSave={handleCreate}
              submitLabel="Create segment"
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : segments.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No segments yet. Create one to start sending targeted messages.
        </Card>
      ) : (
        <div className="space-y-2">
          {segments.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{s.name}</div>
                  {s.description && (
                    <div className="text-sm text-muted-foreground truncate">{s.description}</div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {s.member_count} guests
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {s.reachable_email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {s.reachable_sms}
                    </span>
                    {(() => {
                      const w = windowSummary(s.filter);
                      if (!w) return null;
                      return (
                        <span className="flex items-center gap-1">
                          {w.rolling ? (
                            <RefreshCw className="h-3.5 w-3.5" />
                          ) : (
                            <CalendarRange className="h-3.5 w-3.5" />
                          )}
                          {w.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit segment</DialogTitle>
            </DialogHeader>
            <SegmentBuilder
              properties={properties}
              initialName={editing.name}
              initialDescription={editing.description ?? ""}
              initialFilter={editing.filter}
              onSave={handleUpdate}
              submitLabel="Save changes"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
