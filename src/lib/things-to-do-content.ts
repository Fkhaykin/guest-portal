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

// Real place photography, self-hosted (sourced from Wikimedia Commons — see
// IMAGE_CREDITS; attribution required by the CC licenses).
export const guideImg = (name: string) =>
  `https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/guide/${name}.jpg`;

export type ImageCredit = { subject: string; author: string; license: string; url: string };

export const IMAGE_CREDITS: ImageCredit[] = [
  { subject: "McDade Trail", author: "Bold Frontiers", license: "CC BY 2.0", url: "https://www.flickr.com/photos/boldfrontiers/" },
  { subject: "Hornbeck's Creek", author: "olekinderhook", license: "CC BY 3.0", url: "https://commons.wikimedia.org/wiki/File:Water_falling_on_Hornbeck%27s_Creek_-_panoramio.jpg" },
  { subject: "Jack Frost Mountain", author: "Rhys A.", license: "CC BY 2.0", url: "https://www.flickr.com/photos/rhysasplundh/" },
  { subject: "Great Wolf Lodge Poconos", author: "Vox Efx", license: "CC BY 2.0", url: "https://www.flickr.com/photos/vox_efx/" },
  { subject: "Pocono Raceway", author: "DReifGalaxyM31", license: "CC BY 3.0", url: "https://commons.wikimedia.org/wiki/File:Aerial_view_of_Pocono_Raceway.JPG" },
  { subject: "Raymondskill Falls", author: "G. Edward Johnson", license: "CC BY 4.0", url: "https://commons.wikimedia.org/wiki/File:Long_exposure_of_Raymondskill_Falls_PA_2025-09-29_14-27-40.jpg" },
  { subject: "Childs Park", author: "Nicholas A. Tonelli", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Flickr_-_Nicholas_T_-_Split.jpg" },
  { subject: "Delaware Water Gap from Mt. Tammany", author: "Famartin", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:2013-08-20_11_50_58_View_of_the_Delaware_Water_Gap_from_about_720_feet_on_the_Mount_Tammany_Trail.jpg" },
  { subject: "Mount Minsi", author: "Nicholas A. Tonelli", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Mount_Minsi.jpg" },
  { subject: "Boulder Field, Hickory Run", author: "Nicholas A. Tonelli", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Rocky_Boulder_Field,_Hickory_Run_State_Park.jpg" },
  { subject: "Big Pocono State Park", author: "Dough4872", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Big_Pocono_State_Park_view_south_from_Camelback_Mountain.jpg" },
  { subject: "Promised Land State Park", author: "Nicholas A. Tonelli", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Promised_Land_State_Park_(1).jpg" },
  { subject: "Lake Wallenpaupack", author: "Doug Kerr", license: "CC BY-SA 2.0", url: "https://commons.wikimedia.org/wiki/File:Lake_Wallenpaupack,_Pennsylvania_(4095488190).jpg" },
  { subject: "Lehigh Gorge rafting", author: "Thekohser", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Jim_Thorpe_River_Adventures_rafts_at_Glen_Onoko.jpg" },
  { subject: "Brodhead Creek", author: "AshleyLiz231", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Brodhead_Creek.jpg" },
  { subject: "Camelback Mountain", author: "Jkarps", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Camelback_Ski_Area_Feb_2014.JPG" },
  { subject: "Jim Thorpe station", author: "Fabartus", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:FAB%27s_IMG_4669_Train_Station_1blk_From_LC%26N-Corp-HQ_Mauch_Chunk-Jim_Thorpe,PA.JPG" },
];


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
        name: "ForEvergreen Nature Preserve",
        description:
          "Literally outside the Penn Estates gate in Analomink: 42 acres of restored meadow and woods with a mile-long, stroller-friendly gravel loop down to the Brodhead Creek — the stretch where American trout fishing was born. Open dawn to dusk, free, and the perfect first-morning leg-stretcher.",
        image: img("photo-1502082553048-f009c37129b9"),
        distance: "5 min",
        tags: ["Outside the Gate", "Easy Loop", "Free"],
        website: "https://brodheadwatershed.org/forevergreen-nature-preserve/",
        mapQuery: "ForEvergreen Nature Preserve Analomink PA",
      },
      {
        name: "Brodhead Greenway: Creek Park & Pinebrook",
        description:
          "The green backbone of Stroud Township: Brodhead Creek Park's 30 creekside acres connect by a flat 1.5-mile gravel path to Pinebrook Park — picnic tables, grills, catch-and-release fishing, and the Levee Loop at the Stokes Mill end. Dog-friendly the whole way; snowshoe or cross-country ski it in winter. Small non-resident fee at Creek Park in summer (waived with a PA fishing license).",
        image: img("photo-1473448912268-2022ce9509d8"),
        distance: "10 min",
        tags: ["Creekside", "Dog-Friendly", "Flat Trail"],
        mapQuery: "Brodhead Creek Park East Stroudsburg PA",
      },
      {
        name: "Gregory's Pond Park",
        description:
          "The town secret hiding right behind the Wendy's: sixteen quiet acres beside Terra Greens golf course, with a mile of gentle gravel loop around a catch-and-release pond, a gazebo on the water, and leashed dogs welcome. Free, year-round — the easy evening walk when nobody wants a 'hike.' (Zacharias Pond off Chipperfield is the same idea with a playground.)",
        image: img("photo-1444492417251-9c84a5fa18e0"),
        distance: "15 min",
        tags: ["Pond Loop", "Free", "Easy"],
        mapQuery: "Gregory's Pond Park East Stroudsburg PA",
      },
      {
        name: "Mt. Minsi via the Appalachian Trail",
        description:
          "The closest real hike to the houses — a 5-mile loop on the PA side of the Water Gap with river views the whole climb, and a fraction of Tammany's crowds. Park in Delaware Water Gap borough if the small Lake Lenape lot is full, and cap it with pizza at ShawneeCraft.",
        image: guideImg("minsi"),
        distance: "10 min",
        tags: ["Hiking", "River Views", "Quieter"],
        mapQuery: "Mount Minsi Trailhead Delaware Water Gap PA",
      },
      {
        name: "Mt. Tammany & the Water Gap",
        description:
          "The marquee Gap hike: up the red-dot trail, down the blue-dot, about 3.5 steep miles to THE view of the river bend. The lots fill by 8 AM on nice weekends — go early, go midweek, or hike Minsi instead.",
        image: guideImg("tammany"),
        distance: "15 min",
        tags: ["Hiking", "Iconic View", "Go Early"],
        website: "https://www.nps.gov/dewa",
        mapQuery: "Mount Tammany Trailhead NJ",
      },
      {
        name: "McDade Trail",
        description:
          "Thirty-two miles of smooth riverside trail inside the national recreation area, with trailheads starting ten minutes from the houses. Walk a stretch, bike it, or use it for the low-effort fall-color fix — flat, marked, and never fully crowded.",
        image: guideImg("mcdade"),
        distance: "10-25 min",
        tags: ["Walking", "Biking", "Riverside"],
        mapQuery: "McDade Recreational Trail Smithfield Beach Trailhead PA",
      },
      {
        name: "Bushkill Falls",
        description:
          'The "Niagara of Pennsylvania" — eight falls strung together with wooden bridges through hemlock gorges. It\'s paid admission (~$20) and popular: a 9 AM weekday start on the red trail gets you the gorge nearly alone. Lots of stairs, so no strollers.',
        image: guideImg("bushkill-host"),
        distance: "25 min",
        tags: ["Waterfalls", "Family", "Go Early"],
        website: "https://www.visitbushkillfalls.com",
        mapQuery: "Bushkill Falls PA",
      },
      {
        name: "Raymondskill Falls",
        description:
          "Pennsylvania's tallest waterfall, and it's free — a short staircase trail to the lookouts, no ticket booth in sight. Weekdays are best in October. Even closer to home, Resica Falls off Route 402 needs no hike at all.",
        image: guideImg("raymondskill"),
        distance: "30 min",
        tags: ["Waterfalls", "Free", "Tallest in PA"],
        mapQuery: "Raymondskill Falls Milford PA",
      },
      {
        name: "Hornbecks Creek / Indian Ladders",
        description:
          "The quiet one the internet hasn't ruined: a couple of creekside miles over little footbridges to a stacked pair of waterfalls. You'll pass more chipmunks than people. Kids love the bridges; the last stretch is a scramble.",
        image: guideImg("hornbecks"),
        distance: "25 min",
        tags: ["Hidden Gem", "Waterfalls", "Quiet"],
        mapQuery: "Hornbecks Creek Trail Dingmans Ferry PA",
      },
      {
        name: "George W. Childs Park",
        description:
          "Three waterfalls — Factory, Fulmer, and Deer Leap — freshly reopened in 2025 after years of trail rebuilding. Accessible paths along the top, stairs down to the good views. An easy win with mixed-age groups.",
        image: guideImg("childs"),
        distance: "35 min",
        tags: ["Waterfalls", "Reopened 2025", "All Ages"],
        mapQuery: "George W Childs Recreation Site Dingmans Ferry PA",
      },
      {
        name: "Big Pocono State Park",
        description:
          "The summit of Camelback without the lift ticket: drive to the top for a three-state panorama, sunset picnics, and short rim trails. The summit road closes for winter — it's a spring-through-fall move.",
        image: guideImg("bigpocono"),
        distance: "25 min",
        tags: ["Drive-Up Views", "Sunsets", "Picnic"],
        mapQuery: "Big Pocono State Park Tannersville PA",
      },
      {
        name: "Hickory Run State Park",
        description:
          "Home of the surreal 16-acre glacial Boulder Field, the Hawk Falls mini-hike, and the Shades of Death trail (scarier name than hike). Summer weekends get slammed — make it an early or midweek trip, and cool off at Sand Spring Lake.",
        image: guideImg("boulderfield"),
        distance: "40 min",
        tags: ["Boulder Field", "Hawk Falls", "Go Midweek"],
        website: "https://www.dcnr.pa.gov/StateParks/FindAPark/HickoryRunStatePark",
        mapQuery: "Hickory Run State Park PA",
      },
      {
        name: "Pocono Environmental Education Center",
        description:
          "PEEC's Tumbling Waters trail ends at a falls where kids can wade at the bottom, the nature center is a great rainy-hour stop, and in winter they lend snowshoes for free. Check their calendar — the family programs are legitimately good.",
        image: guideImg("peecfalls"),
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
          "Fifteen minutes away: Smithfield Beach is the sanctioned river swim — sandy shoreline, lifeguards in season, small fee. Rent kayaks, canoes, or tubes from family-run Chamberlain Canoes or Edge of the Woods (summer weekends sell out — reserve), and use the free weekend river shuttle to float one-way. Go early on summer weekends.",
        image: guideImg("tammany"),
        distance: "15 min",
        tags: ["Swimming", "Tubing", "Paddling"],
        mapQuery: "Smithfield Beach Delaware Water Gap PA",
      },
      {
        name: "Promised Land State Park",
        description:
          "The swim beach locals actually vouch for — clean lake, forest all around, 50 miles of trails from lakeside strolls to backcountry. If it's busy, the quieter beaches at Tobyhanna and Gouldsboro state parks are the fallback.",
        image: guideImg("promisedland"),
        distance: "35 min",
        tags: ["Swim Beach", "Hiking", "Peaceful"],
        mapQuery: "Promised Land State Park PA",
      },
      {
        name: "Lake Wallenpaupack",
        description:
          "The big one — 5,700 acres with 52 miles of shoreline. Rent pontoons, jet skis, or kayaks, or take a scenic boat cruise. Make a day of it with drinks at Glass Wine Bar in Hawley on the way back.",
        image: guideImg("wallenpaupack"),
        distance: "40 min",
        tags: ["Boating", "Pontoons", "Day Trip"],
        website: "https://www.wallenpaupack.com",
        mapQuery: "Lake Wallenpaupack PA",
      },
      {
        name: "Lehigh River Rafting",
        description:
          "Class II-III whitewater through the Lehigh Gorge. Book a dam-release weekend for the real rapids — outfitters in Jim Thorpe run guided trips spring through fall.",
        image: guideImg("lehigh"),
        distance: "45 min",
        tags: ["Adventure", "Rafting", "Dam Releases"],
        website: "https://www.poconowhitewater.com",
        mapQuery: "Lehigh River Whitewater Rafting Jim Thorpe PA",
      },
      {
        name: "Fishing the Poconos",
        description:
          "World-class trout water starts at Brodhead Creek, minutes from the houses, with bass lakes and walleye reservoirs beyond. PA license required off-property — but remember the stocked catch-and-release lake right off your dock needs nothing.",
        image: guideImg("brodhead"),
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
        image: guideImg("camelback"),
        distance: "25 min",
        tags: ["Skiing", "Tubing", "Waterpark"],
        website: "https://www.camelbackresort.com",
        mapQuery: "Camelback Mountain Resort Tannersville PA",
      },
      {
        name: "Jack Frost Big Boulder",
        description:
          "Two mountains, one ticket. Jack Frost has great intermediate terrain while Big Boulder is the terrain park paradise for snowboarders. Night skiing available.",
        image: guideImg("jackfrost"),
        distance: "20 min",
        tags: ["Skiing", "Snowboarding", "Night Skiing"],
        website: "https://www.jfbb.com",
        mapQuery: "Jack Frost Big Boulder PA",
      },
      {
        name: "Shawnee Mountain",
        description:
          "Family-friendly slopes with 23 trails and a great ski school for beginners. Smaller crowds, lower prices, and a charming lodge at the base.",
        image: guideImg("shawnee-host"),
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
        name: "Winter UTV Tours",
        description:
          "Honest local intel: nobody publicly rents snowmobiles in the Poconos anymore. The winter thrill-ride that does exist is a guided UTV tour with Pocono Outdoor Adventure Tours near the Raceway — enclosed side-by-sides, runs year-round including snow days, and kids 5+ can ride along.",
        image: guideImg("atv"),
        distance: "25 min",
        tags: ["UTV", "Guided", "Kids Ride Along"],
        mapQuery: "Pocono Outdoor Adventure Tours Pocono Manor PA",
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
        name: "Pocono TreeVentures & Zip Racer",
        description:
          "Practically at the doorstep in East Stroudsburg — eight treetop ropes courses with 90+ elements, a KidVentures course for ages 4–7, and 1,000-foot side-by-side racing ziplines. The easy 'we did something big today' morning.",
        image: img("photo-1516939884455-1445c8652f83"),
        distance: "10 min",
        tags: ["Ropes Course", "Ages 4+", "Ziplines"],
        website: "https://www.poconotreeventures.com",
        mapQuery: "Pocono TreeVentures East Stroudsburg PA",
      },
      {
        name: "Camelback Mountain Adventures",
        description:
          "PA's only alpine mountain coaster (worth every penny), a 4,000-foot zipflyer, treetop courses, and summer tubing on the ski hill. Buy tickets online — it's cheaper than the window — and expect a parking fee.",
        image: guideImg("camelbackadv"),
        distance: "25 min",
        tags: ["Mountain Coaster", "Zipflyer", "Book Online"],
        website: "https://www.camelbackmountainadventures.com",
        mapQuery: "Camelback Mountain Adventures Tannersville PA",
      },
      {
        name: "ATV & UTV Tours",
        description:
          "The real outfitters, named: Pocono ATV Tours at Memorytown for ~50-minute guided rides, and Pocono Outdoor Adventure Tours near the Raceway for year-round guided UTV — kids 5+ can ride along. Alvin's Off-Road Playground in Long Pond is the bigger-terrain option.",
        image: guideImg("atv"),
        distance: "20-30 min",
        tags: ["ATV", "UTV", "Guided"],
        mapQuery: "Pocono ATV Tours Memorytown Mount Pocono PA",
      },
      {
        name: "Horseback Trail Rides",
        description:
          "Bushkill Riding Stables is the close one — about fifteen minutes out, with guided rides through the woods. Mountain Creek Riding Stable in Cresco runs beginner trail rides seven days a week year-round, snow included, plus pony and wagon rides for the littlest crew members.",
        image: guideImg("horseback-host"),
        distance: "15 min",
        tags: ["Trail Rides", "Beginners", "Year-Round"],
        website: "https://mtcreekstable.com",
        mapQuery: "Mountain Creek Riding Stable Cresco PA",
      },
      {
        name: "Claws 'N' Paws Wild Animal Park",
        description:
          "An interactive zoo with over 120 species — feed giraffes, hold parrots, catch the live shows (open May through fall). Closer to home, the little Pocono Snake & Animal Farm in Marshalls Creek is a fun 45-minute starter zoo for small kids, ten minutes away.",
        image: img("photo-1547721064-da6cfb341d50"),
        distance: "40 min",
        tags: ["Family", "Animals", "Interactive"],
        website: "https://www.clawsnpaws.com",
        mapQuery: "Claws N Paws Wild Animal Park PA",
      },
      {
        name: "Paintball: Skirmish or the Asylum",
        description:
          "Skirmish USA is the world-famous one — 750 acres, 50+ fields with castles and tanks; make it an all-day thing, pre-sign waivers online, and budget 500+ paintballs each. Want casual and close? The Paintball Asylum by Camelback runs laid-back three-hour sessions on 30 wooded acres.",
        image: guideImg("skirmish"),
        distance: "20-40 min",
        tags: ["Paintball", "Groups", "All Day or Casual"],
        mapQuery: "Skirmish Paintball Albrightsville PA",
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
        image: guideImg("comptons"),
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
        image: guideImg("shawneecraft"),
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
        image: guideImg("ledges"),
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
        image: guideImg("downtown-host"),
        distance: "20 min",
        tags: ["Boutiques", "Galleries", "Walkable"],
        mapQuery: "Main Street Stroudsburg PA",
      },
      {
        name: "Pocono Premium Outlets",
        description:
          "Over 100 brand-name outlet stores including Nike, Coach, J.Crew, and more — renovated and renamed (locals still say \"the Crossings\"). A rainy-day lifesaver with deals year-round.",
        image: guideImg("outlets-host"),
        distance: "25 min",
        tags: ["Outlets", "Brands", "Deals"],
        website: "https://www.premiumoutlets.com/outlet/pocono",
        mapQuery: "Pocono Premium Outlets Tannersville PA",
      },
      {
        name: "Jim Thorpe",
        description:
          'Called the "Switzerland of America" — this historic Victorian town has unique shops, art galleries, the Lehigh Gorge trail, and the Old Jail Museum. Stunning fall foliage.',
        image: guideImg("jimthorpe"),
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
        name: "Rainy Day, Main Street Edition",
        description:
          "Stroudsburg has the wet-weather day covered: Klues Escape Room on Main Street (a 4.9-star crowd-pleaser that scales from kids to adults), Big Wheel Roller Skating in East Stroudsburg (spinning since 1977), and the Pocono Cinema art house in an 1884 building. All within fifteen minutes.",
        image: img("photo-1486572788966-cfd3df1f5b42"),
        distance: "10-15 min",
        tags: ["Escape Room", "Roller Rink", "Art House Cinema"],
        mapQuery: "Klues Escape Room Stroudsburg PA",
      },
      {
        name: "Great Wolf Lodge",
        description:
          "The indoor waterpark for the under-8 crowd — wave pools, mini bowling, and relentless kid programming (freshly renovated top to bottom). Limited day passes from ~$35 sell out, so book ahead — and brace for the upcharge add-ons.",
        image: guideImg("greatwolf"),
        distance: "20 min",
        tags: ["Waterpark", "Under-8s", "Day Passes"],
        website: "https://www.greatwolf.com/poconos",
        mapQuery: "Great Wolf Lodge Scotrun PA",
      },
      {
        name: "Kalahari Resort Waterpark",
        description:
          "America's largest indoor waterpark — the pick once kids outgrow Great Wolf. Peak summer weekends are packed and pricey; the magic move is a midweek off-season day, near-empty at the same park. Local tip: the massive arcade doesn't require a waterpark pass. Budget alternative: Split Rock's H2Oooohh in Lake Harmony, around $30 and never crowded.",
        image: img("photo-1581873372796-635b67ca2008"),
        distance: "30 min",
        tags: ["Waterpark", "Big Kids", "Go Midweek"],
        website: "https://www.kalahariresorts.com/poconos",
        mapQuery: "Kalahari Resort Poconos PA",
      },
      {
        name: "Mount Airy Casino Resort",
        description:
          "Now a 21-and-over resort — which makes it the grown-ups' escape: 1,800 slots, table games, live shows, and a serious spa. Leave the kids at the house game room and make it a date night.",
        image: img("photo-1511882150382-421056c89033"),
        distance: "15 min",
        tags: ["21+ Only", "Casino", "Date Night"],
        website: "https://www.mountairycasino.com",
        mapQuery: "Mount Airy Casino Resort PA",
      },
      {
        name: "Pocono Raceway",
        description:
          'The "Tricky Triangle" NASCAR track. Race weekends are an event (plan around the traffic — locals avoid Route 115 entirely); the rest of the season you can book a stock-car ride-along at 145 mph, ages 14 and up.',
        image: guideImg("raceway"),
        distance: "35 min",
        tags: ["NASCAR", "Ride-Alongs", "Seasonal"],
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
        image: guideImg("woodloch"),
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
      "A gated, 1,200-acre community in the heart of the Poconos — three lakes, two Olympic pools, and freshly rebuilt courts and fields for every sport a few steps from your door.",
    hero: guideImg("pe-basketball-wide"),
    gradient: "from-emerald-900 via-teal-700 to-green-400",
    mapQuery: "Penn Estates East Stroudsburg PA",
    stats: [
      { num: "3", label: "Community lakes" },
      { num: "2", label: "Olympic pools" },
      { num: "8", label: "Courts & fields" },
    ],
    groups: [
      {
        key: "sports",
        title: "Courts & Fields",
        subtitle: "Freshly rebuilt, and all included with your stay",
        icon: Trophy,
        items: [
          {
            name: "Tennis & Pickleball Courts",
            description:
              "Resurfaced hard courts with dedicated pickleball nets alongside the tennis — bring rackets or paddles, or both.",
            image: guideImg("pe-courts"),
            tags: ["Tennis", "Pickleball"],
            mapQuery: "Penn Estates tennis court East Stroudsburg PA",
          },
          {
            name: "Basketball Courts",
            description:
              "Full courts with fresh surfaces, new hoops, and bleachers for the spectators. Bring a ball and run it.",
            image: guideImg("pe-basketball"),
            tags: ["Full Court", "Pickup"],
            mapQuery: "Penn Estates basketball court East Stroudsburg PA",
          },
          {
            name: "Baseball Field",
            description:
              "A real diamond with a backstop, tucked into the woods — glove-and-catch territory, or get an actual game going.",
            image: guideImg("pe-baseball"),
            tags: ["Diamond", "Backstop"],
            mapQuery: "Penn Estates baseball field East Stroudsburg PA",
          },
          {
            name: "Soccer Field",
            description:
              "An open grass pitch with goals up all season — doubles as frisbee, flag-football, and run-the-kids-tired space.",
            image: guideImg("pe-soccer"),
            tags: ["Open Play", "Grass"],
            mapQuery: "Penn Estates soccer field East Stroudsburg PA",
          },
          {
            name: "Sand Volleyball",
            description:
              "A proper sand court for a sunset match — nets up all summer, steps from the fitness stations.",
            image: guideImg("pe-volleyball"),
            tags: ["Sand", "Groups"],
            mapQuery: "Penn Estates volleyball East Stroudsburg PA",
          },
          {
            name: "Wallball Court",
            description:
              "A dedicated handball and wallball wall on its own painted court — endlessly useful for solo practice too.",
            image: guideImg("pe-wallball"),
            tags: ["Handball", "Wallball"],
            mapQuery: "Penn Estates wallball court East Stroudsburg PA",
          },
          {
            name: "Outdoor Fitness Stations",
            description:
              "An al-fresco circuit of fitness equipment next to the volleyball court — morning workout with a forest view.",
            image: guideImg("pe-fitness"),
            tags: ["Fitness", "Free"],
            mapQuery: "Penn Estates fitness stations East Stroudsburg PA",
          },
          {
            name: "Horseshoe Pits",
            description:
              "Brand-new wooden horseshoe pits along the tree line — the lawn game that turns into a tournament by Sunday.",
            image: guideImg("pe-horseshoes"),
            tags: ["Lawn Games", "New"],
            mapQuery: "Penn Estates horseshoe pits East Stroudsburg PA",
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
            image: guideImg("pe-highland-lake"),
            tags: ["Swimming", "Beach", "BBQ Grills", "Picnic"],
            mapQuery: "Highland Lake Penn Estates East Stroudsburg PA",
            featured: true,
          },
          {
            name: "Upper Twin Lake",
            description:
              "The quiet one. A picnic area tucked into the trees — great for a packed lunch or an early-morning coffee.",
            image: guideImg("pe-upper-twin"),
            tags: ["Picnic", "Quiet"],
            mapQuery: "Upper Twin Lake Penn Estates PA",
          },
          {
            name: "Lower Twin Lake",
            description:
              "Our lake. Every one of our houses sits on the water here — and it's where we keep the boats. Step out the back door and you're on the dock.",
            image: guideImg("pe-lower-twin"),
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
            image: guideImg("pe-pool"),
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
            image: guideImg("archies"),
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
    hero: "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368901/airbnb/28-backyard-image-1.jpg",
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
            image: guideImg("bml-lake"),
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
    image: guideImg("mcdade"),
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
