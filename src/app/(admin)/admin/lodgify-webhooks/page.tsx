"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Plus,
  Trash2,
  Copy,
  Check,
  MessageSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Log = {
  id: string;
  received_at: string;
  action: string | null;
  lodgify_booking_id: number | null;
  signature_present: boolean;
  signature_valid: boolean | null;
  status_code: number;
  outcome: string;
  skip_reason: string | null;
  error_message: string | null;
  duration_ms: number | null;
  raw_payload: unknown;
  headers: Record<string, string> | null;
};

type OutcomeFilter = "all" | "errors" | "success";

type SmsLog = {
  id: string;
  sent_at: string;
  recipient_name: string | null;
  recipient_phone: string;
  event_type: string;
  success: boolean;
  error: string | null;
  quota_remaining: number | null;
  lodgify_booking_id: number | null;
  property: { name: string; nickname: string | null } | null;
};

type Subscription = {
  id: number | string;
  event: string;
  target_url: string;
};

const EVENT_OPTIONS = [
  { value: "booking_new_any_status", label: "Booking created (any status)" },
  { value: "booking_new_status_booked", label: "Booking created (confirmed only)" },
  { value: "booking_change", label: "Booking changed" },
  { value: "booking_status_change", label: "Booking status changed" },
  { value: "rate_change", label: "Rate changed" },
  { value: "availability_change", label: "Availability changed" },
  { value: "guest_message_received", label: "Guest message received" },
];

const OUTCOME_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  sync_ok: {
    label: "Synced",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle2,
  },
  sync_skipped: {
    label: "Skipped",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: AlertTriangle,
  },
  signature_invalid: {
    label: "Bad Signature",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: ShieldAlert,
  },
  invalid_json: {
    label: "Invalid JSON",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: XCircle,
  },
  missing_booking_id: {
    label: "Missing Booking ID",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: AlertTriangle,
  },
  sync_failed: {
    label: "Sync Failed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: XCircle,
  },
  message_synced: {
    label: "Message Saved",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: CheckCircle2,
  },
  message_skipped: {
    label: "Message Skipped",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: AlertTriangle,
  },
  message_failed: {
    label: "Message Failed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: XCircle,
  },
  action_ignored: {
    label: "Ignored",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: AlertTriangle,
  },
  unknown: {
    label: "Unknown",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: AlertTriangle,
  },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LodgifyWebhooksPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<OutcomeFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [smsLoading, setSmsLoading] = useState(true);
  const [smsRefreshing, setSmsRefreshing] = useState(false);

  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState("booking_new_any_status");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/admin/lodgify-webhooks", { cache: "no-store" });
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadSmsLogs(showSpinner = true) {
    if (showSpinner) setSmsLoading(true);
    else setSmsRefreshing(true);
    try {
      const res = await fetch("/api/admin/sms-log", { cache: "no-store" });
      const data = await res.json();
      if (data.logs) setSmsLogs(data.logs);
    } finally {
      setSmsLoading(false);
      setSmsRefreshing(false);
    }
  }

  async function loadSubs() {
    setSubsLoading(true);
    setSubsError(null);
    try {
      const res = await fetch("/api/admin/lodgify-webhooks/subscriptions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setSubsError(data.error ?? "Failed to load subscriptions");
        setSubs([]);
      } else {
        setSubs(data.subscriptions ?? []);
      }
    } catch (err) {
      setSubsError(err instanceof Error ? err.message : "Failed to load subscriptions");
      setSubs([]);
    } finally {
      setSubsLoading(false);
    }
  }

  async function subscribe() {
    if (!newTargetUrl.trim()) return;
    setSubscribing(true);
    setSubsError(null);
    setNewSecret(null);
    try {
      const res = await fetch("/api/admin/lodgify-webhooks/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: newEvent, target_url: newTargetUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubsError(data.error ?? "Subscribe failed");
      } else {
        if (data.subscription?.secret) setNewSecret(data.subscription.secret);
        await loadSubs();
      }
    } catch (err) {
      setSubsError(err instanceof Error ? err.message : "Subscribe failed");
    } finally {
      setSubscribing(false);
    }
  }

  async function unsubscribe(id: number | string) {
    if (!confirm("Remove this webhook subscription? Lodgify will stop sending events to this URL.")) return;
    const res = await fetch(
      `/api/admin/lodgify-webhooks/subscriptions?id=${encodeURIComponent(String(id))}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      setSubsError(data.error ?? "Unsubscribe failed");
    } else {
      await loadSubs();
    }
  }

  async function copySecret() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  useEffect(() => {
    load();
    loadSubs();
    loadSmsLogs();
    if (typeof window !== "undefined") {
      setNewTargetUrl(`${window.location.protocol}//${window.location.host.replace(/^admin\./, "")}/api/lodgify/webhook`);
    }
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = logs.filter((l) => {
    if (filter === "errors") return l.status_code >= 400;
    if (filter === "success") return l.status_code < 400;
    return true;
  });

  const last24h = logs.filter(
    (l) => Date.now() - new Date(l.received_at).getTime() < 24 * 60 * 60 * 1000
  );
  const errorCount = last24h.filter((l) => l.status_code >= 400).length;
  const successCount = last24h.filter((l) => l.outcome === "sync_ok").length;
  const skippedCount = last24h.filter((l) => l.outcome === "sync_skipped").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lodgify Webhooks</h1>
        <p className="text-muted-foreground">
          Incoming webhooks from Lodgify and outgoing SMS notifications to cleaners.
        </p>
      </div>

      <Tabs defaultValue="webhooks">
        <TabsList>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="sms">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            SMS Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sms" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Every SMS sent to cleaners — most recent first.</p>
            <Button variant="outline" size="sm" onClick={() => loadSmsLogs(false)} disabled={smsRefreshing}>
              {smsRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
          {smsLoading ? (
            <p className="text-muted-foreground text-sm">Loading SMS logs...</p>
          ) : smsLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No SMS sent yet</p>
                <p className="text-sm text-muted-foreground">Texts will appear here when bookings trigger cleaner notifications.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {smsLogs.map((log) => (
                <Card key={log.id} className={!log.success ? "border-red-200" : ""}>
                  <CardContent className="py-3 px-4 flex items-start gap-3">
                    {log.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {log.recipient_name ?? log.recipient_phone}
                        </span>
                        {log.recipient_name && (
                          <span className="text-xs text-muted-foreground">{log.recipient_phone}</span>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {log.event_type.replace("cleaner_", "").replace(/_/g, " ")}
                        </Badge>
                        {log.lodgify_booking_id && (
                          <span className="text-xs text-muted-foreground">#{log.lodgify_booking_id}</span>
                        )}
                        {log.quota_remaining !== null && (
                          <span className="text-xs text-muted-foreground ml-auto">{log.quota_remaining} credits left</span>
                        )}
                      </div>
                      {log.property && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {log.property.nickname ?? log.property.name}
                        </p>
                      )}
                      {log.error && (
                        <p className="text-xs text-red-600 mt-0.5">{log.error}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{formatTime(log.sent_at)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4 mt-4">
        <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(false)}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
        </div>

      {/* Subscriptions manager */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Subscriptions</h2>
            <p className="text-xs text-muted-foreground">
              Lodgify has no dashboard UI for webhooks — manage them here via their API.
            </p>
          </div>

          {/* Existing subscriptions */}
          <div className="space-y-2">
            {subsLoading ? (
              <p className="text-sm text-muted-foreground">Loading subscriptions...</p>
            ) : subs === null ? null : subs.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded p-3">
                No active subscriptions. Lodgify is not sending any webhooks yet — add one below.
              </p>
            ) : (
              <div className="space-y-1.5">
                {subs.map((s) => (
                  <div
                    key={String(s.id)}
                    className="flex items-center justify-between gap-2 text-sm border rounded p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {s.event}
                        </Badge>
                        <span className="text-xs text-muted-foreground">#{String(s.id)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {s.target_url}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => unsubscribe(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subscribe form */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-end border-t pt-4">
            <div className="space-y-1">
              <Label className="text-xs">Event</Label>
              <Select value={newEvent} onValueChange={(val) => setNewEvent(val ?? "booking_new_any_status")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target URL</Label>
              <Input
                value={newTargetUrl}
                onChange={(e) => setNewTargetUrl(e.target.value)}
                placeholder="https://your-domain/api/lodgify/webhook"
              />
            </div>
            <Button onClick={subscribe} disabled={subscribing || !newTargetUrl.trim()}>
              {subscribing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Subscribe
            </Button>
          </div>

          {subsError && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded p-2">
              {subsError}
            </p>
          )}

          {newSecret && (
            <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded p-3 space-y-2">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Signing secret (shown once) — add to LODGIFY_WEBHOOK_SIGNING_SECRETS
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background p-2 rounded border break-all font-mono">
                  {newSecret}
                </code>
                <Button size="sm" variant="outline" onClick={copySecret}>
                  {copiedSecret ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                If the env var already has a value, append this as a comma-separated entry so old webhooks keep validating during rotation.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats (last 24h) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-bold">{last24h.length}</p>
            <p className="text-xs text-muted-foreground">Received (24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-bold text-green-600">{successCount}</p>
            <p className="text-xs text-muted-foreground">Synced (24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-bold text-gray-600">{skippedCount}</p>
            <p className="text-xs text-muted-foreground">Skipped (24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-bold text-red-600">{errorCount}</p>
            <p className="text-xs text-muted-foreground">Errors (24h)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({logs.length})
        </Button>
        <Button
          variant={filter === "errors" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("errors")}
        >
          Errors only ({logs.filter((l) => l.status_code >= 400).length})
        </Button>
        <Button
          variant={filter === "success" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("success")}
        >
          Success ({logs.filter((l) => l.status_code < 400).length})
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading webhook logs...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium">No webhook events</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {logs.length === 0
                ? "No webhooks have been received yet. Verify that Lodgify is configured to send webhooks to /api/lodgify/webhook."
                : "No events match this filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const config = OUTCOME_CONFIG[log.outcome] ?? OUTCOME_CONFIG.unknown;
            const Icon = config.icon;
            const isExpanded = expanded.has(log.id);
            const hasError = log.status_code >= 400;

            return (
              <Card key={log.id} className={hasError ? "border-red-200" : ""}>
                <button
                  type="button"
                  onClick={() => toggle(log.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        hasError
                          ? "text-red-500"
                          : log.outcome === "sync_ok"
                            ? "text-green-500"
                            : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                          {config.label}
                        </Badge>
                        <span className="text-sm font-medium">
                          {log.action ?? "(no action)"}
                        </span>
                        {log.lodgify_booking_id && (
                          <span className="text-sm text-muted-foreground">
                            #{log.lodgify_booking_id}
                          </span>
                        )}
                        {log.skip_reason && (
                          <span className="text-xs text-muted-foreground">
                            · {log.skip_reason}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {log.status_code} · {log.duration_ms ?? 0}ms
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="text-xs text-red-600 mt-1 truncate">
                          {log.error_message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatTime(log.received_at)}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <>
                    <Separator />
                    <CardContent className="pt-4 space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>
                          <span className="text-muted-foreground">Signature:</span>{" "}
                          {log.signature_present ? (
                            log.signature_valid === true ? (
                              <span className="text-green-600">valid</span>
                            ) : log.signature_valid === false ? (
                              <span className="text-red-600">invalid</span>
                            ) : (
                              <span className="text-amber-600">not verified (no secret set)</span>
                            )
                          ) : (
                            <span className="text-red-600">missing</span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Outcome:</span>{" "}
                          {log.outcome}
                        </div>
                      </div>

                      {log.error_message && (
                        <div>
                          <p className="text-muted-foreground mb-1">Error</p>
                          <pre className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-2 rounded font-mono whitespace-pre-wrap break-all">
                            {log.error_message}
                          </pre>
                        </div>
                      )}

                      <div>
                        <p className="text-muted-foreground mb-1">Payload</p>
                        <pre className="bg-muted p-2 rounded font-mono whitespace-pre-wrap break-all max-h-96 overflow-auto">
                          {JSON.stringify(log.raw_payload, null, 2)}
                        </pre>
                      </div>

                      {log.headers && (
                        <div>
                          <p className="text-muted-foreground mb-1">Headers</p>
                          <pre className="bg-muted p-2 rounded font-mono whitespace-pre-wrap break-all max-h-64 overflow-auto">
                            {JSON.stringify(log.headers, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
