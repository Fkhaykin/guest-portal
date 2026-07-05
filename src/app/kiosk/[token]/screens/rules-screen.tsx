"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { KioskScreenShell, glassPanel } from "../ui";
import { QUICK_RULES } from "@/lib/house-rules";
import { SECTIONS, CHAPTERS } from "@/lib/policy-content";

// House rules, kiosk-native: the 8 quick rules up top, the full 45-section /
// 7-chapter policy text as an expandable reader below — same content as
// /rental-policies, re-set for a dark touch screen.
export function RulesScreen({
  timezone,
  onBack,
}: {
  timezone: string;
  onBack: () => void;
}) {
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  function jumpToRule(href: string) {
    const sectionId = href.replace("#", "");
    const idx = SECTIONS.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    const chapter = CHAPTERS.find((c) => idx >= c.range[0] && idx <= c.range[1]);
    if (!chapter) return;
    setOpenChapter(chapter.id);
    // Scroll after the chapter has expanded — two frames past the commit.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        bodyRef.current
          ?.querySelector(`[data-section="${sectionId}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );
  }

  return (
    <KioskScreenShell
      title="House Rules"
      subtitle="Eight rules cover 90% of it — the rest is below"
      timezone={timezone}
      onBack={onBack}
    >
      <div ref={bodyRef} className="space-y-10 pb-8">
        {/* The short version */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK_RULES.map((r) => (
            <button
              key={r.section}
              type="button"
              onClick={() => jumpToRule(r.href)}
              className={`flex min-h-44 flex-col p-5 text-left ${glassPanel} transition-colors hover:bg-white/[0.12] lg:p-6`}
            >
              <r.icon className="h-9 w-9 text-white/85" />
              <span className="mt-4 text-lg font-extrabold leading-snug text-white lg:text-xl">
                {r.rule}
              </span>
              <span className="mt-1.5 text-sm leading-relaxed text-white/60 lg:text-base">{r.detail}</span>
              <span className="mt-auto pt-3 text-xs font-medium tabular-nums text-white/40">
                §{r.section}
              </span>
            </button>
          ))}
        </div>

        {/* Full policy reader */}
        <div>
          <p className="mb-4 text-base font-bold uppercase tracking-[0.3em] text-white/50 lg:text-lg">
            The full terms — {SECTIONS.length} sections in {CHAPTERS.length} chapters
          </p>
          <div className="space-y-3">
            {CHAPTERS.map((chapter) => {
              const isOpen = openChapter === chapter.id;
              const sections = SECTIONS.slice(chapter.range[0], chapter.range[1] + 1);
              return (
                <div key={chapter.id} className={`overflow-hidden ${glassPanel}`}>
                  <button
                    type="button"
                    onClick={() => setOpenChapter(isOpen ? null : chapter.id)}
                    className="flex min-h-28 w-full items-center gap-5 p-5 text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={chapter.img}
                      alt=""
                      loading="lazy"
                      className="h-20 w-32 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
                        Chapter {chapter.index} · §{sections[0].number}–{sections[sections.length - 1].number}
                      </p>
                      <h2 className="text-2xl font-extrabold text-white lg:text-3xl">{chapter.title}</h2>
                      <p className="truncate text-base text-white/60">{chapter.blurb}</p>
                    </div>
                    <ChevronDown
                      className={`h-9 w-9 shrink-0 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="space-y-8 border-t border-white/10 p-5 lg:p-6">
                      {sections.map((section) => (
                        <article key={section.id} data-section={section.id} className="scroll-mt-24">
                          <div className="flex items-baseline gap-3">
                            <span className="text-sm font-semibold tabular-nums text-white/40">
                              {section.number}
                            </span>
                            <h3 className="text-xl font-extrabold text-white lg:text-2xl">{section.title}</h3>
                          </div>
                          <div className="mt-3 space-y-3 text-lg leading-relaxed text-white/75">
                            {section.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
                            {section.items && section.items.length > 0 && (
                              <ul className="space-y-2 pt-1">
                                {section.items.map((item, i) => (
                                  <li key={i} className="border-l-2 border-white/20 pl-4">
                                    {item.label && (
                                      <span className="font-semibold text-white">{item.label}. </span>
                                    )}
                                    {item.body}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </KioskScreenShell>
  );
}
