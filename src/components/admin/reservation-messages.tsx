"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  message: string;
  subject: string;
  type: string; // "Owner" | "Renter" | "Comment" | ...
  created_at: string;
  sender_name: string;
};

function formatTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ReservationMessages({
  bookingId,
}: {
  bookingId: string | number;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const endpoint = `/api/admin/messages/${encodeURIComponent(String(bookingId))}`;

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = (await res.json()) as { messages: Message[] };
          setMessages(data.messages ?? []);
        }
      } catch {
        /* transient */
      } finally {
        setLoading(false);
      }
    },
    [endpoint]
  );

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 10000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not send message.");
        return;
      }
      setInput("");
      await load(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">Conversation</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => load(true)}
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet. Send the first message below.
          </p>
        ) : (
          messages.map((m) => {
            const isOwner = m.type === "Owner";
            return (
              <div
                key={m.id}
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  isOwner
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground"
                )}
              >
                <div className="whitespace-pre-wrap break-words">{m.message}</div>
                <div
                  className={cn(
                    "mt-1 text-[10px]",
                    isOwner ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}
                >
                  {isOwner ? "You" : m.sender_name || "Guest"} · {formatTime(m.created_at)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="px-4 pb-1 text-xs text-destructive">{error}</p>}

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          placeholder="Type a reply…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          className="max-h-32 min-h-9 resize-none"
        />
        <Button
          type="button"
          size="icon"
          onClick={send}
          disabled={sending || !input.trim()}
          aria-label="Send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
