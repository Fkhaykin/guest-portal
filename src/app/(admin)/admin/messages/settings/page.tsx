import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ReplyTraining } from "@/components/admin/reply-training";
import { GuestMessageSettings } from "@/components/admin/guest-message-settings";
import { LodgifyMessageSync } from "@/components/admin/lodgify-message-sync";
import { AiEffectiveness } from "@/components/admin/ai-effectiveness";
import { PageHeader } from "@/components/ui/page-header";

export default function AutoMessagesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/messages"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader eyebrow="Messages" title="Auto messages" />
      </div>
      <AiEffectiveness />
      <LodgifyMessageSync />
      <ReplyTraining />
      <GuestMessageSettings />
    </div>
  );
}
