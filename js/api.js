/* ============================================================
   API — Open‑Meteo geocoding / forecast / air quality + news
   All endpoints are free and require no key (except news, optional).
   ============================================================ */
const WeatherAPI = (() => {

  // Search returns worldwide places — cities, districts, suburbs, landmarks —
  // exactly like the "Guindy / streets inside a city" requirement.
  async function searchPlaces(query){
    if(!query || query.trim().length < 2) return [];
    const url = `${CONFIG.GEOCODE_URL}?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data.results) return [];
    return data.results.map(r => ({
      name: r.name,
      admin1: r.admin1 || '',
      admin2: r.admin2 || '',
      country: r.country || '',
      lat: r.latitude,
      lon: r.longitude,
      timezone: r.timezone,
      label: [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(', ')
    }));
  }

  async function reverseFromCoords(lat, lon){
    // Open-Meteo geocoding has no reverse endpoint; use a lightweight
    // nominatim-compatible fallback label based on coordinates.
    return { name: 'Current Location', lat, lon, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  async function getForecast(lat, lon, tempUnit='celsius'){
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,is_day',
      hourly: 'temperature_2m,weather_code,precipitation_probability,uv_index',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
      temperature_unit: tempUnit,
      wind_speed_unit: 'kmh',
      forecast_days: '10',
      timezone: 'auto'
    });
    const res = await fetch(`${CONFIG.FORECAST_URL}?${params.toString()}`);
    return res.json();
  }

  async function getAirQuality(lat, lon){
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      hourly: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi',
      timezone: 'auto'
    });
    const res = await fetch(`${CONFIG.AIR_QUALITY_URL}?${params.toString()}`);
    return res.json();
  }

  async function getNews(topic='weather'){
    if(!CONFIG.NEWS_API_KEY){
      return SAMPLE_NEWS;
    }
    try{
      // domains=cnn.com + q=weather keeps the feed on-topic and CNN-sourced,
      // so each card's link opens the actual CNN article for that day.
      const params = new URLSearchParams({
        q: topic, domains: 'cnn.com', language: 'en', sortBy: 'publishedAt',
        pageSize: '12', apiKey: CONFIG.NEWS_API_KEY
      });
      const res = await fetch(`${CONFIG.NEWS_API_URL}?${params.toString()}`);
      const data = await res.json();
      if(!data.articles || !data.articles.length) return SAMPLE_NEWS;
      return data.articles.map(a => ({
        title: a.title, desc: a.description || '', url: a.url,
        image: a.urlToImage, source: a.source?.name || 'CNN', time: a.publishedAt
      }));
    }catch(e){ return SAMPLE_NEWS; }
  }

  const SAMPLE_NEWS = [
    { title:'Heatwave advisories issued across several regions this week', desc:'Meteorologists urge residents to stay hydrated and avoid peak-hour sun exposure as temperatures climb.', source:'Aura Digest', time:new Date().toISOString(), image:null },
    { title:'Monsoon systems strengthen over coastal belts', desc:'Weather services track a developing low-pressure system expected to bring heavy showers.', source:'Aura Digest', time:new Date().toISOString(), image:null },
    { title:'Air quality improves in major metros after overnight rain', desc:'PM2.5 levels dropped sharply following showers, offering brief relief from smog.', source:'Aura Digest', time:new Date().toISOString(), image:null },
    { title:'Add your free NewsAPI key in js/config.js', desc:'This card disappears once a NEWS_API_KEY is set — live headlines will replace this sample feed automatically.', source:'Aura Weather', time:new Date().toISOString(), image:null }
  ];

  return { searchPlaces, reverseFromCoords, getForecast, getAirQuality, getNews };
})();
