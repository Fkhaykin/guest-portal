"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Users,
  Clock,
  Home,
  Sparkles,
  CircleDot,
  SprayCan,
  Baby,
  PawPrint,
  User,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import type { UpsellEntry, GuestListEntry, PetEntry } from "@/types/database";
import { CleaningDialog } from "./cleaning-dialog";

const UPSELL_LABELS: Record<string, string> = {
  early_checkin: "Early Check-In (1 PM)",
  late_checkout: "Late Check-Out (2 PM)",
  new_sheets: "New Sheets & Pillowcases",
  firewood: "Firewood Delivery",
  private_chef: "Private Chef",
  baby_high_chair: "Baby High Chair",
  luxury_picnic: "Luxury Picnic",
  breakfast_delivery: "Breakfast Delivery",
};

const UPSELL_ICONS: Record<string, string> = {
  early_checkin: "🕐",
  late_checkout: "🕑",
  new_sheets: "🛏️",
  firewood: "🪵",
  private_chef: "👨‍🍳",
  baby_high_chair: "👶",
  luxury_picnic: "🧺",
  breakfast_delivery: "☕",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateProminent(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    dayOfWeek: SHORT_DAY_NAMES[d.getDay()],
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: d.getDate(),
  };
}

function getRelativeDayLabel(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 6) return DAY_NAMES[target.getDay()];
  if (diffDays === 7) return "Next " + DAY_NAMES[target.getDay()];
  if (diffDays < -1 && diffDays >= -6) return "Last " + DAY_NAMES[target.getDay()];
  return null; // No relative label for distant dates
}

function DateBlock({
  dateStr,
  label,
  time,
}: {
  dateStr: string;
  label: string;
  time?: string | null;
}) {
  const { dayOfWeek, month, day } = formatDateProminent(dateStr);
  return (
    <div className="text-center min-w-13">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      {time && (
        <p className="text-base font-bold text-primary leading-tight">{time}</p>
      )}
      <p className="text-lg font-bold leading-tight">{day}</p>
      <p className="text-xs text-muted-foreground">
        {dayOfWeek}, {month}
      </p>
    </div>
  );
}

export function ReservationCard({
  registrationId,
  propertyName,
  propertyNickname,
  propertyCoverImage,
  checkIn,
  checkOut,
  numGuests,
  guestList,
  pets,
  upsells,
  isCleaned: initialCleaned,
  fulfilledUpsells: initialFulfilled,
  category,
}: {
  registrationId: string;
  propertyName: string;
  propertyNickname: string | null;
  propertyCoverImage: string | null;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  guestList: GuestListEntry[] | null;
  pets: PetEntry[] | null;
  upsells: UpsellEntry[];
  isCleaned: boolean;
  fulfilledUpsells: string[];
  category: "current" | "upcoming" | "departed";
}) {
  const [isCleaned, setIsCleaned] = useState(initialCleaned);
  const [fulfilled, setFulfilled] = useState<string[]>(initialFulfilled);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const allUpsellsDone =
    upsells.length > 0 && upsells.every((u) => fulfilled.includes(u.type));
  const isFullyDone = isCleaned && (upsells.length === 0 || allUpsellsDone);

  // Check-in/out times based on upsell purchases
  const hasEarlyCheckin = upsells.some((u) => u.type === "early_checkin");
  const hasLateCheckout = upsells.some((u) => u.type === "late_checkout");
  const checkInTime = hasEarlyCheckin ? "1:00 PM (early)" : "4:00 PM";
  const checkOutTime = hasLateCheckout ? "2:00 PM (late)" : "11:00 AM";

  // Relative date labels
  const checkInLabel = getRelativeDayLabel(checkIn);
  const checkOutLabel = getRelativeDayLabel(checkOut);

  // Timing badge
  let timingBadge: { text: string; color: string } | null = null;
  if (category === "upcoming" && checkInLabel) {
    timingBadge = {
      text: `Checking in ${checkInLabel.toLowerCase()}`,
      color:
        checkInLabel === "Today" || checkInLabel === "Tomorrow"
          ? "bg-blue-500 text-white"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };
  } else if (category === "current" && checkOutLabel) {
    timingBadge = {
      text: `Checking out ${checkOutLabel.toLowerCase()}`,
      color:
        checkOutLabel === "Today" || checkOutLabel === "Tomorrow"
          ? "bg-amber-500 text-white"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    };
  } else if (category === "departed" && !isCleaned) {
    const label = getRelativeDayLabel(checkOut);
    timingBadge = {
      text: label ? `Checked out ${label.toLowerCase()}` : "Checked out",
      color: "bg-red-500 text-white",
    };
  }

  async function updateStatus(
    updates: { is_cleaned?: boolean; fulfilled_upsells?: string[] }
  ) {
    setSaving(true);
    await fetch("/api/cleaner/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registration_id: registrationId, ...updates }),
    });
    setSaving(false);
  }

  function handleUpsellToggle(upsellType: string) {
    const next = fulfilled.includes(upsellType)
      ? fulfilled.filter((t) => t !== upsellType)
      : [...fulfilled, upsellType];
    setFulfilled(next);
    updateStatus({ fulfilled_upsells: next });
  }

  function handleCleaningComplete() {
    setIsCleaned(true);
    router.refresh();
  }

  const isCheckoutPassed = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkout = new Date(checkOut + "T00:00:00");
    return checkout <= today;
  })();

  return (
    <>
      <Card
        className={`transition-all ${
          isFullyDone
            ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/10 opacity-75"
            : category === "departed" && !isCleaned
              ? "border-red-300 bg-red-50/30 dark:bg-red-950/10"
              : ""
        }`}
      >
        <CardContent className="pt-4 space-y-3">
          {/* Property header: thumbnail + name + timing */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0">
              {propertyCoverImage ? (
                <img
                  src={propertyCoverImage}
                  alt={propertyName}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }}
                />
              ) : null}
              <div className={`w-full h-full bg-linear-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center${propertyCoverImage ? " hidden" : ""}`}>
                <Home className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm truncate">{propertyName}</h3>
              {propertyNickname && (
                <p className="text-xs text-muted-foreground truncate">{propertyNickname}</p>
              )}
              {timingBadge && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${timingBadge.color}`}
                >
                  <Clock className="h-3 w-3" />
                  {timingBadge.text}
                </span>
              )}
            </div>
          </div>
          {/* Prominent dates */}
          <div className="flex items-center justify-center gap-6 py-2 bg-muted/30 rounded-lg">
            <DateBlock dateStr={checkIn} label="Check-in" time={checkInTime} />
            <div className="text-muted-foreground text-lg">&rarr;</div>
            <DateBlock dateStr={checkOut} label="Check-out" time={checkOutTime} />
          </div>

          {/* Early check-in / Late check-out callouts */}
          {(hasEarlyCheckin || hasLateCheckout) && (
            <div className="flex flex-wrap gap-2">
              {hasEarlyCheckin && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-100 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900">
                  <ArrowDownToLine className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">Early Check-In — 1 PM</span>
                </div>
              )}
              {hasLateCheckout && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
                  <ArrowUpFromLine className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Late Check-Out — 2 PM</span>
                </div>
              )}
            </div>
          )}

          {/* Guest breakdown */}
          <GuestBreakdown numGuests={numGuests} guestList={guestList} pets={pets} />

          {/* Upsells section */}
          {upsells.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Add-ons ({fulfilled.length}/{upsells.length} done)
                </p>
                <div className="space-y-1.5">
                  {upsells.map((upsell) => {
                    const isDone = fulfilled.includes(upsell.type);
                    const icon = UPSELL_ICONS[upsell.type] || "•";
                    return (
                      <button
                        key={upsell.type}
                        onClick={() => handleUpsellToggle(upsell.type)}
                        disabled={saving}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                          isDone
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-muted/50 hover:bg-muted text-foreground"
                        }`}
                      >
                        <span className="text-base leading-none">{icon}</span>
                        <span className="flex-1 font-medium text-xs">
                          {UPSELL_LABELS[upsell.type] ||
                            upsell.label ||
                            upsell.type}
                        </span>
                        {isDone ? (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <CircleDot className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Cleaned button */}
          <Separator />
          {isCleaned ? (
            <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white">
              <Check className="h-4 w-4" />
              Cleaned
            </div>
          ) : !isCheckoutPassed ? (
            <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground cursor-not-allowed" title="Can only mark clean after checkout">
              <Clock className="h-4 w-4" />
              Available after checkout
            </div>
          ) : (
            <button
              onClick={() => setDialogOpen(true)}
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all bg-muted hover:bg-muted/80 text-muted-foreground"
            >
              <SprayCan className="h-4 w-4" />
              Mark as Cleaned
            </button>
          )}
        </CardContent>
      </Card>

      <CleaningDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        registrationId={registrationId}
        propertyName={propertyName}
        checkOutDate={checkOut}
        onComplete={handleCleaningComplete}
      />
    </>
  );
}

function GuestBreakdown({
  numGuests,
  guestList,
  pets,
}: {
  numGuests: number;
  guestList: GuestListEntry[] | null;
  pets: PetEntry[] | null;
}) {
  const adults = guestList?.filter((g) => g.age_group === "over_21").length ?? 0;
  const children = guestList?.filter((g) => g.age_group === "under_21").length ?? 0;
  const infants = guestList?.filter((g) => g.age_group === "infant").length ?? 0;
  const petCount = pets?.filter((p) => p.name?.trim()).length ?? 0;
  const hasBreakdown = guestList && guestList.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {hasBreakdown ? (
        <>
          {adults > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {adults} adult{adults !== 1 ? "s" : ""}
            </span>
          )}
          {children > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {children} child{children !== 1 ? "ren" : ""}
            </span>
          )}
          {infants > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Baby className="h-3.5 w-3.5" />
              {infants} infant{infants !== 1 ? "s" : ""}
            </span>
          )}
        </>
      ) : (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {numGuests} guest{numGuests !== 1 ? "s" : ""}
        </span>
      )}
      {petCount > 0 && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
          <PawPrint className="h-3.5 w-3.5" />
          {petCount} pet{petCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
