"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Sparkles,
  Zap,
  Search,
  Home,
  History,
  KeyRound,
  CircleDollarSign,
  Waves,
  ConciergeBell,
  PawPrint,
  CalendarX,
  Bookmark,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { interpolate } from "@/lib/guest-messages/templates";
import {
  QUICK_REPLIES,
  QUICK_REPLY_CATEGORIES,
  CUSTOM_CATEGORY,
  HOUSE_KEYS,
  HOUSE_LABELS,
  suggestQuickReplies,
  houseForProperty,
  toQuickReply,
  type CustomQuickReplyRow,
  type QuickReply,
  type HouseKey,
} from "@/lib/guest-messages/quick-replies";
import { HOUSE_CHECKIN_TEMPLATES } from "@/lib/guest-messages/house-templates";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Check-in / Checkout": KeyRound,
  "Pricing & Booking": CircleDollarSign,
  Amenities: Waves,
  "During the Stay": ConciergeBell,
  Pets: PawPrint,
  "Cancellations & Refunds": CalendarX,
  [CUSTOM_CATEGORY]: Bookmark,
};

// ---------------------------------------------------------------------------
// Custom replies: fetch + CRUD, shared by the suggestions row and the picker.
// The page calls this once and passes the results to both.
// ---------------------------------------------------------------------------

export interface SaveReplyInput {
  id?: string;
  title: string;
  body: string;
  category: string;
  house: HouseKey | null;
}

// The day-of-check-in instruction message, offered per house so the host can
// re-send door codes / WiFi / directions on demand. Body prefers the host's
// Auto Messages override, falling back to the built-in template.
const CHECKIN_KEYWORDS = [
  "check-in instructions", "check in instructions", "checkin instructions",
  "door code", "lock code", "lockbox", "access code", "wifi", "wi-fi",
  "password", "get into the house", "resend", "never got the instructions",
];

function buildHouseCheckinReplies(
  overrides: Record<string, { message?: string }> | null
): QuickReply[] {
  return HOUSE_KEYS.map((house) => ({
    id: `house-checkin-${house}`,
    title: "Check-in instructions (full)",
    category: "House Info",
    keywords: CHECKIN_KEYWORDS,
    body: overrides?.[house]?.message || HOUSE_CHECKIN_TEMPLATES[house],
    house,
  }));
}

export function useCustomQuickReplies() {
  const [customReplies, setCustomReplies] = useState<QuickReply[]>([]);
  const [houseCheckinReplies, setHouseCheckinReplies] = useState<QuickReply[]>(
    () => buildHouseCheckinReplies(null)
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/quick-replies")
      .then((res) => res.json())
      .then(
        (data: {
          replies?: CustomQuickReplyRow[];
          houseCheckinInstructions?: Record<string, { message?: string }> | null;
        }) => {
          if (cancelled) return;
          if (data.replies) setCustomReplies(data.replies.map(toQuickReply));
          if (data.houseCheckinInstructions) {
            setHouseCheckinReplies(
              buildHouseCheckinReplies(data.houseCheckinInstructions)
            );
          }
        }
      )
      .catch(() => {
        // built-in replies still work without the custom set
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveReply = useCallback(async (input: SaveReplyInput) => {
    const res = await fetch("/api/admin/quick-replies", {
      method: input.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok || !data.reply) {
      throw new Error(data.error || "Failed to save quick reply");
    }
    const reply = toQuickReply(data.reply);
    setCustomReplies((prev) =>
      input.id ? prev.map((r) => (r.id === reply.id ? reply : r)) : [reply, ...prev]
    );
    return reply;
  }, []);

  const deleteReply = useCallback((id: string) => {
    setCustomReplies((prev) => prev.filter((r) => r.id !== id));
    fetch(`/api/admin/quick-replies?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => {
      // soft-delete is best-effort; the row simply reappears on next load
    });
  }, []);

  return { customReplies, houseCheckinReplies, saveReply, deleteReply };
}

// Recently used reply ids (built-in and custom alike), newest first.
const RECENTS_KEY = "admin-quick-reply-recents";

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const list = [id, ...readRecents().filter((x) => x !== id)].slice(0, 8);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    // storage full / private mode — recents are a nicety
  }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

// ---------------------------------------------------------------------------
// Suggestion chips above the composer (guest spoke last)
// ---------------------------------------------------------------------------

interface QuickRepliesProps {
  /** The guest's most recent message, if they spoke last (drives suggestions). */
  lastGuestMessage: string | null;
  /** Listing name of the conversation's property — scopes house-specific replies. */
  propertyName: string | null;
  /** Placeholder values: guest_first_name, max_guests, etc. */
  vars: Record<string, string>;
  /** Host-authored replies from useCustomQuickReplies(). */
  customReplies: QuickReply[];
  /** Called with the interpolated reply text on click. */
  onInsert: (text: string) => void;
}

export function QuickReplySuggestions({
  lastGuestMessage,
  propertyName,
  vars,
  customReplies,
  onInsert,
}: QuickRepliesProps) {
  const suggestions = useMemo(
    () =>
      lastGuestMessage
        ? suggestQuickReplies(
            lastGuestMessage,
            houseForProperty(propertyName),
            customReplies
          )
        : [],
    [lastGuestMessage, propertyName, customReplies]
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap pb-2">
      <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {suggestions.map((reply) => (
        <button
          key={reply.id}
          onClick={() => {
            pushRecent(reply.id);
            onInsert(interpolate(reply.body, vars));
          }}
          title={interpolate(reply.body, vars)}
          className="text-xs px-2.5 py-1 rounded-full border bg-muted/50 hover:bg-accent hover:border-primary/40 transition-colors truncate max-w-60"
        >
          {reply.title}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reply library drawer — popover on desktop, bottom sheet on mobile
// ---------------------------------------------------------------------------

interface QuickReplyPickerProps
  extends Omit<QuickRepliesProps, "lastGuestMessage"> {
  /** Per-house check-in instruction replies (read-only, pinned in the house section). */
  houseReplies: QuickReply[];
  /** Current composer text — offered as the starting body for a new reply. */
  composerText: string;
  saveReply: (input: SaveReplyInput) => Promise<QuickReply>;
  deleteReply: (id: string) => void;
}

export function QuickReplyPicker({
  propertyName,
  vars,
  customReplies,
  houseReplies,
  composerText,
  onInsert,
  saveReply,
  deleteReply,
}: QuickReplyPickerProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const trigger = (
    <Button
      variant="outline"
      size="icon"
      className="h-10 w-10 shrink-0"
      title="Quick replies"
    />
  );

  const browser = (
    <QuickReplyBrowser
      propertyName={propertyName}
      vars={vars}
      customReplies={customReplies}
      houseReplies={houseReplies}
      composerText={composerText}
      saveReply={saveReply}
      deleteReply={deleteReply}
      onInsert={(text) => {
        onInsert(text);
        setOpen(false);
      }}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={trigger}>
          <Zap className="h-4 w-4" />
        </SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton
          aria-label="Quick replies"
          className="h-[85dvh] rounded-t-2xl p-0 gap-0 pb-[env(safe-area-inset-bottom)]"
        >
          {browser}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>
        <Zap className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-104 p-0 gap-0">
        {browser}
      </PopoverContent>
    </Popover>
  );
}

interface Section {
  key: string;
  label: string;
  icon: LucideIcon;
  replies: QuickReply[];
}

type FormState = {
  id?: string;
  title: string;
  body: string;
  category: string;
  house: HouseKey | "";
};

function QuickReplyBrowser({
  propertyName,
  vars,
  customReplies,
  houseReplies,
  composerText,
  onInsert,
  saveReply,
  deleteReply,
}: Omit<QuickReplyPickerProps, "onInsert"> & {
  onInsert: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string>("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Two-tap delete: first tap arms this id, second tap deletes.
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recentIds] = useState<string[]>(readRecents);

  const house = houseForProperty(propertyName);
  const houseLabel = house ? HOUSE_LABELS[house] : null;

  useEffect(() => {
    return () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    };
  }, []);

  const sections = useMemo<Section[]>(() => {
    const q = query.trim().toLowerCase();
    // Replies visible in this conversation: everything account-wide plus
    // anything scoped to this conversation's house. House check-in
    // instructions come first so they pin to the top of the house section.
    const visible = [
      ...houseReplies,
      ...customReplies,
      ...QUICK_REPLIES,
    ].filter((r) => !r.house || r.house === house);
    const matches = (r: QuickReply) =>
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.body.toLowerCase().includes(q) ||
      r.keywords.some((k) => k.includes(q));

    const result: Section[] = [];

    if (!q && activeSection === "all" && recentIds.length > 0) {
      const byId = new Map(visible.map((r) => [r.id, r]));
      const recent = recentIds
        .map((id) => byId.get(id))
        .filter((r): r is QuickReply => !!r)
        .slice(0, 4);
      if (recent.length > 0) {
        result.push({ key: "recent", label: "Recent", icon: History, replies: recent });
      }
    }

    if (house) {
      result.push({
        key: "house",
        label: `${houseLabel} — this house`,
        icon: Home,
        replies: visible.filter((r) => r.house === house && matches(r)),
      });
    }

    // Host-authored account-wide replies whose category isn't a built-in
    // bucket land under "My Replies" so nothing ever disappears.
    const isBuiltinCategory = (c: string) =>
      (QUICK_REPLY_CATEGORIES as readonly string[]).includes(c);
    result.push({
      key: CUSTOM_CATEGORY,
      label: CUSTOM_CATEGORY,
      icon: Bookmark,
      replies: visible.filter(
        (r) => !r.house && r.custom && !isBuiltinCategory(r.category) && matches(r)
      ),
    });

    for (const cat of QUICK_REPLY_CATEGORIES) {
      result.push({
        key: cat,
        label: cat,
        icon: CATEGORY_ICONS[cat] ?? Zap,
        replies: visible.filter(
          (r) => !r.house && r.category === cat && matches(r)
        ),
      });
    }

    // The house section stays pinned under every chip filter — check-in
    // instructions and house fixes must be findable from any category view
    // (a host tapping "Check-in / Checkout" expects the house's check-in
    // instructions to be there).
    return result.filter(
      (s) =>
        s.replies.length > 0 &&
        (activeSection === "all" || s.key === activeSection || s.key === "house")
    );
  }, [query, activeSection, customReplies, houseReplies, house, houseLabel, recentIds]);

  // Chips stay stable while searching so filters don't jump around.
  const chips = useMemo(() => {
    const list: { key: string; label: string; icon: LucideIcon }[] = [];
    if (house) list.push({ key: "house", label: houseLabel!, icon: Home });
    if (customReplies.some((r) => !r.house && !(QUICK_REPLY_CATEGORIES as readonly string[]).includes(r.category))) {
      list.push({ key: CUSTOM_CATEGORY, label: CUSTOM_CATEGORY, icon: Bookmark });
    }
    for (const cat of QUICK_REPLY_CATEGORIES) {
      list.push({ key: cat, label: cat, icon: CATEGORY_ICONS[cat] ?? Zap });
    }
    return list;
  }, [house, houseLabel, customReplies]);

  function handleInsert(reply: QuickReply) {
    pushRecent(reply.id);
    onInsert(interpolate(reply.body, vars));
  }

  function openNewForm(prefill?: Partial<FormState>) {
    setFormError(null);
    setForm({
      title: "",
      body: composerText.trim(),
      category: CUSTOM_CATEGORY,
      house: house ?? "",
      ...prefill,
    });
  }

  function openEditForm(reply: QuickReply) {
    setFormError(null);
    setForm({
      id: reply.id,
      title: reply.title,
      body: reply.body,
      category: reply.category,
      house: reply.house ?? "",
    });
  }

  async function handleSave() {
    if (!form || !form.title.trim() || !form.body.trim() || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await saveReply({
        id: form.id,
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        house: form.house || null,
      });
      setForm(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteTap(id: string) {
    if (deleteArmedId === id) {
      deleteReply(id);
      setDeleteArmedId(null);
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    } else {
      setDeleteArmedId(id);
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
      disarmTimer.current = setTimeout(() => setDeleteArmedId(null), 3000);
    }
  }

  // ---- Add / edit form view ----
  if (form) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-1 p-2 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setForm(null)}
            aria-label="Back to replies"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="font-heading text-sm font-medium">
            {form.id ? "Edit quick reply" : "New quick reply"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <Input
            placeholder="Title (shown in the list)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
          <Textarea
            placeholder="Message the guest receives…"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={6}
            className="resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Applies to
              </span>
              <select
                value={form.house}
                onChange={(e) =>
                  setForm({ ...form, house: e.target.value as HouseKey | "" })
                }
                className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">All homes</option>
                {HOUSE_KEYS.map((h) => (
                  <option key={h} value={h}>
                    {HOUSE_LABELS[h]} only
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Category
              </span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value={CUSTOM_CATEGORY}>{CUSTOM_CATEGORY}</option>
                {QUICK_REPLY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: <code className="text-[11px]">{"{{guest_first_name}}"}</code> and{" "}
            <code className="text-[11px]">{"{{max_guests}}"}</code> fill in
            automatically when used.
          </p>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
        <div className="p-3 border-t flex gap-2 shrink-0">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setForm(null)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!form.title.trim() || !form.body.trim() || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : form.id ? (
              "Save changes"
            ) : (
              "Save reply"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ---- Browse view ----
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search quick replies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9 pr-9"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CategoryChip
            active={activeSection === "all"}
            onClick={() => setActiveSection("all")}
          >
            All
          </CategoryChip>
          {chips.map((chip) => (
            <CategoryChip
              key={chip.key}
              active={activeSection === chip.key}
              onClick={() =>
                setActiveSection(activeSection === chip.key ? "all" : chip.key)
              }
            >
              <chip.icon className="h-3 w-3" />
              {chip.label}
            </CategoryChip>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-1 max-h-[60vh] md:max-h-80">
        {sections.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">No matching replies</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openNewForm({ title: query.trim() })}
            >
              <Plus className="h-3.5 w-3.5" />
              Create “{query.trim() || "new reply"}”
            </Button>
          </div>
        ) : (
          sections.map((section) => (
            <div key={section.key}>
              <p className="sticky top-0 z-10 bg-popover flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-2 pb-1">
                <section.icon className="h-3 w-3" />
                {section.label}
              </p>
              {section.replies.map((reply) => (
                <div
                  key={`${section.key}-${reply.id}`}
                  className="group flex items-start gap-1 rounded hover:bg-accent transition-colors"
                >
                  <button
                    onClick={() => handleInsert(reply)}
                    className="flex-1 min-w-0 text-left px-2 py-1.5"
                  >
                    <p className="text-sm font-medium flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{reply.title}</span>
                      {reply.custom && (
                        <span className="shrink-0 text-[10px] font-normal text-muted-foreground border rounded-full px-1.5">
                          {reply.house ? HOUSE_LABELS[reply.house] : "All homes"}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {interpolate(reply.body, vars)}
                    </p>
                  </button>
                  {reply.custom && (
                    <div className="flex items-center gap-0.5 pt-1.5 pr-1.5 shrink-0">
                      <button
                        onClick={() => openEditForm(reply)}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                        aria-label="Edit reply"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTap(reply.id)}
                        className={cn(
                          "p-1.5 rounded flex items-center gap-1",
                          deleteArmedId === reply.id
                            ? "text-destructive bg-destructive/10"
                            : "text-muted-foreground hover:text-destructive hover:bg-muted"
                        )}
                        aria-label="Delete reply"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deleteArmedId === reply.id && (
                          <span className="text-[10px] font-medium">Sure?</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="p-2 border-t shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => openNewForm()}
        >
          <Plus className="h-3.5 w-3.5" />
          New quick reply
          {composerText.trim() ? " from current draft" : ""}
        </Button>
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted/50 hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}
