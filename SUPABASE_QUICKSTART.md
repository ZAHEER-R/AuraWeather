# AuraWeather Supabase + Notifications Quick Start

## Overview
This guide helps you migrate from Firebase (paid) to **Supabase** (free) and setup comprehensive notifications for:
- ✉️ Password reset notifications
- 🌤️ Weather alerts
- 🚨 Disaster alerts  
- 📋 Daily planner notifications
- 👗 Clothing recommendations

All notifications are **pushed to users' devices** through Web Push API + Service Worker!

---

## What Was Created

### Files Created
1. **SUPABASE_SCHEMA.md** - Complete PostgreSQL database schema (12 tables)
2. **supabase-service.js** - Complete Supabase backend service
3. **notification-manager.js** - Notification system (all 5 types)
4. **public/sw.js** - Service Worker for background push notifications
5. **supabase-config.js** - Configuration template
6. **SUPABASE_INTEGRATION.md** - Detailed integration guide

### Key Features
✅ **Free Database**: Supabase free tier (500MB, no credit card)
✅ **Real-time**: Notifications push instantly to all devices
✅ **Offline Support**: Service Worker caches data
✅ **Scheduled Notifications**: Daily planner, clothing at specific times
✅ **Row Level Security**: Each user sees only their data
✅ **Push Notifications**: Web Push API + Device tokens

---

## Quick Setup (10 minutes)

### 1. Create Supabase Account (2 min)
```
1. Go to https://supabase.com
2. Click "Sign up"
3. Create with email or GitHub
4. Create new project "AuraWeather"
5. Choose region closest to you
```

### 2. Get Credentials (2 min)
```
1. Click "Project Settings"
2. Go to "API" tab
3. Copy Project URL
4. Copy Anon Key
5. Paste into js/supabase-config.js
```

### 3. Setup Database (3 min)
```
1. In Supabase, go to "SQL Editor"
2. Click "New Query"
3. Copy entire SQL from SUPABASE_SCHEMA.md
4. Paste and click "Run"
5. All 12 tables created instantly!
```

### 4. Enable Authentication (2 min)
```
1. Go to "Authentication" → "Providers"
2. Enable "Email/Password"
3. Enable "Google" (optional)
4. Go to Settings → add Site URL
```

### 5. Enable Row Level Security (1 min)
```
1. Go to "Authentication" → "Policies"
2. Copy policies from SUPABASE_SCHEMA.md
3. Click "New policy" and paste each one
```

---

## Notification Types & How They Work

### 🔐 Password Reset Notifications
**Trigger**: User clicks "Forgot password"
**What happens**:
1. Supabase sends reset email
2. In-app notification created in DB
3. Push notification sent to device
4. User clicks → opens password reset page

```javascript
import NotificationManager from './js/notification-manager.js';

async function handleForgotPassword(email) {
  await SupabaseService.initPasswordReset(email);
  await NotificationManager.sendPasswordResetNotification(email);
}
```

### 🌤️ Weather Alert Notifications
**Trigger**: Extreme weather detected (temp >40°C, UV>9, etc.)
**What happens**:
1. Weather API checked periodically
2. Alert created in `notifications` table
3. All user devices receive push notification
4. User can click → view detailed weather

```javascript
// In app during weather update
if (weather.temp > 40 || weather.uv_index > 9) {
  await NotificationManager.sendWeatherAlertNotification(userId, weather);
}
```

### 🚨 Disaster Alert Notifications
**Trigger**: Earthquake, flood, tornado, etc. detected
**What happens**:
1. External disaster API checked (e.g., USGS, local alerts)
2. Alert created with severity level
3. Push notification sent with interaction required
4. User cannot dismiss - must click to open

```javascript
await NotificationManager.sendDisasterAlertNotification(userId, {
  type: 'earthquake',
  location: 'San Francisco, CA',
  severity: 'high',
  description: '5.2 magnitude earthquake detected'
});
```

### 📋 Daily Planner Notifications
**Trigger**: Scheduled time (e.g., 9 AM)
**What happens**:
1. User sets schedule in app settings
2. At specified time, notification triggers
3. Generates planner based on weather + health
4. Push notification with day's recommendations

**Example notification**:
```
📋 Your Daily Planner
📍 Location: San Francisco
🌡️ Temperature: 22°C
☀️ UV Index: 7
🎒 Pack: Sunscreen, water bottle
🎯 Activities: Good for outdoor activities
```

### 👗 Clothing Recommendations
**Trigger**: Scheduled time (e.g., 7 AM)
**What happens**:
1. User enables clothing alerts in settings
2. At trigger time, generates recommendation
3. Analyzes: temperature, wind, precipitation
4. Suggests: top, bottom, outer layer, accessories

**Example notification**:
```
👗 Clothing Recommendation
🌡️ Temperature: 18°C
💨 Wind: 15 km/h
🌦️ Conditions: Partly cloudy
👕 Recommended:
  • Top: Light sweater
  • Bottom: Jeans
  • Outer: Light jacket
  • Accessories: Sunglasses
```

---

## How Push Notifications Work

### 1. User Grants Permission
```javascript
// App requests permission on first load
const permission = await Notification.requestPermission();
// User clicks "Allow" → notifications enabled
```

### 2. Device Token Saved
```javascript
// After permission granted, generate push subscription
const subscription = await serviceWorker.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_PUBLIC_KEY
});

// Save to database
await SupabaseService.saveDeviceToken(userId, subscription);
```

### 3. Real-time Push Delivery
```
Database Creates Notification
         ↓
Supabase sends event to all connected users
         ↓
Service Worker receives push event
         ↓
Shows native browser notification
         ↓
User clicks → app opens + navigates
```

### 4. Works Even When App Closed!
- Service Worker runs in background
- Even if app closed, notifications still arrive
- Click notification → app opens automatically

---

## Enable Notifications in App

### In `index.html`:
```html
<script type="module">
  import SupabaseService from './js/supabase-service.js';
  import NotificationManager from './js/notification-manager.js';
  import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './js/supabase-config.js';
  
  // Initialize everything
  SupabaseService.init(SUPABASE_URL, SUPABASE_ANON_KEY);
  NotificationManager.init(VAPID_PUBLIC_KEY);
</script>
```

### In User Settings UI:
```html
<label>
  <input type="checkbox" id="weather-alerts">
  Weather Alerts
</label>
<label>
  <input type="checkbox" id="disaster-alerts">
  Disaster Alerts
</label>
<label>
  <input type="checkbox" id="planner-alerts">
  Daily Planner
</label>
<label>
  <input type="checkbox" id="clothing-alerts">
  Clothing Recommendations
</label>
```

### Save Settings:
```javascript
document.getElementById('weather-alerts').addEventListener('change', async (e) => {
  const user = SupabaseService.getCurrentUser();
  await SupabaseService.updateSettings(user.id, {
    weather_alerts: e.target.checked
  });
});
```

---

## Database Tables Overview

| Table | Purpose | Rows per User |
|-------|---------|---------------|
| users | User profiles | 1 |
| health_profiles | Health data | 1 |
| user_settings | Theme, alerts, preferences | 1 |
| saved_places | Bookmarked locations | Up to 20 |
| search_history | Recent searches | Up to 30 |
| travel_destinations | Travel bookmarks | Up to 15 |
| device_tokens | Push notification subscriptions | 1-5 |
| notifications | All notifications | Unlimited |
| notification_schedules | Scheduled alerts | Up to 5 |
| login_history | Login attempts | Up to 50 |
| password_resets | Password reset OTPs | Temporary |
| last_location | Currently viewing | 1 |

---

## Testing Notifications

### Test Password Reset
1. Go to login page
2. Click "Forgot password"
3. Enter email
4. **Result**: Notification appears in 2 seconds

### Test Weather Alert
```javascript
// In browser console
const user = SupabaseService.getCurrentUser();
await NotificationManager.sendWeatherAlertNotification(user.id, {
  temp: 42,
  wind_speed: 15,
  uv_index: 10,
  location: 'Test City'
});
```

### Test Daily Planner Schedule
```javascript
// Setup daily planner for 1 minute from now (for testing)
const user = SupabaseService.getCurrentUser();
const nextMinute = new Date();
nextMinute.setMinutes(nextMinute.getMinutes() + 1);

await SupabaseService.addNotificationSchedule(user.id, {
  type: 'daily_planner',
  time_of_day: `${nextMinute.getHours()}:${nextMinute.getMinutes()}`,
  days_of_week: [String(nextMinute.getDay())],
  enabled: true
});

// Wait 1 minute → notification should appear
```

---

## Costs Comparison

| Feature | Firebase | Supabase | Winner |
|---------|----------|----------|--------|
| **Database** | 1GB free (shared) | 500MB free (dedicated) | 🟰 |
| **Auth** | Free | Free | 🟰 |
| **Bandwidth** | Unlimited (small) | 2GB/month free | Supabase |
| **Credit Card** | ✅ Required | ❌ Not required | **Supabase** |
| **Real-time** | Limited | Full subscriptions | **Supabase** |
| **Push Notifications** | ✅ Included | ✅ Use Web Push API | 🟰 |
| **Monthly Cost** | $0-$1000+ | $0-$5+ | **Supabase** |

**Result**: Supabase is **100% free with no hidden charges** until you scale significantly!

---

## Production Checklist

### Before Going Live
- [ ] All 12 database tables created
- [ ] RLS policies enabled on all tables
- [ ] Google OAuth credentials configured
- [ ] VAPID keys generated and stored
- [ ] Service Worker deployed at `/public/sw.js`
- [ ] Notification permissions tested on 3+ browsers
- [ ] Push notifications tested on mobile + desktop
- [ ] Daily schedules tested
- [ ] Error handling verified
- [ ] Data migration from localStorage tested

### Monitoring
- [ ] Setup Supabase alerts for quota exceeded
- [ ] Monitor notification delivery rate
- [ ] Check error logs daily
- [ ] Test disaster alert integration

---

## Files to Update

### 1. `index.html`
Add initialization script (see above)

### 2. `js/app.js`
```javascript
import SupabaseService from './js/supabase-service.js';

function init() {
  // Initialize before anything else
  SupabaseService.init(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Rest of init...
}
```

### 3. `js/auth.js`
Use `SupabaseService.signUp()` and `SupabaseService.signIn()`

### 4. `js/storage.js`
Replace localStorage with Supabase functions

### 5. Create `public/sw.js`
Service Worker for notifications (already created for you!)

---

## Next Steps

1. **Go to https://supabase.com** → Create free account
2. **Run SQL schema** from SUPABASE_SCHEMA.md
3. **Copy credentials** to supabase-config.js
4. **Generate VAPID keys** (10 minutes work)
5. **Test password reset** → Should get notification
6. **Test daily planner** → Setup schedule
7. **Test on mobile** → Works even when app closed!
8. **Go live!** → No billing surprises

---

## Questions?

- 📚 Full integration guide: See `SUPABASE_INTEGRATION.md`
- 🗄️ Database schema: See `SUPABASE_SCHEMA.md`
- 🔧 API docs: https://supabase.com/docs
- 🚀 Web Push: https://developer.mozilla.org/en-US/docs/Web/API/Push_API

---

## Summary

You now have:

✅ **Free database** (Supabase PostgreSQL)
✅ **5 notification types** (password, weather, disaster, planner, clothing)
✅ **Push notifications** (works offline too!)
✅ **Scheduled alerts** (daily at specific times)
✅ **Real-time** (instant to all devices)
✅ **No costs** (free tier supports thousands of users)
✅ **No credit card** (truly free!)

**Total setup time**: ~15 minutes
**Monthly cost**: $0

Let's go! 🚀
