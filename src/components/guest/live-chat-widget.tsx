"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sf_chat_session";
// Guest session written by the booking lookup (see checkin/page.tsx).
const GUEST_SESSION_KEY = "guest-portal-session";
const GUEST_TOKEN_KEY = "guest-portal-token";
const POLL_MS = 4000;
// Draggable launcher position (persisted across visits).
const POS_KEY = "sf_chat_pos";
const BTN_SIZE = 56; // matches h-14 w-14
const EDGE_GAP = 8; // keep this far from the viewport edges
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag, not a tap

type Session = { threadUid: string; token: string };
type GuestAuth = { registrationId: string; guestToken: string; guestName: string };
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

// A guest who looked up their reservation carries a session + an HMAC token
// bound to their registration id — enough to identify them without a form.
function loadGuestAuth(): GuestAuth | null {
  try {
    const raw = sessionStorage.getItem(GUEST_SESSION_KEY);
    const guestToken = sessionStorage.getItem(GUEST_TOKEN_KEY);
    if (!raw || !guestToken) return null;
    const s = JSON.parse(raw);
    const registrationId = s?.reservation?.id;
    if (!registrationId || typeof registrationId !== "string") return null;
    return {
      registrationId,
      guestToken,
      guestName: typeof s?.guestName === "string" ? s.guestName : "",
    };
  } catch {
    return null;
  }
}

type Point = { x: number; y: number };

function loadPos(): Point | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === "number" && typeof p?.y === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
}

// Keep the launcher fully on screen (used on load, on drag, and on resize).
function clampToViewport(x: number, y: number): Point {
  const maxX = Math.max(EDGE_GAP, window.innerWidth - BTN_SIZE - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - BTN_SIZE - EDGE_GAP);
  return {
    x: Math.min(Math.max(EDGE_GAP, x), maxX),
    y: Math.min(Math.max(EDGE_GAP, y), maxY),
  };
}

export function LiveChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  // Web thread for a logged-in guest — kept separate from the anonymous
  // `session` so a prior anonymous chat can't hijack an authenticated send.
  const [authedSession, setAuthedSession] = useState<Session | null>(null);
  const [guestAuth, setGuestAuth] = useState<GuestAuth | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Draggable launcher. `pos` null => default bottom-right (CSS); once dragged,
  // an absolute {x,y} takes over. Drag state lives in refs so moves don't thrash
  // React; `justDragged` swallows the click that follows a drag.
  const [pos, setPos] = useState<Point | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const latestPosRef = useRef<Point | null>(null);
  const justDraggedRef = useRef(false);

  // Restore identity: a logged-in guest wins (skip the form); otherwise fall
  // back to an anonymous web-chat session from a prior visit.
  useEffect(() => {
    const ga = loadGuestAuth();
    setGuestAuth(ga);
    if (!ga) setSession(loadSession());
    const p = loadPos();
    if (p) {
      const c = clampToViewport(p.x, p.y);
      latestPosRef.current = c;
      setPos(c);
    }
  }, []);

  // Keep the launcher on screen when the viewport changes.
  useEffect(() => {
    function onResize() {
      setPos((prev) => {
        if (!prev) return prev;
        const c = clampToViewport(prev.x, prev.y);
        latestPosRef.current = c;
        return c;
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const poll = useCallback(async () => {
    try {
      let url: string | null = null;
      let headers: Record<string, string> | undefined;
      if (guestAuth) {
        // Registration id (a UUID) is fine in the URL; the guest token rides in
        // the header so it never lands in access logs or browser history.
        url = `/api/chat/poll?registrationId=${encodeURIComponent(
          guestAuth.registrationId
        )}`;
        headers = { "x-guest-token": guestAuth.guestToken };
      } else if (session) {
        url = `/api/chat/poll?threadUid=${encodeURIComponent(
          session.threadUid
        )}&token=${encodeURIComponent(session.token)}`;
      }
      if (!url) return;
      const res = await fetch(url, headers ? { headers } : undefined);
      if (!res.ok) return;
      const data = (await res.json()) as { messages: Msg[] };
      setMessages(data.messages ?? []);
    } catch {
      /* transient */
    }
  }, [guestAuth, session]);

  // Poll while the panel is open and we have someone to poll for.
  useEffect(() => {
    if (!open || (!guestAuth && !session)) return;
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [open, guestAuth, session, poll]);

  // Keep the transcript scrolled to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  // Hide on admin / cleaner surfaces — guest-facing only.
  if (pathname.startsWith("/admin") || pathname.startsWith("/cleaner")) return null;

  // A guest may look up their booking after this widget mounted — re-check on
  // open so their conversation "just works" without the form.
  function openChat() {
    const ga = loadGuestAuth();
    setGuestAuth(ga);
    if (!ga) setSession(loadSession());
    setError(null);
    setOpen(true);
  }

  // --- Draggable launcher (pointer events cover both mouse and touch) ---
  function onLauncherPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
  }

  function onLauncherPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // Ignore tiny jitter so a plain tap still opens the chat.
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    const c = clampToViewport(d.originX + dx, d.originY + dy);
    latestPosRef.current = c;
    setPos(c);
  }

  function onLauncherPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (d?.moved) {
      // A drag just ended — persist it and swallow the click that follows.
      justDraggedRef.current = true;
      if (latestPosRef.current) {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(latestPosRef.current));
        } catch {
          /* ignore */
        }
      }
    }
  }

  function onLauncherClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    openChat();
  }

  const knownGuest = !!guestAuth;
  const showForm = !guestAuth && !session;
  const firstName = guestAuth?.guestName?.trim().split(/\s+/)[0] ?? "";

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
      poll();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setError(null);
    // Optimistic echo until the next poll returns the authoritative list.
    setMessages((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, from: "you", message: text, created_at: new Date().toISOString() },
    ]);
    try {
      // Logged-in guest: send into their reservation-linked web thread, starting
      // (or resuming) it on the first message. Never touches the anonymous flow.
      if (guestAuth) {
        if (!authedSession) {
          const res = await fetch("/api/chat/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              registrationId: guestAuth.registrationId,
              guestToken: guestAuth.guestToken,
              message: text,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data?.error ?? "Could not send. Please try again.");
            return;
          }
          // In-memory only: the login is per-tab, so the web thread is too.
          setAuthedSession({ threadUid: data.threadUid, token: data.token });
          await poll();
          return;
        }
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadUid: authedSession.threadUid,
            token: authedSession.token,
            message: text,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error ?? "Could not send. Please try again.");
        }
        await poll();
        return;
      }

      // Anonymous visitor: the intro form already created the web thread.
      if (!session) return;
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadUid: session.threadUid, token: session.token, message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not send. Please try again.");
      }
      await poll();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher — tap to open, drag to reposition */}
      {!open && (
        <button
          type="button"
          onClick={onLauncherClick}
          onPointerDown={onLauncherPointerDown}
          onPointerMove={onLauncherPointerMove}
          onPointerUp={onLauncherPointerUp}
          onPointerCancel={onLauncherPointerUp}
          aria-label="Chat with us"
          style={pos ? { left: pos.x, top: pos.y } : undefined}
          className={cn(
            "fixed z-50 flex h-14 w-14 touch-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pos ? "cursor-grab active:cursor-grabbing" : "right-4 bottom-4 transition-transform"
          )}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl h-[70vh] max-h-140">
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

          {showForm ? (
            /* Intro form — anonymous visitors only */
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
                    {knownGuest
                      ? `Hi${firstName ? ` ${firstName}` : ""}! How can we help with your stay?`
                      : "You're connected. Send us a message!"}
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
