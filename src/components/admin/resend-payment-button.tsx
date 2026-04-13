"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Copy, Check } from "lucide-react";

export function ResendPaymentButton({ registrationId }: { registrationId: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleResend() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/resend-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        setUrl(data.checkout_url);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (url) {
    return (
      <Button variant="ghost" size="icon" onClick={copyUrl} title="Copy payment link">
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleResend}
      disabled={loading}
      title="Resend payment link"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
    </Button>
  );
}
