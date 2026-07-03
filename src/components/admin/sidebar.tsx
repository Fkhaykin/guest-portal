"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  ClipboardList,
  MessageSquare,
  Settings,
  Receipt,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Truck,
  Megaphone,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: Home },
  { label: "Reservations", href: "/admin/reservations", icon: ClipboardList },
  { label: "Deliveries", href: "/admin/deliveries", icon: Truck },
  { label: "Messages", href: "/admin/messages", icon: MessageSquare },
  { label: "Campaigns", href: "/admin/campaigns", icon: Megaphone },
  { label: "Pricing Lab", href: "/admin/pricing", icon: LineChart },
  { label: "Potential Claims", href: "/admin/aircover-claims", icon: ShieldAlert },
  { label: "Invoices", href: "/admin/invoices", icon: Receipt },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const COLLAPSED_KEY = "admin-sidebar-collapsed";

export function AdminSidebar({
  hostName,
  hostEmail,
}: {
  hostName: string;
  hostEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Desktop-only icon-rail state; md: prefixes below keep mobile unaffected.
  // Read from localStorage after mount so SSR markup stays deterministic.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  // On the admin subdomain paths arrive without the /admin prefix; normalize
  // so active-state matching works in both cases.
  const currentPath = pathname.startsWith("/admin")
    ? pathname
    : `/admin${pathname === "/" ? "" : pathname}`;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <>
      {/* Mobile toggle — sits in line with the page H1; top-3 put it under the
          iOS status bar in standalone PWA mode where taps don't register */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-16 right-4 z-50 md:hidden border bg-background/80 backdrop-blur"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          // Safe-area padding keeps the header below the iOS status bar and the
          // footer above the home indicator in standalone PWA mode
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r flex flex-col transition-[transform,width] duration-300 ease-in-out md:relative md:translate-x-0",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          collapsed ? "md:w-16" : "md:w-64",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div
          className={cn(
            "p-4 border-b flex items-start justify-between gap-2",
            collapsed && "md:justify-center md:p-2 md:items-center"
          )}
        >
          <div className={cn("min-w-0", collapsed && "md:hidden")}>
            <Image
              src="/logo.png"
              alt="Summit Lakeside"
              width={180}
              height={90}
              className="h-12 w-auto invert dark:invert-0"
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex shrink-0 text-muted-foreground"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            // Dashboard (/admin) is a prefix of every route — exact match only
            const isActive =
              item.href === "/admin"
                ? currentPath === "/admin"
                : currentPath === item.href || currentPath.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 active:scale-[0.98]",
                  collapsed && "md:justify-center md:px-2",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={cn("p-3 border-t space-y-3", collapsed && "md:p-2 md:space-y-2")}>
          <div
            className={cn(
              "flex items-center justify-between px-3",
              collapsed && "md:justify-center md:px-0"
            )}
          >
            <div className={cn("min-w-0", collapsed && "md:hidden")}>
              <p className="text-sm font-medium truncate">{hostName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {hostEmail}
              </p>
            </div>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start gap-2",
              collapsed && "md:justify-center md:px-0"
            )}
            onClick={handleSignOut}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "md:hidden")}>Sign out</span>
          </Button>
        </div>
      </aside>

      {/* Mobile overlay — always mounted so it can fade both in and out */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 md:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
    </>
  );
}
