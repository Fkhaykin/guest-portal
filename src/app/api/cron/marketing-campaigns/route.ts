import { NextResponse } from "next/server";
import { processDripCampaigns } from "@/lib/marketing/cron";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const summary = await processDripCampaigns();
  return NextResponse.json({ ok: true, summary });
}
