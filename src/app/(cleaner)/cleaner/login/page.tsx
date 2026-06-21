import Image from "next/image";
import { SprayCan } from "lucide-react";
import { LoginForm } from "@/components/cleaner/login-form";

export default function CleanerLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-4">
          <Image
            src="/logo.png"
            alt="Summit Lakeside"
            width={180}
            height={60}
            className="mx-auto"
            priority
          />
          <div className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <SprayCan className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Cleaner Portal</h1>
              <p className="text-sm text-muted-foreground">
                Enter your name and password to view your schedule
              </p>
            </div>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
