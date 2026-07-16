"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  GalleryVerticalEnd,
  Images,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  SwitchCamera,
  Timer,
  Trash2,
} from "lucide-react";
import { KioskScreenShell, KioskEmpty, glassPanel, glassButton } from "../ui";
import type { KioskBooking } from "../types";
import { PROP_SETS, PROP_SRC, propPlacement, placementToDisplay, type Face, type PropId } from "../photobooth-props";

type Facing = "user" | "environment";
type Phase = "live" | "countdown" | "review" | "share";
type Captured = { blob: Blob; url: string };

const TIMER_OPTIONS = [0, 3, 10, 20] as const;
const DEFAULT_TIMER = 3;

// MediaPipe face detector — loaded from the CDN so the silly props work on any
// browser (the kiosk's Edge lacks the native FaceDetector API).
const MP_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MP_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

interface MpDetection {
  boundingBox?: { originX: number; originY: number; width: number; height: number };
  keypoints?: { x: number; y: number }[];
}
interface MpDetector {
  detectForVideo(v: HTMLVideoElement, ts: number): { detections: MpDetection[] };
  close(): void;
}

export function PhotoboothScreen({
  token,
  booking,
  timezone,
  onBack,
  onViewAlbum,
  onViewHouseAlbum,
}: {
  token: string;
  booking: KioskBooking | null;
  timezone: string;
  onBack: () => void;
  onViewAlbum: () => void;
  onViewHouseAlbum: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectorRef = useRef<MpDetector | null>(null);
  const propImgs = useRef<Partial<Record<PropId, HTMLImageElement>>>({});

  const [facing, setFacing] = useState<Facing>("user");
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [phase, setPhase] = useState<Phase>("live");
  const [timer, setTimer] = useState<number>(DEFAULT_TIMER);
  const [count, setCount] = useState<number>(DEFAULT_TIMER);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Face props
  const [propSetKey, setPropSetKey] = useState("none");
  const [detectorReady, setDetectorReady] = useState(false);
  const [liveFaces, setLiveFaces] = useState<Face[]>([]);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [mediaSize, setMediaSize] = useState({ w: 0, h: 0 });
  const activeProps = useMemo(() => PROP_SETS.find((s) => s.key === propSetKey)?.props ?? [], [propSetKey]);

  // Share state
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const [retryNonce, setRetryNonce] = useState(0);
  const mirror = facing === "user";
  const composing = phase === "live" || phase === "countdown";

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Preload prop SVGs (for canvas stamping) + build the face detector once.
  useEffect(() => {
    for (const set of PROP_SETS) {
      for (const p of set.props) {
        if (!propImgs.current[p]) {
          const img = new Image();
          img.src = PROP_SRC[p];
          propImgs.current[p] = img;
        }
      }
    }
    let cancelled = false;
    (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(MP_WASM);
        let detector: MpDetector | null = null;
        for (const delegate of ["GPU", "CPU"] as const) {
          try {
            detector = (await vision.FaceDetector.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: MP_MODEL, delegate },
              runningMode: "VIDEO",
              minDetectionConfidence: 0.4,
            })) as unknown as MpDetector;
            break;
          } catch {
            // try the next delegate
          }
        }
        if (cancelled) {
          detector?.close();
          return;
        }
        if (detector) {
          detectorRef.current = detector;
          setDetectorReady(true);
        }
      } catch {
        // No detector (offline / blocked) — props just won't track.
      }
    })();
    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, []);

  // Track the viewfinder's on-screen size so face boxes map into display pixels.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // Acquire the camera on mount, on flip, and on manual retry.
  useEffect(() => {
    if (!booking) return;
    let cancelled = false;
    stopStream();
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCamError(false);
        setReady(true);
      } catch {
        if (!cancelled) {
          setReady(false);
          setCamError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (countdownRef.current) clearInterval(countdownRef.current);
      stopStream();
    };
  }, [facing, retryNonce, booking, stopStream]);

  // Live face tracking (~13fps) while composing with an effect selected.
  useEffect(() => {
    if (!composing || !ready || !detectorReady || activeProps.length === 0) {
      setLiveFaces([]);
      return;
    }
    let raf = 0;
    let last = 0;
    let stop = false;
    const loop = () => {
      if (stop) return;
      const video = videoRef.current;
      const det = detectorRef.current;
      const now = performance.now();
      if (video && video.videoWidth && det && now - last > 70) {
        last = now;
        try {
          const res = det.detectForVideo(video, now);
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          setLiveFaces(
            (res.detections || [])
              .map((d): Face | null => {
                const b = d.boundingBox;
                if (!b) return null;
                const kp = d.keypoints || [];
                // Keypoints are usually normalized [0,1]; some builds return
                // pixels. Detect which, and fall back to box ratios if absent.
                const normalized = !!kp[0] && kp[0].x <= 1.5 && kp[0].y <= 1.5;
                const pt = (i: number, fx: number, fy: number): { x: number; y: number } => {
                  const k = kp[i];
                  if (!k) return { x: fx, y: fy };
                  return normalized ? { x: k.x * vw, y: k.y * vh } : { x: k.x, y: k.y };
                };
                return {
                  x: b.originX,
                  y: b.originY,
                  width: b.width,
                  height: b.height,
                  eyeR: pt(0, b.originX + b.width * 0.3, b.originY + b.height * 0.42),
                  eyeL: pt(1, b.originX + b.width * 0.7, b.originY + b.height * 0.42),
                  nose: pt(2, b.originX + b.width * 0.5, b.originY + b.height * 0.6),
                  mouth: pt(3, b.originX + b.width * 0.5, b.originY + b.height * 0.78),
                };
              })
              .filter((f): f is Face => !!f)
          );
        } catch {
          // transient — retry next frame
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, [composing, ready, detectorReady, activeProps.length, facing]);

  useEffect(() => {
    return () => {
      if (captured) URL.revokeObjectURL(captured.url);
    };
  }, [captured]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setPhase("live");
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // props are placed in final (mirrored) image space
    if (activeProps.length) {
      for (const face of liveFaces) {
        for (const p of activeProps) {
          const img = propImgs.current[p];
          if (!img || !img.complete || !img.naturalWidth) continue;
          const pl = propPlacement(p, face);
          const cx = facing === "user" ? w - pl.cx : pl.cx;
          const angle = facing === "user" ? -pl.angle : pl.angle;
          ctx.save();
          ctx.translate(cx, pl.cy);
          ctx.rotate(angle);
          ctx.drawImage(img, -pl.w / 2, -pl.h / 2, pl.w, pl.h);
          ctx.restore();
        }
      }
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setPhase("live");
          return;
        }
        setCaptured({ blob, url: URL.createObjectURL(blob) });
        setPhase("review");
      },
      "image/jpeg",
      0.9
    );
  }, [facing, activeProps, liveFaces]);

  const startCountdown = useCallback(() => {
    if (!ready || phase !== "live") return;
    setError(null);
    if (timer <= 0) {
      capture();
      return;
    }
    setPhase("countdown");
    setCount(timer);
    countdownRef.current = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          capture();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [ready, phase, timer, capture]);

  const retake = useCallback(() => {
    if (captured) URL.revokeObjectURL(captured.url);
    setCaptured(null);
    setPhotoId(null);
    setQrDataUrl(null);
    setEmail("");
    setEmailState("idle");
    setError(null);
    setPhase("live");
  }, [captured]);

  const ensureUploaded = useCallback(async (): Promise<{ id: string; url: string | null } | null> => {
    if (!booking || !captured) return null;
    if (photoId) return { id: photoId, url: null };
    const fd = new FormData();
    fd.append("file", captured.blob, "photo.jpg");
    fd.append("registration_id", booking.reservation.id);
    fd.append("taken_by_name", booking.first_name);
    const res = await fetch(`/api/kiosk/${token}/photos`, {
      method: "POST",
      headers: { "x-guest-token": booking.guest_token },
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.id) {
      setError(data?.error || "Couldn't save the photo. Please try again.");
      return null;
    }
    setPhotoId(data.id);
    return { id: data.id, url: data.url ?? null };
  }, [booking, captured, photoId, token]);

  const keep = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await ensureUploaded();
    setBusy(false);
    if (!result) return;
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
    retake();
  }, [ensureUploaded, retake]);

  const saveToPhone = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await ensureUploaded();
    setBusy(false);
    if (!result) return;
    setPhase("share");
    if (result.url) {
      try {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(result.url, {
          width: 640,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0a0a0a", light: "#ffffff" },
        });
        setQrDataUrl(dataUrl);
      } catch {
        // QR failed — the email option still works.
      }
    }
  }, [ensureUploaded]);

  const sendEmail = useCallback(async () => {
    if (!booking || !photoId || !email.trim()) return;
    setEmailState("sending");
    const res = await fetch(`/api/kiosk/${token}/photos/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-guest-token": booking.guest_token },
      body: JSON.stringify({ id: photoId, registration_id: booking.reservation.id, email: email.trim() }),
    });
    setEmailState(res.ok ? "sent" : "error");
  }, [booking, photoId, email, token]);

  if (!booking) {
    return (
      <KioskScreenShell title="Photo Booth" timezone={timezone} onBack={onBack}>
        <KioskEmpty message="The photo booth opens once a stay is checked in." />
      </KioskScreenShell>
    );
  }

  const sideBtn = (active: boolean) =>
    `w-full rounded-2xl px-4 py-3 text-lg font-bold transition-colors ${
      active ? "bg-(--k-featured-bg) text-(--k-featured-fg) shadow" : "bg-(--k-surf-07) text-(--k-fg-80) ring-1 ring-(--k-surf-10) hover:bg-(--k-surf-12)"
    }`;

  return (
    <KioskScreenShell
      title="Photo Booth"
      subtitle="Strike a pose — the timer does the rest"
      timezone={timezone}
      onBack={onBack}
    >
      <div className="flex h-full w-full items-stretch gap-4">
        {/* LEFT controls — timer + album shortcuts */}
        {composing && (
          <div className="flex w-52 shrink-0 flex-col justify-center gap-4">
            <div className="space-y-2">
              <p className="flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wider text-(--k-fg-55)">
                <Timer className="h-4 w-4" /> Timer
              </p>
              {TIMER_OPTIONS.map((secs) => (
                <button key={secs} type="button" onClick={() => setTimer(secs)} className={sideBtn(timer === secs)}>
                  {secs === 0 ? "Now" : `${secs} sec`}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <button type="button" onClick={onViewAlbum} className={`flex items-center justify-center gap-2 ${sideBtn(false)}`}>
                <Images className="h-5 w-5" /> My Photos
              </button>
              <button type="button" onClick={onViewHouseAlbum} className={`flex items-center justify-center gap-2 ${sideBtn(false)}`}>
                <GalleryVerticalEnd className="h-5 w-5" /> House Album
              </button>
            </div>
          </div>
        )}

        {/* CENTER — viewfinder (3:2) + the one button in the middle */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4">
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <div
              ref={stageRef}
              className="relative aspect-3/2 h-full max-w-full overflow-hidden rounded-3xl bg-black ring-1 ring-(--k-surf-15)"
            >
              <video
                ref={videoRef}
                playsInline
                muted
                onLoadedMetadata={(e) => setMediaSize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
                className={`h-full w-full object-cover ${mirror ? "scale-x-[-1]" : ""} ${
                  phase === "review" || phase === "share" ? "hidden" : ""
                }`}
              />

              {/* Live face-prop overlay */}
              {composing &&
                activeProps.length > 0 &&
                mediaSize.w > 0 &&
                stageSize.w > 0 &&
                liveFaces.map((face, fi) =>
                  activeProps.map((p) => {
                    const pl = placementToDisplay(
                      propPlacement(p, face),
                      stageSize.w,
                      stageSize.h,
                      mediaSize.w,
                      mediaSize.h,
                      mirror
                    );
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${fi}-${p}`}
                        src={PROP_SRC[p]}
                        alt=""
                        className="pointer-events-none absolute left-0 top-0 select-none"
                        style={{
                          width: pl.w,
                          height: pl.h,
                          transform: `translate(${pl.cx - pl.w / 2}px, ${pl.cy - pl.h / 2}px) rotate(${pl.angle}rad)`,
                        }}
                      />
                    );
                  })
                )}

              {(phase === "review" || phase === "share") && captured && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={captured.url} alt="Your photo" className="h-full w-full object-cover" />
              )}

              {camError && phase === "live" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/90 px-8 text-center">
                  <Camera className="h-12 w-12 text-zinc-500" />
                  <p className="max-w-sm text-lg text-zinc-300">
                    The camera isn&apos;t available. Allow camera access for this device, then tap below.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCamError(false);
                      setRetryNonce((n) => n + 1);
                    }}
                    className={`flex min-h-14 items-center gap-2 px-6 text-lg font-bold text-white ${glassButton}`}
                  >
                    <RefreshCw className="h-5 w-5" /> Try again
                  </button>
                </div>
              )}

              {phase === "countdown" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span key={count} className="text-[9rem] font-black leading-none text-white drop-shadow-2xl tabular-nums">
                    {count === 0 ? "" : count}
                  </span>
                </div>
              )}

              {composing && ready && (
                <button
                  type="button"
                  onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                  aria-label="Flip camera"
                  className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md"
                >
                  <SwitchCamera className="h-6 w-6" />
                </button>
              )}

              {!ready && !camError && composing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-2xl bg-rose-500/15 px-5 py-2.5 text-base text-rose-200 ring-1 ring-rose-400/30">{error}</p>
          )}

          {/* The one button in the middle */}
          {phase === "live" && (
            <button
              type="button"
              onClick={startCountdown}
              disabled={!ready}
              className="flex min-h-16 w-full max-w-md items-center justify-center gap-3 rounded-full bg-fuchsia-500 text-2xl font-extrabold text-white shadow-xl transition-transform active:scale-[0.97] disabled:opacity-50 lg:text-3xl"
            >
              <Camera className="h-8 w-8" /> Take Photo
            </button>
          )}

          {phase === "review" && (
            <div className="grid w-full max-w-2xl grid-cols-3 gap-3">
              <button
                type="button"
                onClick={retake}
                disabled={busy}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-lg font-bold text-(--k-fg) disabled:opacity-50 ${glassPanel}`}
              >
                <Trash2 className="h-7 w-7" /> Retake
              </button>
              <button
                type="button"
                onClick={saveToPhone}
                disabled={busy}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-sky-500/90 text-lg font-bold text-white shadow-lg transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-7 w-7" />}
                To my phone
              </button>
              <button
                type="button"
                onClick={keep}
                disabled={busy}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-500 text-lg font-bold text-white shadow-lg transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Check className="h-7 w-7" />}
                Keep
              </button>
            </div>
          )}

          {phase === "share" && (
            <div className="flex w-full max-w-4xl flex-col items-center gap-3 lg:flex-row lg:items-center lg:justify-center">
              <div className="flex items-center gap-4">
                <div className="rounded-3xl bg-white p-3 shadow-xl ring-1 ring-black/5">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="Scan to download your photo" className="h-32 w-32 lg:h-40 lg:w-40" />
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center lg:h-40 lg:w-40">
                      <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                    </div>
                  )}
                </div>
                <div className={`w-64 space-y-2 p-4 ${glassPanel}`}>
                  <p className="flex items-center gap-2 text-base font-bold text-(--k-fg)">
                    <Mail className="h-5 w-5" /> Email it
                  </p>
                  {emailState === "sent" ? (
                    <p className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-400/30">
                      <Check className="h-4 w-4" /> Sent to {email}
                    </p>
                  ) : (
                    <>
                      <input
                        type="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="min-h-12 w-full rounded-xl bg-(--k-surf-10) px-3 text-base text-(--k-fg) ring-1 ring-(--k-surf-15) outline-none placeholder:text-(--k-fg-40)"
                      />
                      <button
                        type="button"
                        onClick={sendEmail}
                        disabled={emailState === "sending" || !email.trim()}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-(--k-featured-bg) text-base font-bold text-(--k-featured-fg) disabled:opacity-50"
                      >
                        {emailState === "sending" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                        Send
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={retake}
                className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-fuchsia-500 px-8 text-xl font-extrabold text-white shadow-xl transition-transform active:scale-[0.97]"
              >
                <Camera className="h-6 w-6" /> Take another
              </button>
            </div>
          )}
        </div>

        {/* RIGHT controls — silly face effects */}
        {composing && (
          <div className="flex w-52 shrink-0 flex-col justify-center gap-2">
            <p className="flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wider text-(--k-fg-55)">
              <Sparkles className="h-4 w-4" /> Effects
            </p>
            {PROP_SETS.map((set) => (
              <button key={set.key} type="button" onClick={() => setPropSetKey(set.key)} className={sideBtn(propSetKey === set.key)}>
                {set.label}
              </button>
            ))}
            {activeProps.length > 0 && !detectorReady && (
              <p className="px-1 pt-1 text-xs text-(--k-fg-50)">Loading face tracking…</p>
            )}
          </div>
        )}
      </div>

      {savedFlash && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center">
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 px-6 py-4 text-lg font-semibold text-emerald-100 ring-1 ring-emerald-400/40 backdrop-blur-md">
            <Check className="h-6 w-6" /> Saved to your album
          </div>
        </div>
      )}
    </KioskScreenShell>
  );
}
