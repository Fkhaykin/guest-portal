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
  AlertTriangle,
  PawPrint,
  Plus,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { CleaningPhoto, CleaningPhotoExif } from "@/types/database";
import { buildClientExif, compressImage, DEFAULT_PHOTO_AREAS } from "@/lib/cleaner/photo-upload";

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
            <ExifRow label="Color Space" value={
              exif.color_space == null ? undefined
              : exif.color_space === "1" ? "sRGB"
              : exif.color_space === "2" ? "Adobe RGB"
              : exif.color_space === "65535" ? "Uncalibrated"
              : exif.color_space
            } />
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

export type DamageReport = {
  description: string;
  photos: { path: string; previewUrl: string }[];
};

export type PetReport = {
  description: string;
  count: number;
  labels: { kind: string }[];
};

const PET_KIND_OPTIONS = ["Dog", "Cat", "Bird", "Rabbit", "Other"];

export function CleaningDialog({
  open,
  onOpenChange,
  registrationId,
  propertyName,
  checkOutDate,
  photoAreas,
  expectedPetCount,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  propertyName: string;
  checkOutDate: string;
  photoAreas: string[] | null;
  expectedPetCount?: number;
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

  const [cleanedOnDate, setCleanedOnDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  // Damage report state
  const [reportDamage, setReportDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState("");
  const [damagePhotos, setDamagePhotos] = useState<{ path: string; previewUrl: string }[]>([]);
  const [damageUploading, setDamageUploading] = useState(false);

  // Pet report state
  const [reportPets, setReportPets] = useState(false);
  const [petDescription, setPetDescription] = useState("");
  const [petLabels, setPetLabels] = useState<{ kind: string }[]>([{ kind: "Dog" }]);

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

        // Extract EXIF from the original file before compression strips it,
        // filling gaps with browser-derived data.
        const clientExif = await buildClientExif(rawFiles[i]);

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

  async function handleDamagePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const rawFiles = Array.from(files);
    e.target.value = "";
    setDamageUploading(true);

    for (const rawFile of rawFiles) {
      try {
        let file: File;
        try { file = await compressImage(rawFile); } catch { file = rawFile; }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("registration_id", registrationId);

        const res = await fetch("/api/cleaner/upload-damage-photo", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setDamagePhotos((prev) => [...prev, { path: data.path, previewUrl: URL.createObjectURL(file) }]);
        }
      } catch {
        // upload failed
      }
    }
    setDamageUploading(false);
  }

  function removeDamagePhoto(index: number) {
    setDamagePhotos((prev) => {
      const photo = prev[index];
      URL.revokeObjectURL(photo.previewUrl);
      // Delete from server
      fetch("/api/cleaner/delete-damage-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId, path: photo.path }),
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
      ...(p.exif && { exif: p.exif }),
      note: notes[p.room] || undefined,
    }));

    const body: Record<string, unknown> = {
      registration_id: registrationId,
      is_cleaned: true,
      cleaned_at: new Date(cleanedOnDate + "T00:00:00").toISOString(),
      photos: photosWithNotes,
    };

    // Attach damage report
    if (reportDamage && damageDescription.trim()) {
      body.damage_report = {
        description: damageDescription.trim(),
        photos: damagePhotos.map((p) => p.path),
      };
    }

    // Attach pet report
    if (reportPets && petLabels.length > 0) {
      body.pet_report = {
        description: petDescription.trim(),
        count: petLabels.length,
        labels: petLabels.map((l) => l.kind),
        expected_pet_count: expectedPetCount ?? 0,
      };
    }

    await fetch("/api/cleaner/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

          {/* Damage Report Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="report-damage"
                checked={reportDamage}
                onCheckedChange={(checked) => setReportDamage(checked === true)}
              />
              <label
                htmlFor="report-damage"
                className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
              >
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Report damages that occurred during this stay
              </label>
            </div>

            {reportDamage && (
              <div className="ml-6 space-y-3 p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
                <textarea
                  placeholder="Describe the damages..."
                  value={damageDescription}
                  onChange={(e) => setDamageDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-background placeholder:text-muted-foreground/60 resize-none"
                />

                {/* Damage photos */}
                {damagePhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {damagePhotos.map((photo, i) => (
                      <div key={i} className="relative">
                        <img
                          src={photo.previewUrl}
                          alt={`Damage ${i + 1}`}
                          className="w-16 h-16 rounded-lg object-cover border"
                        />
                        <button
                          onClick={() => removeDamagePhoto(i)}
                          className="absolute -top-1.5 -right-1.5 bg-black/70 text-white rounded-full p-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className={`flex items-center gap-2 w-full px-3 py-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors text-sm text-muted-foreground cursor-pointer ${damageUploading ? "opacity-50 pointer-events-none" : ""}`}>
                  {damageUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {damagePhotos.length > 0 ? "Add more damage photos" : "Upload damage photos"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    className="sr-only"
                    onChange={handleDamagePhotoSelect}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Pet Report Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="report-pets"
                checked={reportPets}
                onCheckedChange={(checked) => setReportPets(checked === true)}
              />
              <label
                htmlFor="report-pets"
                className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
              >
                <PawPrint className="h-4 w-4 text-amber-500" />
                This reservation had pets
              </label>
            </div>

            {reportPets && (
              <div className="ml-6 space-y-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
                {expectedPetCount != null && (
                  <p className="text-xs text-muted-foreground">
                    Expected pets on booking: <span className="font-medium">{expectedPetCount}</span>
                  </p>
                )}

                {/* Pet labels list */}
                <div className="space-y-2">
                  {petLabels.map((pet, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                      <select
                        value={pet.kind}
                        onChange={(e) => {
                          const next = [...petLabels];
                          next[i] = { kind: e.target.value };
                          setPetLabels(next);
                        }}
                        className="flex-1 px-3 py-2 rounded-lg border text-sm bg-background"
                      >
                        {PET_KIND_OPTIONS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                      {petLabels.length > 1 && (
                        <button
                          onClick={() => setPetLabels((prev) => prev.filter((_, idx) => idx !== i))}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPetLabels((prev) => [...prev, { kind: "Dog" }])}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another pet
                </button>

                <textarea
                  placeholder="Additional notes about pets (optional)"
                  value={petDescription}
                  onChange={(e) => setPetDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-background placeholder:text-muted-foreground/60 resize-none"
                />
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="cleaned-on-date">
              Cleaned on
            </label>
            <input
              id="cleaned-on-date"
              type="date"
              value={cleanedOnDate}
              max={(() => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              })()}
              onChange={(e) => setCleanedOnDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm bg-background"
            />
          </div>

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
