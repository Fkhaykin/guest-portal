import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchMessagesForBooking,
  sendMessage,
} from "@/lib/lodgify/messages";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await params;
  const id = Number(bookingId);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  const messages = await fetchMessagesForBooking(id);
  return NextResponse.json({ messages });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await params;
  const id = Number(bookingId);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  const body = await request.json();
  const text = body?.message;
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const result = await sendMessage(id, text.trim());
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
