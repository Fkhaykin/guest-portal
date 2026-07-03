# Pricing Lab → PriceLabs Parity: Implementation Plan

Deduped from 6 audit streams (calendar, customizations, neighborhood, comps, algorithm-validation, appwide). Notable merges: the divergence-history 1000-row truncation was flagged 3×; the booked/blocked split was flagged by both calendar and neighborhood auditors; the non-focusable day cell 2×; rule summaries, base-price nudge, staleness surfacing, and preview-prices each 2×. Each merged item below cites all consumers.

---

## Wave 1 — Ship now (P0 correctness + the core "feels like PriceLabs" surfaces)

### 1. Fix cross-house state bleed in ConfigureRail (data-corruption bug)
**Area:** calendar · **Effort:** S · **P0**
`ConfigureRail` seeds min/base/max into state once and `page.tsx:196` mounts it without a key — switching houses leaves House A's numbers live over House B's config, and one "Save & Refresh" click overwrites House B's prices. Fix: render `<ConfigureRail key={config.id}>`; also disable Save when any of Number(min|base|max) is NaN/≤0 (NaN currently passes `dirty` and the PUT silently drops the field while toasting "Saved"). Kill the fragile `seededFor` reseed hack in CustomizationsDialog at the same time — reseed `draft` explicitly on the dialog's closed→open transition instead of keying on `config.id + JSON.stringify(rules).length`.

### 2. House-switch race guard + error/retry states + loading skeletons
**Area:** appwide · **Effort:** M · **P0**
Merges three appwide findings. (a) `loadHouse` (page.tsx:51-59) gets an AbortController + `requestSeq` ref so a slow response for a previously-selected house can never land under the new selection; while `loading && data`, dim stale content with an overlay spinner. (b) Wrap the initial config fetch and `loadHouse` in try/catch/finally with an `error` state; render an `EmptyState` (AlertTriangle, "Couldn't load pricing data", Retry button) instead of the current infinite spinner / silently blank tabs; add a catch + toast to `runSnapshot`. (c) Add `PricingSkeleton` mirroring the 3-col calendar layout (rails + 35-cell grid) using the existing `ui/skeleton.tsx`, shown on initial load and house switch.

### 3. Divergence history: replace unbounded scan with SQL aggregation (chart is frozen on week-one data today)
**Area:** appwide/comps/algorithm · **Effort:** M · **P0**
Flagged by three auditors. `route.ts:63-69` selects every rate_snapshot row with no `.limit()` — PostgREST caps at 1000 rows, so after ~3 snapshot days the trend permanently shows only the oldest data while appearing to work, and the scan grows ~365 rows/day/house. Replace the JS aggregation with a Postgres RPC `divergence_history(p_nickname)` returning `snapshot_date, mean_abs_pct, dates_compared` (GROUP BY snapshot_date, LIMIT 60, filter `stay_date BETWEEN snapshot_date AND snapshot_date + 90`). Include `is_booked` in the filter so the trend uses the same sample as `summarizeSnapshot`'s headline mean-gap stat (they currently disagree for the same day).

### 4. Booked-day ADR + check-in markers + booked/blocked split
**Area:** calendar (+ feeds neighborhood & legend) · **Effort:** L · **P0**
Merges the ADR gap with the Unavailable-vs-Unbookable split (both need the same data work). Data: `loadOccupiedNightsDetailed` in `src/lib/pricing/data.ts` returning booked vs blocked separately (queries are already separate); persist `is_blocked` on rate_snapshot; in the pricing-lab GET, join `registration` (check_in/out, total_amount_cents, nightly_rates_snapshot, source) into a `bookings: Record<stay_date, {adr_cents, is_check_in, source}>` map. UI: DayCell shows `ADR: $X` on booked nights plus a check-in corner wedge; blocked cells get a distinct hatched tint + "Blocked" with the block reason in the popover; BreakdownCard shows a Booking section (dates, nights, ADR, source) instead of the meaningless hypothetical ladder. This also unblocks the Wave-2 occupancy panel's Booked/Unavailable bars.

### 5. Two-pane full-screen Customizations modal with bottom action bar
**Area:** customizations · **Effort:** L · **P0**
Merges the modal-shell, bottom-bar, and dialog-hygiene findings. New `customizations-modal.tsx`: full-height DialogContent, left nav (search input; sections Currently Applied (n) / Stay Restrictions / Smart Presets / All Customizations driven by a `RULE_REGISTRY` of `{key, label, section, keywords, isApplied, summarize, Editor}`), right pane rendering one page per rule. Refactor `RulesEditor`'s ten inline sections into exported per-rule editors so modal and any other surface share them. Footer bar: "{n} customizations are affecting your pricing and stay" chip, hierarchy-rules popover (lift the engine.ts:5-16 contract verbatim), Discard Changes with dirty-check confirm, Save Changes that keeps the modal open with a spinner until the PUT + run resolve (today it closes before the save lands and errors toast into the void). Dirty guard on X/backdrop close.

### 6. Auto-applied chips + plain-English rule summaries (shared everywhere)
**Area:** customizations + calendar rail · **Effort:** M · **P0**
Merges the Auto-applied finding with the calendar rail's terse "Applied Customizations" card. New `rule-summaries.ts` with `summarizeRule(key, rules, cfg)` templates per the audit spec ("Discount starts at 20% for same-day bookings, easing to 0% by 14 days out"). Each rule page: green "Auto-applied" badge + sentence when draft equals `DEFAULT_RULES[key]` (editor hidden behind a "Customize this rule" switch, with revert-to-default), amber "Customized" badge + summary otherwise. Replace the rail card's 5 hardcoded lines (calendar-sidebars.tsx:43-69) with the same `summarizeRule()` output — including seasons, events, velocity, smoothing, and override counts currently absent — so sidebar and modal never disagree.

### 7. Preview Prices panel (client-side engine run before save)
**Area:** customizations · **Effort:** M · **P0-adjacent P1, but the signature PriceLabs interaction**
The engine is pure and every EngineInput field is already client-side. In the modal, a collapsible strip: `computeRates({...config, rules: sanitizeRules(draft)}, input)` in a useMemo; next 30 unbooked nights as tiles with old price (strikethrough), new price, delta chip; aggregate line "Avg $X vs $Y (±z%) · k nights change"; tile click opens the existing `buildLadder` breakdown so the per-night "why" matches the calendar exactly. Requires threading `snapshot/market/today` into the modal (part of item 5's plumbing). Eliminates today's save→engine-run→reload loop as the only feedback mechanism.

### 8. Neighborhood chart parity: Published-price line, occupancy panel, event markers, correct series styling
**Area:** neighborhood · **Effort:** L · **P0 (×3 merged + styling P1)**
(a) "Last Seen Published Price" dotted line: self comp_listing probes already exist in comp_snapshot; return newest-per-stay_date `published[]` from the GET; render dashed line with dots + connectNulls (probes are sparse). (b) Occupancy panel: second ComposedChart in the same card with `syncId`, Booked/Unavailable stacked bars (from item 4's split) + red Market Occupancy line + day-over-day delta in tooltip (load two most recent pulse snapshot_dates); always render with an empty-state note instead of hiding. (c) Events: pass `config.rules.events` into the chart; purple ReferenceArea + capsule strip + tooltip row. (d) Styling: rename "Our price" → "Listing Price" (solid foreground, 2.5px), gray/pink/light-pink band hierarchy, `legendType="none"` on the stacking base to kill the stray "band25" legend entry, and a real tooltip showing all band dollar ranges (the current formatter suppresses everything but our price).

### 9. Manage Competitors table + non-destructive enable/disable
**Area:** comps · **Effort:** L · **P0 (×2 merged)**
Replace the flat div list with a `CompsTable`: sortable columns (name, BR, lakefront, distance via haversine from `data.house` — pass it in at page.tsx:223, rating/reviews, occ-30, median price, last-scraped, status), search, bedroom/lakefront/error/inactive filters, checkbox selection, 25/page client pagination, skeleton + empty states. Add PATCH to `comps/route.ts` (`{ids, set: {is_active, label}}`) and multi-id DELETE; per-row is_active Switch with optimistic update; bulk Enable/Disable/Delete bar; delete confirm dialog warns that cascade destroys unbackfillable scrape history with "Pause instead" as the primary action; exclude `!is_active` from the header market-median calc.

### 10. Fix position-window sample mismatch (the "% vs market" badge is systematically wrong)
**Area:** algorithm-validation · **Effort:** S · **P0**
`computePosition` compares our open-nights-only average against the market p50 of every night — with weekends booked, cheap weeknights get compared to weekend-inclusive market medians. Use paired samples (push both sides only when our_price != null && !is_booked && p50 != null), same for the weekend/weeknight split; add `nights` count rendered as "(n nights)"; during shadow mode add a "Live listed (PriceLabs)" row from pl_user_price_cents or retitle ours "Our lab price".

### 11. Engine bug: positive orphan-gap percentage silently ignored
**Area:** calendar/engine · **Effort:** S · **P1 but a silent-misbehavior trust killer**
The UI tells owners to use a positive % to deter 1-night party bookings, but the engine drops gap premiums entirely (gap only competes as a discount). Add `gapPremium = max(rules.gap.pct, 0)` outside the smoothed dynamic, include in the final multiplier via `factors.gap_pct`; render the gap row in breakdown.ts whenever `gap_pct !== 0`; unit test: 1-night gap at +20% raises the night 20%.

### 12. Header identity + sync status + staleness chips
**Area:** calendar header / appwide · **Effort:** M · **P1 (×2 merged)**
Merges the header-identity and staleness findings. API: return `latest_snapshot_at` (created_at, not just date) and `pulse_date`. Header: house name as title-size Select trigger; subtitle `{bedrooms} Bedrooms | {city} | Lodgify ({id})` linking out; replace the three mode buttons with an "Enable Price Sync" Switch (disabled + tooltip while live push is unbuilt) + Sync Now; "Last synced 7 hours ago" relative-time formatter, repeated under Save & Refresh in ConfigureRail. `DataFreshness` chips — "Prices {age}" / "Market {age}" — flip amber with a warning tooltip when snapshot age > 1 day or pulse age > 2 days, so a comp-scraper outage stops silently freezing demand tints.

---

## Wave 2 — Next

### 13. Right-rail stack: Date Overrides, Events, Notes, Base Price History, Pricing Logs
**Area:** calendar · **Effort:** L · **P1**
Accordion replacing the lone MetricsRail card. Overrides row: count badge, `+` popover quick-add patching `rules.overrides`, eye-toggle for cell markers (factors.override is computed but shown nowhere); Events row same over `rules.events`; Notes: new `pricing_note` table + GET/POST; Base Price History: new `pricing_config_log` written inside the config PUT (doubles as Action Logs); Pricing Logs: recent `rate_snapshot` runs with pl status. Day-cell click can pre-fill the override form.

### 14. Legend rows + clamp/override indicators on cells
**Area:** calendar · **Effort:** S · **P1**
`factors.clamped` is computed and displayed nowhere. Rose price on min-clamped days, sky on max, dot for overrides; move the legend below the grid as two rows — Demand (rename "Booked"→"Unavailable", add "Unbookable" from item 4) and Booking Info (Booked stripe, Check-in wedge, Override dot, limit-reached colors); bold the matching threshold row in the BreakdownCard.

### 15. Breakdown popup: running $ per row, PL footer, min-stay source; extend the validation-tab Why column
**Area:** calendar + algorithm-validation · **Effort:** M · **P1 (×2 merged)**
Thread a running total through the customization section of `buildLadder` (currently % only); footer strip with pl_user_price_cents / pl_price_cents (free parity win in shadow mode); add `min_stay_src[]` to RateFactors so min-stay reads "2 (Season, Last-minute)"; rename section headers to PriceLabs casing. Make the validation table's Why cell a Popover rendering the same `buildLadder` — today it omits velocity, far-out premium, and smoothing entirely, so the exact rows with large Δs are unexplainable.

### 16. Calendar toolbar: month dropdown, Monthly/Weekly switch, settings gear
**Area:** calendar · **Effort:** M · **P1**
Month Select derived from snapshot range (kills the 12-clicks-to-next-July problem); Weekly mode = one row of 7 tall cells stepping 7 days (the view that fits 365-day horizons); gear Popover with display Switches (min-stay moon, event chips, market median, overrides) persisted to localStorage and shared with the right-rail eye toggles.

### 17. "Help Me Choose a Base Price" + base-drift nudge
**Area:** calendar + algorithm · **Effort:** M · **P1 (×2 merged)**
Dialog blending comp-set median, mean market p50 over 180d, and trailing-12mo realized ADR (add `realizedAdr` to the GET) into a suggested base with a delta chip; Apply fills the input without auto-saving. Also add the passive drift nudge to the Us-vs-market card: amber badge when |base − market median| > 7%, matching PriceLabs' weekly nudge.

### 18. GET endpoint waterfall + payload trim + save-flow honesty
**Area:** appwide · **Effort:** M · **P1 (×2 merged)**
Derive velocity from the already-loaded pulse (deletes 2 duplicate queries), Promise.all the independent query groups (~12 serial round-trips → ~4 parallel), strip zero/null keys from the 365 `factors` blobs (~70% payload cut; make RateFactors Partial with `?? 0` fallbacks in breakdown.ts), omit factors for booked rows. Save flow: actually check the /run response and toast a warning on failure (today "Saved & refreshed" lies and reloads the old snapshot); add `skipPl` fast path carrying forward pl_* columns so UI saves skip the multi-second Lodgify fetch (nightly cron keeps fetching).

### 19. Min Stay page: weekday/weekend split, per-DOW mode, orphan-gap ranges with day windows
**Area:** customizations/engine · **Effort:** L · **P1**
Extend `minStay` with `weekendBase`/`dow[]`/`mode` and `gap.ranges[]` ({min/maxNights, weekday/weekendMinStay, withinDays bounds}), legacy `setMinStay` preserved when ranges absent. Editor: segmented Weekdays-Weekends vs Day-of-Week control, PriceLabs-style sentence rows for gap ranges, canned profile presets. Skip "Help Me Choose" (needs market stay-pattern data we don't have).

### 20. New engine rules: Booking Recency, Pricing Offset, Minimum Weekend Price (+ configurable weekendDays)
**Area:** customizations/engine + algorithm · **Effort:** L · **P1 (×2 merged)**
All optional fields. Recency: discount next N days after M booking-free days, competing under largest-discount-wins; plumb `daysSinceLastBooking` from registrations (group by nickname per the duplicate-property-rows convention). Offset: applied after the clamp, pierces min/max like PriceLabs Stage 4. `weekendMinCents`: separate Fri/Sat floor in the clamp. Add `weekendDays?: number[]` to rules and use it in `computePosition` + AlgorithmTab labels — the hardcoded Fri/Sat weekend currently contradicts owners who configure Sunday premiums. Registry pages + summaries + breakdown rows for all three.

### 21. Check-in/Check-out day restrictions (Stay Restrictions section)
**Area:** customizations/engine · **Effort:** M · **P1**
`restrictions: {checkinDays, checkoutDays}`; ComputedRate gains `checkin_allowed/checkout_allowed`; enforce in `buildBookingQuote` and the home-page availability search; editor = two rows of 7 toggle chips; mandatory callout that this applies to direct bookings only (Lodgify's API can't receive restrictions); no-check-in glyph on calendar cells.

### 22. Comps operational hygiene: lightweight GET, batched bulk-add, health rollup, per-comp detail
**Area:** comps · **Effort:** L · **P1 (×4 merged)**
(a) GET on `/comps` so mutations stop refetching the entire 250KB lab payload (adding 5 candidates currently = 5 full reloads). (b) Batch POST accepting `items[]`, skipping the per-item Airbnb re-scrape when discovery already supplied lat/lng ("Add top 8" goes from ~15s serial to one request). (c) Health chips (healthy/errors/never-scraped/stale) as toggleable filters, status column with error Popover, "Queue rescrape" action (PATCH last_scraped_at=null), banner when >10% error. (d) Row-click Sheet with a 120-day price/availability chart from a new `/comps/[id]/history` endpoint.

### 23. Algorithm tab: velocity legibility, tier visibility, hot-dates fixes, honest empty states
**Area:** algorithm-validation · **Effort:** M · **P1 (×3 merged)**
Velocity chart: keep all dates on the axis (no null-filter distortion), right-hand axis for the premium (currently a 2px sliver on a 0-100% axis), tier ReferenceLines + a tier chip row with Edit button, disabled-state warning. Hot dates: filter stay_date >= today and present-in-snapshot, soonest-first tiebreak, always render the card with a real empty message, scale bars to the list max. Empty states: computed scrape-health status line from data.comps instead of static guesswork; record `pickup_window_days` in market_pulse so "7-day pickup" stops being mislabeled during warm-up.

### 24. Booking pace: us vs market over time
**Area:** algorithm-validation · **Effort:** M · **P1**
The history exists in market_pulse and rate_snapshot and is never read. Add `paceTrend` (mean pickup/occupancy per snapshot_date, last ~21) and `ourPickup` (is_booked false→true flips per snapshot day) to the GET; new "Booking pace — us vs market" ComposedChart. The weekly-check view a revenue manager actually opens.

### 25. Competitor Calendar table below the map
**Area:** neighborhood · **Effort:** L · **P1**
New `/comp-calendar` endpoint (per-comp latest-snapshot rows, ≤25 comps, self pinned first) + table with sticky comp column, date columns, price/availability cells, "Manage Competitors" → Comps tab (requires making Tabs controlled — also needed by item 26's gear).

### 26. Neighborhood header + horizon selector; comparison-chart axis fix
**Area:** neighborhood + algorithm · **Effort:** M · **P1 (×3 merged)**
Explainer line + compset badge ("4 BR → 6 BR · n comps") + gear to Comps tab; horizon Select 30–365 days (snapshot already holds 365). Comparison chart: stop filtering booked nights out of the categorical axis (adjacent points can be 10 days apart today) — keep every date, null out Ours on booked rows, drop connectNulls, shade booked runs with ReferenceArea, optional base/min/max reference lines.

### 27. Mobile + accessibility pass on the calendar
**Area:** appwide · **Effort:** M · **P1 (×2 merged, day-cell flagged 2×)**
PopoverTrigger `render={<button type="button"/>}` + focus ring + per-cell aria-label (keyboard users currently cannot open any breakdown); 4px saturated demand strip at cell top as a non-color cue for colorblind users. Mobile: responsive price type + compact fmt, calendar ordered first below lg (rails currently push it two screens down), TabsList in an overflow-x-auto wrapper.

### 28. Rich listing switcher
**Area:** appwide · **Effort:** M · **P1**
Extend the no-nickname GET with propertyName/address/coverImageUrl/bedrooms/base/mode per config; Popover trigger styled as a listing card with thumbnail and prev/next chevrons, replacing the bare nickname Select.

---

## Wave 3 — Later / optional

### 29. Converge the Configuration tab into the modal
**Area:** customizations · **Effort:** S · **P2** — Configuration tab becomes price-anchor card + read-only summarizeRule list + "Open Customizations" button; lift the modal into page.tsx as the single instance; delete the RulesEditor compat wrapper. Eliminates the two-divergent-forms problem before it compounds.

### 30. Gradual last-minute discount mode
**Area:** customizations/engine · **Effort:** M · **P2** — `leadtimeGradual` linear ramp superseding steps; Gradual|Steps segmented control with sparkline; summary matches PriceLabs phrasing verbatim.

### 31. Stub pages: Extra Guest Fee, LOS Pricing; real Safety Minimum Price page
**Area:** customizations · **Effort:** S · **P2** — Two "managed in Lodgify/Airbnb" stub pages (dimmed, N/A badge, never counted); Safety Min page maps to min_price_cents with the 30%-of-base guidance and amber warning; modal save payload extended to include min_price_cents.

### 32. Plain-English Applied Customizations sentences → click-to-anchor
**Area:** calendar · **Effort:** S · **P2** — Largely subsumed by item 6; remaining work is clicking a rail row to open the modal scrolled to that rule's page.

### 33. Booked-stripe hatch pattern + label-only event chips
**Area:** calendar · **Effort:** S · **P2** — repeating-linear-gradient hatch; match event chips on date range from rules.events directly so 0% informational events ("Spartan Wknd") can appear.

### 34. Chart toolbar: options, download PNG, fullscreen, help
**Area:** neighborhood · **Effort:** M · **P2** — series-toggle Popover persisted to localStorage, SVG→PNG download, fullscreen Dialog; skip/stub AI Insights.

### 35. Extend market_pulse horizon to 365 days
**Area:** neighborhood · **Effort:** S · **P2** — raise PULSE_HORIZON_DAYS; pairs with the horizon selector; bands stay probe-limited past ~120d, acceptable.

### 36. market-pulse cron N+1 (~1,700 queries at 430 comps)
**Area:** comps · **Effort:** M · **P2** — move aggregation into a Postgres function (or batch `.in('comp_id', chunk)` loads). First scaling cliff as comp counts grow; not user-visible yet.

### 37. Discovery exclude-set pagination past 1,000 comps
**Area:** comps · **Effort:** S · **P2** — `.range()` loop shared helper for both discover routes; prevents silent dedupe breakage including re-suggesting sibling is_self listings.

### 38. Comp-panel header stats from market_pulse
**Area:** comps · **Effort:** S · **P2** — derive "Market median · % booked" from the same pulse data the Neighborhood tab uses so the two numbers on one page can't diverge.

### 39. Validation-tab polish: neutral PositionBadge, DivergenceTrend as a real LineChart, PL-rec column + year in dates, post-PriceLabs mode
**Area:** algorithm-validation · **Effort:** M · **P2 (×4 merged)** — badge tone conditioned on occupancy delta (above-market pricing is not inherently good); axis-less bar list → LineChart with a target ReferenceLine; add pl_price_cents column and Δ%; fmtDate gains year across boundaries; Alert + collapsed stat grid when the PL feed goes away so the tab doesn't look broken the day PriceLabs is cancelled (persist ShadowResult.pl status).

### 40. Dark-mode map + dynamic price bands; EmptyState pattern; chart-theme dedupe
**Area:** appwide/neighborhood · **Effort:** S–M · **P2 (×3 merged)** — dark Google Map style via useIsDark(); quintile-derived map legend buckets instead of hardcoded $350–$900 cutoffs (+ price-labeled pins); replace the "Seed pricing_config" bare card and comps `<p>` with EmptyState + CTA; extract `chart-theme.ts` (TOOLTIP_STYLE is copy-pasted 3×) and add range Selects / "Show all" to the truncated table and charts.

---

## Sequencing notes

- **Items 1–3 and 10–11 are bug fixes** — land them first, individually, before any feature work; each is independently shippable.
- **Item 4 (booked/blocked split) is a dependency of item 8's occupancy panel and item 14's legend** — do 4 before 8/14.
- **Item 5 (modal shell) is the platform for 6, 7, 19, 20, 21, 29–31** — its RULE_REGISTRY and per-rule editor refactor should land before any new rule pages.
- **Controlled Tabs (item 26) is a tiny prerequisite** for items 25's and 26's cross-tab navigation — do it with whichever lands first.
- Wave 1 totals roughly: 3 S, 5 M, 4 L. With the "spare no expense" mandate, Waves 1–2 together constitute PriceLabs functional parity; Wave 3 is polish, scaling headroom, and post-PriceLabs cleanup.