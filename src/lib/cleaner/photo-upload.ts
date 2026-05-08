import exifr from "exifr";
import type { CleaningPhotoExif } from "@/types/database";

let cachedPosition: { latitude: number; longitude: number; ts: number } | null = null;

export function getBrowserLocation(): Promise<{ latitude: number; longitude: number } | null> {
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

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  const iosMatch = ua.match(/(iPhone|iPad)/);
  if (iosMatch) return iosMatch[1];
  const androidMatch = ua.match(/;\s*([^;)]+?)\s*(?:Build|MIUI)/);
  if (androidMatch) return androidMatch[1].trim();
  return "Unknown device";
}

export function getOSName(): string {
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

export function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("CriOS")) return "Chrome (iOS)";
  if (ua.includes("FxiOS")) return "Firefox (iOS)";
  if (ua.includes("EdgiOS") || ua.includes("Edg/")) return "Edge";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  return "Unknown browser";
}

/** Compress an image file to JPEG, resizing if needed to stay under maxBytes. */
export async function compressImage(
  file: File,
  maxWidth = 2048,
  maxBytes = 3 * 1024 * 1024
): Promise<File> {
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

  let quality = 0.85;
  let blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  }

  const name = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([blob], name, { type: "image/jpeg" });
}

/**
 * Extract EXIF from the original (uncompressed) file and fill gaps with
 * browser-derived data. Returns the merged metadata.
 */
export async function buildClientExif(originalFile: File): Promise<CleaningPhotoExif> {
  const clientExif: CleaningPhotoExif = {};
  let hasRealExif = false;

  try {
    const d = await exifr.parse(originalFile, true);
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
      if (d.ColorSpace != null) {
        const cs = d.ColorSpace;
        clientExif.color_space = cs === 1 ? "sRGB" : cs === 2 ? "Adobe RGB" : cs === 65535 ? "Uncalibrated" : String(cs);
      }
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

  clientExif.file_type = originalFile.type || "unknown";
  clientExif.file_size = originalFile.size;

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

  return clientExif;
}

export const DEFAULT_PHOTO_AREAS = [
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
