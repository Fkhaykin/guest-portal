"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Phone, CheckCircle2, XCircle, Ban } from "lucide-react";
import type { CampaignSendStatus } from "@/types/database";

interface SendRow {
  id: string;
  channel: "email" | "sms";
  status: CampaignSendStatus;
  recipient: string;
  subject: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
  guest: { full_name: string; email: string | null; phone: string | null } | null;
}

const STATUS_BADGE: Record<CampaignSendStatus, { className: string; Icon: typeof CheckCircle2 }> = {
  sent:          { className: "bg-green-500/15 text-green-700 dark:text-green-400", Icon: CheckCircle2 },
  failed:        { className: "bg-red-500/15 text-red-700 dark:text-red-400",       Icon: XCircle },
  pending:       { className: "bg-muted text-muted-foreground",                     Icon: CheckCircle2 },
  skipped_capped:{ className: "bg-amber-500/15 text-amber-700 dark:text-amber-400", Icon: Ban },
};

export function CampaignSendsLog({ campaignId }: { campaignId: string }) {
  const [sends, setSends] = useState<SendRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/sends`);
      const data = await res.json();
      if (res.ok) setSends(data.sends);
      setLoading(false);
    })();
  }, [campaignId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (sends.length === 0) {
    return <Card className="p-8 text-center text-muted-foreground">No sends yet.</Card>;
  }

  // Quick stats
  const stats = sends.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Sent" value={stats.sent ?? 0} />
        <StatCard label="Failed" value={stats.failed ?? 0} />
        <StatCard label="Capped" value={stats.skipped_capped ?? 0} />
        <StatCard label="Total" value={sends.length} />
      </div>

      <div className="space-y-1.5">
        {sends.map((s) => {
          const badge = STATUS_BADGE[s.status];
          return (
            <Card key={s.id} className="p-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className={badge.className}>
                  <badge.Icon className="h-3 w-3 mr-1" />
                  {s.status}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {s.channel === "sms" ? <Phone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                  {s.channel}
                </span>
                <span className="text-sm font-medium">{s.guest?.full_name ?? "?"}</span>
                <span className="text-xs text-muted-foreground truncate">{s.recipient}</span>
                {s.subject && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    “{s.subject}”
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(s.sent_at ?? s.created_at).toLocaleString()}
                </span>
              </div>
              {s.error && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{s.error}</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </Card>
  );
}
