import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function VideoPlayerPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("video")
    .select("*")
    .eq("id", id)
    .single();

  if (!video) notFound();

  // Get signed URL for the video
  const { data: signedUrl } = await supabase.storage
    .from("videos")
    .createSignedUrl(video.storage_path, 3600); // 1 hour expiry

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{video.title}</h2>
        {video.description && (
          <p className="text-muted-foreground mt-1">{video.description}</p>
        )}
      </div>

      {signedUrl?.signedUrl ? (
        <div className="rounded-lg overflow-hidden bg-black">
          <video
            controls
            autoPlay
            playsInline
            className="w-full max-h-[70vh]"
            src={signedUrl.signedUrl}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      ) : (
        <p className="text-muted-foreground">
          Video is temporarily unavailable. Please try again later.
        </p>
      )}
    </div>
  );
}
