"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Visit Poconos", href: "/things-to-do" },
  { label: "About Us", href: "/why-summit" },
  { label: "Contact Us", href: "/contact" },
];

const RESOURCES_LINKS = [
  { label: "Rental Policies", href: "/rental-policies" },
  { label: "Management Service", href: "/management-services" },
];

/**
 * variant="transparent" — starts transparent over dark hero, goes solid on scroll (home page)
 * variant="solid" — always has solid dark background (other public pages)
 */
export function SiteNav({ variant = "solid" }: { variant?: "transparent" | "solid" }) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const resourcesTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleScroll() {
      const y = Math.max(0, window.scrollY);
      setScrolled(y > 40);
      // Hide on scroll down, reveal on scroll up. The 8px delta filters out
      // trackpad/rubber-band jitter; near the top the nav is always shown.
      if (y < 80) {
        setHidden(false);
      } else if (y > lastScrollY.current + 8) {
        setHidden(true);
      } else if (y < lastScrollY.current - 8) {
        setHidden(false);
      }
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Mirror the hidden state onto <html> so sticky sub-bars (pinned at
  // --site-nav-offset) ride up to the viewport edge in sync with the nav.
  useEffect(() => {
    document.documentElement.toggleAttribute(
      "data-site-nav-hidden",
      hidden && !mobileOpen
    );
    return () => document.documentElement.removeAttribute("data-site-nav-hidden");
  }, [hidden, mobileOpen]);

  const isOpaque = variant === "solid" || scrolled || mobileOpen;

  // Over the transparent hero the nav sits on a dark photo, so text stays
  // white; once the floating card appears it follows the theme tokens.
  const linkCls = isOpaque
    ? "text-foreground/80 hover:text-foreground hover:bg-foreground/10"
    : "text-white/80 hover:text-white hover:bg-white/10";

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 px-3 pt-3 sm:px-6 transition-transform duration-300 ease-in-out ${
          hidden && !mobileOpen ? "-translate-y-[110%]" : "translate-y-0"
        }`}
      >
        <div
          className={`max-w-7xl mx-auto px-4 sm:px-5 rounded-2xl transition-all duration-300 ${
            isOpaque
              ? "border bg-card/85 supports-backdrop-filter:bg-card/75 backdrop-blur-xl shadow-lg shadow-black/5 dark:border-white/10 dark:shadow-black/30"
              : "border border-transparent bg-transparent"
          }`}
        >
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="shrink-0">
              <Image
                src="/logo.png"
                alt="Summit Lakeside Rentals"
                width={140}
                height={70}
                className={`h-9 w-auto transition-[filter] duration-300 ${
                  isOpaque ? "invert dark:invert-0" : ""
                }`}
                priority
              />
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${linkCls}`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Resources dropdown */}
              <div
                className="relative"
                onMouseEnter={() => {
                  if (resourcesTimeout.current) clearTimeout(resourcesTimeout.current);
                  setResourcesOpen(true);
                }}
                onMouseLeave={() => {
                  resourcesTimeout.current = setTimeout(() => setResourcesOpen(false), 150);
                }}
              >
                <button
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg flex items-center gap-1 ${linkCls}`}
                  onClick={() => setResourcesOpen(!resourcesOpen)}
                >
                  Resources
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${resourcesOpen ? "rotate-180" : ""}`} />
                </button>
                {resourcesOpen && (
                  <div
                    className={`absolute top-full left-0 mt-2 w-52 rounded-xl backdrop-blur-xl border shadow-xl overflow-hidden py-1 ${
                      isOpaque
                        ? "bg-card/90 dark:border-white/15 dark:shadow-black/30"
                        : "bg-black/80 border-white/15"
                    }`}
                  >
                    {RESOURCES_LINKS.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          isOpaque
                            ? "text-foreground/80 hover:text-foreground hover:bg-foreground/10"
                            : "text-white/80 hover:text-white hover:bg-white/10"
                        }`}
                        onClick={() => setResourcesOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <ThemeToggle className={`inline-flex items-center justify-center rounded-md p-2 transition-colors focus:outline-none ${linkCls}`} />

              {/* CTA */}
              <Link
                href="/search"
                className={`ml-3 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  isOpaque
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-white text-black hover:bg-white/90"
                }`}
              >
                Book Now
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className={`md:hidden p-2 transition-colors ${
                isOpaque
                  ? "text-foreground/80 hover:text-foreground"
                  : "text-white/80 hover:text-white"
              }`}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Full-screen mobile menu */}
      <MobileMenuOverlay open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Menu Overlay                                                */
/* ------------------------------------------------------------------ */

function MobileMenuOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-[45] md:hidden transition-all duration-300 ${
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={onClose} />

      {/* Content */}
      <div
        className={`relative flex flex-col justify-between h-full pt-20 pb-8 px-6 transition-transform duration-300 ${
          open ? "translate-y-0" : "-translate-y-4"
        }`}
      >
        {/* Nav links */}
        <div className="space-y-1">
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.label}
              href={link.href}
              className="block px-2 py-3.5 text-2xl font-semibold text-white/90 hover:text-white transition-colors border-b border-white/10"
              onClick={onClose}
              style={{
                transitionDelay: open ? `${i * 50}ms` : "0ms",
              }}
            >
              {link.label}
            </Link>
          ))}

          <div className="pt-4 pb-1 px-2 text-xs font-semibold text-white/30 uppercase tracking-widest">
            Resources
          </div>
          {RESOURCES_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="block px-2 py-2.5 text-base text-white/60 hover:text-white transition-colors"
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="space-y-4">
          <div className="flex items-center justify-start px-2 py-2">
            <ThemeToggle className="-ml-2 inline-flex items-center justify-center rounded-md p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none" />
          </div>
          <Link
            href="/search"
            className="block w-full text-center px-5 py-4 text-base font-semibold bg-white text-black rounded-xl hover:bg-white/90 transition-colors"
            onClick={onClose}
          >
            Book Now
          </Link>
          <p className="text-center text-sm text-white/40">
            summitlakeside.com
          </p>
        </div>
      </div>
    </div>
  );
}
