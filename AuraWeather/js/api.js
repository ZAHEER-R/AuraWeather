/* ============================================================
   API — Open-Meteo + News + graceful fallbacks
   ============================================================ */
const WeatherAPI = (() => {

  async function searchPlaces(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const url = `${CONFIG.GEOCODE_URL}?name=${encodeURIComponent(query)}&count=12&language=en&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.results) return [];
      return data.results.map(r => ({
        name: r.name,
        admin1: r.admin1 || '',
        admin2: r.admin2 || '',
        country: r.country || '',
        country_code: r.country_code || '',
        lat: r.latitude,
        lon: r.longitude,
        timezone: r.timezone,
        feature: r.feature_code || '',
        label: [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(', ')
      }));
    } catch (e) {
      console.warn('Geocode failed', e);
      return [];
    }
  }

  async function reverseFromCoords(lat, lon) {
    // Lightweight label; Open-Meteo has no reverse endpoint
    try {
      // Try OpenStreetMap Nominatim (rate-limited, attribution required in production)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'AuraWeather/2.0' } }
      );
      if (res.ok) {
        const d = await res.json();
        const name = d.address?.city || d.address?.town || d.address?.village || d.address?.suburb || d.name || 'Current Location';
        return {
          name,
          admin1: d.address?.state || '',
          country: d.address?.country || '',
          lat, lon,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          label: [name, d.address?.state, d.address?.country].filter(Boolean).join(', ')
        };
      }
    } catch (_) {}
    return { name: 'Current Location', lat, lon, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, label: 'Current Location' };
  }

  async function getForecast(lat, lon, tempUnit = 'celsius') {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,surface_pressure,is_day,visibility,precipitation',
      hourly: 'temperature_2m,relative_humidity_2m,weather_code,precipitation_probability,precipitation,uv_index,wind_speed_10m,apparent_temperature',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max',
      temperature_unit: tempUnit,
      wind_speed_unit: 'kmh',
      forecast_days: '10',
      timezone: 'auto'
    });
    const res = await fetch(`${CONFIG.FORECAST_URL}?${params.toString()}`);
    if (!res.ok) throw new Error('Forecast unavailable');
    return res.json();
  }

  async function getAirQuality(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: 'us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi',
      hourly: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi',
      timezone: 'auto'
    });
    const res = await fetch(`${CONFIG.AIR_QUALITY_URL}?${params.toString()}`);
    if (!res.ok) throw new Error('AQI unavailable');
    return res.json();
  }

  async function getNews(topic = 'weather climate disaster') {
    if (!CONFIG.NEWS_API_KEY) return SAMPLE_NEWS;
    try {
      const PAGES = 3;
      const requests = Array.from({ length: PAGES }, (_, i) => {
        const params = new URLSearchParams({
          search: topic, language: 'en', sort: 'published_at',
          limit: '3', page: String(i + 1), api_token: CONFIG.NEWS_API_KEY
        });
        return fetch(`${CONFIG.NEWS_API_URL}?${params.toString()}`).then(r => r.json()).catch(() => null);
      });
      const pages = await Promise.all(requests);
      const articles = pages.flatMap(p => (p && p.data) ? p.data : []);
      if (!articles.length) return SAMPLE_NEWS;
      return articles.map(a => ({
        title: a.title, desc: a.description || '', url: a.url,
        image: a.image_url, source: a.source || 'News', time: a.published_at
      }));
    } catch (e) {
      return SAMPLE_NEWS;
    }
  }

  const SAMPLE_NEWS = [
    { title: 'Heatwave advisories issued across several regions this week', desc: 'Meteorologists urge residents to stay hydrated and avoid peak-hour sun exposure as temperatures climb.', source: 'Aura Digest', time: new Date().toISOString(), image: null },
    { title: 'Monsoon systems strengthen over coastal belts', desc: 'Weather services track a developing low-pressure system expected to bring heavy showers and possible flooding.', source: 'Aura Digest', time: new Date().toISOString(), image: null },
    { title: 'Air quality improves in major metros after overnight rain', desc: 'PM2.5 levels dropped sharply following showers, offering brief relief from smog.', source: 'Aura Digest', time: new Date().toISOString(), image: null },
    { title: 'Early-season cyclone watch: coastal communities advised to prepare', desc: 'Authorities recommend reviewing evacuation routes and emergency kits ahead of the season.', source: 'Aura Digest', time: new Date().toISOString(), image: null },
    { title: 'UV index spikes — protect skin and eyes outdoors', desc: 'High UV levels expected during midday hours; sunscreen and shade recommended.', source: 'Aura Digest', time: new Date().toISOString(), image: null }
  ];

  return { searchPlaces, reverseFromCoords, getForecast, getAirQuality, getNews };
})();
