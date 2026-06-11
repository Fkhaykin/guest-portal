"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SegmentsTab } from "./segments-tab";
import { CampaignsTab } from "./campaigns-tab";
import { SettingsTab } from "./settings-tab";

interface Property {
  id: string;
  name: string;
  nickname: string | null;
}

export function CampaignsPageShell({ properties }: { properties: Property[] }) {
  return (
    <Tabs defaultValue="campaigns">
      <TabsList>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="segments">Segments</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="campaigns" className="mt-4">
        <CampaignsTab />
      </TabsContent>
      <TabsContent value="segments" className="mt-4">
        <SegmentsTab properties={properties} />
      </TabsContent>
      <TabsContent value="settings" className="mt-4">
        <SettingsTab />
      </TabsContent>
    </Tabs>
  );
}
