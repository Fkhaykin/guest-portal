"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

// Pulls missing Lodgify message threads into our DB. Lives on the settings
// page so it doesn't crowd the mobile conversation list. Walks the backfill
// endpoint in batches and reports running progress.
export function LodgifyMessageSync() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setProgress("Starting…");
    try {
      let offset = 0;
      let done = false;
      let totalProcessed = 0;
      let totalMessages = 0;
      while (!done) {
        const res = await fetch(
          `/api/admin/messages/backfill?offset=${offset}&limit=10&onlyMissing=true`,
          { method: "POST" }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setProgress(`Failed: ${err.error || res.status}`);
          break;
        }
        const data = await res.json();
        totalProcessed += data.processed ?? 0;
        totalMessages += data.messagesWritten ?? 0;
        done = data.done;
        offset = data.next_offset ?? offset + (data.processed ?? 0);
        setProgress(
          `Synced ${totalProcessed}/${data.total ?? "?"} bookings · ${totalMessages} messages`
        );
      }
      setTimeout(() => setProgress(null), 4000);
    } catch {
      setProgress("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          Sync from Lodgify
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Pull in any conversations and messages missing from your inbox. New
          messages arrive automatically — run this only if something looks out
          of date.
        </p>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="gap-1.5"
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sync from Lodgify
        </Button>
        {progress && (
          <span className="text-xs text-muted-foreground">{progress}</span>
        )}
      </CardContent>
    </Card>
  );
}
