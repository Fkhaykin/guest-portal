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
import { ArrowLeft, Check, Building2, Mail, Phone, DollarSign, PawPrint, FileText, MapPin, CreditCard } from "lucide-react";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
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

    // These two are independent of each other (properties for this host +
    // this cleaner's current assignments), so fetch them at once instead of
    // in a waterfall. Both stay after the cleaner load since the property
    // query needs cleanerData.host_id.
    const [{ data: props }, { data: assignments }] = await Promise.all([
      supabase
        .from("property")
        .select("*")
        .eq("host_id", cleanerData.host_id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("cleaner_property")
        .select("property_id")
        .eq("cleaner_id", id),
    ]);
    setProperties(props || []);
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
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/admin/settings" },
          { label: "Cleaners", href: "/admin/settings?tab=cleaners" },
          { label: cleaner.name },
        ]}
      />
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/settings?tab=cleaners")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{cleaner.name}</h1>
        </div>
      </div>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {cleaner.company && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0" />
              <span>{cleaner.company}</span>
            </div>
          )}
          {cleaner.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span>{cleaner.email}</span>
            </div>
          )}
          {cleaner.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>{cleaner.phone}</span>
            </div>
          )}
          {cleaner.address && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{cleaner.address}</span>
            </div>
          )}
          {cleaner.tax_id && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0" />
              <span>Tax ID: {cleaner.tax_id}</span>
            </div>
          )}
          {cleaner.payment_method && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>{cleaner.payment_method}</span>
            </div>
          )}
          <div className="flex items-center gap-4 pt-1">
            {cleaner.monthly_fee_cents > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>${(cleaner.monthly_fee_cents / 100).toFixed(2)}/mo</span>
              </div>
            )}
            {cleaner.pet_fee_cents > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <PawPrint className="h-4 w-4" />
                <span>${(cleaner.pet_fee_cents / 100).toFixed(2)}/pet</span>
              </div>
            )}
          </div>
          {!cleaner.company && !cleaner.email && !cleaner.phone && !cleaner.address && !cleaner.tax_id && !cleaner.payment_method && (
            <p className="text-muted-foreground">No profile info yet. Edit this cleaner to add details.</p>
          )}
        </CardContent>
      </Card>

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
