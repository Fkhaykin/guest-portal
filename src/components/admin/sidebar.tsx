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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: Home },
  { label: "Reservations", href: "/admin/reservations", icon: ClipboardList },
  { label: "Deliveries", href: "/admin/deliveries", icon: Truck },
  { label: "Messages", href: "/admin/messages", icon: MessageSquare },
  { label: "Campaigns", href: "/admin/campaigns", icon: Megaphone },
  { label: "Potential Claims", href: "/admin/aircover-claims", icon: ShieldAlert },
  { label: "Invoices", href: "/admin/invoices", icon: Receipt },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

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
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r flex flex-col transition-transform md:relative md:translate-x-0",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b">
          <Image
            src="/logo.png"
            alt="Summit Lakeside"
            width={120}
            height={60}
            className="h-8 w-auto invert dark:invert-0 mb-1"
          />
          <p className="text-xs text-muted-foreground">Admin Portal</p>
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

        <div className="p-3 border-t space-y-3">
          <div className="flex items-center justify-between px-3">
            <div className="min-w-0">
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
            className="w-full justify-start gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
