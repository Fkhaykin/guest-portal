"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sparkles, Zap, Search } from "lucide-react";
import { interpolate } from "@/lib/guest-messages/templates";
import {
  QUICK_REPLIES,
  QUICK_REPLY_CATEGORIES,
  suggestQuickReplies,
  type QuickReply,
} from "@/lib/guest-messages/quick-replies";

interface QuickRepliesProps {
  /** The guest's most recent message, if they spoke last (drives suggestions). */
  lastGuestMessage: string | null;
  /** Placeholder values: guest_first_name, max_guests, etc. */
  vars: Record<string, string>;
  /** Called with the interpolated reply text on click. */
  onInsert: (text: string) => void;
}

export function QuickReplySuggestions({
  lastGuestMessage,
  vars,
  onInsert,
}: QuickRepliesProps) {
  const suggestions = useMemo(
    () => (lastGuestMessage ? suggestQuickReplies(lastGuestMessage) : []),
    [lastGuestMessage]
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap pb-2">
      <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {suggestions.map((reply) => (
        <button
          key={reply.id}
          onClick={() => onInsert(interpolate(reply.body, vars))}
          title={interpolate(reply.body, vars)}
          className="text-xs px-2.5 py-1 rounded-full border bg-muted/50 hover:bg-accent hover:border-primary/40 transition-colors truncate max-w-60"
        >
          {reply.title}
        </button>
      ))}
    </div>
  );
}

export function QuickReplyPicker({ vars, onInsert }: Omit<QuickRepliesProps, "lastGuestMessage">) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (r: QuickReply) =>
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.body.toLowerCase().includes(q) ||
      r.keywords.some((k) => k.includes(q));
    return QUICK_REPLY_CATEGORIES.map((cat) => ({
      category: cat,
      replies: QUICK_REPLIES.filter((r) => r.category === cat && matches(r)),
    })).filter((g) => g.replies.length > 0);
  }, [query]);

  function handleInsert(reply: QuickReply) {
    onInsert(interpolate(reply.body, vars));
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            title="Quick replies"
          />
        }
      >
        <Zap className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 p-0 gap-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quick replies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No matching replies
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.category}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-2 pb-1">
                  {group.category}
                </p>
                {group.replies.map((reply) => (
                  <button
                    key={reply.id}
                    onClick={() => handleInsert(reply)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent transition-colors"
                  >
                    <p className="text-sm font-medium">{reply.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {interpolate(reply.body, vars)}
                    </p>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
