/* ============================================================
   APP — main controller: auth flow, search, rendering, views
   ============================================================ */
(() => {
  let state = {
    place: null,          // {name, lat, lon, timezone, label}
    forecast: null,
    aqi: null,
    unit: 'celsius',
    savedCities: JSON.parse(localStorage.getItem('aura_saved_cities') || '[]')
  };

  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);

  /* ---------------- AUTH SCREEN WIRING ---------------- */
  function initAuthScreen(){
    $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b=>b.classList.remove('active'));
      $$('.auth-form').forEach(f=>f.classList.remove('active'));
      btn.classList.add('active');
      $(`#${btn.dataset.tab}-form`).classList.add('active');
    }));

    $('#login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('#login-msg');
      msg.textContent = '';
      try{
        await Auth.login({ email: $('#login-email').value, password: $('#login-password').value });
        enterApp();
      }catch(err){ msg.textContent = err.message; }
    });

    $('#signup-form').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('#signup-msg');
      msg.textContent = '';
      try{
        await Auth.signup({
          name: $('#signup-name').value,
          email: $('#signup-email').value,
          age: $('#signup-age').value,
          place: $('#signup-place').value,
          password: $('#signup-password').value
        });
        enterApp();
      }catch(err){ msg.textContent = err.message; }
    });

    // Collapsible "log in / sign up with email" section
    $('#email-toggle-btn').addEventListener('click', () => {
      $('#email-auth-wrap').classList.toggle('hidden');
    });

    // Skip straight to the app as a guest
    $('#skip-btn').addEventListener('click', () => {
      Auth.guestLogin();
      enterApp();
    });

    initGoogleButton();
  }

  function initGoogleButton(){
    if(!CONFIG.GOOGLE_CLIENT_ID){
      // No client ID configured — show a fallback button explaining setup
      $('#google-fallback-btn').classList.remove('hidden');
      $('#google-fallback-btn').addEventListener('click', () => {
        alert('Add your GOOGLE_CLIENT_ID in js/config.js to enable real Google Sign-In.\nSee backend/README.md for the 2-minute setup guide.');
      });
      return;
    }
    let inited = false;
    // Google's button is rendered at a fixed pixel width, so we size it to
    // whatever room the card actually has (instead of a hardcoded 336px,
    // which overflowed narrow phone screens) and re-measure on resize.
    const renderBtn = () => {
      if(!(window.google && google.accounts && google.accounts.id)){
        // GIS script hasn't loaded yet — retry shortly
        setTimeout(renderBtn, 200);
        return;
      }
      if(!inited){
        google.accounts.id.initialize({
          client_id: CONFIG.GOOGLE_CLIENT_ID,
          callback: (resp) => { Auth.loginWithGoogleCredential(resp); enterApp(); }
        });
        inited = true;
      }
      const wrap = $('#google-btn-real');
      if(!wrap) return;
      wrap.innerHTML = '';
      const w = Math.max(220, Math.min(360, Math.floor(wrap.clientWidth) || 336));
      google.accounts.id.renderButton(wrap, {
        theme: 'filled_white', size: 'large', shape: 'pill', width: w, text: 'continue_with'
      });
    };
    renderBtn();
    let gBtnResizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(gBtnResizeTimer);
      gBtnResizeTimer = setTimeout(renderBtn, 200);
    });
  }

  function enterApp(){
    $('#auth-screen').classList.add('hidden');
    document.getElementById('geo-modal').classList.remove('hidden');
  }

  /* ---------------- GEO PERMISSION ---------------- */
  function initGeoModal(){
    $('#geo-allow').addEventListener('click', () => {
      navigator.geolocation?.getCurrentPosition(
        async pos => {
          const place = await WeatherAPI.reverseFromCoords(pos.coords.latitude, pos.coords.longitude);
          place.label = place.name;
          selectPlace(place);
          finishGeo();
        },
        () => { finishGeo(); loadDefaultCity(); }
      ) || (finishGeo(), loadDefaultCity());
    });
    $('#geo-skip').addEventListener('click', () => { finishGeo(); loadDefaultCity(); });
  }
  function finishGeo(){
    $('#geo-modal').classList.add('hidden');
    $('#app').classList.remove('hidden');
    hydrateAccount();
    if(window.CartoonFX) CartoonFX.setVisible(true);
    requestAnimationFrame(() => {
      if(state.forecast){ renderTempCurve(state.forecast); renderSunArc(state.forecast); }
    });
  }
  function loadDefaultCity(){
    selectPlace({ name:'Vellore', label:'Vellore, Tamil Nadu, India', lat:12.9692, lon:79.1559, timezone:'Asia/Kolkata' });
  }

  /* ---------------- NAV ---------------- */
  function initNav(){
    $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
      $$('.nav-btn').forEach(b=>b.classList.remove('active'));
      $$('.view').forEach(v=>v.classList.remove('active'));
      btn.classList.add('active');
      $(`#view-${btn.dataset.view}`).classList.add('active');
      if(btn.dataset.view === 'news') loadNews();
      if(btn.dataset.view === 'home' && state.forecast){ renderTempCurve(state.forecast); renderSunArc(state.forecast); }
      if(window.CartoonFX) CartoonFX.setVisible(btn.dataset.view === 'home');
      $('#tabbar').classList.remove('open');
      $('#menu-toggle').classList.remove('active');
    }));

    // Mobile/tablet hamburger menu — lives in the header, toggles the
    // nav into a dropdown grid on narrow screens.
    $('#menu-toggle').addEventListener('click', () => {
      $('#tabbar').classList.toggle('open');
      $('#menu-toggle').classList.toggle('active');
    });
    document.addEventListener('click', e => {
      if(!e.target.closest('.tabbar') && !e.target.closest('#menu-toggle')){
        $('#tabbar').classList.remove('open');
        $('#menu-toggle').classList.remove('active');
      }
    });
  }

  /* ---------------- SEARCH ---------------- */
  let searchTimer = null;
  function initSearch(){
    const input = $('#search-input');
    const box = $('#search-suggestions');
    const clearBtn = $('#search-clear');

    input.addEventListener('input', () => {
      clearBtn.classList.toggle('hidden', input.value.length === 0);
      clearTimeout(searchTimer);
      const q = input.value;
      searchTimer = setTimeout(async () => {
        const results = await WeatherAPI.searchPlaces(q);
        if(!results.length){ box.classList.add('hidden'); return; }
        box.innerHTML = results.map((r,i) => `
          <div class="suggestion-item" data-i="${i}">
            <b>${r.name}</b>
            <small>${[r.admin2, r.admin1, r.country].filter(Boolean).join(', ')} · ${r.timezone}</small>
          </div>`).join('');
        box.classList.remove('hidden');
        box.querySelectorAll('.suggestion-item').forEach(el => {
          el.addEventListener('click', () => {
            const r = results[+el.dataset.i];
            selectPlace(r);
            box.classList.add('hidden');
            input.value = r.label;
            clearBtn.classList.remove('hidden');
          });
        });
      }, 300);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      box.classList.add('hidden');
      input.focus();
    });

    document.addEventListener('click', e => {
      if(!e.target.closest('.search-wrap')) box.classList.add('hidden');
    });
  }

  async function selectPlace(place){
    state.place = place;
    $('#place-name').textContent = place.label || place.name;
    await refreshWeather();
    if(!state.savedCities.find(c => c.name === place.name && c.lat === place.lat)){
      state.savedCities.unshift(place);
      state.savedCities = state.savedCities.slice(0, 8);
      localStorage.setItem('aura_saved_cities', JSON.stringify(state.savedCities));
      renderSavedCities();
    }
  }

  /* ---------------- WEATHER RENDER ---------------- */
  async function refreshWeather(){
    const { place } = state;
    const [fc, aqi] = await Promise.all([
      WeatherAPI.getForecast(place.lat, place.lon, state.unit),
      WeatherAPI.getAirQuality(place.lat, place.lon)
    ]);
    state.forecast = fc; state.aqi = aqi;
    renderCurrent(fc);
    renderHourly(fc);
    renderDaily(fc);
    renderTempCurve(fc);
    renderSunArc(fc);
    renderPollution(aqi, place.label || place.name);
    renderComfortScore(fc, aqi);
    const isDay = fc.current?.is_day === 1;
    WeatherFX.modeFromWMO(fc.current?.weather_code ?? 0, isDay);
  }

  const WMO_TEXT = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',
    51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',56:'Freezing drizzle',57:'Freezing drizzle',
    61:'Slight rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',
    71:'Slight snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',
    82:'Violent rain showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm + hail',99:'Severe thunderstorm + hail'};
  const WMO_ICON = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌁',51:'🌦️',53:'🌦️',55:'🌧️',56:'🌧️',57:'🌧️',
    61:'🌧️',63:'🌧️',65:'⛈️',66:'🌧️',67:'🌧️',71:'🌨️',73:'❄️',75:'❄️',77:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',
    85:'🌨️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️'};

  function unitSymbol(){ return state.unit === 'celsius' ? '°C' : '°F'; }

  function renderCurrent(fc){
    const c = fc.current;
    $('#hero-temp').textContent = Math.round(c.temperature_2m) + '°';
    $('#hero-cond').textContent = `${WMO_ICON[c.weather_code]||'🌡️'} ${WMO_TEXT[c.weather_code] || 'Unknown'}`;
    $('#hero-max').textContent = `H: ${Math.round(fc.daily.temperature_2m_max[0])}°`;
    $('#hero-min').textContent = `L: ${Math.round(fc.daily.temperature_2m_min[0])}°`;
    $('#hero-feels').textContent = `Feels ${Math.round(c.apparent_temperature)}°`;
    $('#stat-humidity').textContent = c.relative_humidity_2m + '%';
    $('#stat-wind').textContent = Math.round(c.wind_speed_10m) + ' km/h';
    $('#stat-uv').textContent = (fc.daily.uv_index_max[0] ?? '--');
    $('#stat-visibility').textContent = '15 km';
    $('#stat-pressure').textContent = Math.round(c.surface_pressure) + ' hPa';
    updateTimestamp();
  }

  function updateTimestamp(){
    const el = $('#hero-updated');
    if(!el) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const date = now.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
    el.textContent = `Updated ${time} · ${date}`;
  }

  function renderHourly(fc){
    const el = $('#hourly-bars');
    const times = fc.hourly.time, temps = fc.hourly.temperature_2m, codes = fc.hourly.weather_code;
    const today = fc.current.time.slice(0,10);
    const todaysIdx = times.map((t,i)=>i).filter(i => times[i].slice(0,10) === today);
    const maxT = Math.max(...todaysIdx.map(i=>temps[i]));
    const minT = Math.min(...todaysIdx.map(i=>temps[i]));
    el.innerHTML = todaysIdx.map(i => {
      const hh = new Date(times[i]).getHours();
      const pct = Math.max(8, Math.round(((temps[i]-minT)/((maxT-minT)||1))*100));
      return `<div class="hour-col">
        <span class="h-time">${hh===0?'12am':hh===12?'12pm':hh>12?(hh-12)+'pm':hh+'am'}</span>
        <span class="h-icon">${WMO_ICON[codes[i]]||'🌡️'}</span>
        <div class="h-bar-track"><div class="h-bar-fill" style="height:${pct}%"></div></div>
        <span class="h-temp">${Math.round(temps[i])}°</span>
      </div>`;
    }).join('');
  }

  function renderDaily(fc){
    const el = $('#daily-list');
    const d = fc.daily;
    const globalMax = Math.max(...d.temperature_2m_max);
    const globalMin = Math.min(...d.temperature_2m_min);
    el.innerHTML = d.time.map((t,i) => {
      const day = new Date(t).toLocaleDateString('en-US',{weekday:'short'});
      const left = ((d.temperature_2m_min[i]-globalMin)/((globalMax-globalMin)||1))*100;
      const width = ((d.temperature_2m_max[i]-d.temperature_2m_min[i])/((globalMax-globalMin)||1))*100;
      return `<div class="day-row">
        <span class="d-name">${i===0?'Today':day}</span>
        <span class="d-icon">${WMO_ICON[d.weather_code[i]]||'🌡️'}</span>
        <span class="d-rain">💧${d.precipitation_probability_max[i]}%</span>
        <div class="d-range">
          <span>${Math.round(d.temperature_2m_min[i])}°</span>
          <div class="range-track"><div class="range-fill" style="left:${left}%;width:${Math.max(6,width)}%"></div></div>
        </div>
        <span class="d-max">${Math.round(d.temperature_2m_max[i])}°</span>
      </div>`;
    }).join('');
    $('#sunrise-time').textContent = new Date(d.sunrise[0]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    $('#sunset-time').textContent = new Date(d.sunset[0]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const moonPhases = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
    const dayOfMonth = new Date().getDate();
    $('#moon-phase').textContent = moonPhases[Math.floor((dayOfMonth/29.5)*8)%8];
  }

  function contentWidth(el){
    const cs = getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  // Mobile stays compact; tablets and desktops get a taller/wider chart
  // instead of being stuck at the same small size as a phone.
  function chartSizes(){
    const w = window.innerWidth;
    if(w >= 1280) return { curveH: 280, arcH: 200, arcMaxW: 460 };
    if(w >= 900)  return { curveH: 240, arcH: 170, arcMaxW: 380 };
    return { curveH: 210, arcH: 140, arcMaxW: 280 };
  }

  function renderTempCurve(fc){
    const canvas = $('#temp-curve');
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    canvas.width = Math.max(240, contentWidth(parent)); canvas.height = chartSizes().curveH;
    const times = fc.hourly.time, temps = fc.hourly.temperature_2m, codes = fc.hourly.weather_code;
    const today = fc.current.time.slice(0,10);
    const idx = times.map((t,i)=>i).filter(i=>times[i].slice(0,10)===today);
    const vals = idx.map(i=>temps[i]);
    const max = Math.max(...vals), min = Math.min(...vals);
    const w = canvas.width, h = canvas.height;
    const padTop = 42, padBottom = 26, padSide = 14;
    const plotH = h - padTop - padBottom;
    ctx.clearRect(0,0,w,h);

    const xFor = i => padSide + (i/(vals.length-1))*(w-padSide*2);
    const yFor = v => padTop + plotH - ((v-min)/((max-min)||1))*plotH;

    // filled curve
    const grad = ctx.createLinearGradient(0,padTop,0,h-padBottom);
    grad.addColorStop(0,'rgba(90,169,255,.35)'); grad.addColorStop(1,'rgba(90,169,255,0)');
    ctx.beginPath();
    vals.forEach((v,i) => { const x=xFor(i), y=yFor(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
    ctx.strokeStyle = 'rgba(90,169,255,0.9)'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.lineTo(xFor(vals.length-1), h-padBottom); ctx.lineTo(xFor(0), h-padBottom); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // x-axis time labels + weather emoji every 3 hours (12am -> 11pm)
    ctx.font = '10px Manrope, sans-serif';
    ctx.fillStyle = 'rgba(234,244,255,0.55)';
    ctx.textAlign = 'center';
    ctx.font = '16px sans-serif';
    for(let i=0; i<idx.length; i+=3){
      const x = xFor(i), y = yFor(vals[i]);
      // emoji marker at this hour's point on the curve
      ctx.font = '16px sans-serif';
      ctx.fillText(WMO_ICON[codes[idx[i]]] || '🌡️', x, Math.max(20, y-14));
      // hour label on the x-axis
      const hh = new Date(times[idx[i]]).getHours();
      const label = hh===0 ? '12am' : hh===12 ? '12pm' : hh>12 ? (hh-12)+'pm' : hh+'am';
      ctx.font = '10.5px Manrope, sans-serif';
      ctx.fillStyle = 'rgba(234,244,255,0.55)';
      ctx.fillText(label, x, h-6);
      ctx.fillStyle = 'rgba(234,244,255,0.55)';
    }
  }

  function renderSunArc(fc){
    const canvas = $('#sun-arc');
    const ctx = canvas.getContext('2d');
    const availW = contentWidth(canvas.parentElement.parentElement);
    const sizes = chartSizes();
    canvas.width = Math.min(sizes.arcMaxW, Math.max(220, availW)); canvas.height = sizes.arcH;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w/2, h-10, w/2-20, Math.PI, 0); ctx.stroke();
    const sunrise = new Date(fc.daily.sunrise[0]), sunset = new Date(fc.daily.sunset[0]);
    const now = new Date();
    let pct = (now - sunrise) / (sunset - sunrise);
    pct = Math.min(1, Math.max(0, pct));
    const ang = Math.PI - pct*Math.PI;
    const cx = w/2 + Math.cos(ang)*(w/2-20);
    const cy = (h-10) - Math.sin(ang)*(w/2-20);
    const glow = ctx.createRadialGradient(cx,cy,0,cx,cy,18);
    glow.addColorStop(0,'#ffe6a8'); glow.addColorStop(1,'rgba(255,230,168,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx,cy,18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffe6a8'; ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2); ctx.fill();
  }

  /* ---------------- POLLUTION ---------------- */
  function aqiTag(v){
    if(v<=50) return {label:'Good', color:'#7ee8b8'};
    if(v<=100) return {label:'Moderate', color:'#ffe08a'};
    if(v<=150) return {label:'Unhealthy (Sensitive)', color:'#ffb37e'};
    if(v<=200) return {label:'Unhealthy', color:'#ff8a8a'};
    if(v<=300) return {label:'Very Unhealthy', color:'#d98aff'};
    return {label:'Hazardous', color:'#a15252'};
  }

  function renderPollution(aqi, placeLabel){
    $('#pollution-place').textContent = placeLabel;
    const h = aqi.hourly;
    const nowIdx = h.time.findIndex(t => new Date(t) >= new Date());
    const idx = Math.max(0, nowIdx);
    const usAqi = Math.round(h.us_aqi[idx] ?? 0);
    const tag = aqiTag(usAqi);
    $('#aqi-big').textContent = usAqi;
    $('#aqi-big').style.color = tag.color;
    $('#aqi-tag').textContent = tag.label;
    $('#aqi-tag').style.background = tag.color + '33';
    $('#stat-aqi').textContent = usAqi + ' (' + tag.label + ')';

    const pollutants = [
      {name:'PM2.5', v:h.pm2_5[idx], unit:'µg/m³', note:'Fine particulate matter'},
      {name:'PM10', v:h.pm10[idx], unit:'µg/m³', note:'Coarse particulate matter'},
      {name:'Carbon Monoxide', v:h.carbon_monoxide[idx], unit:'µg/m³', note:'CO'},
      {name:'Nitrogen Dioxide', v:h.nitrogen_dioxide[idx], unit:'µg/m³', note:'NO₂'},
      {name:'Sulphur Dioxide', v:h.sulphur_dioxide[idx], unit:'µg/m³', note:'SO₂'},
      {name:'Ozone', v:h.ozone[idx], unit:'µg/m³', note:'O₃'}
    ];
    $('#pollutant-grid').innerHTML = pollutants.map(p => `
      <div class="pollutant-card">
        <span>${p.name}</span>
        <b>${p.v!=null ? Math.round(p.v) : '--'}</b>
        <span>${p.unit} · ${p.note}</span>
      </div>`).join('');

    // Morning-to-midnight trend bars (matches "morning to 12am next day" requirement)
    const today = h.time[idx].slice(0,10);
    const dayIdx = h.time.map((t,i)=>i).filter(i => h.time[i].slice(0,10)===today && new Date(h.time[i]).getHours() >= 6);
    const maxV = Math.max(...dayIdx.map(i=>h.us_aqi[i]||0), 1);
    $('#pollution-bars').innerHTML = dayIdx.map(i => {
      const hh = new Date(h.time[i]).getHours();
      const pct = Math.max(6, Math.round(((h.us_aqi[i]||0)/maxV)*100));
      return `<div class="hour-col">
        <span class="h-time">${hh}:00</span>
        <span class="h-icon">🫧</span>
        <div class="h-bar-track"><div class="h-bar-fill" style="height:${pct}%;background:linear-gradient(180deg,${aqiTag(h.us_aqi[i]||0).color},#5aa9ff)"></div></div>
        <span class="h-temp">${Math.round(h.us_aqi[i]||0)}</span>
      </div>`;
    }).join('');
  }

  /* ---------------- COMFORT SCORE (signature feature) ---------------- */
  function renderComfortScore(fc, aqi){
    const c = fc.current;
    const idx = Math.max(0, aqi.hourly.time.findIndex(t => new Date(t) >= new Date()));
    const aqiVal = aqi.hourly.us_aqi[idx] || 30;
    // Normalize each factor to 0-100 "goodness"
    const tempScore = 100 - Math.min(100, Math.abs(c.temperature_2m - 22) * 4.2);
    const humidScore = 100 - Math.min(100, Math.abs(c.relative_humidity_2m - 45) * 1.3);
    const windScore = 100 - Math.min(100, Math.max(0, c.wind_speed_10m - 15) * 3);
    const aqiScore = 100 - Math.min(100, aqiVal * 0.6);
    const score = Math.round(tempScore*0.32 + humidScore*0.23 + windScore*0.2 + aqiScore*0.25);
    $('#comfort-num').textContent = Math.max(0,Math.min(100,score));
    const circumference = 326.7;
    const offset = circumference - (Math.max(0,Math.min(100,score))/100)*circumference;
    $('#comfort-arc').style.strokeDashoffset = offset;
    let verdict = 'Great time to be outside.';
    if(score < 40) verdict = 'Consider staying in — conditions are rough right now.';
    else if(score < 65) verdict = 'Okay outdoors, but check the details below.';
    $('#comfort-sub').textContent = verdict + ' Unique to Aura — blends temp, humidity, wind & air quality into one number.';
  }

  /* ---------------- NEWS ---------------- */
  let newsLoaded = false;
  async function loadNews(){
    if(newsLoaded) return;
    newsLoaded = true;
    $('#news-status').textContent = 'Loading…';
    const items = await WeatherAPI.getNews('weather');
    $('#news-status').textContent = CONFIG.NEWS_API_KEY ? 'Live from CNN' : 'Sample feed — add NEWS_API_KEY for live headlines';
    $('#news-list').innerHTML = items.map(n => `
      <div class="news-item" onclick="${n.url ? `window.open('${n.url}','_blank')` : ''}">
        <img class="news-thumb" src="${n.image || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2296%22 height=%2272%22></svg>'}" alt="">
        <div class="news-body">
          <h4>${n.title}</h4>
          <p>${n.desc || ''}</p>
          <div class="news-meta">${n.source} · ${new Date(n.time).toLocaleDateString()}</div>
        </div>
      </div>`).join('');
  }

  /* ---------------- SETTINGS ---------------- */
  function initSettings(){
    const themeToggle = $('#theme-toggle');
    themeToggle.checked = localStorage.getItem('aura_theme') === 'light';
    document.body.classList.toggle('light', themeToggle.checked);
    themeToggle.addEventListener('change', () => {
      document.body.classList.toggle('light', themeToggle.checked);
      localStorage.setItem('aura_theme', themeToggle.checked ? 'light':'dark');
    });

    $('#unit-select').addEventListener('change', async e => {
      state.unit = e.target.value;
      if(state.place) await refreshWeather();
    });

    $('#alerts-toggle').addEventListener('change', e => {
      if(e.target.checked && 'Notification' in window) Notification.requestPermission();
    });

    renderSavedCities();
  }

  function renderSavedCities(){
    $('#saved-cities').innerHTML = state.savedCities.map((c,i) => `
      <div class="city-chip" data-i="${i}">${c.name} <span class="remove" data-remove="${i}">✕</span></div>
    `).join('') || `<p style="color:var(--text-dim);font-size:13px;">No saved cities yet — search a city on Home, then it appears here automatically.</p>`;
    $$('.city-chip').forEach(chip => chip.addEventListener('click', e => {
      if(e.target.dataset.remove !== undefined && e.target.dataset.remove !== ''){
        return;
      }
      const i = +chip.dataset.i;
      selectPlace(state.savedCities[i]);
    }));
    $$('[data-remove]').forEach(x => x.addEventListener('click', e => {
      e.stopPropagation();
      state.savedCities.splice(+x.dataset.remove, 1);
      localStorage.setItem('aura_saved_cities', JSON.stringify(state.savedCities));
      renderSavedCities();
    }));
  }

  /* ---------------- ACCOUNT ---------------- */
  function hydrateAccount(){
    const u = Auth.getUser();
    if(!u) return;
    $('#account-name').textContent = u.name || '--';
    $('#account-email').textContent = u.email || '--';
    $('#account-age').textContent = u.age || '--';
    $('#account-place').textContent = u.place || '--';
    $('#account-login-method').textContent = u.method === 'google' ? 'Google' : 'Email';
    $('#account-photo').src = u.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name||'A')}`;
  }
  function initAccount(){
    $('#logout-btn').addEventListener('click', () => Auth.logout());
    $('#photo-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try{
          const user = await Auth.updateProfile({ photo: reader.result });
          hydrateAccount();
        }catch(err){ alert(err.message); }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- BOOT ---------------- */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if(state.forecast){ renderTempCurve(state.forecast); renderSunArc(state.forecast); }
    }, 150);
  });

  function boot(){
    initAuthScreen();
    initGeoModal();
    initNav();
    initSearch();
    initSettings();
    initAccount();
    setInterval(updateTimestamp, 60000);

    // Splash: stamp-in logo + flaking title, then hand off to whatever
    // screen the person should actually land on.
    setTimeout(() => {
      const splash = $('#splash-screen');
      splash.classList.add('gone');
      setTimeout(() => {
        splash.style.display = 'none';
        if(Auth.isLoggedIn()){
          $('#geo-modal').classList.remove('hidden');
        } else {
          $('#auth-screen').classList.remove('hidden');
        }
      }, 520);
    }, 2200);
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
