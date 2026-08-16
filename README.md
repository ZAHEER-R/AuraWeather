# AuraWeather v4.1

**Handle Environment at your comfort**

AuraWeather is a personal weather & life-intelligence web app: live conditions, radar-style maps, place-aware news, health & clothing guidance, travel safety, and optional sign-in — all in a responsive PWA UI (light / dark).

---

## What's new in v4.1

| Area | Highlights |
|------|------------|
| **Auth & access** | Guest vs signed-in gating for Health Intelligence, Clothing, AI Daily Planner; health profile edit only after real sign-in |
| **Search & places** | Icon-only search that expands; recent history in the search panel; **Save place** is explicit (no auto-save); left **☰ menu** drawer for saved places |
| **Maps** | Locked OpenWeatherMap color layers (Temperature, Radar/Rain, Pressure, Wind, Clouds) with scale legend; no pan/zoom; updates with selected place |
| **News** | Today Highlights carousel (4 stories + CTA) with dots & **‹ ›** controls; full News feed refreshed for the **selected place** |
| **Alerts** | Weather, personal, and travel-safety style alerts for current + **saved locations** (browser notifications when enabled) |
| **UX / theme** | Light-theme contrast fixes; Sun & Moon path layout; install / Add to Home Screen prompts; Google button overflow fixes |

---

## Features

### Home
- Current conditions, Go-Outside Score™, humidity / wind / UV / visibility / pressure / AQI
- **Today Highlights** — rotating local-ish weather & climate headlines
- **Radar and maps** — continuous OWM weather color fields over the region
- 24-hour charts (temp, rain %, UV, wind) and 10-day forecast
- Sun & Moon path arcs
- Explicit **Save place** + **Use GPS**

### Personal
- **Traveller safety** — available to guests and signed-in users
- **Health Intelligence · Clothing recommendations · AI Daily Planner** — after email or Google sign-in (not for pure guest)

### News
- Thumbnails, sources, 24/7 refresh cadence
- Queries biased to the city / region / country you selected

### Profile
- Account, health profile (signed-in), settings (theme, units, alerts)
- Search history (saved places live in the header drawer)

---

## Stack

| Layer | Choice |
|-------|--------|
| UI | HTML / CSS / vanilla JS (no build step required) |
| Weather | Open-Meteo (forecast + air quality) |
| Geocoding | Open-Meteo Geocoding + Nominatim reverse |
| Map tiles | OSM / CARTO basemap + OpenWeatherMap weather layers |
| News | TheNewsAPI |
| Auth | Local accounts + Google Identity Services; optional Supabase / Firebase |
| Storage | localStorage first; optional cloud sync stubs |
| PWA | manifest.json + service worker |


index.html              App shell, views, drawers, install banner
css/style.css           Themes, responsive layout, map & carousel
js/config.js            API keys, endpoints, feature flags
js/api.js               Forecast, AQI, geocode, place-aware news
js/app.js               UI controller (search, map, highlights, alerts)
js/auth.js              Sign-in / sign-up / Google / guest
js/intelligence.js      Clothing, health, planner, travel heuristics
js/notifications.js     Browser notifications + alert helpers
js/storage.js           Settings, saved cities, search history
js/weatherfx.js         Background weather visuals
manifest.json           PWA
public/sw.js            Service worker


---

## Quick start

1. Unzip / clone the project.
2. Serve over **HTTP(S)** (not `file://`):

   ```bash
   npx serve .
   # or
   python -m http.server 8080

   Mode,Personal intelligence,Health profile edit
Guest,Traveller safety only,Prompt to sign in
Email / Google sign-in,"Full (health, clothing, planner)",Yes

git add -A
git commit -m "AuraWeather v4.1"
git tag v4.1
git push origin main --tags
---

## Project layout
