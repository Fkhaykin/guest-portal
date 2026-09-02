"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { prefetchAdminRoute } from "@/lib/admin/nav";
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
  Images,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Ten flat items read as a list to scan rather than a place to navigate.
// Grouped by what the host is actually doing: the guest\'s stay, or the money.
// Settings lives in the footer with the account block, not in the run.
const navGroups: { label: string | null; items: { label: string; href: string; icon: typeof Home }[] }[] = [
  {
    label: null,
    items: [{ label: "Dashboard", href: "/admin", icon: Home }],
  },
  {
    label: "Stays",
    items: [
      { label: "Reservations", href: "/admin/reservations", icon: ClipboardList },
      { label: "Messages", href: "/admin/messages", icon: MessageSquare },
      { label: "Deliveries", href: "/admin/deliveries", icon: Truck },
      { label: "Guest Photos", href: "/admin/guest-photos", icon: Images },
    ],
  },
  {
    label: "Revenue",
    items: [
      { label: "Pricing Lab", href: "/admin/pricing", icon: LineChart },
      { label: "Campaigns", href: "/admin/campaigns", icon: Megaphone },
      { label: "Invoices", href: "/admin/invoices", icon: Receipt },
      { label: "Potential Claims", href: "/admin/aircover-claims", icon: ShieldAlert },
    ],
  },
];

const settingsItem = { label: "Settings", href: "/admin/settings", icon: Settings };

/** Initials for the account block avatar ("Summit Lakeside" -> "SL"). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

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
            <Logo size="lg" />
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

        <nav className="flex-1 overflow-y-auto p-3">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? "root"} className={cn(gi > 0 && "mt-5")}>
              {group.label && (
                <>
                  {/* Collapsed to the icon rail there is no room for a word,
                      so the group reads as a divider instead. */}
                  <p
                    className={cn(
                      "px-3 pb-1.5 text-eyebrow text-muted-foreground",
                      collapsed && "md:hidden"
                    )}
                  >
                    {group.label}
                  </p>
                  <div
                    className={cn("mx-2 mb-2 hidden h-px bg-border", collapsed && "md:block")}
                    aria-hidden="true"
                  />
                </>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    currentPath={currentPath}
                    collapsed={collapsed}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn("border-t p-3 space-y-2", collapsed && "md:p-2")}>
          <NavLink
            item={settingsItem}
            currentPath={currentPath}
            collapsed={collapsed}
            onNavigate={() => setOpen(false)}
          />
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-1.5",
              collapsed && "md:justify-center md:px-0"
            )}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-semibold text-sidebar-accent-foreground",
                collapsed && "md:hidden"
              )}
              aria-hidden="true"
            >
              {initialsOf(hostName)}
            </div>
            <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
              <p className="truncate text-[13px] font-medium">{hostName}</p>
              <p className="truncate text-xs text-muted-foreground">{hostEmail}</p>
            </div>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start gap-2 text-muted-foreground",
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

/**
 * One sidebar row. The active state is a lake-tinted pill with a hairline and
 * a primary icon — enough to find at a glance without shouting, and it still
 * reads when the rail is collapsed to icons.
 */
function NavLink({
  item,
  currentPath,
  collapsed,
  onNavigate,
}: {
  item: { label: string; href: string; icon: typeof Home };
  currentPath: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  // Dashboard (/admin) is a prefix of every route — exact match only
  const isActive =
    item.href === "/admin"
      ? currentPath === "/admin"
      : currentPath === item.href || currentPath.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      // Warm the destination's DATA on hover/focus (Next already prefetches
      // the bundle) so the click lands on a ready page.
      onMouseEnter={() => prefetchAdminRoute(item.href)}
      onFocus={() => prefetchAdminRoute(item.href)}
      onTouchStart={() => prefetchAdminRoute(item.href)}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-out-soft active:scale-[0.98]",
        collapsed && "md:justify-center md:px-2",
        isActive
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-xs ring-1 ring-foreground/[0.05]"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      )}
    >
      <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
      <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
    </Link>
  );
}
