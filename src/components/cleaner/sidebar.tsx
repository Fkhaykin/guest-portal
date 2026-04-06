"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Calendar,
  Receipt,
  LogOut,
  SprayCan,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Tasks", href: "/cleaner", icon: ClipboardList },
  { label: "Calendar", href: "/cleaner/calendar", icon: Calendar },
  { label: "Invoices", href: "/cleaner/invoices", icon: Receipt },
];

export function CleanerSidebar({
  cleanerName,
  totalTasks,
  completedTasks,
}: {
  cleanerName: string;
  totalTasks: number;
  completedTasks: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/cleaner/logout", { method: "POST" });
    router.push("/cleaner/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-56 bg-card border-r flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-1.5">
              <SprayCan className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{cleanerName}</p>
              <p className="text-[10px] text-muted-foreground">
                {completedTasks}/{totalTasks} tasks done
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/cleaner"
                ? pathname === "/cleaner"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 border-b bg-card">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-1.5">
              <SprayCan className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{cleanerName}</p>
              <p className="text-[10px] text-muted-foreground">
                {completedTasks}/{totalTasks} tasks done
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive =
              item.href === "/cleaner"
                ? pathname === "/cleaner"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition-colors",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
