/* ============================================================
   Supabase Configuration
   Get these values from your Supabase project settings
   ============================================================ */

// From Supabase Dashboard → Project Settings → API
const SUPABASE_URL = "https://bqbubmjibhjrutcgstnq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnVibWppYmhqcnV0Y2dzdG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTIzMjgsImV4cCI6MjEwMjI4ODMyOH0.Hi9DrAC0BNikDKYYn0QHVTPKVssQ2XmIXKxiw1zb8V0";

// Web Push VAPID Public Key (generate with web-push CLI)
// npm install -g web-push
// web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = "BK89aGnJ5OJ6GNMMZDRiWIJ0tf22pDq9dLsU4dyXnh_Wj7ymbr7wn3NdTz8xtF40YTkQ_ahulvSTgYR2WoJPHYo";
export { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY };













/* ============================================================
   SETUP INSTRUCTIONS
   ============================================================

1. Create Supabase Project:
   - Go to https://supabase.com
   - Sign up (free account)
   - Create new project → "AuraWeather"
   - Choose region close to users
   
2. Get Configuration:
   - In Supabase Dashboard, click "Project Settings"
   - Under "API", copy:
     * Project URL → SUPABASE_URL
     * Anon key → SUPABASE_ANON_KEY
   
3. Setup Database:
   - Copy SQL from SUPABASE_SCHEMA.md
   - In Supabase → SQL Editor → New Query
   - Paste entire schema and run
   
4. Enable Authentication:
   - Go to Authentication → Providers
   - Enable "Email/Password"
   - Enable "Google" (if you want OAuth)
   
5. Configure Auth URLs:
   - Settings → Authentication
   - Site URL: https://yourdomain.com
   - Redirect URLs: https://yourdomain.com/auth/callback
   
6. Setup Row Level Security:
   - Copy RLS policies from SUPABASE_SCHEMA.md
   - Apply to each table
   
7. Generate VAPID Keys:
   - npm install -g web-push
   - web-push generate-vapid-keys
   - Add public key to VAPID_PUBLIC_KEY
   - Store private key in backend environment (.env)
   
8. Update index.html:
   <script type="module">
     import SupabaseService from './js/supabase-service.js';
     import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './js/supabase-config.js';
     
     SupabaseService.init(SUPABASE_URL, SUPABASE_ANON_KEY);
   </script>

WHY SUPABASE OVER FIREBASE?
✅ Free tier: 500MB database, 2GB bandwidth
✅ No credit card required
✅ Full PostgreSQL database
✅ Built-in authentication
✅ Real-time subscriptions
✅ Row Level Security
✅ Easy to scale when needed
✅ No billing surprises

============================================================ */
