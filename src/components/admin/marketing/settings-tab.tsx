"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export function SettingsTab() {
  const [capDays, setCapDays] = useState("14");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/marketing/settings");
      const data = await res.json();
      if (res.ok) {
        setCapDays(String(data.marketing_send_cap_days ?? 14));
        setFromEmail(data.marketing_from_email ?? "");
        setFromName(data.marketing_from_name ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketing_send_cap_days: parseInt(capDays, 10),
          marketing_from_email: fromEmail.trim() || null,
          marketing_from_name: fromName.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed");
        return;
      }
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card className="p-5 max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cap-days">Send cap (days)</Label>
        <Input
          id="cap-days"
          type="number"
          min={0}
          max={365}
          value={capDays}
          onChange={(e) => setCapDays(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          A guest will receive at most one marketing message in this window across all campaigns. Set to 0 to disable.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="from-name">From name (email)</Label>
        <Input
          id="from-name"
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          placeholder="Summit Lakeside"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="from-email">From address (email)</Label>
        <Input
          id="from-email"
          type="email"
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          placeholder="contact@summitlakeside.com"
        />
        <p className="text-xs text-muted-foreground">
          Must be a verified Resend sender. Falls back to the default if blank.
        </p>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save
      </Button>
    </Card>
  );
}
