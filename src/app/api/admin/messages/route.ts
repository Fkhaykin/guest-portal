import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllConversations } from "@/lib/lodgify/messages";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Build property ID → name map from Supabase
  const { data: properties } = await supabase
    .from("property")
    .select("lodgify_property_id, name, nickname");

  const propertyMap: Record<number, string> = {};
  if (properties) {
    for (const p of properties) {
      if (p.lodgify_property_id) {
        propertyMap[p.lodgify_property_id] = p.nickname || p.name;
      }
    }
  }

  const conversations = await fetchAllConversations(propertyMap);
  return NextResponse.json({ conversations });
}
