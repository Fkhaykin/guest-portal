"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search,
  Send,
  Loader2,
  MessageSquare,
  User,
  Home,
  CalendarDays,
  RefreshCw,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LodgifyMessage, ConversationThread } from "@/lib/lodgify/messages";
import { GuestMessageSettings } from "@/components/admin/guest-message-settings";
import {
  QuickReplySuggestions,
  QuickReplyPicker,
} from "@/components/admin/quick-replies";
import { maxGuestsForProperty } from "@/lib/guest-messages/quick-replies";

export default function AdminMessagesPage() {
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LodgifyMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // Which booking the `messages` state belongs to — guards effects that would
  // otherwise run against the previous conversation's messages mid-switch.
  const [messagesBookingId, setMessagesBookingId] = useState<number | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  // Exact text of the last auto-inserted draft; if the composer still equals
  // it, the content is replaceable (user hasn't edited).
  const autoDraftRef = useRef<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "current" | "past" | "future">("all");
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

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

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncProgress("Starting…");
    try {
      let offset = 0;
      let done = false;
      let totalProcessed = 0;
      let totalMessages = 0;
      while (!done) {
        const res = await fetch(
          `/api/admin/messages/backfill?offset=${offset}&limit=10&onlyMissing=true`,
          { method: "POST" }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setSyncProgress(`Failed: ${err.error || res.status}`);
          break;
        }
        const data = await res.json();
        totalProcessed += data.processed ?? 0;
        totalMessages += data.messagesWritten ?? 0;
        done = data.done;
        offset = data.next_offset ?? offset + (data.processed ?? 0);
        setSyncProgress(
          `Synced ${totalProcessed}/${data.total ?? "?"} bookings · ${totalMessages} messages`
        );
      }
      await loadConversations();
      setTimeout(() => setSyncProgress(null), 4000);
    } catch {
      setSyncProgress("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  // Handle deep link via ?booking=123
  useEffect(() => {
    const bookingParam = searchParams.get("booking");
    if (bookingParam) {
      const id = Number(bookingParam);
      if (id && !isNaN(id)) {
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
      setNewMessage((cur) => (cur === prevDraft ? "" : cur));

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
      result = result.filter((c) => c.departure < today);
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
    const conv = selectedConversation;
    let cancelled = false;
    setDraftLoading(true);

    fetch(`/api/admin/messages/${bookingId}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: conv?.guest_name ?? null,
        propertyName: conv?.property_name ?? null,
        arrival: conv?.arrival ?? null,
        departure: conv?.departure ?? null,
        status: conv?.status ?? null,
        messages: messages
          .filter((m) => m.type.toLowerCase() !== "comment")
          .map((m) => ({ type: m.type, text: m.message })),
      }),
    })
      .then((res) => res.json())
      .then((data: { draft?: string | null }) => {
        if (cancelled || !data.draft) return;
        autoDraftRef.current = data.draft;
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

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getStatusColor(status: string) {
    switch (status.toLowerCase()) {
      case "active":
      case "booked":
        return "bg-green-100 text-green-800 border-green-200";
      case "completed":
      case "checkedout":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "cancelled":
      case "declined":
        return "bg-red-100 text-red-800 border-red-200";
      case "open":
      case "tentative":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "";
    }
  }

  function cleanSourceName(source: string) {
    return source
      .replace(/\s*integration\s*/i, "")
      .replace(/\s*api\s*/i, "")
      .trim();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">
          Lodgify booking conversations
        </p>
      </div>

      <Tabs defaultValue="inbox" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-fit mb-3 shrink-0">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="auto-messages">Auto Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="auto-messages" className="overflow-y-auto mt-0">
          <GuestMessageSettings />
        </TabsContent>

        <TabsContent value="inbox" className="flex-1 min-h-0 mt-0">
        <div className="flex h-full rounded-lg border bg-card">
        {/* Left panel — Conversation list */}
        <div className={cn(
          "shrink-0 border-r flex-col md:w-80 w-full",
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
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="h-7 text-xs gap-1.5"
              >
                {syncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Sync from Lodgify
              </Button>
              {syncProgress && (
                <span className="text-[11px] text-muted-foreground truncate">
                  {syncProgress}
                </span>
              )}
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
                  : "No Lodgify bookings found"}
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.booking_id}
                  onClick={() => {
                    setSelectedBookingId(conv.booking_id);
                    setMobileView("thread");
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
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(conv.arrival)} –{" "}
                        {formatDate(conv.departure)}
                      </div>
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
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {selectedConversation.guest_name || "Unknown Guest"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {selectedConversation.property_name && (
                        <>
                          <Home className="h-3 w-3" />
                          {selectedConversation.property_name}
                          <span className="opacity-50">|</span>
                        </>
                      )}
                      {formatDate(selectedConversation.arrival)} –{" "}
                      {formatDate(selectedConversation.departure)}
                      {selectedConversation.source && (
                        <>
                          <span className="opacity-50">|</span>
                          {cleanSourceName(selectedConversation.source)}
                        </>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={getStatusColor(selectedConversation.status)}
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
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.message}
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
              <div className="p-3 border-t">
                {!newMessage.trim() && (
                  <QuickReplySuggestions
                    lastGuestMessage={lastGuestMessage}
                    propertyName={selectedConversation?.property_name ?? null}
                    vars={quickReplyVars}
                    onInsert={(text) => {
                      autoDraftRef.current = text;
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
                  <div className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Suggested reply — review, edit, or hit send
                    <button
                      className="underline hover:text-foreground"
                      onClick={() => {
                        setNewMessage("");
                        autoDraftRef.current = null;
                      }}
                    >
                      Discard
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
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
                    className="min-h-10 max-h-30 resize-none"
                  />
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
            </>
          )}
        </div>
        </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
