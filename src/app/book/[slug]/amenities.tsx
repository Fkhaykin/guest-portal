"use client";

/**
 * "What this place offers" — sanitized replacement for Lodgify's raw amenity
 * feed. The feed is unfit to render as-is: display texts are mangled
 * ("3 RoomsTerrace", "Towel-set", LaundryHangers labeled "Bathroom &
 * Laundry"), semantic twins repeat ("Parking available" + "Parking
 * Included", "Heating available" + "Central heating"), room counts duplicate
 * the page's quick stats, categories arrive in arbitrary order, and headline
 * features the listing title advertises (e.g. the Chalet's sauna) are
 * missing entirely. Everything here keys off the stable machine `name` —
 * never the display text — with a generic de-CamelCase fallback for names
 * Lodgify adds later, ranks what guests actually book for first, and merges
 * title-derived standouts so the section never omits an advertised feature.
 */

import { useMemo } from "react";
import {
  AlarmSmoke,
  Baby,
  Bath,
  Bed,
  BedDouble,
  BedSingle,
  BriefcaseMedical,
  Car,
  Check,
  Coffee,
  CookingPot,
  Droplets,
  Fan,
  Fence,
  FireExtinguisher,
  Flame,
  Gamepad2,
  Laptop,
  Microwave,
  Piano,
  Refrigerator,
  Sailboat,
  Sandwich,
  Shirt,
  ShowerHead,
  Snowflake,
  Sofa,
  Sparkles,
  Speaker,
  Thermometer,
  Toilet,
  Tv,
  Utensils,
  UtensilsCrossed,
  Vault,
  WashingMachine,
  Waves,
  Wifi,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Model                                                              */
/* ------------------------------------------------------------------ */

export type RawAmenity = { name: string; text: string; prefix: string | null };

export type AmenityCategory =
  | "Standout features"
  | "Kitchen & dining"
  | "Heating & cooling"
  | "Entertainment"
  | "Laundry"
  | "Sleeping"
  | "Bathroom"
  | "Parking"
  | "Safety"
  | "Other";

export type CleanAmenity = {
  id: string;
  label: string;
  category: AmenityCategory;
  rank: number;
  icon: LucideIcon;
};

const CATEGORY_ORDER: AmenityCategory[] = [
  "Standout features",
  "Kitchen & dining",
  "Heating & cooling",
  "Entertainment",
  "Laundry",
  "Sleeping",
  "Bathroom",
  "Parking",
  "Safety",
  "Other",
];

/* ------------------------------------------------------------------ */
/*  Cleaning table — keyed by Lodgify's machine name                   */
/* ------------------------------------------------------------------ */

// Rank tiers: 0xx standout, 1xx comfort, 2xx kitchen, 3xx sleeping,
// 4xx bathroom/household, 5xx parking, 6xx safety (detectors dead last).
type CanonRow = {
  id: string;
  category: AmenityCategory;
  rank: number;
  icon: LucideIcon;
  label: (count: number) => string;
};

const fixed = (label: string) => () => label;
const counted = (singular: string, plural: string) => (n: number) =>
  n > 1 ? `${n} ${plural}` : singular;

// Standout rows are shared between the feed table and the title regexes so
// both paths land on the same de-dupe id.
const HOT_TUB: CanonRow = { id: "hot-tub", category: "Standout features", rank: 0, icon: Bath, label: fixed("Hot tub") };
const SAUNA: CanonRow = { id: "sauna", category: "Standout features", rank: 5, icon: Flame, label: fixed("Sauna") };
const LAKE: CanonRow = { id: "lake", category: "Standout features", rank: 10, icon: Waves, label: fixed("Lake access") };
const GAME_ROOM: CanonRow = { id: "game-room", category: "Standout features", rank: 15, icon: Gamepad2, label: fixed("Game room") };
const FIRE_PIT: CanonRow = { id: "fire-pit", category: "Standout features", rank: 20, icon: Flame, label: fixed("Fire pit") };
const BOATS: CanonRow = { id: "boats", category: "Standout features", rank: 25, icon: Sailboat, label: fixed("Boats & kayaks") };
const DECKS_RANK = 30;

const PARKING: CanonRow = { id: "free-parking", category: "Parking", rank: 500, icon: Car, label: fixed("Free parking on premises") };

const CANON: Record<string, CanonRow> = {
  // Standouts hiding in the feed under the wrong category
  SanitaryTub: HOT_TUB, // Lodgify files the hot tub under "sanitary"
  RoomsPlayroom: GAME_ROOM, // "1 Playroom" is the game room

  // Comfort
  HeatingACAirConditioning: { id: "ac", category: "Heating & cooling", rank: 100, icon: Snowflake, label: fixed("Air conditioning") },
  HeatingACFireplace: { id: "fireplace", category: "Heating & cooling", rank: 105, icon: Flame, label: fixed("Indoor fireplace") },
  EntertainmentInternet: { id: "wifi", category: "Entertainment", rank: 110, icon: Wifi, label: fixed("Fast WiFi") },
  // Washer + dryer collapse into one "Washer & dryer" row when both exist
  LaundryWashingMachine: { id: "washer", category: "Laundry", rank: 115, icon: WashingMachine, label: fixed("Washing machine") },
  LaundryClothesDryer: { id: "dryer", category: "Laundry", rank: 117, icon: WashingMachine, label: fixed("Clothes dryer") },
  CookingEatingDishWasher: { id: "dishwasher", category: "Kitchen & dining", rank: 120, icon: UtensilsCrossed, label: fixed("Dishwasher") },
  CookingEatingGrill: { id: "grill", category: "Kitchen & dining", rank: 125, icon: Flame, label: fixed("BBQ grill") },

  // Entertainment
  EntertainmentTVAntenna: { id: "tv", category: "Entertainment", rank: 190, icon: Tv, label: fixed("TV") },
  EntertainmentStereoSystem: { id: "stereo", category: "Entertainment", rank: 192, icon: Speaker, label: fixed("Sound system") },
  EntertainmentPiano: { id: "piano", category: "Entertainment", rank: 194, icon: Piano, label: fixed("Piano") },
  RoomsWorkroom: { id: "workspace", category: "Entertainment", rank: 196, icon: Laptop, label: fixed("Dedicated workspace") },

  // Kitchen
  CookingEatingCoffeeMachine: { id: "coffee-maker", category: "Kitchen & dining", rank: 200, icon: Coffee, label: fixed("Coffee maker") },
  CookingEatingRefrigerator: { id: "refrigerator", category: "Kitchen & dining", rank: 205, icon: Refrigerator, label: fixed("Refrigerator") },
  CookingEatingOven: { id: "oven", category: "Kitchen & dining", rank: 210, icon: CookingPot, label: fixed("Oven") },
  CookingEatingKitchenStove: { id: "stove", category: "Kitchen & dining", rank: 215, icon: CookingPot, label: fixed("Stove") },
  CookingEatingMicrowave: { id: "microwave", category: "Kitchen & dining", rank: 220, icon: Microwave, label: fixed("Microwave") },
  CookingEatingCookingUtensils: { id: "cookware", category: "Kitchen & dining", rank: 225, icon: Utensils, label: fixed("Cookware & utensils") },
  CookingEatingToaster: { id: "toaster", category: "Kitchen & dining", rank: 230, icon: Sandwich, label: fixed("Toaster") },
  CookingEatingBlender: { id: "blender", category: "Kitchen & dining", rank: 235, icon: Utensils, label: fixed("Blender") },
  CookingEatingSpices: { id: "spices", category: "Kitchen & dining", rank: 240, icon: Utensils, label: fixed("Spices") },
  CookingEatingWaterPurifier: { id: "water-filter", category: "Kitchen & dining", rank: 245, icon: Droplets, label: fixed("Water filter") },
  CookingEatingChildsHighChair: { id: "high-chair", category: "Kitchen & dining", rank: 250, icon: Baby, label: fixed("High chair") },

  // Sleeping
  SleepingKingBed: { id: "king-bed", category: "Sleeping", rank: 300, icon: BedDouble, label: counted("King bed", "king beds") },
  SleepingQueenBed: { id: "queen-bed", category: "Sleeping", rank: 305, icon: BedDouble, label: counted("Queen bed", "queen beds") },
  SleepingDoubleBed: { id: "double-bed", category: "Sleeping", rank: 310, icon: BedDouble, label: counted("Double bed", "double beds") },
  SleepingTwinSingleBed: { id: "twin-bed", category: "Sleeping", rank: 315, icon: BedSingle, label: counted("Twin bed", "twin beds") },
  SleepingStudioCouch: { id: "sofa-bed", category: "Sleeping", rank: 320, icon: Sofa, label: counted("Sofa bed", "sofa beds") },
  SleepingBabyCrib: { id: "crib", category: "Sleeping", rank: 325, icon: Baby, label: counted("Crib", "cribs") },
  SleepingBedLinen: { id: "bed-linens", category: "Sleeping", rank: 330, icon: Bed, label: fixed("Bed linens") },

  // Bathroom
  SanitaryShower: { id: "shower", category: "Bathroom", rank: 400, icon: ShowerHead, label: fixed("Shower") },
  SanitaryBlowDryer: { id: "hair-dryer", category: "Bathroom", rank: 405, icon: Wind, label: fixed("Hair dryer") },
  SanitaryTowelSet: { id: "towels", category: "Bathroom", rank: 410, icon: Bath, label: fixed("Towels") },
  SanitaryEssentials: { id: "essentials", category: "Bathroom", rank: 415, icon: Bath, label: fixed("Bathroom essentials") },
  SanitaryBidet: { id: "bidet", category: "Bathroom", rank: 420, icon: Toilet, label: fixed("Bidet") },

  // Household
  LaundryIronAndBoard: { id: "iron", category: "Laundry", rank: 450, icon: Shirt, label: fixed("Iron & ironing board") },
  LaundryHangers: { id: "hangers", category: "Laundry", rank: 455, icon: Shirt, label: fixed("Hangers") }, // feed mislabels this "Bathroom & Laundry"
  MiscellaneousVacuumCleaner: { id: "vacuum", category: "Laundry", rank: 460, icon: Sparkles, label: fixed("Vacuum cleaner") },

  // Heating & cooling (the non-headline rows)
  HeatingACCentralHeating: { id: "central-heating", category: "Heating & cooling", rank: 470, icon: Thermometer, label: fixed("Central heating") },
  HeatingACElectricHeating: { id: "electric-heating", category: "Heating & cooling", rank: 472, icon: Thermometer, label: fixed("Electric heating") },
  // "Heating available" — dropped when a specific heating row exists
  HeatingACGeneral: { id: "heating-general", category: "Heating & cooling", rank: 474, icon: Thermometer, label: fixed("Heating") },
  HeatingACCeilingFans: { id: "ceiling-fans", category: "Heating & cooling", rank: 480, icon: Fan, label: fixed("Ceiling fans") },

  // Parking — "Parking available" + "Parking Included" share one id
  ParkingGeneral: PARKING,
  ParkingOptionIncluded: PARKING,

  // Safety — nobody books for a fire extinguisher, detectors go last
  MiscellaneousSafe: { id: "safe", category: "Safety", rank: 590, icon: Vault, label: fixed("Safe") },
  MiscellaneousFirstAidKit: { id: "first-aid", category: "Safety", rank: 600, icon: BriefcaseMedical, label: fixed("First aid kit") },
  MiscellaneousFireExtinguisher: { id: "fire-extinguisher", category: "Safety", rank: 605, icon: FireExtinguisher, label: fixed("Fire extinguisher") },
  MiscellaneousSmokeDetector: { id: "smoke-detector", category: "Safety", rank: 690, icon: AlarmSmoke, label: fixed("Smoke detector") },
  MiscellaneousCarbonMonoxideDetector: { id: "co-detector", category: "Safety", rank: 695, icon: AlarmSmoke, label: fixed("Carbon monoxide detector") },
};

// Room counts that duplicate the page's quick stats (bedrooms, bathrooms, …)
const QUICK_STAT_ROOMS = new Set([
  "RoomsBedroom",
  "RoomsBathroom",
  "RoomsToilet",
  "RoomsKitchen",
  "RoomsDiningRoom",
  "RoomsLivingRoom",
]);

// Features the listing title advertises — merged in when the feed lacks them
const TITLE_STANDOUTS: { match: RegExp; row: CanonRow }[] = [
  { match: /hot ?tub|jacuzzi/i, row: HOT_TUB },
  { match: /sauna/i, row: SAUNA },
  { match: /lake/i, row: LAKE },
  { match: /game ?room|arcade|billiard/i, row: GAME_ROOM },
  { match: /fire ?pit/i, row: FIRE_PIT },
  { match: /boats?|kayak|canoe|paddle/i, row: BOATS },
  { match: /deck|patio|balcon/i, row: { id: "decks", category: "Standout features", rank: DECKS_RANK, icon: Fence, label: fixed("Deck") } },
];

/* ------------------------------------------------------------------ */
/*  Generic fallback for machine names not in the table                */
/* ------------------------------------------------------------------ */

// Longest-match first so "CookingEating" wins over "Cooking"
const NAME_PREFIXES = [
  "CookingEating",
  "HeatingAC",
  "Entertainment",
  "Miscellaneous",
  "Sanitary",
  "Sleeping",
  "Laundry",
  "Heating",
  "Parking",
  "Cooking",
  "Eating",
  "Rooms",
  "Outside",
];

const FALLBACK_HOME: Record<string, { category: AmenityCategory; rank: number }> = {
  cooking: { category: "Kitchen & dining", rank: 260 },
  entertainment: { category: "Entertainment", rank: 198 },
  heating: { category: "Heating & cooling", rank: 485 },
  laundry: { category: "Laundry", rank: 465 },
  sleeping: { category: "Sleeping", rank: 340 },
  sanitary: { category: "Bathroom", rank: 430 },
  parking: { category: "Parking", rank: 510 },
  miscellaneous: { category: "Safety", rank: 620 },
};

function countOf(prefix: string | null): number {
  const n = Number.parseInt(prefix ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function deCamel(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2");
}

function pluralize(phrase: string): string {
  return phrase.replace(/[A-Za-z]+$/, (word) => {
    if (/(?:s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
    if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
    return `${word}s`;
  });
}

/** "SleepingBabyCrib" + "2" → "2 baby cribs"; "CookingEatingAirFryer" → "Air fryer". */
export function genericAmenityLabel(name: string, prefix: string | null): string {
  let base = name;
  for (const p of NAME_PREFIXES) {
    if (base.startsWith(p) && base.length > p.length) {
      base = base.slice(p.length);
      break;
    }
  }
  const phrase = deCamel(base)
    .split(/[\s_-]+/)
    .filter(Boolean)
    // Keep acronyms (TV, AC) intact, lowercase the rest
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase()))
    .join(" ");
  if (!phrase) return name;
  const n = countOf(prefix);
  if (n > 1) return `${n} ${pluralize(phrase)}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function fallbackRow(feedCategory: string, name: string): CanonRow {
  const home = FALLBACK_HOME[feedCategory] ?? { category: "Other" as const, rank: 550 };
  return {
    id: name,
    category: home.category,
    rank: home.rank,
    icon: Check,
    label: (n) => genericAmenityLabel(name, n > 1 ? String(n) : null),
  };
}

/* ------------------------------------------------------------------ */
/*  Pipeline                                                           */
/* ------------------------------------------------------------------ */

function deckLabel(terraces: number, balconies: number): string {
  if (terraces > 0 && balconies > 0) return `${terraces + balconies} decks & balconies`;
  if (balconies > 0) return balconies > 1 ? `${balconies} balconies` : "Balcony";
  return terraces > 1 ? `${terraces} decks` : "Deck";
}

export function cleanAmenities(
  amenities: Record<string, RawAmenity[]>,
  propertyName: string
): CleanAmenity[] {
  type Working = CanonRow & { count: number };
  const working = new Map<string, Working>();
  let terraces = 0;
  let balconies = 0;

  for (const [feedCategory, items] of Object.entries(amenities)) {
    for (const item of items) {
      if (QUICK_STAT_ROOMS.has(item.name)) continue;
      const n = countOf(item.prefix);
      // Terrace/balcony counts become one standout "N decks" entry
      if (item.name === "RoomsTerrace") {
        terraces += n;
        continue;
      }
      if (item.name === "RoomsBalcony") {
        balconies += n;
        continue;
      }
      const row = CANON[item.name] ?? fallbackRow(feedCategory, item.name);
      const existing = working.get(row.id);
      if (existing) existing.count += n;
      else working.set(row.id, { ...row, count: n });
    }
  }

  if (terraces + balconies > 0) {
    working.set("decks", {
      id: "decks",
      category: "Standout features",
      rank: DECKS_RANK,
      icon: Fence,
      count: terraces + balconies,
      label: () => deckLabel(terraces, balconies),
    });
  }

  // Semantic twins
  if (working.has("washer") && working.has("dryer")) {
    working.delete("washer");
    working.delete("dryer");
    working.set("washer-dryer", {
      id: "washer-dryer",
      category: "Laundry",
      rank: 115,
      icon: WashingMachine,
      count: 1,
      label: fixed("Washer & dryer"),
    });
  }
  if (working.has("central-heating") || working.has("electric-heating")) {
    working.delete("heating-general");
  }

  for (const { match, row } of TITLE_STANDOUTS) {
    if (!working.has(row.id) && match.test(propertyName)) {
      working.set(row.id, { ...row, count: 1 });
    }
  }

  return [...working.values()]
    .sort((a, b) => a.rank - b.rank)
    .map(({ id, category, rank, icon, label, count }) => ({
      id,
      category,
      rank,
      icon,
      label: label(count),
    }));
}

export function groupAmenities(list: CleanAmenity[]): [AmenityCategory, CleanAmenity[]][] {
  return CATEGORY_ORDER.map(
    (category) =>
      [category, list.filter((a) => a.category === category)] as [AmenityCategory, CleanAmenity[]]
  ).filter(([, items]) => items.length > 0);
}

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

export function AmenitiesSection({
  amenities,
  propertyName,
}: {
  amenities: Record<string, { name: string; text: string; prefix: string | null }[]>;
  propertyName: string;
}) {
  const cleaned = useMemo(
    () => cleanAmenities(amenities, propertyName),
    [amenities, propertyName]
  );
  const grouped = useMemo(() => groupAmenities(cleaned), [cleaned]);

  if (cleaned.length === 0) return null;

  const topAmenities = cleaned.slice(0, 10);

  return (
    <section id="amenities" className="scroll-mt-32 space-y-4">
<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">
        Amenities
      </p>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
        What this place offers
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {topAmenities.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <Icon className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
              {item.label}
            </div>
          );
        })}
      </div>
      {cleaned.length > topAmenities.length && (
        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="mt-1" />}>
            Show all {cleaned.length} amenities
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>What this place offers</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {grouped.map(([category, items]) => (
                <div key={category} className="space-y-2.5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {category}
                  </h3>
                  <ul className="space-y-2.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.id} className="flex items-center gap-3 text-sm">
                          <Icon className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                          {item.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
