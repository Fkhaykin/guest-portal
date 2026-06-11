"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Mail, Phone, Pencil, Send, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import type { CampaignKind, CampaignStatus, CampaignChannel } from "@/types/database";

interface CampaignRow {
  id: string;
  name: string;
  kind: CampaignKind;
  status: CampaignStatus;
  default_channel: CampaignChannel;
  sent_at: string | null;
  created_at: string;
  segment: { id: string; name: string } | null;
}

const STATUS_VARIANTS: Record<CampaignStatus, { label: string; className: string }> = {
  draft:    { label: "Draft",    className: "bg-muted text-muted-foreground" },
  active:   { label: "Active",   className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  paused:   { label: "Paused",   className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  sent:     { label: "Sent",     className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground" },
};

export function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/campaigns");
      const data = await res.json();
      if (res.ok) setCampaigns(data.campaigns);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleDripStatus(c: CampaignRow) {
    const target = c.status === "active" ? "paused" : "active";
    const res = await fetch(`/api/admin/marketing/campaigns/${c.id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed");
      return;
    }
    toast.success(target === "active" ? "Resumed" : "Paused");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Send a one-time message or set up automated drips based on time since checkout.
        </p>
        <Link href="/admin/campaigns/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4 mr-1.5" />
          New campaign
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No campaigns yet.
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const variant = STATUS_VARIANTS[c.status];
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/admin/campaigns/${c.id}`} className="font-medium hover:underline truncate">
                        {c.name}
                      </Link>
                      <Badge variant="outline" className={variant.className}>
                        {variant.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {c.kind === "drip" ? "Drip" : "Manual"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      {c.segment && <span>→ {c.segment.name}</span>}
                      <span className="flex items-center gap-1">
                        {c.default_channel === "sms" ? <Phone className="h-3 w-3" /> : c.default_channel === "email" ? <Mail className="h-3 w-3" /> : <><Mail className="h-3 w-3" /> + <Phone className="h-3 w-3" /></>}
                        {c.default_channel}
                      </span>
                      {c.sent_at && <span>sent {new Date(c.sent_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.kind === "drip" && (c.status === "active" || c.status === "paused") && (
                      <Button variant="ghost" size="sm" onClick={() => toggleDripStatus(c)}>
                        {c.status === "active" ? (
                          <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</>
                        ) : (
                          <><Play className="h-3.5 w-3.5 mr-1" /> Resume</>
                        )}
                      </Button>
                    )}
                    <Link href={`/admin/campaigns/${c.id}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
