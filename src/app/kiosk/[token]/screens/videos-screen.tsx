"use client";

import { Play } from "lucide-react";
import { KioskScreenShell, KioskEmpty, KioskSpinner, glassButton } from "../ui";
import type { KioskVideo } from "../types";

export function VideosScreen({
  videos,
  failed,
  timezone,
  onBack,
  onPlay,
}: {
  videos: KioskVideo[] | null;
  failed: boolean;
  timezone: string;
  onBack: () => void;
  onPlay: (id: string) => void;
}) {
  return (
    <KioskScreenShell
      title="Videos"
      subtitle="How-to guides & welcome tour"
      timezone={timezone}
      onBack={onBack}
    >
      {videos === null ? (
        failed ? <KioskEmpty message={"This screen isn't loading right now — it retries automatically, or tap Home and try again."} /> : <KioskSpinner />
      ) : videos.length === 0 ? (
        <KioskEmpty message="No videos have been added for this house yet." />
      ) : (
        <div className="grid grid-cols-1 gap-5 pb-8 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <button
              key={video.id}
              type="button"
              onClick={() => onPlay(video.id)}
              className={`flex min-h-40 items-center gap-6 p-6 text-left ${glassButton}`}
            >
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-(--k-surf-15)">
                <Play className="ml-1.5 h-12 w-12 text-(--k-fg)" />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-extrabold leading-tight text-(--k-fg)">{video.title}</span>
                {video.description && (
                  <span className="mt-2 line-clamp-3 block text-base text-(--k-fg-65)">
                    {video.description}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </KioskScreenShell>
  );
}
