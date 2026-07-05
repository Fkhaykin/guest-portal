"use client";

import { X } from "lucide-react";
import { helpContacts } from "./help-content";
import type { KioskData } from "./types";

const TONE: Record<string, { card: string; badge: string; number: string }> = {
  emergency: {
    card: "bg-rose-600/20 ring-rose-400/40",
    badge: "bg-rose-500/25 text-rose-200",
    number: "text-rose-100",
  },
  primary: {
    card: "bg-white/[0.08] ring-white/15",
    badge: "bg-emerald-500/20 text-emerald-200",
    number: "text-white",
  },
  normal: {
    card: "bg-white/[0.06] ring-white/10",
    badge: "bg-white/10 text-white/70",
    number: "text-white",
  },
};

export function HelpOverlay({ data, onClose }: { data: KioskData; onClose: () => void }) {
  const contacts = helpContacts(data.property.community, data.property.host_phone);

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-zinc-950/95 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">
            Help & Contacts
          </h1>
          <p className="mt-1 text-base text-white/60 lg:text-lg">
            {data.property.name} · in an emergency, always call 911
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-16 items-center gap-2 rounded-2xl bg-white/10 px-6 text-xl font-bold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15 active:scale-[0.97]"
        >
          <X className="h-7 w-7" />
          Close
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 lg:grid-cols-2">
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
                  <p className="text-xl font-extrabold text-white lg:text-2xl">{c.label}</p>
                  <p className="text-sm text-white/55 lg:text-base">{c.sublabel}</p>
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
  );
}
