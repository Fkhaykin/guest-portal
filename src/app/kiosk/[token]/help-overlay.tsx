"use client";

import { ChevronRight, HelpCircle, ScrollText, X } from "lucide-react";
import { helpContacts } from "./help-content";
import type { KioskData, KioskScreen } from "./types";

const TONE: Record<string, { card: string; badge: string; number: string }> = {
  emergency: {
    card: "bg-rose-600/20 ring-rose-400/40",
    badge: "bg-rose-500/25 text-rose-200",
    number: "text-rose-100",
  },
  primary: {
    card: "bg-(--k-surf-10) ring-(--k-surf-15)",
    badge: "bg-emerald-500/20 text-emerald-200",
    number: "text-(--k-fg)",
  },
  normal: {
    card: "bg-(--k-surf-06) ring-(--k-surf-10)",
    badge: "bg-(--k-surf-10) text-(--k-fg-70)",
    number: "text-(--k-fg)",
  },
};

export function HelpOverlay({
  data,
  onClose,
  onNavigate,
}: {
  data: KioskData;
  onClose: () => void;
  onNavigate: (screen: KioskScreen) => void;
}) {
  const contacts = helpContacts(data.property.community, data.property.host_phone);

  // FAQ + House Rules used to be their own menu tiles; they live here now.
  const guides: { label: string; sublabel: string; icon: typeof HelpCircle; screen: KioskScreen }[] = [
    { label: "House Rules", sublabel: "The 8 rules & full policies", icon: ScrollText, screen: { kind: "rules" } },
    { label: "FAQ", sublabel: "Answers about the house", icon: HelpCircle, screen: { kind: "faq" } },
  ];

  const go = (screen: KioskScreen) => {
    onClose();
    onNavigate(screen);
  };

  return (
    <div className="absolute inset-0 z-60 flex flex-col bg-(--k-bg)">
      <header className="flex items-center justify-between border-b border-(--k-surf-10) px-6 py-5 lg:px-10">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-(--k-fg) lg:text-3xl">
            Help & Info
          </h1>
          <p className="mt-1 text-base text-(--k-fg-60) lg:text-lg">
            {data.property.name} · in an emergency, always call 911
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-16 items-center gap-2 rounded-2xl bg-(--k-surf-10) px-6 text-xl font-bold text-(--k-fg) ring-1 ring-(--k-surf-15) transition-colors hover:bg-(--k-surf-15) active:scale-[0.97]"
        >
          <X className="h-7 w-7" />
          Close
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* House Rules + FAQ */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {guides.map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => go(g.screen)}
                className="flex items-center gap-5 rounded-3xl bg-(--k-surf-10) p-6 text-left ring-1 ring-(--k-surf-15) transition-colors hover:bg-(--k-surf-15) active:scale-[0.98]"
              >
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-(--k-surf-10) text-(--k-fg)">
                  <g.icon className="h-8 w-8" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-extrabold text-(--k-fg) lg:text-2xl">{g.label}</p>
                  <p className="text-sm text-(--k-fg-55) lg:text-base">{g.sublabel}</p>
                </div>
                <ChevronRight className="h-7 w-7 shrink-0 text-(--k-fg-50)" />
              </button>
            ))}
          </div>

          {/* Contacts */}
          <div>
            <h2 className="mb-4 text-base font-bold uppercase tracking-[0.3em] text-(--k-fg-50) lg:text-lg">
              Contacts
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {contacts.map((c) => {
                const tone = TONE[c.tone];
                return (
                  <a
                    key={c.label}
                    href={c.tel ? `tel:${c.tel}` : undefined}
                    className={`flex items-center gap-5 rounded-3xl p-6 ring-1 ${tone.card}`}
                  >
                    <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${tone.badge}`}>
                      <c.icon className="h-8 w-8" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl font-extrabold text-(--k-fg) lg:text-2xl">{c.label}</p>
                      <p className="text-sm text-(--k-fg-55) lg:text-base">{c.sublabel}</p>
                      <p className={`mt-1.5 text-2xl font-bold tabular-nums lg:text-3xl ${tone.number}`}>
                        {c.display}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
