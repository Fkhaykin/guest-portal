"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

export function PropertyActiveToggle({
  propertyId,
  initialActive,
}: {
  propertyId: string;
  initialActive: boolean;
}) {
  const [isActive, setIsActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function handleToggle(checked: boolean) {
    setSaving(true);
    const { error } = await supabase
      .from("property")
      .update({ is_active: checked })
      .eq("id", propertyId);
    setSaving(false);

    if (!error) setIsActive(checked);
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
