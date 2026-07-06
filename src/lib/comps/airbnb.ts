// Airbnb comp-set scraper. Two public endpoints (the same ones Airbnb's own
// web client calls anonymously):
//
//   1. PdpAvailabilityCalendar — 12 months of per-day availability + min-stay
//      for a listing. Persisted-query hash has been stable for years.
//   2. StaysPdpSections with the BOOK_IT_FLOATING_FOOTER section — the price
//      quote for a specific stay. Its hash rotates with Airbnb deploys, and
//      the variables payload is large — so both are discovered at runtime
//      from the listing page itself: the page HTML embeds the exact variables
//      in its Apollo cache key, and references the PdpPlatformRoute JS bundle
//      that contains the current operation hash.
//
// Volume stays tiny (one calendar call + a handful of price probes per comp
// per day) — this is calendar research on a hand-picked comp set, not bulk
// harvesting.

const AIRBNB_API_KEY = "d306zoyjsyarp7ifhu67rjxn52tv0t20"; // public key shipped in Airbnb's web client
const CALENDAR_HASH = "8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface CompCalendarDay {
  date: string;
  available: boolean;
  availableForCheckin: boolean;
  minNights: number;
}

export interface CompPriceQuote {
  checkIn: string;
  checkOut: string;
  nights: number;
  totalCents: number; // stay total shown on the book-it footer (before taxes breakdown)
  nightlyCents: number; // the "N nights x $X" accommodation line
}

/** Per-listing context for price probes, discovered from the listing page. */
export interface PdpContext {
  hash: string;
  variablesTemplate: Record<string, unknown>;
}

async function airbnbApi(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "X-Airbnb-API-Key": AIRBNB_API_KEY, "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Airbnb API ${res.status}`);
  return res.text();
}

function gqlUrl(operation: string, hash: string, variables: unknown): string {
  const v = encodeURIComponent(JSON.stringify(variables));
  const e = encodeURIComponent(
    JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } })
  );
  return `https://www.airbnb.com/api/v3/${operation}/${hash}?operationName=${operation}&locale=en&currency=USD&variables=${v}&extensions=${e}`;
}

export async function fetchCompCalendar(airbnbId: string): Promise<CompCalendarDay[]> {
  const now = new Date();
  const variables = {
    request: {
      count: 12,
      listingId: airbnbId,
      month: now.getUTCMonth() + 1,
      year: now.getUTCFullYear(),
    },
  };
  const body = await airbnbApi(gqlUrl("PdpAvailabilityCalendar", CALENDAR_HASH, variables));
  const data = JSON.parse(body) as {
    data?: {
      merlin?: {
        pdpAvailabilityCalendar?: {
          calendarMonths?: {
            days?: {
              calendarDate: string;
              available: boolean;
              availableForCheckin: boolean | null;
              minNights: number;
            }[];
          }[];
        };
      };
    };
  };
  const months = data.data?.merlin?.pdpAvailabilityCalendar?.calendarMonths;
  if (!months) throw new Error("Airbnb calendar: unexpected response shape");
  return months.flatMap((m) =>
    (m.days ?? []).map((d) => ({
      date: d.calendarDate,
      available: d.available,
      availableForCheckin: d.availableForCheckin ?? false,
      minNights: d.minNights,
    }))
  );
}

/** Fetch the listing page once and extract (a) the current StaysPdpSections
 *  operation hash from its route bundle, (b) the full variables template from
 *  the page's embedded Apollo cache key. Self-heals when Airbnb rotates
 *  hashes or reshapes the request.
 *
 *  When scraping many comps in one run, pass a `sharedHash` (from a previous
 *  call's ctx.hash) to skip the expensive ~180KB route-bundle fetch — the
 *  StaysPdpSections operation id is site-wide, only the variables template is
 *  per-listing. */
export async function discoverPdpContext(
  airbnbId: string,
  sharedHash?: string
): Promise<PdpContext> {
  const pageRes = await fetch(`https://www.airbnb.com/rooms/${airbnbId}`, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
  });
  if (!pageRes.ok) throw new Error(`Airbnb rooms page ${pageRes.status}`);
  const html = await pageRes.text();

  let hash = sharedHash;
  if (!hash) {
    const bundleMatch = html.match(
      /https:\/\/a0\.muscache\.com\/airbnb\/static\/packages\/web\/[^"]*PdpPlatformRoute\.[a-f0-9]+\.js/
    );
    if (!bundleMatch) throw new Error("Airbnb PDP bundle URL not found in page");
    const bundle = await (await fetch(bundleMatch[0], { headers: { "User-Agent": UA } })).text();
    const hashMatch = bundle.match(
      /name:'StaysPdpSections',type:'query',operationId:'([a-f0-9]{64})'/
    );
    if (!hashMatch) throw new Error("StaysPdpSections hash not found in bundle");
    hash = hashMatch[1];
  }

  // The page stores the SSR query's variables as an escaped JSON cache key.
  const doc = html.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const keyIdx = doc.indexOf("StaysPdpSections:{");
  if (keyIdx < 0) throw new Error("StaysPdpSections cache key not found in page");
  const frag = doc.slice(keyIdx + "StaysPdpSections:".length, keyIdx + 40000);
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = 0; i < frag.length; i++) {
    const ch = frag[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("StaysPdpSections cache key not parseable");
  const variablesTemplate = JSON.parse(frag.slice(0, end)) as Record<string, unknown>;

  return { hash, variablesTemplate };
}

export async function probeCompPrice(
  ctx: PdpContext,
  checkIn: string,
  checkOut: string
): Promise<CompPriceQuote | null> {
  const vars = JSON.parse(JSON.stringify(ctx.variablesTemplate)) as Record<string, unknown>;
  vars.dateRange = { startDate: checkIn, endDate: checkOut };
  const sectionsReq = vars.pdpSectionsRequest as Record<string, unknown> | undefined;
  if (sectionsReq) {
    sectionsReq.checkIn = checkIn;
    sectionsReq.checkOut = checkOut;
    sectionsReq.sectionIds = ["BOOK_IT_FLOATING_FOOTER"];
  }
  for (const key of Object.keys(vars)) {
    if (key.includes("BookIt")) vars[key] = true;
  }

  const body = await airbnbApi(gqlUrl("StaysPdpSections", ctx.hash, vars));

  // The accommodation line reads "N nights x $X" with the line total beside it.
  const lineMatch = body.match(
    /"description":"(\d+) nights? x \$([\d,]+(?:\.\d\d)?)","priceString":"\$([\d,]+(?:\.\d\d)?)"/
  );
  if (!lineMatch) return null; // dates not bookable (or Airbnb reshaped the payload)

  const toCents = (s: string) => Math.round(parseFloat(s.replace(/,/g, "")) * 100);
  const nights = parseInt(lineMatch[1], 10);
  return {
    checkIn,
    checkOut,
    nights,
    nightlyCents: toCents(lineMatch[2]),
    totalCents: toCents(lineMatch[3]),
  };
}

/** Tile the horizon with stay windows to price-probe, so a percentile band can
 *  be built for (almost) every night rather than a handful of sampled dates.
 *  Two windows per week — a Friday weekend pair (Fri+Sat nights) and a Sunday
 *  weekday block (Sun→Thu) — together cover all seven nights, and one probe's
 *  "N nights × $X" average nightly fills every night of its span. A window is
 *  emitted only if the whole span is open on the comp's calendar and the
 *  check-in day honors min-stay (we extend to min-stay, capped so we never
 *  probe an extreme long-stay-only window). Booked spans are simply skipped —
 *  other comps fill those nights, and a booked comp is an occupancy signal, not
 *  a price one. */
export function pickProbeWindows(
  days: CompCalendarDay[],
  opts: { horizonDays: number }
): { checkIn: string; checkOut: string }[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const horizon = days.slice(0, opts.horizonDays);
  const windows: { checkIn: string; checkOut: string }[] = [];

  // Wanted check-ins: Friday → 2-night weekend, Sunday → 5-night weekday block.
  const plan: { dow: number; targetNights: number }[] = [
    { dow: 5, targetNights: 2 },
    { dow: 0, targetNights: 5 },
  ];

  for (const day of horizon) {
    if (!day.available || !day.availableForCheckin) continue;
    const dow = new Date(day.date + "T00:00:00Z").getUTCDay();
    const want = plan.find((p) => p.dow === dow);
    if (!want) continue;
    // Honor min-stay, but never probe a window longer than 7 nights.
    const nights = Math.min(7, Math.max(want.targetNights, day.minNights));
    let open = true;
    let cursor = day.date;
    for (let n = 0; n < nights; n++) {
      if (!byDate.get(cursor)?.available) {
        open = false;
        break;
      }
      cursor = addDaysUtc(cursor, 1);
    }
    if (!open) continue;
    windows.push({ checkIn: day.date, checkOut: addDaysUtc(day.date, nights) });
  }
  return windows;
}

function addDaysUtc(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function jitterMs(min = 400, max = 1500): number {
  return Math.floor(min + Math.random() * (max - min));
}
