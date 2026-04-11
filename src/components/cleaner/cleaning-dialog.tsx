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
  MapPin,
  ArrowLeft,
} from "lucide-react";
import type { CleaningPhoto, CleaningPhotoExif } from "@/types/database";

type PhotoWithPreview = CleaningPhoto & { previewUrl: string };

function formatExifSummary(exif: CleaningPhotoExif): string {
  const ownerOrCamera = exif.camera || "Unknown device";
  const time = exif.taken_at
    ? new Date(exif.taken_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;
  const date = exif.taken_at
    ? new Date(exif.taken_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  let summary = `Shot with ${ownerOrCamera}`;
  if (time) summary += ` at ${time}`;
  if (date) summary += ` on ${date}`;
  return summary;
}

function ExifDetailScreen({
  photo,
  onBack,
}: {
  photo: PhotoWithPreview;
  onBack: () => void;
}) {
  const exif = photo.exif!;
  return (
    <div className="fixed inset-0 z-100 bg-background flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <button onClick={onBack} className="p-1 -ml-1 rounded-md hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-semibold text-sm">Photo Details</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-lg overflow-hidden border bg-muted">
          <img
            src={photo.previewUrl}
            alt={photo.room}
            className="w-full max-h-48 object-cover"
          />
        </div>

        {/* Map */}
        {exif.latitude != null && exif.longitude != null && (
          <div className="rounded-lg overflow-hidden border h-48">
            <iframe
              title="Photo location"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${exif.longitude! - 0.003},${exif.latitude! - 0.002},${exif.longitude! + 0.003},${exif.latitude! + 0.002}&layer=mapnik&marker=${exif.latitude},${exif.longitude}`}
            />
          </div>
        )}

        {/* EXIF breakdown */}
        <div className="rounded-lg border divide-y text-sm">
          {exif.taken_at && (
            <div className="flex justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Date & Time</span>
              <span className="font-medium">
                {new Date(exif.taken_at).toLocaleString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                  hour: "numeric", minute: "2-digit",
                })}
              </span>
            </div>
          )}
          {exif.camera && (
            <div className="flex justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Device</span>
              <span className="font-medium">{exif.camera}</span>
            </div>
          )}
          {exif.latitude != null && exif.longitude != null && (
            <div className="flex justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Location</span>
              <span className="font-medium font-mono text-xs">
                {exif.latitude.toFixed(6)}, {exif.longitude.toFixed(6)}
              </span>
            </div>
          )}
          {exif.width && exif.height && (
            <div className="flex justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Resolution</span>
              <span className="font-medium">{exif.width} × {exif.height}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compress an image file to JPEG, resizing if needed to stay under maxBytes. */
async function compressImage(
  file: File,
  maxWidth = 2048,
  maxBytes = 3 * 1024 * 1024 // 3MB — safely under Vercel's 4.5MB body limit
): Promise<File> {
  // HEIC/HEIF can't be drawn to canvas — skip compression, rely on server validation
  if (file.type === "image/heic" || file.type === "image/heif") return file;
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Try decreasing quality until under maxBytes
  let quality = 0.85;
  let blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  }

  const name = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([blob], name, { type: "image/jpeg" });
}

function UploadError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

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
  const [photos, setPhotos] = useState<PhotoWithPreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const activeRoomRef = useRef<string | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [exifDetailPhoto, setExifDetailPhoto] = useState<PhotoWithPreview | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Track per-area upload progress: { room: { total, completed } }
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, { total: number; completed: number }>
  >({});

  const photosPerArea = areas.reduce<Record<string, PhotoWithPreview[]>>((acc, area) => {
    acc[area] = photos.filter((p) => p.room === area);
    return acc;
  }, {});

  const hasAnyPhotos = photos.length > 0;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    const room = activeRoomRef.current;
    if (!files || files.length === 0 || !room) return;

    // Copy files BEFORE clearing input — mobile Safari invalidates the FileList on reset
    const rawFiles = Array.from(files);
    e.target.value = "";

    activeRoomRef.current = null;
    setUploadError(null);
    const total = rawFiles.length;
    setUploadProgress((prev) => ({ ...prev, [room]: { total, completed: 0 } }));

    for (let i = 0; i < rawFiles.length; i++) {
      try {
        let file: File;
        try {
          file = await compressImage(rawFiles[i]);
        } catch {
          file = rawFiles[i]; // compression failed — upload original
        }
        const previewUrl = URL.createObjectURL(file);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("registration_id", registrationId);
        formData.append("room", room);

        const res = await fetch("/api/cleaner/upload-photo", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setPhotos((prev) => [...prev, { ...data.photo, previewUrl }]);
        } else {
          URL.revokeObjectURL(previewUrl);
          const text = await res.text();
          let errorMsg = `Upload failed (${res.status})`;
          try {
            const data = JSON.parse(text);
            if (data?.error) errorMsg = data.error;
          } catch {
            // non-JSON response
          }
          setUploadError(errorMsg);
        }
      } catch {
        setUploadError("Network error — check your connection and try again");
      }

      setUploadProgress((prev) => ({
        ...prev,
        [room]: { total, completed: i + 1 },
      }));
    }

    setUploadProgress((prev) => {
      const next = { ...prev };
      delete next[room];
      return next;
    });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const photo = prev[index];
      URL.revokeObjectURL(photo.previewUrl);

      // Remove from server
      fetch("/api/cleaner/delete-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          path: photo.path,
        }),
      });

      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit() {
    setSubmitting(true);

    // Photos are already saved per-upload; attach notes and mark complete
    const photosWithNotes = photos.map((p) => ({
      room: p.room,
      path: p.path,
      uploaded_at: p.uploaded_at,
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
          {uploadError && (
            <UploadError message={uploadError} onDismiss={() => setUploadError(null)} />
          )}

          <p className="text-sm text-muted-foreground">
            Optionally upload photos to document the cleaning.
          </p>

          {areas.map((area) => {
            const areaPhotos = photosPerArea[area] || [];
            const progress = uploadProgress[area];
            const isUploading = !!progress;

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
                      Optional
                    </Badge>
                  )}
                </div>

                {/* Uploaded photo rows with EXIF details */}
                {areaPhotos.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {areaPhotos.map((photo, i) => {
                      const globalIdx = photos.indexOf(photo);
                      return (
                        <div key={i} className="flex items-start gap-3 rounded-lg border p-2 bg-muted/30">
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setFullscreenUrl(photo.previewUrl)}
                              className="w-16 h-16 rounded-lg overflow-hidden border bg-muted block"
                            >
                              <img
                                src={photo.previewUrl}
                                alt={photo.room}
                                className="w-full h-full object-cover"
                              />
                            </button>
                            <button
                              onClick={() => removePhoto(globalIdx)}
                              className="absolute -top-1.5 -right-1.5 bg-black/70 text-white rounded-full p-0.5"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex-1 min-w-0 py-0.5">
                            {photo.exif ? (
                              <>
                                <p className="text-xs text-foreground leading-relaxed">
                                  {formatExifSummary(photo.exif)}
                                </p>
                                {photo.exif.latitude != null && (
                                  <button
                                    type="button"
                                    onClick={() => setExifDetailPhoto(photo)}
                                    className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <MapPin className="h-3 w-3" />
                                    View details & map
                                  </button>
                                )}
                                {!photo.exif.latitude && (
                                  <button
                                    type="button"
                                    onClick={() => setExifDetailPhoto(photo)}
                                    className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    View details
                                  </button>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                No metadata available
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Upload progress bar */}
                {isUploading && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading {progress.completed}/{progress.total}
                      </span>
                      <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Upload button — label wraps a per-area file input so the
                    tap is a direct user gesture (required on mobile Safari) */}
                <label
                  className={`flex items-center gap-2 w-full px-3 py-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors text-sm text-muted-foreground cursor-pointer ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <Camera className="h-4 w-4" />
                  {areaPhotos.length > 0
                    ? "Add more photos"
                    : "Take or upload photos"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      activeRoomRef.current = area;
                      handleFileSelect(e);
                    }}
                  />
                </label>

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

          <Separator />

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Complete Cleaning
              </>
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

      {/* EXIF detail screen */}
      {exifDetailPhoto && (
        <ExifDetailScreen
          photo={exifDetailPhoto}
          onBack={() => setExifDetailPhoto(null)}
        />
      )}
    </Dialog>
  );
}
