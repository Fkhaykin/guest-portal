"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Check, X, User } from "lucide-react";

interface ContactValues {
  full_name: string;
  email: string;
  phone: string;
  mailing_address: string;
}

interface Props {
  registrationId: string;
  guestId: string;
  initial: ContactValues;
}

export function EditContactForm({ registrationId, guestId, initial }: Props) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ContactValues>(initial);
  const [savedValues, setSavedValues] = useState<ContactValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function set<K extends keyof ContactValues>(key: K, val: ContactValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function cancel() {
    setValues(savedValues);
    setEditing(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/guest/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          guest_id: guestId,
          full_name: values.full_name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || null,
          mailing_address: values.mailing_address.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save");
        return;
      }
      setSavedValues(values);
      setEditing(false);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4" />
            Your details
          </div>
          {!editing ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={cancel} disabled={saving}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                Save
              </Button>
            </div>
          )}
        </div>

        {!editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <ReadRow label="Name" value={savedValues.full_name || "—"} />
            <ReadRow label="Email" value={savedValues.email || "—"} />
            <ReadRow label="Phone" value={savedValues.phone || "—"} />
            <ReadRow label="Mailing address" value={savedValues.mailing_address || "—"} wide />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="text-xs text-muted-foreground">Name</Label>
              <Input id="full_name" value={values.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs text-muted-foreground">Phone</Label>
              <Input id="phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mailing_address" className="text-xs text-muted-foreground">Mailing address</Label>
              <Textarea
                id="mailing_address"
                rows={2}
                value={values.mailing_address}
                onChange={(e) => set("mailing_address", e.target.value)}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {savedAt && <p className="text-xs text-muted-foreground">Saved.</p>}
      </CardContent>
    </Card>
  );
}

function ReadRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="font-medium whitespace-pre-wrap">{value}</p>
    </div>
  );
}
