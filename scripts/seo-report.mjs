#!/usr/bin/env node
/**
 * Pulls live GA4 + Search Console data. Zero dependencies — signs a service
 * account JWT with node crypto and calls the REST APIs directly.
 *
 * Setup (one time, see docs/seo-api-setup.md):
 *   GOOGLE_SA_KEY_PATH   path to the service-account JSON key
 *   GA4_PROPERTY_ID      numeric GA4 property id (NOT the G-XXXX id)
 *   GSC_SITE_URL         e.g. https://www.summitlakeside.com/
 *
 * Usage: node scripts/seo-report.mjs [days]        (default 28)
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const DAYS = Number(process.argv[2] || 28);
const KEY_PATH = process.env.GOOGLE_SA_KEY_PATH;
const GA4_ID = process.env.GA4_PROPERTY_ID;
const SITE = process.env.GSC_SITE_URL;

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: sa.client_email, scope: SCOPES, aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now };
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claim)}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`token: ${JSON.stringify(j)}`);
  return j.access_token;
}

const ago = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

async function ga4(token) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_ID}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: ago(DAYS), endDate: "today" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagedSessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
  });
  return res.json();
}

async function ga4Pages(token) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_ID}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: ago(DAYS), endDate: "today" }],
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 15,
    }),
  });
  return res.json();
}

async function gsc(token, dimension) {
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: ago(DAYS), endDate: ago(2), dimensions: [dimension], rowLimit: 25 }),
  });
  return res.json();
}

const miss = ["GOOGLE_SA_KEY_PATH", "GA4_PROPERTY_ID", "GSC_SITE_URL"].filter((k) => !process.env[k]);
if (miss.length) {
  console.error(`Missing env: ${miss.join(", ")}\nSee docs/seo-api-setup.md`);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const token = await accessToken(sa);
console.log(`\n=== Last ${DAYS} days — ${ago(DAYS)} to today ===\n`);

const ch = await ga4(token);
if (ch.error) console.log("GA4 error:", ch.error.message);
else {
  console.log("TRAFFIC BY CHANNEL");
  let ts = 0;
  for (const r of ch.rows ?? []) {
    const [chn] = r.dimensionValues.map((d) => d.value);
    const [s, u, e] = r.metricValues.map((m) => Number(m.value));
    ts += s;
    console.log(`  ${chn.padEnd(22)} sessions ${String(s).padStart(5)}  users ${String(u).padStart(5)}  engaged ${e}`);
  }
  console.log(`  ${"TOTAL".padEnd(22)} sessions ${String(ts).padStart(5)}`);
}

const pg = await ga4Pages(token);
if (!pg.error && pg.rows?.length) {
  console.log("\nTOP LANDING PAGES");
  for (const r of pg.rows) console.log(`  ${String(r.metricValues[0].value).padStart(5)}  ${r.dimensionValues[0].value}`);
}

for (const [label, dim] of [["QUERIES", "query"], ["PAGES", "page"]]) {
  const d = await gsc(token, dim);
  if (d.error) { console.log(`\nGSC ${label} error:`, d.error.message); continue; }
  const rows = d.rows ?? [];
  const c = rows.reduce((a, r) => a + r.clicks, 0), i = rows.reduce((a, r) => a + r.impressions, 0);
  console.log(`\nSEARCH — TOP ${label}  (${c} clicks / ${i} impressions in top ${rows.length})`);
  for (const r of rows.slice(0, 15)) {
    console.log(`  ${String(r.clicks).padStart(4)}c ${String(r.impressions).padStart(6)}i  pos ${r.position.toFixed(1).padStart(5)}   ${r.keys[0].slice(0, 60)}`);
  }
}
console.log();
