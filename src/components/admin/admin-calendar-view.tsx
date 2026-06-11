"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Moon,
  ArrowRight,
  FileText,
  User,
  Users,
  Baby,
  PawPrint,
  CalendarPlus,
} from "lucide-react";

export type AdminCalendarEntry = {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyNickname: string | null;
  propertyCoverImage: string | null;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  lodgifyAdults: number;
  lodgifyChildren: number;
  lodgifyInfants: number;
  lodgifyPets: number;
  guestName: string | null;
  guestEmail: string | null;
  displayStatus: "past" | "current" | "future" | "cancelled";
  totalAmountCents: number;
  hasRegistration: boolean;
  bookingSource: string | null;
  nights: number;
  bookedAt: string | null;
};

export type AdminPropertyGroup = {
  key: string;
  label: string;
  coverImage: string | null;
};

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const VISIBLE_DAYS = 14;

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function formatDateLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}
function cleanSource(s: string | null) {
  if (!s) return null;
  return s.replace(/\s*integration\s*/i, "").replace(/\s*api\s*/i, "").trim();
}

const STATUS_BAR: Record<AdminCalendarEntry["displayStatus"], string> = {
  future: "bg-teal-700 text-white",
  current: "bg-blue-600 text-white",
  past: "bg-teal-700 text-white opacity-40",
  cancelled: "bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

const STATUS_BADGE: Record<AdminCalendarEntry["displayStatus"], string> = {
  future: "bg-green-100 text-green-800 border-green-200",
  current: "bg-blue-100 text-blue-800 border-blue-200",
  past: "bg-yellow-100 text-yellow-800 border-yellow-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export function AdminCalendarView({
  entries,
  propertyGroups,
}: {
  entries: AdminCalendarEntry[];
  propertyGroups: AdminPropertyGroup[];
}) {
  const router = useRouter();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const [startDate, setStartDate] = useState(startOfWeek);
  const [selected, setSelected] = useState<AdminCalendarEntry | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const todayStr = toDateStr(today);

  const days: { date: Date; str: string }[] = [];
  for (let i = 0; i < VISIBLE_DAYS; i++) {
    const d = addDays(startDate, i);
    days.push({ date: d, str: toDateStr(d) });
  }

  const rangeStart = days[0].str;
  const rangeEnd = days[days.length - 1].str;

  const headerStart = days[0].date;
  const headerEnd = days[days.length - 1].date;
  const sameMonth = headerStart.getMonth() === headerEnd.getMonth();
  const headerLabel = sameMonth
    ? `${MONTH_NAMES_SHORT[headerStart.getMonth()]} ${headerStart.getDate()} – ${headerEnd.getDate()}, ${headerEnd.getFullYear()}`
    : `${MONTH_NAMES_SHORT[headerStart.getMonth()]} ${headerStart.getDate()} – ${MONTH_NAMES_SHORT[headerEnd.getMonth()]} ${headerEnd.getDate()}, ${headerEnd.getFullYear()}`;

  // Seed all property groups so every house always appears
  const byGroup = new Map<string, { coverImage: string | null; label: string; entries: AdminCalendarEntry[] }>();
  for (const g of propertyGroups) {
    byGroup.set(g.key, { coverImage: g.coverImage, label: g.label, entries: [] });
  }
  for (const e of entries) {
    if (e.checkOut < rangeStart || e.checkIn > rangeEnd) continue;
    if (e.displayStatus === "cancelled") continue;
    const groupKey = (e.propertyNickname || e.propertyName).toLowerCase();
    if (!byGroup.has(groupKey)) {
      byGroup.set(groupKey, { coverImage: e.propertyCoverImage, label: e.propertyNickname || e.propertyName, entries: [] });
    }
    byGroup.get(groupKey)!.entries.push(e);
  }

  const properties = [...byGroup.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));

  function getBarPosition(e: AdminCalendarEntry) {
    let startIdx = 0;
    let isClampedStart = true;
    for (let i = 0; i < days.length; i++) {
      if (days[i].str >= e.checkIn) {
        startIdx = i;
        isClampedStart = days[i].str !== e.checkIn;
        break;
      }
    }
    let endIdx = days.length - 1;
    let isClampedEnd = true;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].str <= e.checkOut) {
        endIdx = i;
        isClampedEnd = days[i].str !== e.checkOut;
        break;
      }
    }
    return { startIdx, endIdx, isClampedStart, isClampedEnd };
  }

  const colPct = 100 / VISIBLE_DAYS;

  return (
    <>
      <Card className="p-4 overflow-x-auto [--label-w:200px] max-sm:[--label-w:60px]">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setStartDate(addDays(startDate, -VISIBLE_DAYS))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-sm">{headerLabel}</p>
            <button
              onClick={() => {
                const sw = new Date(today);
                sw.setDate(today.getDate() - today.getDay());
                setStartDate(sw);
              }}
              className="text-[10px] text-primary hover:underline"
            >
              Today
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setStartDate(addDays(startDate, VISIBLE_DAYS))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day headers — px-2 matches the p-2 on the rows container so columns align */}
        <div
          className="grid gap-0 border-b pb-2 mb-2 px-2"
          style={{ gridTemplateColumns: `var(--label-w) repeat(${VISIBLE_DAYS}, 1fr)` }}
        >
          <div />
          {days.map(({ date, str }) => {
            const isToday = str === todayStr;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <div
                key={str}
                className={`text-center leading-tight ${
                  isToday ? "font-bold text-primary" : isWeekend ? "text-muted-foreground/50" : "text-muted-foreground"
                }`}
              >
                <div className="text-[10px]">{DAY_NAMES_SHORT[date.getDay()]}</div>
                <div
                  className={`text-xs ${
                    isToday
                      ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto"
                      : ""
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Property rows */}
        <div className="space-y-1 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
          {properties.map(([groupKey, { coverImage, label, entries: propEntries }]) => {
            const ROW_H = 28;
            const totalH = ROW_H + 4;

            return (
              <div key={groupKey} className="flex items-start border-b border-muted/10 last:border-b-0 py-1">
                {/* Property label */}
                <div className="flex sm:flex-row flex-col items-center gap-1 sm:gap-2.5 pr-1 sm:pr-3 min-w-0 shrink-0 w-(--label-w)">
                  <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 border border-border/50">
                    {coverImage && !failedImages.has(coverImage) ? (
                      <img
                        src={coverImage}
                        alt={label}
                        className="w-full h-full object-cover"
                        onError={() => setFailedImages((prev) => new Set(prev).add(coverImage))}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Home className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] sm:text-xs font-medium truncate block max-w-full text-center sm:text-left">{label}</span>
                </div>

                {/* Timeline area */}
                <div className="flex-1 relative" style={{ height: totalH }}>
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${VISIBLE_DAYS}, 1fr)` }}>
                    {days.map(({ str }, i) => (
                      <div key={str} className={`border-l h-full border-border/15${i === days.length - 1 ? " border-r" : ""}`} />
                    ))}
                  </div>

                  {/* Bars */}
                  {propEntries.map((e) => {
                    const { startIdx, endIdx, isClampedStart, isClampedEnd } = getBarPosition(e);
                    // Half-day overlap: bar starts mid-box on check-in day, ends mid-box on check-out day
                    const leftPct = startIdx * colPct + (isClampedStart ? 0 : colPct * 0.5);
                    const rightPct = (VISIBLE_DAYS - 1 - endIdx) * colPct + (isClampedEnd ? 0 : colPct * 0.5);
                    const widthPct = 100 - leftPct - rightPct;
                    if (widthPct <= 0) return null;

                    const barClass = STATUS_BAR[e.displayStatus];
                    const label2 = e.guestName
                      ? `${e.guestName.split(" ")[0]} · ${e.numGuests}g${e.totalAmountCents ? ` · $${Math.round(e.totalAmountCents / 100).toLocaleString()}` : ""}`
                      : "Blocked";

                    return (
                      <button
                        key={e.id}
                        onClick={() => setSelected(e)}
                        className={`absolute h-6 rounded-full text-[10px] font-semibold flex items-center px-2.5 truncate cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all z-10 shadow-sm ${barClass}`}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: 2, minWidth: "24px" }}
                      >
                        <span className="truncate">{label2}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Detail popup */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {selected && (() => {
            const s = selected;
            const hasBreakdown = s.lodgifyAdults > 0 || s.lodgifyChildren > 0 || s.lodgifyInfants > 0;

            return (
              <>
                {/* Cover image header */}
                {s.propertyCoverImage && !failedImages.has(s.propertyCoverImage) ? (
                  <div className="relative h-36 w-full">
                    <img
                      src={s.propertyCoverImage}
                      alt={s.propertyName}
                      className="w-full h-full object-cover"
                      onError={() => setFailedImages((prev) => new Set(prev).add(s.propertyCoverImage!))}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h2 className="text-white font-bold text-lg leading-tight">{s.propertyNickname || s.propertyName}</h2>
                      <p className="text-white/80 text-sm mt-0.5">{s.guestName || "—"}</p>
                    </div>
                  </div>
                ) : (
                  <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle className="text-lg">{s.propertyNickname || s.propertyName}</DialogTitle>
                    <p className="text-sm text-muted-foreground">{s.guestName || "—"}</p>
                  </DialogHeader>
                )}

                <div className="p-5 space-y-4">
                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Check-in</p>
                      <p className="text-sm font-semibold">{formatDateLong(s.checkIn)}</p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Check-out</p>
                      <p className="text-sm font-semibold">{formatDateLong(s.checkOut)}</p>
                    </div>
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Moon className="h-3 w-3" />
                      {s.nights} night{s.nights !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className={`text-xs capitalize ${STATUS_BADGE[s.displayStatus]}`}>
                      {s.displayStatus}
                    </Badge>
                    {s.hasRegistration ? (
                      <Badge variant="default" className="gap-1 text-xs bg-green-600">
                        <FileText className="h-3 w-3" />
                        Registered
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        Not registered
                      </Badge>
                    )}
                  </div>

                  <Separator />

                  {/* Guests */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Guests</p>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {hasBreakdown ? (
                        <>
                          {s.lodgifyAdults > 0 && (
                            <span className="flex items-center gap-1.5">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {s.lodgifyAdults} adult{s.lodgifyAdults !== 1 ? "s" : ""}
                            </span>
                          )}
                          {s.lodgifyChildren > 0 && (
                            <span className="flex items-center gap-1.5">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {s.lodgifyChildren} child{s.lodgifyChildren !== 1 ? "ren" : ""}
                            </span>
                          )}
                          {s.lodgifyInfants > 0 && (
                            <span className="flex items-center gap-1.5">
                              <Baby className="h-4 w-4 text-muted-foreground" />
                              {s.lodgifyInfants} infant{s.lodgifyInfants !== 1 ? "s" : ""}
                            </span>
                          )}
                          {s.lodgifyPets > 0 && (
                            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                              <PawPrint className="h-4 w-4" />
                              {s.lodgifyPets} pet{s.lodgifyPets !== 1 ? "s" : ""}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {s.numGuests} guest{s.numGuests !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Revenue + source */}
                  {(s.totalAmountCents > 0 || s.bookingSource) && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between text-sm">
                        {s.totalAmountCents > 0 && (
                          <span className="font-semibold">${Math.round(s.totalAmountCents / 100).toLocaleString()}</span>
                        )}
                        {s.bookingSource && (
                          <span className="text-muted-foreground capitalize text-xs">{cleanSource(s.bookingSource)}</span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Booked date */}
                  {s.bookedAt && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Booked {formatDateLong(s.bookedAt.split("T")[0])}
                    </div>
                  )}

                  {/* View details button */}
                  <Button
                    className="w-full gap-2 mt-2"
                    onClick={() => {
                      setSelected(null);
                      router.push(`/admin/reservations/${s.id}`);
                    }}
                  >
                    View Details
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
