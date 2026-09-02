import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PWARegister } from "@/components/pwa-register";
import { LiveChatGate } from "@/components/guest/live-chat-gate";
import { IdleReturnGate } from "@/components/kiosk/idle-return";
import { SITE_URL, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { AnalyticsGate } from "@/components/analytics-gate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

// Display serif for guest hero moments only (--font-display / .font-display).
// Optical sizing keeps the large settings from looking spindly; SOFT rounds
// the terminals just enough to read warm rather than editorial-severe.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#050b12" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Poconos Lakefront Vacation Rentals | Summit Lakeside",
    template: "%s | Summit Lakeside Rentals",
  },
  description: "Lakefront vacation homes in the Poconos with hot tubs, game rooms, boats, and direct lake access. Book direct and save.",
  openGraph: {
    siteName: "Summit Lakeside Rentals",
    type: "website",
    locale: "en_US",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1920, height: 1280 }],
  },
  twitter: {
    card: "summary_large_image",
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  // Emitted as <link rel="manifest" href="/manifest.json"> (middleware swaps in
  // the subdomain-specific file). Driving it through metadata — rather than a
  // hard-coded <link> — lets deeper segments (the kiosk route) override it with
  // their own per-device manifest.
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Summit Lakeside" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Kiosk tabs: apply kiosk-mode + theme before first paint so portal
            hand-off pages (register/update/add-ons) don't flash the website
            header/light theme before KioskChromeGate's effect runs. Sync
            next-themes' own key so it agrees and doesn't flip it back. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('kiosk-return-url')){var e=document.documentElement,d=localStorage.getItem('kiosk-theme')!=='light';e.classList.add('kiosk-mode');localStorage.setItem('theme',d?'dark':'light');if(d){e.classList.add('dark')}else{e.classList.remove('dark')}}}catch(_){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <PWARegister />
          <Toaster />
          <LiveChatGate />
          <IdleReturnGate />
        </ThemeProvider>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Summit Lakeside Rentals",
            url: SITE_URL,
            logo: `${SITE_URL}/logo.png`,
            contactPoint: {
              "@type": "ContactPoint",
              telephone: "+1-732-213-8571",
              email: "contact@summitlakeside.com",
              contactType: "customer service",
            },
            sameAs: ["https://instagram.com/summitlakeside"],
          }}
        />
        <AnalyticsGate />
      </body>
    </html>
  );
}
