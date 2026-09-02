import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";

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
    .single();

  if (!property) notFound();

  const { data: videos } = await supabase
    .from("video")
    .select("*")
    .eq("property_id", property.id)
    .order("sort_order");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your stay"
        title="Videos"
        titleClassName="font-display text-display"
        description="How-to guides and helpful videos for your stay."
      />

      {videos && videos.length > 0 ? (
        <div className="grid gap-4 stagger-children">
          {videos.map((video) => (
            <Link
              key={video.id}
              href={`/p/${slug}/videos/${video.id}`}
              className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
            >
              <Card className="cursor-pointer transition-[transform,box-shadow] duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-raised active:translate-y-0 active:shadow-card">
                <CardHeader className="flex flex-row items-center gap-4">
                  <IconTile icon={Play} size="lg" accent="lake" />
                  <div className="min-w-0">
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
        <EmptyState
          icon={Play}
          title="No videos yet"
          description="How-to guides for the house will show up here once they're added."
        />
      )}
    </div>
  );
}
