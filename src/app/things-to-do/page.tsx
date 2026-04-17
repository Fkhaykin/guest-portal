"use client";

import { useState } from "react";
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
  Star,
  ChevronDown,
  ArrowLeft,
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
  activities: Activity[];
};

const CATEGORIES: Category[] = [
  {
    key: "outdoor",
    title: "Outdoor Adventures",
    subtitle: "Trails, waterfalls, and mountain vistas",
    icon: TreePine,
    activities: [
      {
        name: "Delaware Water Gap",
        description:
          "70,000 acres of protected land along the Delaware River. Hike Mt. Tammany for jaw-dropping ridge views, paddle the river, or explore hidden waterfalls along the Appalachian Trail.",
        image: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
        distance: "35 min",
        tags: ["Hiking", "Swimming", "Scenic"],
        website: "https://www.nps.gov/dewa",
        mapQuery: "Delaware Water Gap National Recreation Area",
      },
      {
        name: "Bushkill Falls",
        description:
          'The "Niagara of Pennsylvania" — eight stunning waterfalls connected by bridges and hiking trails through hemlock gorges. Easy to moderate trails for all skill levels.',
        image: "https://images.unsplash.com/photo-1432405972618-c6b0cfba8b01?w=800&q=80",
        distance: "30 min",
        tags: ["Waterfalls", "Hiking", "Family"],
        website: "https://www.visitbushkillfalls.com",
        mapQuery: "Bushkill Falls PA",
      },
      {
        name: "Hickory Run State Park",
        description:
          "Over 15,000 acres of wilderness with 40+ miles of trails. Don't miss Boulder Field — a surreal landscape of car-sized boulders left by glaciers.",
        image: "https://images.unsplash.com/photo-1510797215324-95aa89f43c33?w=800&q=80",
        distance: "40 min",
        tags: ["Hiking", "Nature", "Unique"],
        website: "https://www.dcnr.pa.gov/StateParks/FindAPark/HickoryRunStatePark",
        mapQuery: "Hickory Run State Park PA",
      },
      {
        name: "Dingmans Falls",
        description:
          "A 130-foot waterfall — the second highest in Pennsylvania. A short, accessible boardwalk trail leads right to the base. Free admission.",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
        distance: "45 min",
        tags: ["Waterfalls", "Easy", "Free"],
        mapQuery: "Dingmans Falls PA",
      },
      {
        name: "Promised Land State Park",
        description:
          "Peaceful forest and lake setting perfect for an afternoon hike, kayak, or picnic. Over 50 miles of trails ranging from easy lakeside walks to rugged backcountry.",
        image: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80",
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
    activities: [
      {
        name: "Lake Wallenpaupack",
        description:
          "The crown jewel of the Poconos — 5,700 acres of crystal-clear water with 52 miles of shoreline. Rent pontoons, jet skis, kayaks, or take a scenic boat cruise.",
        image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
        distance: "25 min",
        tags: ["Boating", "Fishing", "Swimming"],
        website: "https://www.wallenpaupack.com",
        mapQuery: "Lake Wallenpaupack PA",
      },
      {
        name: "Lehigh River Rafting",
        description:
          "Class II-III whitewater rafting through a spectacular gorge. Multiple outfitters offer guided trips — spring dam releases create the best rapids.",
        image: "https://images.unsplash.com/photo-1530866828621-f158b4abb1f0?w=800&q=80",
        distance: "35 min",
        tags: ["Adventure", "Rafting", "Seasonal"],
        website: "https://www.poconowhitewater.com",
        mapQuery: "Lehigh River Whitewater Rafting Jim Thorpe PA",
      },
      {
        name: "Lake Harmony",
        description:
          "A smaller, more intimate lake perfect for a quiet paddle or afternoon swim. Located near Split Rock Resort with beach access and boat rentals.",
        image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80",
        distance: "20 min",
        tags: ["Swimming", "Kayaking", "Relaxed"],
        mapQuery: "Lake Harmony PA",
      },
      {
        name: "Fishing the Poconos",
        description:
          "World-class trout streams, bass-filled lakes, and walleye in the bigger reservoirs. Brodhead Creek and the Lehigh River are local favorites. PA fishing license required.",
        image: "https://images.unsplash.com/photo-1504309092620-4d0ec726efa4?w=800&q=80",
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
    activities: [
      {
        name: "Camelback Mountain Resort",
        description:
          "The Poconos' biggest ski area — 39 trails, 16 lifts, and the largest snow tubing park in the US with 42 lanes. Also home to Camelback Lodge & Aquatopia indoor waterpark.",
        image: "https://images.unsplash.com/photo-1565992441121-4367c2967103?w=800&q=80",
        distance: "25 min",
        tags: ["Skiing", "Tubing", "Waterpark"],
        website: "https://www.camelbackresort.com",
        mapQuery: "Camelback Mountain Resort Tannersville PA",
      },
      {
        name: "Jack Frost Big Boulder",
        description:
          "Two mountains, one ticket. Jack Frost has great intermediate terrain while Big Boulder is the terrain park paradise for snowboarders. Night skiing available.",
        image: "https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=800&q=80",
        distance: "20 min",
        tags: ["Skiing", "Snowboarding", "Night Skiing"],
        website: "https://www.jfbb.com",
        mapQuery: "Jack Frost Big Boulder PA",
      },
      {
        name: "Shawnee Mountain",
        description:
          "Family-friendly slopes with 23 trails and a great ski school for beginners. Smaller crowds, lower prices, and a charming lodge at the base.",
        image: "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80",
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
    activities: [
      {
        name: "Pocono TreeVentures",
        description:
          "An aerial obstacle course suspended in the treetops — zip lines, rope bridges, cargo nets, and balance beams. Multiple difficulty levels from kids to adrenaline junkies.",
        image: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800&q=80",
        distance: "25 min",
        tags: ["Zip Line", "Family", "Adventure"],
        website: "https://www.poconotreeventures.com",
        mapQuery: "Pocono TreeVentures PA",
      },
      {
        name: "ATV Tours",
        description:
          "Tear through forest trails on guided ATV tours. Multiple outfitters offer 1-2 hour guided adventures through rugged mountain terrain. No experience necessary.",
        image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80",
        tags: ["ATV", "Adventure", "Guided"],
        mapQuery: "Pocono ATV Tours PA",
      },
      {
        name: "Claws 'N' Paws Wild Animal Park",
        description:
          "An interactive zoo with over 120 species — feed giraffes, hold parrots, and watch live animal shows. A hit with kids of all ages.",
        image: "https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800&q=80",
        distance: "40 min",
        tags: ["Family", "Animals", "Interactive"],
        website: "https://www.clawsnpaws.com",
        mapQuery: "Claws N Paws Wild Animal Park PA",
      },
      {
        name: "Paintball & Go-Karts",
        description:
          "Skirmish USA offers 50+ paintball fields — the largest in the world. Nearby, Costa's Family Fun Park has go-karts, mini golf, batting cages, and bumper boats.",
        image: "https://images.unsplash.com/photo-1558008258-3256797b43f3?w=800&q=80",
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
    activities: [
      {
        name: "The Farhouse",
        description:
          "A farm-to-table breakfast and lunch spot that sources everything locally. The avocado toast and shakshuka are legendary. Reservations recommended on weekends.",
        image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
        distance: "15 min",
        tags: ["Brunch", "Farm-to-Table", "Popular"],
        website: "https://www.thefarhousepa.com",
        mapQuery: "The Farhouse Cresco PA",
      },
      {
        name: "PizzaOne",
        description:
          "Wood-fired Neapolitan pizza that rivals anything in NYC. Fresh ingredients, blistered crust, and a casual BYOB atmosphere. The margherita is perfection.",
        image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
        distance: "20 min",
        tags: ["Pizza", "BYOB", "Casual"],
        mapQuery: "PizzaOne Stroudsburg PA",
      },
      {
        name: "Garlic",
        description:
          "Upscale Mediterranean-inspired fine dining. Creative seasonal menu, extensive wine list, and a sleek atmosphere. Perfect for a special night out.",
        image: "https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=800&q=80",
        distance: "20 min",
        tags: ["Fine Dining", "Date Night", "Wine"],
        website: "https://www.gaborgarlic.com",
        mapQuery: "Garlic Restaurant Stroudsburg PA",
      },
      {
        name: "Glass Wine Bar at Ledges Hotel",
        description:
          "Perched on a cliff overlooking a waterfall, this is the most scenic spot for drinks in the Poconos. Craft cocktails, local wines, and stunning views.",
        image: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80",
        distance: "45 min",
        tags: ["Cocktails", "Views", "Romantic"],
        website: "https://www.ledgeshotel.com",
        mapQuery: "Glass Wine Bar Ledges Hotel Hawley PA",
      },
      {
        name: "Barley Creek Brewing",
        description:
          "A local brewery with a huge menu of craft beers, burgers, and pub fare. Live music on weekends and a great outdoor patio.",
        image: "https://images.unsplash.com/photo-1559526324-593bc073d938?w=800&q=80",
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
    activities: [
      {
        name: "Downtown Stroudsburg",
        description:
          "A walkable main street packed with independent boutiques, galleries, antique shops, and cafes. Thursday night street fairs in summer.",
        image: "https://images.unsplash.com/photo-1519999482648-25049ddd37b1?w=800&q=80",
        distance: "20 min",
        tags: ["Boutiques", "Galleries", "Walkable"],
        mapQuery: "Main Street Stroudsburg PA",
      },
      {
        name: "The Crossings Premium Outlets",
        description:
          "Over 100 brand-name outlet stores including Nike, Coach, J.Crew, and more. A rainy-day lifesaver with great deals year-round.",
        image: "https://images.unsplash.com/photo-1481437156560-3205f6a55e46?w=800&q=80",
        distance: "25 min",
        tags: ["Outlets", "Brands", "Deals"],
        website: "https://www.premiumoutlets.com/outlet/the-crossings",
        mapQuery: "The Crossings Premium Outlets Tannersville PA",
      },
      {
        name: "Jim Thorpe",
        description:
          'Called the "Switzerland of America" — this historic Victorian town has unique shops, art galleries, the Lehigh Gorge trail, and the Old Jail Museum. Stunning fall foliage.',
        image: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80",
        distance: "40 min",
        tags: ["Historic", "Scenic", "Art"],
        mapQuery: "Jim Thorpe PA",
      },
      {
        name: "Grandpa Joe's Candy Shop",
        description:
          "A nostalgic candy store with walls of vintage sweets, gummy everything, and chocolates. Great for a quick stop with kids.",
        image: "https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=800&q=80",
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
    activities: [
      {
        name: "Mount Airy Casino Resort",
        description:
          "A full-scale casino with 70+ table games, 1,800 slots, live entertainment, multiple restaurants, and a world-class spa. Free parking and free drinks while gaming.",
        image: "https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=800&q=80",
        distance: "15 min",
        tags: ["Casino", "Shows", "Dining"],
        website: "https://www.mountairycasino.com",
        mapQuery: "Mount Airy Casino Resort PA",
      },
      {
        name: "Great Wolf Lodge",
        description:
          "A massive indoor waterpark resort with wave pools, water slides, an arcade, mini bowling, and a Build-A-Bear Workshop. Day passes sometimes available.",
        image: "https://images.unsplash.com/photo-1526659767940-e7adb2a63f23?w=800&q=80",
        distance: "20 min",
        tags: ["Waterpark", "Family", "Indoor"],
        website: "https://www.greatwolf.com/poconos",
        mapQuery: "Great Wolf Lodge Scotrun PA",
      },
      {
        name: "Kalahari Resort Waterpark",
        description:
          "America's largest indoor waterpark — 220,000 sq ft of slides, lazy rivers, and wave pools. Also features an arcade, escape rooms, mini golf, and restaurants.",
        image: "https://images.unsplash.com/photo-1558023751-3bacdb71f4c2?w=800&q=80",
        distance: "30 min",
        tags: ["Waterpark", "Family", "Massive"],
        website: "https://www.kalahariresorts.com/poconos",
        mapQuery: "Kalahari Resort Poconos PA",
      },
      {
        name: "Pocono Raceway",
        description:
          'The "Tricky Triangle" — a NASCAR track hosting major races. Check the schedule for race weekends, driving experiences, and concert events.',
        image: "https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?w=800&q=80",
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
    activities: [
      {
        name: "The Lodge at Woodloch",
        description:
          "A Forbes Five-Star destination spa resort. Day packages include access to the spa, fitness classes, archery, kayaking, and gourmet meals. Pure luxury.",
        image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
        distance: "35 min",
        tags: ["Luxury", "Full Day", "Forbes 5-Star"],
        website: "https://www.thelodgeatwoodloch.com",
        mapQuery: "The Lodge at Woodloch Hawley PA",
      },
      {
        name: "Spa at Mount Airy",
        description:
          "A 27,000 sq ft spa with soaking pools, steam rooms, saunas, and a full menu of massages and facials. Combine with casino gaming for a full day out.",
        image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
        distance: "15 min",
        tags: ["Spa", "Pools", "Relaxation"],
        website: "https://www.mountairycasino.com/spa",
        mapQuery: "Spa at Mount Airy Casino PA",
      },
      {
        name: "Yoga & Sound Baths",
        description:
          "Several local studios offer yoga, meditation, and sound bath experiences in stunning natural settings. Check Pocono Yoga or Mountain Laurel Yoga for schedules.",
        image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80",
        tags: ["Yoga", "Meditation", "Drop-In"],
        mapQuery: "Pocono Yoga PA",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Activity card                                                      */
/* ------------------------------------------------------------------ */

function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <Card className="overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Image */}
      <div className="relative h-48 w-full overflow-hidden bg-muted">
        <img
          src={activity.image}
          alt={activity.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />

        {activity.distance && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-black/60 text-white border-0 backdrop-blur-sm gap-1.5 text-xs font-medium">
              <Navigation className="h-3 w-3" />
              {activity.distance}
            </Badge>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-lg text-white leading-tight drop-shadow-md">
            {activity.name}
          </h3>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
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
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10">
          <Icon className="h-5.5 w-5.5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{category.title}</h2>
          <p className="text-muted-foreground text-sm">{category.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {category.activities.map((activity) => (
          <ActivityCard key={activity.name} activity={activity} />
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
  return (
    <div
      className="sticky top-16 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/80 backdrop-blur-xl border-b"
    >
      <div
        className="flex gap-2 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = active === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => onSelect(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
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
  const [activeSection, setActiveSection] = useState<string | null>(null);

  function scrollToSection(key: string) {
    setActiveSection(key);
    const el = document.getElementById(`section-${key}`);
    if (el) {
      const offset = 130;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta)">
      <SiteNav />

      {/* Hero */}
      <div className="relative h-[50vh] min-h-80 max-h-120 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600&q=80"
          alt="Pocono Mountains aerial view"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

        <div className="absolute inset-0 flex items-end">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-8">
            <Badge variant="secondary" className="mb-3 gap-1.5 text-xs">
              <MapPin className="h-3 w-3" />
              Pocono Mountains, Pennsylvania
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              Things to Do in the Poconos
            </h1>
            <p className="text-base text-white/70 mt-3 max-w-xl">
              Your curated guide to the best experiences, eats, and adventures
              near your stay — handpicked by your hosts at Summit Lakeside.
            </p>
          </div>
        </div>
      </div>

      {/* Quick nav */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6">
        <QuickNav active={activeSection} onSelect={scrollToSection} />
      </div>

      {/* Category sections */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 space-y-14">
        {CATEGORIES.map((category) => (
          <div key={category.key} id={`section-${category.key}`}>
            <CategorySection category={category} />
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <Separator />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 text-center space-y-4">
        <Compass className="h-10 w-10 mx-auto text-muted-foreground/30" />
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
          Ready to explore?
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          These are just our favorites — the Poconos has endless things to
          discover. Ask us for personalized recommendations during your stay!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button size="lg" className="gap-2" render={<Link href="/" />}>
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
