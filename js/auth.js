/* ============================================================
   AUTH — talks to /backend for real signup/login (bcrypt + SQLite).
   Session token is kept in localStorage as "aura_token".

   LOCAL DEMO MODE: if BACKEND_URL is empty (e.g. GitHub Pages), this
   module automatically uses a lightweight in-browser account store
   (localStorage + SHA-256 password hashing via the Web Crypto API).
   This is NOT a substitute for a real backend in production, but it
   makes the app fully functional on static hosts like GitHub Pages.

   Google Sign-In uses Google Identity Services with CONFIG.GOOGLE_CLIENT_ID.
   ============================================================ */
const Auth = (() => {
  const TOKEN_KEY = 'aura_token';
  const USER_KEY = 'aura_user';
  const LOCAL_DB_KEY = 'aura_local_users';

  function getToken(){ return localStorage.getItem(TOKEN_KEY); }
  function getUser(){ try{ return JSON.parse(localStorage.getItem(USER_KEY)); }catch(e){ return null; } }
  function isLoggedIn(){ return !!getToken(); }

  async function sha256(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function getLocalUsers(){ try{ return JSON.parse(localStorage.getItem(LOCAL_DB_KEY)) || {}; }catch(e){ return {}; } }
  function saveLocalUsers(db){ localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db)); }

  function isNetworkError(err){
    return err instanceof TypeError || /fetch/i.test(err.message || '');
  }

  /* ---------- Local demo account helpers ---------- */
  async function localSignup({name, email, age, place, password}){
    if(!name || !email || !password) throw new Error('Name, email and password are required');
    if(password.length < 6) throw new Error('Password must be at least 6 characters');
    const db = getLocalUsers();
    const key = email.toLowerCase();
    if(db[key]) throw new Error('An account with this email already exists');
    const hash = await sha256(password);
    db[key] = { name, email: key, age, place, password_hash: hash, photo: null };
    saveLocalUsers(db);
    const user = { name, email: key, age, place, photo: null, method: 'email-local' };
    localStorage.setItem(TOKEN_KEY, 'local-' + key);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  async function localLogin({email, password}){
    if(!email || !password) throw new Error('Email and password are required');
    const db = getLocalUsers();
    const key = email.toLowerCase();
    const record = db[key];
    if(!record) throw new Error('No account found with this email — try signing up first');
    const hash = await sha256(password);
    if(hash !== record.password_hash) throw new Error('Incorrect password');
    const user = { name: record.name, email: record.email, age: record.age, place: record.place, photo: record.photo, method: 'email-local' };
    localStorage.setItem(TOKEN_KEY, 'local-' + key);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  /* ---------- Backend or local ---------- */
  async function signup(creds){
    if(!CONFIG.BACKEND_URL){
      return localSignup(creds);
    }
    try{
      const res = await fetch(`${CONFIG.BACKEND_URL}/api/signup`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(creds)
      });
      let data;
      try{ data = await res.json(); }catch(_){ data = {}; }
      if(!res.ok) throw new Error(data.error || 'Signup failed');
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }catch(err){
      if(!isNetworkError(err)) throw err;
      return localSignup(creds);
    }
  }

  async function login(creds){
    if(!CONFIG.BACKEND_URL){
      return localLogin(creds);
    }
    try{
      const res = await fetch(`${CONFIG.BACKEND_URL}/api/login`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(creds)
      });
      let data;
      try{ data = await res.json(); }catch(_){ data = {}; }
      if(!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }catch(err){
      if(!isNetworkError(err)) throw err;
      return localLogin(creds);
    }
  }

  function guestLogin(){
    const user = { name:'Guest', email:'', age:null, place:null, photo:null, method:'guest' };
    localStorage.setItem(TOKEN_KEY, 'guest-' + Date.now());
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  function loginWithGoogleCredential(credentialResponse){
    const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
    const user = { name: payload.name, email: payload.email, photo: payload.picture, method:'google' };
    localStorage.setItem(TOKEN_KEY, 'google-' + payload.sub);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  async function updateProfile(fields){
    const token = getToken() || '';
    const isLocal = !CONFIG.BACKEND_URL || token.startsWith('local-') || token.startsWith('guest-') || token.startsWith('google-');
    if(isLocal){
      const current = getUser() || {};
      const updated = { ...current, ...fields };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      if(token.startsWith('local-')){
        const db = getLocalUsers();
        const key = current.email;
        if(db[key]) { db[key] = { ...db[key], ...fields }; saveLocalUsers(db); }
      }
      return updated;
    }
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/profile`, {
      method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${token}`},
      body: JSON.stringify(fields)
    });
    let data;
    try{ data = await res.json(); }catch(_){ data = {}; }
    if(!res.ok) throw new Error(data.error || 'Update failed');
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  }

  function logout(){
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    location.reload();
  }

  return { signup, login, logout, getUser, isLoggedIn, loginWithGoogleCredential, updateProfile, guestLogin };
})();