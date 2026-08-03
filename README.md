# Aura Weather — GitHub Pages Ready

https://zaheer-r.github.io/AuraWeather

This folder is pre-configured for **GitHub Pages** static hosting.

## Folder layout
```
├── index.html
├── favicon.png
├── css/
│   └── style.css
└── js/
    ├── config.js
    ├── cartoon.js
    ├── weatherfx.js
    ├── api.js
    ├── auth.js
    └── app.js
```


## What works out of the box
- **Weather, AQI, Search** — uses free Open-Meteo APIs (no key needed).
- **Email Login / Signup** — works via your browser’s localStorage (no backend server required).
- **Google Sign-In** — button is wired. You must add your GitHub Pages URL to **Google Cloud Console → Credentials → Authorized JavaScript origins** for it to succeed.
- **News Feed** — your NewsAPI key is included. NewsAPI’s free Developer tier only allows `localhost`; on GitHub Pages it will gracefully show the built-in sample feed instead of crashing.
- **Settings, Saved Cities, Profile Photo** — all stored locally in your browser.

## Notes
- `BACKEND_URL` in `js/config.js` is intentionally left empty so the app never tries to reach `localhost:4000`.
- No Node server, no database, and no build step is required for GitHub Pages.
