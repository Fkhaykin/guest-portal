"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw } from "lucide-react";
import type {
  NotificationSettings as NotificationSettingsType,
  NotificationEventKey,
} from "@/types/database";

const EVENT_META: Record<
  NotificationEventKey,
  { label: string; description: string; variables: string[] }
> = {
  cleaner_new_booking: {
    label: "New Booking",
    description: "Sent to assigned cleaners when a new booking is confirmed.",
    variables: ["property", "address", "guest", "check_in", "check_out", "num_guests", "extras_text", "notes_text", "link"],
  },
  cleaner_cancellation: {
    label: "Booking Cancelled",
    description: "Sent to assigned cleaners when a booking is cancelled.",
    variables: ["property", "address", "guest", "check_in", "check_out"],
  },
  cleaner_checkout: {
    label: "Guest Checked Out",
    description:
      "Sent to assigned cleaners when a guest checks out and the property needs cleaning.",
    variables: ["property", "address", "guest", "link"],
  },
  cleaner_pet_added: {
    label: "Pet Registered",
    description: "Sent to assigned cleaners when a guest registers pet(s).",
    variables: ["property", "address", "guest", "check_in", "num_pets", "link"],
  },
  cleaner_early_checkin: {
    label: "Early Check-In Purchased",
    description: "Sent to assigned cleaners when a guest purchases early check-in (1pm).",
    variables: ["property", "address", "guest", "check_in", "link"],
  },
  cleaner_late_checkout: {
    label: "Late Check-Out Purchased",
    description: "Sent to assigned cleaners when a guest purchases late check-out (2pm).",
    variables: ["property", "address", "guest", "check_out", "link"],
  },
};

const DEFAULT_SETTINGS: NotificationSettingsType = {
  cleaner_new_booking: {
    enabled: true,
    message:
      "New booking — {{property}}, {{address}}: {{guest}}, {{check_in}}–{{check_out}}, {{num_guests}} guest(s){{extras_text}}{{notes_text}}\nView: {{link}}",
  },
  cleaner_cancellation: {
    enabled: true,
    message:
      "Booking cancelled — {{property}}, {{address}}: {{guest}}, {{check_in}}–{{check_out}}.",
  },
  cleaner_checkout: {
    enabled: false,
    message:
      "Guest checked out — {{property}}, {{address}}: {{guest}}. Ready for cleaning.",
  },
  cleaner_pet_added: {
    enabled: true,
    message:
      "Pet(s) registered — {{property}}, {{address}}: {{guest}}, check-in {{check_in}}. {{num_pets}} pet(s) total. View: {{link}}",
  },
  cleaner_early_checkin: {
    enabled: true,
    message:
      "Early check-in purchased — {{property}}, {{address}}: {{guest}}, arriving {{check_in}} at 1pm. View: {{link}}",
  },
  cleaner_late_checkout: {
    enabled: true,
    message:
      "Late check-out purchased — {{property}}, {{address}}: {{guest}}, departing {{check_out}} at 2pm. View: {{link}}",
  },
};

export function NotificationSettings({
  hostId,
  initialSettings,
}: {
  hostId: string;
  initialSettings: NotificationSettingsType | null;
}) {
  const [settings, setSettings] = useState<NotificationSettingsType>(
    initialSettings ?? DEFAULT_SETTINGS
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  function updateEvent(
    key: NotificationEventKey,
    field: "enabled" | "message",
    value: boolean | string
  ) {
    setSaved(false);
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  function resetMessage(key: NotificationEventKey) {
    setSaved(false);
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], message: DEFAULT_SETTINGS[key].message },
    }));
  }

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("host")
      .update({ notification_settings: settings as unknown as Record<string, unknown> })
      .eq("id", hostId);
    setSaving(false);
    setSaved(true);
  }

  const eventKeys = Object.keys(EVENT_META) as NotificationEventKey[];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cleaner Notifications</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure which booking events send SMS notifications to assigned
            cleaners. Use {"{{variable}}"} placeholders in message templates.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {eventKeys.map((key) => {
            const meta = EVENT_META[key];
            const event = settings[key];

            return (
              <div
                key={key}
                className="space-y-3 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{meta.label}</Label>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                  <Switch
                    checked={event.enabled}
                    onCheckedChange={(checked: boolean) =>
                      updateEvent(key, "enabled", checked)
                    }
                  />
                </div>

                {event.enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`msg-${key}`}
                        className="text-xs text-muted-foreground"
                      >
                        Message template
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => resetMessage(key)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                    </div>
                    <Textarea
                      id={`msg-${key}`}
                      value={event.message}
                      onChange={(e) =>
                        updateEvent(key, "message", e.target.value)
                      }
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex flex-wrap gap-1">
                      {meta.variables.map((v) => (
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

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Notifications"}
        </Button>
        {saved && (
          <span className="text-sm text-muted-foreground">
            Settings saved
          </span>
        )}
      </div>
    </div>
  );
}
