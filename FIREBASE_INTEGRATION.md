# Firebase Integration Guide for AuraWeather

## Overview
This guide explains how to integrate Firebase (Firestore + Auth) into the existing AuraWeather app that currently uses localStorage (V1).

## Phase 1: Setup (Before Coding)

### Step 1.1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a new project" → Name: "AuraWeather"
3. Accept defaults and create

### Step 1.2: Enable Firestore Database
1. In Firebase Console → "Firestore Database"
2. Click "Create Database"
3. Choose region (e.g., `us-central1`)
4. Start in "test mode" (you'll secure it later with proper rules)

### Step 1.3: Enable Authentication
1. In Firebase Console → "Authentication" → "Get started"
2. Enable providers:
   - **Email/Password** - for local authentication
   - **Google** - for OAuth (requires OAuth 2.0 credentials)

### Step 1.4: Get Config Credentials
1. Click Project Settings (⚙️ icon)
2. Go to "Your apps" section
3. Click the Web app (</> icon)
4. Copy the config object
5. Paste into `js/firebase-config.js`

### Step 1.5: Update Firestore Security Rules
1. In Firestore Database → "Rules" tab
2. Copy rules from `FIREBASE_SCHEMA.md`
3. Click "Publish"

---

## Phase 2: Code Integration

### Step 2.1: Update `index.html`
Add Firebase scripts before your app initialization:

```html
<!-- At the end of <head> or before closing </body> -->
<script type="module">
  import FirebaseService from './js/firebase-service.js';
  import app from './js/app.js';
  
  // Initialize Firebase before starting app
  FirebaseService.init();
</script>
```

### Step 2.2: Update `js/auth.js`
Replace localStorage with Firebase Authentication:

```javascript
import FirebaseService from './firebase-service.js';

const Auth = (() => {
  // ... existing code ...

  async function signUp(email, password, name) {
    const result = await FirebaseService.signUp(email, password, name);
    if (result.success) {
      console.log('Signup successful:', result.user.uid);
    }
    return result;
  }

  async function signIn(email, password) {
    const result = await FirebaseService.signIn(email, password);
    if (result.success) {
      console.log('Login successful:', result.user.uid);
    }
    return result;
  }

  async function logout() {
    return await FirebaseService.signOut();
  }

  function isLoggedIn() {
    return FirebaseService.getCurrentUser() !== null;
  }

  function getCurrentUserEmail() {
    return FirebaseService.getCurrentUser()?.email || null;
  }

  return {
    signUp,
    signIn,
    logout,
    isLoggedIn,
    getCurrentUserEmail,
    // ... other existing methods ...
  };
})();

export default Auth;
```

### Step 2.3: Update `js/storage.js` (Abstraction Layer)
Create a dual-mode storage system that works with both localStorage and Firebase:

```javascript
import FirebaseService from './firebase-service.js';

const Store = (() => {
  const USE_FIREBASE = true; // Toggle to switch backends

  async function saveUser(email, userData) {
    if (USE_FIREBASE) {
      return await FirebaseService.updateUser(userData.id, userData);
    } else {
      const users = JSON.parse(localStorage.getItem('aura_local_users') || '{}');
      users[email] = userData;
      localStorage.setItem('aura_local_users', JSON.stringify(users));
      return { success: true };
    }
  }

  async function loadUser(email) {
    if (USE_FIREBASE) {
      const user = FirebaseService.getCurrentUser();
      return user ? await FirebaseService.getUser(user.uid) : null;
    } else {
      const users = JSON.parse(localStorage.getItem('aura_local_users') || '{}');
      return users[email] || null;
    }
  }

  async function getSettings() {
    if (USE_FIREBASE) {
      const user = FirebaseService.getCurrentUser();
      return user ? await FirebaseService.getSettings(user.uid) : null;
    } else {
      return JSON.parse(localStorage.getItem('aura_settings') || '{}');
    }
  }

  async function saveSettings(settings) {
    if (USE_FIREBASE) {
      const user = FirebaseService.getCurrentUser();
      return user ? await FirebaseService.updateSettings(user.uid, settings) : null;
    } else {
      localStorage.setItem('aura_settings', JSON.stringify(settings));
      return { success: true };
    }
  }

  async function getSavedCities() {
    if (USE_FIREBASE) {
      const user = FirebaseService.getCurrentUser();
      return user ? await FirebaseService.getSavedPlaces(user.uid) : [];
    } else {
      return JSON.parse(localStorage.getItem('aura_saved_cities') || '[]');
    }
  }

  async function addSavedCity(place) {
    if (USE_FIREBASE) {
      const user = FirebaseService.getCurrentUser();
      return user ? await FirebaseService.addSavedPlace(user.uid, place) : null;
    } else {
      const cities = JSON.parse(localStorage.getItem('aura_saved_cities') || '[]');
      cities.push(place);
      localStorage.setItem('aura_saved_cities', JSON.stringify(cities));
      return { success: true };
    }
  }

  async function removeSavedCity(placeId) {
    if (USE_FIREBASE) {
      return await FirebaseService.removeSavedPlace(placeId);
    } else {
      const cities = JSON.parse(localStorage.getItem('aura_saved_cities') || '[]');
      const filtered = cities.filter(c => c.id !== placeId);
      localStorage.setItem('aura_saved_cities', JSON.stringify(filtered));
      return { success: true };
    }
  }

  async function getHealthProfile() {
    if (USE_FIREBASE) {
      const user = FirebaseService.getCurrentUser();
      return user ? await FirebaseService.getHealthProfile(user.uid) : null;
    } else {
      return JSON.parse(localStorage.getItem('aura_health_profile') || '{}');
    }
  }

  async function saveHealthProfile(profile) {
    if (USE_FIREBASE) {
      const user = FirebaseService.getCurrentUser();
      return user ? await FirebaseService.setHealthProfile(user.uid, profile) : null;
    } else {
      localStorage.setItem('aura_health_profile', JSON.stringify(profile));
      return { success: true };
    }
  }

  async function addSearchEvent(query, place) {
    if (USE_FIREBASE) {
      const user = FirebaseService.getCurrentUser();
      if (user) {
        return await FirebaseService.addSearchEvent(user.uid, query, place);
      }
    } else {
      const history = JSON.parse(localStorage.getItem('aura_search_history') || '[]');
      history.unshift({ query, place, at: Date.now() });
      history.splice(30); // Keep max 30
      localStorage.setItem('aura_search_history', JSON.stringify(history));
    }
    return { success: true };
  }

  async function getSearchHistory() {
    if (USE_FIREBASE) {
      const user = FirebaseService.getCurrentUser();
      return user ? await FirebaseService.getSearchHistory(user.uid, 30) : [];
    } else {
      return JSON.parse(localStorage.getItem('aura_search_history') || '[]');
    }
  }

  async function pushSearch(query, place) {
    return await addSearchEvent(query, place);
  }

  return {
    saveUser,
    loadUser,
    getSettings,
    saveSettings,
    getSavedCities,
    addSavedCity,
    removeSavedCity,
    getHealthProfile,
    saveHealthProfile,
    addSearchEvent,
    getSearchHistory,
    pushSearch,
    // ... other existing methods ...
  };
})();

export default Store;
```

### Step 2.4: Update `js/app.js` - Initialize Firebase

At the beginning of your initialization:

```javascript
import FirebaseService from './firebase-service.js';

function init() {
  // Initialize Firebase first
  if (!FirebaseService.init()) {
    console.warn('Firebase not available, using localStorage');
  }

  // ... rest of initialization ...
}
```

---

## Phase 3: Data Migration

### Step 3.1: Create Migration Script

Add to `js/app.js` or a separate `js/migrate.js`:

```javascript
async function migrateLocalStorageToFirebase() {
  const user = FirebaseService.getCurrentUser();
  if (!user) {
    console.log('User not logged in, skipping migration');
    return;
  }

  console.log('Starting migration for user:', user.email);

  const result = await FirebaseService.migrateFromLocalStorage(user.uid);
  if (result.success) {
    console.log('Migration successful!');
    // Optionally clear localStorage after successful migration
    // localStorage.removeItem('aura_saved_cities');
    // localStorage.removeItem('aura_search_history');
  } else {
    console.error('Migration failed:', result.error);
  }
}
```

### Step 3.2: Run Migration on First Login
```javascript
async function afterAuth(freshLogin) {
  // ... existing code ...
  
  if (freshLogin) {
    // Offer migration or auto-migrate
    migrateLocalStorageToFirebase();
  }
  
  // ... rest of code ...
}
```

---

## Phase 4: Testing

### Test Checklist
- [ ] Sign up new user with email/password
- [ ] Sign in with email/password
- [ ] Verify user document created in Firestore
- [ ] Save a place → verify in `saved_places` collection
- [ ] Search for location → verify in `search_history` collection
- [ ] Update settings → verify in `user_settings` collection
- [ ] Offline mode works (data persists locally, syncs when online)
- [ ] Migration from localStorage works
- [ ] Security rules prevent unauthorized access

### Debugging
Enable Firestore logging in browser console:

```javascript
// In firebase-service.js or console
import { enableLogging } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
enableLogging(true);
```

---

## Phase 5: Deployment

### Production Checklist
1. **Update Security Rules** - Remove test mode rules, use production rules from FIREBASE_SCHEMA.md
2. **Enable Email Verification** - In Auth > Settings
3. **Setup Custom Domain** - For auth domain
4. **Configure OAuth Redirect URLs** - Add your domain
5. **Enable Firestore Backups** - In Database > Backups
6. **Monitor Firestore Usage** - Setup quota alerts
7. **Setup Firebase Monitoring** - Enable Crashlytics and Performance

### Environment Config
```javascript
// Use different Firebase projects for dev/prod
const firebaseConfig = process.env.NODE_ENV === 'production'
  ? PRODUCTION_CONFIG
  : DEVELOPMENT_CONFIG;
```

---

## File Structure After Integration

```
AuraWeather/
├── js/
│   ├── app.js (updated - Firebase init)
│   ├── auth.js (updated - Firebase auth)
│   ├── storage.js (updated - dual-mode storage)
│   ├── firebase-service.js (new - Firebase ops)
│   ├── firebase-config.js (new - config template)
│   └── ... (other existing files)
├── FIREBASE_SCHEMA.md (new - schema docs)
├── FIREBASE_INTEGRATION.md (this file)
└── ... (other existing files)
```

---

## Troubleshooting

### Issue: CORS errors
**Solution**: Check Firebase config is correct, domain is in authorized origins

### Issue: Firestore permission denied
**Solution**: Check security rules are published correctly

### Issue: Auth not persisting across browser refresh
**Solution**: Ensure `setPersistence` is enabled in firebase-service.js

### Issue: Data not syncing
**Solution**: Check internet connection, verify Firestore quota not exceeded

---

## Next Steps

1. ✅ Create Firebase project
2. ✅ Setup Firestore and Auth
3. ✅ Configure firebase-config.js
4. ✅ Update app code
5. ✅ Test all features
6. ✅ Migrate data
7. ✅ Deploy to production

## Support Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [Firebase Auth Guide](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)
