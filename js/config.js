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

  // NewsAPI key — powers the live, weather-focused news feed (CNN-sourced)
  NEWS_API_KEY: "1cfb8540daa64cd1b245354db93b66f4",
  NEWS_API_URL: "https://api.thenewsapi.com/v1/news/all",

  // Google OAuth Client ID (https://console.cloud.google.com/apis/credentials)
  // Only the Client ID ever belongs here — never put a client SECRET in
  // frontend code. This app uses Google Identity Services (client-side
  // sign-in), which only needs the Client ID.
  // IMPORTANT: For GitHub Pages, add your GitHub Pages URL to
  // Authorized JavaScript origins in Google Cloud Console.
  GOOGLE_CLIENT_ID: "980188370449-etv4rgmvlkf4r4rib8fbffh28b9k2rka.apps.googleusercontent.com"
};
