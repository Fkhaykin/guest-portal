"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function PropertyActiveToggle({
  propertyId,
  initialActive,
}: {
  propertyId: string;
  initialActive: boolean;
}) {
  const [isActive, setIsActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  async function handleToggle(checked: boolean) {
    setIsActive(checked);
    const { error } = await supabase
      .from("property")
      .update({ is_active: checked })
      .eq("id", propertyId);

    if (error) {
      setIsActive(!checked);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={isActive}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
      <Badge variant={isActive ? "default" : "secondary"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
    </div>
  );
}
