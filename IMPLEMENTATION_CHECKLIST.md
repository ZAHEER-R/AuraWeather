# AuraWeather Implementation Checklist

## Phase 1: Supabase Setup (15 minutes)

### 1.1: Create Supabase Account
- [ ] Go to https://supabase.com
- [ ] Click "Sign up"
- [ ] Use email or GitHub (no payment required!)
- [ ] Verify email
- [ ] Create new organization (optional)

### 1.2: Create Project
- [ ] Click "Create new project"
- [ ] Name: "AuraWeather"
- [ ] Choose region closest to you (e.g., us-east-1)
- [ ] Set database password (save it!)
- [ ] Click "Create project"
- [ ] Wait 2-3 minutes for database setup

### 1.3: Get Credentials
- [ ] Click "Project Settings" (⚙️)
- [ ] Go to "API" tab
- [ ] Copy "Project URL" → Add to `js/supabase-config.js` as SUPABASE_URL
- [ ] Copy "anon public" key → Add to `js/supabase-config.js` as SUPABASE_ANON_KEY
- [ ] Save file

### 1.4: Create Database Tables
- [ ] In Supabase, go to "SQL Editor"
- [ ] Click "New Query"
- [ ] Open `SUPABASE_SCHEMA.md`
- [ ] Copy entire SQL schema
- [ ] Paste into SQL Editor
- [ ] Click "Run" (blue button)
- [ ] Verify all 12 tables created in "Tables" section

**Check**: You should see these tables:
- [ ] users
- [ ] health_profiles
- [ ] user_settings
- [ ] saved_places
- [ ] search_history
- [ ] login_history
- [ ] travel_destinations
- [ ] device_tokens
- [ ] notifications
- [ ] notification_schedules
- [ ] password_resets
- [ ] last_location

### 1.5: Setup Authentication
- [ ] Go to "Authentication" tab
- [ ] Click "Providers"
- [ ] Click "Email/Password" provider
- [ ] Toggle "Enabled" to ON
- [ ] (Optional) Enable "Google" OAuth

### 1.6: Configure Auth URLs
- [ ] Still in Authentication
- [ ] Go to "Settings" (gear icon)
- [ ] Find "Site URL"
- [ ] Enter: `http://localhost:3000` (for development)
- [ ] Add "Redirect URLs": `http://localhost:3000/auth/callback`
- [ ] (For production: use your domain)

### 1.7: Enable Row Level Security (RLS)
- [ ] Go to "Authentication" → "Policies"
- [ ] Go back to SQL Editor
- [ ] Open `SUPABASE_SCHEMA.md`
- [ ] Copy RLS policies section
- [ ] For each table, create policy:
  - [ ] users - read own profile
  - [ ] health_profiles - manage own
  - [ ] user_settings - manage own
  - [ ] saved_places - manage own
  - [ ] search_history - manage own
  - [ ] login_history - read own
  - [ ] travel_destinations - manage own
  - [ ] device_tokens - manage own
  - [ ] notifications - read own
  - [ ] notification_schedules - manage own
  - [ ] last_location - manage own

---

## Phase 2: Generate VAPID Keys (5 minutes)

### 2.1: Install Web Push CLI
```bash
npm install -g web-push
```

### 2.2: Generate VAPID Keys
```bash
web-push generate-vapid-keys
```

### 2.3: Save Keys
- [ ] You'll see:
  ```
  Public Key: BB...
  Private Key: XX...
  ```
- [ ] Add Public Key to `js/supabase-config.js` as VAPID_PUBLIC_KEY
- [ ] **IMPORTANT**: Save Private Key in your backend `.env` file (not frontend!)

---

## Phase 3: Code Integration (30 minutes)

### 3.1: Update `index.html`
- [ ] Add initialization script before closing `</body>`:
```html
<script type="module">
  import SupabaseService from './js/supabase-service.js';
  import NotificationManager from './js/notification-manager.js';
  import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './js/supabase-config.js';
  
  // Initialize services
  SupabaseService.init(SUPABASE_URL, SUPABASE_ANON_KEY);
  NotificationManager.init(VAPID_PUBLIC_KEY);
</script>
```

### 3.2: Update `js/auth.js`
- [ ] Import SupabaseService
- [ ] Replace signup with `SupabaseService.signUp()`
- [ ] Replace signin with `SupabaseService.signIn()`
- [ ] Replace logout with `SupabaseService.signOut()`
- [ ] Update `isLoggedIn()` to use `SupabaseService.getCurrentUser()`

### 3.3: Update `js/storage.js`
- [ ] Create abstraction layer functions:
  - [ ] `getSettings()` → calls `SupabaseService.getSettings()`
  - [ ] `saveSettings()` → calls `SupabaseService.updateSettings()`
  - [ ] `getSavedCities()` → calls `SupabaseService.getSavedPlaces()`
  - [ ] `addSavedCity()` → calls `SupabaseService.addSavedPlace()`
  - [ ] `getHealthProfile()` → calls `SupabaseService.getHealthProfile()`
  - [ ] `saveHealthProfile()` → calls `SupabaseService.setHealthProfile()`

### 3.4: Update `js/app.js`
- [ ] Import SupabaseService at top
- [ ] Import NotificationManager at top
- [ ] Call `SupabaseService.init()` in `init()` function
- [ ] Call `NotificationManager.init()` after Supabase init
- [ ] After login, call `NotificationManager.setupScheduledNotifications(userId)`

### 3.5: Create Settings UI
Add checkboxes to user settings page:
- [ ] Weather Alerts toggle
- [ ] Disaster Alerts toggle
- [ ] Daily Planner toggle
- [ ] Clothing Recommendations toggle
- [ ] Notification Time picker (HH:MM)

Save changes:
```javascript
document.getElementById('weather-alerts').addEventListener('change', async (e) => {
  const user = SupabaseService.getCurrentUser();
  await SupabaseService.updateSettings(user.id, {
    weather_alerts: e.target.checked
  });
});
```

### 3.6: Create Notification Center UI
- [ ] Add notifications page/modal
- [ ] Load notifications: `await SupabaseService.getNotifications(userId)`
- [ ] Display in list with newest first
- [ ] Add "Mark as read" button
- [ ] Add "Delete" button
- [ ] Show notification type icon (🔐, 🌤️, 🚨, 📋, 👗)

---

## Phase 4: Feature Implementation (45 minutes)

### 4.1: Password Reset with Notifications
- [ ] In forgot password form:
```javascript
async function handleForgotPassword(email) {
  // Send reset email
  await SupabaseService.initPasswordReset(email);
  
  // Send notification
  await NotificationManager.sendPasswordResetNotification(email);
  
  showToast('Check your email for reset link + notification');
}
```

### 4.2: Weather Alert Notifications
- [ ] In weather update function:
```javascript
async function updateWeather(weatherData, userId) {
  // If extreme conditions detected
  if (weatherData.temp > 40 || weatherData.uv_index > 9) {
    await NotificationManager.sendWeatherAlertNotification(userId, weatherData);
  }
}
```

### 4.3: Disaster Alert System
- [ ] Setup periodic check (e.g., every 5 minutes):
```javascript
setInterval(async () => {
  const disasters = await fetchDisasters(); // Your API
  for (const disaster of disasters) {
    const affectedUsers = await findAffectedUsers(disaster.location);
    for (const user of affectedUsers) {
      await NotificationManager.sendDisasterAlertNotification(user.id, disaster);
    }
  }
}, 5 * 60 * 1000);
```

### 4.4: Daily Planner Notifications
- [ ] User sets schedule in settings (e.g., 9 AM daily):
```javascript
async function setupDailyPlanner(userId) {
  await SupabaseService.addNotificationSchedule(userId, {
    type: 'daily_planner',
    time_of_day: '09:00',
    days_of_week: ['0', '1', '2', '3', '4', '5', '6'], // All days
    enabled: true
  });
  
  // Setup server-side scheduler (Node.js/Cron)
  NotificationManager.setupScheduledNotifications(userId);
}
```

- [ ] Planner notification content:
```javascript
async function generatePlannerNotification(userId) {
  const weather = await getWeatherForUser(userId);
  const health = await SupabaseService.getHealthProfile(userId);
  
  const planner = {
    location: weather.location,
    temp: weather.temp,
    uv_index: weather.uv_index,
    pack_items: ['Sunscreen', 'Water bottle', 'Hat'],
    activities: ['Outdoor activities recommended']
  };
  
  await NotificationManager.sendDailyPlannerNotification(userId, planner);
}
```

### 4.5: Clothing Recommendations
- [ ] User sets schedule (e.g., 7 AM on weekdays):
```javascript
async function setupClothingAlerts(userId) {
  await SupabaseService.addNotificationSchedule(userId, {
    type: 'clothing_recommendation',
    time_of_day: '07:00',
    days_of_week: ['1', '2', '3', '4', '5'], // Weekdays only
    enabled: true
  });
}
```

- [ ] Generate recommendations:
```javascript
function generateClothingRec(weather) {
  let top, bottom, outer, accessories = [];
  
  if (weather.temp < 5) {
    top = 'Warm sweater or coat';
    bottom = 'Thermal jeans or leggings';
    outer = 'Heavy winter coat';
    accessories = ['Gloves', 'Scarf', 'Beanie'];
  } else if (weather.temp < 15) {
    top = 'Light sweater';
    bottom = 'Jeans';
    outer = 'Light jacket';
    accessories = ['Sunglasses'];
  } else if (weather.temp > 25) {
    top = 'T-shirt or tank top';
    bottom = 'Shorts or light pants';
    outer = 'None';
    accessories = ['Sunglasses', 'Hat', 'Sunscreen'];
  } else {
    top = 'Short-sleeve shirt';
    bottom = 'Pants';
    outer = 'Light cardigan';
    accessories = ['Sunglasses'];
  }
  
  return { top, bottom, outer, accessories };
}
```

---

## Phase 5: Testing (30 minutes)

### 5.1: Test Authentication
- [ ] Signup new user
- [ ] Verify user appears in `users` table
- [ ] Signin existing user
- [ ] Request notification permission popup appears
- [ ] Logout
- [ ] Verify login attempts logged in `login_history` table

### 5.2: Test Notifications
- [ ] Request notification permission
- [ ] Check device token saved in `device_tokens` table
- [ ] Send test notification (browser console):
```javascript
const user = SupabaseService.getCurrentUser();
await NotificationManager.sendWeatherAlertNotification(user.id, {
  temp: 42,
  wind_speed: 15,
  uv_index: 10,
  location: 'Test City'
});
```
- [ ] Notification appears on screen (even if app is in background!)

### 5.3: Test Weather Alerts
- [ ] Setup mock extreme weather
- [ ] Verify weather alert notification sent
- [ ] Check notification in notification center
- [ ] Verify appears in `notifications` table

### 5.4: Test Disaster Alerts
- [ ] Simulate disaster alert
- [ ] Verify notification has "requireInteraction: true" (can't dismiss)
- [ ] Verify notification appears with severity level
- [ ] Click notification → opens disaster info page

### 5.5: Test Daily Planner Schedule
- [ ] Create schedule for 1 minute from now (for testing):
```javascript
const user = SupabaseService.getCurrentUser();
const nextMin = new Date();
nextMin.setMinutes(nextMin.getMinutes() + 1);

await SupabaseService.addNotificationSchedule(user.id, {
  type: 'daily_planner',
  time_of_day: `${nextMin.getHours()}:${String(nextMin.getMinutes()).padStart(2, '0')}`,
  days_of_week: [String(nextMin.getDay())],
  enabled: true
});
```
- [ ] Wait 1 minute
- [ ] Notification appears automatically
- [ ] Check notification in center

### 5.6: Test Clothing Recommendations
- [ ] Similar to daily planner
- [ ] Create schedule for 1 minute from now
- [ ] Wait → notification appears
- [ ] Verify clothing recommendations are correct

### 5.7: Test Settings UI
- [ ] Toggle weather alerts OFF
- [ ] Trigger weather alert → should NOT appear
- [ ] Toggle weather alerts ON
- [ ] Trigger weather alert → should appear
- [ ] Test other alert toggles similarly

### 5.8: Test Offline Mode
- [ ] Open app
- [ ] Turn off internet (or use DevTools)
- [ ] Previous pages should still load (cached by Service Worker)
- [ ] Reconnect internet
- [ ] Data should sync automatically

### 5.9: Test Notification Center
- [ ] Generate 5-10 notifications
- [ ] Open notification center
- [ ] Should show all unread notifications
- [ ] Click "Mark as read"
- [ ] Should disappear from unread
- [ ] Should still appear in history
- [ ] Click "Delete"
- [ ] Should be removed

### 5.10: Test Mobile
- [ ] Open app on mobile browser
- [ ] Request notification permission
- [ ] Trigger notification
- [ ] Should show native mobile notification
- [ ] Click → opens app

---

## Phase 6: Production Deployment (30 minutes)

### 6.1: Database Backups
- [ ] In Supabase → Backups
- [ ] Enable automatic backups
- [ ] Set retention to 7 days

### 6.2: Monitoring
- [ ] In Supabase → Reports
- [ ] Setup database size alert (warn at 400MB)
- [ ] Setup bandwidth alert (warn at 1.8GB)

### 6.3: Environment Variables
- [ ] Create `.env` file (never commit!)
- [ ] Add:
```
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=... (backend only!)
```

### 6.4: Deploy Service Worker
- [ ] Ensure `/public/sw.js` is served correctly
- [ ] Test in production URL
- [ ] Verify Service Worker shows "Active" in DevTools

### 6.5: Update Site URLs
- [ ] In Supabase → Authentication → Settings
- [ ] Update Site URL to production domain
- [ ] Update Redirect URLs to production domain

### 6.6: Configure CORS
- [ ] Supabase automatically handles CORS
- [ ] Test API calls from production domain

### 6.7: Enable HTTPS
- [ ] Ensure all URLs are HTTPS (push notifications require it!)
- [ ] Test notifications on HTTPS site

### 6.8: Data Migration (if upgrading from localStorage)
- [ ] Run migration script:
```javascript
const user = SupabaseService.getCurrentUser();
const result = await SupabaseService.migrateFromLocalStorage(user.id);
if (result.success) {
  localStorage.clear(); // Clear old data
}
```

### 6.9: Setup Monitoring Alerts
- [ ] Enable error logging
- [ ] Monitor notification delivery rate
- [ ] Check error logs daily first week

### 6.10: Performance Optimization
- [ ] Enable Supabase RLS row caching
- [ ] Setup CDN if needed (Cloudflare, etc.)
- [ ] Monitor query performance in Supabase

---

## Phase 7: Post-Launch (Ongoing)

### Daily Checks
- [ ] Error logs (Supabase console)
- [ ] Database size usage
- [ ] Bandwidth usage
- [ ] User feedback

### Weekly Checks
- [ ] Backup integrity
- [ ] Notification delivery rates
- [ ] Performance metrics
- [ ] User growth

### Monthly Checks
- [ ] Update dependencies
- [ ] Security patches
- [ ] Review and optimize queries
- [ ] Check for quota warnings

---

## Final Checklist

### Before Going Live
- [ ] All 12 database tables verified
- [ ] RLS policies enabled
- [ ] Authentication working (email + Google)
- [ ] VAPID keys generated
- [ ] Service Worker deployed
- [ ] All 5 notification types working
- [ ] Scheduled notifications tested
- [ ] Push notifications working on mobile
- [ ] Disaster alert integration done
- [ ] Settings UI working
- [ ] Data migration tested
- [ ] HTTPS enabled
- [ ] Error logging working
- [ ] Backups configured
- [ ] Monitoring alerts setup

### Success Criteria
- ✅ Users can signup/signin
- ✅ Password reset sends notification
- ✅ Weather alerts appear
- ✅ Disaster alerts appear
- ✅ Daily planner triggers
- ✅ Clothing recommendations trigger
- ✅ Notifications work offline
- ✅ Zero cost (free tier)
- ✅ No credit card charged
- ✅ Easy to scale

---

## Troubleshooting Checklist

### Issue: "Supabase not initialized"
- [ ] Check SupabaseService.init() called before other methods
- [ ] Check credentials in supabase-config.js are correct
- [ ] Check internet connection

### Issue: "Permission denied" database errors
- [ ] Check RLS policies are enabled
- [ ] Check user_id matches authenticated user
- [ ] Check table name spelling
- [ ] Try disabling RLS temporarily to debug

### Issue: Notifications not appearing
- [ ] Check notification permission granted
- [ ] Check browser console for errors
- [ ] Check Service Worker is registered (DevTools → Application → Service Workers)
- [ ] Check device token saved in DB
- [ ] Try test notification via console

### Issue: Service Worker not registering
- [ ] Check `/public/sw.js` exists
- [ ] Check HTTPS enabled
- [ ] Check browser console errors
- [ ] Restart browser

### Issue: Push notifications not working
- [ ] Check VAPID keys are correct
- [ ] Check notification permission granted
- [ ] Check Service Worker is active
- [ ] Check device endpoint valid
- [ ] Test in Chrome/Firefox first

---

✅ When complete, you'll have a fully functional app with:
- Free backend (Supabase)
- 5 notification types
- Push notifications (works offline)
- Scheduled alerts
- $0 monthly cost
- Easy to scale

**Estimated total time: 2-3 hours**

Good luck! 🚀
