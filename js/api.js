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
    // Prefer local area/town over large metro city names (e.g. Vellore not Chennai)
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}` +
        `&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1&zoom=18`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'AuraWeather/4.1' }
      });
      if (res.ok) {
        const d = await res.json();
        const a = d.address || {};
        // Local-first: neighbourhood / suburb / village / town before big city
        const localName =
          a.neighbourhood ||
          a.suburb ||
          a.quarter ||
          a.residential ||
          a.hamlet ||
          a.village ||
          a.town ||
          a.city_district ||
          a.municipality ||
          a.county ||
          a.city ||
          a.state_district ||
          d.name ||
          'Current Location';
        const region = a.state || a.region || a.state_district || '';
        const country = a.country || '';
        // Avoid repeating same token in label
        const parts = [localName];
        if (region && region.toLowerCase() !== String(localName).toLowerCase()) parts.push(region);
        if (country) parts.push(country);
        return {
          name: localName,
          admin1: region,
          admin2: a.county || a.city_district || '',
          country,
          lat,
          lon,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          label: parts.filter(Boolean).join(', ')
        };
      }
    } catch (_) {}
    // Fallback: keep coordinates-based label (never invent a distant city)
    const approx = `${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}`;
    return {
      name: 'Near ' + approx,
      lat,
      lon,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      label: 'Near ' + approx
    };
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

  /**
   * Place-aware news that refreshes daily.
   * @param {string|object} topicOrPlace
   */
  async function getNews(topicOrPlace = 'weather climate disaster') {
    if (!CONFIG.NEWS_API_KEY) return SAMPLE_NEWS;
    try {
      let placeQuery = '';
      let topic = 'weather climate storm flood heatwave monsoon rain';
      if (topicOrPlace && typeof topicOrPlace === 'object') {
        const bits = [topicOrPlace.name, topicOrPlace.admin1, topicOrPlace.country]
          .filter(Boolean)
          .map(s => String(s).trim());
        placeQuery = [...new Set(bits)].slice(0, 3).join(' ');
      } else if (typeof topicOrPlace === 'string' && topicOrPlace.trim()) {
        topic = topicOrPlace.trim();
      }

      const primarySearch = placeQuery
        ? `${placeQuery} (weather OR climate OR rain OR flood OR heatwave OR cyclone OR monsoon OR storm OR AQI OR pollution)`
        : topic;

      // Prefer articles from the last ~2 days so the feed feels fresh every day
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const fetchPages = (search) => Promise.all(
        Array.from({ length: 3 }, (_, i) => {
          const params = new URLSearchParams({
            search,
            language: 'en',
            sort: 'published_at',
            limit: '3',
            page: String(i + 1),
            api_token: CONFIG.NEWS_API_KEY,
            published_after: since
          });
          return fetch(`${CONFIG.NEWS_API_URL}?${params.toString()}`).then(r => r.json()).catch(() => null);
        })
      );

      let pages = await fetchPages(primarySearch);
      let articles = pages.flatMap(p => (p && p.data) ? p.data : []);

      if (placeQuery && articles.length < 4) {
        const fallback = await fetchPages(topic);
        const extra = fallback.flatMap(p => (p && p.data) ? p.data : []);
        const seen = new Set(articles.map(a => a.url || a.title));
        extra.forEach(a => {
          const key = a.url || a.title;
          if (!seen.has(key)) {
            seen.add(key);
            articles.push(a);
          }
        });
      }

      // If still empty (API date filter too strict), retry without published_after
      if (!articles.length) {
        pages = await Promise.all(
          Array.from({ length: 3 }, (_, i) => {
            const params = new URLSearchParams({
              search: primarySearch,
              language: 'en',
              sort: 'published_at',
              limit: '3',
              page: String(i + 1),
              api_token: CONFIG.NEWS_API_KEY
            });
            return fetch(`${CONFIG.NEWS_API_URL}?${params.toString()}`).then(r => r.json()).catch(() => null);
          })
        );
        articles = pages.flatMap(p => (p && p.data) ? p.data : []);
      }

      if (!articles.length) return SAMPLE_NEWS;
      return articles.map(a => ({
        title: a.title,
        desc: a.description || a.snippet || '',
        url: a.url || '#',
        image: a.image_url || a.image || null,
        source: prettySource(a.source),
        time: a.published_at
      })).filter(a => a.title && a.url && a.url !== '#');
    } catch (e) {
      return SAMPLE_NEWS;
    }
  }

  /**
   * Pretty-print a news source domain or name.
   * e.g. "cnn.com" → "CNN", "timesofindia.indiatimes.com" → "Times of India"
   */
  function prettySource(src) {
    if (!src || typeof src !== 'string') return 'News';
    const s = String(src).trim().toLowerCase();
    const map = {
      'cnn.com': 'CNN', 'edition.cnn.com': 'CNN',
      'bbc.com': 'BBC', 'bbc.co.uk': 'BBC', 'www.bbc.com': 'BBC', 'www.bbc.co.uk': 'BBC',
      'timesofindia.indiatimes.com': 'Times of India', 'timesofindia.com': 'Times of India', 'indiatimes.com': 'Times of India',
      'timesnownews.com': 'Times Now', 'www.timesnownews.com': 'Times Now',
      'ndtv.com': 'NDTV', 'www.ndtv.com': 'NDTV',
      'hindustantimes.com': 'Hindustan Times', 'www.hindustantimes.com': 'Hindustan Times',
      'thehindu.com': 'The Hindu', 'www.thehindu.com': 'The Hindu',
      'indianexpress.com': 'Indian Express', 'www.indianexpress.com': 'Indian Express',
      'reuters.com': 'Reuters', 'www.reuters.com': 'Reuters',
      'apnews.com': 'AP News', 'www.apnews.com': 'AP News',
      'theguardian.com': 'The Guardian', 'www.theguardian.com': 'The Guardian',
      'nytimes.com': 'New York Times', 'www.nytimes.com': 'New York Times',
      'washingtonpost.com': 'Washington Post', 'www.washingtonpost.com': 'Washington Post',
      'aljazeera.com': 'Al Jazeera', 'www.aljazeera.com': 'Al Jazeera',
      'sky.com': 'Sky News', 'news.sky.com': 'Sky News',
      'weather.com': 'The Weather Channel', 'www.weather.com': 'The Weather Channel',
      'accuweather.com': 'AccuWeather', 'www.accuweather.com': 'AccuWeather',
      'independent.co.uk': 'The Independent', 'www.independent.co.uk': 'The Independent',
      'news18.com': 'News18', 'www.news18.com': 'News18',
      'zeenews.india.com': 'Zee News',
      'economictimes.indiatimes.com': 'Economic Times'
    };
    if (map[s]) return map[s];
    const domain = s.replace(/^www\./, '').split('/')[0];
    if (map[domain]) return map[domain];
    return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'News';
  }

  const SAMPLE_NEWS = [
    {
      title: 'Extreme heat warnings expand across southern Europe and South Asia',
      desc: 'Authorities urge residents to limit outdoor activity as temperatures soar past seasonal averages in multiple regions.',
      source: 'CNN',
      time: new Date().toISOString(),
      image: 'https://images.unsplash.com/photo-1504370806027-ec99f912a0c9?w=400&q=80',
      url: 'https://edition.cnn.com/weather'
    },
    {
      title: 'Monsoon systems strengthen over India\'s coastal belts',
      desc: 'Weather services track a developing low-pressure system expected to bring heavy showers and possible flooding in coming days.',
      source: 'Times of India',
      time: new Date().toISOString(),
      image: 'https://images.unsplash.com/photo-1428908728789-d2de25dbd4e2?w=400&q=80',
      url: 'https://timesofindia.indiatimes.com/topic/weather'
    },
    {
      title: 'Air quality improves in major metros after overnight rain',
      desc: 'PM2.5 levels dropped sharply following showers, offering brief relief from smog in several cities.',
      source: 'Times Now',
      time: new Date().toISOString(),
      image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=80',
      url: 'https://www.timesnownews.com/topic/weather'
    },
    {
      title: 'Early-season cyclone watch: coastal communities advised to prepare',
      desc: 'Authorities recommend reviewing evacuation routes and emergency kits ahead of the peak season.',
      source: 'NDTV',
      time: new Date().toISOString(),
      image: 'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=400&q=80',
      url: 'https://www.ndtv.com/topic/weather'
    },
    {
      title: 'UV index spikes — protect skin and eyes outdoors',
      desc: 'High UV levels expected during midday hours; sunscreen and shade strongly recommended by health agencies.',
      source: 'BBC',
      time: new Date().toISOString(),
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
      url: 'https://www.bbc.com/weather'
    },
    {
      title: 'Flash flood risk rises as intense thunderstorms approach',
      desc: 'Meteorologists warn of rapid rainfall accumulation that could overwhelm drainage systems in low-lying areas.',
      source: 'Reuters',
      time: new Date().toISOString(),
      image: 'https://images.unsplash.com/photo-1534274988757-a09d172d1f8b?w=400&q=80',
      url: 'https://www.reuters.com/business/environment/'
    }
  ];

  return { searchPlaces, reverseFromCoords, getForecast, getAirQuality, getNews };
})();
