# Supabase Integration Guide for AuraWeather

## Why Supabase Over Firebase?

| Feature | Firebase | Supabase | Winner |
|---------|----------|----------|--------|
| **Pricing** | Requires billing card (pay-as-you-go) | Free tier: 500MB DB, 2GB bandwidth | ✅ Supabase |
| **Database** | NoSQL (Firestore) | PostgreSQL (Full SQL) | ✅ Supabase |
| **Real-time** | Limited | Full real-time subscriptions | ✅ Supabase |
| **Auth** | Good | Built-in, OAuth providers | 🟰 Tie |
| **Free Tier** | Limited | Generous (500MB DB) | ✅ Supabase |

**Cost**: Supabase is completely free until you need to scale!

---

## Phase 1: Supabase Project Setup

### Step 1.1: Create Supabase Account
1. Go to https://supabase.com
2. Sign up with email (or GitHub)
3. Create new organization
4. Create new project → name: "AuraWeather"

### Step 1.2: Get Credentials
1. In Supabase Dashboard → "Project Settings"
2. Copy URL and anon key
3. Add to `js/supabase-config.js`:

```javascript
const SUPABASE_URL = "https://bqbubmjibhjrutcgstnq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

### Step 1.3: Create Database Tables
1. In Supabase → "SQL Editor"
2. Click "New query"
3. Paste entire SQL from `SUPABASE_SCHEMA.md`
4. Click "Run"

### Step 1.4: Enable RLS (Row Level Security)
1. In Supabase → "Authentication" → "Policies"
2. Copy RLS policies from `SUPABASE_SCHEMA.md`
3. Apply to each table

### Step 1.5: Setup Authentication
1. In Supabase → "Authentication" → "Providers"
2. Enable:
   - **Email/Password** ✅
   - **Google OAuth** (add credentials)
   - **GitHub OAuth** (optional)

### Step 1.6: Configure Auth URLs
1. Settings → "Authentication"
2. Add "Site URL": `https://yourdomain.com`
3. Add "Redirect URLs": `https://yourdomain.com/auth/callback`

---

## Phase 2: Code Integration

### Step 2.1: Update `index.html`
```html
<!-- Add to <head> or before closing </body> -->
<script type="module">
  import SupabaseService from './js/supabase-service.js';
  import NotificationManager from './js/notification-manager.js';
  
  // Initialize Supabase
  SupabaseService.init(
    'https://your-project.supabase.co',
    'YOUR_ANON_KEY'
  );
  
  // Initialize notifications with VAPID public key
  NotificationManager.init('YOUR_VAPID_PUBLIC_KEY');
</script>
```

### Step 2.2: Update `js/auth.js`
Replace localStorage with Supabase Auth:

```javascript
import SupabaseService from './supabase-service.js';

const Auth = (() => {
  async function signUp(email, password, name) {
    return await SupabaseService.signUp(email, password, name);
  }

  async function signIn(email, password) {
    return await SupabaseService.signIn(email, password);
  }

  async function logout() {
    return await SupabaseService.signOut();
  }

  function isLoggedIn() {
    return SupabaseService.getCurrentUser() !== null;
  }

  function getCurrentUserEmail() {
    return SupabaseService.getCurrentUser()?.email || null;
  }

  return {
    signUp,
    signIn,
    logout,
    isLoggedIn,
    getCurrentUserEmail
  };
})();

export default Auth;
```

### Step 2.3: Update `js/storage.js` (Abstraction Layer)
```javascript
import SupabaseService from './supabase-service.js';

const Store = (() => {
  async function getSettings() {
    const user = SupabaseService.getCurrentUser();
    return user ? await SupabaseService.getSettings(user.id) : null;
  }

  async function saveSettings(settings) {
    const user = SupabaseService.getCurrentUser();
    return user ? await SupabaseService.updateSettings(user.id, settings) : null;
  }

  async function getSavedCities() {
    const user = SupabaseService.getCurrentUser();
    return user ? await SupabaseService.getSavedPlaces(user.id) : [];
  }

  async function addSavedCity(place) {
    const user = SupabaseService.getCurrentUser();
    return user ? await SupabaseService.addSavedPlace(user.id, place) : null;
  }

  async function getHealthProfile() {
    const user = SupabaseService.getCurrentUser();
    return user ? await SupabaseService.getHealthProfile(user.id) : null;
  }

  async function saveHealthProfile(profile) {
    const user = SupabaseService.getCurrentUser();
    return user ? await SupabaseService.setHealthProfile(user.id, profile) : null;
  }

  return {
    getSettings,
    saveSettings,
    getSavedCities,
    addSavedCity,
    getHealthProfile,
    saveHealthProfile
    // ... other methods
  };
})();

export default Store;
```

### Step 2.4: Update `js/app.js`
```javascript
import SupabaseService from './supabase-service.js';
import NotificationManager from './js/notification-manager.js';

function init() {
  // Initialize Supabase
  SupabaseService.init(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Initialize notifications
  NotificationManager.init(VAPID_PUBLIC_KEY);
  
  // Setup scheduled notifications
  const user = SupabaseService.getCurrentUser();
  if (user) {
    NotificationManager.setupScheduledNotifications(user.id);
  }

  // ... rest of initialization
}
```

---

## Phase 3: Notification Features

### 3.1: Password Reset Notifications
```javascript
import NotificationManager from './js/notification-manager.js';

async function handleForgotPassword(email) {
  // Send password reset email
  await SupabaseService.initPasswordReset(email);
  
  // Send notification
  await NotificationManager.sendPasswordResetNotification(email);
}
```

### 3.2: Weather Alert Notifications
```javascript
import NotificationManager from './js/notification-manager.js';

async function handleWeatherAlert(userId, weatherData) {
  if (weatherData.temp > 40 || weatherData.uv_index > 9) {
    await NotificationManager.sendWeatherAlertNotification(userId, weatherData);
  }
}
```

### 3.3: Disaster Alert Notifications
```javascript
async function handleDisasterAlert(userId, disasterData) {
  await NotificationManager.sendDisasterAlertNotification(userId, {
    type: 'earthquake',
    location: 'San Francisco, CA',
    severity: 'high',
    description: '5.2 magnitude earthquake detected',
    lat: 37.7749,
    lon: -122.4194,
    url: '/disaster/earthquake-2024'
  });
}
```

### 3.4: Daily Planner Notifications
```javascript
async function sendDailyPlanner(userId) {
  const weather = await getWeatherData(userId);
  const health = await SupabaseService.getHealthProfile(userId);
  
  const planner = generatePlanner(weather, health);
  
  await NotificationManager.sendDailyPlannerNotification(userId, {
    location: weather.location,
    temp: weather.temp,
    uv_index: weather.uv_index,
    pack_items: planner.items,
    activities: planner.activities
  });
}
```

### 3.5: Clothing Recommendation Notifications
```javascript
async function sendClothingRecommendation(userId) {
  const weather = await getWeatherData(userId);
  const recommendation = generateClothingRec(weather);
  
  await NotificationManager.sendClothingRecommendationNotification(userId, {
    temp: weather.temp,
    wind: weather.wind_speed,
    conditions: weather.description,
    top: recommendation.top,
    bottom: recommendation.bottom,
    outer: recommendation.outer,
    accessories: recommendation.accessories
  });
}
```

### 3.6: Schedule Notifications
```javascript
// Setup daily planner for 9 AM every day
await SupabaseService.addNotificationSchedule(userId, {
  type: 'daily_planner',
  time_of_day: '09:00',
  days_of_week: ['1', '2', '3', '4', '5', '6', '0'], // All days
  enabled: true
});

// Setup clothing recommendation for 7 AM on weekdays
await SupabaseService.addNotificationSchedule(userId, {
  type: 'clothing_recommendation',
  time_of_day: '07:00',
  days_of_week: ['1', '2', '3', '4', '5'], // Weekdays only
  enabled: true
});
```

---

## Phase 4: Setup Web Push Notifications

### 4.1: Generate VAPID Keys
```bash
# Using web-push CLI
npm install -g web-push
web-push generate-vapid-keys
```

Output:
```
Public Key: BB...
Private Key: XX...
```

### 4.2: Add to Backend
Store private key securely in backend environment:
```
VAPID_PRIVATE_KEY=XX...
VAPID_PUBLIC_KEY=BB...
```

### 4.3: Register Service Worker
Add to your app initialization:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('Service Worker registered'))
    .catch(err => console.error('SW registration failed', err));
}
```

### 4.4: Request Notification Permission
```javascript
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notifications enabled');
    }
  }
}
```

---

## Phase 5: Real-time Notifications

The app automatically receives notifications in real-time when they're created:

```javascript
// Subscribe to user's notifications
const channel = NotificationManager.subscribeToRealtimeNotifications(userId, (notification) => {
  console.log('New notification received:', notification);
  // Display to user automatically
});

// Unsubscribe when needed
SupabaseService.unsubscribeFromNotifications(channel);
```

---

## Phase 6: Testing

### Test Checklist
- [ ] Sign up new user
- [ ] Verify user in Supabase `users` table
- [ ] Request notification permission
- [ ] Enable weather alerts in settings
- [ ] Check device token saved in `device_tokens` table
- [ ] Trigger weather alert → verify notification
- [ ] Setup daily planner schedule
- [ ] Wait for scheduled time → notification arrives
- [ ] Click notification → opens app
- [ ] View notification in notification center
- [ ] Mark as read → updates in DB
- [ ] Offline mode works

### Debug Logs
```javascript
// Enable debug logging
localStorage.setItem('DEBUG_NOTIFICATIONS', 'true');
```

---

## Phase 7: Data Migration

### Migrate from localStorage to Supabase
```javascript
async function migrateData() {
  const user = SupabaseService.getCurrentUser();
  if (user) {
    const result = await SupabaseService.migrateFromLocalStorage(user.id);
    if (result.success) {
      console.log('Migration completed!');
      // Clear localStorage
      localStorage.clear();
    }
  }
}

// Run after first login
await migrateData();
```

---

## File Structure After Integration

```
AuraWeather/
├── js/
│   ├── app.js (updated - Supabase init)
│   ├── auth.js (updated - Supabase auth)
│   ├── storage.js (updated - Supabase storage)
│   ├── supabase-service.js (new)
│   ├── supabase-config.js (new)
│   ├── notification-manager.js (new)
│   └── ...
├── public/
│   ├── sw.js (new - Service Worker)
│   └── ...
├── SUPABASE_SCHEMA.md (new - Database schema)
├── SUPABASE_INTEGRATION.md (this file)
└── ...
```

---

## Troubleshooting

### Issue: "Supabase not initialized"
**Solution**: Call `SupabaseService.init()` before other calls

### Issue: "Permission denied" errors
**Solution**: Check RLS policies are enabled and correct

### Issue: Notifications not showing
**Solution**: 
- Verify browser allows notifications
- Check Service Worker is registered
- Check VAPID keys are correct

### Issue: Real-time subscriptions not working
**Solution**: Ensure Realtime is enabled in Supabase settings

---

## Supabase Free Tier Limits

| Quota | Limit |
|-------|-------|
| Database Size | 500 MB |
| Bandwidth | 2 GB/month |
| Max Connections | 10 |
| Storage | 1 GB |
| Monthly Active Users | Unlimited |

**Upgrade when needed**: Paying plan starts at $5/month

---

## Security Best Practices

✅ **Always do:**
- Use RLS policies (enable on all tables)
- Never expose private keys in frontend
- Use HTTPS only
- Validate user input
- Rate limit APIs

❌ **Never do:**
- Store passwords in plain text
- Use `service_role` key in frontend
- Trust client-side validation
- Log sensitive data

---

## Support Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Authentication](https://supabase.com/docs/guides/auth)
- [Firestore vs Supabase](https://supabase.com/docs/guides/getting-started)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

---

## Next Steps

1. ✅ Create Supabase project
2. ✅ Setup database schema
3. ✅ Configure authentication
4. ✅ Update app code
5. ✅ Generate VAPID keys
6. ✅ Setup notifications
7. ✅ Test all features
8. ✅ Migrate data
9. ✅ Deploy to production
