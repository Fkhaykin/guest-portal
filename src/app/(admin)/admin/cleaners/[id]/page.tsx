"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check } from "lucide-react";
import type { Tables } from "@/types/database";

export default function AdminCleanerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [cleaner, setCleaner] = useState<Tables<"cleaner"> | null>(null);
  const [properties, setProperties] = useState<Tables<"property">[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const { data: cleanerData } = await supabase
      .from("cleaner")
      .select("*")
      .eq("id", id)
      .single();
    setCleaner(cleanerData);

    if (!cleanerData) return;

    // Get all properties for this host
    const { data: props } = await supabase
      .from("property")
      .select("*")
      .eq("host_id", cleanerData.host_id)
      .eq("is_active", true)
      .order("name");
    setProperties(props || []);

    // Get current assignments
    const { data: assignments } = await supabase
      .from("cleaner_property")
      .select("property_id")
      .eq("cleaner_id", id);
    setAssignedIds(new Set((assignments || []).map((a) => a.property_id)));
  }

  async function toggleProperty(propertyId: string) {
    setSaving(propertyId);
    const isAssigned = assignedIds.has(propertyId);

    if (isAssigned) {
      await supabase
        .from("cleaner_property")
        .delete()
        .eq("cleaner_id", id)
        .eq("property_id", propertyId);
      setAssignedIds((prev) => {
        const next = new Set(prev);
        next.delete(propertyId);
        return next;
      });
    } else {
      await supabase.from("cleaner_property").insert({
        cleaner_id: id,
        property_id: propertyId,
      });
      setAssignedIds((prev) => new Set(prev).add(propertyId));
    }

    setSaving(null);
  }

  if (!cleaner) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/cleaners")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{cleaner.name}</h1>
          <p className="text-muted-foreground">Assign properties this cleaner can access</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {properties.length > 0 ? (
            properties.map((property) => {
              const isAssigned = assignedIds.has(property.id);
              return (
                <button
                  key={property.id}
                  onClick={() => toggleProperty(property.id)}
                  disabled={saving === property.id}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-md border hover:bg-accent/50 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-sm">{property.name}</p>
                    {property.address && (
                      <p className="text-xs text-muted-foreground">
                        {property.address}
                      </p>
                    )}
                  </div>
                  {isAssigned ? (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      Assigned
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not assigned</Badge>
                  )}
                </button>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              No active properties found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
