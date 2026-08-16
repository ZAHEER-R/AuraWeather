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
    wireSavedDrawer();
    wireWeatherMap();
    wireOnboard();
    wireForgot();
    wireTip();
    wireDownloadApk();
    initTodayHighlights();
    startAlertPolling();

    if (Auth.isLoggedIn()) {
      afterAuth(false);
    } else if (sessionStorage.getItem('aura_skipped') === '1') {
      state.guest = true;
      enterAppShell(true);
    } else {
      // Delay showing auth screen until splash completes (3.5 seconds total)
      setTimeout(() => {
        showOnly('auth-screen');
        setTimeout(() => {
          const wrap = $('#google-btn-real');
          if (wrap) {
            // Constrain before GIS render so width measurement stays inside card
            wrap.style.width = '100%';
            wrap.style.maxWidth = '100%';
            wrap.style.overflow = 'hidden';
            wrap.style.boxSizing = 'border-box';
          }
          const ok = Auth.initGoogleButton('google-btn-real', () => afterAuth(true), e => {
            const m = $('#login-msg'); if (m) m.textContent = e.message || 'Google sign-in failed';
          });
          if (wrap) {
            wrap.querySelectorAll('div').forEach(d => {
              d.style.maxWidth = '100%';
              d.style.boxSizing = 'border-box';
            });
          }
          const fb = $('#google-fallback-btn');
          if (fb) {
            fb.classList.add('hidden');
            fb.style.display = 'none';
            fb.addEventListener('click', () => {
              if (window.google?.accounts?.id) {
                try { google.accounts.id.prompt(); } catch (_) {
                  showToast('Add your site URL to Google Cloud authorized origins');
                }
              } else {
                showToast('Google Sign-In script not loaded — check network / client ID');
              }
            });
          }
          // Only show fallback if GIS did not render a button
          if (!ok && fb) {
            fb.classList.remove('hidden');
            fb.style.display = 'flex';
          } else if (ok && fb) {
            fb.classList.add('hidden');
            fb.style.display = 'none';
          }
        }, 500);
      }, 2000);
    }
    setTimeout(() => {
      const sp = $('#splash-screen');
      if (sp) { sp.classList.add('fade-out'); setTimeout(() => sp.classList.add('hidden'), 400); }
      // If still not logged in and app not shown, ensure auth is visible
      if (!$('#app') || $('#app').classList.contains('hidden')) {
        if ($('#auth-screen')?.classList.contains('hidden')) {
          showOnly('auth-screen');
        }
      }
    }, 1800);
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
    // Health profile is optional in Profile — do not block entry with onboarding form
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
    else requestLocation();
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
      // Prefer last saved place; otherwise leave user free to search (no forced Chennai)
      const last = Store.getLastLocation();
      if (last) loadPlace(last);
      else showToast('Search a city or tap Use GPS for your area');
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
          msg.textContent = (res.message || 'OTP generated successfully \n') + (res.demoOtp ? ` Demo OTP: ${res.demoOtp}` : '');
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
        if (view === 'profile') { renderAccount(); renderProfileSearchHistory(); fillHealthForm(); renderLoginHistory(); }
      });
    });
  }

  /* SEARCH — icon expands to bar; history shown when opened */
  function wireSearch() {
    const wrap = $('#search-wrap');
    const input = $('#search-input');
    const box = $('#search-suggestions');
    const openBtn = $('#search-open-btn');
    const closeBtn = $('#search-close-btn');
    const clearBtn = $('#search-clear-btn');
    let timer = null;
    let seq = 0;

    function openSearch() {
      wrap?.classList.remove('collapsed');
      wrap?.classList.add('expanded');
      setTimeout(() => input?.focus(), 50);
      showSearchHistory();
      syncClearBtn();
    }
    function closeSearch() {
      wrap?.classList.add('collapsed');
      wrap?.classList.remove('expanded');
      box?.classList.add('hidden');
      if (input) input.value = '';
      clearBtn?.classList.add('hidden');
    }
    function syncClearBtn() {
      const has = !!(input && input.value.trim());
      clearBtn?.classList.toggle('hidden', !has);
    }
    function showSearchHistory() {
      if (!box) return;
      const hist = Store.getSearchHistory().slice(0, 8);
      if (!hist.length) {
        box.innerHTML = '<div class="sug-empty">No recent searches</div>';
        box.classList.remove('hidden');
        return;
      }
      box.innerHTML = '<div class="sug-label">Recent searches</div>' + hist.map((h, i) =>
        `<button type="button" class="sug-item sug-hist" data-hi="${i}">
          <strong>${esc(h.place?.name || h.query)}</strong>
          <span>${esc(h.place?.label || h.query)}</span>
        </button>`
      ).join('');
      box._hist = hist;
      box.classList.remove('hidden');
      $$('.sug-hist', box).forEach(el => {
        el.addEventListener('mousedown', ev => {
          ev.preventDefault();
          const h = box._hist[+el.dataset.hi];
          if (h?.place) {
            input.value = h.place.label || h.query;
            box.classList.add('hidden');
            closeSearch();
            loadPlace(h.place);
          }
        });
      });
    }

    openBtn?.addEventListener('click', e => {
      e.stopPropagation();
      openSearch();
    });
    closeBtn?.addEventListener('click', e => {
      e.stopPropagation();
      closeSearch();
    });
    clearBtn?.addEventListener('click', e => {
      e.stopPropagation();
      if (input) input.value = '';
      clearBtn.classList.add('hidden');
      showSearchHistory();
      input?.focus();
    });

    input?.addEventListener('input', () => {
      const q = input.value.trim();
      syncClearBtn();
      clearTimeout(timer);
      if (q.length < 2) {
        showSearchHistory();
        return;
      }
      const my = ++seq;
      timer = setTimeout(async () => {
        try {
          const results = await WeatherAPI.searchPlaces(q);
          if (my !== seq) return;
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
              ev.preventDefault();
              const place = box._results[+el.dataset.i];
              input.value = place.label;
              box.classList.add('hidden');
              Store.pushSearch(q, place);
              closeSearch();
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
      if (e.key === 'Escape') closeSearch();
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) {
        if (wrap?.classList.contains('expanded')) closeSearch();
      }
    });
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported on this device — search a place instead');
      return;
    }
    showToast('Getting your exact location…');
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon, accuracy } = pos.coords;
      try {
        const place = await WeatherAPI.reverseFromCoords(lat, lon);
        place.lat = lat;
        place.lon = lon;
        if (accuracy != null) place.accuracy = accuracy;
        loadPlace(place);
        showToast(`Location: ${place.label || place.name}`);
      } catch {
        loadPlace({
          name: 'Current Location',
          lat,
          lon,
          label: `Current Location (${lat.toFixed(3)}, ${lon.toFixed(3)})`
        });
      }
    }, (err) => {
      const msg = err?.code === 1
        ? 'Location permission denied — allow location or search a place'
        : 'Could not get GPS fix — try again outdoors or search a place';
      showToast(msg);
      // Do NOT jump to a default city (e.g. Chennai) — keep current place if any
    }, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    });
  }

  async function loadPlace(place) {
    state.place = place;
    Store.setLastLocation(place);
    // Do NOT auto-save — user must tap Save place
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
      renderSavedDrawer();
      updateWeatherMap();
      setBackgroundVideo();
      maybeNotify();
      loadNews().catch(() => {});
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
    /* Video backgrounds disabled — static/image backgrounds via WeatherFX remain */
    const vid = $('#bg-video');
    if (vid) {
      try { vid.pause(); } catch (_) {}
      vid.removeAttribute('src');
      vid.load();
    }
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

    renderHourlyTimeline();
    render10DayForecast();
    renderAirQuality();
    renderWeatherChart(state._chartMode || 'temp');
    if (wx.sunrise) $('#sunrise-time').textContent = fmtTime(wx.sunrise);
    if (wx.sunset) $('#sunset-time').textContent = fmtTime(wx.sunset);
    updateSunMoonArcs(wx);
    updateLocalTime(place);
    try { WeatherFX?.setWeather?.(wx.code, wx.isDay); } catch (_) {}
  }


  function renderAirQuality() {
    const aqiPanel = $('#aqi-detail');
    if (!aqiPanel) return;
    const aqi = state.aqi?.current?.us_aqi ?? state.aqi?.hourly?.us_aqi?.[0];
    if (aqi == null) {
      aqiPanel.innerHTML = '<div class="chart-empty">AQI unavailable</div>';
      return;
    }
    let category = 'Good', categoryColor = '#51cf66', bgColor = 'rgba(81,207,102,0.15)';
    if (aqi <= 50) { category = 'Good'; categoryColor = '#51cf66'; bgColor = 'rgba(81,207,102,0.15)'; }
    else if (aqi <= 100) { category = 'Moderate'; categoryColor = '#ffc857'; bgColor = 'rgba(255,200,87,0.15)'; }
    else if (aqi <= 150) { category = 'Unhealthy for Sensitive Groups'; categoryColor = '#ff922b'; bgColor = 'rgba(255,146,43,0.15)'; }
    else if (aqi <= 200) { category = 'Unhealthy'; categoryColor = '#ff6b6b'; bgColor = 'rgba(255,107,107,0.15)'; }
    else if (aqi <= 300) { category = 'Very Unhealthy'; categoryColor = '#cc2d2d'; bgColor = 'rgba(204,45,45,0.15)'; }
    else { category = 'Hazardous'; categoryColor = '#7c0a02'; bgColor = 'rgba(124,10,2,0.15)'; }

    const desc = aqi <= 50 ? 'Air quality is satisfactory'
      : aqi <= 100 ? 'Air quality is acceptable; some risk for sensitive groups'
      : aqi <= 150 ? 'Members of sensitive groups may experience health effects'
      : aqi <= 200 ? 'Some members of the general public may experience health effects'
      : aqi <= 300 ? 'Health alert: risk increased for everyone'
      : 'Health warning of emergency conditions';

    // Marker position 0–100% across AQI 0–300 scale (cap)
    const markerPct = Math.min(100, Math.max(0, (aqi / 300) * 100));
    const cur = state.aqi?.current || {};
    const val = (v, div = 1) => (v != null ? Math.round(v / div) : '--');

    aqiPanel.innerHTML = `
      <div class="aqi-hero" style="background:${bgColor}">
        <div class="aqi-big" style="color:${categoryColor}">${Math.round(aqi)}</div>
        <div class="aqi-tag" style="color:${categoryColor}">${category}</div>
        <p class="aqi-desc">${desc}</p>
      </div>
      <div class="aqi-bar-wrap" style="color:${categoryColor}">
        <div class="aqi-marker" style="left:${markerPct}%;color:${categoryColor}"></div>
      </div>
      <div class="pollutant-grid">
        <div class="poll-chip"><span>PM2.5</span><b>${val(cur.pm2_5)}</b><small>µg/m³</small></div>
        <div class="poll-chip"><span>PM10</span><b>${val(cur.pm10)}</b><small>µg/m³</small></div>
        <div class="poll-chip"><span>O₃</span><b>${val(cur.ozone)}</b><small>ppb</small></div>
        <div class="poll-chip"><span>NO₂</span><b>${val(cur.nitrogen_dioxide)}</b><small>ppb</small></div>
        <div class="poll-chip"><span>SO₂</span><b>${val(cur.sulphur_dioxide)}</b><small>ppb</small></div>
        <div class="poll-chip"><span>CO</span><b>${val(cur.carbon_monoxide, 100)}</b><small>ppm</small></div>
      </div>`;
  }

  function render10DayForecast() {
    const daily = state.forecast?.daily;
    const list = $('#daily-list');
    if (!daily || !list) return;

    // Global min/max for bar scaling across 10 days
    const maxes = (daily.temperature_2m_max || []).map(Number);
    const mins = (daily.temperature_2m_min || []).map(Number);
    const gMin = Math.min(...mins.filter(n => !isNaN(n)), 0);
    const gMax = Math.max(...maxes.filter(n => !isNaN(n)), 30);
    const span = (gMax - gMin) || 1;

    list.innerHTML = (daily.time || []).slice(0, 10).map((day, i) => {
      const d = new Date(day);
      const name = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short' });
      const dateStr = d.getDate() + ' ' + d.toLocaleDateString([], { month: 'short' });
      const tempMax = Math.round(daily.temperature_2m_max[i]);
      const tempMin = Math.round(daily.temperature_2m_min[i]);
      const precipProb = daily.precipitation_probability_max?.[i] ?? 0;
      const code = daily.weather_code[i];
      const icon = codeIcon(code);

      let rainColor = 'rgba(93,222,168,0.9)';
      if (precipProb >= 70) rainColor = '#5aa9ff';
      else if (precipProb >= 40) rainColor = '#ffc857';

      // Bar range relative to global span (padding)
      const minPct = ((tempMin - gMin) / span) * 100;
      const maxPct = ((tempMax - gMin) / span) * 100;

      return `
        <div class="day-row">
          <div class="day-info">
            <span class="day-name">${name}</span>
            <span class="day-date">${dateStr}</span>
          </div>
          <span class="day-icon">${icon}</span>
          <div class="temp-bar">
            <div class="bar-container">
              <div class="bar-track"></div>
              <div class="bar-range" style="--min:${minPct}%;--max:${maxPct}%"></div>
            </div>
          </div>
          <div class="day-rain" style="color:${rainColor}">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="${rainColor}" d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z"/></svg>
            ${precipProb}%
          </div>
          <div class="day-temps">
            <span class="tmax">${tempMax}°</span>
            <span class="tmin">/ ${tempMin}°</span>
          </div>
        </div>`;
    }).join('');
  }

  function renderHourlyTimeline() {
    const hourly = state.forecast?.hourly;
    const bars = $('#hourly-bars');
    if (!hourly || !bars) return;

    const temps = (hourly.temperature_2m || []).slice(0, 24);
    const valid = temps.filter(t => t != null);
    const minTemp = valid.length ? Math.min(...valid) : 0;
    const maxTemp = valid.length ? Math.max(...valid) : 1;
    const tempRange = maxTemp - minTemp || 1;

    bars.innerHTML = '';
    for (let i = 0; i < 24; i++) {
      const t = hourly.temperature_2m?.[i];
      const code = hourly.weather_code?.[i];
      const precipProb = hourly.precipitation_probability?.[i] ?? 0;
      const icon = codeIcon(code);
      const time = String(i).padStart(2, '0');

      let tempColor = '#5aa9ff';
      if (t != null) {
        const n = (t - minTemp) / tempRange;
        if (n < 0.25) tempColor = '#7ee8b8';
        else if (n < 0.5) tempColor = '#5aa9ff';
        else if (n < 0.75) tempColor = '#ffc857';
        else tempColor = '#ff6b6b';
      }
      const barHeight = t != null ? ((t - minTemp) / tempRange * 60 + 20) : 20;

      bars.innerHTML += `
        <div class="hour-col" data-hour="${i}">
          <div class="hour-content">
            <span class="h-time">${time}:00</span>
            <span class="h-icon">${icon}</span>
            <div class="h-bar-container">
              <div class="h-bar" style="height:${barHeight}%;background-color:${tempColor}"></div>
            </div>
            <span class="h-temp" style="color:${tempColor}">${t != null ? Math.round(t) + '°' : '--'}</span>
            <div class="h-rain-indicator" style="opacity:${0.55 + precipProb / 100 * 0.45}">
              <span class="h-rain-pct">${precipProb}%</span>
            </div>
          </div>
        </div>`;
    }
  }

  function renderWeatherChart(mode) {
    const svg = $('#weather-chart-svg');
    const tip = $('#chart-tooltip');
    if (!svg) return;
    const hourly = state.forecast?.hourly;
    const daily = state.forecast?.daily;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const axisFill = isLight ? 'rgba(15,27,45,0.72)' : 'rgba(255,255,255,0.45)';
    const gridStroke = isLight ? 'rgba(15,40,80,0.12)' : 'rgba(255,255,255,0.06)';
    const emptyFill = isLight ? 'rgba(15,27,45,0.55)' : 'rgba(255,255,255,0.5)';
    if (!hourly && !daily) {
      svg.innerHTML = `<text x="320" y="120" text-anchor="middle" fill="${emptyFill}" font-size="14">No data</text>`;
      return;
    }
    mode = mode || state._chartMode || 'temp';
    state._chartMode = mode;

    const W = 640, H = 240;
    const padL = 44, padR = mode === 'rain' ? 48 : 18, padT = 20, padB = 40;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Store series for hover
    let series = []; // {x, y, i, label, extras}
    let hitData = []; // index -> payload for tooltip

    const xAt = (i, n) => padL + (i / Math.max(1, n - 1)) * plotW;
    const yScale = (v, minV, maxV) => padT + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;

    function pathFrom(nums, minV, maxV) {
      let d = '', a = '', started = false, lastI = 0;
      nums.forEach((v, i) => {
        if (v == null || isNaN(v)) return;
        const x = xAt(i, nums.length), y = yScale(v, minV, maxV);
        if (!started) {
          d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
          a += `M ${x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
          started = true;
        } else {
          d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
          a += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        lastI = i;
      });
      if (started) a += ` L ${xAt(lastI, nums.length).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
      return { d, a };
    }

    function gridY(minV, maxV, ticks, unitFmt) {
      let g = '';
      for (let t = 0; t <= ticks; t++) {
        const frac = t / ticks;
        const val = maxV - frac * (maxV - minV);
        const y = padT + frac * plotH;
        g += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${gridStroke}" stroke-width="1"/>`;
        g += `<text x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${axisFill}" font-size="11" font-family="Space Grotesk,sans-serif">${unitFmt(val)}</text>`;
      }
      return g;
    }

    function xLabelsHourly() {
      let s = '';
      for (let i = 0; i < 24; i += 2) {
        s += `<text x="${xAt(i, 24).toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="${axisFill}" font-size="11" font-family="Space Grotesk,sans-serif">${String(i).padStart(2,'0')}:00</text>`;
      }
      return s;
    }

    let body = '';
    const gid = 'cg-' + mode;

    if (mode === 'temp') {
      const temps = (hourly.temperature_2m || []).slice(0, 24).map(v => v == null ? null : +v);
      const feels = (hourly.apparent_temperature || []).slice(0, 24).map(v => v == null ? null : +v);
      const all = [...temps, ...feels].filter(v => v != null);
      let minV = all.length ? Math.min(...all) - 1 : 0;
      let maxV = all.length ? Math.max(...all) + 1 : 40;
      if (maxV === minV) maxV = minV + 1;

      const pT = pathFrom(temps, minV, maxV);
      const pF = pathFrom(feels, minV, maxV);

      body += `<defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#5aa9ff" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#5aa9ff" stop-opacity="0.02"/>
        </linearGradient>
      </defs>`;
      body += gridY(minV, maxV, 4, v => Math.round(v) + '°');
      body += xLabelsHourly();
      if (pT.a) body += `<path d="${pT.a}" fill="url(#${gid})"/>`;
      if (pF.d) body += `<path d="${pF.d}" fill="none" stroke="#c9a8ff" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
      if (pT.d) body += `<path d="${pT.d}" fill="none" stroke="#5aa9ff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

      temps.forEach((v, i) => {
        if (v == null) return;
        const x = xAt(i, 24), y = yScale(v, minV, maxV);
        body += `<circle class="chart-dot" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#5aa9ff" stroke="rgba(7,13,24,0.85)" stroke-width="1.5"/>`;
        const fy = feels[i] != null ? yScale(feels[i], minV, maxV) : null;
        if (fy != null) body += `<circle cx="${x.toFixed(1)}" cy="${fy.toFixed(1)}" r="3" fill="#c9a8ff" stroke="rgba(7,13,24,0.85)" stroke-width="1.2" opacity="0.85"/>`;
        hitData[i] = {
          time: String(i).padStart(2,'0') + ':00',
          rows: [
            { color: '#5aa9ff', text: `Temperature: ${Math.round(v)}°` },
            { color: '#c9a8ff', dashed: true, text: `Feels like: ${feels[i] != null ? Math.round(feels[i]) + '°' : '—'}` }
          ]
        };
      });

    } else if (mode === 'rain') {
      const probs = (hourly.precipitation_probability || []).slice(0, 24).map(v => v == null ? null : +v);
      const mm = (hourly.precipitation || []).slice(0, 24).map(v => v == null ? null : +v);
      const maxMm = Math.max(1.4, ...(mm.filter(v => v != null)), 0.1);
      const minP = 0, maxP = 100;
      const barW = plotW / 24 * 0.55;

      body += gridY(minP, maxP, 5, v => Math.round(v) + '%');
      // right axis for mm
      for (let t = 0; t <= 4; t++) {
        const frac = t / 4;
        const val = maxMm - frac * maxMm;
        const y = padT + frac * plotH;
        body += `<text x="${W - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="chart-axis-right">${val.toFixed(1)}mm</text>`;
      }
      body += xLabelsHourly();

      probs.forEach((v, i) => {
        if (v == null) return;
        const x = xAt(i, 24);
        const h = (v / 100) * plotH;
        const y = padT + plotH - h;
        body += `<rect x="${(x - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="3" fill="rgba(90,169,255,0.55)" stroke="rgba(90,169,255,0.3)" stroke-width="1"/>`;
        hitData[i] = {
          time: String(i).padStart(2,'0') + ':00',
          rows: [
            { color: '#5aa9ff', text: `Rain probability: ${Math.round(v)}%` },
            { color: '#7ee8b8', text: `Precipitation: ${mm[i] != null ? mm[i].toFixed(1) : 0} mm` }
          ]
        };
      });

      const pMm = pathFrom(mm.map(v => v == null ? 0 : v), 0, maxMm);
      if (pMm.d) body += `<path d="${pMm.d}" fill="none" stroke="#7ee8b8" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
      mm.forEach((v, i) => {
        if (v == null) return;
        const x = xAt(i, 24), y = yScale(v, 0, maxMm);
        body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#7ee8b8" stroke="rgba(7,13,24,0.8)" stroke-width="1.3"/>`;
      });

    } else if (mode === 'uv') {
      // Daily UV bars (matches screenshot design)
      const times = (daily?.time || []).slice(0, 10);
      const uvs = (daily?.uv_index_max || []).slice(0, 10).map(v => v == null ? null : +v);
      const n = Math.max(times.length, 1);
      const maxV = Math.max(12, ...(uvs.filter(v => v != null)), 1);
      const minV = 0;
      const barW = plotW / n * 0.55;

      body += gridY(minV, maxV, 6, v => 'UV ' + Math.round(v));
      // x labels dates
      times.forEach((day, i) => {
        const d = new Date(day);
        const label = d.toLocaleDateString([], { weekday: 'short' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const short = d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.getDate();
        const x = xAt(i, n);
        body += `<text x="${x.toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="${axisFill}" font-size="10" font-family="Space Grotesk,sans-serif">${short}</text>`;
        const v = uvs[i];
        if (v == null) return;
        const h = (v / maxV) * plotH;
        const y = padT + plotH - h;
        let fill = '#ffc857';
        if (v >= 8) fill = '#ff6b9d';
        else if (v >= 6) fill = '#ff922b';
        else if (v >= 3) fill = '#ffc857';
        else fill = '#7ee8b8';
        body += `<rect class="uv-bar" data-i="${i}" x="${(x - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="5" fill="${fill}" opacity="0.9"/>`;
        const level = v >= 11 ? 'Extreme' : v >= 8 ? 'Very High' : v >= 6 ? 'High' : v >= 3 ? 'Moderate' : 'Low';
        hitData[i] = {
          time: label,
          rows: [{ color: fill, text: `UV: ${v.toFixed(1)} (${level})` }]
        };
      });

    } else if (mode === 'wind') {
      const winds = (hourly.wind_speed_10m || []).slice(0, 24).map(v => v == null ? null : +v);
      const valid = winds.filter(v => v != null);
      let minV = 0;
      let maxV = valid.length ? Math.max(...valid) * 1.15 : 20;
      if (maxV < 5) maxV = 10;
      const p = pathFrom(winds, minV, maxV);
      body += `<defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8b6cff" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#8b6cff" stop-opacity="0.02"/>
        </linearGradient>
      </defs>`;
      body += gridY(minV, maxV, 4, v => Math.round(v));
      body += xLabelsHourly();
      if (p.a) body += `<path d="${p.a}" fill="url(#${gid})"/>`;
      if (p.d) body += `<path d="${p.d}" fill="none" stroke="#8b6cff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      winds.forEach((v, i) => {
        if (v == null) return;
        const x = xAt(i, 24), y = yScale(v, minV, maxV);
        body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#8b6cff" stroke="rgba(7,13,24,0.85)" stroke-width="1.5"/>`;
        hitData[i] = {
          time: String(i).padStart(2,'0') + ':00',
          rows: [{ color: '#8b6cff', text: `Wind: ${Math.round(v)} km/h` }]
        };
      });
    }

    // Interactive overlay: transparent hit strip + guide line
    body += `<line id="chart-guide" class="chart-guide" x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" opacity="0"/>`;
    body += `<rect id="chart-hit" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent" style="cursor:crosshair"/>`;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = body;
    state._chartHit = hitData;
    state._chartMeta = { padL, plotW, n: mode === 'uv' ? (daily?.time || []).slice(0, 10).length : 24, mode };

    // Bind hover once per render
    const hit = svg.querySelector('#chart-hit');
    const guide = svg.querySelector('#chart-guide');
    if (hit && tip) {
      const onMove = (evt) => {
        const rect = svg.getBoundingClientRect();
        const scaleX = W / rect.width;
        const mx = (evt.clientX - rect.left) * scaleX;
        const meta = state._chartMeta || {};
        const n = meta.n || 24;
        let idx = Math.round(((mx - meta.padL) / meta.plotW) * (n - 1));
        idx = Math.max(0, Math.min(n - 1, idx));
        const data = (state._chartHit || [])[idx];
        if (!data) {
          tip.classList.add('hidden');
          if (guide) guide.setAttribute('opacity', '0');
          return;
        }
        const gx = meta.padL + (idx / Math.max(1, n - 1)) * meta.plotW;
        if (guide) {
          guide.setAttribute('x1', gx.toFixed(1));
          guide.setAttribute('x2', gx.toFixed(1));
          guide.setAttribute('opacity', '1');
        }
        tip.innerHTML = `<div class="tt-time">${data.time}</div>` + data.rows.map(r =>
          `<div class="tt-row"><span class="tt-swatch${r.dashed ? ' line-dashed' : ''}" style="${r.dashed ? '' : 'background:' + r.color}"></span>${r.text}</div>`
        ).join('');
        tip.classList.remove('hidden');
        // Position tooltip in CSS pixels relative to wrap
        const wrap = tip.parentElement;
        const wrapRect = wrap.getBoundingClientRect();
        let left = evt.clientX - wrapRect.left + 14;
        let top = evt.clientY - wrapRect.top - 10;
        if (left + 180 > wrapRect.width) left = evt.clientX - wrapRect.left - 190;
        if (top < 4) top = 4;
        if (top + 80 > wrapRect.height) top = wrapRect.height - 90;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
      };
      const onLeave = () => {
        tip.classList.add('hidden');
        if (guide) guide.setAttribute('opacity', '0');
      };
      hit.onmousemove = onMove;
      hit.onmouseleave = onLeave;
      // touch support
      hit.ontouchmove = (e) => {
        if (!e.touches?.[0]) return;
        onMove(e.touches[0]);
      };
      hit.ontouchend = onLeave;
    }
  }

  function updateHealthSummary() {
    const el = $('#health-summary');
    if (!el) return;
    const isGuest = state.guest || !Auth.isLoggedIn();
    const btn = $('#health-edit-btn');
    const sub = document.querySelector('#health-profile-panel .panel-sub');
    if (isGuest) {
      el.innerHTML = '<p class="muted">Sign in to update health profile for personalised clothing &amp; health alerts.</p>';
      if (btn) btn.classList.add('hidden');
      if (sub) sub.textContent = 'Sign in required';
      setHealthPanelOpen(false);
      return;
    }
    if (btn) btn.classList.remove('hidden');
    if (sub) sub.textContent = 'Edit anytime';
    const p = Store.getHealthProfile();
    if (!p || (!p.age && !p.height && !p.weight)) {
      el.innerHTML = '<p class="muted">Tap <b>Edit</b> to set up your health profile for personalised alerts.</p>';
      return;
    }
    const conds = (p.conditions || []).join(', ') || 'None';
    const act = (p.activity || 'moderate');
    el.innerHTML = `<p style="margin:0;font-size:0.9rem">Age <b>${p.age || '—'}</b> · ${p.height || '—'} cm · ${p.weight || '—'} kg · Activity: <b>${act}</b><br><span class="muted" style="font-size:0.82rem">Conditions: ${conds}</span></p>`;
  }

  function setHealthPanelOpen(open) {
    const panel = $('#health-profile-panel');
    const btn = $('#health-edit-btn');
    if (!panel) return;
    // Guests cannot open the health editor
    if (open && (state.guest || !Auth.isLoggedIn())) {
      panel.classList.remove('is-open');
      if (btn) btn.textContent = 'Edit';
      return;
    }
    panel.classList.toggle('is-open', !!open);
    if (btn) btn.textContent = open ? 'Close' : 'Edit';
    if (open) {
      setTimeout(() => {
        const form = $('#profile-health-form');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    }
  }

  function updateSunMoonArcs(wx) {
    // Position sun along semicircle based on time between sunrise and sunset
    const now = Date.now();
    const rise = wx.sunrise ? new Date(wx.sunrise).getTime() : null;
    const set = wx.sunset ? new Date(wx.sunset).getTime() : null;
    let sunT = 0.5;
    if (rise && set && set > rise) {
      sunT = Math.max(0, Math.min(1, (now - rise) / (set - rise)));
      if (now < rise) sunT = 0;
      if (now > set) sunT = 1;
    }
    placeOnArc('sun-dot', sunT);
    // Moon: approximate opposite path (night) using sunset→next sunrise
    let moonT = 0.5;
    if (rise && set) {
      // night window roughly set → rise+24h
      const nightStart = set;
      const nightEnd = rise + 24 * 3600 * 1000;
      if (now >= nightStart || now < rise) {
        const n = now < rise ? now + 24 * 3600 * 1000 : now;
        moonT = Math.max(0, Math.min(1, (n - nightStart) / (nightEnd - nightStart)));
      } else {
        moonT = 0; // daytime — moon at start
      }
    }
    placeOnArc('moon-dot', moonT);
    // Approximate moonrise/moonset labels (sunset / sunrise swapped for simple model)
    const mr = $('#moonrise-time');
    const ms = $('#moonset-time');
    if (mr) mr.textContent = wx.sunset ? fmtTime(wx.sunset) : '--';
    if (ms) ms.textContent = wx.sunrise ? fmtTime(wx.sunrise) : '--';
    const sn = $('#sun-now-label');
    if (sn) sn.textContent = rise && set ? `${fmtTime(wx.sunrise)} → ${fmtTime(wx.sunset)}` : 'Sunrise → Sunset';
    const mn = $('#moon-now-label');
    if (mn) mn.textContent = wx.sunset && wx.sunrise ? `${fmtTime(wx.sunset)} → ${fmtTime(wx.sunrise)}` : 'Moonrise → Moonset';
  }

  function placeOnArc(id, t) {
    // Semicircle from (20,100) to (180,100), radius 80, center (100,100)
    const el = document.getElementById(id);
    if (!el) return;
    const angle = Math.PI * (1 - t); // pi → 0
    const cx = 100 + 80 * Math.cos(angle);
    const cy = 100 - 80 * Math.sin(angle);
    el.setAttribute('cx', cx.toFixed(1));
    el.setAttribute('cy', cy.toFixed(1));
  }

  function updateLocalTime(place) {
    const el = $('#local-time-text');
    const badge = $('#local-time-badge');
    if (!el) return;
    const tz = place?.timezone || state.forecast?.timezone;
    try {
      const opts = { hour: '2-digit', minute: '2-digit', hour12: true };
      if (tz) opts.timeZone = tz;
      const d = new Date();
      el.textContent = d.toLocaleTimeString([], opts) + (tz ? ` · ${tz.replace(/_/g, ' ')}` : '');
      // local hour for packing
      const hourFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz || undefined });
      state._localHour = parseInt(hourFmt.format(d), 10);
      if (badge) badge.style.display = '';
    } catch {
      el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      state._localHour = new Date().getHours();
    }
  }

  function renderPersonal() {
    const isGuest = state.guest || !Auth.isLoggedIn();
    const prompt = $('#personal-login-prompt');
    const gated = $$('.personal-gated');
    if (prompt) prompt.classList.toggle('hidden', !isGuest);
    gated.forEach(el => el.classList.toggle('hidden', isGuest));
    // Traveller panel always visible; when guest make it full width
    const travelPanel = $('#panel-travel');
    if (travelPanel) {
      travelPanel.classList.toggle('home-span-7', !isGuest);
      travelPanel.classList.toggle('home-span-12', isGuest);
    }

    const wx = currentWx();
    if (wx.temp == null) return;

    // Always render traveller safety (available to guests)
    const risks = Intelligence.disasterRisk(wx, state.place);
    const localHour = state._localHour != null ? state._localHour : new Date().getHours();
    const pack = Intelligence.packingList(wx, { localHour, risks });
    const pel = $('#travel-pack-list');
    if (pel) {
      pel.innerHTML = pack.map(p => {
        const label = typeof p === 'string' ? p : p.label;
        const icon = typeof p === 'string' ? 'fa-suitcase' : (p.icon || 'fa-suitcase');
        return `<div class="pack-item"><i class="fa-solid ${icon}"></i><span>${esc(label)}</span></div>`;
      }).join('');
    }
    if (state.place) {
      const nameEl = $('#travel-dest-name');
      const wxEl = $('#travel-dest-wx');
      if (nameEl) nameEl.textContent = state.place.label || state.place.name;
      if (wxEl) wxEl.textContent = `${Intelligence.weatherLabel(wx.code)} · ${Math.round(wx.temp)}° · AQI ${wx.aqi ?? '—'}`;
    }

    // Gated features: only for signed-in (non-guest) users
    if (isGuest) return;

    const hp = Store.getHealthProfile();
    const clothing = Intelligence.clothingRecommendation(wx, wx.aqi);
    const alerts = Intelligence.healthAlerts(wx, wx.aqi, hp);
    const plan = Intelligence.dailyPlanner(wx, wx.aqi, clothing, alerts);
    const clothEl = $('#clothing-list');
    if (clothEl) {
      clothEl.innerHTML = `<p class="intel-summary">${esc(clothing.summary)}</p>` +
        clothing.items.map(i => {
          const label = typeof i === 'string' ? i : i.label;
          const icon = typeof i === 'string' ? 'fa-shirt' : (i.icon || 'fa-shirt');
          return `<div class="pack-item"><i class="fa-solid ${icon}"></i><span>${esc(label)}</span></div>`;
        }).join('');
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
    const place = state.place;
    const articles = await WeatherAPI.getNews(place || 'weather climate storm flood heatwave');
    state._news = articles;
    const placeLabel = place?.name || place?.label || '';
    if (status) {
      if (placeLabel) status.textContent = `Live for ${placeLabel} · updates daily`;
      else status.textContent = 'Live · updates daily';
    }
    if (list) {
      list.innerHTML = articles.map(a => {
        const href = a.url && a.url !== '#' ? a.url : '';
        const openAttrs = href
          ? `href="${esc(href)}" target="_blank" rel="noopener noreferrer"`
          : 'href="javascript:void(0)" role="link" aria-disabled="true"';
        // Always show a placeholder under the image so broken thumbs never look empty
        const thumb = a.image
          ? `<img class="news-thumb" src="${esc(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" decoding="async" onerror="this.style.display='none';this.nextElementSibling?.classList.remove('hidden')">`
          : '';
        const fallback = `<div class="news-thumb placeholder${a.image ? ' news-thumb-fallback hidden' : ''}">📰</div>`;
        return `<a class="news-card" ${openAttrs}>
          <div class="news-thumb-wrap">${thumb}${fallback}</div>
          <div class="news-body"><b>${esc(a.title)}</b><p>${esc(a.desc || '')}</p>
          <span class="news-meta">${esc(a.source)}${a.time ? ' · ' + new Date(a.time).toLocaleDateString() : ''}${href ? ' · Open source ↗' : ''}</span></div></a>`;
      }).join('');
    }
    updateTodayHighlights(articles);
  }

  /* ---- Today Highlights carousel (4 news + 5th CTA) ---- */
  let _thTimer = null;
  let _thIndex = 0;
  function initTodayHighlights() {
    loadNews().catch(() => {});
    // Refresh news every 30 minutes for 24/7 feel
    setInterval(() => loadNews().catch(() => {}), 30 * 60 * 1000);
  }
  function updateTodayHighlights(articles) {
    const track = $('#th-track');
    const dots = $('#th-dots');
    if (!track || !dots) return;
    const top4 = (articles || []).slice(0, 4);
    const slides = top4.map((a, i) => {
      const href = a.url && a.url !== '#' ? a.url : '';
      const img = a.image
        ? `<img src="${esc(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" decoding="async" onerror="this.style.display='none';this.nextElementSibling&&this.nextElementSibling.classList.remove('hidden')">
           <div class="th-img-ph hidden">📰</div>`
        : `<div class="th-img-ph">📰</div>`;
      const linkAttrs = href
        ? `href="${esc(href)}" target="_blank" rel="noopener noreferrer"`
        : 'href="javascript:void(0)"';
      return `<a class="th-slide" ${linkAttrs} data-i="${i}">
        <div class="th-img">${img}</div>
        <div class="th-copy"><b>${esc(a.title)}</b><span>${esc(a.source || 'News')}</span></div>
      </a>`;
    });
    slides.push(`<button type="button" class="th-slide th-cta" data-i="4">
      <div class="th-img th-img-cta"><i class="fa-solid fa-newspaper"></i></div>
      <div class="th-copy"><b>Visit News feed for more today news</b><span>Full weather &amp; climate coverage</span></div>
    </button>`);
    track.innerHTML = slides.join('');
    _thCount = slides.length;
    dots.innerHTML = slides.map((_, i) => `<button type="button" class="th-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Slide ${i + 1}"></button>`).join('');
    _thIndex = 0;
    goHighlight(0);
    $$('.th-dot', dots).forEach(d => d.addEventListener('click', () => goHighlight(+d.dataset.i)));
    $$('.th-cta', track).forEach(btn => btn.addEventListener('click', () => {
      $$('.nav-btn, .bottom-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === 'news'));
      $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-news'));
      renderDisaster();
      loadNews();
    }));
    // Left / right dotted nav (bind once)
    if (!$('#th-prev')?.dataset.wired) {
      $('#th-prev')?.addEventListener('click', e => {
        e.preventDefault();
        goHighlight((_thIndex - 1 + _thCount) % _thCount);
        restartThTimer();
      });
      $('#th-next')?.addEventListener('click', e => {
        e.preventDefault();
        goHighlight((_thIndex + 1) % _thCount);
        restartThTimer();
      });
      if ($('#th-prev')) $('#th-prev').dataset.wired = '1';
      if ($('#th-next')) $('#th-next').dataset.wired = '1';
    }
    restartThTimer();
  }
  let _thCount = 5;
  function restartThTimer() {
    if (_thTimer) clearInterval(_thTimer);
    _thTimer = setInterval(() => goHighlight((_thIndex + 1) % _thCount), 4500);
  }
  function goHighlight(i) {
    const track = $('#th-track');
    if (!track) return;
    const n = _thCount || 5;
    _thIndex = ((i % n) + n) % n;
    track.style.transform = `translateX(-${_thIndex * 100}%)`;
    $$('.th-dot').forEach(d => d.classList.toggle('active', +d.dataset.i === _thIndex));
  }

  /* ---- Radar-station style weather color map (OWM continuous fields) ---- */
  let _map = null;
  let _mapBase = null;
  let _mapLayer = null;
  let _mapMarker = null;
  let _mapLayerName = 'temp_new';
  let _mapIsoType = 'isotherm';
  const LAYER_META = {
    isotherm: {
      title: 'Temperature field (isotherms)',
      owm: 'temp_new',
      scale: {
        gradient: 'linear-gradient(90deg,#2b1055,#1a3a8a,#1e90ff,#00c853,#ffeb3b,#ff9800,#f44336,#b71c1c)',
        labels: ['-20°', '0°', '10°', '20°', '30°', '40°+']
      }
    },
    isohyet: {
      title: 'Precipitation radar (isohyets)',
      owm: 'precipitation_new',
      scale: {
        gradient: 'linear-gradient(90deg,#0d1b2a,#1b4965,#2a9d8f,#90be6d,#f9c74f,#f9844a,#d62828,#6a040f)',
        labels: ['None', 'Light', 'Mod', 'Heavy', 'Intense']
      }
    },
    isobar: {
      title: 'Pressure field (isobars)',
      owm: 'pressure_new',
      scale: {
        gradient: 'linear-gradient(90deg,#3d348b,#7678ed,#9b5de5,#00bbf9,#00f5d4,#fee440)',
        labels: ['Low', '', 'Normal', '', 'High']
      }
    },
    isotach: {
      title: 'Wind speed (isotachs)',
      owm: 'wind_new',
      scale: {
        gradient: 'linear-gradient(90deg,#edf2f4,#8ecae6,#219ebc,#023047,#ffb703,#fb8500,#d00000)',
        labels: ['Calm', 'Breezy', 'Windy', 'Gale']
      }
    },
    isoneph: {
      title: 'Cloud cover (isonephs)',
      owm: 'clouds_new',
      scale: {
        gradient: 'linear-gradient(90deg,#0a0a0a,#4a4e69,#9a8c98,#c9ada7,#f2e9e4,#ffffff)',
        labels: ['Clear', 'Partly', 'Cloudy', 'Overcast']
      }
    }
  };
  function weatherColorFromWx(wx) {
    const t = wx?.temp;
    if (t == null) return { fill: '#5aa9ff', stroke: '#2b7de9' };
    if (t <= 0) return { fill: '#4c6ef5', stroke: '#364fc7' };
    if (t <= 12) return { fill: '#22b8cf', stroke: '#0c8599' };
    if (t <= 22) return { fill: '#51cf66', stroke: '#2f9e44' };
    if (t <= 30) return { fill: '#fcc419', stroke: '#f59f00' };
    if (t <= 38) return { fill: '#ff922b', stroke: '#e8590c' };
    return { fill: '#ff6b6b', stroke: '#fa5252' };
  }
  function updateMapScale(isoType) {
    const meta = LAYER_META[isoType] || LAYER_META.isotherm;
    const bar = $('#map-scale-bar');
    const labs = $('#map-scale-labels');
    if (bar) bar.style.background = meta.scale.gradient;
    if (labs) {
      labs.innerHTML = meta.scale.labels.map(l => `<span>${l}</span>`).join('');
    }
  }
  function wireWeatherMap() {
    $$('.map-layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.map-layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _mapLayerName = btn.dataset.layer || 'temp_new';
        _mapIsoType = btn.dataset.iso || 'isotherm';
        updateWeatherMap();
      });
    });
  }
  function updateWeatherMap() {
    const el = $('#weather-map');
    if (!el || typeof L === 'undefined') return;
    const lat = state.place?.lat ?? 13.08;
    const lon = state.place?.lon ?? 80.27;
    const label = state.place?.label || state.place?.name || 'Selected place';
    const key = CONFIG.OWM_API_KEY;
    const wx = currentWx();
    const colors = weatherColorFromWx(wx);
    // Regional zoom so color field reads like a station product
    const zoom = 5;
    const meta = LAYER_META[_mapIsoType] || LAYER_META.isotherm;
    const owmLayer = _mapLayerName || meta.owm;

    if (!_map) {
      _map = L.map(el, {
        zoomControl: false,
        attributionControl: true,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false
      }).setView([lat, lon], zoom);

      // Neutral light basemap — weather color layers stay readable (no orange mask)
      _mapBase = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 12,
        subdomains: 'abcd',
        attribution: '&copy; OSM · CARTO · OpenWeatherMap'
      }).addTo(_map);

      el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); }, true);
      el.addEventListener('dblclick', e => { e.preventDefault(); e.stopPropagation(); }, true);
    } else {
      _map.setView([lat, lon], zoom, { animate: true });
    }

    if (_mapMarker) { _map.removeLayer(_mapMarker); _mapMarker = null; }
    if (_mapLayer) { _map.removeLayer(_mapLayer); _mapLayer = null; }

    // Continuous weather color field — normal blend so isotherms / radar show true colors
    if (key) {
      const url = `https://tile.openweathermap.org/map/${owmLayer}/{z}/{x}/{y}.png?appid=${key}`;
      _mapLayer = L.tileLayer(url, {
        maxZoom: 12,
        opacity: 0.68,
        className: 'owm-weather-tiles'
      }).addTo(_map);
    }

    // Pin current place only (no opening external maps)
    _mapMarker = L.circleMarker([lat, lon], {
      radius: 8,
      color: '#ffffff',
      weight: 2,
      fillColor: colors.fill,
      fillOpacity: 1,
      interactive: false
    }).addTo(_map);

    updateMapScale(_mapIsoType);

    const mapLabel = $('#map-place-label');
    if (mapLabel) mapLabel.textContent = label;
    const leg = $('#map-legend');
    if (leg) leg.textContent = meta.title;
    const cap = $('#map-caption');
    if (cap) {
      const t = wx.temp != null ? Math.round(wx.temp) + '°' : '—';
      cap.textContent = `≈ ${t} at ${label} · color field = live ${meta.title.split('(')[0].trim().toLowerCase()}`;
    }
    setTimeout(() => { try { _map.invalidateSize(); } catch (_) {} }, 250);
  }

  function wireSettings() {
    $('#theme-toggle')?.addEventListener('change', e => {
      const theme = e.target.checked ? 'light' : 'dark';
      applyTheme(theme);
      const s = Store.getSettings(); s.theme = theme; Store.saveSettings(s);
      // Re-render chart so axis labels pick up light/dark colors
      if (state.forecast) renderWeatherChart(state._chartMode || 'temp');
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
    ['newsAlerts', 'weatherAlerts', 'disasterAlerts', 'personalAlerts'].forEach(key => {
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

  function dedupeSaved() {
    const raw = Store.getSavedCities();
    const seen = new Set();
    return raw.filter(c => {
      const k = (Math.round(c.lat * 100) / 100) + ',' + (Math.round(c.lon * 100) / 100);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function renderSavedDrawer() {
    const el = $('#saved-drawer-list');
    if (!el) return;
    const cities = dedupeSaved();
    const cur = state.place;
    if (!cities.length) {
      el.innerHTML = '<p class="muted drawer-empty">No places saved yet</p>';
      return;
    }
    el.innerHTML = cities.map((c, i) => {
      const active = cur && Math.abs(c.lat - cur.lat) < 0.01 && Math.abs(c.lon - cur.lon) < 0.01;
      return `<div class="drawer-place${active ? ' active' : ''}">
        <button type="button" class="drawer-go" data-i="${i}">
          <i class="fa-solid fa-location-dot"></i>
          <span>${esc(c.label || c.name)}</span>
        </button>
        <button type="button" class="drawer-del" data-del="${i}" aria-label="Remove">✕</button>
      </div>`;
    }).join('');
    $$('.drawer-go', el).forEach(b => b.addEventListener('click', () => {
      loadPlace(cities[+b.dataset.i]);
      closeSavedDrawer();
    }));
    $$('.drawer-del', el).forEach(b => b.addEventListener('click', () => {
      const c = cities[+b.dataset.del];
      Store.removeCity(c.lat, c.lon);
      renderSavedDrawer();
      updateSaveBtn();
    }));
  }

  function openSavedDrawer() {
    $('#saved-drawer')?.classList.add('open');
    $('#saved-drawer-backdrop')?.classList.remove('hidden');
    $('#saved-drawer')?.setAttribute('aria-hidden', 'false');
    renderSavedDrawer();
  }
  function closeSavedDrawer() {
    $('#saved-drawer')?.classList.remove('open');
    $('#saved-drawer-backdrop')?.classList.add('hidden');
    $('#saved-drawer')?.setAttribute('aria-hidden', 'true');
  }

  function wireSavedDrawer() {
    $('#menu-toggle')?.addEventListener('click', openSavedDrawer);
    $('#saved-drawer-close')?.addEventListener('click', closeSavedDrawer);
    $('#saved-drawer-backdrop')?.addEventListener('click', closeSavedDrawer);
    $('#clear-places-btn')?.addEventListener('click', () => {
      Store.set(Store.K.SAVED_CITIES, []);
      renderSavedDrawer();
      updateSaveBtn();
      showToast('All saved places cleared');
    });
  }

  function renderProfileSearchHistory() {
    const el = $('#profile-search-history');
    if (!el) return;
    const hist = Store.getSearchHistory();
    if (!hist.length) {
      el.innerHTML = '<p class="muted">No search history yet.</p>';
      return;
    }
    el.innerHTML = hist.map((h, i) =>
      `<div class="saved-chip"><button type="button" class="saved-go" data-i="${i}">${esc(h.place?.label || h.query)}</button>
        <button type="button" class="saved-del" data-del="${i}" aria-label="Remove">✕</button></div>`
    ).join('');
    $$('.saved-go', el).forEach(b => b.addEventListener('click', () => {
      const h = hist[+b.dataset.i];
      if (h?.place) loadPlace(h.place);
    }));
    $$('.saved-del', el).forEach(b => {
      b.addEventListener('click', () => {
        const list = Store.getSearchHistory();
        list.splice(+b.dataset.del, 1);
        Store.set(Store.K.SEARCH_HISTORY, list);
        renderProfileSearchHistory();
      });
    });
  }

  // Keep aliases so older call sites don't break
  function renderPlacesStrip() { renderSavedDrawer(); }
  function renderSavedCities() { renderSavedDrawer(); }

  function wireProfile() {
    $('#clear-search-hist-btn')?.addEventListener('click', () => {
      Store.clearSearchHistory();
      renderProfileSearchHistory();
      showToast('Search history cleared');
    });
    $('#logout-btn')?.addEventListener('click', () => {
      Auth.logout();
      sessionStorage.removeItem('aura_skipped');
      location.reload();
    });
    $('#photo-input')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!Auth.getUser()) {
        showToast('Sign in to change your profile photo');
        e.target.value = '';
        return;
      }
      if (!file.type.startsWith('image/')) {
        showToast('Please choose an image file');
        return;
      }
      // Limit ~1.5MB for localStorage safety
      if (file.size > 1.5 * 1024 * 1024) {
        showToast('Image too large (max ~1.5 MB). Try a smaller photo.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        Auth.updateProfile({ photo: dataUrl });
        const img = $('#account-photo');
        if (img) img.src = dataUrl;
        showToast('Profile photo updated');
        renderAccount();
      };
      reader.onerror = () => showToast('Could not read image');
      reader.readAsDataURL(file);
    });

    // Edit name (signed-in only); email stays locked
    $('#edit-name-btn')?.addEventListener('click', () => {
      if (!Auth.getUser()) {
        showToast('Sign in to edit your name');
        return;
      }
      const nameEl = $('#account-name');
      const input = $('#account-name-input');
      const editBtn = $('#edit-name-btn');
      const saveBtn = $('#save-name-btn');
      if (!input) return;
      input.value = (Auth.getUser()?.name || '').trim();
      nameEl?.classList.add('hidden');
      input.classList.remove('hidden');
      editBtn?.classList.add('hidden');
      saveBtn?.classList.remove('hidden');
      input.focus();
      input.select();
    });
    $('#save-name-btn')?.addEventListener('click', () => {
      const input = $('#account-name-input');
      const name = (input?.value || '').trim();
      if (!name) {
        showToast('Name cannot be empty');
        return;
      }
      Auth.updateProfile({ name });
      showToast('Name updated');
      renderAccount();
    });
    $('#account-name-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') $('#save-name-btn')?.click();
      if (e.key === 'Escape') renderAccount();
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
      updateHealthSummary();
      setHealthPanelOpen(false);
      renderPersonal();
    });

    $('#health-edit-btn')?.addEventListener('click', () => {
      if (state.guest || !Auth.isLoggedIn()) {
        showToast('Sign in to update health profile');
        return;
      }
      const panel = $('#health-profile-panel');
      const open = !panel?.classList.contains('is-open');
      if (open) fillHealthForm();
      setHealthPanelOpen(open);
    });

    // Chart tabs
    $$('#chart-tabs .chart-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#chart-tabs .chart-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderWeatherChart(btn.dataset.chart);
      });
    });
  }

  function defaultAvatar() {
    const img = $('#account-photo');
    return (img && img.dataset.default) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%235aa9ff'/%3E%3Cstop offset='1' stop-color='%238b6cff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='60' cy='60' r='60' fill='url(%23g)'/%3E%3Ccircle cx='60' cy='46' r='22' fill='rgba(255,255,255,0.92)'/%3E%3Cellipse cx='60' cy='98' rx='36' ry='28' fill='rgba(255,255,255,0.92)'/%3E%3C/svg%3E";
  }

  function renderAccount() {
    const u = Auth.getUser();
    const img = $('#account-photo');
    const nameEl = $('#account-name');
    const emailEl = $('#account-email');
    const methodEl = $('#account-login-method');
    const editBtn = $('#edit-name-btn');
    const saveBtn = $('#save-name-btn');
    const nameInput = $('#account-name-input');

    if (!u) {
      if (nameEl) nameEl.textContent = state.guest ? 'Guest' : '—';
      if (emailEl) emailEl.textContent = '—';
      if (methodEl) methodEl.textContent = state.guest ? 'Skipped' : '—';
      if (img) img.src = defaultAvatar();
      if (editBtn) editBtn.classList.add('hidden');
      if (saveBtn) saveBtn.classList.add('hidden');
      if (nameInput) nameInput.classList.add('hidden');
      if (nameEl) nameEl.classList.remove('hidden');
      return;
    }
    if (nameEl) {
      nameEl.textContent = u.name || '—';
      nameEl.classList.remove('hidden');
    }
    if (emailEl) emailEl.textContent = u.email || '—';
    if (methodEl) methodEl.textContent = u.method || 'email';
    if (img) img.src = u.photo || defaultAvatar();
    // Name editable only when signed in
    if (editBtn) editBtn.classList.remove('hidden');
    if (saveBtn) saveBtn.classList.add('hidden');
    if (nameInput) {
      nameInput.classList.add('hidden');
      nameInput.value = u.name || '';
    }
  }

  function fillHealthForm() {
    const p = Store.getHealthProfile() || {};
    if ($('#ph-age')) $('#ph-age').value = p.age || '';
    if ($('#ph-height')) $('#ph-height').value = p.height || '';
    if ($('#ph-weight')) $('#ph-weight').value = p.weight || '';
    if ($('#ph-activity')) $('#ph-activity').value = p.activity || 'moderate';
    $$('#ph-conditions input').forEach(el => { el.checked = (p.conditions || []).includes(el.value); });
    $$('#ph-sens input').forEach(el => { el.checked = (p.sensitivities || []).includes(el.value); });
    updateHealthSummary();
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

  /** Throttle so the same alert is not spammed */
  const _alertSent = {};
  function alertOnce(key, ms, fn) {
    const now = Date.now();
    if (_alertSent[key] && now - _alertSent[key] < ms) return;
    _alertSent[key] = now;
    fn();
  }

  function evaluateWxAlerts(place, wx) {
    const s = Store.getSettings();
    if (!s.alerts || !place) return;
    const name = place.name || place.label || 'Location';
    const tag = Math.round(place.lat * 100) + ',' + Math.round(place.lon * 100);

    if (s.weatherAlerts !== false) {
      if (wx.aqi != null && wx.aqi >= 150) {
        alertOnce('aqi-' + tag, 45 * 60 * 1000, () =>
          Notify.weatherAlert(name, `Unhealthy AQI ${Math.round(wx.aqi)} — limit outdoor exposure.`));
      }
      if ([95, 96, 99].includes(wx.code)) {
        alertOnce('storm-' + tag, 30 * 60 * 1000, () =>
          Notify.weatherAlert(name, 'Thunderstorm in the area — seek shelter.'));
      }
      if ((wx.tempMax || wx.temp || 0) >= 40) {
        alertOnce('heat-' + tag, 60 * 60 * 1000, () =>
          Notify.weatherAlert(name, 'Extreme heat expected — stay hydrated, avoid peak sun.'));
      }
      if ((wx.temp || 0) <= 2) {
        alertOnce('cold-' + tag, 60 * 60 * 1000, () =>
          Notify.weatherAlert(name, 'Near-freezing temperatures — dress warmly.'));
      }
      if ((wx.wind || 0) >= 50) {
        alertOnce('wind-' + tag, 45 * 60 * 1000, () =>
          Notify.weatherAlert(name, `Strong winds ${Math.round(wx.wind)} km/h — secure loose items.`));
      }
    }

    // Personal alerts (health / clothing style tips)
    if (s.personalAlerts !== false) {
      if (wx.uv != null && wx.uv >= 8) {
        alertOnce('uv-' + tag, 60 * 60 * 1000, () =>
          Notify.personalAlert(name, `Very high UV ${Math.round(wx.uv)} — use sunscreen & shade.`));
      }
      if (wx.aqi != null && wx.aqi >= 100 && wx.aqi < 150) {
        alertOnce('aqi-mod-' + tag, 60 * 60 * 1000, () =>
          Notify.personalAlert(name, `Moderate–unhealthy AQI ${Math.round(wx.aqi)} for sensitive groups.`));
      }
      if ((wx.precipProb || 0) >= 70) {
        alertOnce('rain-' + tag, 45 * 60 * 1000, () =>
          Notify.personalAlert(name, `High rain chance ${Math.round(wx.precipProb)}% — carry a rain layer.`));
      }
    }

    // Travel safety from disaster heuristics
    if (s.disasterAlerts !== false && typeof Intelligence !== 'undefined') {
      try {
        const risks = Intelligence.disasterRisk(wx, place) || [];
        risks.filter(r => r.level === 'High' || r.level === 'Severe').forEach(r => {
          alertOnce('dis-' + tag + '-' + r.type, 90 * 60 * 1000, () =>
            Notify.travelAlert(name, `${r.type} (${r.level}): ${r.note || 'Review safety guidance.'}`));
        });
      } catch (_) {}
    }
  }

  function maybeNotify() {
    evaluateWxAlerts(state.place, currentWx());
  }

  /** Real-time-ish updates: poll current + saved places every 10 minutes */
  async function pollSavedLocationAlerts() {
    const s = Store.getSettings();
    if (!s.alerts) return;
    const cities = Store.getSavedCities() || [];
    // Always include active place
    const list = [];
    const seen = new Set();
    const add = p => {
      if (!p || p.lat == null) return;
      const k = Math.round(p.lat * 100) + ',' + Math.round(p.lon * 100);
      if (seen.has(k)) return;
      seen.add(k);
      list.push(p);
    };
    add(state.place);
    cities.forEach(add);
    for (const place of list.slice(0, 8)) {
      try {
        const [forecast, aqiData] = await Promise.all([
          WeatherAPI.getForecast(place.lat, place.lon, state.unit),
          WeatherAPI.getAirQuality(place.lat, place.lon).catch(() => null)
        ]);
        const c = forecast?.current || {};
        const d0 = forecast?.daily || {};
        const h = forecast?.hourly || {};
        const hour = new Date().getHours();
        const wx = {
          temp: c.temperature_2m,
          tempMax: d0.temperature_2m_max?.[0],
          wind: c.wind_speed_10m,
          code: c.weather_code,
          aqi: aqiData?.current?.us_aqi ?? aqiData?.hourly?.us_aqi?.[0],
          uv: h.uv_index?.[hour] ?? d0.uv_index_max?.[0],
          precipProb: h.precipitation_probability?.[hour] ?? d0.precipitation_probability_max?.[0],
          pressure: c.surface_pressure
        };
        evaluateWxAlerts(place, wx);
      } catch (e) {
        console.warn('Alert poll failed for', place?.name, e);
      }
    }
  }

  function startAlertPolling() {
    // First run shortly after load, then every 10 minutes
    setTimeout(() => pollSavedLocationAlerts().catch(() => {}), 12000);
    setInterval(() => pollSavedLocationAlerts().catch(() => {}), 10 * 60 * 1000);
  }

  function wireTip() {
    const tip = $('#fixed-tip');
    if (!sessionStorage.getItem('aura_tip_done')) tip?.classList.add('show');
    $('#tip-close')?.addEventListener('click', () => {
      tip?.classList.remove('show');
      sessionStorage.setItem('aura_tip_done', '1');
    });
  }

  /* Profile → Download APK / iOS (local files in project root — not GitHub) */
  function wireDownloadApk() {
    const toastOn = (sel, label) => {
      $(sel)?.addEventListener('click', () => {
        showToast(`Downloading ${label}…`);
      });
    };
    toastOn('#download-apk-btn', 'Android APK');
    toastOn('#download-ios-btn', 'iOS package');
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
    // Expose boot for optional external init
  window.boot = boot;
  window.Aura = { state, loadPlace, Store, Auth, boot };

  // Modules often load AFTER DOMContentLoaded — call boot safely
  function startApp() {
    try {
      boot();
    } catch (err) {
      console.error('AuraWeather boot failed', err);
      // Force leave splash so user is never stuck
      const sp = document.getElementById('splash-screen');
      if (sp) { sp.classList.add('fade-out'); sp.classList.add('hidden'); }
      const auth = document.getElementById('auth-screen');
      if (auth) auth.classList.remove('hidden');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }
  // Refresh local clock every 30s
  setInterval(() => { if (state.place) updateLocalTime(state.place); }, 30000);
})();
