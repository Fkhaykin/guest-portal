import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";

// Mark a maintenance task fixed (or reopen it after an accidental tap).
export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { task_id: string; done: boolean; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { task_id, done, note } = body;
  if (!task_id || typeof done !== "boolean") {
    return NextResponse.json(
      { error: "task_id and done are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);
  const propertyIds = (assignments ?? []).map((a) => a.property_id);
  if (propertyIds.length === 0) {
    return NextResponse.json({ error: "No assigned properties" }, { status: 403 });
  }

  const { data: task, error } = await supabase
    .from("maintenance_task")
    .update(
      done
        ? {
            status: "done",
            completed_at: new Date().toISOString(),
            completed_by: cleaner.id,
            completion_note: note?.trim() || null,
          }
        : {
            status: "open",
            completed_at: null,
            completed_by: null,
            completion_note: null,
          }
    )
    .eq("id", task_id)
    .in("property_id", propertyIds)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ task });
}
