/**
 * Property addresses arrive from Lodgify street-name-first and comma-separated
 * ("Lakeside Drive, 484, East Stroudsburg, Pennsylvania, 18301"), which reads
 * wrong everywhere we show it to a human. Everything guest-, cleaner-, HOA-,
 * or host-facing should print through here instead: "484 Lakeside Dr, East
 * Stroudsburg, PA 18301".
 *
 * Anything that doesn't parse falls back to the raw string, so a hand-entered
 * address is passed through untouched rather than mangled.
 */

// Only the last word of a street line is abbreviated, and only if it's one of
// these. Directionals ("East Shore Dr") stay spelled out.
const STREET_SUFFIXES: Record<string, string> = {
  alley: "Aly",
  avenue: "Ave",
  boulevard: "Blvd",
  circle: "Cir",
  court: "Ct",
  cove: "Cv",
  crossing: "Xing",
  drive: "Dr",
  expressway: "Expy",
  extension: "Ext",
  heights: "Hts",
  highway: "Hwy",
  junction: "Jct",
  lane: "Ln",
  parkway: "Pkwy",
  place: "Pl",
  plaza: "Plz",
  point: "Pt",
  ridge: "Rdg",
  road: "Rd",
  route: "Rte",
  square: "Sq",
  street: "St",
  terrace: "Ter",
  trail: "Trl",
  turnpike: "Tpke",
};

const STATE_ABBR: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

const ZIP_RE = /^\d{5}(-\d{4})?$/;
// "484" or "484B" — a house number, as Lodgify stores it in its own field.
const HOUSE_NUMBER_RE = /^\d+[A-Za-z]?$/;

function abbreviateStreet(street: string): string {
  const words = street.split(/\s+/).filter(Boolean);
  if (words.length < 2) return street;
  const suffix = STREET_SUFFIXES[words[words.length - 1].toLowerCase().replace(/\.$/, "")];
  if (!suffix) return street;
  return [...words.slice(0, -1), suffix].join(" ");
}

function abbreviateState(state: string): string {
  if (/^[A-Za-z]{2}$/.test(state)) return state.toUpperCase();
  return STATE_ABBR[state.toLowerCase()] ?? state;
}

function isStateToken(part: string): boolean {
  return /^[A-Za-z]{2}$/.test(part) || STATE_ABBR[part.toLowerCase()] !== undefined;
}

export type ParsedAddress = {
  /** "484 Lakeside Dr" */
  street: string;
  /** "East Stroudsburg" */
  city: string | null;
  /** "PA" */
  state: string | null;
  /** "18301" */
  zip: string | null;
};

export function parseAddress(raw: string | null | undefined): ParsedAddress | null {
  if (!raw || !raw.trim()) return null;

  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  // Lodgify's shape puts the street name first and the house number second.
  let street: string;
  let rest: string[];
  if (parts.length >= 2 && HOUSE_NUMBER_RE.test(parts[1])) {
    street = `${parts[1]} ${parts[0]}`;
    rest = parts.slice(2);
  } else {
    street = parts[0];
    rest = parts.slice(1);
  }

  let zip: string | null = null;
  if (rest.length && ZIP_RE.test(rest[rest.length - 1])) {
    zip = rest.pop()!;
  }

  // A trailing "PA 18301" holds both, when they weren't comma-separated.
  if (rest.length && !zip) {
    const combined = rest[rest.length - 1].match(/^(.*?)\s+(\d{5}(?:-\d{4})?)$/);
    if (combined) {
      zip = combined[2];
      rest[rest.length - 1] = combined[1].trim();
      if (!rest[rest.length - 1]) rest.pop();
    }
  }

  let state: string | null = null;
  if (rest.length && isStateToken(rest[rest.length - 1])) {
    state = abbreviateState(rest.pop()!);
  }

  return {
    street: abbreviateStreet(street),
    city: rest.length ? rest.join(", ") : null,
    state,
    zip,
  };
}

/** Street line only: "484 Lakeside Dr". For SMS and anywhere space is tight. */
export function formatStreetAddress(raw: string | null | undefined): string {
  const parsed = parseAddress(raw);
  if (!parsed) return raw?.trim() ?? "";
  return parsed.street;
}

/** Locality line: "East Stroudsburg, PA 18301", or null if none is stored. */
export function formatLocality(raw: string | null | undefined): string | null {
  const parsed = parseAddress(raw);
  if (!parsed) return null;
  const stateZip = [parsed.state, parsed.zip].filter(Boolean).join(" ");
  const line = [parsed.city, stateZip].filter(Boolean).join(", ");
  return line || null;
}

/** Full one-line address: "484 Lakeside Dr, East Stroudsburg, PA 18301". */
export function formatFullAddress(raw: string | null | undefined): string {
  const parsed = parseAddress(raw);
  if (!parsed) return raw?.trim() ?? "";
  const locality = formatLocality(raw);
  return locality ? `${parsed.street}, ${locality}` : parsed.street;
}

/** Two-line form for cards and detail panels. */
export function splitAddress(
  raw: string | null | undefined
): { line1: string; line2: string | null } | null {
  const parsed = parseAddress(raw);
  if (!parsed) {
    const trimmed = raw?.trim();
    return trimmed ? { line1: trimmed, line2: null } : null;
  }
  return { line1: parsed.street, line2: formatLocality(raw) };
}
