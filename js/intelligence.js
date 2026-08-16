/* ============================================================
   INTELLIGENCE — clothing, health, disaster risk, daily AI tips
   Heuristic / rule-based for V1 (no external LLM key required).
   ============================================================ */
const Intelligence = (() => {

  const WMO = {
    0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
    80: 'Rain showers', 81: 'Heavy showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm'
  };

  function weatherLabel(code) { return WMO[code] || 'Unknown'; }

  function clothingRecommendation(wx, aqi) {
    const t = wx.temp;
    const rain = wx.precipProb || 0;
    const wind = wx.wind || 0;
    const uv = wx.uv || 0;
    const humid = wx.humidity || 50;
    const items = [];
    let summary = '';
    const add = (icon, label) => items.push({ icon, label });

    if (t >= 32) {
      summary = 'Hot conditions — light, breathable fabrics.';
      add('fa-shirt', 'Light cotton / linen clothing');
      add('fa-shoe-prints', 'Breathable footwear');
      add('fa-glasses', 'Sunglasses');
      add('fa-hat-cowboy', 'Wide-brim hat or cap');
      add('fa-sun', 'Sunscreen SPF 30+');
      add('fa-bottle-water', 'Carry water bottle');
    } else if (t >= 25) {
      summary = 'Warm day — comfortable summer wear.';
      add('fa-shirt', 'T-shirt or light shirt');
      add('fa-person', 'Comfortable shorts or light trousers');
      add('fa-glasses', 'Sunglasses if sunny');
      add('fa-sun', 'Sunscreen for midday');
    } else if (t >= 18) {
      summary = 'Mild — light layers work best.';
      add('fa-shirt', 'Light long sleeves or polo');
      add('fa-vest', 'Light jacket optional');
      add('fa-shoe-prints', 'Comfortable closed shoes');
    } else if (t >= 10) {
      summary = 'Cool — add a jacket.';
      add('fa-shirt', 'Long sleeves / sweater');
      add('fa-vest', 'Light to medium jacket');
      add('fa-shoe-prints', 'Closed shoes');
      add('fa-scarf', 'Optional scarf');
    } else if (t >= 0) {
      summary = 'Cold — dress warmly in layers.';
      add('fa-shirt', 'Thermal base layer');
      add('fa-vest', 'Warm sweater + insulated jacket');
      add('fa-person', 'Warm trousers');
      add('fa-mitten', 'Gloves & beanie');
      add('fa-shoe-prints', 'Insulated footwear');
    } else {
      summary = 'Freezing — full winter protection.';
      add('fa-vest', 'Heavy winter coat');
      add('fa-shirt', 'Thermal layers');
      add('fa-shoe-prints', 'Waterproof boots');
      add('fa-mitten', 'Gloves, scarf, hat');
      add('fa-fire', 'Hand warmers if needed');
    }

    if (rain >= 50) {
      add('fa-umbrella', 'Umbrella or raincoat');
      add('fa-shoe-prints', 'Waterproof shoes');
    } else if (rain >= 25) {
      add('fa-umbrella', 'Pack a compact umbrella');
    }
    if (wind >= 40) add('fa-wind', 'Windbreaker recommended');
    if (uv >= 7) add('fa-sun', 'High UV — reapply sunscreen, seek shade midday');
    if (aqi && aqi >= 100) add('fa-head-side-mask', 'Consider a mask outdoors (elevated AQI)');
    if (humid >= 80 && t >= 26) add('fa-droplet', 'High humidity — prefer moisture-wicking fabrics');

    return { summary, items, umbrella: rain >= 30, jacket: t < 18, sunscreen: uv >= 5 };
  }

  function healthAlerts(wx, aqi, healthProfile) {
    const alerts = [];
    const t = wx.temp;
    const feels = wx.feels || t;
    const uv = wx.uv || 0;
    const humid = wx.humidity || 50;
    const wind = wx.wind || 0;
    const code = wx.code || 0;
    const aqiVal = aqi || 0;
    const hp = healthProfile || {};

    if (uv >= 8) alerts.push({ id: 'uv', level: 'high', icon: '☀️', title: 'High UV Exposure', tip: 'Limit midday sun, use SPF 30+, wear hat & sunglasses.' });
    else if (uv >= 6) alerts.push({ id: 'uv', level: 'moderate', icon: '☀️', title: 'Elevated UV', tip: 'Sunscreen recommended for prolonged outdoor time.' });

    if (feels >= 38 || (t >= 35 && humid >= 60)) {
      alerts.push({ id: 'heat', level: 'high', icon: '🥵', title: 'Heat Stress Risk', tip: 'Stay hydrated, avoid strenuous outdoor activity 11:00–16:00, seek shade/AC.' });
    } else if (feels >= 32) {
      alerts.push({ id: 'heat', level: 'moderate', icon: '🥵', title: 'Warm — Dehydration Risk', tip: 'Drink water regularly; watch for dizziness or fatigue.' });
    }

    if (t <= 5) alerts.push({ id: 'cold', level: 'moderate', icon: '🥶', title: 'Cold Exposure', tip: 'Layer up, protect extremities, watch for hypothermia signs in prolonged exposure.' });

    if (aqiVal >= 150) alerts.push({ id: 'aqi', level: 'high', icon: '😷', title: 'Poor Air Quality', tip: 'Limit outdoor exertion; sensitive groups should stay indoors if possible.' });
    else if (aqiVal >= 100) alerts.push({ id: 'aqi', level: 'moderate', icon: '😷', title: 'Unhealthy for Sensitive Groups', tip: 'Asthma / heart patients: reduce prolonged outdoor activity.' });

    if ([45, 48].includes(code)) alerts.push({ id: 'fog', level: 'moderate', icon: '🌫️', title: 'Fog / Low Visibility', tip: 'Drive carefully; use low beams; allow extra travel time.' });

    if ([95, 96, 99].includes(code)) alerts.push({ id: 'storm', level: 'high', icon: '⛈️', title: 'Thunderstorm', tip: 'Seek sturdy shelter; avoid open fields, tall trees, and water.' });

    // Profile-aware
    if (hp.conditions) {
      if (hp.conditions.includes('asthma') && (aqiVal >= 80 || humid >= 80 || [61, 63, 65, 80, 81].includes(code))) {
        alerts.push({ id: 'asthma', level: 'high', icon: '🫁', title: 'Asthma Risk Elevated', tip: 'Carry inhaler; prefer indoor activity; avoid smoke and heavy pollen if known.' });
      }
      if (hp.conditions.includes('migraine') && (humid >= 75 || wind >= 35 || [95, 96].includes(code))) {
        alerts.push({ id: 'migraine', level: 'moderate', icon: '🤕', title: 'Possible Migraine Trigger', tip: 'Weather shifts & humidity can trigger migraines — stay hydrated and rest if needed.' });
      }
      if (hp.conditions.includes('heart') && (feels >= 32 || aqiVal >= 100)) {
        alerts.push({ id: 'cardio', level: 'high', icon: '❤️', title: 'Cardiovascular Stress', tip: 'Avoid heavy outdoor exercise in heat or poor air; consult your care plan.' });
      }
      if (hp.sensitivities?.includes('pollen') && t >= 15 && t <= 28 && rain < 20) {
        alerts.push({ id: 'pollen', level: 'moderate', icon: '🌼', title: 'Pollen / Allergy Caution', tip: 'Consider antihistamine if prescribed; shower after outdoor time; keep windows closed if severe.' });
      }
    }

    if (hp.fitness?.includes('running') || hp.fitness?.includes('cycling')) {
      // fitness tip injected in daily planner
    }

    return alerts;
  }

  function disasterRisk(wx, place) {
    // Heuristic risk model (NOT official alerts). Clearly labelled as prediction.
    const risks = [];
    const rain = wx.precipProbMax || wx.precipProb || 0;
    const precipSum = wx.precipSum || 0;
    const wind = wx.windMax || wx.wind || 0;
    const code = wx.code || 0;
    const lat = place?.lat || 0;
    const country = (place?.country || '').toLowerCase();

    // Flood / heavy rain
    let floodLevel = 'Low';
    if (precipSum >= 50 || rain >= 80) floodLevel = 'High';
    else if (precipSum >= 25 || rain >= 60) floodLevel = 'Moderate';
    risks.push({
      type: 'Flood', icon: '🌧️', level: floodLevel,
      note: floodLevel === 'Low' ? 'No significant rainfall-driven flood signal from current forecast.' :
        'Heavy rain in forecast — low-lying areas, drains and underpasses may flood. Follow local authority guidance.',
      guidance: ['Avoid walking/driving through flood water', 'Move valuables to higher levels if in flood-prone zone', 'Monitor official weather service alerts']
    });

    // Cyclone / severe storm (tropical belt heuristic)
    let cycloneLevel = 'Low';
    if ([95, 96, 99].includes(code) && wind >= 60) cycloneLevel = 'High';
    else if (wind >= 50 || [95, 96].includes(code)) cycloneLevel = 'Moderate';
    risks.push({
      type: 'Cyclone / Severe Storm', icon: '🌀', level: cycloneLevel,
      note: 'Based on wind & thunderstorm indicators in the forecast — not a named-storm track. Check national meteorological agency for official cyclone warnings.',
      guidance: ['Secure loose outdoor objects', 'Know your evacuation zone if coastal', 'Keep emergency kit ready during severe season']
    });

    // Heatwave
    const tMax = wx.tempMax || wx.temp || 0;
    let heatLevel = 'Low';
    if (tMax >= 42) heatLevel = 'Extreme';
    else if (tMax >= 38) heatLevel = 'High';
    else if (tMax >= 35) heatLevel = 'Moderate';
    risks.push({
      type: 'Heatwave', icon: '🔥', level: heatLevel,
      note: heatLevel === 'Low' ? 'Temperatures within typical range.' : 'Elevated heat — vulnerable populations at higher risk.',
      guidance: ['Hydrate frequently', 'Limit outdoor work in peak heat', 'Check on elderly neighbours']
    });

    // Earthquake / tsunami / volcano — no real-time free global feed here; static info
    risks.push({
      type: 'Earthquake', icon: '🌍', level: 'Low',
      note: 'Live seismic monitoring requires regional agency feeds (USGS, IMD, etc.). This app does not replace official earthquake early-warning systems.',
      guidance: ['Drop, Cover, Hold On during shaking', 'Identify safe spots at home/work', 'Follow national disaster management authority']
    });
    risks.push({
      type: 'Tsunami', icon: '🌊', level: 'Low',
      note: 'Tsunami risk is coastal and event-driven. Only official agencies issue tsunami warnings after major undersea quakes.',
      guidance: ['If official warning: move inland / to higher ground immediately', 'Never go to the shore to watch a tsunami']
    });
    risks.push({
      type: 'Wildfire', icon: '🔥', level: (tMax >= 35 && (wx.humidity || 50) < 30 && wind >= 30) ? 'Moderate' : 'Low',
      note: 'Dry + hot + windy conditions can elevate fire danger in susceptible regions.',
      guidance: ['Obey local burn bans', 'Report smoke promptly', 'Prepare defensible space if in wildland-urban interface']
    });
    risks.push({
      type: 'Landslide', icon: '⚠️', level: (precipSum >= 40 && (place?.admin1 || '').toLowerCase().match(/hill|mountain|ghats/)) ? 'Moderate' : 'Low',
      note: 'Landslide risk rises with prolonged heavy rain on steep terrain.',
      guidance: ['Avoid steep slopes during/after extreme rain', 'Watch for new cracks or tilting trees']
    });

    return risks;
  }

  function dailyPlanner(wx, aqi, clothing, healthAlertsList) {
    const tips = [];
    const t = wx.temp;
    const rain = wx.precipProb || 0;
    const uv = wx.uv || 0;
    const aqiVal = aqi || 0;

    tips.push({ cat: 'Weather', text: `${weatherLabel(wx.code)} · ${Math.round(t)}° · Feels ${Math.round(wx.feels || t)}°` });
    tips.push({ cat: 'Clothing', text: clothing.summary });
    if (clothing.umbrella) tips.push({ cat: 'Rain', text: 'Carry an umbrella today.' });
    if (uv >= 6) tips.push({ cat: 'UV', text: 'Best outdoor time before 10:00 or after 16:00 to reduce UV exposure.' });
    if (rain < 30 && t >= 15 && t <= 28 && aqiVal < 100) {
      tips.push({ cat: 'Exercise', text: 'Good conditions for a walk, run or outdoor workout.' });
    } else if (aqiVal >= 100 || rain >= 50) {
      tips.push({ cat: 'Exercise', text: 'Prefer indoor exercise today (air quality or rain).' });
    }
    if (rain < 20 && t >= 18 && t <= 30) tips.push({ cat: 'Laundry', text: 'Favourable for outdoor drying of clothes.' });
    if (uv >= 3 && rain < 40) tips.push({ cat: 'Photography', text: 'Decent light for outdoor photos; golden hour near sunrise/sunset.' });
    if (healthAlertsList.length) {
      tips.push({ cat: 'Health', text: healthAlertsList[0].title + ' — ' + healthAlertsList[0].tip });
    }
    tips.push({ cat: 'Hydration', text: t >= 28 ? 'Aim for extra water intake in the heat.' : 'Maintain regular water intake.' });
    return tips;
  }

  function packingList(wx, opts = {}) {
    // Returns [{ icon: 'fa-...', label: '...' }] based on temp, rain, UV, time-of-day, disaster risk
    const t = wx.temp ?? 22;
    const rain = wx.precipProb ?? 0;
    const uv = wx.uv ?? 0;
    const aqi = wx.aqi ?? 50;
    const hour = opts.localHour != null ? opts.localHour : new Date().getHours();
    const isNight = hour < 6 || hour >= 20;
    const isMorning = hour >= 6 && hour < 11;
    const isAfternoon = hour >= 11 && hour < 17;
    const risks = opts.risks || [];
    const highFlood = risks.some(r => r.type === 'Flood' && ['High', 'Extreme'].includes(r.level));
    const highHeat = risks.some(r => r.type === 'Heatwave' && ['High', 'Extreme', 'Moderate'].includes(r.level));
    const highStorm = risks.some(r => /Cyclone|Storm/i.test(r.type) && ['High', 'Moderate'].includes(r.level));

    const items = [
      { icon: 'fa-id-card', label: 'ID / documents' },
      { icon: 'fa-plug', label: 'Phone charger' },
      { icon: 'fa-pills', label: 'Medications' }
    ];

    if (rain >= 25 || highFlood || highStorm) {
      items.push({ icon: 'fa-umbrella', label: 'Umbrella / rain jacket' });
      items.push({ icon: 'fa-shoe-prints', label: 'Waterproof shoes' });
    }
    if (t < 12 || isNight && t < 18) {
      items.push({ icon: 'fa-vest', label: 'Warm jacket / layers' });
      items.push({ icon: 'fa-mitten', label: 'Gloves or scarf (if cold)' });
    } else if (t < 18) {
      items.push({ icon: 'fa-shirt', label: 'Light jacket or sweater' });
    } else if (t >= 28 || highHeat) {
      items.push({ icon: 'fa-shirt', label: 'Light breathable clothing' });
      items.push({ icon: 'fa-bottle-water', label: 'Water bottle' });
      items.push({ icon: 'fa-sun', label: 'Sunscreen / moisturizer' });
      items.push({ icon: 'fa-hat-cowboy', label: 'Hat / cap' });
    } else if (t >= 22) {
      items.push({ icon: 'fa-bottle-water', label: 'Water bottle' });
      if (uv >= 5 || isAfternoon) items.push({ icon: 'fa-sun', label: 'Sunscreen' });
    }
    if (uv >= 6 && !isNight) items.push({ icon: 'fa-glasses', label: 'Sunglasses' });
    if (aqi >= 100) items.push({ icon: 'fa-head-side-mask', label: 'Face mask (air quality)' });
    if (isMorning) items.push({ icon: 'fa-mug-hot', label: 'Light breakfast / hydration' });
    if (isNight) items.push({ icon: 'fa-lightbulb', label: 'Small flashlight / phone light' });
    if (highFlood) items.push({ icon: 'fa-kit-medical', label: 'Emergency contacts list' });

    // dedupe by label
    const seen = new Set();
    return items.filter(i => (seen.has(i.label) ? false : (seen.add(i.label), true)));
  }

  function goOutsideScore(wx, aqi) {
    // 0–100 composite
    let score = 70;
    const t = wx.temp;
    const feels = wx.feels || t;
    const rain = wx.precipProb || 0;
    const wind = wx.wind || 0;
    const aqiVal = aqi || 50;
    if (feels < 5 || feels > 36) score -= 25;
    else if (feels < 10 || feels > 32) score -= 12;
    if (rain >= 70) score -= 30;
    else if (rain >= 40) score -= 15;
    if (wind >= 50) score -= 20;
    else if (wind >= 35) score -= 10;
    if (aqiVal >= 150) score -= 30;
    else if (aqiVal >= 100) score -= 15;
    else if (aqiVal >= 50) score -= 5;
    if ([95, 96, 99].includes(wx.code)) score -= 25;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  return {
    weatherLabel, clothingRecommendation, healthAlerts, disasterRisk,
    dailyPlanner, packingList, goOutsideScore
  };
})();
