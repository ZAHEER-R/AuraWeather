# AuraWeather — AI Weather, Disaster, Health & Travel Intelligence

**Live:** https://zaheer-r.github.io/AuraWeather

Production-oriented **local-first (V1)** Progressive Web App with clean hooks for **V2 backend + Firebase Cloud Messaging**.

## What is included (V1)

- Modern glass UI, dark/light theme, responsive mobile + tablet layouts, bottom nav on small screens
- Open-Meteo weather, AQI, geocoding (no API key)
- News via TheNewsAPI with graceful sample fallback
- Email signup/login + Google Sign-In (GIS) + **Skip for now**
- **Forgot password** with OTP verification (demo OTP on-screen/console in V1; wire email/FCM in V2)
- Profile, photo, settings, saved cities, search history, login history — all **localStorage**
- Notification toggle that **requests permission** (works on mobile/tablet browsers that support the Notification API)
- **Intel** module: clothing recommendations, health alerts (profile-aware), AI daily planner
- **Disaster** risk intelligence (heuristic levels + safety guidance; clearly labelled non-official)
- **Travel** assistant: packing checklist, saved destinations
- Optional health profile for personalization
- PWA manifest for Add to Home Screen

## Architecture

```
index.html          App shell + views
css/style.css       Theme + responsive layout
js/config.js        API endpoints, Google client, Firebase placeholders
js/storage.js       Local persistence layer (swap/sync in V2)
js/api.js           Open-Meteo + news
js/auth.js          Local SHA-256 accounts + Google + OTP reset
js/intelligence.js  Clothing / health / disaster / planner heuristics
js/notifications.js Browser notifications + FCM registration stub
js/app.js           UI controller
js/weatherfx.js     Background weather effects
js/cartoon.js       Visual helpers
manifest.json       PWA
```

## V2 roadmap (backend)

1. Set CONFIG.BACKEND_URL and implement /api/signup|login|profile|history with a real DBMS.
2. Fill CONFIG.FIREBASE and implement FCM token registration in notifications.js for:
   - news push
   - current-location weather alerts
   - forgot-password OTP delivery
3. Never put server secrets or private keys in client code.

## Deploy (GitHub Pages)

```bash
git clone https://github.com/ZAHEER-R/AuraWeather.git
cd AuraWeather
# copy enhanced files, then:
git add -A
git commit -m "AuraWeather V1: intel, disaster, travel, OTP, notifications"
git push origin main
```

Add https://zaheer-r.github.io to Google Cloud Console Authorized JavaScript origins.

## Team

Zaheer · Sanjay · Lakshmanan · Prof. Senthil Kumar P
