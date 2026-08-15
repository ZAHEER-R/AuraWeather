/* ============================================================
   AUTH — local-first (SHA-256) + Google GIS + Forgot Password OTP
   V2: swap to backend / Firebase Auth when BACKEND_URL or Firebase is set.
   ============================================================ */
const Auth = (() => {
  const TOKEN_KEY = 'aura_token';
  const USER_KEY = 'aura_user';
  const LOCAL_DB_KEY = 'aura_local_users';
  const OTP_KEY = 'aura_otp_pending';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
  function isLoggedIn() { return !!getToken(); }

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getLocalUsers() { try { return JSON.parse(localStorage.getItem(LOCAL_DB_KEY)) || {}; } catch { return {}; } }
  function saveLocalUsers(db) { localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db)); }

  function setSession(user, token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (typeof Store !== 'undefined') {
      Store.pushLogin({ email: user.email, method: user.method || 'email', success: true });
    }
  }

  async function localSignup({ name, email, age, place, password }) {
    if (!name || !email || !password) throw new Error('Name, email and password are required');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    const db = getLocalUsers();
    const key = email.toLowerCase().trim();
    if (db[key]) throw new Error('An account with this email already exists');
    const hash = await sha256(password);
    db[key] = {
      name, email: key, age: age || null, place: place || '',
      password_hash: hash, photo: null, createdAt: Date.now()
    };
    saveLocalUsers(db);
    const user = { name, email: key, age, place, photo: null, method: 'email-local' };
    setSession(user, 'local-' + key);
    return user;
  }

  async function localLogin({ email, password }) {
    if (!email || !password) throw new Error('Email and password are required');
    const db = getLocalUsers();
    const key = email.toLowerCase().trim();
    const record = db[key];
    if (!record) throw new Error('No account found with this email — try signing up first');
    const hash = await sha256(password);
    if (hash !== record.password_hash) {
      if (typeof Store !== 'undefined') Store.pushLogin({ email: key, method: 'email', success: false });
      throw new Error('Incorrect password');
    }
    const user = {
      name: record.name, email: record.email, age: record.age,
      place: record.place, photo: record.photo, method: 'email-local'
    };
    setSession(user, 'local-' + key);
    return user;
  }

  /* ---------- Forgot Password (V1: simulated OTP stored locally) ---------- */
  async function requestPasswordReset(email) {
    const key = (email || '').toLowerCase().trim();
    if (!key) throw new Error('Email is required');
    const db = getLocalUsers();
    if (!db[key]) throw new Error('No registered account found with this email');
    // Generate 6-digit OTP (V1 demo — in V2 this is sent via Firebase / email backend)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const payload = { email: key, otp, expires: Date.now() + 10 * 60 * 1000 };
    sessionStorage.setItem(OTP_KEY, JSON.stringify(payload));
    // In real V2: call backend or Firebase to send OTP via email/SMS/FCM
    console.info('[AuraWeather V1] Demo OTP for', key, '→', otp, '(valid 10 min). In production this is emailed / pushed.');
    return { ok: true, message: 'OTP generated. In this demo it is shown in the console (and UI for testing). Check browser console or use the on-screen code.' , demoOtp: otp };
  }

  async function verifyOtpAndReset(email, otp, newPassword) {
    if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters');
    const raw = sessionStorage.getItem(OTP_KEY);
    if (!raw) throw new Error('No OTP request found. Request a new one.');
    const pending = JSON.parse(raw);
    if (pending.email !== email.toLowerCase().trim()) throw new Error('Email mismatch');
    if (Date.now() > pending.expires) throw new Error('OTP expired. Request a new one.');
    if (String(otp).trim() !== String(pending.otp)) throw new Error('Invalid OTP');
    const db = getLocalUsers();
    const key = pending.email;
    if (!db[key]) throw new Error('Account not found');
    db[key].password_hash = await sha256(newPassword);
    saveLocalUsers(db);
    sessionStorage.removeItem(OTP_KEY);
    return { ok: true };
  }

  async function signup(creds) {
    if (!CONFIG.BACKEND_URL) return localSignup(creds);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/api/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      setSession(data.user, data.token);
      return data.user;
    } catch (err) {
      if (err.message && !/fetch/i.test(err.message)) throw err;
      return localSignup(creds);
    }
  }

  async function login(creds) {
    if (!CONFIG.BACKEND_URL) return localLogin(creds);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/api/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setSession(data.user, data.token);
      return data.user;
    } catch (err) {
      if (err.message && !/fetch/i.test(err.message)) throw err;
      return localLogin(creds);
    }
  }

  function loginWithGoogle(credentialResponse) {
    // Decode JWT payload (client-side display only; verify on backend in V2)
    try {
      const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const user = {
        name: payload.name || payload.given_name || 'Google User',
        email: payload.email,
        photo: payload.picture || null,
        age: null, place: '',
        method: 'google'
      };
      setSession(user, 'google-' + (payload.sub || payload.email));
      // Persist a minimal local record so profile works offline
      const db = getLocalUsers();
      const key = user.email.toLowerCase();
      if (!db[key]) {
        db[key] = { name: user.name, email: key, age: null, place: '', password_hash: null, photo: user.photo, method: 'google', createdAt: Date.now() };
        saveLocalUsers(db);
      }
      return user;
    } catch (e) {
      throw new Error('Google sign-in failed to parse credential');
    }
  }

  function updateProfile(updates) {
    const user = getUser();
    if (!user) return null;
    const next = { ...user, ...updates };
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    const db = getLocalUsers();
    const key = (user.email || '').toLowerCase();
    if (db[key]) {
      Object.assign(db[key], { name: next.name, age: next.age, place: next.place, photo: next.photo });
      saveLocalUsers(db);
    }
    return next;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function initGoogleButton(containerId, onSuccess, onError) {
    if (!CONFIG.GOOGLE_CLIENT_ID || !window.google?.accounts?.id) {
      return false;
    }
    try {
      google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: (resp) => {
          try {
            const user = loginWithGoogle(resp);
            onSuccess && onSuccess(user);
          } catch (e) { onError && onError(e); }
        },
        auto_select: false
      });
      const el = document.getElementById(containerId);
      if (el) {
        // Fit inside auth card on mobile (card padding already applied on parent)
        const parentW = (el.parentElement && el.parentElement.clientWidth) || el.clientWidth || 280;
        const available = Math.max(200, Math.floor(parentW - 4));
        const btnWidth = Math.min(300, available);
        google.accounts.id.renderButton(el, {
          theme: 'outline', size: 'large', width: btnWidth, text: 'continue_with', shape: 'pill'
        });
      }
      return true;
    } catch (e) {
      console.warn('Google GIS init failed', e);
      return false;
    }
  }

  return {
    getToken, getUser, isLoggedIn, signup, login, logout, updateProfile,
    requestPasswordReset, verifyOtpAndReset, initGoogleButton, loginWithGoogle
  };
})();
window.Auth = Auth;
