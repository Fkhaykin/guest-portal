import type * as React from "react";
import {
  Waves,
  UtensilsCrossed,
  TreePine,
  Snowflake,
  ShoppingBag,
  Dices,
  Sparkles,
  Bike,
  Trophy,
  Droplets,
  Store,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

export type Activity = {
  name: string;
  description: string;
  image: string;
  distance?: string;
  tags?: string[];
  website?: string;
  mapQuery?: string;
};

export type Category = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  accent: string;
  activities: Activity[];
};

// Use Unsplash CDN with a consistent set of verified, popular photo IDs.
// Each URL pulls a specific size so we get consistent aspect + bandwidth.
export const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const CATEGORIES: Category[] = [
  {
    key: "outdoor",
    title: "Outdoor Adventures",
    subtitle: "Trails, waterfalls, and mountain vistas",
    icon: TreePine,
    gradient: "from-emerald-900 via-emerald-700 to-emerald-500",
    accent: "emerald",
    activities: [
      {
        name: "Delaware Water Gap",
        description:
          "70,000 acres of protected land along the Delaware River. Hike Mt. Tammany for jaw-dropping ridge views, paddle the river, or explore hidden waterfalls along the Appalachian Trail.",
        image: img("photo-1506905925346-21bda4d32df4"),
        distance: "35 min",
        tags: ["Hiking", "Swimming", "Scenic"],
        website: "https://www.nps.gov/dewa",
        mapQuery: "Delaware Water Gap National Recreation Area",
      },
      {
        name: "Bushkill Falls",
        description:
          'The "Niagara of Pennsylvania" — eight stunning waterfalls connected by bridges and hiking trails through hemlock gorges. Easy to moderate trails for all skill levels.',
        image: img("photo-1433162653888-a571db5ccccf"),
        distance: "30 min",
        tags: ["Waterfalls", "Hiking", "Family"],
        website: "https://www.visitbushkillfalls.com",
        mapQuery: "Bushkill Falls PA",
      },
      {
        name: "Hickory Run State Park",
        description:
          "Over 15,000 acres of wilderness with 40+ miles of trails. Don't miss Boulder Field — a surreal landscape of car-sized boulders left by glaciers.",
        image: img("photo-1441974231531-c6227db76b6e"),
        distance: "40 min",
        tags: ["Hiking", "Nature", "Unique"],
        website: "https://www.dcnr.pa.gov/StateParks/FindAPark/HickoryRunStatePark",
        mapQuery: "Hickory Run State Park PA",
      },
      {
        name: "Dingmans Falls",
        description:
          "A 130-foot waterfall — the second highest in Pennsylvania. A short, accessible boardwalk trail leads right to the base. Free admission.",
        image: img("photo-1470770841072-f978cf4d019e"),
        distance: "45 min",
        tags: ["Waterfalls", "Easy", "Free"],
        mapQuery: "Dingmans Falls PA",
      },
      {
        name: "Promised Land State Park",
        description:
          "Peaceful forest and lake setting perfect for an afternoon hike, kayak, or picnic. Over 50 miles of trails ranging from easy lakeside walks to rugged backcountry.",
        image: img("photo-1426604966848-d7adac402bff"),
        distance: "50 min",
        tags: ["Hiking", "Lakes", "Peaceful"],
        mapQuery: "Promised Land State Park PA",
      },
    ],
  },
  {
    key: "water",
    title: "Lake & Water Activities",
    subtitle: "Swim, paddle, fish, and cruise",
    icon: Waves,
    gradient: "from-sky-900 via-cyan-700 to-sky-400",
    accent: "sky",
    activities: [
      {
        name: "Lake Wallenpaupack",
        description:
          "The crown jewel of the Poconos — 5,700 acres of crystal-clear water with 52 miles of shoreline. Rent pontoons, jet skis, kayaks, or take a scenic boat cruise.",
        image: img("photo-1444044205806-38f3ed106c10"),
        distance: "25 min",
        tags: ["Boating", "Fishing", "Swimming"],
        website: "https://www.wallenpaupack.com",
        mapQuery: "Lake Wallenpaupack PA",
      },
      {
        name: "Lehigh River Rafting",
        description:
          "Class II-III whitewater rafting through a spectacular gorge. Multiple outfitters offer guided trips — spring dam releases create the best rapids.",
        image: img("photo-1504196606672-aef5c9cefc92"),
        distance: "35 min",
        tags: ["Adventure", "Rafting", "Seasonal"],
        website: "https://www.poconowhitewater.com",
        mapQuery: "Lehigh River Whitewater Rafting Jim Thorpe PA",
      },
      {
        name: "Lake Harmony",
        description:
          "A smaller, more intimate lake perfect for a quiet paddle or afternoon swim. Located near Split Rock Resort with beach access and boat rentals.",
        image: img("photo-1501785888041-af3ef285b470"),
        distance: "20 min",
        tags: ["Swimming", "Kayaking", "Relaxed"],
        mapQuery: "Lake Harmony PA",
      },
      {
        name: "Fishing the Poconos",
        description:
          "World-class trout streams, bass-filled lakes, and walleye in the bigger reservoirs. Brodhead Creek and the Lehigh River are local favorites. PA fishing license required.",
        image: img("photo-1504309092620-4d0ec726efa4"),
        tags: ["Fishing", "Relaxing", "Year-Round"],
        mapQuery: "Brodhead Creek East Stroudsburg PA",
      },
    ],
  },
  {
    key: "winter",
    title: "Ski & Snow",
    subtitle: "Slopes, tubing, and winter wonderlands",
    icon: Snowflake,
    gradient: "from-slate-900 via-blue-800 to-slate-300",
    accent: "blue",
    activities: [
      {
        name: "Camelback Mountain Resort",
        description:
          "The Poconos' biggest ski area — 39 trails, 16 lifts, and the largest snow tubing park in the US with 42 lanes. Also home to Camelback Lodge & Aquatopia indoor waterpark.",
        image: img("photo-1551698618-1dfe5d97d256"),
        distance: "25 min",
        tags: ["Skiing", "Tubing", "Waterpark"],
        website: "https://www.camelbackresort.com",
        mapQuery: "Camelback Mountain Resort Tannersville PA",
      },
      {
        name: "Jack Frost Big Boulder",
        description:
          "Two mountains, one ticket. Jack Frost has great intermediate terrain while Big Boulder is the terrain park paradise for snowboarders. Night skiing available.",
        image: img("photo-1548777123-e216912df7d8"),
        distance: "20 min",
        tags: ["Skiing", "Snowboarding", "Night Skiing"],
        website: "https://www.jfbb.com",
        mapQuery: "Jack Frost Big Boulder PA",
      },
      {
        name: "Shawnee Mountain",
        description:
          "Family-friendly slopes with 23 trails and a great ski school for beginners. Smaller crowds, lower prices, and a charming lodge at the base.",
        image: img("photo-1418985991508-e47386d96a71"),
        distance: "30 min",
        tags: ["Family", "Skiing", "Budget-Friendly"],
        website: "https://www.shawneemt.com",
        mapQuery: "Shawnee Mountain Ski Area PA",
      },
    ],
  },
  {
    key: "adventure",
    title: "Thrills & Adventure",
    subtitle: "Zip lines, ATVs, and treetop courses",
    icon: Bike,
    gradient: "from-amber-900 via-orange-700 to-amber-400",
    accent: "orange",
    activities: [
      {
        name: "Pocono TreeVentures",
        description:
          "An aerial obstacle course suspended in the treetops — zip lines, rope bridges, cargo nets, and balance beams. Multiple difficulty levels from kids to adrenaline junkies.",
        image: img("photo-1516939884455-1445c8652f83"),
        distance: "25 min",
        tags: ["Zip Line", "Family", "Adventure"],
        website: "https://www.poconotreeventures.com",
        mapQuery: "Pocono TreeVentures PA",
      },
      {
        name: "ATV Tours",
        description:
          "Tear through forest trails on guided ATV tours. Multiple outfitters offer 1-2 hour guided adventures through rugged mountain terrain. No experience necessary.",
        image: img("photo-1533923156502-be31530547c4"),
        tags: ["ATV", "Adventure", "Guided"],
        mapQuery: "Pocono ATV Tours PA",
      },
      {
        name: "Claws 'N' Paws Wild Animal Park",
        description:
          "An interactive zoo with over 120 species — feed giraffes, hold parrots, and watch live animal shows. A hit with kids of all ages.",
        image: img("photo-1547721064-da6cfb341d50"),
        distance: "40 min",
        tags: ["Family", "Animals", "Interactive"],
        website: "https://www.clawsnpaws.com",
        mapQuery: "Claws N Paws Wild Animal Park PA",
      },
      {
        name: "Paintball & Go-Karts",
        description:
          "Skirmish USA offers 50+ paintball fields — the largest in the world. Nearby, Costa's Family Fun Park has go-karts, mini golf, batting cages, and bumper boats.",
        image: img("photo-1518791841217-8f162f1e1131"),
        distance: "30 min",
        tags: ["Action", "Family", "Groups"],
        mapQuery: "Skirmish Paintball Jim Thorpe PA",
      },
    ],
  },
  {
    key: "dining",
    title: "Food & Drink",
    subtitle: "Farm tables, wood-fired pizza, and craft cocktails",
    icon: UtensilsCrossed,
    gradient: "from-rose-900 via-red-700 to-amber-500",
    accent: "rose",
    activities: [
      {
        name: "The Farhouse",
        description:
          "A farm-to-table breakfast and lunch spot that sources everything locally. The avocado toast and shakshuka are legendary. Reservations recommended on weekends.",
        image: img("photo-1504674900247-0877df9cc836"),
        distance: "15 min",
        tags: ["Brunch", "Farm-to-Table", "Popular"],
        website: "https://www.thefarhousepa.com",
        mapQuery: "The Farhouse Cresco PA",
      },
      {
        name: "PizzaOne",
        description:
          "Wood-fired Neapolitan pizza that rivals anything in NYC. Fresh ingredients, blistered crust, and a casual BYOB atmosphere. The margherita is perfection.",
        image: img("photo-1513104890138-7c749659a591"),
        distance: "20 min",
        tags: ["Pizza", "BYOB", "Casual"],
        mapQuery: "PizzaOne Stroudsburg PA",
      },
      {
        name: "Garlic",
        description:
          "Upscale Mediterranean-inspired fine dining. Creative seasonal menu, extensive wine list, and a sleek atmosphere. Perfect for a special night out.",
        image: img("photo-1551218808-94e220e084d2"),
        distance: "20 min",
        tags: ["Fine Dining", "Date Night", "Wine"],
        website: "https://www.gaborgarlic.com",
        mapQuery: "Garlic Restaurant Stroudsburg PA",
      },
      {
        name: "Glass Wine Bar at Ledges Hotel",
        description:
          "Perched on a cliff overlooking a waterfall, this is the most scenic spot for drinks in the Poconos. Craft cocktails, local wines, and stunning views.",
        image: img("photo-1470337458703-46ad1756a187"),
        distance: "45 min",
        tags: ["Cocktails", "Views", "Romantic"],
        website: "https://www.ledgeshotel.com",
        mapQuery: "Glass Wine Bar Ledges Hotel Hawley PA",
      },
      {
        name: "Barley Creek Brewing",
        description:
          "A local brewery with a huge menu of craft beers, burgers, and pub fare. Live music on weekends and a great outdoor patio.",
        image: img("photo-1559526324-593bc073d938"),
        distance: "15 min",
        tags: ["Brewery", "Live Music", "Casual"],
        website: "https://www.barleycreek.com",
        mapQuery: "Barley Creek Brewing Company Tannersville PA",
      },
      {
        name: "Sweet Creams Cafe",
        description:
          "A charming Main Street cafe in downtown Stroudsburg serving breakfast, lunch, espresso drinks, and house-made ice cream. Pair a stop here with a stroll through the boutiques and galleries.",
        image: img("photo-1501339847302-ac426a4a7cbb"),
        distance: "15 min",
        tags: ["Breakfast", "Coffee", "Ice Cream"],
        mapQuery: "Sweet Creams Cafe Main Street Stroudsburg PA",
      },
    ],
  },
  {
    key: "shopping",
    title: "Shopping & Towns",
    subtitle: "Boutiques, outlets, and charming main streets",
    icon: ShoppingBag,
    gradient: "from-violet-900 via-purple-700 to-pink-400",
    accent: "purple",
    activities: [
      {
        name: "Downtown Stroudsburg",
        description:
          "A walkable main street packed with independent boutiques, galleries, antique shops, and cafes. Thursday night street fairs in summer.",
        image: img("photo-1519999482648-25049ddd37b1"),
        distance: "20 min",
        tags: ["Boutiques", "Galleries", "Walkable"],
        mapQuery: "Main Street Stroudsburg PA",
      },
      {
        name: "The Crossings Premium Outlets",
        description:
          "Over 100 brand-name outlet stores including Nike, Coach, J.Crew, and more. A rainy-day lifesaver with great deals year-round.",
        image: img("photo-1441986300917-64674bd600d8"),
        distance: "25 min",
        tags: ["Outlets", "Brands", "Deals"],
        website: "https://www.premiumoutlets.com/outlet/the-crossings",
        mapQuery: "The Crossings Premium Outlets Tannersville PA",
      },
      {
        name: "Jim Thorpe",
        description:
          'Called the "Switzerland of America" — this historic Victorian town has unique shops, art galleries, the Lehigh Gorge trail, and the Old Jail Museum. Stunning fall foliage.',
        image: img("photo-1477959858617-67f85cf4f1df"),
        distance: "40 min",
        tags: ["Historic", "Scenic", "Art"],
        mapQuery: "Jim Thorpe PA",
      },
      {
        name: "Grandpa Joe's Candy Shop",
        description:
          "A nostalgic candy store with walls of vintage sweets, gummy everything, and chocolates. Great for a quick stop with kids.",
        image: img("photo-1582058091505-f87a2e55a40f"),
        distance: "20 min",
        tags: ["Family", "Sweets", "Fun"],
        mapQuery: "Grandpa Joes Candy Shop Stroudsburg PA",
      },
    ],
  },
  {
    key: "entertainment",
    title: "Entertainment & Nightlife",
    subtitle: "Casinos, live shows, and evening fun",
    icon: Dices,
    gradient: "from-fuchsia-900 via-purple-700 to-indigo-600",
    accent: "fuchsia",
    activities: [
      {
        name: "Mount Airy Casino Resort",
        description:
          "A full-scale casino with 70+ table games, 1,800 slots, live entertainment, multiple restaurants, and a world-class spa. Free parking and free drinks while gaming.",
        image: img("photo-1511882150382-421056c89033"),
        distance: "15 min",
        tags: ["Casino", "Shows", "Dining"],
        website: "https://www.mountairycasino.com",
        mapQuery: "Mount Airy Casino Resort PA",
      },
      {
        name: "Great Wolf Lodge",
        description:
          "A massive indoor waterpark resort with wave pools, water slides, an arcade, mini bowling, and a Build-A-Bear Workshop. Day passes sometimes available.",
        image: img("photo-1530103862676-de8c9debad1d"),
        distance: "20 min",
        tags: ["Waterpark", "Family", "Indoor"],
        website: "https://www.greatwolf.com/poconos",
        mapQuery: "Great Wolf Lodge Scotrun PA",
      },
      {
        name: "Kalahari Resort Waterpark",
        description:
          "America's largest indoor waterpark — 220,000 sq ft of slides, lazy rivers, and wave pools. Also features an arcade, escape rooms, mini golf, and restaurants.",
        image: img("photo-1581873372796-635b67ca2008"),
        distance: "30 min",
        tags: ["Waterpark", "Family", "Massive"],
        website: "https://www.kalahariresorts.com/poconos",
        mapQuery: "Kalahari Resort Poconos PA",
      },
      {
        name: "Pocono Raceway",
        description:
          'The "Tricky Triangle" — a NASCAR track hosting major races. Check the schedule for race weekends, driving experiences, and concert events.',
        image: img("photo-1540575861501-7cf05a4b125a"),
        distance: "35 min",
        tags: ["Racing", "Events", "Seasonal"],
        website: "https://www.poconoraceway.com",
        mapQuery: "Pocono Raceway Long Pond PA",
      },
    ],
  },
  {
    key: "wellness",
    title: "Spa & Wellness",
    subtitle: "Relax, recharge, and reconnect",
    icon: Sparkles,
    gradient: "from-teal-900 via-emerald-600 to-lime-300",
    accent: "teal",
    activities: [
      {
        name: "The Lodge at Woodloch",
        description:
          "A Forbes Five-Star destination spa resort. Day packages include access to the spa, fitness classes, archery, kayaking, and gourmet meals. Pure luxury.",
        image: img("photo-1544161515-4ab6ce6db874"),
        distance: "35 min",
        tags: ["Luxury", "Full Day", "Forbes 5-Star"],
        website: "https://www.thelodgeatwoodloch.com",
        mapQuery: "The Lodge at Woodloch Hawley PA",
      },
      {
        name: "Spa at Mount Airy",
        description:
          "A 27,000 sq ft spa with soaking pools, steam rooms, saunas, and a full menu of massages and facials. Combine with casino gaming for a full day out.",
        image: img("photo-1540555700478-4be289fbecef"),
        distance: "15 min",
        tags: ["Spa", "Pools", "Relaxation"],
        website: "https://www.mountairycasino.com/spa",
        mapQuery: "Spa at Mount Airy Casino PA",
      },
      {
        name: "Yoga & Sound Baths",
        description:
          "Several local studios offer yoga, meditation, and sound bath experiences in stunning natural settings. Check Pocono Yoga or Mountain Laurel Yoga for schedules.",
        image: img("photo-1506126613408-eca07ce68773"),
        tags: ["Yoga", "Meditation", "Drop-In"],
        mapQuery: "Pocono Yoga PA",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Community (on-property amenities) data                             */
/* ------------------------------------------------------------------ */

export type CommunityAmenity = {
  name: string;
  description?: string;
  image: string;
  tags?: string[];
  mapQuery?: string;
  featured?: boolean;
};

export type CommunityGroup = {
  key: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  note?: string;
  items: CommunityAmenity[];
  fullWidth?: boolean;
};

export type Community = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  hero: string;
  gradient: string;
  mapQuery: string;
  stats: { num: string; label: string }[];
  groups: CommunityGroup[];
};

export const COMMUNITIES: Community[] = [
  {
    id: "penn-estates",
    name: "Penn Estates",
    tagline: "Our home community",
    description:
      "A gated, 1,200-acre community in the heart of the Poconos — three lakes, two Olympic pools, and courts for every sport a few steps from your door.",
    hero: img("photo-1500534623283-312aade485b7", 2000),
    gradient: "from-emerald-900 via-teal-700 to-green-400",
    mapQuery: "Penn Estates East Stroudsburg PA",
    stats: [
      { num: "3", label: "Community lakes" },
      { num: "2", label: "Olympic pools" },
      { num: "4", label: "Sports courts" },
    ],
    groups: [
      {
        key: "sports",
        title: "Sports Courts",
        subtitle: "Match point, half-court, and everything between",
        icon: Trophy,
        items: [
          {
            name: "Tennis Courts",
            description:
              "Well-maintained hard courts open to residents and guests. Great for a morning rally before the heat sets in.",
            image: img("photo-1622279457486-62dcc4a431d6"),
            tags: ["Hard Court", "All Ages"],
            mapQuery: "Penn Estates tennis court East Stroudsburg PA",
          },
          {
            name: "Basketball Courts",
            description:
              "Full outdoor courts for pickup games. Bring a ball — the backboards and hoops are always ready.",
            image: img("photo-1546519638-68e109498ffc"),
            tags: ["Pickup", "Outdoor"],
            mapQuery: "Penn Estates basketball court East Stroudsburg PA",
          },
          {
            name: "Soccer Field",
            description:
              "Open-play grass field that also doubles as frisbee, flag-football, and running space.",
            image: img("photo-1459865264687-595d652de67e"),
            tags: ["Open Play", "Grass"],
            mapQuery: "Penn Estates soccer field East Stroudsburg PA",
          },
          {
            name: "Volleyball Field",
            description:
              "Sand-court volleyball for a sunset match with the group. Nets up all summer.",
            image: img("photo-1612872087720-bb876e2e67d1"),
            tags: ["Sand", "Groups"],
            mapQuery: "Penn Estates volleyball East Stroudsburg PA",
          },
        ],
      },
      {
        key: "lakes",
        title: "The Lakes",
        subtitle: "Three lakes, three different moods",
        icon: Waves,
        note: "All three community lakes are stocked — catch and release only.",
        fullWidth: true,
        items: [
          {
            name: "Hyland Lake",
            description:
              "The social lake. A sandy swimming beach, dancing fountains on the water, and a picnic area with BBQ grills — bring the charcoal and make a day of it.",
            image: img("photo-1500964757637-c85e8a162699"),
            tags: ["Swimming", "Beach", "BBQ Grills", "Picnic"],
            mapQuery: "Hyland Lake Penn Estates East Stroudsburg PA",
            featured: true,
          },
          {
            name: "Upper Twin Lake",
            description:
              "The quiet one. A picnic area tucked into the trees — great for a packed lunch or an early-morning coffee.",
            image: img("photo-1437750769465-301382cdf094"),
            tags: ["Picnic", "Quiet"],
            mapQuery: "Upper Twin Lake Penn Estates PA",
          },
          {
            name: "Lower Twin Lake",
            description:
              "Our lake. Every one of our houses sits on the water here — and it's where we keep the boats. Step out the back door and you're on the dock.",
            image: img("photo-1530541930197-ff16ac917b0e"),
            tags: ["Our Houses", "Boats", "Dock"],
            mapQuery: "Lower Twin Lake Penn Estates PA",
            featured: true,
          },
        ],
      },
      {
        key: "pools",
        title: "Pools",
        subtitle: "Summer headquarters",
        icon: Droplets,
        items: [
          {
            name: "Two Olympic-Size Pools",
            description:
              "Full-length lap lanes and plenty of deck for a lazy afternoon. Open Memorial Day through Labor Day.",
            image: img("photo-1540541338287-41700207dee6"),
            tags: ["Memorial Day → Labor Day", "Lap Lanes"],
            mapQuery: "Penn Estates pool East Stroudsburg PA",
          },
        ],
      },
      {
        key: "store",
        title: "The Store",
        subtitle: "Forgot something? We've got you.",
        icon: Store,
        items: [
          {
            name: "Archie's Corner",
            description:
              "The community store and sandwich shop rolled into one. Grab-and-go lunches, cold drinks, firewood for the pit, and every last-minute supply you forgot to pack.",
            image: img("photo-1578916171728-46686eac8d58"),
            tags: ["Sandwiches", "Snacks", "Firewood", "Supplies"],
            mapQuery: "Archie's Corner Penn Estates East Stroudsburg PA",
            featured: true,
          },
        ],
      },
    ],
  },
  {
    id: "blue-mountain-lake",
    name: "Blue Mountain Lake",
    tagline: "Paddle, swim, play",
    description:
      "A quieter sister community built around a paddle-only lake. Same caliber of pools and courts as Penn Estates — with kayaks, canoes, and pedal boats free to borrow.",
    hero: img("photo-1502900829763-e9f1a3c3a4da", 2000),
    gradient: "from-sky-900 via-blue-700 to-cyan-400",
    mapQuery: "Blue Mountain Lake community East Stroudsburg PA",
    stats: [
      { num: "1", label: "Paddle-only lake" },
      { num: "2", label: "Olympic pools" },
      { num: "4", label: "Sports courts" },
    ],
    groups: [
      {
        key: "amenities",
        title: "Amenities",
        subtitle: "The full spread — courts, field, and the lake",
        icon: Trophy,
        items: [
          {
            name: "Tennis Courts",
            description:
              "Hard-surface courts open throughout the season. Rackets up and away you go.",
            image: img("photo-1622279457486-62dcc4a431d6"),
            tags: ["Hard Court"],
            mapQuery: "Blue Mountain Lake tennis East Stroudsburg PA",
          },
          {
            name: "Basketball Courts",
            description:
              "Full-size outdoor courts for pickup games and shoot-around sessions.",
            image: img("photo-1546519638-68e109498ffc"),
            tags: ["Pickup"],
            mapQuery: "Blue Mountain Lake basketball court East Stroudsburg PA",
          },
          {
            name: "Soccer Field",
            description:
              "A wide-open grass field — perfect for pickup games and long afternoons with the kids.",
            image: img("photo-1459865264687-595d652de67e"),
            tags: ["Open Play"],
            mapQuery: "Blue Mountain Lake soccer field East Stroudsburg PA",
          },
          {
            name: "Volleyball Field",
            description:
              "Sand-court volleyball for the competitive crew. Nets stay up all summer.",
            image: img("photo-1612872087720-bb876e2e67d1"),
            tags: ["Sand"],
            mapQuery: "Blue Mountain Lake volleyball East Stroudsburg PA",
          },
          {
            name: "The Lake",
            description:
              "No swimming, but that's not the point — kayaks, canoes, and pedal boats are all provided. Stocked with fish (catch and release only) for the anglers.",
            image: img("photo-1502900829763-e9f1a3c3a4da"),
            tags: ["Kayaks", "Canoes", "Pedal Boats", "Catch & Release"],
            mapQuery: "Blue Mountain Lake East Stroudsburg PA",
            featured: true,
          },
        ],
      },
      {
        key: "pools",
        title: "Pools",
        subtitle: "Summer headquarters",
        icon: Droplets,
        items: [
          {
            name: "Two Olympic-Size Pools",
            description:
              "Full-length lap lanes and plenty of deck. Open Memorial Day through Labor Day.",
            image: img("photo-1540541338287-41700207dee6"),
            tags: ["Memorial Day → Labor Day", "Lap Lanes"],
            mapQuery: "Blue Mountain Lake pool East Stroudsburg PA",
          },
        ],
      },
    ],
  },
];

/* Full-bleed parallax dividers between categories */
export type Divider = {
  afterKey: string;
  image: string;
  eyebrow: string;
  heading: string;
  sub: string;
  align: "left" | "center" | "right";
};

export const DIVIDERS: Divider[] = [
  {
    afterKey: "outdoor",
    image: img("photo-1472214103451-9374bd1c798e", 2000),
    eyebrow: "In every direction",
    heading: "A thousand square miles of mountain.",
    sub: "From Appalachian ridgelines to quiet hemlock gorges — the Poconos rewards every kind of wanderer.",
    align: "left",
  },
  {
    afterKey: "winter",
    image: img("photo-1486572788966-cfd3df1f5b42", 2000),
    eyebrow: "November through March",
    heading: "First chair, last run, deep snow.",
    sub: "Four resorts, 100+ trails, and the largest snow-tubing park on the planet — all inside a half-hour drive.",
    align: "right",
  },
  {
    afterKey: "dining",
    image: img("photo-1414235077428-338989a2e8c0", 2000),
    eyebrow: "After the hike",
    heading: "Long tables and longer nights.",
    sub: "Farm-to-table tasting menus, waterfall wine bars, and wood-fired pizza that rivals the city.",
    align: "center",
  },
];
