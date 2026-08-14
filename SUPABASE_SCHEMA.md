# AuraWeather Supabase Schema (V2 - Free Backend)

## Supabase Overview
- **Free Tier**: 500MB database, 100MB file storage, unlimited API calls
- **Database**: PostgreSQL (full SQL support)
- **Auth**: Built-in email/password & OAuth (Google, GitHub, etc.)
- **Real-time**: Broadcast events to connected clients
- **Row Level Security**: Native database security

---

## Database Tables

### 1. `users` Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR,
  age INTEGER,
  place VARCHAR,
  photo_url TEXT,
  native_place VARCHAR,
  auth_method VARCHAR CHECK (auth_method IN ('email-local', 'google')),
  google_sub VARCHAR UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 2. `health_profiles` Table
```sql
CREATE TABLE health_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER,
  age_unit VARCHAR DEFAULT 'years',
  height NUMERIC,
  height_unit VARCHAR DEFAULT 'cm',
  weight NUMERIC,
  weight_unit VARCHAR DEFAULT 'kg',
  activity VARCHAR CHECK (activity IN ('low', 'moderate', 'high')),
  conditions TEXT[], -- Array of conditions: asthma, allergies, migraine, heart, diabetes, hypertension
  sensitivities TEXT[], -- UV, heat, cold, pollen, dust
  fitness TEXT[], -- Fitness types
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 3. `user_settings` Table
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR DEFAULT 'dark',
  temp_unit VARCHAR DEFAULT 'celsius',
  alerts_enabled BOOLEAN DEFAULT true,
  news_alerts BOOLEAN DEFAULT true,
  weather_alerts BOOLEAN DEFAULT true,
  disaster_alerts BOOLEAN DEFAULT true,
  personal_alerts BOOLEAN DEFAULT true,
  planner_alerts BOOLEAN DEFAULT true,
  clothing_alerts BOOLEAN DEFAULT true,
  notification_time VARCHAR DEFAULT '09:00', -- HH:MM format
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 4. `saved_places` Table
```sql
CREATE TABLE saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  label VARCHAR,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  admin1 VARCHAR,
  admin2 VARCHAR,
  country VARCHAR,
  country_code VARCHAR,
  timezone VARCHAR,
  feature VARCHAR,
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lat, lon)
);

CREATE INDEX idx_saved_places_user_id ON saved_places(user_id);
```

---

### 5. `search_history` Table
```sql
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query VARCHAR NOT NULL,
  place JSONB,
  searched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_search_history_user_id ON search_history(user_id);
```

---

### 6. `login_history` Table
```sql
CREATE TABLE login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR,
  auth_method VARCHAR,
  success BOOLEAN DEFAULT false,
  ip_address VARCHAR,
  user_agent TEXT,
  logged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_login_history_user_id ON login_history(user_id);
```

---

### 7. `travel_destinations` Table
```sql
CREATE TABLE travel_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  admin1 VARCHAR,
  country VARCHAR,
  country_code VARCHAR,
  timezone VARCHAR,
  trip_start DATE,
  trip_end DATE,
  saved_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_travel_destinations_user_id ON travel_destinations(user_id);
```

---

### 8. `device_tokens` Table (FCM & Web Push)
```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  platform VARCHAR CHECK (platform IN ('web', 'android', 'ios')),
  endpoint VARCHAR, -- For Web Push API
  auth_key VARCHAR, -- For Web Push API
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
```

---

### 9. `password_resets` Table
```sql
CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  otp_hash VARCHAR NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);
```

---

### 10. `notifications` Table (NEW)
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL CHECK (type IN ('weather_alert', 'disaster_alert', 'password_reset', 'daily_planner', 'clothing_recommendation', 'system')),
  title VARCHAR NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Extra data: icon, image, link, etc.
  read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
```

---

### 11. `notification_schedules` Table (NEW)
```sql
CREATE TABLE notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL CHECK (type IN ('daily_planner', 'clothing_recommendation', 'weather_summary')),
  time_of_day VARCHAR NOT NULL, -- HH:MM format
  enabled BOOLEAN DEFAULT true,
  days_of_week TEXT[] DEFAULT ARRAY['1','2','3','4','5','6','0'], -- 0=Sunday, 1=Monday, etc.
  next_trigger TIMESTAMPTZ,
  last_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notification_schedules_user_id ON notification_schedules(user_id);
```

---

### 12. `last_location` Table (NEW)
```sql
CREATE TABLE last_location (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Supabase Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE last_location ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Users can access their own health profile
CREATE POLICY "Users can manage own health profile" ON health_profiles 
  FOR ALL USING (auth.uid() = user_id);

-- Users can manage own settings
CREATE POLICY "Users can manage own settings" ON user_settings 
  FOR ALL USING (auth.uid() = user_id);

-- Users can manage own saved places
CREATE POLICY "Users can manage own saved places" ON saved_places 
  FOR ALL USING (auth.uid() = user_id);

-- Users can manage own search history
CREATE POLICY "Users can manage own search history" ON search_history 
  FOR ALL USING (auth.uid() = user_id);

-- Users can read own login history
CREATE POLICY "Users can read own login history" ON login_history 
  FOR SELECT USING (auth.uid() = user_id);

-- Users can manage own travel destinations
CREATE POLICY "Users can manage own travel destinations" ON travel_destinations 
  FOR ALL USING (auth.uid() = user_id);

-- Users can manage own device tokens
CREATE POLICY "Users can manage own device tokens" ON device_tokens 
  FOR ALL USING (auth.uid() = user_id);

-- Users can read own notifications
CREATE POLICY "Users can read own notifications" ON notifications 
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications 
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can manage own notification schedules
CREATE POLICY "Users can manage own schedules" ON notification_schedules 
  FOR ALL USING (auth.uid() = user_id);

-- Users can read own last location
CREATE POLICY "Users can manage own last location" ON last_location 
  FOR ALL USING (auth.uid() = user_id);
```

---

## Real-time Subscriptions

Subscribe to changes in your app:

```javascript
// Listen to notifications in real-time
supabase
  .channel('notifications:' + userId)
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
    (payload) => {
      console.log('New notification:', payload.new);
      // Show notification to user
      showNotification(payload.new);
    }
  )
  .subscribe();
```

---

## Setup Instructions

1. Go to https://supabase.com
2. Create account (free)
3. Create new project
4. Run SQL schema (paste tables above)
5. Configure RLS policies (paste policies above)
6. Enable Auth providers (Email, Google)
7. Copy project URL and anon key
8. Add to `supabase-config.js`

---

## V1 → V2 Migration (localStorage → Supabase)

| V1 | V2 | Type |
|----|----|------|
| aura_local_users | users | Table |
| aura_user | users (filtered) | Table |
| aura_settings | user_settings | Table |
| aura_saved_cities | saved_places | Table |
| aura_search_history | search_history | Table |
| aura_login_history | login_history | Table |
| aura_health_profile | health_profiles | Table |
| aura_travel_dests | travel_destinations | Table |
| aura_token | Supabase Auth | Built-in |
| aura_last_location | last_location | Table |
| (new) | notifications | Table |
| (new) | notification_schedules | Table |
| (new) | device_tokens | Table |

---

## Cost Estimate

**Supabase Free Tier**:
- Database: 500 MB
- Bandwidth: 2 GB/month
- Max connections: 10
- Storage: 1 GB

For small to medium apps: **$0/month**

If you exceed, pricing:
- Additional database: $25/100GB/month
- Bandwidth: $0.09 per GB above 2GB

Firebase free tier required billing card, Supabase is truly free!
