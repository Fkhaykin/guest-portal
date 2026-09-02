"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ClipboardList,
  Calendar,
  Receipt,
  LogOut,
  SprayCan,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { label: "Dashboard", href: "/cleaner", icon: BarChart3 },
  { label: "Tasks", href: "/cleaner/tasks", icon: ClipboardList },
  { label: "Reservations", href: "/cleaner/calendar", icon: Calendar },
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

  // On the manager subdomain paths arrive without the /cleaner prefix;
  // normalize so active-state matching works in both cases.
  const currentPath = pathname.startsWith("/cleaner")
    ? pathname
    : `/cleaner${pathname === "/" ? "" : pathname}`;

  async function handleLogout() {
    await fetch("/api/cleaner/logout", { method: "POST" });
    router.push("/cleaner/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r bg-sidebar md:flex">
        <div className="p-4 border-b space-y-3">
          <Logo size="sm" />
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
                ? currentPath === "/cleaner"
                : currentPath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-out-soft",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-xs ring-1 ring-foreground/[0.05]"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t space-y-1">
          <div className="flex items-center justify-between px-3">
            <p className="text-xs text-muted-foreground truncate">{cleanerName}</p>
            <ThemeToggle />
          </div>
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
      <header className="fixed top-0 left-0 right-0 z-40 border-b bg-background/90 backdrop-blur-lg md:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="h-6" />
            <div className="h-5 w-px bg-border" />
            <div>
              <p className="font-semibold text-sm">{cleanerName}</p>
              <p className="text-[10px] text-muted-foreground">
                {completedTasks}/{totalTasks} tasks done
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Cleaner portal"
        className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive =
              item.href === "/cleaner"
                ? currentPath === "/cleaner"
                : currentPath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 px-4 py-2.5 text-xs transition-colors duration-200 active:scale-95",
                  isActive ? "font-medium text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
