"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Images,
  Loader2,
  Mail,
  RefreshCw,
  SwitchCamera,
  Timer,
  Trash2,
} from "lucide-react";
import { KioskScreenShell, KioskEmpty, glassPanel, glassButton } from "../ui";
import type { KioskBooking } from "../types";

type Facing = "user" | "environment";
type Phase = "live" | "countdown" | "review" | "share";
type Captured = { blob: Blob; url: string };

// 0 = instant (no countdown).
const TIMER_OPTIONS = [0, 3, 10, 20] as const;
const DEFAULT_TIMER = 3;

export function PhotoboothScreen({
  token,
  booking,
  timezone,
  onBack,
  onViewAlbum,
}: {
  token: string;
  booking: KioskBooking | null;
  timezone: string;
  onBack: () => void;
  onViewAlbum: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Share state (after "Save to my phone")
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const [retryNonce, setRetryNonce] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Acquire the camera on mount, on flip (facing), and on manual retry. All
  // setState happens after the getUserMedia await, keeping the effect clean.
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

  // Clean up the captured object URL when it's replaced or the screen closes.
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
    // Mirror the selfie so the saved photo matches the mirrored preview.
    if (facing === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
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
  }, [facing]);

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

  // Upload once; both "Keep" and "Save to my phone" reuse the result.
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

  return (
    <KioskScreenShell
      title="Photo Booth"
      subtitle="Strike a pose — the timer does the rest"
      timezone={timezone}
      onBack={onBack}
    >
      <div className="mx-auto flex h-full max-w-4xl flex-col items-center gap-5 pb-8">
        {/* Stage */}
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-3xl bg-black ring-1 ring-(--k-surf-15)">
          {/* Live camera */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""} ${
              phase === "review" || phase === "share" ? "hidden" : ""
            }`}
          />

          {/* Captured still */}
          {(phase === "review" || phase === "share") && captured && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={captured.url} alt="Your photo" className="h-full w-full object-cover" />
          )}

          {/* Camera error / permission prompt */}
          {camError && phase === "live" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/90 px-8 text-center">
              <Camera className="h-12 w-12 text-zinc-500" />
              <p className="max-w-sm text-lg text-zinc-300">
                The camera isn&apos;t available. Allow camera access for this device, then tap
                below.
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

          {/* Countdown overlay */}
          {phase === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span
                key={count}
                className="text-[9rem] font-black leading-none text-white drop-shadow-2xl tabular-nums"
              >
                {count === 0 ? "" : count}
              </span>
            </div>
          )}

          {/* Flip camera (only while composing) */}
          {phase === "live" && ready && (
            <button
              type="button"
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              aria-label="Flip camera"
              className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md"
            >
              <SwitchCamera className="h-6 w-6" />
            </button>
          )}

          {/* Loading camera */}
          {!ready && !camError && phase === "live" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-2xl bg-rose-500/15 px-5 py-3 text-base text-rose-200 ring-1 ring-rose-400/30">
            {error}
          </p>
        )}

        {/* Controls */}
        {phase === "live" && (
          <div className="flex w-full flex-col items-center gap-4">
            {/* Timer selector */}
            <div className="flex items-center gap-2 rounded-full bg-(--k-surf-07) p-1.5 ring-1 ring-(--k-surf-10)">
              <Timer className="ml-2 h-5 w-5 text-(--k-fg-60)" />
              {TIMER_OPTIONS.map((secs) => (
                <button
                  key={secs}
                  type="button"
                  onClick={() => setTimer(secs)}
                  aria-pressed={timer === secs}
                  className={`min-h-12 min-w-16 rounded-full px-4 text-lg font-bold tabular-nums transition-colors ${
                    timer === secs
                      ? "bg-(--k-featured-bg) text-(--k-featured-fg) shadow"
                      : "text-(--k-fg-70) hover:bg-(--k-surf-10)"
                  }`}
                >
                  {secs === 0 ? "Now" : `${secs}s`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={startCountdown}
              disabled={!ready}
              className="flex min-h-20 w-full max-w-md items-center justify-center gap-3 rounded-3xl bg-fuchsia-500 text-2xl font-extrabold text-white shadow-xl transition-transform active:scale-[0.97] disabled:opacity-50 lg:text-3xl"
            >
              <Camera className="h-8 w-8" /> Take Photo
            </button>
            <button
              type="button"
              onClick={onViewAlbum}
              className={`flex min-h-14 items-center gap-2 px-6 text-lg font-semibold text-(--k-fg) ${glassButton}`}
            >
              <Images className="h-5 w-5" /> My Photos
            </button>
          </div>
        )}

        {phase === "review" && (
          <div className="grid w-full max-w-2xl grid-cols-3 gap-3">
            <button
              type="button"
              onClick={retake}
              disabled={busy}
              className={`flex min-h-20 flex-col items-center justify-center gap-1 text-lg font-bold text-(--k-fg) disabled:opacity-50 ${glassPanel}`}
            >
              <Trash2 className="h-7 w-7" /> Retake
            </button>
            <button
              type="button"
              onClick={saveToPhone}
              disabled={busy}
              className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-sky-500/90 text-lg font-bold text-white shadow-lg transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-7 w-7" />}
              To my phone
            </button>
            <button
              type="button"
              onClick={keep}
              disabled={busy}
              className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-500 text-lg font-bold text-white shadow-lg transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Check className="h-7 w-7" />}
              Keep
            </button>
          </div>
        )}

        {phase === "share" && (
          <div className="flex w-full max-w-3xl flex-col items-center gap-5">
            <p className="text-center text-lg text-(--k-fg-70)">
              Saved to your album. Scan to download it, or email yourself a copy.
            </p>
            <div className="flex w-full flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
              {/* QR */}
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-3xl bg-white p-4 shadow-xl ring-1 ring-black/5">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="Scan to download your photo" className="h-52 w-52 lg:h-60 lg:w-60" />
                  ) : (
                    <div className="flex h-52 w-52 items-center justify-center lg:h-60 lg:w-60">
                      <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold text-(--k-fg-60)">Scan with your phone camera</p>
              </div>

              {/* Email */}
              <div className={`w-full max-w-sm space-y-3 p-5 ${glassPanel}`}>
                <p className="flex items-center gap-2 text-lg font-bold text-(--k-fg)">
                  <Mail className="h-5 w-5" /> Email it instead
                </p>
                {emailState === "sent" ? (
                  <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/15 px-4 py-3 text-emerald-200 ring-1 ring-emerald-400/30">
                    <Check className="h-5 w-5" /> Sent to {email}
                  </p>
                ) : (
                  <>
                    <input
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="min-h-14 w-full rounded-2xl bg-(--k-surf-10) px-4 text-lg text-(--k-fg) ring-1 ring-(--k-surf-15) outline-none placeholder:text-(--k-fg-40)"
                    />
                    <button
                      type="button"
                      onClick={sendEmail}
                      disabled={emailState === "sending" || !email.trim()}
                      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-(--k-featured-bg) text-lg font-bold text-(--k-featured-fg) disabled:opacity-50"
                    >
                      {emailState === "sending" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Mail className="h-5 w-5" />
                      )}
                      Send
                    </button>
                    {emailState === "error" && (
                      <p className="text-sm text-rose-300">Couldn&apos;t send. Check the address and try again.</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={retake}
              className="flex min-h-16 w-full max-w-md items-center justify-center gap-2 rounded-3xl bg-fuchsia-500 text-xl font-extrabold text-white shadow-xl transition-transform active:scale-[0.97]"
            >
              <Camera className="h-6 w-6" /> Take another
            </button>
          </div>
        )}

        {savedFlash && (
          <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center">
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 px-6 py-4 text-lg font-semibold text-emerald-100 ring-1 ring-emerald-400/40 backdrop-blur-md">
              <Check className="h-6 w-6" /> Saved to your album
            </div>
          </div>
        )}
      </div>
    </KioskScreenShell>
  );
}
