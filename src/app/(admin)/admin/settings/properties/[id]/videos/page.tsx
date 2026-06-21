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
import { Plus, Trash2, Upload, Video } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/types/database";

export default function AdminVideosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [videos, setVideos] = useState<Tables<"video">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadVideos();
  }, [id]);

  async function loadVideos() {
    const { data } = await supabase
      .from("video")
      .select("*")
      .eq("property_id", id)
      .order("sort_order");
    if (data) setVideos(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || null;
    const file = formData.get("video") as File;

    if (!file || file.size === 0) {
      setLoading(false);
      return;
    }

    setUploadProgress("Uploading video...");

    // Upload to Supabase Storage
    const filePath = `${id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(filePath, file);

    if (uploadError) {
      setUploadProgress(`Error: ${uploadError.message}`);
      setLoading(false);
      return;
    }

    setUploadProgress("Saving...");

    await supabase.from("video").insert({
      property_id: id,
      title,
      description,
      storage_path: filePath,
    });

    setLoading(false);
    setDialogOpen(false);
    setUploadProgress(null);
    loadVideos();
  }

  async function handleDelete(video: Tables<"video">) {
    if (!confirm("Delete this video?")) return;
    await supabase.storage.from("videos").remove([video.storage_path]);
    await supabase.from("video").delete().eq("id", video.id);
    loadVideos();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Videos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Video
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Video</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="How to Use the Hot Tub"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Step-by-step guide to operating the hot tub"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video">Video File</Label>
                <Input
                  id="video"
                  name="video"
                  type="file"
                  accept="video/*"
                  required
                />
              </div>
              {uploadProgress && (
                <p className="text-sm text-muted-foreground">
                  {uploadProgress}
                </p>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                {loading ? "Uploading..." : "Upload"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {videos.length > 0 ? (
        <div className="grid gap-3">
          {videos.map((video) => (
            <Card key={video.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-base">{video.title}</CardTitle>
                  {video.description && (
                    <p className="text-sm text-muted-foreground">
                      {video.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(video)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Video}
          title="No videos uploaded yet."
          description="Upload instructional videos to walk guests through the property."
        />
      )}
    </div>
  );
}
