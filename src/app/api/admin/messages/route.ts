import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchLastMessageDates } from "@/lib/lodgify/messages";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const bookingIds: number[] = body?.booking_ids;
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return NextResponse.json({ error: "booking_ids required" }, { status: 400 });
  }

  const dates = await fetchLastMessageDates(bookingIds);
  return NextResponse.json({ dates });
}
