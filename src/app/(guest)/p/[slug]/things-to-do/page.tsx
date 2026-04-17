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

const activities = [
  {
    number: 1,
    title: "Hike the Delaware Water Gap",
    subtitle: "70,000 acres of untouched wilderness",
    description:
      "Explore one of the most scenic stretches of the Appalachian Trail. The Delaware Water Gap National Recreation Area offers over 100 miles of trails ranging from easy riverside walks to challenging ridge climbs with panoramic views of the valley below.",
    highlights: ["Mt. Tammany Trail", "Dingmans Falls", "Appalachian Trail access"],
    icon: Mountain,
    color: "emerald",
    duration: "2–5 hours",
    cost: "Free",
    distance: "20 min drive",
    gradient: "from-emerald-800 to-emerald-600",
  },
  {
    number: 2,
    title: "Raft the Lehigh River",
    subtitle: "Class II & III whitewater adventures",
    description:
      "Feel the rush of whitewater rafting through the Lehigh River Gorge. Whether you're a first-timer or a seasoned paddler, guided trips run from spring through fall with rapids that are thrilling but manageable for families and groups alike.",
    highlights: ["Guided group trips", "Family-friendly options", "Gorge scenery"],
    icon: Waves,
    color: "sky",
    duration: "3–4 hours",
    cost: "$50–80/person",
    distance: "30 min drive",
    gradient: "from-sky-800 to-sky-600",
  },
  {
    number: 3,
    title: "Explore State Parks & Waterfalls",
    subtitle: "Bushkill Falls, Ricketts Glen & more",
    description:
      "The Poconos are home to some of Pennsylvania's most stunning waterfalls. Bushkill Falls — the 'Niagara of Pennsylvania' — features eight cascading waterfalls connected by boardwalks and bridges through old-growth forest.",
    highlights: ["Bushkill Falls", "Tobyhanna State Park", "Promised Land State Park"],
    icon: TreePine,
    color: "green",
    duration: "Half day",
    cost: "$15 entry",
    distance: "15 min drive",
    gradient: "from-green-800 to-green-600",
  },
  {
    number: 4,
    title: "Bike the D&L Trail",
    subtitle: "165 miles of scenic towpath",
    description:
      "Ride along the historic Delaware & Lehigh National Heritage Corridor. This flat, crushed-stone trail follows old canal towpaths and rail lines through charming river towns, covered bridges, and past remnants of Pennsylvania's industrial heritage.",
    highlights: ["Flat & family-friendly", "Jim Thorpe trailhead", "Bike rentals available"],
    icon: Bike,
    color: "amber",
    duration: "2–4 hours",
    cost: "$30–50 rental",
    distance: "25 min drive",
    gradient: "from-amber-800 to-amber-600",
  },
  {
    number: 5,
    title: "Hit the Slopes or Ski Lodge",
    subtitle: "Camelback, Jack Frost & Big Boulder",
    description:
      "In winter, the Poconos transform into a snow sports paradise. Three major resorts offer skiing, snowboarding, and tubing with night sessions. Off-season, Camelback's waterpark and mountain coaster run year-round.",
    highlights: ["Skiing & snowboarding", "Snow tubing", "Indoor waterpark (year-round)"],
    icon: Snowflake,
    color: "blue",
    duration: "Full day",
    cost: "$60–100 lift ticket",
    distance: "10 min drive",
    gradient: "from-blue-800 to-blue-600",
  },
];

const colorMap: Record<string, { bg: string; text: string; badge: string; accent: string }> = {
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    accent: "bg-emerald-600",
  },
  sky: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    badge: "bg-sky-100 text-sky-700 border border-sky-200",
    accent: "bg-sky-600",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-700",
    badge: "bg-green-100 text-green-700 border border-green-200",
    accent: "bg-green-600",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
    accent: "bg-amber-600",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700 border border-blue-200",
    accent: "bg-blue-600",
  },
};

export default function ThingsToDoPage() {
  return (
    <div className="bg-white text-gray-900 -mx-4 -my-6 px-4 py-8 min-h-screen">
      {/* Hero Header */}
      <div className="text-center space-y-4 mb-10">
        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium px-3 py-1 rounded-full">
          <Mountain className="h-3 w-3" />
          Local Guide
        </span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
          Five Things to Do
          <br />
          <span className="text-emerald-600">in the Poconos</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-lg mx-auto leading-relaxed">
          Our top picks for making the most of your mountain getaway — from
          trails to thrills.
        </p>
      </div>

      <hr className="mb-10 border-gray-200" />

      {/* Activity Cards */}
      <div className="space-y-6 max-w-2xl mx-auto">
        {activities.map((activity) => {
          const colors = colorMap[activity.color];
          const Icon = activity.icon;

          return (
            <div
              key={activity.number}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              {/* Gradient hero instead of image */}
              <div className={`relative h-44 sm:h-52 w-full bg-linear-to-br ${activity.gradient} flex items-end`}>
                {/* Decorative icon */}
                <Icon className="absolute top-6 right-6 h-20 w-20 text-white/10" />

                {/* Number badge */}
                <div className="absolute top-4 left-4">
                  <div
                    className="bg-white/20 backdrop-blur-sm text-white h-10 w-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg border border-white/30"
                  >
                    {activity.number}
                  </div>
                </div>

                {/* Title overlay */}
                <div className="p-5">
                  <h2 className="text-2xl font-bold text-white">
                    {activity.title}
                  </h2>
                  <p className="text-white/75 text-sm mt-0.5">
                    {activity.subtitle}
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Info pills */}
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${colors.badge}`}
                  >
                    <Clock className="h-3 w-3" />
                    {activity.duration}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${colors.badge}`}
                  >
                    <DollarSign className="h-3 w-3" />
                    {activity.cost}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${colors.badge}`}
                  >
                    <MapPin className="h-3 w-3" />
                    {activity.distance}
                  </span>
                </div>

                {/* Description */}
                <p className="text-gray-600 text-sm leading-relaxed">
                  {activity.description}
                </p>

                {/* Highlights */}
                <div className={`${colors.bg} rounded-lg p-3.5`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${colors.text}`} />
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}
                    >
                      Highlights
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {activity.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <ArrowRight className={`h-3 w-3 ${colors.text}`} />
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
        <p className="text-gray-400 text-xs">
          Distances are approximate from Summit Lakeside
        </p>
        <p className="text-gray-400 text-xs">
          Prices and availability may vary by season
        </p>
      </div>
    </div>
  );
}
