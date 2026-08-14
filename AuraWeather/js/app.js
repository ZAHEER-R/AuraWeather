(() => {
  'use strict';
  let state = { place: null, forecast: null, aqi: null, unit: 'celsius', guest: false };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function boot() {
    applyTheme(Store.getSettings().theme);
    wireAuth();
    wireNav();
    wireSearch();
    wireSettings();
    wireProfile();
    wireOnboard();
    wireForgot();
    wireTip();

    if (Auth.isLoggedIn()) {
      afterAuth(false);
    } else if (sessionStorage.getItem('aura_skipped') === '1') {
      state.guest = true;
      enterAppShell(true);
    } else {
      showOnly('auth-screen');
      setTimeout(() => {
        Auth.initGoogleButton('google-btn-real', () => afterAuth(true), e => {
          const m = $('#login-msg'); if (m) m.textContent = e.message || 'Google sign-in failed';
        });
      }, 500);
    }
    setTimeout(() => {
      const sp = $('#splash-screen');
      if (sp) { sp.classList.add('fade-out'); setTimeout(() => sp.classList.add('hidden'), 500); }
    }, 1400);
  }

  function showOnly(id) {
    ['splash-screen', 'auth-screen', 'geo-modal', 'onboard-modal', 'app'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('hidden', s !== id && !(s === 'splash-screen' && id !== 'splash-screen'));
    });
    if (id !== 'splash-screen') $('#splash-screen')?.classList.add('hidden');
  }

  function afterAuth(freshLogin) {
    state.guest = false;
    sessionStorage.removeItem('aura_skipped');
    if (!Store.isHealthOnboarded()) {
      showOnly('onboard-modal');
      return;
    }
    enterAppShell(freshLogin);
  }

  function enterAppShell(askGeo) {
    showOnly('app');
    const settings = Store.getSettings();
    state.unit = settings.unit || 'celsius';
    if ($('#unit-select')) $('#unit-select').value = state.unit;
    if ($('#theme-toggle')) $('#theme-toggle').checked = settings.theme === 'light';
    if ($('#alerts-toggle')) $('#alerts-toggle').checked = !!settings.alerts;
    renderAccount();
    renderSavedCities();
    renderPlacesStrip();
    renderLoginHistory();
    fillHealthForm();
    updateNotifStatus();

    if (state.guest) {
      showToast('Please sign in to get personal recommendations');
    }

    const last = Store.getLastLocation();
    if (last) loadPlace(last);
    else if (askGeo !== false) showGeo();
    else loadPlace({ name: 'Chennai', lat: 13.08, lon: 80.27, country: 'India', label: 'Chennai, India' });
  }

  function showGeo() {
    $('#geo-modal')?.classList.remove('hidden');
  }

  /* Auth */
  function wireAuth() {
    $('#email-toggle-btn')?.addEventListener('click', () => $('#email-auth-wrap')?.classList.toggle('hidden'));
    $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $('#login-form')?.classList.toggle('active', tab === 'login');
      $('#signup-form')?.classList.toggle('active', tab === 'signup');
      $('#forgot-wrap')?.classList.add('hidden');
    }));
    $('#login-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await Auth.login({ email: $('#login-email').value, password: $('#login-password').value });
        afterAuth(true);
      } catch (err) { const m = $('#login-msg'); if (m) m.textContent = err.message; }
    });
    $('#signup-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await Auth.signup({
          name: $('#signup-name').value, email: $('#signup-email').value,
          password: $('#signup-password').value, age: null, place: ''
        });
        afterAuth(true);
      } catch (err) { const m = $('#signup-msg'); if (m) m.textContent = err.message; }
    });
    $('#skip-btn')?.addEventListener('click', () => {
      sessionStorage.setItem('aura_skipped', '1');
      state.guest = true;
      enterAppShell(true);
    });
    $('#geo-allow')?.addEventListener('click', () => {
      $('#geo-modal')?.classList.add('hidden');
      requestLocation();
    });
    $('#geo-skip')?.addEventListener('click', () => {
      $('#geo-modal')?.classList.add('hidden');
      loadPlace({ name: 'Chennai', lat: 13.08, lon: 80.27, country: 'India', label: 'Chennai, India' });
    });
    $('#use-gps-btn')?.addEventListener('click', requestLocation);
  }

  function wireForgot() {
    $('#forgot-open-btn')?.addEventListener('click', () => {
      $('#forgot-wrap')?.classList.remove('hidden');
      $('#login-form')?.classList.remove('active');
      $('#signup-form')?.classList.remove('active');
    });
    $('#forgot-request-btn')?.addEventListener('click', async () => {
      const email = $('#forgot-email')?.value;
      const msg = $('#forgot-msg');
      try {
        const res = await Auth.requestPasswordReset(email);
        if (msg) {
          msg.className = 'form-msg ok';
          msg.textContent = (res.message || 'OTP sent.') + (res.demoOtp ? ` Demo OTP: ${res.demoOtp}` : '');
        }
        // Browser notification for OTP when permitted
        if (Notify.getPermission() === 'granted' && res.demoOtp) {
          Notify.show('AuraWeather · Password reset', { body: `Your OTP is ${res.demoOtp} (valid 10 min)`, tag: 'otp' });
        }
        $('#forgot-step2')?.classList.remove('hidden');
      } catch (e) {
        if (msg) { msg.className = 'form-msg'; msg.textContent = e.message; }
      }
    });
    $('#forgot-reset-btn')?.addEventListener('click', async () => {
      const msg = $('#forgot-msg');
      try {
        await Auth.verifyOtpAndReset($('#forgot-email')?.value, $('#forgot-otp')?.value, $('#forgot-newpass')?.value);
        if (msg) { msg.className = 'form-msg ok'; msg.textContent = 'Password updated. You can log in.'; }
        setTimeout(() => {
          $('#forgot-wrap')?.classList.add('hidden');
          $('#login-form')?.classList.add('active');
        }, 1000);
      } catch (e) {
        if (msg) { msg.className = 'form-msg'; msg.textContent = e.message; }
      }
    });
  }

  function wireOnboard() {
    $('#onboard-save-btn')?.addEventListener('click', () => {
      const age = $('#ob-age')?.value, height = $('#ob-height')?.value, weight = $('#ob-weight')?.value;
      const msg = $('#onboard-msg');
      if (!age || !height || !weight) {
        if (msg) msg.textContent = 'Please fill age, height and weight.';
        return;
      }
      const profile = {
        age: +age, height: +height, weight: +weight,
        activity: $('#ob-activity')?.value || 'moderate',
        conditions: $$('#ob-conditions input:checked').map(i => i.value),
        sensitivities: $$('#ob-sens input:checked').map(i => i.value),
        fitness: $$('#ob-fit input:checked').map(i => i.value),
        updatedAt: Date.now()
      };
      Store.saveHealthProfile(profile);
      Auth.updateProfile({ age: profile.age });
      enterAppShell(true);
    });
  }

  /* Nav — 4 tabs */
  function wireNav() {
    $$('.nav-btn, .bottom-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (!view) return;
        $$('.nav-btn, .bottom-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
        if (view === 'personal') renderPersonal();
        if (view === 'news') { renderDisaster(); loadNews(); }
        if (view === 'profile') { renderAccount(); renderSavedCities(); fillHealthForm(); renderLoginHistory(); }
      });
    });
  }

  /* SEARCH — live suggestions while typing */
  function wireSearch() {
    const input = $('#search-input');
    const box = $('#search-suggestions');
    const clearBtn = $('#search-clear');
    let timer = null;
    let seq = 0;

    input?.addEventListener('input', () => {
      const q = input.value.trim();
      clearBtn?.classList.toggle('hidden', !q);
      clearTimeout(timer);
      if (q.length < 2) {
        box?.classList.add('hidden');
        box.innerHTML = '';
        return;
      }
      const my = ++seq;
      timer = setTimeout(async () => {
        try {
          const results = await WeatherAPI.searchPlaces(q);
          if (my !== seq) return; // stale
          if (!results.length) {
            box.innerHTML = '<div class="sug-empty">No places found</div>';
            box.classList.remove('hidden');
            return;
          }
          box.innerHTML = results.map((r, i) =>
            `<button type="button" class="sug-item" role="option" data-i="${i}">
              <strong>${esc(r.name)}</strong><span>${esc(r.label)}</span>
            </button>`
          ).join('');
          box._results = results;
          box.classList.remove('hidden');
          $$('.sug-item', box).forEach(el => {
            el.addEventListener('mousedown', ev => {
              ev.preventDefault(); // keep focus, avoid blur race
              const place = box._results[+el.dataset.i];
              input.value = place.label;
              box.classList.add('hidden');
              Store.pushSearch(q, place);
              loadPlace(place);
            });
          });
        } catch (e) {
          console.warn(e);
          box.innerHTML = '<div class="sug-empty">Search failed — try again</div>';
          box.classList.remove('hidden');
        }
      }, 220);
    });

    input?.addEventListener('keydown', e => {
      if (e.key === 'Escape') box?.classList.add('hidden');
    });

    clearBtn?.addEventListener('click', () => {
      if (input) input.value = '';
      clearBtn.classList.add('hidden');
      box?.classList.add('hidden');
      input?.focus();
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) box?.classList.add('hidden');
    });
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported');
      loadPlace({ name: 'Chennai', lat: 13.08, lon: 80.27, country: 'India', label: 'Chennai, India' });
      return;
    }
    showToast('Getting your location…');
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const place = await WeatherAPI.reverseFromCoords(lat, lon);
        place.lat = lat; place.lon = lon;
        loadPlace(place);
      } catch {
        loadPlace({ name: 'Current Location', lat, lon, label: 'Current Location' });
      }
    }, () => {
      showToast('Location permission denied — search a place instead');
      loadPlace({ name: 'Chennai', lat: 13.08, lon: 80.27, country: 'India', label: 'Chennai, India' });
    }, { enableHighAccuracy: true, timeout: 15000 });
  }

  async function loadPlace(place) {
    state.place = place;
    Store.setLastLocation(place);
    try {
      const [forecast, aqiData] = await Promise.all([
        WeatherAPI.getForecast(place.lat, place.lon, state.unit),
        WeatherAPI.getAirQuality(place.lat, place.lon).catch(() => null)
      ]);
      state.forecast = forecast;
      state.aqi = aqiData;
      renderHome();
      renderPersonal();
      renderDisaster();
      updateSaveBtn();
      renderPlacesStrip();
      setBackgroundVideo();
      maybeNotify();
    } catch (e) {
      console.error(e);
      showToast('Could not load weather. Check connection and try again.');
    }
  }

  function currentWx() {
    const c = state.forecast?.current || {};
    const d0 = state.forecast?.daily || {};
    const h = state.forecast?.hourly || {};
    const aqi = state.aqi?.current?.us_aqi ?? state.aqi?.hourly?.us_aqi?.[0];
    const hour = new Date().getHours();
    return {
      temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m,
      wind: c.wind_speed_10m, windMax: d0.wind_speed_10m_max?.[0], pressure: c.surface_pressure,
      code: c.weather_code, isDay: c.is_day, visibility: c.visibility,
      precipProb: h.precipitation_probability?.[hour] ?? d0.precipitation_probability_max?.[0],
      precipProbMax: d0.precipitation_probability_max?.[0], precipSum: d0.precipitation_sum?.[0],
      uv: h.uv_index?.[hour] ?? d0.uv_index_max?.[0],
      tempMax: d0.temperature_2m_max?.[0], tempMin: d0.temperature_2m_min?.[0],
      sunrise: d0.sunrise?.[0], sunset: d0.sunset?.[0], aqi
    };
  }

  function setBackgroundVideo() {
    const vid = $('#bg-video');
    if (!vid || !CONFIG.MEDIA) return;
    const wx = currentWx();
    const code = wx.code ?? 0;
    let key = 'clear';
    if (!wx.isDay) key = 'night';
    else if (code >= 95) key = 'storm';
    else if (code >= 71 && code <= 77) key = 'snow';
    else if (code >= 51 && code <= 67 || code >= 80 && code <= 82) key = 'rain';
    else if (code === 45 || code === 48) key = 'fog';
    else if (code >= 2) key = 'cloudy';
    else if (hourBetween(16, 19)) key = 'evening';
    const src = CONFIG.MEDIA[key] || CONFIG.MEDIA.clear;
    if (vid.dataset.key === key) return;
    vid.dataset.key = key;
    vid.src = src;
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.play().catch(() => {});
  }
  function hourBetween(a, b) {
    const h = new Date().getHours();
    return h >= a && h < b;
  }

  function renderHome() {
    const wx = currentWx();
    const place = state.place;
    if (!place || wx.temp == null) return;
    $('#place-name').textContent = place.label || place.name;
    $('#hero-temp').textContent = Math.round(wx.temp) + '°';
    $('#hero-cond').textContent = Intelligence.weatherLabel(wx.code);
    $('#hero-max').textContent = 'H: ' + Math.round(wx.tempMax) + '°';
    $('#hero-min').textContent = 'L: ' + Math.round(wx.tempMin) + '°';
    $('#hero-feels').textContent = 'Feels ' + Math.round(wx.feels) + '°';
    $('#hero-updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('#stat-humidity').textContent = (wx.humidity ?? '--') + '%';
    $('#stat-wind').textContent = (wx.wind != null ? Math.round(wx.wind) + ' km/h' : '--');
    $('#stat-uv').textContent = wx.uv != null ? Math.round(wx.uv) : '--';
    $('#stat-visibility').textContent = wx.visibility != null ? (wx.visibility / 1000).toFixed(1) + ' km' : '--';
    $('#stat-pressure').textContent = wx.pressure != null ? Math.round(wx.pressure) + ' hPa' : '--';
    $('#stat-aqi').textContent = wx.aqi != null ? Math.round(wx.aqi) : '--';

    const score = Intelligence.goOutsideScore(wx, wx.aqi);
    $('#comfort-num').textContent = score;
    const arc = $('#comfort-arc');
    if (arc) {
      const circ = 2 * Math.PI * 52;
      arc.style.strokeDasharray = circ;
      arc.style.strokeDashoffset = String(circ * (1 - score / 100));
    }
    $('#comfort-sub').textContent = score >= 75 ? 'Great day outside.' : score >= 50 ? 'Mixed — plan ahead.' : 'Limit outdoor time.';

    const hourly = state.forecast?.hourly;
    const bars = $('#hourly-bars');
    if (hourly && bars) {
      bars.innerHTML = '';
      for (let i = 0; i < 24; i++) {
        const t = hourly.temperature_2m?.[i];
        const code = hourly.weather_code?.[i];
        bars.innerHTML += `<div class="hour-col"><span class="h-temp">${t != null ? Math.round(t) + '°' : '--'}</span>
          <span class="h-icon">${codeIcon(code)}</span><span class="h-time">${String(i).padStart(2, '0')}:00</span></div>`;
      }
    }
    const daily = state.forecast?.daily;
    const list = $('#daily-list');
    if (daily && list) {
      list.innerHTML = (daily.time || []).map((day, i) => {
        const d = new Date(day);
        const name = i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' });
        return `<div class="day-row"><span class="day-name">${name}</span><span class="day-icon">${codeIcon(daily.weather_code[i])}</span>
          <span class="day-rain">${daily.precipitation_probability_max?.[i] ?? 0}%</span>
          <span class="day-temps"><b>${Math.round(daily.temperature_2m_max[i])}°</b> / ${Math.round(daily.temperature_2m_min[i])}°</span></div>`;
      }).join('');
    }
    if (wx.sunrise) $('#sunrise-time').textContent = fmtTime(wx.sunrise);
    if (wx.sunset) $('#sunset-time').textContent = fmtTime(wx.sunset);
    $('#moon-phase').textContent = moonPhase();
    try { WeatherFX?.setWeather?.(wx.code, wx.isDay); } catch (_) {}
  }

  function renderPersonal() {
    const wx = currentWx();
    if (wx.temp == null) return;
    const hp = Store.getHealthProfile();
    const clothing = Intelligence.clothingRecommendation(wx, wx.aqi);
    const alerts = Intelligence.healthAlerts(wx, wx.aqi, hp);
    const plan = Intelligence.dailyPlanner(wx, wx.aqi, clothing, alerts);
    const clothEl = $('#clothing-list');
    if (clothEl) {
      clothEl.innerHTML = `<p class="intel-summary">${esc(clothing.summary)}</p>` +
        clothing.items.map(i => `<div class="intel-item">👕 ${esc(i)}</div>`).join('');
    }
    const healthEl = $('#health-alerts-list');
    if (healthEl) {
      healthEl.innerHTML = alerts.length
        ? alerts.map(a => `<div class="intel-alert level-${a.level}"><span>${a.icon}</span><div><b>${esc(a.title)}</b><p class="muted">${esc(a.tip)}</p></div></div>`).join('')
        : '<div class="intel-item">No major health weather alerts right now.</div>';
    }
    const planEl = $('#daily-plan-list');
    if (planEl) {
      planEl.innerHTML = plan.map(t => `<div class="plan-row"><span class="plan-cat">${esc(t.cat)}</span><span>${esc(t.text)}</span></div>`).join('');
    }
    const pack = Intelligence.packingList(wx);
    const pel = $('#travel-pack-list');
    if (pel) pel.innerHTML = pack.map(p => `<div class="intel-item">🎒 ${esc(p)}</div>`).join('');
    if (state.place) {
      $('#travel-dest-name').textContent = state.place.label || state.place.name;
      $('#travel-dest-wx').textContent = `${Intelligence.weatherLabel(wx.code)} · ${Math.round(wx.temp)}° · AQI ${wx.aqi ?? '—'}`;
    }
  }

  function renderDisaster() {
    const risks = Intelligence.disasterRisk(currentWx(), state.place);
    const el = $('#disaster-list');
    if (!el) return;
    el.innerHTML = `<p class="disclaimer">⚠️ Predictive guidance for <b>${esc(state.place?.label || state.place?.name || 'this place')}</b> — not official alerts. Follow national agencies.</p>` +
      risks.map(r => {
        const cls = 'risk-' + r.level.toLowerCase();
        return `<div class="disaster-card ${cls}"><div class="dc-head"><span>${r.icon}</span><b>${esc(r.type)}</b>
          <span class="dc-level">${r.level}</span></div><p>${esc(r.note)}</p>
          <ul>${r.guidance.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>`;
      }).join('');
  }

  async function loadNews() {
    const list = $('#news-list');
    const status = $('#news-status');
    if (status) status.textContent = 'Loading…';
    const articles = await WeatherAPI.getNews('weather climate storm flood heatwave');
    if (status) status.textContent = articles[0]?.source === 'Aura Digest' ? 'Sample feed' : 'Live weather & climate';
    if (list) {
      list.innerHTML = articles.map(a =>
        `<a class="news-card" href="${a.url || '#'}" target="_blank" rel="noopener">
          <b>${esc(a.title)}</b><p>${esc(a.desc || '')}</p>
          <span class="news-meta">${esc(a.source)} · ${a.time ? new Date(a.time).toLocaleDateString() : ''}</span></a>`
      ).join('');
    }
  }

  function wireSettings() {
    $('#theme-toggle')?.addEventListener('change', e => {
      const theme = e.target.checked ? 'light' : 'dark';
      applyTheme(theme);
      const s = Store.getSettings(); s.theme = theme; Store.saveSettings(s);
    });
    $('#unit-select')?.addEventListener('change', e => {
      state.unit = e.target.value;
      const s = Store.getSettings(); s.unit = state.unit; Store.saveSettings(s);
      if (state.place) loadPlace(state.place);
    });
    $('#alerts-toggle')?.addEventListener('change', async e => {
      const s = Store.getSettings();
      if (e.target.checked) {
        const perm = await Notify.requestPermission();
        if (perm !== 'granted') {
          e.target.checked = false; s.alerts = false;
          showToast(perm === 'unsupported' ? 'Notifications not supported' : 'Permission denied');
        } else {
          s.alerts = true;
          Notify.show('AuraWeather', { body: 'Notifications enabled for weather & alerts.' });
          showToast('Notifications on');
        }
      } else s.alerts = false;
      Store.saveSettings(s);
      updateNotifStatus();
    });
    ['newsAlerts', 'weatherAlerts', 'disasterAlerts'].forEach(key => {
      const el = document.getElementById(key + '-toggle');
      if (!el) return;
      el.checked = Store.getSettings()[key] !== false;
      el.addEventListener('change', () => {
        const st = Store.getSettings(); st[key] = el.checked; Store.saveSettings(st);
      });
    });
  }

  function updateNotifStatus() {
    const el = $('#notif-status');
    if (!el) return;
    const p = Notify.getPermission();
    el.textContent = p === 'granted' ? 'Permission: granted' : p === 'denied' ? 'Permission: denied' : p === 'unsupported' ? 'Not supported' : 'Tap toggle to request permission';
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  }

  function updateSaveBtn() {
    const btn = $('#save-city-btn');
    if (!btn || !state.place) return;
    const saved = Store.isCitySaved(state.place.lat, state.place.lon);
    btn.textContent = saved ? '★ Saved' : '＋ Save place';
    btn.classList.toggle('saved', saved);
  }

  function renderPlacesStrip() {
    const el = $('#places-strip');
    if (!el) return;
    const cities = Store.getSavedCities();
    const cur = state.place;
    let html = '';
    if (cur) {
      html += `<button type="button" class="place-pill active" data-cur="1">${esc(cur.name || 'Current')}</button>`;
    }
    cities.forEach((c, i) => {
      if (cur && c.lat === cur.lat && c.lon === cur.lon) return;
      html += `<button type="button" class="place-pill" data-i="${i}">${esc(c.name || c.label)}</button>`;
    });
    html += `<button type="button" class="place-pill add" id="strip-add">＋ Add</button>`;
    el.innerHTML = html;
    $$('.place-pill[data-i]', el).forEach(btn => {
      btn.addEventListener('click', () => loadPlace(cities[+btn.dataset.i]));
    });
    $('#strip-add')?.addEventListener('click', () => {
      if (state.place) {
        Store.saveCity(state.place);
        renderPlacesStrip();
        renderSavedCities();
        updateSaveBtn();
        showToast('Place saved');
      }
    });
  }

  function renderSavedCities() {
    const el = $('#saved-cities');
    if (!el) return;
    const cities = Store.getSavedCities();
    if (!cities.length) {
      el.innerHTML = '<p class="muted">No saved places. Use ＋ on Home.</p>';
      return;
    }
    el.innerHTML = cities.map((c, i) =>
      `<div class="saved-chip"><button type="button" class="saved-go" data-i="${i}">${esc(c.label || c.name)}</button>
        <button type="button" class="saved-del" data-del="${i}" aria-label="Remove">✕</button></div>`
    ).join('');
    $$('.saved-go', el).forEach(b => b.addEventListener('click', () => loadPlace(cities[+b.dataset.i])));
    $$('.saved-del', el).forEach(b => b.addEventListener('click', () => {
      const c = cities[+b.dataset.del];
      Store.removeCity(c.lat, c.lon);
      renderSavedCities();
      renderPlacesStrip();
      updateSaveBtn();
    }));
  }

  function wireProfile() {
    $('#logout-btn')?.addEventListener('click', () => {
      Auth.logout();
      sessionStorage.removeItem('aura_skipped');
      location.reload();
    });
    $('#photo-input')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { Auth.updateProfile({ photo: reader.result }); renderAccount(); };
      reader.readAsDataURL(file);
    });
    $('#save-city-btn')?.addEventListener('click', () => {
      if (!state.place) return;
      if (Store.isCitySaved(state.place.lat, state.place.lon)) {
        Store.removeCity(state.place.lat, state.place.lon);
        showToast('Removed from saved');
      } else {
        Store.saveCity(state.place);
        showToast('Place saved');
      }
      updateSaveBtn();
      renderPlacesStrip();
      renderSavedCities();
    });
    $('#health-save-btn')?.addEventListener('click', () => {
      const profile = {
        age: +($('#ph-age')?.value || 0) || null,
        height: +($('#ph-height')?.value || 0) || null,
        weight: +($('#ph-weight')?.value || 0) || null,
        activity: $('#ph-activity')?.value || 'moderate',
        conditions: $$('#ph-conditions input:checked').map(i => i.value),
        sensitivities: $$('#ph-sens input:checked').map(i => i.value),
        fitness: [],
        updatedAt: Date.now()
      };
      Store.saveHealthProfile(profile);
      showToast('Health profile saved');
      renderPersonal();
    });
  }

  function renderAccount() {
    const u = Auth.getUser();
    if (!u) {
      $('#account-name').textContent = state.guest ? 'Guest' : '—';
      $('#account-email').textContent = '—';
      $('#account-login-method').textContent = state.guest ? 'Skipped' : '—';
      return;
    }
    $('#account-name').textContent = u.name || '—';
    $('#account-email').textContent = u.email || '—';
    $('#account-login-method').textContent = u.method || 'email';
    const img = $('#account-photo');
    if (img) img.src = u.photo || 'favicon.png';
  }

  function fillHealthForm() {
    const p = Store.getHealthProfile();
    if (!p) return;
    if ($('#ph-age')) $('#ph-age').value = p.age || '';
    if ($('#ph-height')) $('#ph-height').value = p.height || '';
    if ($('#ph-weight')) $('#ph-weight').value = p.weight || '';
    if ($('#ph-activity')) $('#ph-activity').value = p.activity || 'moderate';
    (p.conditions || []).forEach(c => {
      const el = document.querySelector(`#ph-conditions input[value="${c}"]`);
      if (el) el.checked = true;
    });
    (p.sensitivities || []).forEach(c => {
      const el = document.querySelector(`#ph-sens input[value="${c}"]`);
      if (el) el.checked = true;
    });
  }

  function renderLoginHistory() {
    const el = $('#login-history-list');
    if (!el) return;
    const hist = Store.getLoginHistory();
    el.innerHTML = hist.length
      ? hist.slice(0, 10).map(h => `<div class="hist-row"><span>${esc(h.email || '')}</span>
          <span>${h.success ? '✓' : '✗'} ${esc(h.method || '')}</span>
          <span class="muted">${new Date(h.at).toLocaleString()}</span></div>`).join('')
      : '<p class="muted">No login events yet.</p>';
  }

  function maybeNotify() {
    const wx = currentWx();
    const s = Store.getSettings();
    if (!s.alerts) return;
    if (wx.aqi >= 150) Notify.weatherAlert(state.place?.name || 'Location', `Unhealthy AQI ${Math.round(wx.aqi)}`);
    if ([95, 96, 99].includes(wx.code)) Notify.weatherAlert(state.place?.name || 'Location', 'Thunderstorm in the area — seek shelter.');
    if ((wx.tempMax || 0) >= 40) Notify.weatherAlert(state.place?.name || 'Location', 'Extreme heat expected.');
  }

  function wireTip() {
    const tip = $('#fixed-tip');
    if (!sessionStorage.getItem('aura_tip_done')) tip?.classList.add('show');
    $('#tip-close')?.addEventListener('click', () => {
      tip?.classList.remove('show');
      sessionStorage.setItem('aura_tip_done', '1');
    });
  }

  function codeIcon(code) {
    if (code == null) return '·';
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    return '⛈️';
  }
  function fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return '--'; }
  }
  function moonPhase() {
    const phases = ['New', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
    const age = ((Date.now() / 86400000) + 1.5) % 29.53;
    return phases[Math.floor((age / 29.53) * 8) % 8];
  }
  function showToast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.Aura = { state, loadPlace, Store, Auth };
  document.addEventListener('DOMContentLoaded', boot);
})();
