"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Send,
  Loader2,
  MessageSquare,
  Home,
  CalendarDays,
  ChevronLeft,
  Sparkles,
  Settings,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toneBadge, type Tone } from "@/lib/status-styles";
import type { LodgifyMessage, ConversationThread } from "@/lib/lodgify/messages";
import {
  QuickReplySuggestions,
  QuickReplyPicker,
} from "@/components/admin/quick-replies";
import {
  maxGuestsForProperty,
  houseForProperty,
  type HouseKey,
} from "@/lib/guest-messages/quick-replies";
import { platformGlyph, PlatformLogo } from "@/components/admin/platform-logo";

// Turn bare URLs in a message into tappable links. Splitting on a capturing
// group keeps the delimiters, so URL chunks become anchors and the rest stays
// text. break-all lets a long registration link wrap inside the bubble instead
// of overflowing it.
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function linkifyMessage(text: string) {
  return text.split(URL_PATTERN).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 break-all hover:opacity-80"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

const HOUSE_LABELS: Record<HouseKey, string> = {
  lakehouse: "Lakehouse",
  chalet: "Chalet",
  manor: "Manor",
  cottage: "Cottage",
  mansion: "Mansion",
};

export default function AdminMessagesPage() {
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  // Lodgify bookings are keyed by numeric booking id; direct bookings by
  // registration UUID — same key space as ConversationThread.booking_id.
  const [selectedBookingId, setSelectedBookingId] = useState<number | string | null>(null);
  const [messages, setMessages] = useState<LodgifyMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // Which booking the `messages` state belongs to — guards effects that would
  // otherwise run against the previous conversation's messages mid-switch.
  const [messagesBookingId, setMessagesBookingId] = useState<number | string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  // Exact text of the last auto-inserted draft; if the composer still equals
  // it, the content is replaceable (user hasn't edited).
  const autoDraftRef = useRef<string | null>(null);
  // Where the inserted text came from — only AI drafts feed the training loop.
  const autoDraftSourceRef = useRef<"ai" | "quick-reply" | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [fixNote, setFixNote] = useState("");
  // Which rule save is in flight (drives the per-button spinner), or null.
  const [fixing, setFixing] = useState<null | "house" | "global">(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "current" | "past" | "future">("all");
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  // Full-screen composer: blows the message input up to fill the viewport so
  // long replies are easier to write, then shrinks back to the inline bar.
  const [composerExpanded, setComposerExpanded] = useState(false);

  async function loadConversations() {
    try {
      const res = await fetch("/api/admin/messages");
      const data = await res.json();
      if (res.ok && data.conversations) {
        setConversations(data.conversations);
      }
    } catch {
      // silent
    } finally {
      setLoadingConversations(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  // Handle deep link via ?booking=123 (Lodgify) or ?booking=<uuid> (direct)
  useEffect(() => {
    const bookingParam = searchParams.get("booking");
    if (bookingParam) {
      const numeric = Number(bookingParam);
      const id = numeric && !isNaN(numeric) ? numeric : bookingParam;
      if (id) {
        setSelectedBookingId(id);
        setMobileView("thread");
      }
    }
  }, [searchParams]);

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (!selectedBookingId) return;
    const bookingId = selectedBookingId;

    async function fetchMessages() {
      setLoadingMessages(true);
      setMessageError(null);
      setMessages([]);
      setMessagesBookingId(null);
      // Clear any untouched auto-draft from the previous conversation.
      // Capture the ref BEFORE nulling it — the functional updater runs later,
      // and comparing against an already-nulled ref would keep the stale draft.
      const prevDraft = autoDraftRef.current;
      autoDraftRef.current = null;
      autoDraftSourceRef.current = null;
      setNewMessage((cur) => (cur === prevDraft ? "" : cur));
      setFixOpen(false);
      setFixNote("");

      try {
        const res = await fetch(`/api/admin/messages/${bookingId}`);
        const data = await res.json();

        if (!res.ok) {
          setMessageError(data.error || "Failed to load messages");
          return;
        }

        const msgs: LodgifyMessage[] = data.messages ?? [];
        // Sort oldest first (top) → newest last (bottom), like a chat
        msgs.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
        setMessages(msgs);
        setMessagesBookingId(bookingId);
      } catch {
        setMessageError("Failed to connect to messaging service");
      } finally {
        setLoadingMessages(false);
      }
    }

    fetchMessages();
  }, [selectedBookingId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!newMessage.trim() || !selectedBookingId || sending) return;

    // Implicit training: the host edited an AI draft before sending — record
    // the (draft -> sent) pair as a correction example for future drafts.
    const sentText = newMessage.trim();
    const draftAtSend = autoDraftSourceRef.current === "ai" ? autoDraftRef.current : null;
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    if (draftAtSend && normalize(draftAtSend) !== normalize(sentText)) {
      fetch("/api/admin/messages/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "edit",
          bookingId: selectedBookingId,
          guestMessage: lastGuestMessage,
          badDraft: draftAtSend,
          correctedDraft: sentText,
        }),
      }).catch(() => {
        // training capture is best-effort
      });
    }

    setSending(true);
    try {
      const res = await fetch(`/api/admin/messages/${selectedBookingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      if (res.ok) {
        // Optimistically append (oldest first, newest at bottom)
        setMessages((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            message: newMessage.trim(),
            subject: "",
            type: "Owner",
            created_at: new Date().toISOString(),
            sender_name: "You",
          },
        ]);
        setNewMessage("");
        autoDraftRef.current = null;
        autoDraftSourceRef.current = null;
        setFixOpen(false);
        setFixNote("");
        // Drop back to the inline composer so the sent message is visible.
        setComposerExpanded(false);

        // Re-fetch to get the canonical state
        const refreshRes = await fetch(
          `/api/admin/messages/${selectedBookingId}`
        );
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.messages) {
          const msgs: LodgifyMessage[] = refreshData.messages;
          msgs.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
          setMessages(msgs);
        }
      } else {
        const data = await res.json();
        setMessageError(data.error || "Failed to send message");
      }
    } catch {
      setMessageError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let result = conversations;

    // Apply time filter
    if (timeFilter === "current") {
      result = result.filter((c) => c.arrival <= today && c.departure >= today);
    } else if (timeFilter === "past") {
      result = result.filter((c) => c.departure && c.departure < today);
    } else if (timeFilter === "future") {
      result = result.filter((c) => c.arrival > today);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.guest_name?.toLowerCase().includes(q) ||
          c.property_name?.toLowerCase().includes(q) ||
          String(c.booking_id).includes(q)
      );
    }

    // Already sorted by last_message_date from the API
    return result;
  }, [conversations, searchQuery, timeFilter]);

  const selectedConversation = conversations.find(
    (c) => c.booking_id === selectedBookingId
  );

  // House for the open thread — gates the "Add house rule" button and labels it.
  const conversationHouse = houseForProperty(
    selectedConversation?.property_name
  );
  const houseLabel = conversationHouse ? HOUSE_LABELS[conversationHouse] : null;

  // Official brand glyph for the booking channel (Airbnb, Booking.com, …), or
  // null when we have no real mark for the source — those fall back to text.
  const sourceGlyph = platformGlyph(selectedConversation?.source);

  // Guest's latest message, but only when the guest spoke last — that's when
  // a reply suggestion is useful.
  const lastGuestMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const type = messages[i].type.toLowerCase();
      if (type === "comment") continue;
      return type === "renter" ? messages[i].message : null;
    }
    return null;
  }, [messages]);

  const quickReplyVars = useMemo(
    () => ({
      guest_first_name:
        selectedConversation?.guest_name?.trim().split(/\s+/)[0] ?? "there",
      max_guests: maxGuestsForProperty(selectedConversation?.property_name),
    }),
    [selectedConversation]
  );

  function buildDraftPayload() {
    const conv = selectedConversation;
    return {
      guestName: conv?.guest_name ?? null,
      propertyName: conv?.property_name ?? null,
      arrival: conv?.arrival ?? null,
      departure: conv?.departure ?? null,
      status: conv?.status ?? null,
      messages: messages
        .filter((m) => m.type.toLowerCase() !== "comment")
        .map((m) => ({ type: m.type, text: m.message })),
    };
  }

  // Auto-draft: whenever the guest spoke last, generate a suggested reply and
  // prepopulate the composer (unless the admin already typed something).
  useEffect(() => {
    if (!selectedBookingId || !lastGuestMessage || loadingMessages) return;
    // Messages still belong to a different conversation mid-switch — wait.
    if (messagesBookingId !== selectedBookingId) return;

    // Don't clobber the admin's own text; an untouched prior draft is fair game.
    const composerUntouched =
      !newMessage.trim() || newMessage === autoDraftRef.current;
    if (!composerUntouched) return;

    const bookingId = selectedBookingId;
    let cancelled = false;
    setDraftLoading(true);

    fetch(`/api/admin/messages/${bookingId}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDraftPayload()),
    })
      .then((res) => res.json())
      .then((data: { draft?: string | null }) => {
        if (cancelled || !data.draft) return;
        autoDraftRef.current = data.draft;
        autoDraftSourceRef.current = "ai";
        setNewMessage((current) => {
          // Re-check at set time — admin may have started typing meanwhile
          if (current.trim() && current !== autoDraftRef.current) return current;
          return data.draft as string;
        });
      })
      .catch(() => {
        // silent — quick-reply chips remain as fallback
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookingId, messagesBookingId, lastGuestMessage, loadingMessages]);

  // Rule flow: host says what the draft got wrong — saves it as a standing
  // rule (scoped to this house, or global) and regenerates a corrected reply.
  // The note feeds future drafts: house rules only for this home, global for all.
  async function handleAddRule(scope: "house" | "global") {
    const badDraft = autoDraftRef.current;
    if (!selectedBookingId || !badDraft || !fixNote.trim() || fixing) return;
    if (scope === "house" && !conversationHouse) return;
    setFixing(scope);
    try {
      const res = await fetch(`/api/admin/messages/${selectedBookingId}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildDraftPayload(),
          feedback: { badDraft, note: fixNote.trim(), scope },
        }),
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        autoDraftRef.current = data.draft;
        autoDraftSourceRef.current = "ai";
        setNewMessage(data.draft);
        setFixNote("");
        setFixOpen(false);
      } else {
        setMessageError(data.error || "Failed to save rule");
      }
    } catch {
      setMessageError("Failed to save rule");
    } finally {
      setFixing(null);
    }
  }

  // On-demand AI draft (the toolbar button in full-screen). The effect above
  // only fires when the guest spoke last; this lets the host pull a draft —
  // or regenerate the current one — at any time.
  async function generateDraft() {
    if (!selectedBookingId || draftLoading) return;
    setDraftLoading(true);
    try {
      const res = await fetch(
        `/api/admin/messages/${selectedBookingId}/suggest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildDraftPayload()),
        }
      );
      const data = await res.json();
      if (res.ok && data.draft) {
        autoDraftRef.current = data.draft;
        autoDraftSourceRef.current = "ai";
        setNewMessage(data.draft);
        setFixOpen(false);
        setFixNote("");
      } else {
        setMessageError(data.error || "Failed to draft reply");
      }
    } catch {
      setMessageError("Failed to draft reply");
    } finally {
      setDraftLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getStatusColor(status: string) {
    let tone: Tone;
    switch (status.toLowerCase()) {
      case "active":
      case "booked":
        tone = "success";
        break;
      case "completed":
      case "checkedout":
        tone = "warning";
        break;
      case "cancelled":
      case "declined":
        tone = "danger";
        break;
      case "open":
      case "tentative":
      case "inquiry":
        tone = "info";
        break;
      default:
        return "";
    }
    return toneBadge(tone);
  }

  function cleanSourceName(source: string) {
    return source
      .replace(/\s*integration\s*/i, "")
      .replace(/\s*api\s*/i, "")
      .trim();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-start justify-between gap-2">
        <PageHeader title="Messages" />
        <Link
          href="/admin/messages/settings"
          title="Auto messages"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            // mr-12 clears the fixed mobile menu toggle
            "mr-12 md:mr-0"
          )}
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      {/* -mx-6/-mb-6 cancel the admin layout's p-6 so the list runs edge-to-edge on mobile */}
      <div className="flex flex-1 min-h-0 bg-card -mx-6 -mb-6 md:mx-0 md:mb-0 md:rounded-lg md:border">
        {/* Left panel — Conversation list */}
        <div className={cn(
          "shrink-0 md:border-r flex-col md:w-80 w-full",
          mobileView === "thread" ? "hidden md:flex" : "flex"
        )}>
          {/* Search + Filters */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search guests or properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "current", "past", "future"] as const).map((f) => (
                <Button
                  key={f}
                  variant={timeFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeFilter(f)}
                  className="flex-1 text-xs capitalize h-7"
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? "No matching conversations"
                  : "No conversations found"}
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.booking_id}
                  onClick={() => {
                    setSelectedBookingId(conv.booking_id);
                    setMobileView("thread");
                    // Opening the thread marks it read server-side; mirror that
                    // here so the badge clears without a list refetch.
                    setConversations((prev) =>
                      prev.map((c) =>
                        c.booking_id === conv.booking_id
                          ? { ...c, unread_count: 0 }
                          : c
                      )
                    );
                  }}
                  className={cn(
                    "w-full text-left p-3 border-b hover:bg-muted/50 transition-colors",
                    selectedBookingId === conv.booking_id && "bg-accent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {conv.guest_name || "Unknown Guest"}
                      </p>
                      {conv.property_name && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.property_name}
                        </p>
                      )}
                      {conv.last_message_preview && (
                        <p
                          className={cn(
                            "text-xs truncate mt-0.5",
                            conv.unread_count > 0
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {conv.last_message_preview}
                        </p>
                      )}
                      {(conv.arrival || conv.departure) && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(conv.arrival)} –{" "}
                          {formatDate(conv.departure)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          getStatusColor(conv.status)
                        )}
                      >
                        {conv.status}
                      </Badge>
                      {conv.source && (
                        <span className="text-[10px] text-muted-foreground">
                          {cleanSourceName(conv.source)}
                        </span>
                      )}
                      {conv.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel — Message thread */}
        <div className={cn(
          "flex-1 flex-col min-w-0",
          mobileView === "list" ? "hidden md:flex" : "flex"
        )}>
          {!selectedBookingId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MessageSquare className="h-12 w-12 opacity-30" />
              <p className="text-sm">
                Select a conversation to view messages
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              {selectedConversation && (
                <div className="p-4 border-b flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden -ml-1 shrink-0"
                    onClick={() => setMobileView("list")}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedConversation.registration_id ? (
                        <Link
                          href={`/admin/reservations/${selectedConversation.registration_id}`}
                          className="font-semibold text-sm truncate hover:underline"
                          title="View reservation details"
                        >
                          {selectedConversation.guest_name || "Unknown Guest"}
                        </Link>
                      ) : (
                        <p className="font-semibold text-sm truncate">
                          {selectedConversation.guest_name || "Unknown Guest"}
                        </p>
                      )}
                      {selectedConversation.source &&
                        (sourceGlyph ? (
                          <PlatformLogo
                            glyph={sourceGlyph}
                            className="h-4 w-4 shrink-0"
                          />
                        ) : (
                          <Badge
                            variant="secondary"
                            className="shrink-0 h-4 px-1.5 text-[10px] font-medium"
                          >
                            {cleanSourceName(selectedConversation.source)}
                          </Badge>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {selectedConversation.property_name && (
                        <span className="flex items-center gap-1 min-w-0 max-w-full">
                          <Home className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {selectedConversation.property_name}
                          </span>
                        </span>
                      )}
                      {(selectedConversation.arrival ||
                        selectedConversation.departure) && (
                        <span className="whitespace-nowrap">
                          {formatDate(selectedConversation.arrival)} –{" "}
                          {formatDate(selectedConversation.departure)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0",
                      getStatusColor(selectedConversation.status)
                    )}
                  >
                    {selectedConversation.status}
                  </Badge>
                </div>
              )}

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messageError ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <p className="text-sm">{messageError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedBookingId((prev) => {
                          // Re-trigger fetch
                          setSelectedBookingId(null);
                          setTimeout(() => setSelectedBookingId(prev), 0);
                          return prev;
                        })
                      }
                    >
                      Retry
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">
                      Send a message to start the conversation
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwner =
                      msg.type === "Owner" || msg.type === "owner";
                    const isComment =
                      msg.type === "Comment" || msg.type === "comment";

                    if (isComment) {
                      return (
                        <div
                          key={msg.id}
                          className="flex justify-center"
                        >
                          <p className="text-xs text-muted-foreground italic bg-muted px-3 py-1 rounded-full">
                            {msg.message}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isOwner ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            isOwner
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          {msg.sender_name && !isOwner && (
                            <p className="text-xs font-medium mb-0.5 opacity-70">
                              {msg.sender_name}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap wrap-break-word">
                            {linkifyMessage(msg.message)}
                          </p>
                          {msg.created_at && (
                            <p
                              className={cn(
                                "text-[10px] mt-1",
                                isOwner
                                  ? "text-primary-foreground/60"
                                  : "text-muted-foreground"
                              )}
                            >
                              {new Date(msg.created_at).toLocaleString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                  // Pin to Eastern so timestamps read in the
                                  // host's/property's local time regardless of
                                  // the viewer's device timezone.
                                  timeZone: "America/New_York",
                                }
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div
                className={cn(
                  composerExpanded
                    ? "fixed inset-0 z-50 flex flex-col gap-2 bg-background p-4"
                    : "p-3 border-t"
                )}
              >
                {composerExpanded && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {selectedConversation?.guest_name || "Compose message"}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setComposerExpanded(false)}
                      aria-label="Exit full screen"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {!newMessage.trim() && (
                  <QuickReplySuggestions
                    lastGuestMessage={lastGuestMessage}
                    propertyName={selectedConversation?.property_name ?? null}
                    vars={quickReplyVars}
                    onInsert={(text) => {
                      autoDraftRef.current = text;
                      autoDraftSourceRef.current = "quick-reply";
                      setNewMessage(text);
                    }}
                  />
                )}
                {draftLoading && !newMessage.trim() && (
                  <div className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Drafting a suggested reply…
                  </div>
                )}
                {!draftLoading && newMessage && newMessage === autoDraftRef.current && (
                  <div className="pb-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Suggested reply — review, edit, or hit send
                      {autoDraftSourceRef.current === "ai" && (
                        <button
                          className="underline hover:text-foreground"
                          onClick={() => setFixOpen((v) => !v)}
                        >
                          Add rule…
                        </button>
                      )}
                      <button
                        className="underline hover:text-foreground"
                        onClick={() => {
                          setNewMessage("");
                          autoDraftRef.current = null;
                          autoDraftSourceRef.current = null;
                          setFixOpen(false);
                          setFixNote("");
                        }}
                      >
                        Discard
                      </button>
                    </div>
                    {fixOpen && (
                      <div className="space-y-1.5">
                        <Input
                          value={fixNote}
                          onChange={(e) => setFixNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddRule(conversationHouse ? "house" : "global");
                            }
                          }}
                          placeholder='Rule for the AI, e.g. "Never offer free late checkout on Sundays"'
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs shrink-0"
                            onClick={() => handleAddRule("house")}
                            disabled={!fixNote.trim() || !!fixing || !conversationHouse}
                            title={
                              conversationHouse
                                ? `Saved for future ${houseLabel} replies only`
                                : "No house detected for this conversation"
                            }
                          >
                            {fixing === "house" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              `Add ${houseLabel ?? "house"} rule`
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs shrink-0"
                            onClick={() => handleAddRule("global")}
                            disabled={!fixNote.trim() || !!fixing}
                            title="Saved for every home's future replies"
                          >
                            {fixing === "global" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Add global rule"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "flex gap-2",
                    composerExpanded && "flex-1 flex-col"
                  )}
                >
                  <Textarea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    className={cn(
                      "resize-none",
                      composerExpanded
                        ? "min-h-0 max-h-none flex-1"
                        : "min-h-10 max-h-30"
                    )}
                  />
                  {/* Inline beside the box when collapsed; a bottom toolbar when
                      expanded. `contents` lets the buttons sit in the parent row
                      directly so the collapsed layout is unchanged. */}
                  <div
                    className={cn(
                      composerExpanded ? "flex items-center gap-2" : "contents"
                    )}
                  >
                    {composerExpanded && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={generateDraft}
                          disabled={draftLoading || !selectedBookingId}
                        >
                          {draftLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-primary" />
                          )}
                          {newMessage && newMessage === autoDraftRef.current
                            ? "Regenerate"
                            : "Draft with AI"}
                        </Button>
                        {/* Push the reply library + send to the right edge. */}
                        <div className="flex-1" />
                      </>
                    )}
                    {!composerExpanded && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => setComposerExpanded(true)}
                        aria-label="Full screen"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    )}
                    <QuickReplyPicker
                      propertyName={selectedConversation?.property_name ?? null}
                      vars={quickReplyVars}
                      onInsert={(text) => {
                        autoDraftRef.current = text;
                        setNewMessage(text);
                      }}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sending}
                      size="icon"
                      className="h-10 w-10 shrink-0"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
