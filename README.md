# AuraWeather — AI Weather, Disaster, Health & Travel Intelligence (SCM Project)

**Live:** https://zaheer-r.github.io/AuraWeather

AuraWeather is an AI-assisted **weather-driven life assistant** Progressive Web App (PWA). It turns live weather and air-quality data into practical guidance—what to wear, how healthy outdoor conditions are, what to pack, and what risks to watch—through a modern glass UI on mobile and desktop.

---

## What’s included (V3.5)

### Home
- Current conditions (temp, feels-like, high/low, condition, last updated)
- **Go-Outside Score™** for outdoor comfort
- Humidity, wind, UV, visibility, pressure, AQI
- Interactive weather charts (temperature, rain, UV, wind) with tooltips
- **24-hour timeline** with temperature bars and precipitation %
- **10-day forecast**
- Sun & moon arcs (rise/set)
- Place search, GPS, saved places strip
- Light / dark themes (readable contrast on light mode)

### Personal
- **Traveller safety** — available to everyone (including guests): destination summary + packing checklist
- **Signed-in only** (email or Google):
  - AI Daily Planner (weather-aware)
  - Clothing recommendations
  - Health intelligence (profile-aware alerts)
- Guests see: *Login to get health intelligence, clothing recommendations & AI daily planner*

### News
- Disaster risk for the current place (heuristic; labelled non-official)
- Weather & climate news (live API with sample fallback)

### Profile & account
- Email signup / login, **Google Sign-In**, or skip as guest
- Forgot password with OTP (demo OTP in local-first mode)
- Profile photo, editable name (signed-in)
- Saved places, theme, units, notification toggles
- **Health profile** — edit only when signed in; guests see sign-in prompt
- Login history (local)

### Platform
- Responsive layout: desktop top nav + mobile bottom nav
- Glass UI, PWA manifest (Add to Home Screen)
- Browser notification hooks (FCM-ready stubs)
- Local-first storage; optional Supabase / Firebase paths documented

---

## Access model

| Capability | Guest | Signed in |
|------------|:-----:|:---------:|
| Home weather, charts, timeline, forecast | ✓ | ✓ |
| Traveller safety & packing | ✓ | ✓ |
| News & disaster risk | ✓ | ✓ |
| Health intelligence | — | ✓ |
| Clothing recommendations | — | ✓ |
| AI Daily Planner | — | ✓ |
| Health profile edit | — | ✓ |

index.html          App shell + views
css/style.css       Theme + responsive layout
js/config.js        API endpoints, Google client, backend placeholders
js/storage.js       Local persistence (localStorage)
js/api.js           Open-Meteo + news
js/auth.js          Local SHA-256 accounts + Google GIS + OTP reset
js/intelligence.js  Clothing / health / disaster / planner / packing
js/notifications.js Browser notifications + FCM registration stub
js/app.js           UI controller, guest vs signed-in gating
js/weatherfx.js     Background weather effects
js/cartoon.js       Visual helpers
manifest.json       PWA
public/sw.js        Service worker



**Data sources**
- [Open-Meteo](https://open-meteo.com/) — forecast, AQI, geocoding (no API key)
- [TheNewsAPI](https://www.thenewsapi.com/) — weather/climate news (sample fallback if unavailable)

---

## Intelligence modules

| Module | Role |
|--------|------|
| Clothing | Outfit suggestions from temp, rain, wind, UV, AQI |
| Health alerts | Risk tips from weather + optional health profile |
| AI Daily Planner | Time-of-day activity suggestions from conditions |
| Disaster risk | Heuristic levels + safety notes for the place |
| Packing list | Travel checklist from weather and risk |
| Go-Outside Score | Outdoor comfort score from weather + AQI |

---

## Setup

1. Clone the repo and open the project folder (or serve with any static server).
2. Optional: set values in `js/config.js`:
   - `GOOGLE_CLIENT_ID` — Google Identity Services
   - `NEWS_API_KEY` — TheNewsAPI
   - `BACKEND_URL` / Firebase / Supabase — for cloud auth & sync
3. Add your site origin to **Google Cloud Console → Authorized JavaScript origins** (e.g. `https://zaheer-r.github.io`).
4. Deploy to GitHub Pages or any static host.

```bash
git clone https://github.com/ZAHEER-R/AuraWeather.git
cd AuraWeather
# serve locally, e.g.:
npx serve .
---

Team
Zaheer · Sanjay · Lakshmanan 
