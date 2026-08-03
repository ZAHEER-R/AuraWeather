/* ============================================================
   CONFIG — edit these values for your deployment
   ============================================================ */
const CONFIG = {
  // Your backend (see /backend folder). Leave EMPTY for GitHub Pages
  // (the app will use browser localStorage demo accounts instead).
  BACKEND_URL: "",

  // Free, no-key weather + geocoding + air quality provider
  GEOCODE_URL: "https://geocoding-api.open-meteo.com/v1/search",
  FORECAST_URL: "https://api.open-meteo.com/v1/forecast",
  AIR_QUALITY_URL: "https://air-quality-api.open-meteo.com/v1/air-quality",

  // TheNewsAPI token — powers the live, weather-focused news feed.
  // NOTE: NewsAPI.org's free "Developer" plan blocks all direct browser
  // requests from any domain other than localhost (their CORS policy),
  // so it can never work once deployed to GitHub Pages. TheNewsAPI's
  // free plan allows direct browser requests from any origin, so it's
  // used here instead.
  NEWS_API_KEY: "5nbkDgso5eOwAUH6U8DjPhdnmY4Wi1rOi2vqcXXj",
  NEWS_API_URL: "https://api.thenewsapi.com/v1/news/all",

  // Google OAuth Client ID (https://console.cloud.google.com/apis/credentials)
  // Only the Client ID ever belongs here — never put a client SECRET in
  // frontend code. This app uses Google Identity Services (client-side
  // sign-in), which only needs the Client ID.
  // IMPORTANT: For GitHub Pages, add your GitHub Pages URL to
  // Authorized JavaScript origins in Google Cloud Console.
  GOOGLE_CLIENT_ID: "980188370449-etv4rgmvlkf4r4rib8fbffh28b9k2rka.apps.googleusercontent.com"
};
