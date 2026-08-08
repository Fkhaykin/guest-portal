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
        name: "Mt. Minsi via the Appalachian Trail",
        description:
          "The closest real hike to the houses — a 5-mile loop on the PA side of the Water Gap with river views the whole climb, and a fraction of Tammany's crowds. Park in Delaware Water Gap borough if the small Lake Lenape lot is full, and cap it with pizza at ShawneeCraft.",
        image: img("photo-1464822759023-fed622ff2c3b"),
        distance: "10 min",
        tags: ["Hiking", "River Views", "Quieter"],
        mapQuery: "Mount Minsi Trailhead Delaware Water Gap PA",
      },
      {
        name: "Mt. Tammany & the Water Gap",
        description:
          "The marquee Gap hike: up the red-dot trail, down the blue-dot, about 3.5 steep miles to THE view of the river bend. The lots fill by 8 AM on nice weekends — go early, go midweek, or hike Minsi instead.",
        image: img("photo-1506905925346-21bda4d32df4"),
        distance: "15 min",
        tags: ["Hiking", "Iconic View", "Go Early"],
        website: "https://www.nps.gov/dewa",
        mapQuery: "Mount Tammany Trailhead NJ",
      },
      {
        name: "McDade Trail",
        description:
          "Thirty-two miles of smooth riverside trail inside the national recreation area, with trailheads starting ten minutes from the houses. Walk a stretch, bike it, or use it for the low-effort fall-color fix — flat, marked, and never fully crowded.",
        image: img("photo-1507041957456-9c397ce39c97"),
        distance: "10-25 min",
        tags: ["Walking", "Biking", "Riverside"],
        mapQuery: "McDade Recreational Trail Smithfield Beach Trailhead PA",
      },
      {
        name: "Bushkill Falls",
        description:
          'The "Niagara of Pennsylvania" — eight falls strung together with wooden bridges through hemlock gorges. It\'s paid admission (~$20) and popular: a 9 AM weekday start on the red trail gets you the gorge nearly alone. Lots of stairs, so no strollers.',
        image: img("photo-1433162653888-a571db5ccccf"),
        distance: "25 min",
        tags: ["Waterfalls", "Family", "Go Early"],
        website: "https://www.visitbushkillfalls.com",
        mapQuery: "Bushkill Falls PA",
      },
      {
        name: "Raymondskill Falls",
        description:
          "Pennsylvania's tallest waterfall, and it's free — a short staircase trail to the lookouts, no ticket booth in sight. Weekdays are best in October. Even closer to home, Resica Falls off Route 402 needs no hike at all.",
        image: img("photo-1470770841072-f978cf4d019e"),
        distance: "30 min",
        tags: ["Waterfalls", "Free", "Tallest in PA"],
        mapQuery: "Raymondskill Falls Milford PA",
      },
      {
        name: "Hornbecks Creek / Indian Ladders",
        description:
          "The quiet one the internet hasn't ruined: a couple of creekside miles over little footbridges to a stacked pair of waterfalls. You'll pass more chipmunks than people. Kids love the bridges; the last stretch is a scramble.",
        image: img("photo-1437482078695-73f5ca6c96e2"),
        distance: "25 min",
        tags: ["Hidden Gem", "Waterfalls", "Quiet"],
        mapQuery: "Hornbecks Creek Trail Dingmans Ferry PA",
      },
      {
        name: "George W. Childs Park",
        description:
          "Three waterfalls — Factory, Fulmer, and Deer Leap — freshly reopened in 2025 after years of trail rebuilding. Accessible paths along the top, stairs down to the good views. An easy win with mixed-age groups.",
        image: img("photo-1432405972618-c60b0225b8f9"),
        distance: "35 min",
        tags: ["Waterfalls", "Reopened 2025", "All Ages"],
        mapQuery: "George W Childs Recreation Site Dingmans Ferry PA",
      },
      {
        name: "Big Pocono State Park",
        description:
          "The summit of Camelback without the lift ticket: drive to the top for a three-state panorama, sunset picnics, and short rim trails. The summit road closes for winter — it's a spring-through-fall move.",
        image: img("photo-1465056836041-7f43ac27dcb5"),
        distance: "25 min",
        tags: ["Drive-Up Views", "Sunsets", "Picnic"],
        mapQuery: "Big Pocono State Park Tannersville PA",
      },
      {
        name: "Hickory Run State Park",
        description:
          "Home of the surreal 16-acre glacial Boulder Field, the Hawk Falls mini-hike, and the Shades of Death trail (scarier name than hike). Summer weekends get slammed — make it an early or midweek trip, and cool off at Sand Spring Lake.",
        image: img("photo-1441974231531-c6227db76b6e"),
        distance: "40 min",
        tags: ["Boulder Field", "Hawk Falls", "Go Midweek"],
        website: "https://www.dcnr.pa.gov/StateParks/FindAPark/HickoryRunStatePark",
        mapQuery: "Hickory Run State Park PA",
      },
      {
        name: "Pocono Environmental Education Center",
        description:
          "PEEC's Tumbling Waters trail ends at a falls where kids can wade at the bottom, the nature center is a great rainy-hour stop, and in winter they lend snowshoes for free. Check their calendar — the family programs are legitimately good.",
        image: img("photo-1502082553048-f009c37129b9"),
        distance: "25 min",
        tags: ["Family", "Nature Center", "Free Snowshoes"],
        website: "https://www.peec.org",
        mapQuery: "Pocono Environmental Education Center Dingmans Ferry PA",
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
        name: "The Delaware River",
        description:
          "Fifteen minutes away: Smithfield Beach is the sanctioned river swim — sandy shoreline, lifeguards in season, small fee. Rent kayaks, canoes, or tubes from Edge of the Woods in town (summer weekends sell out — reserve), and use the free Saturday–Sunday river shuttle to float one-way. Go early on summer weekends.",
        image: img("photo-1506905925346-21bda4d32df4"),
        distance: "15 min",
        tags: ["Swimming", "Tubing", "Paddling"],
        mapQuery: "Smithfield Beach Delaware Water Gap PA",
      },
      {
        name: "Promised Land State Park",
        description:
          "The swim beach locals actually vouch for — clean lake, forest all around, 50 miles of trails from lakeside strolls to backcountry. If it's busy, the quieter beaches at Tobyhanna and Gouldsboro state parks are the fallback.",
        image: img("photo-1426604966848-d7adac402bff"),
        distance: "35 min",
        tags: ["Swim Beach", "Hiking", "Peaceful"],
        mapQuery: "Promised Land State Park PA",
      },
      {
        name: "Lake Wallenpaupack",
        description:
          "The big one — 5,700 acres with 52 miles of shoreline. Rent pontoons, jet skis, or kayaks, or take a scenic boat cruise. Make a day of it with drinks at Glass Wine Bar in Hawley on the way back.",
        image: img("photo-1444044205806-38f3ed106c10"),
        distance: "40 min",
        tags: ["Boating", "Pontoons", "Day Trip"],
        website: "https://www.wallenpaupack.com",
        mapQuery: "Lake Wallenpaupack PA",
      },
      {
        name: "Lehigh River Rafting",
        description:
          "Class II-III whitewater through the Lehigh Gorge. Book a dam-release weekend for the real rapids — outfitters in Jim Thorpe run guided trips spring through fall.",
        image: img("photo-1504196606672-aef5c9cefc92"),
        distance: "45 min",
        tags: ["Adventure", "Rafting", "Dam Releases"],
        website: "https://www.poconowhitewater.com",
        mapQuery: "Lehigh River Whitewater Rafting Jim Thorpe PA",
      },
      {
        name: "Fishing the Poconos",
        description:
          "World-class trout water starts at Brodhead Creek, minutes from the houses, with bass lakes and walleye reservoirs beyond. PA license required off-property — but remember the stocked catch-and-release lake right off your dock needs nothing.",
        image: img("photo-1504309092620-4d0ec726efa4"),
        tags: ["Fishing", "Brodhead Creek", "Year-Round"],
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
          "The Poconos' biggest ski area — 39 trails, 16 lifts, and the largest snow tubing park in the US with 42 lanes (book the first morning slot; holiday-weekend tubing lines get brutal). Also home to Camelback Lodge & Aquatopia indoor waterpark.",
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
      {
        name: "Sledding & Snowshoeing, Locals' Edition",
        description:
          "Skip the resort lines after a snowfall: the free sledding hills locals use are right in Stroudsburg (the big one at Wesleyan Church on N 5th St, another behind the junior high). For snowshoeing, PEEC lends snowshoes free — the McDade Trail in snow is the quiet winter walk.",
        image: img("photo-1478265409131-1f65c88f965c"),
        distance: "15 min",
        tags: ["Free", "Sledding", "Snowshoeing"],
        mapQuery: "Stroudsburg Wesleyan Church PA",
      },
      {
        name: "Snowmobile & Winter ATV Tours",
        description:
          "Guided snowmobile rentals and winter ATV tours run all season at outfitters around Pocono Manor and Lake Harmony — most offer 1–2 hour guided rides, no experience needed. Book ahead on snowy weekends; machines sell out fast.",
        image: img("photo-1517299321609-52687d1bc55a"),
        distance: "20-35 min",
        tags: ["Snowmobiling", "Guided Tours", "Winter"],
        mapQuery: "snowmobile tours Pocono PA",
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
        name: "Farmhouse Eatery",
        description:
          "All-day brunch seven days a week, made from scratch — the Crystal Street spot in East Stroudsburg is ten minutes from our homes (sister locations on Main Street and Fox Run). A Pocono Record \"Best Brunch\" winner, and it earns it.",
        image: img("photo-1504674900247-0877df9cc836"),
        distance: "10 min",
        tags: ["Brunch", "All-Day", "Local Favorite"],
        website: "https://farmhousepoconos.com",
        mapQuery: "Farmhouse Eatery Crystal Street East Stroudsburg PA",
      },
      {
        name: "Compton's Pancake House",
        description:
          "The Poconos' breakfast institution — a menu of pancakes that runs from banana-nut to cheesecake, at diner prices, from 6 AM. Expect a weekend wait, and note it's closed Tuesdays.",
        image: img("photo-1528207776546-365bb710ee93"),
        distance: "15 min",
        tags: ["Breakfast", "Pancakes", "Institution"],
        website: "https://www.comptonspancakehouse.com",
        mapQuery: "Compton's Pancake House Stroudsburg PA",
      },
      {
        name: "The Cure Cafe",
        description:
          "From-scratch breakfast and lunch on Main Street with the best gluten-free and vegan range in town — and it doesn't taste like a compromise. A true locals' room.",
        image: img("photo-1482049016688-2d3e1b311543"),
        distance: "15 min",
        tags: ["Cafe", "Gluten-Free", "Vegan-Friendly"],
        mapQuery: "The Cure Cafe Stroudsburg PA",
      },
      {
        name: "Sarah Street Grill",
        description:
          "Thirty years running and still the town's reliable night out — surprisingly serious sushi, live music six nights a week, a deck for summer, and a game room for the kids.",
        image: img("photo-1579584425555-c3ce17fd4351"),
        distance: "15 min",
        tags: ["Sushi", "Live Music", "Deck"],
        website: "https://www.sarahstreetgrill.com",
        mapQuery: "Sarah Street Grill Stroudsburg PA",
      },
      {
        name: "Newberry's Yard of Ale",
        description:
          "The biggest craft-beer list in Stroudsburg, a hidden speakeasy behind the bar, and a basement of vintage arcade games. Dog-friendly patio out front. Yes, all one place.",
        image: img("photo-1535958636474-b021ee887b13"),
        distance: "15 min",
        tags: ["Craft Beer", "Speakeasy", "Arcade"],
        website: "https://www.newberrysyardofale.com",
        mapQuery: "Newberry's Yard of Ale Stroudsburg PA",
      },
      {
        name: "Village Farmer & Bakery",
        description:
          "The famous hot dog + slice of apple pie combo (about five bucks) in Delaware Water Gap, with the pies rolled out behind glass while you watch. Zero pretense, all-day line for a reason.",
        image: img("photo-1535920527002-b35e96722eb9"),
        distance: "15 min",
        tags: ["Bakery", "Apple Pie", "Cheap Eats"],
        website: "http://www.villagefarmerbakery.com",
        mapQuery: "Village Farmer and Bakery Delaware Water Gap PA",
      },
      {
        name: "ShawneeCraft Brewing",
        description:
          "Taproom and beer garden at the old Shawnee Inn — fire pits, axe throwing, shuffleboard, wood-fired pizza, and live music Thursday through Sunday. The easy 'we don't feel like cooking' night.",
        image: img("photo-1513104890138-7c749659a591"),
        distance: "15 min",
        tags: ["Brewery", "Beer Garden", "Wood-Fired Pizza"],
        website: "https://www.shawneecraft.com",
        mapQuery: "ShawneeCraft Brewing Shawnee on Delaware PA",
      },
      {
        name: "Barley Creek Brewing",
        description:
          "A Pocono landmark since 1995, a mile from Camelback — the après-ski default. Get the five-glass sampler flight and grab the 'Pint-Sized Park' lawn in summer. Weekends get packed.",
        image: img("photo-1559526324-593bc073d938"),
        distance: "15 min",
        tags: ["Brewery", "Après-Ski", "Live Music"],
        website: "https://www.barleycreek.com",
        mapQuery: "Barley Creek Brewing Company Tannersville PA",
      },
      {
        name: "Glass Wine Bar at Ledges Hotel",
        description:
          "An 1890 bluestone glass factory hanging over the falls gorge in Hawley. Go for cocktails and small plates on the deck at sunset — pair it with a Lake Wallenpaupack day.",
        image: img("photo-1470337458703-46ad1756a187"),
        distance: "45 min",
        tags: ["Cocktails", "Waterfall Views", "Date Night"],
        website: "https://www.ledgeshotel.com",
        mapQuery: "Glass Wine Bar Ledges Hotel Hawley PA",
      },
      {
        name: "Desaki",
        description:
          "The big-production hibachi show — flames, tricks, and a full night's entertainment for groups. Budget $70–80 a head and book ahead; it fills up with birthday parties for a reason.",
        image: img("photo-1552566626-52f8b828add9"),
        distance: "20 min",
        tags: ["Hibachi", "Groups", "Book Ahead"],
        website: "https://www.desaki.us",
        mapQuery: "Desaki Restaurant Swiftwater PA",
      },
      {
        name: "The Pocono Wine Trail",
        description:
          "Three tasting rooms within a half hour: Blue Ridge Estate (360° vineyard views, free cellar tours), Sorrenti's Cherry Valley (pouring since 1981), and Mountain View — the Poconos' only winery, brewery, and distillery in one.",
        image: img("photo-1506377247377-2a5b3b417ebb"),
        distance: "20-30 min",
        tags: ["Wineries", "Tastings", "Rainy Day"],
        mapQuery: "Blue Ridge Estate Winery Saylorsburg PA",
      },
      {
        name: "Sweet Creams Cafe",
        description:
          "A charming Main Street cafe serving breakfast, lunch, espresso, and house-made ice cream. Heads up: closed Mondays and Tuesdays, short hours midweek — it's a weekend stop.",
        image: img("photo-1501339847302-ac426a4a7cbb"),
        distance: "15 min",
        tags: ["Coffee", "Ice Cream", "Weekends"],
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
          "A walkable main street packed with independent boutiques, galleries, and cafes. Don't miss Olde Engine Works — a 22,000 sq ft antique marketplace with ~100 vendors — and the Saturday-morning farmers market at Courthouse Square. Live music up and down the street most nights.",
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
            name: "Highland Lake",
            description:
              "The social lake. A sandy swimming beach, dancing fountains on the water, and a picnic area with BBQ grills — bring the charcoal and make a day of it.",
            image: img("photo-1500964757637-c85e8a162699"),
            tags: ["Swimming", "Beach", "BBQ Grills", "Picnic"],
            mapQuery: "Highland Lake Penn Estates East Stroudsburg PA",
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
    // (was photo-1486572788966 — a video-game controller, not snow)
    image: img("photo-1512273222628-4daea6e55abb", 2000),
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
