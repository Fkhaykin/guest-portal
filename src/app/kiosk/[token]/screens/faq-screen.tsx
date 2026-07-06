"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { KioskScreenShell, KioskEmpty, KioskSpinner, glassPanel } from "../ui";
import type { KioskFaq } from "../types";

export function FaqScreen({
  faqs,
  failed,
  timezone,
  onBack,
}: {
  faqs: KioskFaq[] | null;
  failed: boolean;
  timezone: string;
  onBack: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  // Same grouping as the portal FAQ page: nullable free-form category → "General".
  const groups = new Map<string, KioskFaq[]>();
  for (const faq of faqs ?? []) {
    const key = faq.category || "General";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(faq);
  }

  return (
    <KioskScreenShell title="FAQ" subtitle="Frequently asked questions" timezone={timezone} onBack={onBack}>
      {faqs === null ? (
        failed ? <KioskEmpty message={"This screen isn't loading right now — it retries automatically, or tap Home and try again."} /> : <KioskSpinner />
      ) : faqs.length === 0 ? (
        <KioskEmpty message="No FAQs have been added for this house yet." />
      ) : (
        <div className="space-y-10 pb-8">
          {[...groups.entries()].map(([category, items]) => (
            <section key={category}>
              {groups.size > 1 && (
                <h2 className="mb-4 text-base font-bold uppercase tracking-[0.3em] text-(--k-fg-50) lg:text-lg">
                  {category}
                </h2>
              )}
              {/* items-start so an open card grows downward without stretching
                  its row-neighbor; no col-span change → width stays constant. */}
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                {items.map((faq) => {
                  const isOpen = open === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className={`${glassPanel} ${isOpen ? "bg-(--k-surf-12)" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : faq.id)}
                        className="flex min-h-24 w-full items-center justify-between gap-5 px-6 py-5 text-left"
                      >
                        <span className="text-xl font-bold leading-snug text-(--k-fg) lg:text-2xl">
                          {faq.question}
                        </span>
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-(--k-surf-10) transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        >
                          <ChevronDown className="h-7 w-7 text-(--k-fg-70)" />
                        </span>
                      </button>
                      {isOpen && (
                        <p className="whitespace-pre-wrap px-6 pb-6 text-lg leading-relaxed text-(--k-fg-75) lg:text-xl">
                          {faq.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </KioskScreenShell>
  );
}
