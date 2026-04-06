"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Trash2, QrCode } from "lucide-react";
import type { Tables } from "@/types/database";

const targetTypes = [
  { value: "home", label: "Property Home" },
  { value: "video", label: "Video" },
  { value: "services", label: "Services" },
  { value: "faq", label: "FAQ" },
  { value: "registration", label: "Registration" },
  { value: "custom_url", label: "Custom URL" },
] as const;

export default function AdminQRCodesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [qrCodes, setQrCodes] = useState<Tables<"qr_code">[]>([]);
  const [videos, setVideos] = useState<Tables<"video">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetType, setTargetType] = useState("home");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const [qrResult, videoResult] = await Promise.all([
      supabase
        .from("qr_code")
        .select("*")
        .eq("property_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("video")
        .select("*")
        .eq("property_id", id)
        .order("sort_order"),
    ]);
    if (qrResult.data) setQrCodes(qrResult.data);
    if (videoResult.data) setVideos(videoResult.data);
  }

  function generateCode(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      property_id: id,
      code: generateCode(),
      label: formData.get("label") as string,
      target_type: targetType as Tables<"qr_code">["target_type"],
      target_id: targetType === "video" ? (formData.get("target_id") as string) || null : null,
      custom_url: targetType === "custom_url" ? (formData.get("custom_url") as string) || null : null,
    };

    await supabase.from("qr_code").insert(payload);

    setLoading(false);
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete(qrId: string) {
    if (!confirm("Delete this QR code?")) return;
    await supabase.from("qr_code").delete().eq("id", qrId);
    loadData();
  }

  async function handleDownload(code: string, label: string) {
    const response = await fetch(`/api/qr/generate?code=${code}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${label.toLowerCase().replace(/\s+/g, "-")}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">QR Codes</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-2" />
              Create QR Code
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New QR Code</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  name="label"
                  placeholder="Hot Tub Instructions"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  For your reference — not shown to guests
                </p>
              </div>
              <div className="space-y-2">
                <Label>Target</Label>
                <Select value={targetType} onValueChange={(v) => v && setTargetType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {targetTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {targetType === "video" && (
                <div className="space-y-2">
                  <Label>Select Video</Label>
                  <Select name="target_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a video" />
                    </SelectTrigger>
                    <SelectContent>
                      {videos.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {targetType === "custom_url" && (
                <div className="space-y-2">
                  <Label htmlFor="custom_url">URL</Label>
                  <Input
                    id="custom_url"
                    name="custom_url"
                    type="url"
                    placeholder="https://example.com"
                    required
                  />
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creating..." : "Create QR Code"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {qrCodes.length > 0 ? (
        <div className="grid gap-3">
          {qrCodes.map((qr) => (
            <Card key={qr.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{qr.label}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{qr.target_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        /q/{qr.code}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {qr.scan_count} scans
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(qr.code, qr.label)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(qr.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <QrCode className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No QR codes yet. Create QR codes to place around your property.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
