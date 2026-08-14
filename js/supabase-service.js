/* ============================================================
   Supabase Service — Free Backend Integration
   Handles all Supabase operations + Notifications
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

const SupabaseService = (() => {
  let supabase, currentUser = null;

  function init(supabaseUrl, supabaseKey) {
    try {
      supabase = createClient(supabaseUrl, supabaseKey);
      
      // Listen to auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        console.log('Auth state:', event, currentUser?.email || 'logged out');
      });

      return true;
    } catch (error) {
      console.error('Supabase init error:', error);
      return false;
    }
  }

  // ==================== AUTH ====================

  async function signUp(email, password, name) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password
      });

      if (error) throw error;

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: email.toLowerCase(),
          name: name || '',
          auth_method: 'email-local'
        });

      if (profileError) throw profileError;

      // Create default settings
      await supabase
        .from('user_settings')
        .insert({
          user_id: data.user.id,
          theme: 'dark',
          temp_unit: 'celsius'
        });

      return { success: true, user: data.user };
    } catch (error) {
      console.error('SignUp error:', error);
      return { success: false, error: error.message };
    }
  }

  async function signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password
      });

      if (error) throw error;

      // Log login event
      await supabase.from('login_history').insert({
        user_id: data.user.id,
        email: email.toLowerCase(),
        auth_method: 'email-local',
        success: true,
        ip_address: await getClientIP()
      }).catch(() => {});

      return { success: true, user: data.user };
    } catch (error) {
      // Log failed attempt
      await supabase.from('login_history').insert({
        email: email.toLowerCase(),
        auth_method: 'email-local',
        success: false
      }).catch(() => {});

      console.error('SignIn error:', error);
      return { success: false, error: error.message };
    }
  }

  async function signOut_() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      currentUser = null;
      return { success: true };
    } catch (error) {
      console.error('SignOut error:', error);
      return { success: false, error: error.message };
    }
  }

  function getCurrentUser() {
    return currentUser;
  }

  // ==================== USERS ====================

  async function getUser(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  async function updateUser(userId, data) {
    try {
      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== HEALTH PROFILES ====================

  async function getHealthProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('health_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // 116 = no rows
      return data || null;
    } catch (error) {
      console.error('Get health profile error:', error);
      return null;
    }
  }

  async function setHealthProfile(userId, profileData) {
    try {
      const { error } = await supabase
        .from('health_profiles')
        .upsert({
          user_id: userId,
          ...profileData
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Set health profile error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== USER SETTINGS ====================

  async function getSettings(userId) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get settings error:', error);
      return null;
    }
  }

  async function updateSettings(userId, settings) {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update(settings)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Update settings error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== SAVED PLACES ====================

  async function getSavedPlaces(userId) {
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get saved places error:', error);
      return [];
    }
  }

  async function addSavedPlace(userId, place) {
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .insert({
          user_id: userId,
          ...place
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, id: data.id };
    } catch (error) {
      console.error('Add saved place error:', error);
      return { success: false, error: error.message };
    }
  }

  async function removeSavedPlace(placeId) {
    try {
      const { error } = await supabase
        .from('saved_places')
        .delete()
        .eq('id', placeId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Remove saved place error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== SEARCH HISTORY ====================

  async function getSearchHistory(userId, maxResults = 30) {
    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', userId)
        .order('searched_at', { ascending: false })
        .limit(maxResults);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get search history error:', error);
      return [];
    }
  }

  async function addSearchEvent(userId, queryStr, place) {
    try {
      const { error } = await supabase
        .from('search_history')
        .insert({
          user_id: userId,
          query: queryStr,
          place: place
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Add search event error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== TRAVEL DESTINATIONS ====================

  async function getTravelDestinations(userId) {
    try {
      const { data, error } = await supabase
        .from('travel_destinations')
        .select('*')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get travel destinations error:', error);
      return [];
    }
  }

  async function addTravelDestination(userId, destination) {
    try {
      const { data, error } = await supabase
        .from('travel_destinations')
        .insert({
          user_id: userId,
          ...destination
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, id: data.id };
    } catch (error) {
      console.error('Add travel destination error:', error);
      return { success: false, error: error.message };
    }
  }

  async function removeTravelDestination(destId) {
    try {
      const { error } = await supabase
        .from('travel_destinations')
        .delete()
        .eq('id', destId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Remove travel destination error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== DEVICE TOKENS (Push Notifications) ====================

  async function saveDeviceToken(userId, token, platform = 'web', subscriptionObj = null) {
    try {
      const { error } = await supabase
        .from('device_tokens')
        .insert({
          user_id: userId,
          token: token,
          platform: platform,
          endpoint: subscriptionObj?.endpoint || null,
          auth_key: subscriptionObj?.keys?.auth || null
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Save device token error:', error);
      return { success: false, error: error.message };
    }
  }

  async function getDeviceTokens(userId) {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get device tokens error:', error);
      return [];
    }
  }

  // ==================== NOTIFICATIONS ====================

  async function getNotifications(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get notifications error:', error);
      return [];
    }
  }

  async function getUnreadNotifications(userId) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('read', false)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get unread notifications error:', error);
      return [];
    }
  }

  async function markNotificationAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Mark notification read error:', error);
      return { success: false, error: error.message };
    }
  }

  async function deleteNotification(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Delete notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== NOTIFICATION SCHEDULES ====================

  async function getNotificationSchedules(userId) {
    try {
      const { data, error } = await supabase
        .from('notification_schedules')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get notification schedules error:', error);
      return [];
    }
  }

  async function addNotificationSchedule(userId, schedule) {
    try {
      const { data, error } = await supabase
        .from('notification_schedules')
        .insert({
          user_id: userId,
          ...schedule
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, id: data.id };
    } catch (error) {
      console.error('Add notification schedule error:', error);
      return { success: false, error: error.message };
    }
  }

  async function updateNotificationSchedule(scheduleId, data) {
    try {
      const { error } = await supabase
        .from('notification_schedules')
        .update(data)
        .eq('id', scheduleId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Update notification schedule error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== REAL-TIME SUBSCRIPTIONS ====================

  function subscribeToNotifications(userId, callback) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', 
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('New notification:', payload.new);
          callback(payload.new);
        }
      )
      .subscribe();

    return channel;
  }

  function unsubscribeFromNotifications(channel) {
    if (channel) {
      supabase.removeChannel(channel);
    }
  }

  // ==================== PASSWORD RESET ====================

  async function initPasswordReset(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password`
        }
      );

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Init password reset error:', error);
      return { success: false, error: error.message };
    }
  }

  async function updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Update password error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== UTILITIES ====================

  async function getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // ==================== MIGRATION ====================

  async function migrateFromLocalStorage(userId) {
    try {
      // Migrate saved places
      const savedPlaces = JSON.parse(localStorage.getItem('aura_saved_cities') || '[]');
      for (const place of savedPlaces) {
        await addSavedPlace(userId, place);
      }

      // Migrate search history
      const searchHistory = JSON.parse(localStorage.getItem('aura_search_history') || '[]');
      for (const event of searchHistory) {
        await addSearchEvent(userId, event.query, event.place);
      }

      // Migrate travel destinations
      const travelDests = JSON.parse(localStorage.getItem('aura_travel_dests') || '[]');
      for (const dest of travelDests) {
        await addTravelDestination(userId, dest);
      }

      return { success: true };
    } catch (error) {
      console.error('Migration error:', error);
      return { success: false, error: error.message };
    }
  }

  return {
    init,
    signUp,
    signIn,
    signOut: signOut_,
    getCurrentUser,
    getUser,
    updateUser,
    getHealthProfile,
    setHealthProfile,
    getSettings,
    updateSettings,
    getSavedPlaces,
    addSavedPlace,
    removeSavedPlace,
    getSearchHistory,
    addSearchEvent,
    getTravelDestinations,
    addTravelDestination,
    removeTravelDestination,
    saveDeviceToken,
    getDeviceTokens,
    getNotifications,
    getUnreadNotifications,
    markNotificationAsRead,
    deleteNotification,
    getNotificationSchedules,
    addNotificationSchedule,
    updateNotificationSchedule,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    initPasswordReset,
    updatePassword,
    migrateFromLocalStorage
  };
})();

export default SupabaseService;
