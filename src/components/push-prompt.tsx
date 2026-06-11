"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DISMISSED_KEY = "push_prompt_dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function subscribe(endpoint: string): Promise<boolean> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  return res.ok;
}

export function PushPrompt({
  endpoint,
  description,
}: {
  endpoint: string;
  description: string;
}) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      typeof Notification === "undefined"
    ) {
      // iOS only exposes push to apps installed on the Home Screen
      return;
    }

    if (Notification.permission === "granted") {
      // Keep the server's copy of this device's subscription fresh
      subscribe(endpoint).catch(() => {});
      return;
    }

    if (
      Notification.permission === "default" &&
      localStorage.getItem(DISMISSED_KEY) !== "1"
    ) {
      setVisible(true);
    }
  }, [endpoint]);

  async function handleEnable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await subscribe(endpoint);
      }
    } finally {
      setLoading(false);
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Card className="mb-4">
      <CardContent className="flex items-center gap-3 py-3">
        <Bell className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Turn on notifications</p>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" onClick={handleEnable} disabled={loading}>
          {loading ? "Enabling..." : "Enable"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
