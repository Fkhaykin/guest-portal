"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, Mail, Phone } from "lucide-react";
import type { SegmentFilter } from "@/types/database";

interface Property {
  id: string;
  name: string;
  nickname: string | null;
}

interface PreviewResult {
  total: number;
  reachable_email: number;
  reachable_sms: number;
}

interface Props {
  properties: Property[];
  initialName?: string;
  initialDescription?: string;
  initialFilter?: SegmentFilter;
  onSave: (data: { name: string; description: string; filter: SegmentFilter }) => Promise<void>;
  submitLabel?: string;
}

export function SegmentBuilder({
  properties,
  initialName = "",
  initialDescription = "",
  initialFilter = {},
  onSave,
  submitLabel = "Save segment",
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [filter, setFilter] = useState<SegmentFilter>(initialFilter);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live preview as filter changes (debounced)
  useEffect(() => {
    const handle = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await fetch("/api/admin/marketing/segments/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreview({
            total: data.total,
            reachable_email: data.reachable_email,
            reachable_sms: data.reachable_sms,
          });
        }
      } finally {
        setPreviewing(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [filter]);

  function toggleProperty(id: string) {
    const current = filter.property_ids ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    setFilter({ ...filter, property_ids: next.length > 0 ? next : null });
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), filter });
    } finally {
      setSaving(false);
    }
  }

  const selectedProps = filter.property_ids ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="seg-name">Segment name</Label>
        <Input
          id="seg-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summer 2025 lake-house guests"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seg-desc">Description (optional)</Label>
        <Input
          id="seg-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this segment is for"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="stayed-from">Stayed from (check-out)</Label>
          <Input
            id="stayed-from"
            type="date"
            value={filter.stayed_from ?? ""}
            onChange={(e) => setFilter({ ...filter, stayed_from: e.target.value || null })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stayed-until">Stayed until (check-out)</Label>
          <Input
            id="stayed-until"
            type="date"
            value={filter.stayed_until ?? ""}
            onChange={(e) => setFilter({ ...filter, stayed_until: e.target.value || null })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Properties</Label>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border rounded-md p-2">
          {properties.length === 0 ? (
            <div className="col-span-2 text-sm text-muted-foreground text-center py-4">
              No properties yet
            </div>
          ) : (
            properties.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
              >
                <Checkbox
                  checked={selectedProps.includes(p.id)}
                  onCheckedChange={() => toggleProperty(p.id)}
                />
                <span className="text-sm truncate">{p.nickname || p.name}</span>
              </label>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedProps.length === 0 ? "All properties included" : `${selectedProps.length} selected`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="min-stays">Min # of stays</Label>
          <Input
            id="min-stays"
            type="number"
            min={0}
            value={filter.min_stays ?? ""}
            onChange={(e) =>
              setFilter({
                ...filter,
                min_stays: e.target.value ? parseInt(e.target.value, 10) : null,
              })
            }
            placeholder="e.g. 1"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max-stays">Max # of stays</Label>
          <Input
            id="max-stays"
            type="number"
            min={0}
            value={filter.max_stays ?? ""}
            onChange={(e) =>
              setFilter({
                ...filter,
                max_stays: e.target.value ? parseInt(e.target.value, 10) : null,
              })
            }
            placeholder="leave blank for no max"
          />
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {previewing ? <Loader2 className="h-3 w-3 animate-spin inline" /> : preview?.total ?? 0}
            </span>
            <span className="text-muted-foreground">match</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{preview?.reachable_email ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{preview?.reachable_sms ?? 0}</span>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {submitLabel}
      </Button>
    </div>
  );
}
