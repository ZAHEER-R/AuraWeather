const Store = (() => {
  const K = {
    USER: 'aura_user', TOKEN: 'aura_token', LOCAL_USERS: 'aura_local_users',
    SETTINGS: 'aura_settings', SAVED_CITIES: 'aura_saved_cities',
    SEARCH_HISTORY: 'aura_search_history', LOGIN_HISTORY: 'aura_login_history',
    HEALTH_PROFILE: 'aura_health_profile', TRAVEL_DESTS: 'aura_travel_dests',
    LAST_LOCATION: 'aura_last_location', HEALTH_DONE: 'aura_health_onboarded'
  };
  function get(key, fb = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; }
  }
  function set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function remove(key) { localStorage.removeItem(key); }

  function getSettings() {
    return get(K.SETTINGS, {
      theme: 'dark', unit: 'celsius', alerts: false,
      newsAlerts: true, weatherAlerts: true, disasterAlerts: true, personalAlerts: true
    });
  }
  function saveSettings(s) { set(K.SETTINGS, s); }

  function getSavedCities() { return get(K.SAVED_CITIES, []); }
  function saveCity(place) {
    const list = getSavedCities().filter(c => !(c.lat === place.lat && c.lon === place.lon));
    list.unshift({ ...place, savedAt: Date.now() });
    set(K.SAVED_CITIES, list.slice(0, 20));
  }
  function removeCity(lat, lon) {
    set(K.SAVED_CITIES, getSavedCities().filter(c => !(c.lat === lat && c.lon === lon)));
  }
  function isCitySaved(lat, lon) {
    return getSavedCities().some(c => c.lat === lat && c.lon === lon);
  }

  function getSearchHistory() { return get(K.SEARCH_HISTORY, []); }
  function pushSearch(query, place) {
    const list = getSearchHistory().filter(h => h.query !== query);
    list.unshift({ query, place, at: Date.now() });
    set(K.SEARCH_HISTORY, list.slice(0, 30));
  }
  function clearSearchHistory() { set(K.SEARCH_HISTORY, []); }

  function getLoginHistory() { return get(K.LOGIN_HISTORY, []); }
  function pushLogin(entry) {
    const list = getLoginHistory();
    list.unshift({ ...entry, at: Date.now() });
    set(K.LOGIN_HISTORY, list.slice(0, 50));
  }

  function getHealthProfile() { return get(K.HEALTH_PROFILE, null); }
  function saveHealthProfile(p) { set(K.HEALTH_PROFILE, p); set(K.HEALTH_DONE, true); }
  function isHealthOnboarded() { return !!get(K.HEALTH_DONE, false) || !!getHealthProfile(); }

  function getTravelDests() { return get(K.TRAVEL_DESTS, []); }
  function saveTravelDest(d) {
    const list = getTravelDests().filter(x => x.id !== d.id);
    list.unshift(d);
    set(K.TRAVEL_DESTS, list.slice(0, 15));
  }

  function getLastLocation() { return get(K.LAST_LOCATION, null); }
  function setLastLocation(loc) { set(K.LAST_LOCATION, loc); }

  return {
    K, get, set, remove, getSettings, saveSettings,
    getSavedCities, saveCity, removeCity, isCitySaved,
    getSearchHistory, pushSearch, clearSearchHistory, getLoginHistory, pushLogin,
    getHealthProfile, saveHealthProfile, isHealthOnboarded,
    getTravelDests, saveTravelDest, getLastLocation, setLastLocation
  };
})();
window.Store = Store;
