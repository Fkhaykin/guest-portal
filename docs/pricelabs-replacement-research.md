# PriceLabs: how it works, and what an in-house replacement requires

Synthesized 2026-07-02 from verified research (engine mechanics, data sources, feature inventory, Lodgify integration, DIY landscape, cost) plus a codebase surface analysis of the guest-portal repo. Claims that verification agents refuted or could not confirm are flagged explicitly.

---

## 1. What PriceLabs is, and what it costs you

PriceLabs is a dynamic-pricing SaaS for short-term rentals: it computes a recommended nightly price and minimum stay for every future date on every listing, and pushes them into your PMS (Lodgify), which forwards them to Airbnb/Vrbo/Booking.com via its channel manager. Its inputs are scraped OTA market data plus your own calendar; its outputs are percentage adjustments stacked on a base price you set.

**Your cost (4 Lodgify property rows = 4 billed listings, US pricing, verified against [the official pricing article](https://help.pricelabs.co/portal/en/kb/articles/how-much-does-pricelabs-costs) and [plans page](https://hello.pricelabs.co/plans/)):**

| Item | Monthly | Annual |
|---|---|---|
| Dynamic Pricing: $19.99 (1st) + 3 × $14.99 (listings 2–5) | **$64.96** | **$779.52** |
| + one Market Dashboard ($9.99, up to 1,000 listings) | $74.95 | $899.40 |
| + second daily sync ($1/listing) on all 4 | $78.95 | $947.40 |

- Billing is **month-to-month, in arrears, no proration** (a listing synced any part of a cycle is billed the full cycle) and **there is no annual discount** ([billing article](https://help.pricelabs.co/portal/en/kb/articles/billing); verified — a third-party claim of a 10% annual prepay discount is unsourced and likely a negotiated portfolio deal).
- Alternative 1%-of-revenue plan exists (1-year lock-in); for 4 listings it beats flat fee only below ~$78k/yr gross.
- A 4-listing account earns **zero free Market Dashboard tokens** (bundles start at 1 per 10 syncing listings).
- Other add-ons: Customer API $1/listing/mo, Real-Time Sync $2/unit/mo, mapped channel listings $1/mo each.

**Practical replacement target: ~$780–950/year saved.** Note also that the "4 listings" are really 2 physical houses (Lakehouse & Chalet each have 2 Lodgify property rows) — you are paying per-row for duplicated inventory.

---

## 2. The pricing engine, mechanically

PriceLabs' own docs expose the computation stages in order ([How Are the Price Recommendations Calculated?](https://help.pricelabs.co/portal/en/kb/articles/how-is-pricing-calculated), [calendar tooltip explainer](https://help.pricelabs.co/portal/en/kb/articles/different-prices-on-your-calendar-explained)). Verified: the pipeline order below is confirmed against primary sources.

**Stage 0 — Base Price (user-set anchor).** Everything is a % adjustment on this. It should reflect the *yearly average* nightly rate, not peak (seasonality multiplies on top). PriceLabs computes its own Recommended Base Price weekly from a rolling 60-day performance-vs-comp-set window (inputs: ADR + occupancy vs comps, 30-day pickup vs market, reviews/rating, amenities, cleaning fee → negative adjustment, Superhost/Guest-Favorite → positive) and "nudges" you when your base drifts >7% from it ([setting-base-price](https://help.pricelabs.co/portal/en/kb/articles/setting-base-price), [nudges](https://help.pricelabs.co/portal/en/kb/articles/recommendation-nudges)).

**Stage 1 — Market Factors** (produce the "Uncustomized Price"):
- **Seasonality factor** — learned from historical rental + hotel data; hyper-local under the current HLP algorithm. User dial with 6 aggressiveness levels; no coefficients published.
- **Demand factor** — day-of-week trends, events, holidays. Also a 6-level sensitivity dial.
- **Pacing factor** — only in some markets; market occupancy vs same period prior years (e.g. "+5% = market up 5% YoY"), decaying to 0 over a market-dependent window.

Factors are expressed as ± percentages on base — PriceLabs' published example: "$66 base + 4% demand = $68" ([How PriceLabs Works](https://hello.pricelabs.co/how-pricelabs-works-understanding-its-various-metrics-and-graphs/)).

**Stage 2 — Pricing Customizations** (produce the "Customized Price"), the re-implementable layer. Published defaults, with a caveat verification flagged (see below):

| Customization | Default |
|---|---|
| Last-minute discount | Legacy: gradual (linear per-day) **30% over final 15 days**. Current HLP default: "Market Driven (Balanced)" — mirrors competitors' behavior, **capped at 40% within 60 days** ([last-minute prices](https://help.pricelabs.co/portal/en/kb/articles/last-minute-prices)) |
| Far-out premium | Legacy: ramp starting day 30 to a **flat +20% from day 240**. HLP: market-driven, capped 20%, starts ~60 days out ([far-out prices](https://help.pricelabs.co/portal/en/kb/articles/far-out-prices)) |
| Orphan-day pricing | **−20% on gaps of 1–2 nights** between bookings; up to 5 configurable gap ranges, weekday/weekend split |
| Occupancy-based adjustment (own listing) | Table of (day-range, occupancy threshold) → %; Market-Driven profile: next 60 days, **discounts capped −20%, premiums +15%** (example: 20% occupancy → −15%, 40% → −5%) ([OBA article](https://help.pricelabs.co/portal/en/kb/articles/occupancy-based-adjustments)) |
| Booking-recency | 5–15% linear discount on next 30 days after 15–45 booking-free days |
| Day-of-week | Manual per-weekday %, −75% to +500% (DOW is otherwise inside the demand factor) |
| Others | Adjacent factor, smoothing (identical prices across a window), rounding, weekend-day redefinition, minimum weekend price, seasonal min/base/max profiles, date-specific overrides |

**Stacking rule** ([pricing customizations](https://help.pricelabs.co/portal/en/kb/articles/pricing-customizations)): if multiple discounts hit the same night, **only the largest single discount applies** (no compounding); premiums all stack; fixed-price overrides beat everything.

**Stage 3 — Thresholds.** Clip to [min, max]. If unset: safety min = **30% of base**, safety max = **10× base**. (2026: safety minimum now benchmarks same-time-last-year performance.)

**Stage 4 — Pricing Offset** (fixed or % shift, applied last; offsets and date overrides are the only things that can pierce min/max) → **Final Price**.

**The forecasting core underneath (HLP)** — confirmed against PriceLabs' engineering blogs [Part 1](https://hello.pricelabs.co/overview-of-pricelabs-dynamic-pricing-algorithm-part-1/) and [Part 2](https://hello.pricelabs.co/blog/overview-of-pricelabs-dynamic-pricing-algorithm-part-2/):
- Comp set = **~350 similar-sized (bedroom-matched) listings within a dynamic radius up to 15 km**, KNN over Uber H3 hex indexes.
- Each future date matched to historical **reference dates** (same season, DOW, holiday/event status, similar booking-curve shape) to predict its booking curve; corrected daily by **pacing** (occupancy vs reference dates at same booking window) and **pickup** (current booking velocity).
- Price chosen to maximize **Expected Revenue = Price × P(booking at that price)**, with sequential re-pricing solved as dynamic programming (Bellman equation) over booking windows — which *endogenously* produces far-out premiums and last-minute discounts.
- Events: two pathways — automatic (booking-velocity surge in the comp set) and manual (PriceLabs' revenue team hand-enters price factors for big events with tiered geographic zones, decaying as real data takes over) ([event pricing](https://help.pricelabs.co/portal/en/kb/articles/how-pricelabs-handles-event-pricing)).
- Min-stays: "Dynamic Minimum Stays" recommends min-stays from market stay patterns, with a documented priority hierarchy (Lowest-Min-Stay-Allowed > Orphan > Date Override > Adjacent-After > Adjacent-Before > Far-Out > Last-Minute > Default) ([min-stay hierarchy](https://help.pricelabs.co/portal/en/kb/articles/hierarchy-of-minimum-stay-restrictions)).
- Cadence: recommendations recompute daily (~1M data points per listing update); default **one price push per night**.

> **Verification caveat (claim refuted):** the claim that these published numbers are "a complete, replicable spec" was **refuted**. The numbers above are *caps and legacy defaults*; the current HLP defaults are "market driven" and change daily based on proprietary comp-set data. A rule engine using the published values approximates PriceLabs' *legacy* behavior, not its current market-reactive behavior. That is still a useful target — the legacy defaults were the product for years — but it is not equivalence.

---

## 3. Data sources — what PriceLabs has that we can't easily get

**What they have:**
- **Daily scraping of public Airbnb + Vrbo listing pages** (calendars, prices, listing info) — the primary raw layer, per their own [methodology doc](https://help.pricelabs.co/portal/en/kb/articles/market-dashboard-methodology-data-sources-and-processing): "regardless of whether we have customers there or not." 10M+ units scanned.
- **Verification note (claim refuted):** the claim that data is *exclusively* scraped Airbnb+Vrbo was **refuted**. PriceLabs also scrapes **Booking.com** and ingests **direct PMS actuals from the Key Data partnership** (2,600+ property managers, Aug 2022) ([science-behind-pricelabs-data](https://hello.pricelabs.co/blog/science-behind-pricelabs-data/), [partnership announcement](https://hello.pricelabs.co/blog/pricelabs-x-key-data-partnership/)).
- **Booked-vs-blocked inference** — the genuinely hard part. Consecutive dates going unavailable between scrapes = candidate booking; "block removal" logic uses Length of Stay, Booking Window, Market Occupancy, extreme price variations; stays >60 days auto-removed; cross-OTA bookings caught because any booking blocks the Airbnb calendar. Calibrated against Key Data's PMS ground truth. PriceLabs admits "our block removal isn't perfect." (All confirmed verbatim against primary sources.)
- **Longitudinal history** — years of calendar/price diffs per listing. You can start scraping today; you cannot backfill.
- **Verification note:** "Key Data ground truth is not publicly purchasable" was **corrected** — Key Data *does* sell direct-source data commercially (ProData/EnterpriseData, via API/Snowflake/S3, priced for institutional buyers), though whether reservation-level block-reason labels are in any off-the-shelf product is undocumented.
- Actual freshness is lower than marketed: competitor rates refresh every **5 days**, occupancy every **2 days**, new listings every **15 days** ([Listing Neighborhood Data](https://help.pricelabs.co/portal/en/kb/articles/listing-market-data)).

**Alternatives for an in-house build (with costs):**

| Source | What you get | Cost | Notes |
|---|---|---|---|
| **AirROI** ([api](https://www.airroi.com/api)) | 22 REST endpoints; market metrics, 365-day forward rates, 50 comps/listing; daily updates | **$0.01+/call, $10 free credits, no minimum** | Cheapest credible replacement for the "market occupancy" input |
| **Airbtics** ([api](https://airbtics.com/airbnb-api)) | Market search $0.01, listings $0.05, revenue estimates $0.10–0.50/call | pay-as-you-go; enterprise from $500/mo | Weekly calendar snapshots (Thursdays) |
| **PriceLabs Market Dashboard** (keep just this) | Daily-refreshed market KPIs, percentile price bands, pacing | $9.99/mo | Ironically a fine data feed for a DIY engine; no raw per-listing export |
| **AirDNA** | Enterprise API (monthly market metrics, daily future pricing) | contact sales; anecdotally ~$50k/yr; UI plans $19.95–99.95/mo/market | API is overkill/overpriced at this scale |
| **DIY Apify scraping** | Comp-set calendars + prices, e.g. [airbnb-availability-calendar actor](https://apify.com/simpleapi/airbnb-availability-calendar) $10/mo; general scrapers ~$1.25–3.00/1,000 results | ~$10–30/mo for a 5–10 listing comp set | Airbnb ToS prohibits scraping; as an Airbnb **host** your real risk is account termination, not CFAA (hiQ v. LinkedIn allows public scraping but hiQ lost on contract) |
| **Free proxies** | Rakidzich search-page counting (supply with/without dates = booked inventory); 2–3 local hotels' rates as event detector | $0 | Manual or lightly scripted |

**Bottom line:** the raw layer is publicly obtainable; the moat is history + the block classifier + scale. For 2 houses in one Poconos market, a hand-picked 5–10 listing comp set with daily calendar diffs plus AirROI market aggregates covers most of the signal at ~$10–30/mo.

---

## 4. Feature inventory — what matters for a 1–5 listing host

**Core (all in base subscription):** Min/Base/Max price anchors; HLP algorithm; ~30 customizations settable at listing/group/account level; Dynamic Minimum Stays with priority hierarchy; date-specific overrides (fixed price, % of recommended, % of base, min/max overrides, min-stay override, check-in/out override, expiry, bulk apply); Multi-Calendar bulk grid; nightly sync (Timed Sync to pick the hour).

**What small hosts actually use** (per [OptimizeMyAirbnb tutorial](https://optimizemyairbnb.com/pricelabs-customizations-tutorial-beginner-advanced/), [BiggerPockets](https://www.biggerpockets.com/forums/530/topics/1162568-is-pricelabs-worth-it), [RentalRecon](https://www.rentalrecon.com/airbnb-management/pricelabs-review/)) — this is your must-replicate list:
- **Minimum price** (repeatedly called the single most important setting)
- **Custom gradual last-minute discount** (default judged too weak; e.g. 50%→5% over days 1–10)
- **Orphan-day pricing** (often inverted to a *premium* to deter 1-night party bookings)
- **Last-minute min-stay drop** (e.g. 2 nights within 7 days)
- **Check-in/check-out day restrictions** aligned to cleaner schedules
- **Minimum weekend price**; day-of-week adjustments
- **Neighborhood Data 7-day pickup** chart (the market signal hosts actually look at)

**Ignorable for your scale:** Occupancy-Based Adjustment presets (consultants warn presets override the algorithm), Market Dashboards (redundant with other data), Revenue Estimator Pro, Pricing Offset, Demand Factor sensitivity changes, Portfolio Analytics / Owner Analytics (built for PMs with owners), Listing Optimizer, Goals/Forecasting, the Customer API, iOS app, Portfolio OBA.

**Notable non-feature:** PriceLabs does **not** create OTA promotions — Airbnb promos stay on Airbnb's side; PriceLabs just accounts for them ([Airbnb integration FAQ](https://help.pricelabs.co/portal/en/kb/articles/pricelabs-airbnb-integration)). Your existing in-house promo engine already exceeds this.

**Host behavior ground truth:** PriceLabs is *not* set-and-forget — 30–60 min setup per listing, then weekly 5–10 minute reviews. An in-house tool inherits the same attention requirement.

---

## 5. Lodgify integration mechanics + THE FEASIBILITY VERDICT

### How PriceLabs connects (proof the path is public)
PriceLabs connects with the host's own **Lodgify User ID + public API key** (copied from Lodgify Settings → Public API) — not a private OAuth partner handshake ([PriceLabs Lodgify guide](https://help.pricelabs.co/portal/en/kb/articles/lodgify), [Lodgify launch blog](https://www.lodgify.com/blog/lodgify-pricelabs-integration/)). Lodgify's docs state that key "has both read and write permissions." PriceLabs pushes: daily rates, per-date minimum stays, LOS pricing adjustments, extra-guest fees — up to 540 days ahead — and does **not** push check-in/check-out day restrictions (those stay in Lodgify). The host must enable the **"External Rates" toggle** in Lodgify settings, after which rates/min-stay are no longer managed in the Lodgify UI; synced prices appear only in Lodgify's Multi-calendar view.

### THE VERDICT

**YES — our own code can push daily rates AND per-date minimum stays into Lodgify via the public API, with the same key already in `LODGIFY_API_KEY`. Confidence: HIGH** (double-confirmed by independent docs-side and integration-side verification agents against Lodgify's OpenAPI spec, staff forum answers, and the production Smartpricing/PriceLabs integrations).

**The write endpoint (the only one):**

```
POST https://api.lodgify.com/v1/rates/savewithoutavailability
Header: X-ApiKey: <public API key>
```
(operationId `SaveTiny`, docs slug [docs.lodgify.com/reference/savetiny](https://docs.lodgify.com/reference/savetiny); spec description: "Replaces the selected rates for specific room types... To be used by 3rd party services that do not support availability information.")

**Payload** (`TinyRateDto` — schema verified from the embedded OpenAPI spec, [archived](https://web.archive.org/web/20250210214540/https://docs.lodgify.com/reference/savetiny)):

```json
{
  "property_id": 123,
  "room_type_id": 456,
  "rates": [
    { "is_default": true, "price_per_day": 250.0, "min_stay": 2, "max_stay": 0,
      "price_per_additional_guest": 15.0, "additional_guests_starts_from": 6 },
    { "is_default": false, "start_date": "2026-07-04T00:00:00", "end_date": "2026-07-04T00:00:00",
      "price_per_day": 389.0, "min_stay": 3, "max_stay": 0,
      "price_per_additional_guest": 15.0, "additional_guests_starts_from": 6 }
  ]
}
```

`min_stay` is a field on every date-ranged rate row → **per-date minimum stays are fully writable**. Single-day granularity = one row per day (`start_date == end_date`). One call per (property_id, room_type_id).

**Critical semantics (Lodgify staff-confirmed in the archived [Smartpricing thread](https://web.archive.org/web/20240723195739/https://docs.lodgify.com/discuss/6502c20b2cdeec000d673544)):**
1. **Full-replace, not patch.** Every call replaces the room type's entire rate set. Push the complete window (default row + all dated rows) every sync — or read-merge-write: `GET /v1/rates/calendar` → merge → POST full array back (Lodgify's product team's own recommended workflow).
2. **At least one `is_default: true` rate is mandatory** by product design; omitting it returns "Internal Server Error (OK)" **error code 666** ("no default rate defined").
3. **Precondition:** External Rates toggle ON, and a base rate must exist on Lodgify's Rates page.
4. Lodgify (like MiniHotel) uses **"Min-Stay Through"** semantics: the highest min-stay across all dates in a requested booking period applies ([understanding-min-nights](https://help.pricelabs.co/portal/en/kb/articles/understanding-min-nights)). Also: rate syncs to Lodgify **fail if min-stay is absent** — every row must carry one.

**Read-back for verification:** `GET /v2/rates/calendar?HouseId=&RoomTypeId=&StartDate=&EndDate=` returns per-date `{date, is_default, prices:[{min_stay, max_stay, price_per_day, ...}]}` — assert your push the same day. **API v2 has zero rate-write endpoints** (`/v2/rates/calendar` and `/v2/rates/settings` are GET-only; Lodgify staff: "the endpoint to update rates is in V1... that doesn't mean you cannot use it, or that it's deprecated").

**What is NOT writable:** check-in/check-out day restrictions (read-only `checkin_allowed_days`/`checkout_allowed_days` — manage in Lodgify UI), LOS discount tables, rate settings (booking window, advance notice), date blocks (already known — faked via bookings, which the codebase does).

**Channel propagation:** rates + min-stays written this way flow onward to Airbnb/Vrbo/Booking.com via Lodgify's channel manager — Lodgify's own blog says PriceLabs-pushed rates "can also be sent to all your connected channels such as Expedia, Booking.com, Airbnb etc." Caveats: Booking.com receives only daily/weekly/monthly rates; Airbnb LOS behavior differs between REST vs legacy XML connections. No single doc says verbatim "API-written rates sync to channels," but the inference chain (PriceLabs uses this exact public endpoint; its rates propagate) is strong. **Testable in one afternoon: push a distinctive price to a far-future date and watch the Airbnb listing.**

**Rate limits:** v1: 600 req/min; v2: 750 req/min; 429 on excess ([rate-limits](https://docs.lodgify.com/docs/rate-limits)). Third-party *vendor* registration requirements don't apply to a host using their own key on their own account.

**Residual caveats:** docs.lodgify.com Cloudflare-blocks automated fetching, so schema verification rests on Feb–Mar 2025 archive snapshots (endpoint stable since ≥2022; one docs page confirmed live July 2026 via proxy, "updated 25 days ago"). The error-666/replace semantics came from a forum thread Lodgify has since removed (whether the whole Discussions section was deleted is **unverified** — the nav link still existed in a Dec 2025 snapshot). Both quirks are trivially testable with one API call against the Summit account before committing.

---

## 6. Known PriceLabs weaknesses an in-house tool could beat

1. **Stale sync cadence** — one push/day by default; event-driven reaction costs $2/unit/mo and is still capped at once/hour. In-house: repush on every Lodgify `booking_new_*`/`booking_change`/`availability_change` webhook (the repo already subscribes to these).
2. **Generic defaults that leak revenue** — 30%/15-day last-minute discount is a pure leak for listings that book late anyway; 20% orphan discount invites 1-night party bookings; hosts report "it just copies the market" ([LuxeHaus review](https://www.luxehausstays.com/insights/is-pricelabs-worth-it/)).
3. **Comp-set quality in small/seasonal markets** — radius matching pulls in "properties that share a zip code but not a guest profile" ([West Coast Homestays](https://www.westcoasthomestays.com/post/dynamic-pricing-vacation-rentals-what-tools-get-wrong)). You can hand-pick 5–10 true Poconos comps.
4. **Event lag** — detection "typically lags behind when sophisticated hosts have already captured early bookings"; Trustpilot reports a mis-entered event losing revenue. A hard-coded local event calendar (holidays, Poconos ski weekends, Pocono Raceway) beats reactive detection.
5. **Guest-facing volatility** — repeat guests complain "$179 one night, $329 the next" ([BiggerPockets: "I fired dynamic pricing today"](https://www.biggerpockets.com/forums/530/topics/1227948-i-fired-dynamic-pricing-today)). Bounded seasonal tiers + smoothing fix this — and matter for your repeat-guest direct-booking funnel.
6. **Guardrail failures** — reports of max-price settings ignored, no self-correction on zero pacing.
7. **Billing structure** — full-month charges regardless of days synced, no seasonal pause proration, add-on creep; $0 marginal cost in-house.
8. **Duplicate-listing tax** — you pay per Lodgify row; 2 houses = 4 listings billed. In-house prices by nickname group.
9. **Weekly tuning burden with opaque knobs** — HLP's "market driven" defaults change daily and are less predictable than fixed rules; your own rules are fully transparent.

Not beatable in-house: the 10M-listing data network, block-removal classifier, and their revenue team's manual event entry at global scale — but at 2 houses in 1 market you don't need global scale.

---

## 7. What the codebase already has that helps

From `/Users/dankdesign/guest-portal`:

- **Lodgify client** (`src/lib/lodgify/client.ts`) — `X-ApiKey` auth with `LODGIFY_API_KEY` (the exact credential the write endpoint needs), `GET /v2/properties/{id}/rooms` (already fetches the `room_type_id` required in the write payload), availability reads, v2 quote reads, webhook subscribe/list/unsubscribe including `rate_change` and `availability_change` events, booking create/delete. **Missing only two methods: `POST /v1/rates/savewithoutavailability` and `GET /v1|v2/rates/calendar`.**
- **Sync engine + booking DB** (`src/lib/lodgify/sync.ts`) — every booking lives in `registration` with `check_in_date`, `check_out_date`, `status`, `booking_source`, `booked_at`, `total_amount_cents` (rent-only, from v2 `subtotals.stay`), and `nightly_rates_snapshot` jsonb. This is exactly the own-listing dataset needed for occupancy/pace/orphan-gap computation — plus `booked_at` gives booking-window (lead time) history PriceLabs derives from scraping. `registration_update_log` tracks changes.
- **Own-block ground truth** — `property_block` table with reasons. PriceLabs has to *infer* booked-vs-blocked; for your own calendar you have labels for free.
- **Duplicate-row handling** — nickname grouping (Lakehouse/Chalet each = 2 rows) already solved for availability; the pricer computes per nickname and writes to both rows.
- **Cron infrastructure** — `vercel.json` crons with `CRON_SECRET` auth, 300s max duration; nightly Lodgify sync already runs at midnight UTC. Add one pricing cron.
- **PriceLabs client** (`src/lib/pricelabs/client.ts`) — `getNightlyRates()` via `POST https://api.pricelabs.co/v1/listing_prices`; consumers (`src/lib/pricing/booking-quote.ts`, checkout/quotes routes) already fall back to Lodgify quotes. Swap-in point: replace the PriceLabs call with a read from your own rates table; the fallback chain means migration is low-risk.
- **Admin UI slot** — `/admin/settings/properties/[id]/pricing` is the natural (not-yet-created) sibling of `promos`/`services`/`settings` for a pricing dashboard.
- **Promo engine** — already exceeds anything PriceLabs offers for promotions; discounting stays out of the pricer entirely.

---

## 8. Build sketch: minimal in-house engine + pipeline

### Data model (Supabase)
- `nightly_rate` — (property_nickname, date, price_cents, min_stay, computed_at, factors jsonb for explainability, pushed_at, push_status)
- `pricing_config` per nickname — base_price_cents, min/max_price_cents, seasonal tiers (date-range → base override), DOW multipliers, lead-time curve params, gap rules, min-stay rules, event overrides (date-range, multiplier or fixed, label)
- `comp_listing` + `comp_calendar_snapshot` (optional Phase 2) — 5–10 hand-picked Airbnb comps, daily availability/price diffs

### The algorithm (nightly, per nickname, 365-day horizon)
```
price(d) = base(season(d))                      # host-set seasonal tiers — replaces learned seasonality
         × dow(d)                               # e.g. Fri/Sat 1.15–1.30
         × event(d)                             # hard-coded local calendar + manual overrides
         × leadtime(days_until(d))              # e.g. −5% @14d, −10% @7d, −15% @3d, −20% @1d
                                                #   (FreeWyld curve; steeper cliffs train guests to wait)
         × pace(d)                              # own-occupancy controller: compare booked% in d's bucket
                                                #   vs same-time-last-year from `registration.booked_at`
                                                #   history; nudge ±5%, cap ±15–20%
         × gap(d)                               # 1–2-night orphan: your choice of −15% or +premium;
                                                #   min_stay(d)=gap length so gaps are bookable
apply biggest-discount-wins across leadtime/gap/pace discounts (PriceLabs' anti-compounding rule)
clip to [min_price, max_price]                  # min = cleaning+supplies+utilities+reserves floor
smooth: no |Δ| > ~15% between adjacent nights except at event/season boundaries
min_stay(d): default per season; drop to 1–2 within 7 days of check-in; gap override; 
             weekend-start rules — all computed per date and written in the same rows
```
The pace controller (time-since-last-booking / occupancy-vs-target) is the one component that needs **zero market data** — it's the mechanism the BiggerPockets host used to beat PriceLabs (±5%/day on occupancy). Layer AirROI market occupancy or comp-set scraping on later as a sanity input, not a dependency.

### Push pipeline
1. Nightly cron (`/api/cron/pricing`): compute → for each Lodgify property row in the nickname group: `GET /v1/rates/calendar` (read-merge safety) → build full array (one `is_default:true` row + one row per date with `price_per_day` + `min_stay`) → `POST /v1/rates/savewithoutavailability` → `GET /v2/rates/calendar` read-back assert → log.
2. Webhook trigger: on `booking_new_status_booked` / `booking_change` / cancellation, recompute the affected window (gap rules + pace change) and repush immediately — beating PriceLabs' cadence for free.
3. Checkout integration: `booking-quote.ts` reads `nightly_rate` from the DB instead of calling PriceLabs (faster, no external dependency, identical fallback chain).
4. Admin dashboard at `/admin/settings/properties/[id]/pricing`: calendar grid with price + min-stay + factor breakdown per date, config editor, manual override with expiry, push log. Budget ~30 min/week of your attention — the same tuning PriceLabs requires anyway.

**One-time prerequisites/tests before building:** flip External Rates ON in Lodgify (note: rates/min-stay then leave the Lodgify UI); one test POST to confirm the default-rate/666 and replace semantics; one far-future distinctive price to confirm Airbnb propagation.

### What this inherently gives up
- **Market-reactive demand detection** — no comp-set pacing/pickup, no automatic detection of unknown events or demand surges. Mitigation: manual event calendar + optional AirROI/comp scrape; you already know your market's events better than the algorithm.
- **Recommended base price** — you set and periodically re-derive base from your own ADR history; no comp-set benchmark unless you add a data feed.
- **The DP-optimal lead-time curve** — you hard-code a curve instead of deriving it from P(book|price, lead time); the legacy PriceLabs defaults were hard-coded too.
- **Elasticity modeling** — no P(booking) vs price estimation at n=2 houses; statistically impossible anyway at your booking volume.
- **A vendor to blame** — guardrail bugs are now your bugs; write the min-price clamp first and test it hardest.

---

## 9. Open questions / risks

1. **Live API drift** — the write schema was verified from Feb–Mar 2025 archive snapshots (live docs are Cloudflare-blocked to bots; endpoint stable since ≥2022 and PriceLabs/Smartpricing depend on it in production). Risk low; verify with one live call.
2. **External Rates toggle side-effects** — once ON, rates/min-stay are no longer editable in Lodgify's UI, and pushed prices show only in Multi-calendar. If the pricer breaks, the manual fallback is clunky (toggle off, re-enter base rate, save). Keep a "push flat seasonal rates" escape hatch.
3. **Replace-semantics blast radius** — a buggy push replaces the entire rate table for a room type. Mitigate: always full-window pushes, read-back asserts, alert on diff, snapshot last-known-good rates in the DB.
4. **Channel propagation confirmed only by inference** — strong chain but no verbatim doc sentence; the far-future-price test settles it empirically. Also confirm which Airbnb connection type (REST vs XML) your Lodgify account uses, since LOS behavior differs.
5. **Extra-guest fees** — `price_per_additional_guest` is in the write payload and PriceLabs overwrites Lodgify's value; decide whether your pusher sets it or leaves Lodgify's (test which wins with External Rates on).
6. **Min-stay-through semantics** — Lodgify applies the *highest* min-stay across a requested stay window; design gap min-stay overrides with that in mind.
7. **Booking.com / other channels** — only daily/weekly/monthly rates propagate there; irrelevant if you're Airbnb/Vrbo/direct only, worth confirming.
8. **Comp data phase-2 legality** — Apify scraping of comps violates Airbnb ToS; as a host your exposure is account termination. AirROI/Airbtics shift that risk to the vendor for ~$10–30/mo.
9. **The labor question** — PriceLabs' real product is defaults + weekly nudges. The in-house tool must be honest about needing the same weekly 10 minutes; build the dashboard to make that review fast, or the tool becomes the "quiet money-loser" hosts warn about.
10. **Unverified/refuted claims to not rely on**: PriceLabs' data is *not* exclusively Airbnb/Vrbo scraping (also Booking.com + Key Data PMS actuals); published adjustment numbers are caps/legacy defaults, *not* a complete spec of current behavior; Key Data ground truth *is* commercially purchasable in some form; whether Lodgify deleted its docs Discussions section is unverified (the specific rate-write threads are gone either way, but archived).

**Net recommendation implied by the evidence:** the write path is proven, the codebase is ~80% of the pipeline already, the algorithm that captures most of PriceLabs' value for a 2-house host is a transparent rule stack with an own-pace controller, and the savings (~$780–950/yr) plus cadence/control wins justify roughly a 1–2 week build. The single highest-value first step costs one API call: prove `savewithoutavailability` against the Summit account.