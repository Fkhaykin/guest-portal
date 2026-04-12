"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export function PropertyActiveToggle({
  propertyId,
  initialActive,
}: {
  propertyId: string;
  initialActive: boolean;
}) {
  const [isActive, setIsActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);

  async function handleToggle(checked: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/property-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, is_active: checked }),
      });
      if (res.ok) {
        setIsActive(checked);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={isActive}
        onCheckedChange={handleToggle}
        disabled={saving}
      />
      <Badge variant={isActive ? "default" : "secondary"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
    </div>
  );
}
