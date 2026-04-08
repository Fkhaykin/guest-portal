"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Camera,
  X,
  Loader2,
} from "lucide-react";
import type { CleaningPhoto } from "@/types/database";

type PhotoWithUrl = CleaningPhoto & { url?: string | null };

const DEFAULT_PHOTO_AREAS = [
  "Front Yard",
  "Entryway",
  "Living Room",
  "Dining Room",
  "Kitchen",
  "Bedroom 1",
  "Bedroom 2",
  "Bedroom 3",
  "Bedroom 4",
  "Bedroom 5",
  "Bathroom 1",
  "Bathroom 2",
  "Bathroom 3",
  "Bathroom 4",
  "Family Room",
  "Game Room",
  "Deck 1",
  "Deck 2",
  "BBQ Grill",
  "Patio",
  "Hot Tub",
  "Sauna",
  "Lake area",
  "Driveway",
];

export function CleaningDialog({
  open,
  onOpenChange,
  registrationId,
  propertyName,
  checkOutDate,
  photoAreas,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  propertyName: string;
  checkOutDate: string;
  photoAreas: string[] | null;
  onComplete: () => void;
}) {
  const areas = photoAreas && photoAreas.length > 0 ? photoAreas : DEFAULT_PHOTO_AREAS;
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const photosPerArea = areas.reduce<Record<string, PhotoWithUrl[]>>((acc, area) => {
    acc[area] = photos.filter((p) => p.room === area);
    return acc;
  }, {});

  const allAreasHavePhotos = areas.every(
    (area) => (photosPerArea[area]?.length ?? 0) > 0
  );

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;
    e.target.value = "";

    setUploading(activeRoom);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("registration_id", registrationId);
    formData.append("room", activeRoom);

    try {
      const res = await fetch("/api/cleaner/upload-photo", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setPhotos((prev) => [...prev, data.photo]);
      }
    } finally {
      setUploading(null);
      setActiveRoom(null);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSubmitting(true);

    // Attach per-room notes to photos
    const photosWithNotes = photos.map((p) => ({
      ...p,
      note: notes[p.room] || undefined,
    }));

    await fetch("/api/cleaner/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_id: registrationId,
        is_cleaned: true,
        photos: photosWithNotes,
      }),
    });

    setSubmitting(false);
    onOpenChange(false);
    onComplete();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Upload Cleaning Photos</DialogTitle>
          <p className="text-sm text-muted-foreground">{propertyName}</p>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload at least one photo per area to verify the cleaning.
          </p>

          {areas.map((area) => {
            const areaPhotos = photosPerArea[area] || [];
            const isUploading = uploading === area;

            return (
              <div key={area} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{area}</h3>
                  {areaPhotos.length > 0 ? (
                    <Badge variant="default" className="text-xs bg-green-600 gap-1">
                      <Check className="h-3 w-3" />
                      {areaPhotos.length} photo{areaPhotos.length > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>

                {/* Uploaded photos */}
                {areaPhotos.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {areaPhotos.map((photo, i) => {
                      const globalIdx = photos.indexOf(photo);
                      return (
                        <div
                          key={i}
                          className="relative w-16 h-16 rounded-lg bg-muted border overflow-hidden"
                        >
                          {photo.url ? (
                            <button
                              type="button"
                              onClick={() => setFullscreenUrl(photo.url!)}
                              className="w-full h-full"
                            >
                              <img
                                src={photo.url}
                                alt={photo.room}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removePhoto(globalIdx);
                            }}
                            className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Upload button */}
                <button
                  onClick={() => {
                    setActiveRoom(area);
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  className="flex items-center gap-2 w-full px-3 py-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors text-sm text-muted-foreground"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {isUploading
                    ? "Uploading..."
                    : areaPhotos.length > 0
                      ? "Add another photo"
                      : "Take or upload photo"}
                </button>

                {/* Optional note */}
                {areaPhotos.length > 0 && (
                  <input
                    type="text"
                    placeholder="Add a note (optional)"
                    value={notes[area] || ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [area]: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border text-sm bg-background placeholder:text-muted-foreground/60"
                  />
                )}
              </div>
            );
          })}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={handleFileSelect}
          />

          <Separator />

          <Button
            onClick={handleSubmit}
            disabled={!allAreasHavePhotos || submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Submitting...
              </>
            ) : allAreasHavePhotos ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Complete Cleaning
              </>
            ) : (
              "Photo required for each area"
            )}
          </Button>
        </div>
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
