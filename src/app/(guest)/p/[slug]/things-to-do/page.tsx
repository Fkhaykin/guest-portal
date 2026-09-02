import {
  Mountain,
  Waves,
  TreePine,
  Bike,
  Snowflake,
  MapPin,
  Clock,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { accentText, type Accent } from "@/lib/status-styles";
import { cn } from "@/lib/utils";

const activities = [
  {
    number: 1,
    title: "Hike the Delaware Water Gap",
    subtitle: "70,000 acres of untouched wilderness",
    description:
      "Explore one of the most scenic stretches of the Appalachian Trail. The Delaware Water Gap National Recreation Area offers over 100 miles of trails ranging from easy riverside walks to challenging ridge climbs with panoramic views of the valley below.",
    highlights: ["Mt. Tammany Trail", "Dingmans Falls", "Appalachian Trail access"],
    icon: Mountain,
    accent: "pine" as Accent,
    duration: "2–5 hours",
    cost: "Free",
    distance: "20 min drive",
  },
  {
    number: 2,
    title: "Raft the Lehigh River",
    subtitle: "Class II & III whitewater adventures",
    description:
      "Feel the rush of whitewater rafting through the Lehigh River Gorge. Whether you're a first-timer or a seasoned paddler, guided trips run from spring through fall with rapids that are thrilling but manageable for families and groups alike.",
    highlights: ["Guided group trips", "Family-friendly options", "Gorge scenery"],
    icon: Waves,
    accent: "lake" as Accent,
    duration: "3–4 hours",
    cost: "$50–80/person",
    distance: "30 min drive",
  },
  {
    number: 3,
    title: "Explore State Parks & Waterfalls",
    subtitle: "Bushkill Falls, Ricketts Glen & more",
    description:
      "The Poconos are home to some of Pennsylvania's most stunning waterfalls. Bushkill Falls — the 'Niagara of Pennsylvania' — features eight cascading waterfalls connected by boardwalks and bridges through old-growth forest.",
    highlights: ["Bushkill Falls", "Tobyhanna State Park", "Promised Land State Park"],
    icon: TreePine,
    accent: "dusk" as Accent,
    duration: "Half day",
    cost: "$15 entry",
    distance: "15 min drive",
  },
  {
    number: 4,
    title: "Bike the D&L Trail",
    subtitle: "165 miles of scenic towpath",
    description:
      "Ride along the historic Delaware & Lehigh National Heritage Corridor. This flat, crushed-stone trail follows old canal towpaths and rail lines through charming river towns, covered bridges, and past remnants of Pennsylvania's industrial heritage.",
    highlights: ["Flat & family-friendly", "Jim Thorpe trailhead", "Bike rentals available"],
    icon: Bike,
    accent: "sand" as Accent,
    duration: "2–4 hours",
    cost: "$30–50 rental",
    distance: "25 min drive",
  },
  {
    number: 5,
    title: "Hit the Slopes or Ski Lodge",
    subtitle: "Camelback, Jack Frost & Big Boulder",
    description:
      "In winter, the Poconos transform into a snow sports paradise. Three major resorts offer skiing, snowboarding, and tubing with night sessions. Off-season, Camelback's waterpark and mountain coaster run year-round.",
    highlights: ["Skiing & snowboarding", "Snow tubing", "Indoor waterpark (year-round)"],
    icon: Snowflake,
    accent: "ember" as Accent,
    duration: "Full day",
    cost: "$60–100 lift ticket",
    distance: "10 min drive",
  },
];

/**
 * Card chrome per accent. These are the five decorative tints, so the page
 * varies without leaving the palette — and, unlike the raw hues it replaces,
 * every value has a dark-mode pair.
 */
const ACCENT_CHROME: Record<Accent, { hero: string; wash: string; badge: string }> = {
  lake: { hero: "bg-tint-lake", wash: "bg-tint-lake/[0.07]", badge: "bg-tint-lake/12 text-tint-lake" },
  pine: { hero: "bg-tint-pine", wash: "bg-tint-pine/[0.07]", badge: "bg-tint-pine/12 text-tint-pine" },
  sand: { hero: "bg-tint-sand", wash: "bg-tint-sand/[0.07]", badge: "bg-tint-sand/15 text-tint-sand" },
  dusk: { hero: "bg-tint-dusk", wash: "bg-tint-dusk/[0.07]", badge: "bg-tint-dusk/12 text-tint-dusk" },
  ember: { hero: "bg-tint-ember", wash: "bg-tint-ember/[0.07]", badge: "bg-tint-ember/12 text-tint-ember" },
};

export default function ThingsToDoPage() {
  return (
    // This page used to force its own light palette (bg-white / text-gray-*),
    // so it was the one guest page that broke in dark mode. It sits on the
    // shared tokens now and works in both.
    <div className="-my-6 py-8">
      {/* Hero Header */}
      <div className="mb-10 space-y-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tint-pine/12 px-3 py-1 text-xs font-medium text-tint-pine">
          <Mountain className="h-3 w-3" />
          Local Guide
        </span>
        <h1 className="font-display text-display text-balance">
          Five things to do
          <br />
          <span className="text-primary">in the Poconos</span>
        </h1>
        <p className="mx-auto max-w-lg text-lg leading-relaxed text-muted-foreground">
          Our top picks for making the most of your mountain getaway — from
          trails to thrills.
        </p>
      </div>

      <hr className="mb-10 border-border" />

      {/* Activity Cards */}
      <div className="space-y-6 max-w-2xl mx-auto">
        {activities.map((activity) => {
          const chrome = ACCENT_CHROME[activity.accent];
          const Icon = activity.icon;

          return (
            <div
              key={activity.number}
              className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-foreground/[0.05] transition-shadow duration-200 ease-out-soft hover:shadow-raised"
            >
              {/* A tinted panel stands in for a photograph. The dark wash over
                  it is what keeps the white title legible on the lighter
                  accents (sand especially). */}
              <div className={cn("relative flex h-44 w-full items-end sm:h-52", chrome.hero)}>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/5"
                />
                <Icon aria-hidden="true" className="absolute top-6 right-6 h-20 w-20 text-white/15" />

                {/* Number badge */}
                <div className="absolute top-4 left-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/20 text-lg font-bold text-white backdrop-blur-sm">
                    {activity.number}
                  </div>
                </div>

                {/* Title overlay */}
                <div className="relative p-5">
                  <h2 className="font-display text-2xl text-white">{activity.title}</h2>
                  <p className="mt-0.5 text-sm text-white/80">{activity.subtitle}</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Info pills */}
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", chrome.badge)}
                  >
                    <Clock className="h-3 w-3" />
                    {activity.duration}
                  </span>
                  <span
                    className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", chrome.badge)}
                  >
                    <DollarSign className="h-3 w-3" />
                    {activity.cost}
                  </span>
                  <span
                    className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", chrome.badge)}
                  >
                    <MapPin className="h-3 w-3" />
                    {activity.distance}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {activity.description}
                </p>

                {/* Highlights */}
                <div className={cn("rounded-lg p-3.5", chrome.wash)}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn("h-4 w-4", accentText(activity.accent))} />
                    <span className={cn("text-eyebrow", accentText(activity.accent))}>
                      Highlights
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {activity.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-center gap-2 text-sm text-foreground/80"
                      >
                        <ArrowRight className={cn("h-3 w-3 shrink-0", accentText(activity.accent))} />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center mt-12 space-y-2">
        <p className="text-xs text-muted-foreground">
          Distances are approximate from Summit Lakeside
        </p>
        <p className="text-xs text-muted-foreground">
          Prices and availability may vary by season
        </p>
      </div>
    </div>
  );
}
