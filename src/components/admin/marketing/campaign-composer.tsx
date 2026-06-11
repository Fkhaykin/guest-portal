"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, GripVertical, Send, Save } from "lucide-react";
import { TiptapEditor } from "./tiptap-editor";
import { TokenPickerTextarea } from "./token-picker-textarea";
import { toast } from "sonner";
import type { CampaignChannel, CampaignKind } from "@/types/database";

interface Segment {
  id: string;
  name: string;
  member_count: number;
  reachable_email: number;
  reachable_sms: number;
}

export interface ComposerStep {
  id?: string;
  delay_days_after_checkout: number | null;
  subject: string;
  html_body: string;
  text_body: string;
  channel_override: CampaignChannel | null;
}

interface Props {
  segments: Segment[];
  initial?: {
    id: string;
    name: string;
    kind: CampaignKind;
    segment_id: string;
    default_channel: CampaignChannel;
    send_cap_days: number | null;
    discount_code: string | null;
    direct_book_url: string | null;
    steps: ComposerStep[];
    status: string;
  };
}

export function CampaignComposer({ segments, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<CampaignKind>(initial?.kind ?? "manual");
  const [segmentId, setSegmentId] = useState(initial?.segment_id ?? segments[0]?.id ?? "");
  const [defaultChannel, setDefaultChannel] = useState<CampaignChannel>(initial?.default_channel ?? "auto");
  const [sendCapDays, setSendCapDays] = useState<string>(
    initial?.send_cap_days != null ? String(initial.send_cap_days) : ""
  );
  const [discountCode, setDiscountCode] = useState(initial?.discount_code ?? "");
  const [directBookUrl, setDirectBookUrl] = useState(initial?.direct_book_url ?? "");
  const [steps, setSteps] = useState<ComposerStep[]>(
    initial?.steps ?? [
      {
        delay_days_after_checkout: null,
        subject: "",
        html_body: "",
        text_body: "",
        channel_override: null,
      },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedSegment = segments.find((s) => s.id === segmentId);

  function updateStep(index: number, patch: Partial<ComposerStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        delay_days_after_checkout: (prev[prev.length - 1]?.delay_days_after_checkout ?? 0) + 7,
        subject: "",
        html_body: "",
        text_body: "",
        channel_override: null,
      },
    ]);
  }
  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }
  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function changeKind(newKind: CampaignKind) {
    setKind(newKind);
    if (newKind === "manual" && steps.length > 1) {
      setSteps([steps[0]]);
    }
    if (newKind === "manual") {
      setSteps((prev) => prev.map((s) => ({ ...s, delay_days_after_checkout: null })));
    } else {
      setSteps((prev) =>
        prev.map((s, i) => ({
          ...s,
          delay_days_after_checkout: s.delay_days_after_checkout ?? (i === 0 ? 7 : i * 7),
        }))
      );
    }
  }

  async function handleSave(): Promise<string | null> {
    if (!name.trim()) {
      toast.error("Name is required");
      return null;
    }
    if (!segmentId) {
      toast.error("Pick a segment");
      return null;
    }
    if (steps.some((s) => !s.html_body && !s.text_body)) {
      toast.error("Each step needs at least an email or SMS body");
      return null;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        kind,
        segment_id: segmentId,
        default_channel: defaultChannel,
        send_cap_days: sendCapDays ? parseInt(sendCapDays, 10) : null,
        discount_code: discountCode.trim() || null,
        direct_book_url: directBookUrl.trim() || null,
        steps: steps.map((s) => ({
          delay_days_after_checkout: kind === "manual" ? null : s.delay_days_after_checkout,
          subject: s.subject || null,
          html_body: s.html_body || null,
          text_body: s.text_body || null,
          channel_override: s.channel_override,
        })),
      };

      let res: Response;
      if (initial) {
        res = await fetch(`/api/admin/marketing/campaigns/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/marketing/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to save");
        return null;
      }
      const data = await res.json();
      toast.success(initial ? "Campaign updated" : "Campaign created");
      return initial?.id ?? data.campaign.id;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndExit() {
    const id = await handleSave();
    if (id) router.push("/admin/campaigns");
  }

  async function handleSendNow() {
    if (!confirm(`Send this campaign to ${selectedSegment?.member_count ?? "?"} guests now?`)) return;
    const id = await handleSave();
    if (!id) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Send failed");
        return;
      }
      toast.success(
        `Sent: ${data.result.sent} • Failed: ${data.result.failed} • Capped: ${data.result.skipped_capped} • Skipped (no channel): ${data.result.skipped_no_channel}`
      );
      router.push(`/admin/campaigns/${id}`);
    } finally {
      setSending(false);
    }
  }

  async function handleActivate() {
    const id = await handleSave();
    if (!id) return;
    const res = await fetch(`/api/admin/marketing/campaigns/${id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to activate");
      return;
    }
    toast.success("Drip campaign is now active");
    router.push(`/admin/campaigns/${id}`);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="camp-name">Campaign name</Label>
            <Input id="camp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer direct-book offer" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => v && changeKind(v as CampaignKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (one-time send)</SelectItem>
                <SelectItem value="drip">Drip (auto-send N days after checkout)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Audience</Label>
            <Select value={segmentId} onValueChange={(v) => v && setSegmentId(v)}>
              <SelectTrigger><SelectValue placeholder="Pick a segment" /></SelectTrigger>
              <SelectContent>
                {segments.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    Create a segment first
                  </div>
                ) : (
                  segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.member_count})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedSegment && (
              <p className="text-xs text-muted-foreground">
                {selectedSegment.member_count} guests • {selectedSegment.reachable_email} email • {selectedSegment.reachable_sms} SMS
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Default channel</Label>
            <Select value={defaultChannel} onValueChange={(v) => v && setDefaultChannel(v as CampaignChannel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (SMS if phone, else email)</SelectItem>
                <SelectItem value="email">Email only</SelectItem>
                <SelectItem value="sms">SMS only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cap">Send-cap override (days)</Label>
            <Input
              id="cap"
              type="number"
              min={0}
              value={sendCapDays}
              onChange={(e) => setSendCapDays(e.target.value)}
              placeholder="Use host default"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount">Discount code (for tokens)</Label>
            <Input
              id="discount"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="e.g. DIRECT20"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="book-url">Direct-book URL</Label>
            <Input
              id="book-url"
              value={directBookUrl}
              onChange={(e) => setDirectBookUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {kind === "manual" ? "Message" : "Drip steps"}
          </h2>
          {kind === "drip" && (
            <Button size="sm" variant="outline" onClick={addStep}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add step
            </Button>
          )}
        </div>

        {steps.map((step, i) => (
          <Card key={i} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {kind === "drip" && (
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <GripVertical className="h-4 w-4 rotate-90" />
                    </button>
                  </div>
                )}
                <div className="font-medium text-sm">
                  {kind === "manual" ? "Message body" : `Step ${i + 1}`}
                </div>
                {kind === "drip" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">Day</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-20"
                      value={step.delay_days_after_checkout ?? 0}
                      onChange={(e) =>
                        updateStep(i, {
                          delay_days_after_checkout: parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                    <span className="text-sm text-muted-foreground">after checkout</span>
                  </div>
                )}
              </div>
              {kind === "drip" && steps.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeStep(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>

            <Tabs defaultValue="email">
              <TabsList>
                <TabsTrigger value="email">Email (HTML)</TabsTrigger>
                <TabsTrigger value="sms">SMS (plain text)</TabsTrigger>
              </TabsList>
              <TabsContent value="email" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label>Subject line</Label>
                  <Input
                    value={step.subject}
                    onChange={(e) => updateStep(i, { subject: e.target.value })}
                    placeholder="e.g. Book direct and save 20%"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email body</Label>
                  <TiptapEditor
                    value={step.html_body}
                    onChange={(html) => updateStep(i, { html_body: html })}
                    placeholder="Hi {{first_name}}, …"
                  />
                </div>
              </TabsContent>
              <TabsContent value="sms" className="pt-3">
                <div className="space-y-1.5">
                  <Label>SMS body</Label>
                  <TokenPickerTextarea
                    value={step.text_body}
                    onChange={(v) => updateStep(i, { text_body: v })}
                    placeholder="Hi {{first_name}}, book your next stay direct at {{property_name}} and save 20% with code {{discount_code}}: {{direct_book_link}}"
                    rows={4}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        ))}
      </div>

      <Card className="p-4 flex flex-wrap gap-2 justify-end sticky bottom-4">
        <Button variant="outline" onClick={handleSaveAndExit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
          Save draft
        </Button>
        {kind === "manual" ? (
          <Button onClick={handleSendNow} disabled={saving || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
            Send now
          </Button>
        ) : (
          <Button onClick={handleActivate} disabled={saving}>
            <Send className="h-4 w-4 mr-1.5" />
            Save & activate
          </Button>
        )}
      </Card>
    </div>
  );
}
