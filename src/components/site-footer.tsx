import Image from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="space-y-3">
            <Image
              src="/logo.png"
              alt="Summit Lakeside Rentals"
              width={140}
              height={70}
              className="h-10 w-auto invert dark:invert-0"
            />
            <p className="text-sm text-muted-foreground">
              Premium lakefront vacation homes in the Pocono Mountains of
              Pennsylvania.
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Quick Links</h4>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/search" className="hover:text-foreground transition-colors">
                Book a Lakehouse
              </Link>
              <Link href="/things-to-do" className="hover:text-foreground transition-colors">
                Visit the Poconos
              </Link>
              <Link href="/why-summit" className="hover:text-foreground transition-colors">
                Why Summit?
              </Link>
              <Link href="/management-services" className="hover:text-foreground transition-colors">
                Management Services
              </Link>
              <Link href="/checkin" className="hover:text-foreground transition-colors">
                Find My Booking
              </Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">
                Contact Us
              </Link>
            </nav>
          </div>
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Contact</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>East Stroudsburg, PA</p>
              <p>Pocono Mountains, Pennsylvania</p>
              <p>
                <a
                  href="mailto:contact@summitlakeside.com"
                  className="hover:text-foreground transition-colors"
                >
                  contact@summitlakeside.com
                </a>
              </p>
              <p>
                <a
                  href="tel:+17322138571"
                  className="hover:text-foreground transition-colors"
                >
                  (732) 213-8571
                </a>
              </p>
            </div>
          </div>
        </div>
        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} Summit Lakeside Rentals. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
