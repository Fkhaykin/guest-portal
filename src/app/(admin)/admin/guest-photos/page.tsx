"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Check, Clock, Images, Loader2, Trash2, X } from "lucide-react";
import type { GuestPhotoStatus } from "@/types/database";
import { guestPhotosNav } from "@/lib/admin/nav/guest-photos";

type Photo = {
  id: string;
  property_id: string;
  taken_by_name: string | null;
  status: GuestPhotoStatus;
  created_at: string;
  published_at: string | null;
  property: { name: string; nickname: string | null } | null;
  url: string | null;
};

function houseLabel(p: Photo) {
  return p.property?.nickname || p.property?.name || "Unknown house";
}

export default function GuestPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await guestPhotosNav.get([]);
      if (cancelled) return;
      setPhotos(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function setStatus(id: string, status: GuestPhotoStatus) {
    setBusy(id);
    const res = await fetch("/api/admin/guest-photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      // The prefetch cache holds the pre-mutation list; drop it so navigating
      // away and back within the TTL doesn't re-serve the stale moderation state.
      guestPhotosNav.invalidate();
      if (status === "rejected") {
        setPhotos((prev) => prev.filter((p) => p.id !== id));
      } else {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, status, published_at: status === "published" ? new Date().toISOString() : null }
              : p
          )
        );
      }
    }
    setBusy(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this photo permanently? This cannot be undone.")) return;
    setBusy(id);
    const res = await fetch("/api/admin/guest-photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      guestPhotosNav.invalidate();
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    }
    setBusy(null);
  }

  const pending = photos.filter((p) => p.status === "guest_approved");
  const published = photos.filter((p) => p.status === "published");

  return (
    <div className="space-y-6">
      <PageHeader title="Guest Photos" />

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={Clock} value={pending.length} label="Pending review" tone="warning" />
        <StatCard icon={Check} value={published.length} label="Published" tone="success" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading photos…</p>
      ) : photos.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No guest photos yet"
          description="Photos guests keep at the house kiosk appear here for your approval."
        />
      ) : (
        <div className="space-y-8">
          {/* Pending review */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-warning" /> Pending review
              <Badge variant="outline">{pending.length}</Badge>
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting — you&apos;re all caught up.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {pending.map((p) => (
                  <PhotoCard key={p.id} photo={p} busy={busy === p.id}>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-600/90"
                      disabled={busy === p.id}
                      onClick={() => setStatus(p.id, "published")}
                    >
                      <Check className="mr-1 h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === p.id}
                      onClick={() => setStatus(p.id, "rejected")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={busy === p.id}
                      onClick={() => remove(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </PhotoCard>
                ))}
              </div>
            )}
          </section>

          {/* Published */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Check className="h-5 w-5 text-success" /> Published
              <Badge variant="outline">{published.length}</Badge>
            </h2>
            {published.length === 0 ? (
              <p className="text-sm text-muted-foreground">Approved photos will show up here.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {published.map((p) => (
                  <PhotoCard key={p.id} photo={p} busy={busy === p.id}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={busy === p.id}
                      onClick={() => setStatus(p.id, "guest_approved")}
                    >
                      Unpublish
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={busy === p.id}
                      onClick={() => remove(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </PhotoCard>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function PhotoCard({
  photo,
  busy,
  children,
}: {
  photo: Photo;
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-square bg-muted">
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{houseLabel(photo)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {photo.taken_by_name || "Guest"} ·{" "}
            {new Date(photo.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
