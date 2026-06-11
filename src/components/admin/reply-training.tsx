"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";

interface FeedbackRow {
  id: string;
  source: "explicit" | "edit" | "manual";
  note: string | null;
  bad_draft: string | null;
  corrected_draft: string | null;
  guest_message: string | null;
  lodgify_booking_id: number | null;
  created_at: string;
}

const SOURCE_LABELS: Record<FeedbackRow["source"], string> = {
  explicit: "Fix feedback",
  manual: "Manual rule",
  edit: "Edited before send",
};

export function ReplyTraining() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/messages/feedback");
      const data = await res.json();
      if (res.ok) setRows(data.feedback ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addRule() {
    if (!newRule.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/messages/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "manual", note: newRule.trim() }),
      });
      if (res.ok) {
        setNewRule("");
        await load();
      }
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/admin/messages/feedback?id=${id}`, { method: "DELETE" });
  }

  const rules = rows.filter((r) => r.source !== "edit");
  const edits = rows.filter((r) => r.source === "edit");

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          AI Reply Training
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Everything here is applied to every future suggested reply. Rules come from the
          &ldquo;Fix&rdquo; button in the messenger or can be added directly; edit examples are
          captured automatically when you change a suggested reply before sending it.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-2">
          <Input
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRule();
              }
            }}
            placeholder='Add a rule, e.g. "Always mention the gate pass when guests ask about visitors"'
            className="text-sm"
          />
          <Button onClick={addRule} disabled={!newRule.trim() || adding} className="shrink-0">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Standing rules ({rules.length})
              </p>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No rules yet. Use &ldquo;Fix&rdquo; on a bad suggestion, or add one above.
                </p>
              ) : (
                rules.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 rounded-lg border p-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm">{r.note}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {SOURCE_LABELS[r.source]}
                        </Badge>
                        {new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {r.guest_message && (
                          <span className="truncate italic">
                            re: &ldquo;{r.guest_message.slice(0, 60)}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Edit examples ({edits.length}) — the 5 most recent are shown to the AI
              </p>
              {edits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None captured yet. Edit any suggested reply before sending and the
                  before/after pair lands here.
                </p>
              ) : (
                edits.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 rounded-lg border p-3">
                    <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                      <p className="text-muted-foreground line-through line-clamp-2">
                        {r.bad_draft}
                      </p>
                      <p className="line-clamp-2">{r.corrected_draft}</p>
                      <p className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
