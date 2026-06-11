"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <TriangleAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">
          An unexpected error occurred. Please try again — if the problem
          persists, contact us and we&apos;ll get it sorted.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <Button variant="outline" render={<Link href="/" />}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
