# Giving Claude live access to GA4 + Search Console

One-time setup (~10 min). After this, `node scripts/seo-report.mjs 28` prints
live traffic and search data — no CSV exports.

Both APIs are **free and need no billing** (unlike Maps).

## 1. Service account + key

1. https://console.cloud.google.com → pick (or create) a project.
2. **APIs & Services → Library** → enable both:
   - *Google Analytics Data API*
   - *Google Search Console API*
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Name it e.g. `seo-reader`. Skip the optional role/user steps.
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   Save it OUTSIDE the repo, e.g. `~/.config/summit-seo-sa.json`.
5. Copy the service account email — looks like
   `seo-reader@PROJECT-ID.iam.gserviceaccount.com`.

## 2. Grant it read access

**GA4:** analytics.google.com → Admin → *Property access management* → **+** →
add that email with the **Viewer** role.

**Search Console:** search.google.com/search-console → your property →
Settings → *Users and permissions* → **Add user** → that email, permission
**Full** (Restricted also works for reads).

## 3. Get the GA4 property ID

GA4 → Admin → *Property details*. It's the numeric ID (e.g. `312345678`) —
NOT the `G-SR49XZL65K` measurement ID.

## 4. Add to .env.local

```
GOOGLE_SA_KEY_PATH=/Users/dankdesign/.config/summit-seo-sa.json
GA4_PROPERTY_ID=<numeric id>
GSC_SITE_URL=https://www.summitlakeside.com/
```

If the Search Console property is a *Domain* property rather than a URL-prefix
one, use `GSC_SITE_URL=sc-domain:summitlakeside.com` instead.

## 5. Run it

```
node scripts/seo-report.mjs 28      # last 28 days
node scripts/seo-report.mjs 90      # last quarter
```

Note: Search Console data lags ~2 days, so the script ends its GSC window
2 days back while GA4 runs through today.
