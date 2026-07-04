"use client";

// PriceLabs-style Customizations modal: searchable left pane grouped by
// category, one page per rule on the right with a plain-English "Applied"
// summary and the detailed editor, and a Discard / Save & Refresh footer with
// the applied-count chip.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { PricingConfig, PricingLabData } from "./types";
import { fmtUsd, fmtDate } from "./types";
import type { PricingRules } from "@/lib/pricing/engine";
import { CUSTOMIZATION_ITEMS, appliedCount, type CustomizationItem } from "./customization-items";
import { computePreview } from "./preview";

const CATEGORY_LABELS: Record<CustomizationItem["category"], string> = {
  smart: "Smart Rules",
  stay: "Stay Restrictions",
  other: "Other",
};

export function CustomizationsModal({
  open,
  onOpenChange,
  config,
  data,
  initialKey,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: PricingConfig;
  data: PricingLabData;
  initialKey?: string | null;
  onSave: (patch: Partial<PricingConfig>) => void;
  saving: boolean;
}) {
  const [rules, setRules] = useState<PricingRules>(config.rules);
  const [selectedKey, setSelectedKey] = useState(CUSTOMIZATION_ITEMS[0].key);
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Re-seed local state whenever the dialog opens for a (possibly different)
  // config or a requested rule page.
  const [seedKey, setSeedKey] = useState("");
  const currentSeed = config.id + ":" + JSON.stringify(config.rules).length + ":" + (initialKey ?? "");
  if (open && seedKey !== currentSeed) {
    setRules(config.rules);
    setSeedKey(currentSeed);
    setDirty(false);
    if (initialKey && CUSTOMIZATION_ITEMS.some((it) => it.key === initialKey)) setSelectedKey(initialKey);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? CUSTOMIZATION_ITEMS.filter((it) => it.title.toLowerCase().includes(q) || it.explainer.toLowerCase().includes(q))
      : CUSTOMIZATION_ITEMS;
  }, [query]);

  const selected = CUSTOMIZATION_ITEMS.find((it) => it.key === selectedKey) ?? CUSTOMIZATION_ITEMS[0];
  const count = appliedCount(rules);

  const preview = useMemo(
    () => (previewOpen ? computePreview(config, rules, data.snapshot, data.market, data.today) : null),
    [previewOpen, config, rules, data.snapshot, data.market, data.today]
  );

  function change(next: PricingRules) {
    setRules(next);
    setDirty(true);
  }

  function save() {
    onSave({
      rules: {
        ...rules,
        seasons: (rules.seasons ?? []).filter((s) => s.from && s.to),
        events: (rules.events ?? []).filter((e) => e.from && e.to),
        overrides: (rules.overrides ?? []).filter((o) => o.date),
        minStay: { ...rules.minStay, seasons: (rules.minStay?.seasons ?? []).filter((s) => s.from && s.to) },
      },
    });
    onOpenChange(false);
  }

  function discard() {
    setRules(config.rules);
    setDirty(false);
    onOpenChange(false);
  }

  const grouped = (["smart", "stay", "other"] as const).map((cat) => ({
    cat,
    items: filtered.filter((it) => it.category === cat),
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : discard())}>
      <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3.5">
          <DialogTitle>Customizations</DialogTitle>
          <p className="text-sm text-muted-foreground">{config.nickname}</p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* Left pane */}
          <div className="flex w-64 shrink-0 flex-col border-r border-border">
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-3">
              <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                Currently Applied
                <Badge variant="secondary">{count}</Badge>
              </div>
              {grouped.map(({ cat, items }) =>
                items.length === 0 ? null : (
                  <div key={cat} className="mt-2">
                    <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    {items.map((it) => {
                      const active = it.key === selectedKey;
                      const isApplied = it.applied(rules);
                      return (
                        <button
                          key={it.key}
                          onClick={() => setSelectedKey(it.key)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                            active
                              ? "border-l-2 border-primary bg-primary/5 font-medium text-primary"
                              : "border-l-2 border-transparent hover:bg-muted/60"
                          }`}
                        >
                          <span className="truncate">{it.title}</span>
                          {isApplied && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Right pane */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <h3 className="text-lg font-semibold">{selected.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{selected.explainer}</p>
            <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <Badge
                variant="secondary"
                className={selected.applied(rules) ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400" : ""}
              >
                {selected.applied(rules) ? "Applied" : "Off"}
              </Badge>
              <p className="text-sm">{selected.summary(rules)}</p>
            </div>
            <div className="mt-5">
              <selected.Editor rules={rules} onChange={change} />
            </div>
          </div>
        </div>

        {/* Preview Prices */}
        <div className="border-t border-border">
          <button
            onClick={() => setPreviewOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-2 text-sm font-medium hover:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              Preview Prices
              {preview?.avgDeltaPct != null && preview.avgDeltaPct !== 0 && (
                <Badge variant="secondary" className={preview.avgDeltaPct > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {preview.avgDeltaPct > 0 ? "+" : ""}
                  {preview.avgDeltaPct}% avg
                </Badge>
              )}
            </span>
            {previewOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {previewOpen && preview && (
            <div className="max-h-44 overflow-y-auto px-5 pb-3">
              <div className="mb-2 text-xs text-muted-foreground">
                Next 30 open nights · {preview.changed} change · avg {fmtUsd(preview.oldAvg)} → {fmtUsd(preview.newAvg)}
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {preview.nights.map((n) => (
                  <div key={n.date} className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs">
                    <span className="text-muted-foreground">{fmtDate(n.date)}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      {n.oldCents != null && n.oldCents !== n.newCents && (
                        <span className="text-muted-foreground line-through">{fmtUsd(n.oldCents)}</span>
                      )}
                      <span className="font-medium">{fmtUsd(n.newCents)}</span>
                      {n.deltaPct != null && n.deltaPct !== 0 && (
                        <span className={n.deltaPct > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {n.deltaPct > 0 ? "+" : ""}
                          {n.deltaPct}%
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {count} customization{count === 1 ? "" : "s"} affecting your pricing and stay
            {dirty && " · unsaved changes"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={discard}>
              Discard Changes
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save & Refresh
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
