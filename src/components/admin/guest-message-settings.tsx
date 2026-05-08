"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, Loader2 } from "lucide-react";
import { TEMPLATES } from "@/lib/guest-messages/templates";
import type { GuestMessageSettings as GuestMessageSettingsType, GuestMessageKey } from "@/types/database";

const EVENT_META: Record<GuestMessageKey, { label: string; description: string; channel: string }> = {
  booking_confirmation: {
    label: "Booking Confirmation",
    description: "Sent immediately when a new booking is synced from Lodgify.",
    channel: "Lodgify message (VRBO) · Email (Direct)",
  },
  pre_arrival: {
    label: "Pre-Arrival Reminder",
    description: "Sent 3 days before check-in.",
    channel: "Lodgify message (VRBO) · Email (Direct)",
  },
  day_of_checkin: {
    label: "Check-In Day",
    description: "Sent the morning of check-in.",
    channel: "Lodgify message (VRBO) · Email (Direct)",
  },
  post_checkout: {
    label: "Post-Checkout",
    description: "Sent the day after check-out.",
    channel: "Lodgify message (VRBO) · Email (Direct)",
  },
  registration_reminder: {
    label: "Registration Reminder",
    description: "Sent at 10, 7, 6, 5, 4, 3, 2, and 1 days before check-in to guests who have not completed registration.",
    channel: "Lodgify message (VRBO) · Email (Direct) · SMS (when phone on file)",
  },
};

const VARIABLES = ["guest_name", "property_name", "check_in_date", "check_out_date", "portal_link"];

function defaultSettings(): GuestMessageSettingsType {
  return {
    booking_confirmation: { enabled: true, subject: TEMPLATES.booking_confirmation.subject, message: TEMPLATES.booking_confirmation.body },
    pre_arrival: { enabled: true, subject: TEMPLATES.pre_arrival.subject, message: TEMPLATES.pre_arrival.body },
    day_of_checkin: { enabled: true, subject: TEMPLATES.day_of_checkin.subject, message: TEMPLATES.day_of_checkin.body },
    post_checkout: { enabled: true, subject: TEMPLATES.post_checkout.subject, message: TEMPLATES.post_checkout.body },
    registration_reminder: { enabled: true, subject: TEMPLATES.registration_reminder.subject, message: TEMPLATES.registration_reminder.body },
  };
}

export function GuestMessageSettings() {
  const [settings, setSettings] = useState<GuestMessageSettingsType>(defaultSettings());
  const [hostId, setHostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: host } = await supabase
        .from("host")
        .select("id, guest_message_settings")
        .eq("auth_user_id", user.id)
        .single();
      if (host) {
        setHostId(host.id);
        if (host.guest_message_settings) {
          // Merge with defaults so new fields always have a value
          const merged = { ...defaultSettings(), ...(host.guest_message_settings as GuestMessageSettingsType) };
          setSettings(merged);
        }
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(key: GuestMessageKey, field: "enabled" | "subject" | "message", value: boolean | string) {
    setSaved(false);
    setSettings((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function resetToDefault(key: GuestMessageKey) {
    setSaved(false);
    setSettings((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        subject: TEMPLATES[key].subject,
        message: TEMPLATES[key].body,
      },
    }));
  }

  async function handleSave() {
    if (!hostId) return;
    setSaving(true);
    await supabase
      .from("host")
      .update({ guest_message_settings: settings as unknown as Record<string, unknown> })
      .eq("id", hostId);
    setSaving(false);
    setSaved(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const keys = Object.keys(EVENT_META) as GuestMessageKey[];

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Automated Guest Messages</CardTitle>
          <p className="text-sm text-muted-foreground">
            Messages sent automatically to VRBO and direct booking guests. Airbnb guests are excluded — Airbnb handles their own messaging. Use{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{variable}}"}</code> placeholders in templates.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {keys.map((key) => {
            const meta = EVENT_META[key];
            const event = settings[key];
            return (
              <div key={key} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{meta.label}</Label>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                    <p className="text-xs text-muted-foreground/70">{meta.channel}</p>
                  </div>
                  <Switch
                    checked={event.enabled}
                    onCheckedChange={(checked) => updateField(key, "enabled", checked)}
                  />
                </div>

                {event.enabled && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`subject-${key}`} className="text-xs text-muted-foreground">
                        Subject (email only)
                      </Label>
                      <Input
                        id={`subject-${key}`}
                        value={event.subject}
                        onChange={(e) => updateField(key, "subject", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`msg-${key}`} className="text-xs text-muted-foreground">
                          Message body
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => resetToDefault(key)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      </div>
                      <Textarea
                        id={`msg-${key}`}
                        value={event.message}
                        onChange={(e) => updateField(key, "message", e.target.value)}
                        rows={5}
                        className="text-sm font-mono"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {VARIABLES.map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs font-mono">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pb-4">
        <Button onClick={handleSave} disabled={saving || !hostId}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Templates"}
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved</span>}
      </div>
    </div>
  );
}
