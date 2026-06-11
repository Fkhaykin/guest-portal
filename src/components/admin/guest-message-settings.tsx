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
import { TEMPLATES, TEMPLATE_VARIABLES } from "@/lib/guest-messages/templates";
import { HOUSE_KEYS, HOUSE_LABELS, HOUSE_CHECKIN_TEMPLATES, HOUSE_CHECKIN_SUBJECT } from "@/lib/guest-messages/house-templates";
import type { HouseKey } from "@/lib/guest-messages/quick-replies";
import type { GuestMessageSettings as GuestMessageSettingsType, GuestMessageKey, GuestMessageEvent } from "@/types/database";

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
  booking_invoice_full: {
    label: "Booking Invoice — Full Payment",
    description: "Sent when an admin creates a booking with the “Pay in full” plan. Contains the Stripe invoice link.",
    channel: "Email",
  },
  booking_invoice_deposit: {
    label: "Booking Invoice — 50% Deposit",
    description: "Sent when an admin creates a booking with the “Split (50% now, 50% later)” plan. Contains the Stripe deposit invoice link and the auto-charge balance date.",
    channel: "Email",
  },
  booking_plan_picker: {
    label: "Booking Payment Plan Picker",
    description: "Sent when an admin creates a booking with the “Let guest choose” plan. Links to a page where the guest picks full vs split.",
    channel: "Email",
  },
};

function defaultHouseSettings(): Record<string, GuestMessageEvent> {
  return Object.fromEntries(
    HOUSE_KEYS.map((house) => [
      house,
      { enabled: true, subject: HOUSE_CHECKIN_SUBJECT, message: HOUSE_CHECKIN_TEMPLATES[house] },
    ])
  );
}

function defaultSettings(): GuestMessageSettingsType {
  return {
    house_checkin_instructions: defaultHouseSettings(),
    booking_confirmation: { enabled: true, subject: TEMPLATES.booking_confirmation.subject, message: TEMPLATES.booking_confirmation.body },
    pre_arrival: { enabled: true, subject: TEMPLATES.pre_arrival.subject, message: TEMPLATES.pre_arrival.body },
    day_of_checkin: { enabled: true, subject: TEMPLATES.day_of_checkin.subject, message: TEMPLATES.day_of_checkin.body },
    post_checkout: { enabled: true, subject: TEMPLATES.post_checkout.subject, message: TEMPLATES.post_checkout.body },
    registration_reminder: { enabled: true, subject: TEMPLATES.registration_reminder.subject, message: TEMPLATES.registration_reminder.body },
    booking_invoice_full: { enabled: true, subject: TEMPLATES.booking_invoice_full.subject, message: TEMPLATES.booking_invoice_full.body },
    booking_invoice_deposit: { enabled: true, subject: TEMPLATES.booking_invoice_deposit.subject, message: TEMPLATES.booking_invoice_deposit.body },
    booking_plan_picker: { enabled: true, subject: TEMPLATES.booking_plan_picker.subject, message: TEMPLATES.booking_plan_picker.body },
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
          const saved = host.guest_message_settings as GuestMessageSettingsType;
          const merged = {
            ...defaultSettings(),
            ...saved,
            house_checkin_instructions: {
              ...defaultHouseSettings(),
              ...(saved.house_checkin_instructions ?? {}),
            },
          };
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

  function updateHouseField(house: HouseKey, field: "enabled" | "subject" | "message", value: boolean | string) {
    setSaved(false);
    setSettings((prev) => {
      const current = prev.house_checkin_instructions?.[house] ?? {
        enabled: true,
        subject: HOUSE_CHECKIN_SUBJECT,
        message: HOUSE_CHECKIN_TEMPLATES[house],
      };
      return {
        ...prev,
        house_checkin_instructions: {
          ...(prev.house_checkin_instructions ?? defaultHouseSettings()),
          [house]: { ...current, [field]: value },
        },
      };
    });
  }

  function resetHouseToDefault(house: HouseKey) {
    setSaved(false);
    setSettings((prev) => ({
      ...prev,
      house_checkin_instructions: {
        ...(prev.house_checkin_instructions ?? defaultHouseSettings()),
        [house]: {
          enabled: prev.house_checkin_instructions?.[house]?.enabled ?? true,
          subject: HOUSE_CHECKIN_SUBJECT,
          message: HOUSE_CHECKIN_TEMPLATES[house],
        },
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
                      {TEMPLATE_VARIABLES[key].map((v) => (
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

      <Card>
        <CardHeader>
          <CardTitle>House Check-In Instructions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sent the morning of check-in, per home — door code, wifi, gate process, parking, and house rules.
            Seeded from your Airbnb message history. Sent alongside the Check-In Day message above.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {HOUSE_KEYS.map((house) => {
            const event = settings.house_checkin_instructions?.[house] ?? {
              enabled: true,
              subject: HOUSE_CHECKIN_SUBJECT,
              message: HOUSE_CHECKIN_TEMPLATES[house],
            };
            return (
              <div key={house} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{HOUSE_LABELS[house]}</Label>
                    <p className="text-xs text-muted-foreground">
                      Check-in instructions for this home. Verify door code and wifi before enabling.
                    </p>
                  </div>
                  <Switch
                    checked={event.enabled}
                    onCheckedChange={(checked) => updateHouseField(house, "enabled", checked)}
                  />
                </div>

                {event.enabled && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`subject-house-${house}`} className="text-xs text-muted-foreground">
                        Subject (email only)
                      </Label>
                      <Input
                        id={`subject-house-${house}`}
                        value={event.subject}
                        onChange={(e) => updateHouseField(house, "subject", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`msg-house-${house}`} className="text-xs text-muted-foreground">
                          Message body
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => resetHouseToDefault(house)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      </div>
                      <Textarea
                        id={`msg-house-${house}`}
                        value={event.message}
                        onChange={(e) => updateHouseField(house, "message", e.target.value)}
                        rows={10}
                        className="text-sm font-mono"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {["guest_name", "property_name", "check_in_date", "check_out_date", "check_in_time", "check_out_time", "portal_link"].map((v) => (
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
