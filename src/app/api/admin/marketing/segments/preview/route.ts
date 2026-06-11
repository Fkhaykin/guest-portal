import { NextRequest, NextResponse } from "next/server";
import { requireHost } from "@/lib/marketing/auth";
import { previewSegment } from "@/lib/marketing/segments";
import type { SegmentFilter } from "@/types/database";

export async function POST(request: NextRequest) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const { filter } = (await request.json()) as { filter: SegmentFilter };
  const preview = await previewSegment(auth.hostId, filter ?? {});
  return NextResponse.json(preview);
}
