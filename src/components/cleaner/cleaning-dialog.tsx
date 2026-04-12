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
import exifr from "exifr";
import type { CleaningPhoto, CleaningPhotoExif } from "@/types/database";

type PhotoWithPreview = CleaningPhoto & { previewUrl: string };

/** Get current GPS position from the browser (cached for 5 min). */
let cachedPosition: { latitude: number; longitude: number; ts: number } | null = null;
function getBrowserLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (cachedPosition && Date.now() - cachedPosition.ts < 300_000) {
    return Promise.resolve({ latitude: cachedPosition.latitude, longitude: cachedPosition.longitude });
  }
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedPosition = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, ts: Date.now() };
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 300_000 }
    );
  });
}

/** Parse device name from userAgent string. */
function getDeviceName(): string {
  const ua = navigator.userAgent;
  const iosMatch = ua.match(/(iPhone|iPad)/);
  if (iosMatch) return iosMatch[1];
  const androidMatch = ua.match(/;\s*([^;)]+?)\s*(?:Build|MIUI)/);
  if (androidMatch) return androidMatch[1].trim();
  return "Unknown device";
}

function getOSName(): string {
  const ua = navigator.userAgent;
  const iosVer = ua.match(/OS (\d+[_.\d]*)/);
  if (iosVer) return `iOS ${iosVer[1].replace(/_/g, ".")}`;
  const androidVer = ua.match(/Android ([\d.]+)/);
  if (androidVer) return `Android ${androidVer[1]}`;
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown OS";
}

function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("CriOS")) return "Chrome (iOS)";
  if (ua.includes("FxiOS")) return "Firefox (iOS)";
  if (ua.includes("EdgiOS") || ua.includes("Edg/")) return "Edge";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  return "Unknown browser";
}

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

function ExifRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 px-3 py-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-all">{String(value)}</span>
    </div>
  );
}

function ExifDetailScreen({
  photo,
  onBack,
}: {
  photo: PhotoWithPreview;
  onBack: () => void;
}) {
  const exif = photo.exif ?? {};
  const formatBytes = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="fixed inset-0 z-100 bg-background flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <button onClick={onBack} className="p-1 -ml-1 rounded-md hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-semibold text-sm">Photo Details — {photo.room}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Full photo */}
        <div className="rounded-lg overflow-hidden border bg-muted">
          <img
            src={photo.previewUrl}
            alt={photo.room}
            className="w-full object-contain max-h-[50vh]"
          />
        </div>

        {/* Source badge */}
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
            exif.source === "exif" ? "bg-green-100 text-green-700" : exif.source === "mixed" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
          }`}>
            {exif.source === "exif" ? "From photo EXIF" : exif.source === "mixed" ? "EXIF + Browser" : "Captured by browser"}
          </span>
        </div>

        {/* Date & Location */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Date & Location</h3>
          <div className="rounded-lg border divide-y text-sm">
            <ExifRow label="Date & Time" value={exif.taken_at ? new Date(exif.taken_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) : undefined} />
            <ExifRow label="Latitude" value={exif.latitude?.toFixed(6)} />
            <ExifRow label="Longitude" value={exif.longitude?.toFixed(6)} />
            <ExifRow label="Altitude" value={exif.altitude != null ? `${exif.altitude.toFixed(1)}m` : undefined} />
          </div>
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

        {/* Camera & Lens */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Camera</h3>
          <div className="rounded-lg border divide-y text-sm">
            <ExifRow label="Device" value={exif.camera} />
            <ExifRow label="Lens" value={exif.lens} />
            <ExifRow label="ISO" value={exif.iso} />
            <ExifRow label="Aperture" value={exif.aperture != null ? `f/${exif.aperture}` : undefined} />
            <ExifRow label="Shutter Speed" value={exif.shutter_speed != null ? `${exif.shutter_speed}s` : undefined} />
            <ExifRow label="Focal Length" value={exif.focal_length} />
            <ExifRow label="Flash" value={exif.flash} />
            <ExifRow label="Exposure Mode" value={exif.exposure_mode} />
            <ExifRow label="White Balance" value={exif.white_balance} />
            <ExifRow label="Scene Type" value={exif.scene_type} />
            <ExifRow label="Software" value={exif.software} />
          </div>
        </div>

        {/* Image */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Image</h3>
          <div className="rounded-lg border divide-y text-sm">
            <ExifRow label="Resolution" value={exif.width && exif.height ? `${exif.width} × ${exif.height}` : undefined} />
            <ExifRow label="Color Space" value={exif.color_space} />
            <ExifRow label="Orientation" value={exif.orientation} />
            <ExifRow label="File Type" value={exif.file_type} />
            <ExifRow label="File Size" value={exif.file_size ? formatBytes(exif.file_size) : undefined} />
          </div>
        </div>

        {/* Upload Context */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Upload Context</h3>
          <div className="rounded-lg border divide-y text-sm">
            <ExifRow label="Uploaded" value={new Date(photo.uploaded_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} />
            <ExifRow label="Device" value={exif.device_name} />
            <ExifRow label="OS" value={exif.os} />
            <ExifRow label="Browser" value={exif.browser} />
          </div>
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

        // Extract EXIF from the ORIGINAL file before compression strips it
        const clientExif: CleaningPhotoExif = {};
        let hasRealExif = false;
        try {
          const d = await exifr.parse(rawFiles[i], true); // true = all segments
          if (d) {
            const dt = d.DateTimeOriginal ?? d.DateTimeDigitized ?? d.ModifyDate ?? d.CreateDate;
            if (dt) { clientExif.taken_at = dt instanceof Date ? dt.toISOString() : String(dt); hasRealExif = true; }
            if (d.latitude != null && d.longitude != null) {
              clientExif.latitude = d.latitude;
              clientExif.longitude = d.longitude;
              hasRealExif = true;
            }
            if (d.GPSAltitude != null) clientExif.altitude = d.GPSAltitude;
            const make = d.Make; const model = d.Model;
            if (make || model) { clientExif.camera = [make, model].filter(Boolean).join(" "); hasRealExif = true; }
            if (d.LensModel || d.LensMake) clientExif.lens = [d.LensMake, d.LensModel].filter(Boolean).join(" ");
            const w = d.ExifImageWidth ?? d.ImageWidth;
            const h = d.ExifImageHeight ?? d.ImageHeight;
            if (w) clientExif.width = w;
            if (h) clientExif.height = h;
            if (d.ISO ?? d.ISOSpeedRatings) clientExif.iso = d.ISO ?? d.ISOSpeedRatings;
            if (d.FNumber) clientExif.aperture = d.FNumber;
            if (d.ExposureTime != null) {
              clientExif.shutter_speed = d.ExposureTime < 1 ? `1/${Math.round(1 / d.ExposureTime)}` : `${d.ExposureTime}`;
            }
            if (d.FocalLength) clientExif.focal_length = `${d.FocalLength}mm${d.FocalLengthIn35mmFormat ? ` (${d.FocalLengthIn35mmFormat}mm eq)` : ""}`;
            if (d.Flash != null) clientExif.flash = typeof d.Flash === "object" ? JSON.stringify(d.Flash) : String(d.Flash);
            if (d.Orientation) clientExif.orientation = d.Orientation;
            if (d.Software) clientExif.software = d.Software;
            if (d.ColorSpace != null) clientExif.color_space = String(d.ColorSpace);
            if (d.WhiteBalance != null) clientExif.white_balance = d.WhiteBalance === 0 ? "Auto" : "Manual";
            if (d.ExposureMode != null) clientExif.exposure_mode = d.ExposureMode === 0 ? "Auto" : d.ExposureMode === 1 ? "Manual" : String(d.ExposureMode);
            if (d.SceneCaptureType != null) {
              const scenes = ["Standard", "Landscape", "Portrait", "Night"];
              clientExif.scene_type = scenes[d.SceneCaptureType] ?? String(d.SceneCaptureType);
            }
          }
        } catch {
          // EXIF extraction failed
        }

        // Always capture: file metadata, browser context
        clientExif.file_type = rawFiles[i].type || "unknown";
        clientExif.file_size = rawFiles[i].size;

        // Fill gaps with browser data when iOS strips EXIF
        let usedBrowserFallback = false;
        if (!clientExif.taken_at) { clientExif.taken_at = new Date().toISOString(); usedBrowserFallback = true; }
        if (clientExif.latitude == null) {
          const loc = await getBrowserLocation();
          if (loc) {
            clientExif.latitude = loc.latitude;
            clientExif.longitude = loc.longitude;
            usedBrowserFallback = true;
          }
        }
        if (!clientExif.camera) { clientExif.camera = getDeviceName(); usedBrowserFallback = true; }
        clientExif.device_name = getDeviceName();
        clientExif.os = getOSName();
        clientExif.browser = getBrowserName();
        clientExif.source = hasRealExif ? (usedBrowserFallback ? "mixed" : "exif") : "browser";

        const formData = new FormData();
        formData.append("file", file);
        formData.append("registration_id", registrationId);
        formData.append("room", room);
        formData.append("client_exif", JSON.stringify(clientExif));

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
                                <button
                                  type="button"
                                  onClick={() => setExifDetailPhoto(photo)}
                                  className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <MapPin className="h-3 w-3" />
                                  {photo.exif.latitude != null ? "View details & map" : "View all details"}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExifDetailPhoto(photo)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                View details
                              </button>
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

                {/* Upload button */}
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
