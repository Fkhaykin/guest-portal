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
  ImageIcon,
} from "lucide-react";
import type { CleaningPhoto } from "@/types/database";

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
  const [photos, setPhotos] = useState<CleaningPhoto[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  const photosPerArea = areas.reduce<Record<string, CleaningPhoto[]>>((acc, area) => {
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

    await fetch("/api/cleaner/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_id: registrationId,
        is_cleaned: true,
        photos,
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
                          className="relative w-16 h-16 rounded-lg bg-muted flex items-center justify-center border overflow-hidden group"
                        >
                          <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                          <button
                            onClick={() => removePhoto(globalIdx)}
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
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
              </div>
            );
          })}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
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
    </Dialog>
  );
}
