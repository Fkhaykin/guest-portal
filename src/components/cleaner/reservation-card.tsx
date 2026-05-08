"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Check,
  Users,
  Clock,
  Home,
  SprayCan,
  ArrowDownToLine,
  ArrowUpFromLine,
  Heart,
  SkipForward,
  Undo2,
  Baby,
  DollarSign,
  Repeat2,
} from "lucide-react";
import type { UpsellEntry, GuestListEntry, PetEntry } from "@/types/database";
import { CleaningDialog } from "./cleaning-dialog";
import { CompletedCleaningDialog } from "./completed-cleaning-dialog";
import { useNewIds } from "./new-ids-provider";

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
  needsHighchair,
  needsPackNPlay,
  isCleaned: initialCleaned,
  isSkipped: initialSkipped,
  fulfilledUpsells: initialFulfilled,
  photoAreas,
  category,
  isNew,
  backToBack = null,
  cleaningFeeCents = 0,
  petFeeCents = 0,
  bookedOn,
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
  needsHighchair: boolean;
  needsPackNPlay: boolean;
  isCleaned: boolean;
  isSkipped: boolean;
  fulfilledUpsells: string[];
  photoAreas: string[] | null;
  category: "current" | "upcoming" | "departed";
  isNew?: boolean;
  backToBack?: "checkin" | "checkout" | "both" | null;
  cleaningFeeCents?: number;
  petFeeCents?: number;
  bookedOn?: string | null;
}) {
  const newIds = useNewIds();
  const resolvedIsNew = isNew ?? newIds.has(registrationId);
  const [isCleaned, setIsCleaned] = useState(initialCleaned);
  const [isSkipped, setIsSkipped] = useState(initialSkipped);
  const [fulfilled, setFulfilled] = useState<string[]>(initialFulfilled);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const router = useRouter();

  const tipUpsells = upsells.filter((u) => u.type.startsWith("tip_"));
  const regularUpsells = upsells.filter((u) => !u.type.startsWith("tip_"));

  const allUpsellsDone =
    regularUpsells.length > 0 && regularUpsells.every((u) => fulfilled.includes(u.type));
  const isFullyDone = isCleaned && (regularUpsells.length === 0 || allUpsellsDone);

  const hasEarlyCheckin = upsells.some((u) => u.type === "early_checkin");
  const hasLateCheckout = upsells.some((u) => u.type === "late_checkout");

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
    updates: { is_cleaned?: boolean; is_skipped?: boolean; fulfilled_upsells?: string[] }
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

  async function handleSkip() {
    const next = !isSkipped;
    setIsSkipped(next);
    await updateStatus({ is_skipped: next });
    router.refresh();
  }

  const isCheckoutPassed = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkout = new Date(checkOut + "T00:00:00");
    return checkout <= today;
  })();

  const { dayOfWeek: ciDow, month: ciMonth, day: ciDay } = formatDateProminent(checkIn);
  const { dayOfWeek: coDow, month: coMonth, day: coDay } = formatDateProminent(checkOut);

  return (
    <>
      <Card
        className={`transition-all ${
          resolvedIsNew
            ? "ring-2 ring-green-500 bg-green-50/40 dark:bg-green-950/20"
            : isFullyDone
              ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/10 opacity-75"
              : isSkipped
                ? "border-muted opacity-60"
                : category === "departed" && !isCleaned
                  ? "border-red-300 bg-red-50/30 dark:bg-red-950/10"
                  : ""
        }`}
      >
        <CardContent className="py-3 px-4">
          {/* Header row: thumbnail + property name/badge + action */}
          <div className="flex items-center gap-3">
            {/* Thumbnail */}
            <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
              {propertyCoverImage ? (
                <img
                  src={propertyCoverImage}
                  alt={propertyName}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }}
                />
              ) : null}
              <div className={`w-full h-full bg-linear-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center${propertyCoverImage ? " hidden" : ""}`}>
                <Home className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              </div>
            </div>

            {/* Property name + badge */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-semibold text-sm truncate">{propertyNickname || propertyName}</h3>
                {backToBack && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-rose-600 text-white">
                    <Repeat2 className="h-2.5 w-2.5" />
                    {backToBack === "both"
                      ? "Back to Back · Check-in & Check-out"
                      : backToBack === "checkin"
                        ? "Back to Back · Check-in"
                        : "Back to Back · Check-out"}
                  </span>
                )}
                {timingBadge && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${timingBadge.color}`}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {timingBadge.text}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="shrink-0 flex items-center gap-1.5">
              {isCleaned ? (
                <button
                  onClick={() => setDetailOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  Cleaned
                </button>
              ) : isSkipped ? (
                <button
                  onClick={handleSkip}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-muted text-muted-foreground hover:bg-muted/80"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Unskip
                </button>
              ) : !isCheckoutPassed ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground cursor-not-allowed" title="Can only mark clean after checkout">
                  <Clock className="h-3.5 w-3.5" />
                  After checkout
                </div>
              ) : (
                <>
                  <button
                    onClick={handleSkip}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-muted text-muted-foreground hover:bg-muted/80"
                    title="Skip this task"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Skip
                  </button>
                  <button
                    onClick={() => setDialogOpen(true)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <SprayCan className="h-3.5 w-3.5" />
                    Clean
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Date & guest row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1.5 ml-13">
            <span className="whitespace-nowrap">{ciDow} {ciMonth} {ciDay}</span>
            <span>&rarr;</span>
            <span className="whitespace-nowrap">{coDow} {coMonth} {coDay}</span>
            <span className="text-muted-foreground/40">|</span>
            <GuestBreakdownInline numGuests={numGuests} guestList={guestList} pets={pets} />
            {(cleaningFeeCents > 0 || petFeeCents > 0) && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-medium text-green-600 dark:text-green-400">
                  <DollarSign className="h-3 w-3" />
                  {((cleaningFeeCents + petFeeCents) / 100).toFixed(0)}
                  {petFeeCents > 0 && (
                    <span className="text-muted-foreground font-normal ml-0.5">(+${(petFeeCents / 100).toFixed(0)} pet)</span>
                  )}
                </span>
              </>
            )}
            {bookedOn && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span className="whitespace-nowrap">Booked {new Date(bookedOn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </>
            )}
          </div>

          {/* Secondary row: early/late callouts + infant needs + tips + upsells (only if present) */}
          {(hasEarlyCheckin || hasLateCheckout || needsHighchair || needsPackNPlay || tipUpsells.length > 0 || regularUpsells.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
              {hasEarlyCheckin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 border border-orange-200 dark:border-orange-900">
                  <ArrowDownToLine className="h-3 w-3" />
                  Early 1 PM
                </span>
              )}
              {hasLateCheckout && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border border-purple-200 dark:border-purple-900">
                  <ArrowUpFromLine className="h-3 w-3" />
                  Late 2 PM
                </span>
              )}
              {needsHighchair && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                  <Baby className="h-3 w-3" />
                  Highchair
                </span>
              )}
              {needsPackNPlay && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                  <Baby className="h-3 w-3" />
                  Pack &apos;n Play
                </span>
              )}
              {tipUpsells.map((tip) => {
                const label = tip.type === "tip_cleaning"
                  ? "Cleaning"
                  : tip.type === "tip_delivery"
                    ? "Delivery"
                    : tip.type === "tip_breakfast"
                      ? "Breakfast"
                      : "Staff";
                const amount = `$${(tip.price_cents / 100).toFixed(0)}`;
                return (
                  <span
                    key={tip.type}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                  >
                    <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                    {amount} {label}
                  </span>
                );
              })}
              {regularUpsells.map((upsell) => {
                const isDone = fulfilled.includes(upsell.type);
                const icon = UPSELL_ICONS[upsell.type] || "•";
                return (
                  <button
                    key={upsell.type}
                    onClick={() => handleUpsellToggle(upsell.type)}
                    disabled={saving}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                      isDone
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800"
                        : "bg-muted/50 text-foreground hover:bg-muted border border-border/50"
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{UPSELL_LABELS[upsell.type]?.replace(/ \(.*\)/, "") || upsell.label || upsell.type}</span>
                    {isDone && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CleaningDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        registrationId={registrationId}
        propertyName={propertyName}
        checkOutDate={checkOut}
        photoAreas={photoAreas}
        expectedPetCount={pets?.filter((p) => p.name?.trim()).length ?? 0}
        onComplete={handleCleaningComplete}
      />

      <CompletedCleaningDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        registrationId={registrationId}
        propertyName={propertyNickname || propertyName}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    </>
  );
}

function GuestBreakdownInline({
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

  const parts: string[] = [];
  if (hasBreakdown) {
    if (adults > 0) parts.push(`${adults}A`);
    if (children > 0) parts.push(`${children}C`);
    if (infants > 0) parts.push(`${infants}I`);
  } else {
    parts.push(`${numGuests} guest${numGuests !== 1 ? "s" : ""}`);
  }

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Users className="h-3 w-3" />
      {parts.join("/")}
      {petCount > 0 && (
        <span className="text-amber-600 dark:text-amber-400 font-medium ml-0.5">
          +{petCount} pet{petCount !== 1 ? "s" : ""}
        </span>
      )}
    </span>
  );
}
