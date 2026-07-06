import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PWARegister } from "@/components/pwa-register";
import { LiveChatGate } from "@/components/guest/live-chat-gate";
import { IdleReturnGate } from "@/components/kiosk/idle-return";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#15171c" },
  ],
};

export const metadata: Metadata = {
  title: "Summit Lakeside Rentals — Poconos Lakehouse Vacations",
  description: "Lakefront vacation homes in the Poconos with hot tubs, game rooms, boats, and direct lake access. Book direct and save.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
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
      </body>
    </html>
  );
}
