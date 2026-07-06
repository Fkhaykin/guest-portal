"use client";

import { useEffect, useState } from "react";
import { KioskScreenShell, KioskEmpty, KioskSpinner } from "../ui";

interface PlayerData {
  url: string;
  title: string;
  description: string | null;
}

export function VideoPlayerScreen({
  token,
  videoId,
  timezone,
  onBack,
}: {
  token: string;
  videoId: string;
  timezone: string;
  onBack: () => void;
}) {
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [failed, setFailed] = useState(false);

  // A fresh signed URL per view — kiosk tabs live for days, so URLs signed
  // at load time would already be expired.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/kiosk/${token}/video/${videoId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled) setPlayer(data);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, videoId]);

  return (
    <KioskScreenShell
      title={player?.title ?? "Video"}
      subtitle={player?.description ?? undefined}
      timezone={timezone}
      onBack={onBack}
      backLabel="Videos"
    >
      {failed ? (
        <KioskEmpty message="This video is temporarily unavailable. Please try again later." />
      ) : !player ? (
        <KioskSpinner />
      ) : (
        <div className="flex h-full items-center justify-center pb-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-black ring-1 ring-(--k-surf-10)">
            <video controls autoPlay playsInline className="max-h-[70vh] w-full" src={player.url} />
          </div>
        </div>
      )}
    </KioskScreenShell>
  );
}
