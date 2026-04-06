"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/types/database";

export default function AdminFaqsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [faqs, setFaqs] = useState<Tables<"faq">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"faq"> | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadFaqs();
  }, [id]);

  async function loadFaqs() {
    const { data } = await supabase
      .from("faq")
      .select("*")
      .eq("property_id", id)
      .order("sort_order");
    if (data) setFaqs(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      property_id: id,
      question: formData.get("question") as string,
      answer: formData.get("answer") as string,
      category: (formData.get("category") as string) || null,
    };

    if (editing) {
      await supabase.from("faq").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("faq").insert(payload);
    }

    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    loadFaqs();
  }

  async function handleDelete(faqId: string) {
    if (!confirm("Delete this FAQ?")) return;
    await supabase.from("faq").delete().eq("id", faqId);
    loadFaqs();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">FAQs</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}>
          <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-2" />
              Add FAQ
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit FAQ" : "New FAQ"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question">Question</Label>
                <Input
                  id="question"
                  name="question"
                  defaultValue={editing?.question ?? ""}
                  placeholder="What is the WiFi password?"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="answer">Answer</Label>
                <Textarea
                  id="answer"
                  name="answer"
                  defaultValue={editing?.answer ?? ""}
                  placeholder="The WiFi network is 'GuestWiFi' and the password is..."
                  rows={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category (optional)</Label>
                <Input
                  id="category"
                  name="category"
                  defaultValue={editing?.category ?? ""}
                  placeholder="WiFi & Tech"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {faqs.length > 0 ? (
        <div className="space-y-3">
          {faqs.map((faq) => (
            <Card key={faq.id}>
              <CardHeader className="flex flex-row items-start justify-between py-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{faq.question}</CardTitle>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(faq);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(faq.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No FAQs yet.</p>
      )}
    </div>
  );
}
