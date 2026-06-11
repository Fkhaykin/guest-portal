import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Compass className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-muted-foreground">
          We couldn&apos;t find what you were looking for. It may have moved,
          or the link might be out of date.
        </p>
        <div className="pt-2">
          <Button render={<Link href="/" />}>Back to home</Button>
        </div>
      </div>
    </div>
  );
}
