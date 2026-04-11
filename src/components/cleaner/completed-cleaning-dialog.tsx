"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Camera,
  Clock,
  X,
  Loader2,
  MessageSquare,
  Send,
  Check,
  MapPin,
  Info,
} from "lucide-react";
import type { CleaningPhoto, CleaningPhotoExif } from "@/types/database";

type PhotoWithUrl = CleaningPhoto & { url?: string | null };

type CleaningDetails = {
  registration_id: string;
  is_cleaned: boolean;
  cleaned_at: string | null;
  photos: PhotoWithUrl[];
  notes: string | null;
  fulfilled_upsells: string[];
};

export function CompletedCleaningDialog({
  open,
  onOpenChange,
  registrationId,
  propertyName,
  checkIn,
  checkOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
}) {
  const [details, setDetails] = useState<CleaningDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<PhotoWithUrl | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    if (open && !details) {
      setLoading(true);
      fetch(`/api/cleaner/cleaning-details?registration_id=${registrationId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setDetails(data);
            setAdditionalNotes(data.notes || "");
          }
        })
        .finally(() => setLoading(false));
    }
    if (!open) {
      setDetails(null);
      setNotesSaved(false);
    }
  }, [open, registrationId]);

  // Group photos by room
  const photosByRoom: Record<string, PhotoWithUrl[]> = {};
  if (details?.photos) {
    for (const photo of details.photos) {
      if (!photosByRoom[photo.room]) photosByRoom[photo.room] = [];
      photosByRoom[photo.room].push(photo);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const res = await fetch("/api/cleaner/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          notes: additionalNotes || null,
        }),
      });
      if (res.ok) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  const cleanedDate = details?.cleaned_at
    ? new Date(details.cleaned_at).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Cleaning Details</DialogTitle>
          <p className="text-sm text-muted-foreground">{propertyName}</p>
        </DialogHeader>

        <Separator />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : details ? (
          <div className="space-y-4">
            {/* Cleaning info */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {new Date(checkIn + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" - "}
                  {new Date(checkOut + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              {cleanedDate && (
                <div className="flex items-center gap-1.5 text-green-600">
                  <Check className="h-4 w-4" />
                  <span>Cleaned {cleanedDate}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Photos by room */}
            {Object.keys(photosByRoom).length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Camera className="h-4 w-4" />
                  Photos ({details.photos.length})
                </h3>
                {Object.entries(photosByRoom).map(([room, roomPhotos]) => (
                  <div key={room} className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {room}
                    </h4>
                    <div className="flex gap-2 flex-wrap">
                      {roomPhotos.map((photo, i) => (
                        <button
                          key={i}
                          onClick={() => photo.url && setFullscreenPhoto(photo)}
                          className="relative w-20 h-20 rounded-lg bg-muted border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                        >
                          {photo.url ? (
                            <img
                              src={photo.url}
                              alt={`${room} photo ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                          )}
                          {photo.exif && (
                            <div className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                              <Info className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {/* Show per-room note if any photo has one */}
                    {roomPhotos.some((p) => p.note) && (
                      <p className="text-xs text-muted-foreground italic pl-1">
                        {roomPhotos.find((p) => p.note)?.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No photos uploaded.</p>
            )}

            <Separator />

            {/* Notes section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Notes
              </h3>
              <textarea
                value={additionalNotes}
                onChange={(e) => {
                  setAdditionalNotes(e.target.value);
                  setNotesSaved(false);
                }}
                placeholder="Add notes about this cleaning (damage, issues, items left behind, etc.)"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-background placeholder:text-muted-foreground/60 resize-none"
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={savingNotes || (additionalNotes === (details.notes || "") && !notesSaved)}
                className="gap-1.5"
              >
                {savingNotes ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : notesSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Save Notes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Could not load cleaning details.
          </p>
        )}
      </DialogContent>

      {/* Fullscreen lightbox with EXIF sidebar */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-100 bg-black/95 flex"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            onClick={() => setFullscreenPhoto(null)}
            className="absolute top-4 right-4 z-10 bg-black/60 text-white rounded-full p-2 hover:bg-black/80"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Image area */}
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={fullscreenPhoto.url!}
              alt="Full size"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* EXIF sidebar */}
          {fullscreenPhoto.exif && (
            <div
              className="w-80 shrink-0 bg-background border-l overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 space-y-4">
                <h3 className="font-semibold text-sm">Photo Details</h3>

                {/* Map */}
                {fullscreenPhoto.exif.latitude != null && fullscreenPhoto.exif.longitude != null && (
                  <div className="rounded-lg overflow-hidden border h-44">
                    <iframe
                      title="Photo location"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${fullscreenPhoto.exif.longitude! - 0.003},${fullscreenPhoto.exif.latitude! - 0.002},${fullscreenPhoto.exif.longitude! + 0.003},${fullscreenPhoto.exif.latitude! + 0.002}&layer=mapnik&marker=${fullscreenPhoto.exif.latitude},${fullscreenPhoto.exif.longitude}`}
                    />
                  </div>
                )}

                {/* EXIF data */}
                <div className="rounded-lg border divide-y text-sm">
                  {fullscreenPhoto.exif.taken_at && (
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Date & Time</p>
                        <p className="font-medium text-sm">
                          {new Date(fullscreenPhoto.exif.taken_at).toLocaleString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                  {fullscreenPhoto.exif.camera && (
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <Camera className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Device</p>
                        <p className="font-medium text-sm">{fullscreenPhoto.exif.camera}</p>
                      </div>
                    </div>
                  )}
                  {fullscreenPhoto.exif.latitude != null && fullscreenPhoto.exif.longitude != null && (
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">GPS Coordinates</p>
                        <p className="font-medium text-sm font-mono">
                          {fullscreenPhoto.exif.latitude.toFixed(6)}, {fullscreenPhoto.exif.longitude.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  )}
                  {fullscreenPhoto.exif.width && fullscreenPhoto.exif.height && (
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Resolution</p>
                        <p className="font-medium text-sm">
                          {fullscreenPhoto.exif.width} × {fullscreenPhoto.exif.height}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload timestamp */}
                <div className="text-xs text-muted-foreground pt-1">
                  Uploaded {new Date(fullscreenPhoto.uploaded_at).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
