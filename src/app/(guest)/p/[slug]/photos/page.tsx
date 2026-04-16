"use client";

import { useState, useEffect, useRef } from "react";
import { useProperty } from "@/hooks/use-property";
import { getGuestToken } from "@/lib/guest-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Upload,
  Trash2,
  Loader2,
  Check,
  Gift,
  Clock,
  ImagePlus,
  X,
} from "lucide-react";

const SESSION_KEY = "guest-portal-session";
const REWARD_THRESHOLD = 3;

type Photo = {
  id: string;
  file_path: string;
  caption: string | null;
  approved: boolean;
  created_at: string;
  url: string | null;
};

type SessionData = {
  guestName: string;
  reservation: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    property: { slug: string };
  };
};

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function PhotoAlbumPage() {
  const property = useProperty();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [rewardClaimed, setRewardClaimed] = useState(false);

  // Upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [rewardJustEarned, setRewardJustEarned] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setError("No active session found. Please look up your booking first.");
      setLoading(false);
      return;
    }
    setRegistrationId(session.reservation.id);
    loadPhotos(session.reservation.id);
  }, []);

  async function loadPhotos(regId: string) {
    const res = await fetch("/api/guest/photos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-token": getGuestToken(),
      },
      body: JSON.stringify({ registration_id: regId }),
    });

    if (res.ok) {
      const data = await res.json();
      setPhotos(data.photos);
      setPhotoCount(data.photo_count);
      setRewardClaimed(data.reward_claimed);
    } else if (res.status === 401) {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setLoading(false);
  }

  async function handleUpload() {
    if (!registrationId || selectedFiles.length === 0) return;
    setUploading(true);
    setUploadSuccess(false);

    let anyReward = false;

    for (const file of selectedFiles) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("registration_id", registrationId);
      if (caption.trim()) fd.append("caption", caption.trim());

      const res = await fetch("/api/guest/upload-photo", {
        method: "POST",
        headers: { "x-guest-token": getGuestToken() },
        body: fd,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reward_earned) anyReward = true;
      }
    }

    setSelectedFiles([]);
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadSuccess(true);
    if (anyReward) {
      setRewardJustEarned(true);
      setRewardClaimed(true);
    }
    setTimeout(() => setUploadSuccess(false), 4000);

    // Reload photos
    await loadPhotos(registrationId);
    setUploading(false);
  }

  async function handleDelete(photoId: string) {
    if (!registrationId) return;
    setDeletingId(photoId);

    const res = await fetch("/api/guest/photos", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-guest-token": getGuestToken(),
      },
      body: JSON.stringify({ registration_id: registrationId, photo_id: photoId }),
    });

    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setPhotoCount((prev) => prev - 1);
    }
    setDeletingId(null);
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1 && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading photo album...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center space-y-2 py-12">
        <Camera className="h-10 w-10 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold tracking-tight">Photo Album</h1>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const photosUntilReward = Math.max(0, REWARD_THRESHOLD - photoCount);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Photo Album</h1>
        <p className="text-muted-foreground text-sm">
          Share your favorite moments from your stay at{" "}
          <span className="font-medium text-foreground">{property.name}</span>
        </p>
      </div>

      {/* Late checkout incentive banner */}
      {rewardJustEarned ? (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 shrink-0">
              <Gift className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">
                You earned a free late check-out!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Thank you for sharing your photos! Your late check-out has been added to your booking.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : rewardClaimed ? (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 shrink-0">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">
                Free late check-out unlocked!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Keep sharing photos — we love seeing your memories!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-3 shrink-0">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                Earn a free late check-out!
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Upload {REWARD_THRESHOLD} photos from your stay to unlock a complimentary late check-out.
                {photosUntilReward > 0 && (
                  <span className="font-medium">
                    {" "}
                    {photosUntilReward} more photo{photosUntilReward !== 1 ? "s" : ""} to go!
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress bar */}
      {!rewardClaimed && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{photoCount} / {REWARD_THRESHOLD} photos</span>
            <span>Free late check-out</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (photoCount / REWARD_THRESHOLD) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImagePlus className="h-5 w-5" />
            Upload Photos
          </CardTitle>
          <CardDescription>
            Share your stay photos. They&apos;ll appear on the property page after review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Photos</Label>
            <label className="flex flex-col items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed border-input p-6 hover:bg-accent/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""} selected`
                    : "Tap to select photos"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, WebP, or HEIC — up to 10MB each
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                onChange={handleFilesSelected}
              />
            </label>
          </div>

          {/* File previews */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {selectedFiles.map((file, i) => (
                <div key={i} className="relative group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Input
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="A beautiful sunset on the lake..."
              maxLength={200}
            />
          </div>

          {uploadSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Photos uploaded successfully!
            </div>
          )}

          <Button
            className="w-full"
            disabled={uploading || selectedFiles.length === 0}
            onClick={handleUpload}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {selectedFiles.length > 0 ? `${selectedFiles.length} Photo${selectedFiles.length !== 1 ? "s" : ""}` : "Photos"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Existing photos */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            Your Photos ({photos.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                {photo.url ? (
                  <img
                    src={photo.url}
                    alt={photo.caption || "Guest photo"}
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full aspect-square bg-muted rounded-xl flex items-center justify-center">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute top-2 left-2">
                  <Badge
                    variant="secondary"
                    className={
                      photo.approved
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px]"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px]"
                    }
                  >
                    {photo.approved ? "Approved" : "Pending review"}
                  </Badge>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  disabled={deletingId === photo.id}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  {deletingId === photo.id ? (
                    <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-white" />
                  )}
                </button>

                {/* Caption */}
                {photo.caption && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 px-1">
                    {photo.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
