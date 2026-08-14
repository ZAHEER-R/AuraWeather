/* ============================================================
   NOTIFICATIONS — browser push + permission + V2 FCM hooks
   Works on mobile browsers that support Notification API.
   ============================================================ */
const Notify = (() => {
  let permission = typeof Notification !== 'undefined' ? Notification.permission : 'denied';

  function supported() {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  async function requestPermission() {
    if (!supported()) return 'unsupported';
    try {
      permission = await Notification.requestPermission();
      return permission;
    } catch {
      return 'denied';
    }
  }

  function getPermission() {
    if (!supported()) return 'unsupported';
    permission = Notification.permission;
    return permission;
  }

  function show(title, options = {}) {
    if (!supported() || getPermission() !== 'granted') return null;
    try {
      const n = new Notification(title, {
        icon: 'favicon.png',
        badge: 'favicon.png',
        ...options
      });
      n.onclick = () => { window.focus(); n.close(); };
      return n;
    } catch (e) {
      console.warn('Notification failed', e);
      return null;
    }
  }

  function weatherAlert(placeName, summary) {
    const settings = Store.getSettings();
    if (!settings.alerts || !settings.weatherAlerts) return;
    show(`AuraWeather · ${placeName}`, {
      body: summary,
      tag: 'weather-alert',
      requireInteraction: false
    });
  }

  function newsAlert(headline) {
    const settings = Store.getSettings();
    if (!settings.alerts || !settings.newsAlerts) return;
    show('AuraWeather News', { body: headline, tag: 'news-alert' });
  }

  function disasterAlert(type, level, note) {
    const settings = Store.getSettings();
    if (!settings.alerts || !settings.disasterAlerts) return;
    if (level === 'Low') return;
    show(`⚠️ ${type} · ${level}`, { body: note, tag: 'disaster-' + type, requireInteraction: true });
  }

  // V2 placeholder: register FCM token when Firebase is configured
  async function registerFCM() {
    if (!CONFIG.FIREBASE?.apiKey || !CONFIG.FIREBASE?.vapidKey) {
      return { ok: false, reason: 'Firebase not configured (V2)' };
    }
    // Future: firebase.initializeApp + messaging.getToken
    return { ok: false, reason: 'Wire Firebase Messaging in V2' };
  }

  return {
    supported, requestPermission, getPermission, show,
    weatherAlert, newsAlert, disasterAlert, registerFCM
  };
})();
