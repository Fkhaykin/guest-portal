"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SiteNav } from "@/components/site-nav";
import {
  MapPin,
  ExternalLink,
  Waves,
  UtensilsCrossed,
  TreePine,
  Snowflake,
  ShoppingBag,
  Dices,
  Sparkles,
  Navigation,
  Bike,
  Compass,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

type Activity = {
  name: string;
  description: string;
  image: string;
  distance?: string;
  tags?: string[];
  website?: string;
  mapQuery?: string;
};

type Category = {
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
const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const CATEGORIES: Category[] = [
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
        image: img("photo-1530866828621-f158b4abb1f0"),
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
        image: img("photo-1545025002-59134f2dfa8b"),
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
        image: img("photo-1474511320723-9a56873571b7"),
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
        image: img("photo-1485872299712-a92e32c6b98d"),
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
        image: img("photo-1559628233-eb1661f7ceff"),
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

/* Full-bleed parallax dividers between categories */
type Divider = {
  afterKey: string;
  image: string;
  eyebrow: string;
  heading: string;
  sub: string;
  align: "left" | "center" | "right";
};

const DIVIDERS: Divider[] = [
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

/* ------------------------------------------------------------------ */
/*  Smart Image — gracefully falls back to a gradient if loading fails */
/* ------------------------------------------------------------------ */

function SmartImage({
  src,
  alt,
  className,
  fallback,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: string;
  style?: React.CSSProperties;
}) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (errored) {
    return (
      <div
        className={`${className ?? ""} bg-linear-to-br ${fallback}`}
        style={style}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <>
      <div
        className={`${className ?? ""} bg-linear-to-br ${fallback} ${loaded ? "opacity-0" : "opacity-100"} transition-opacity duration-500`}
        style={style}
        aria-hidden
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`${className ?? ""} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-700`}
        style={style}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setY(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return y;
}

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.documentElement;
        const max = el.scrollHeight - el.clientHeight;
        setP(max > 0 ? (el.scrollTop / max) * 100 : 0);
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => {
      window.removeEventListener("scroll", handler);
      cancelAnimationFrame(raf);
    };
  }, []);
  return p;
}

function useInView<T extends HTMLElement>(rootMargin = "0px 0px -80px 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.unobserve(el);
        }
      },
      { rootMargin, threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, inView };
}

/* ------------------------------------------------------------------ */
/*  Reveal wrapper                                                     */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  delay = 0,
  y = 24,
  as: Tag = "div",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  as?: React.ElementType;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        transform: inView ? "translateY(0)" : `translateY(${y}px)`,
        opacity: inView ? 1 : 0,
        transition: `transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, opacity 700ms ease ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/*  Parallax divider (full bleed)                                      */
/* ------------------------------------------------------------------ */

function ParallaxDivider({ divider }: { divider: Divider }) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!sectionRef.current) return;
    const el = sectionRef.current;

    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // -1 at top of viewport, 0 at middle, 1 at bottom
        const center = (rect.top + rect.height / 2) / vh - 0.5;
        setOffset(center * 120);
      });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) handler();
      },
      { threshold: 0 },
    );
    io.observe(el);

    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  const alignClasses =
    divider.align === "left"
      ? "items-start text-left"
      : divider.align === "right"
        ? "items-end text-right"
        : "items-center text-center";

  return (
    <section
      ref={sectionRef}
      className="relative w-screen left-1/2 -translate-x-1/2 h-[70vh] min-h-105 max-h-175 overflow-hidden my-16 sm:my-24"
    >
      <div
        className="absolute inset-0 scale-125 will-change-transform"
        style={{
          transform: `translate3d(0, ${offset}px, 0) scale(1.25)`,
          transition: "transform 60ms linear",
        }}
      >
        <SmartImage
          src={divider.image}
          alt={divider.heading}
          className="absolute inset-0 w-full h-full object-cover"
          fallback="from-slate-900 to-slate-700"
        />
      </div>

      <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/30 to-black/70" />

      <div className="relative h-full max-w-6xl mx-auto px-6 sm:px-10 flex items-center">
        <div
          className={`flex flex-col gap-4 max-w-2xl w-full ${alignClasses}`}
          style={{
            transform: inView ? "translateY(0)" : "translateY(32px)",
            opacity: inView ? 1 : 0,
            transition: "all 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <span className="text-xs sm:text-sm uppercase tracking-[0.25em] text-white/70 font-medium">
            {divider.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight drop-shadow-lg">
            {divider.heading}
          </h2>
          <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
            {divider.sub}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity card                                                      */
/* ------------------------------------------------------------------ */

function ActivityCard({
  activity,
  fallback,
}: {
  activity: Activity;
  fallback: string;
}) {
  return (
    <Card className="overflow-hidden group border-border/60 hover:border-border hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-500 will-change-transform">
      <div className="relative h-56 w-full overflow-hidden bg-muted">
        <SmartImage
          src={activity.image}
          alt={activity.name}
          fallback={fallback}
          className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-115 transition-transform duration-1200 ease-out"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-br from-transparent via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {activity.distance && (
          <div className="absolute top-3 right-3 transform group-hover:-translate-y-0.5 transition-transform duration-300">
            <Badge className="bg-black/70 text-white border-0 backdrop-blur-md gap-1.5 text-xs font-medium shadow-lg">
              <Navigation className="h-3 w-3" />
              {activity.distance}
            </Badge>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-0 group-hover:-translate-y-1 transition-transform duration-500">
          <h3 className="font-bold text-xl text-white leading-tight drop-shadow-lg tracking-tight">
            {activity.name}
          </h3>
        </div>
      </div>

      <CardContent className="p-5 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {activity.description}
        </p>

        {activity.tags && (
          <div className="flex flex-wrap gap-1.5">
            {activity.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[11px] font-medium"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {activity.mapQuery && (
            <Button
              variant="default"
              size="sm"
              className="flex-1 gap-1.5"
              render={
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.mapQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <MapPin className="h-3.5 w-3.5" />
              Directions
            </Button>
          )}
          {activity.website && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              render={
                <a
                  href={activity.website}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Website
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Category section                                                   */
/* ------------------------------------------------------------------ */

function CategorySection({ category }: { category: Category }) {
  const Icon = category.icon;

  return (
    <section className="space-y-8">
      <Reveal>
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center justify-center h-14 w-14 rounded-2xl bg-linear-to-br ${category.gradient} shadow-lg shadow-black/10`}
          >
            <Icon className="h-6 w-6 text-white drop-shadow" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {category.title}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              {category.subtitle}
            </p>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {category.activities.map((activity, i) => (
          <Reveal key={activity.name} delay={i * 60} y={32}>
            <ActivityCard activity={activity} fallback={category.gradient} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick-jump nav                                                     */
/* ------------------------------------------------------------------ */

function QuickNav({
  active,
  onSelect,
}: {
  active: string | null;
  onSelect: (key: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Keep the active chip visible in the horizontal scroller.
  useEffect(() => {
    if (!active || !scrollerRef.current) return;
    const btn = scrollerRef.current.querySelector<HTMLButtonElement>(
      `button[data-key="${active}"]`,
    );
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  return (
    <div className="sticky top-16 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/75 backdrop-blur-xl border-b">
      <div
        ref={scrollerRef}
        className="flex gap-2 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = active === cat.key;
          return (
            <button
              key={cat.key}
              data-key={cat.key}
              onClick={() => onSelect(cat.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                isActive
                  ? `bg-linear-to-br ${cat.gradient} text-white shadow-md scale-105`
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ThingsToDoPage() {
  const [activeSection, setActiveSection] = useState<string | null>(
    CATEGORIES[0]?.key ?? null,
  );
  const scrollY = useScrollY();
  const progress = useScrollProgress();

  // Auto-highlight active section based on what's in the middle of the viewport.
  useEffect(() => {
    const ids = CATEGORIES.map((c) => c.key);
    const nodes = ids
      .map((k) => document.getElementById(`section-${k}`))
      .filter((n): n is HTMLElement => !!n);
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const key = entry.target.id.replace("section-", "");
            setActiveSection(key);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  function scrollToSection(key: string) {
    setActiveSection(key);
    const el = document.getElementById(`section-${key}`);
    if (el) {
      const offset = 130;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  // Interleave categories with parallax dividers.
  const interleaved = useMemo(() => {
    const out: ({ type: "category"; cat: Category } | { type: "divider"; div: Divider })[] = [];
    CATEGORIES.forEach((cat) => {
      out.push({ type: "category", cat });
      const div = DIVIDERS.find((d) => d.afterKey === cat.key);
      if (div) out.push({ type: "divider", div });
    });
    return out;
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta)">
      {/* Scroll progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-0.5 z-60 bg-linear-to-r from-emerald-500 via-sky-500 to-fuchsia-500 origin-left"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition: "transform 100ms linear",
          willChange: "transform",
        }}
      />

      <SiteNav variant="transparent" />

      {/* Hero with parallax + ken-burns */}
      <div className="relative h-[92vh] min-h-140 overflow-hidden">
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translate3d(0, ${scrollY * 0.4}px, 0) scale(${1 + Math.min(scrollY, 600) / 6000})`,
          }}
        >
          <SmartImage
            src={img("photo-1506905925346-21bda4d32df4", 2400)}
            alt="Pocono Mountains at golden hour"
            className="absolute inset-0 w-full h-full object-cover animate-[kenburns_30s_ease-in-out_infinite_alternate]"
            fallback="from-emerald-900 via-emerald-600 to-sky-400"
          />
        </div>

        {/* Multi-layer gradient overlays */}
        <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/10 to-black/80" />
        <div className="absolute inset-0 bg-linear-to-r from-black/40 via-transparent to-transparent" />

        {/* Hero content */}
        <div
          className="absolute inset-0 flex items-end"
          style={{
            transform: `translate3d(0, ${scrollY * 0.15}px, 0)`,
            opacity: Math.max(0, 1 - scrollY / 600),
          }}
        >
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-16 sm:pb-24">
            <Badge
              variant="secondary"
              className="mb-5 gap-1.5 text-xs bg-white/15 text-white border-white/20 backdrop-blur-md"
            >
              <MapPin className="h-3 w-3" />
              Pocono Mountains, Pennsylvania
            </Badge>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.02] max-w-4xl drop-shadow-2xl">
              Your guide to{" "}
              <span className="italic font-serif bg-linear-to-r from-emerald-200 via-white to-sky-200 bg-clip-text text-transparent">
                the Poconos
              </span>
            </h1>
            <p className="text-base sm:text-lg text-white/85 mt-5 max-w-xl leading-relaxed">
              Curated by your hosts at Summit Lakeside — the trails we hike,
              the tables we book, and the hidden waterfalls we only tell our
              favorite guests about.
            </p>

            <div className="mt-8 flex flex-wrap gap-6 text-white/80">
              {[
                { num: "7+", label: "Categories" },
                { num: "30+", label: "Handpicked spots" },
                { num: "15 min", label: "Closest is" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span className="text-2xl sm:text-3xl font-bold text-white">
                    {s.num}
                  </span>
                  <span className="text-xs uppercase tracking-widest text-white/70">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/70"
          style={{ opacity: Math.max(0, 1 - scrollY / 200) }}
        >
          <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <div className="w-px h-10 bg-linear-to-b from-white/70 to-transparent animate-pulse" />
        </div>
      </div>

      {/* Quick nav */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6">
        <QuickNav active={activeSection} onSelect={scrollToSection} />
      </div>

      {/* Category sections + parallax dividers */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16 space-y-16 sm:space-y-20">
        {interleaved.map((item, i) => {
          if (item.type === "category") {
            return (
              <div key={item.cat.key} id={`section-${item.cat.key}`}>
                <CategorySection category={item.cat} />
              </div>
            );
          }
          return <ParallaxDivider key={`div-${i}`} divider={item.div} />;
        })}
      </div>

      {/* Footer CTA */}
      <Separator />
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `url(${img("photo-1469474968028-56623f02e42e", 1600)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center space-y-5">
          <Reveal>
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-linear-to-br from-emerald-500 to-sky-500 shadow-lg">
              <Compass className="h-6 w-6 text-white" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Ready to explore?
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="text-muted-foreground max-w-lg mx-auto text-base leading-relaxed">
              These are just our favorites — the Poconos has endless things to
              discover. Ask us for personalized recommendations during your stay.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3">
              <Button size="lg" className="gap-2" render={<Link href="/" />}>
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                render={<Link href="/why-summit" />}
              >
                Why Summit?
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Keyframes (one-off) */}
      <style jsx global>{`
        @keyframes kenburns {
          0% {
            transform: scale(1);
            transform-origin: 50% 50%;
          }
          100% {
            transform: scale(1.08);
            transform-origin: 50% 40%;
          }
        }
      `}</style>
    </div>
  );
}
