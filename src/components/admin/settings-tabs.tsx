"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { value: "profile", label: "Profile" },
  { value: "notifications", label: "Notifications" },
  { value: "properties", label: "Properties" },
  { value: "cleaners", label: "Cleaners" },
  { value: "lodgify-webhooks", label: "Lodgify Webhooks" },
];

export function SettingsTabs({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "profile";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) =>
        router.replace(
          value === "profile" ? "/admin/settings" : `/admin/settings?tab=${value}`,
          { scroll: false }
        )
      }
    >
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
