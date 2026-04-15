"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Send,
  Loader2,
  MessageSquare,
  User,
  Home,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LodgifyMessage } from "@/lib/lodgify/messages";

type Conversation = {
  id: string;
  lodgify_booking_id: number;
  check_in_date: string;
  check_out_date: string;
  status: "active" | "completed" | "cancelled";
  booking_source: string | null;
  guest: { full_name: string; email: string | null; phone: string | null } | null;
  property: { name: string; nickname: string | null } | null;
};

export default function AdminMessagesPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LodgifyMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load conversations from Supabase
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("registration")
        .select(
          "id, lodgify_booking_id, check_in_date, check_out_date, status, booking_source, guest:guest_id(full_name, email, phone), property:property_id(name, nickname)"
        )
        .not("lodgify_booking_id", "is", null)
        .order("check_in_date", { ascending: false });

      if (data) {
        setConversations(data as unknown as Conversation[]);
      }
      setLoadingConversations(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle deep link via ?booking=123
  useEffect(() => {
    const bookingParam = searchParams.get("booking");
    if (bookingParam) {
      const id = Number(bookingParam);
      if (id && !isNaN(id)) {
        setSelectedBookingId(id);
      }
    }
  }, [searchParams]);

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (!selectedBookingId) return;

    async function fetchMessages() {
      setLoadingMessages(true);
      setMessageError(null);
      setMessages([]);

      try {
        const res = await fetch(`/api/admin/messages/${selectedBookingId}`);
        const data = await res.json();

        if (!res.ok) {
          setMessageError(data.error || "Failed to load messages");
          return;
        }

        setMessages(data.messages ?? []);
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
        // Optimistically add the message
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

        // Re-fetch to get the canonical state
        const refreshRes = await fetch(
          `/api/admin/messages/${selectedBookingId}`
        );
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.messages) {
          setMessages(refreshData.messages);
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
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.guest?.full_name?.toLowerCase().includes(q) ||
        c.property?.name?.toLowerCase().includes(q) ||
        c.property?.nickname?.toLowerCase().includes(q) ||
        String(c.lodgify_booking_id).includes(q)
    );
  }, [conversations, searchQuery]);

  const selectedConversation = conversations.find(
    (c) => c.lodgify_booking_id === selectedBookingId
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "completed":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
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

      <div className="flex flex-1 min-h-0 rounded-lg border bg-card">
        {/* Left panel — Conversation list */}
        <div className="w-80 flex-shrink-0 border-r flex flex-col">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search guests or properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
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
                  key={conv.id}
                  onClick={() => setSelectedBookingId(conv.lodgify_booking_id)}
                  className={cn(
                    "w-full text-left p-3 border-b hover:bg-muted/50 transition-colors",
                    selectedBookingId === conv.lodgify_booking_id &&
                      "bg-accent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {conv.guest?.full_name ?? "Unknown Guest"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.property?.nickname || conv.property?.name || "—"}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(conv.check_in_date)} –{" "}
                        {formatDate(conv.check_out_date)}
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
                      {conv.booking_source && (
                        <span className="text-[10px] text-muted-foreground">
                          {cleanSourceName(conv.booking_source)}
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
        <div className="flex-1 flex flex-col min-w-0">
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
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {selectedConversation.guest?.full_name ?? "Unknown Guest"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Home className="h-3 w-3" />
                      {selectedConversation.property?.nickname ||
                        selectedConversation.property?.name}
                      <span className="opacity-50">|</span>
                      {formatDate(selectedConversation.check_in_date)} –{" "}
                      {formatDate(selectedConversation.check_out_date)}
                      {selectedConversation.booking_source && (
                        <>
                          <span className="opacity-50">|</span>
                          {cleanSourceName(selectedConversation.booking_source)}
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
                    className="min-h-[40px] max-h-[120px] resize-none"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    size="icon"
                    className="h-10 w-10 flex-shrink-0"
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
    </div>
  );
}
