"use client";

import { useEffect } from "react";

const ELFSIGHT_APP_ID =
  process.env.NEXT_PUBLIC_ELFSIGHT_APP_ID ||
  "018c3f37-3b89-4752-8511-6de4a86567a3";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function ElfsightEmbed({ appId }: { appId: string }) {
  useEffect(() => {
    if (document.querySelector('script[src*="elfsight"]')) return;
    const script = document.createElement("script");
    script.src = "https://elfsightcdn.com/platform.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return <div className={`elfsight-app-${appId}`} data-elfsight-app-lazy />;
}

export function InstagramFeedSection() {
  if (!ELFSIGHT_APP_ID) return null;

  return (
    <section className="px-4 sm:px-6 py-10 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <InstagramIcon className="h-6 w-6" />
            @summitlakeside
          </h2>
          <p className="text-muted-foreground">
            Follow us for more lakefront moments
          </p>
        </div>
        <a
          href="https://instagram.com/summitlakeside"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <InstagramIcon className="h-4 w-4" />
          Follow
        </a>
      </div>
      <ElfsightEmbed appId={ELFSIGHT_APP_ID} />
      <div className="mt-4 sm:hidden">
        <a
          href="https://instagram.com/summitlakeside"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <InstagramIcon className="h-4 w-4" />
          Follow @summitlakeside
        </a>
      </div>
    </section>
  );
}
