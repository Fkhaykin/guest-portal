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
import { toneSolid, toneBadge } from "@/lib/status-styles";
import { timingUpsellTime } from "@/lib/upsells/timing";
import { CleaningDialog } from "./cleaning-dialog";
import { CompletedCleaningDialog } from "./completed-cleaning-dialog";
import { useNewIds } from "./new-ids-provider";

const UPSELL_LABELS: Record<string, string> = {
  early_checkin: "Early Check-In",
  late_checkout: "Late Check-Out",
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
  lodgifyNumPets = 0,
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
  lodgifyNumPets?: number;
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

  const earlyCheckin = upsells.find((u) => u.type === "early_checkin");
  const lateCheckout = upsells.find((u) => u.type === "late_checkout");
  const hasEarlyCheckin = !!earlyCheckin;
  const hasLateCheckout = !!lateCheckout;
  const earlyCheckinTime = earlyCheckin ? timingUpsellTime(earlyCheckin) : null;
  const lateCheckoutTime = lateCheckout ? timingUpsellTime(lateCheckout) : null;

  // Relative date labels
  const checkInLabel = getRelativeDayLabel(checkIn);
  const checkOutLabel = getRelativeDayLabel(checkOut);

  // Timing badge
  let timingBadge: { text: string; color: string } | null = null;
  if (category === "upcoming" && checkInLabel) {
    const imminent = checkInLabel === "Today" || checkInLabel === "Tomorrow";
    timingBadge = {
      text: `Checking in ${checkInLabel.toLowerCase()}`,
      color: imminent ? toneSolid("info") : toneBadge("info"),
    };
  } else if (category === "current" && checkOutLabel) {
    const imminent = checkOutLabel === "Today" || checkOutLabel === "Tomorrow";
    timingBadge = {
      text: `Checking out ${checkOutLabel.toLowerCase()}`,
      color: imminent ? toneSolid("warning") : toneBadge("warning"),
    };
  } else if (category === "departed" && !isCleaned) {
    const label = getRelativeDayLabel(checkOut);
    timingBadge = {
      text: label ? `Checked out ${label.toLowerCase()}` : "Checked out",
      color: toneSolid("danger"),
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
            ? "ring-2 ring-success bg-success/5"
            : isFullyDone
              ? "border-success/50 bg-success/5 opacity-75"
              : isSkipped
                ? "border-muted opacity-60"
                : category === "departed" && !isCleaned
                  ? "border-warning/40 bg-warning/5"
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
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${toneSolid("danger")}`}>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90 ${toneSolid("success")}`}
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
                <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-medium text-success">
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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-secondary-foreground">
                  <ArrowDownToLine className="h-3 w-3" />
                  Early{earlyCheckinTime ? ` ${earlyCheckinTime}` : ""}
                </span>
              )}
              {hasLateCheckout && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-secondary-foreground">
                  <ArrowUpFromLine className="h-3 w-3" />
                  Late{lateCheckoutTime ? ` ${lateCheckoutTime}` : ""}
                </span>
              )}
              {needsHighchair && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-secondary-foreground">
                  <Baby className="h-3 w-3" />
                  Highchair
                </span>
              )}
              {needsPackNPlay && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-secondary-foreground">
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
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${toneBadge("success")}`}
                  >
                    <Heart className="h-3 w-3 fill-current" />
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
                        ? toneBadge("success")
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
        expectedPetCount={Math.max(
          // Pets paid via the original booking (Airbnb/Lodgify or direct checkout)
          // plus pet fees paid during registration — `upsells` here is already
          // filtered to paid entries by the tasks page
          lodgifyNumPets + upsells.filter((u) => u.type === "pet_fee").length,
          // Registration-listed pets are always paid (step 4 gates on payment)
          pets?.filter((p) => p.name?.trim()).length ?? 0
        )}
        onComplete={handleCleaningComplete}
      />

      <CompletedCleaningDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        registrationId={registrationId}
        propertyName={propertyNickname || propertyName}
        checkIn={checkIn}
        checkOut={checkOut}
        photoAreas={photoAreas}
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
        <span className="text-warning font-medium ml-0.5">
          +{petCount} pet{petCount !== 1 ? "s" : ""}
        </span>
      )}
    </span>
  );
}
