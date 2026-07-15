"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, Copy, Download, ExternalLink, KeyRound, RefreshCw, TabletSmartphone, TriangleAlert } from "lucide-react";

interface KioskInfo {
  token: string;
  url: string;
  start_url: string;
  pin: string;
  rotated_at: string | null;
  svg: string;
}

const SETUP_STEPS = [
  {
    title: "Hardware",
    body: "Fanless mini PC with Windows 11 Pro (Beelink / GMKtec N100 class, ~$120–180) + a touchscreen monitor connected via HDMI for video and USB for touch.",
  },
  {
    title: "Lock the PC to just the kiosk",
    body: "Windows Kiosk Mode (Assigned Access): Settings → Accounts → Other users → Set up a kiosk → choose Microsoft Edge → \"As a public browser\" → paste the kiosk URL above. Windows then boots straight into a locked, full-screen browser nobody can escape — and Edge auto-resets the session after idle (set \"Restart after idle\" to 15 minutes). Requires Windows 11 Pro, which these mini PCs ship with.",
  },
  {
    title: "Touch keyboard",
    body: "Settings → Time & language → Typing → Touch keyboard → enable \"Show the touch keyboard when there's no keyboard attached\", so guests can type in the registration form.",
  },
  {
    title: "Power settings",
    body: "Power plan: never sleep, display always on. In the BIOS, enable \"Restore on AC power loss\" so the kiosk comes back by itself after an outage.",
  },
  {
    title: "Nightly reboot",
    body: "Task Scheduler: restart the PC daily at 4:00 AM. The kiosk page also reloads itself at 4 AM to pick up app updates.",
  },
  {
    title: "Remote rescue",
    body: "Install Chrome Remote Desktop (on the admin account, not the kiosk account) before wall-mounting, so a stuck kiosk can be fixed from home.",
  },
];

export default function AdminKioskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [info, setInfo] = useState<KioskInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/kiosk?property_id=${id}`);
    if (!res.ok) {
      setError("Could not load the kiosk token.");
      return;
    }
    setInfo(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyUrl() {
    if (!info) return;
    await navigator.clipboard.writeText(info.start_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function rotate(target: "token" | "pin") {
    setRotating(true);
    try {
      const res = await fetch("/api/admin/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: id, target }),
      });
      if (res.ok) setInfo(await res.json());
    } finally {
      setRotating(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <TabletSmartphone className="h-7 w-7 text-primary" />
          In-House Kiosk
        </h1>
        <p className="text-muted-foreground mt-1">
          The wall display greets the current guest by name, shows house rules, and opens the
          full guest portal with their booking already loaded.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Kiosk URL</CardTitle>
          <CardDescription>
            This is the secret address the kiosk browser points at. It identifies the house —
            treat it like a key. It carries the device PIN, so the kiosk re-authorizes itself
            after browser resets (the PIN is scrubbed from the address bar on load).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <code className="block break-all rounded-lg bg-muted px-4 py-3 text-sm">
            {info?.start_url ?? "Loading…"}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyUrl} disabled={!info} variant="outline">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy URL"}
            </Button>
            {info && (
              /* preview=1: don't turn the admin's own browser into a kiosk.
                 The pin self-authorizes it past the device gate. */
              <a
                href={`${info.url}?preview=1&pin=${info.pin}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <ExternalLink className="h-4 w-4" />
                Preview in browser
              </a>
            )}
            {info && (
              <a
                href={`/api/admin/kiosk?property_id=${id}&format=png`}
                download
                className={buttonVariants({ variant: "outline" })}
              >
                <Download className="h-4 w-4" />
                Download QR (PNG)
              </a>
            )}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger render={<Button variant="destructive" disabled={!info} />}>
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate the kiosk URL?</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  The current URL stops working immediately on every device that uses it. You
                  will need to update the kiosk browser in this house with the new URL.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={() => rotate("token")} disabled={rotating}>
                    {rotating ? "Regenerating…" : "Regenerate"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Device PIN
          </CardTitle>
          <CardDescription>
            The first time the kiosk URL opens on a new device it asks for this PIN, so a guest
            who reads the URL off the screen can&apos;t open it from home and see other
            reservations. Enter it once per device — or use the URL above, which carries it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <code className="rounded-lg bg-muted px-5 py-3 text-2xl font-bold tracking-[0.4em]">
            {info?.pin ?? "······"}
          </code>
          <Button variant="outline" onClick={() => rotate("pin")} disabled={!info || rotating}>
            <RefreshCw className="h-4 w-4" />
            New PIN
          </Button>
          <p className="basis-full text-xs text-muted-foreground">
            Changing the PIN does not log out devices that are already set up — regenerate the
            URL for that. Remember to update the kiosk&apos;s configured start URL after either
            change.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <Card className="w-fit h-fit">
          <CardHeader>
            <CardTitle className="text-base">Installer QR</CardTitle>
            <CardDescription className="max-w-48">
              Scan on the kiosk device to open the URL during setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {info ? (
              <div
                className="w-44 [&_svg]:h-full [&_svg]:w-full rounded-lg overflow-hidden"
                dangerouslySetInnerHTML={{ __html: info.svg }}
              />
            ) : (
              <div className="w-44 h-44 rounded-lg bg-muted animate-pulse" />
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/40 bg-amber-500/5 h-fit">
          <CardHeader className="flex flex-row items-start gap-3">
            <TriangleAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <CardTitle className="text-base">For installers only</CardTitle>
              <CardDescription>
                Never print or display this QR / URL anywhere guests can see it. Anyone with the
                URL sees whichever guest is currently checked in. If it leaks, hit Regenerate.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Device setup checklist</CardTitle>
          <CardDescription>Touchscreen monitor + Windows mini PC, locked to the kiosk.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {SETUP_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
