"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Camera,
  Clock,
  X,
  Loader2,
  MessageSquare,
  Check,
} from "lucide-react";
import type { CleaningPhoto } from "@/types/database";

type PhotoWithUrl = CleaningPhoto & { url?: string | null };

type CleaningData = {
  is_cleaned: boolean;
  cleaned_at: string | null;
  photos: PhotoWithUrl[];
  notes: string | null;
  fulfilled_upsells: string[];
};

export function CleaningPhotosDialog({
  open,
  onOpenChange,
  registrationId,
  guestName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  guestName: string;
}) {
  const [cleaning, setCleaning] = useState<CleaningData | null | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open && cleaning === undefined) {
      setLoading(true);
      fetch(
        `/api/admin/cleaning-photos?registration_id=${registrationId}`
      )
        .then((res) => res.json())
        .then((data) => setCleaning(data.cleaning ?? null))
        .finally(() => setLoading(false));
    }
    if (!open) {
      setCleaning(undefined);
    }
  }, [open, registrationId]);

  // Group photos by room
  const photosByRoom: Record<string, PhotoWithUrl[]> = {};
  if (cleaning?.photos) {
    for (const photo of cleaning.photos) {
      if (!photosByRoom[photo.room]) photosByRoom[photo.room] = [];
      photosByRoom[photo.room].push(photo);
    }
  }

  const cleanedDate = cleaning?.cleaned_at
    ? new Date(cleaning.cleaned_at).toLocaleDateString("en-US", {
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
          <DialogTitle className="text-lg">Cleaning Photos</DialogTitle>
          <p className="text-sm text-muted-foreground">{guestName}</p>
        </DialogHeader>

        <Separator />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : cleaning === null ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No cleaning data for this reservation.
          </p>
        ) : cleaning ? (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-3">
              {cleaning.is_cleaned ? (
                <Badge className="bg-green-600 gap-1">
                  <Check className="h-3 w-3" />
                  Cleaned
                </Badge>
              ) : (
                <Badge variant="outline">Not cleaned</Badge>
              )}
              {cleanedDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {cleanedDate}
                </span>
              )}
            </div>

            {/* Notes */}
            {cleaning.notes && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Cleaner Notes
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {cleaning.notes}
                  </p>
                </div>
              </>
            )}

            {/* Photos */}
            {Object.keys(photosByRoom).length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Camera className="h-4 w-4" />
                    Photos ({cleaning.photos.length})
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
                            onClick={() =>
                              photo.url && setFullscreenUrl(photo.url)
                            }
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
                          </button>
                        ))}
                      </div>
                      {roomPhotos.some((p) => p.note) && (
                        <p className="text-xs text-muted-foreground italic pl-1">
                          {roomPhotos.find((p) => p.note)?.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>

      {/* Fullscreen image viewer */}
      {fullscreenUrl && (
        <div
          className="fixed inset-0 z-100 bg-black/90 flex items-center justify-center"
          onClick={() => setFullscreenUrl(null)}
        >
          <button
            onClick={() => setFullscreenUrl(null)}
            className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-2"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={fullscreenUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain p-4"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Dialog>
  );
}
