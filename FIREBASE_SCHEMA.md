# AuraWeather Firebase Schema (V2)

## Firebase Collections Structure

### 1. `users/` Collection
**Document ID**: `{userId}` (Firebase Auth UID)

```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "age": 30,
  "place": "New York, USA",
  "password_hash": "sha256_hash_or_null",
  "photo": "url_or_base64",
  "auth_method": "email-local | google",
  "google_sub": "google_id_or_null",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### 2. `health_profiles/` Collection
**Document ID**: `{userId}` (links to users collection)

```json
{
  "user_id": "userId",
  "age": 30,
  "age_unit": "years",
  "height": 180,
  "height_unit": "cm",
  "weight": 75,
  "weight_unit": "kg",
  "activity": "moderate",
  "conditions": ["asthma", "allergies", "migraine"],
  "sensitivities": ["uv", "heat", "pollen"],
  "fitness": ["running", "swimming"],
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### 3. `user_settings/` Collection
**Document ID**: `{userId}` (links to users collection)

```json
{
  "user_id": "userId",
  "theme": "dark",
  "temp_unit": "celsius",
  "alerts_enabled": true,
  "news_alerts": true,
  "weather_alerts": true,
  "disaster_alerts": true,
  "personal_alerts": true,
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### 4. `saved_places/` Collection
**Document ID**: Auto-generated

```json
{
  "user_id": "userId",
  "name": "Central Park",
  "label": "park",
  "lat": 40.7829,
  "lon": -73.9654,
  "admin1": "New York",
  "admin2": "New York County",
  "country": "United States",
  "country_code": "US",
  "timezone": "America/New_York",
  "feature": "park",
  "saved_at": "2024-01-15T10:30:00Z"
}
```

**Indexing**: Create composite index on `(user_id, lat, lon)` for uniqueness

---

### 5. `search_history/` Collection
**Document ID**: Auto-generated

```json
{
  "user_id": "userId",
  "query": "New York",
  "place": {
    "name": "New York, USA",
    "lat": 40.7128,
    "lon": -74.0060,
    "admin1": "New York",
    "country": "United States",
    "timezone": "America/New_York"
  },
  "searched_at": "2024-01-15T10:30:00Z"
}
```

**Retention**: Keep max 30 records per user (implement in code)

---

### 6. `login_history/` Collection
**Document ID**: Auto-generated

```json
{
  "user_id": "userId",
  "email": "user@example.com",
  "auth_method": "email-local | google",
  "success": true,
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "logged_at": "2024-01-15T10:30:00Z"
}
```

**Retention**: Keep max 50 records per user (implement in code)

---

### 7. `travel_destinations/` Collection
**Document ID**: Auto-generated

```json
{
  "user_id": "userId",
  "name": "Paris",
  "lat": 48.8566,
  "lon": 2.3522,
  "admin1": "Île-de-France",
  "country": "France",
  "country_code": "FR",
  "timezone": "Europe/Paris",
  "trip_start": "2024-06-01",
  "trip_end": "2024-06-10",
  "saved_at": "2024-01-15T10:30:00Z"
}
```

**Retention**: Keep max 15 records per user

---

### 8. `device_tokens/` Collection
**Document ID**: Auto-generated

```json
{
  "user_id": "userId",
  "token": "fcm_device_token",
  "platform": "web | android | ios",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Indexing**: Create unique index on `token`

---

### 9. `password_resets/` Collection
**Document ID**: Auto-generated

```json
{
  "user_id": "userId",
  "email": "user@example.com",
  "otp_hash": "hashed_otp_value",
  "expires_at": "2024-01-15T10:45:00Z",
  "used": false,
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // User is authenticated
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    match /health_profiles/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    match /user_settings/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    match /saved_places/{document=**} {
      allow read, write: if request.auth.uid == resource.data.user_id;
      allow create: if request.auth.uid == request.resource.data.user_id;
    }
    
    match /search_history/{document=**} {
      allow read, write: if request.auth.uid == resource.data.user_id;
      allow create: if request.auth.uid == request.resource.data.user_id;
    }
    
    match /login_history/{document=**} {
      allow read: if request.auth.uid == resource.data.user_id;
      allow create: if request.auth.uid == request.resource.data.user_id || request.auth == null;
    }
    
    match /travel_destinations/{document=**} {
      allow read, write: if request.auth.uid == resource.data.user_id;
      allow create: if request.auth.uid == request.resource.data.user_id;
    }
    
    match /device_tokens/{document=**} {
      allow read, write: if request.auth.uid == resource.data.user_id;
      allow create: if request.auth.uid == request.resource.data.user_id;
    }
    
    match /password_resets/{document=**} {
      allow read: if request.auth.uid == resource.data.user_id;
      allow create: if request.auth == null;
    }
  }
}
```

---

## Firebase Configuration

Add to your app initialization:

```javascript
// firebase-config.js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export default firebaseConfig;
```

---

## V1 → V2 Migration Mapping

| V1 Key | V2 Collection | Document | Notes |
|--------|---------------|----------|-------|
| `aura_local_users` | `users/` | `{userId}` | Firebase Auth UID |
| `aura_user` | `users/` | `{userId}` | Session user (subset) |
| `aura_settings` | `user_settings/` | `{userId}` | Per-user settings |
| `aura_saved_cities` | `saved_places/` | Auto-generated | Place bookmarks |
| `aura_search_history` | `search_history/` | Auto-generated | Recent searches |
| `aura_login_history` | `login_history/` | Auto-generated | Login attempts |
| `aura_health_profile` | `health_profiles/` | `{userId}` | Health data |
| `aura_travel_dests` | `travel_destinations/` | Auto-generated | Travel bookmarks |
| `aura_last_location` | `user_settings.last_location` | `{userId}` | Last viewed place |

---

## Next Steps

1. Create `firebase-service.js` module
2. Implement auth integration (signup, login, Google)
3. Implement data sync functions (CRUD operations)
4. Update `storage.js` to abstract Firebase backend
5. Implement offline support with Firestore offline persistence
6. Add data migration script (localStorage → Firebase)
