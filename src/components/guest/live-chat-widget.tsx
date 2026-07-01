"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sf_chat_session";
const POLL_MS = 4000;

type Session = { threadUid: string; token: string };
type Msg = { id: string; from: "you" | "host"; message: string; created_at: string };

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.threadUid && parsed?.token) return parsed as Session;
  } catch {
    /* ignore */
  }
  return null;
}

export function LiveChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore an existing session from a prior visit.
  useEffect(() => {
    setSession(loadSession());
  }, []);

  const poll = useCallback(async (s: Session) => {
    try {
      const res = await fetch(
        `/api/chat/poll?threadUid=${encodeURIComponent(s.threadUid)}&token=${encodeURIComponent(s.token)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: Msg[] };
      setMessages(data.messages ?? []);
    } catch {
      /* transient */
    }
  }, []);

  // Poll while the panel is open and we have a session.
  useEffect(() => {
    if (!open || !session) return;
    poll(session);
    const t = setInterval(() => poll(session), POLL_MS);
    return () => clearInterval(t);
  }, [open, session, poll]);

  // Keep the transcript scrolled to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  // Hide on admin / cleaner surfaces — guest-facing only.
  if (pathname.startsWith("/admin") || pathname.startsWith("/cleaner")) return null;

  async function startChat(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          message: input.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Could not start chat. Please try again.");
        return;
      }
      const s: Session = { threadUid: data.threadUid, token: data.token };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      setSession(s);
      setInput("");
      poll(s);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!session || !input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setBusy(true);
    // Optimistic echo until the next poll returns the authoritative list.
    setMessages((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, from: "you", message: text, created_at: new Date().toISOString() },
    ]);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadUid: session.threadUid, token: session.token, message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not send. Please try again.");
      }
      await poll(session);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Chat with us"
          className="fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl h-[70vh] max-h-[560px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-sm font-semibold leading-tight">Chat with Summit Lakeside</p>
              <p className="text-xs opacity-80 leading-tight">Avg. response under 5 minutes</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!session ? (
            /* Intro form */
            <form onSubmit={startChat} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              <p className="text-sm text-muted-foreground">
                Hi! Leave your details and a message — we typically reply in under 5 minutes.
              </p>
              <Input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
              <Textarea
                placeholder="How can we help?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy} className="mt-auto">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start chat"}
              </Button>
            </form>
          ) : (
            /* Thread */
            <>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    You&apos;re connected. Send us a message!
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        m.from === "you"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "mr-auto bg-muted text-foreground"
                      )}
                    >
                      {m.message}
                    </div>
                  ))
                )}
              </div>
              {error && <p className="px-4 pb-1 text-xs text-destructive">{error}</p>}
              <div className="flex items-end gap-2 border-t p-3">
                <Textarea
                  placeholder="Type a message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={1}
                  className="max-h-24 min-h-9 resize-none"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={sendMessage}
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
