import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Play } from "lucide-react";

export default async function VideosListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property) notFound();

  const { data: videos } = await supabase
    .from("video")
    .select("*")
    .eq("property_id", property.id)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Videos</h2>
        <p className="text-muted-foreground">
          How-to guides and helpful videos for your stay
        </p>
      </div>

      {videos && videos.length > 0 ? (
        <div className="grid gap-4">
          {videos.map((video) => (
            <Link key={video.id} href={`/p/${slug}/videos/${video.id}`}>
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                    <Play className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{video.title}</CardTitle>
                    {video.description && (
                      <CardDescription>{video.description}</CardDescription>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No videos available yet.</p>
      )}
    </div>
  );
}
