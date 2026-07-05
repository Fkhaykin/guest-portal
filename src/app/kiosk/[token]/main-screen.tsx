"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  Gift,
  HelpCircle,
  MapPin,
  PenLine,
  ScrollText,
  ShoppingBag,
  Tag,
  Truck,
  Video,
} from "lucide-react";
import { QUICK_RULES } from "@/lib/house-rules";
import type { KioskData } from "./kiosk-client";

function formatShortDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${minutes} ${ampm}`;
}

function getNightCount(checkIn: string, checkOut: string) {
  const d1 = new Date(checkIn + "T00:00:00");
  const d2 = new Date(checkOut + "T00:00:00");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function timeOfDayGreeting(tz: string): string {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date()),
    10
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function MainScreen({
  data,
  onHandoff,
}: {
  data: KioskData;
  onHandoff: (href: string) => void;
}) {
  const [clock, setClock] = useState("");
  const tz = data.property.timezone;

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [tz]);

  const booking = data.booking;
  const res = booking?.reservation;
  const slug = res?.property.slug ?? data.property.slug;

  const checkInTime = res?.lodgify?.check_in_time ? formatTime(res.lodgify.check_in_time) : "4:00 PM";
  const checkOutTime = res?.lodgify?.check_out_time ? formatTime(res.lodgify.check_out_time) : "11:00 AM";
  const nights = res ? getNightCount(res.check_in_date, res.check_out_date) : 0;
  const nightsLeft = res ? getNightCount(data.today, res.check_out_date) : 0;

  let headline: string;
  let subline: string;
  switch (data.state) {
    case "arrival_day":
      headline = `Welcome, ${booking!.first_name}!`;
      subline = `Check-in opens at ${checkInTime} · ${nights} night${nights === 1 ? "" : "s"} · check-out ${formatShortDate(res!.check_out_date)}`;
      break;
    case "mid_stay":
      headline = `${timeOfDayGreeting(tz)}, ${booking!.first_name}`;
      subline = `${nightsLeft} night${nightsLeft === 1 ? "" : "s"} to go — check-out is ${formatShortDate(res!.check_out_date)} at ${checkOutTime}`;
      break;
    case "checkout_day":
      headline = `Safe travels, ${booking!.first_name}`;
      subline = `Check-out is today by ${checkOutTime}. Thanks for staying with us!`;
      break;
    default:
      headline = `Welcome to ${data.property.name}`;
      subline = "Explore the guest portal below.";
  }

  const registrationLink = booking
    ? res!.signature_url
      ? { label: "Update Registration", description: "Edit guests, pets, or vehicles", href: `/p/${slug}/update`, icon: PenLine, featured: true }
      : { label: "Register", description: "Register your guests and vehicles", href: `/p/${slug}/register`, icon: ClipboardList, featured: true }
    : null;

  const links = [
    ...(registrationLink ? [registrationLink] : []),
    { label: "Add-Ons", description: "Extras and experiences for your stay", href: `/p/${slug}/add-ons`, icon: Gift, featured: false },
    { label: "Delivery / Rideshare", description: "Register deliveries and rides", href: `/p/${slug}/delivery`, icon: Truck, featured: false },
    { label: "Services", description: "Browse additional services", href: `/p/${slug}/services`, icon: ShoppingBag, featured: false },
    { label: "Promotions", description: "See current deals", href: `/p/${slug}/promotions`, icon: Tag, featured: false },
    { label: "Explore", description: "Things to do in the Poconos", href: "/things-to-do", icon: MapPin, featured: false },
    { label: "FAQ", description: "Frequently asked questions", href: `/p/${slug}/faq`, icon: HelpCircle, featured: false },
    { label: "Videos", description: "How-to guides & welcome", href: `/p/${slug}/videos`, icon: Video, featured: false },
    { label: "House Rules", description: "The full rental policies", href: "/rental-policies", icon: ScrollText, featured: false },
  ];

  const todayWeather = data.weather?.find((w) => w.date === data.today) ?? data.weather?.[0];

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Backdrop */}
      {data.photos[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.photos[0]}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-md brightness-[0.28]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/60 via-transparent to-zinc-950/80" />

      <div className="relative flex h-full flex-col gap-6 overflow-y-auto p-6 lg:gap-8 lg:p-10">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60 lg:text-sm">
            {data.property.name}
          </span>
          <div className="flex items-center gap-4">
            {todayWeather && (
              <span className="flex items-center gap-2 text-sm font-medium text-white/70 lg:text-base">
                <span>{todayWeather.emoji}</span>
                {todayWeather.tempMaxF != null && <span>{Math.round(todayWeather.tempMaxF)}° today</span>}
              </span>
            )}
            <span className="text-sm font-semibold text-white/80 tabular-nums lg:text-base">{clock}</span>
          </div>
        </div>

        {/* Greeting */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white lg:text-6xl text-balance">{headline}</h1>
          <p className="mt-2 text-lg font-medium text-white/70 lg:mt-3 lg:text-2xl">{subline}</p>
        </div>

        {/* Portal shortcuts */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {links.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onHandoff(item.href)}
              className={`group flex min-h-24 items-center gap-4 rounded-2xl p-4 text-left backdrop-blur-md transition-all active:scale-[0.98] lg:min-h-28 lg:p-5 ${
                item.featured
                  ? "bg-white text-zinc-900 shadow-xl"
                  : "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl lg:h-14 lg:w-14 ${
                  item.featured ? "bg-zinc-900/10" : "bg-white/10"
                }`}
              >
                <item.icon className="h-6 w-6 lg:h-7 lg:w-7" />
              </span>
              <span>
                <span className="block text-base font-bold lg:text-lg">{item.label}</span>
                <span className={`mt-0.5 block text-xs lg:text-sm ${item.featured ? "text-zinc-600" : "text-white/60"}`}>
                  {item.description}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* House rules strip */}
        <div className="mt-auto">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/50 lg:text-sm">
            House rules — the short version
          </p>
          <div className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-2 lg:-mx-10 lg:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK_RULES.map((r) => (
              <button
                key={r.section}
                type="button"
                onClick={() => onHandoff(`/rental-policies${r.href}`)}
                className="flex w-64 shrink-0 snap-start items-start gap-3 rounded-xl bg-white/[0.07] p-4 text-left ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-white/[0.12] lg:w-72"
              >
                <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
                <span>
                  <span className="block text-sm font-semibold text-white">{r.rule}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/55">{r.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
