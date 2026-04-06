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
  ChevronRight,
  Camera,
  Upload,
  X,
  Loader2,
  ImageIcon,
} from "lucide-react";
import type { CleaningPhoto } from "@/types/database";

const CLEANING_CHECKLIST = [
  // Kitchen
  { room: "Kitchen", item: "Countertops wiped down" },
  { room: "Kitchen", item: "Sink cleaned & dried" },
  { room: "Kitchen", item: "Appliances wiped (microwave, fridge, stove)" },
  { room: "Kitchen", item: "Dishes washed & put away" },
  { room: "Kitchen", item: "Trash emptied & new bag" },
  { room: "Kitchen", item: "Floor swept & mopped" },
  // Living Room
  { room: "Living Room", item: "Surfaces dusted & wiped" },
  { room: "Living Room", item: "Couch cushions fluffed & arranged" },
  { room: "Living Room", item: "Floor vacuumed" },
  { room: "Living Room", item: "Trash & personal items removed" },
  { room: "Living Room", item: "TV remotes placed neatly" },
  // Bedrooms
  { room: "Bedrooms", item: "Beds made with fresh linens" },
  { room: "Bedrooms", item: "Nightstands & surfaces wiped" },
  { room: "Bedrooms", item: "Closets checked & emptied" },
  { room: "Bedrooms", item: "Floor vacuumed" },
  { room: "Bedrooms", item: "Trash emptied" },
  // Bathrooms
  { room: "Bathrooms", item: "Toilet cleaned inside & out" },
  { room: "Bathrooms", item: "Shower/tub scrubbed" },
  { room: "Bathrooms", item: "Sink & mirror cleaned" },
  { room: "Bathrooms", item: "Fresh towels hung" },
  { room: "Bathrooms", item: "Floor mopped" },
  { room: "Bathrooms", item: "Toiletries restocked" },
  // Outdoor / General
  { room: "Outdoor & General", item: "Porch / deck swept" },
  { room: "Outdoor & General", item: "Grill cleaned (if applicable)" },
  { room: "Outdoor & General", item: "Hot tub checked (if applicable)" },
  { room: "Outdoor & General", item: "Doors & windows locked" },
  { room: "Outdoor & General", item: "Thermostat set to default" },
  { room: "Outdoor & General", item: "All lights off" },
];

const PHOTO_ROOMS = ["Kitchen", "Living Room", "Bedrooms", "Bathrooms", "Outdoor & General"];

type CheckedMap = Record<string, boolean>;

export function CleaningDialog({
  open,
  onOpenChange,
  registrationId,
  propertyName,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  propertyName: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<"checklist" | "photos">("checklist");
  const [checked, setChecked] = useState<CheckedMap>({});
  const [photos, setPhotos] = useState<CleaningPhoto[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  const rooms = [...new Set(CLEANING_CHECKLIST.map((c) => c.room))];
  const allChecked = CLEANING_CHECKLIST.every((c) => checked[`${c.room}:${c.item}`]);

  const photosPerRoom = PHOTO_ROOMS.reduce<Record<string, CleaningPhoto[]>>((acc, room) => {
    acc[room] = photos.filter((p) => p.room === room);
    return acc;
  }, {});

  const allRoomsHavePhotos = PHOTO_ROOMS.every(
    (room) => (photosPerRoom[room]?.length ?? 0) > 0
  );

  function toggleItem(room: string, item: string) {
    const key = `${room}:${item}`;
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function checkAllInRoom(room: string) {
    const items = CLEANING_CHECKLIST.filter((c) => c.room === room);
    const allRoomChecked = items.every((c) => checked[`${c.room}:${c.item}`]);
    const update: CheckedMap = {};
    for (const c of items) {
      update[`${c.room}:${c.item}`] = !allRoomChecked;
    }
    setChecked((prev) => ({ ...prev, ...update }));
  }

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

    const checklist = CLEANING_CHECKLIST.map((c) => ({
      room: c.room,
      item: c.item,
      checked: !!checked[`${c.room}:${c.item}`],
    }));

    await fetch("/api/cleaner/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_id: registrationId,
        is_cleaned: true,
        checklist,
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
          <DialogTitle className="text-lg">
            {step === "checklist" ? "Cleaning Checklist" : "Upload Photos"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{propertyName}</p>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium ${
              step === "checklist"
                ? "bg-primary text-primary-foreground"
                : "bg-green-100 text-green-700"
            }`}
          >
            {step === "photos" && <Check className="h-3 w-3" />}
            1. Checklist
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span
            className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium ${
              step === "photos"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            2. Photos
          </span>
        </div>

        <Separator />

        {step === "checklist" ? (
          <div className="space-y-4">
            {rooms.map((room) => {
              const items = CLEANING_CHECKLIST.filter((c) => c.room === room);
              const roomChecked = items.filter(
                (c) => checked[`${c.room}:${c.item}`]
              ).length;
              const allRoomDone = roomChecked === items.length;

              return (
                <div key={room} className="space-y-1.5">
                  <button
                    onClick={() => checkAllInRoom(room)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h3 className="text-sm font-semibold">{room}</h3>
                    <Badge
                      variant={allRoomDone ? "default" : "secondary"}
                      className={`text-xs ${allRoomDone ? "bg-green-600" : ""}`}
                    >
                      {roomChecked}/{items.length}
                    </Badge>
                  </button>
                  <div className="space-y-0.5">
                    {items.map((c) => {
                      const key = `${c.room}:${c.item}`;
                      const isChecked = !!checked[key];
                      return (
                        <button
                          key={key}
                          onClick={() => toggleItem(c.room, c.item)}
                          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                            isChecked
                              ? "bg-green-50 dark:bg-green-950/20"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div
                            className={`flex items-center justify-center w-5 h-5 rounded border-2 shrink-0 transition-colors ${
                              isChecked
                                ? "bg-green-600 border-green-600"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {isChecked && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <span
                            className={
                              isChecked
                                ? "text-muted-foreground line-through"
                                : ""
                            }
                          >
                            {c.item}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <Separator />

            <Button
              onClick={() => setStep("photos")}
              disabled={!allChecked}
              className="w-full"
            >
              {allChecked ? (
                <>
                  Next: Upload Photos
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                `Complete all items to continue (${
                  Object.values(checked).filter(Boolean).length
                }/${CLEANING_CHECKLIST.length})`
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload at least one photo per area to verify the cleaning.
            </p>

            {PHOTO_ROOMS.map((room) => {
              const roomPhotos = photosPerRoom[room] || [];
              const isUploading = uploading === room;

              return (
                <div key={room} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{room}</h3>
                    {roomPhotos.length > 0 ? (
                      <Badge variant="default" className="text-xs bg-green-600 gap-1">
                        <Check className="h-3 w-3" />
                        {roomPhotos.length} photo{roomPhotos.length > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>

                  {/* Uploaded photos */}
                  {roomPhotos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {roomPhotos.map((photo, i) => {
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
                      setActiveRoom(room);
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
                      : roomPhotos.length > 0
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("checklist")}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!allRoomsHavePhotos || submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Submitting...
                  </>
                ) : allRoomsHavePhotos ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Complete Cleaning
                  </>
                ) : (
                  "Photo required for each area"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
