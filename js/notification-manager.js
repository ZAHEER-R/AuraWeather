/* ============================================================
   Notification System — Push Notifications & Alerts
   Handles: Password reset, weather alerts, disaster alerts,
   daily planner, clothing recommendations
   ============================================================ */

import SupabaseService from './supabase-service.js';

const NotificationManager = (() => {
  let serviceWorkerRegistration = null;
  let vapidPublicKey = null; // Set this in config

  // ==================== INITIALIZATION ====================

  async function init(vapidKey) {
    vapidPublicKey = vapidKey;

    // Register Service Worker for push notifications
    if ('serviceWorker' in navigator) {
      try {
        serviceWorkerRegistration = await navigator.serviceWorker.register('./public/sw.js');
        console.log('Service Worker registered');
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          console.log('Notification permission:', permission);
        }

        // Subscribe to push notifications
        await subscribeToPushNotifications();
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    // Subscribe to real-time notifications
    const user = SupabaseService.getCurrentUser();
    if (user) {
      subscribeToRealtimeNotifications(user.id);
    }
  }

  // ==================== WEB PUSH NOTIFICATIONS ====================

  async function subscribeToPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return;
    }

    try {
      const user = SupabaseService.getCurrentUser();
      if (!user) return;

      const subscription = await serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Save subscription to database
      await SupabaseService.saveDeviceToken(
        user.id,
        JSON.stringify(subscription),
        'web',
        subscription
      );

      console.log('Push subscription successful');
      return subscription;
    } catch (error) {
      console.error('Push subscription error:', error);
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  // ==================== NOTIFICATION TYPES ====================

  async function sendPasswordResetNotification(email) {
    try {
      const user = await getUserByEmail(email);
      if (!user) return;

      // Create in-app notification
      const notification = await createNotification(user.id, {
        type: 'password_reset',
        title: '🔐 Password Reset Request',
        body: 'Click the link sent to your email to reset your password. Link expires in 1 hour.',
        data: {
          icon: '/icons/lock.png',
          tag: 'password-reset'
        }
      });

      // Send push notification
      await sendPushNotification(user.id, {
        title: '🔐 Password Reset',
        body: 'Check your email for reset instructions',
        tag: 'password-reset',
        icon: '/icons/lock.png',
        badge: '/icons/badge.png'
      });

      return notification;
    } catch (error) {
      console.error('Send password reset notification error:', error);
    }
  }

  async function sendWeatherAlertNotification(userId, weather) {
    try {
      const settings = await SupabaseService.getSettings(userId);
      if (!settings?.weather_alerts) return;

      const alerts = [];
      
      // Check for extreme conditions
      if (weather.temp > 40) {
        alerts.push('🌡️ Extreme heat warning');
      }
      if (weather.temp < -10) {
        alerts.push('❄️ Extreme cold warning');
      }
      if (weather.wind_speed > 60) {
        alerts.push('💨 Strong winds warning');
      }
      if (weather.precipitation > 50) {
        alerts.push('🌧️ Heavy rainfall warning');
      }
      if (weather.uv_index > 9) {
        alerts.push('☀️ Extreme UV index');
      }

      for (const alert of alerts) {
        await createNotification(userId, {
          type: 'weather_alert',
          title: 'Weather Alert',
          body: alert,
          data: {
            icon: '/icons/weather.png',
            location: weather.location,
            temp: weather.temp
          }
        });

        await sendPushNotification(userId, {
          title: 'Weather Alert',
          body: alert,
          tag: 'weather-alert',
          icon: '/icons/weather.png'
        });
      }
    } catch (error) {
      console.error('Send weather alert error:', error);
    }
  }

  async function sendDisasterAlertNotification(userId, disaster) {
    try {
      const settings = await SupabaseService.getSettings(userId);
      if (!settings?.disaster_alerts) return;

      const alertEmoji = {
        earthquake: '🏚️',
        flood: '🌊',
        tornado: '🌪️',
        hurricane: '🌀',
        tsunami: '🌊',
        wildfire: '🔥',
        volcano: '🌋',
        storm: '⛈️'
      };

      const emoji = alertEmoji[disaster.type] || '⚠️';

      await createNotification(userId, {
        type: 'disaster_alert',
        title: `${emoji} ${disaster.type.toUpperCase()} Alert`,
        body: `${disaster.location}: ${disaster.severity} severity. ${disaster.description}`,
        data: {
          icon: '/icons/disaster.png',
          severity: disaster.severity,
          lat: disaster.lat,
          lon: disaster.lon,
          url: disaster.url
        }
      });

      await sendPushNotification(userId, {
        title: `${emoji} ${disaster.type.toUpperCase()} Alert`,
        body: `${disaster.location}: ${disaster.severity} severity`,
        tag: `disaster-${disaster.type}`,
        icon: '/icons/disaster.png',
        badge: '/icons/badge-alert.png',
        requireInteraction: true
      });
    } catch (error) {
      console.error('Send disaster alert error:', error);
    }
  }

  async function sendDailyPlannerNotification(userId, planner) {
    try {
      const settings = await SupabaseService.getSettings(userId);
      if (!settings?.planner_alerts) return;

      const plannerText = [
        `📍 Location: ${planner.location}`,
        `🌡️ Temperature: ${planner.temp}°C`,
        `☀️ UV Index: ${planner.uv_index}`,
        `🎒 Pack: ${planner.pack_items?.join(', ') || 'Nothing special'}`,
        planner.activities?.length ? `🎯 Activities: ${planner.activities.join(', ')}` : null
      ].filter(Boolean).join('\n');

      await createNotification(userId, {
        type: 'daily_planner',
        title: '📋 Your Daily Planner',
        body: plannerText,
        data: {
          icon: '/icons/planner.png',
          ...planner
        }
      });

      await sendPushNotification(userId, {
        title: '📋 Your Daily Planner',
        body: `Weather: ${planner.temp}°C • UV: ${planner.uv_index} • Location: ${planner.location}`,
        tag: 'daily-planner',
        icon: '/icons/planner.png'
      });
    } catch (error) {
      console.error('Send daily planner notification error:', error);
    }
  }

  async function sendClothingRecommendationNotification(userId, clothing) {
    try {
      const settings = await SupabaseService.getSettings(userId);
      if (!settings?.clothing_alerts) return;

      const clothingText = [
        `🌡️ Temperature: ${clothing.temp}°C`,
        `💨 Wind: ${clothing.wind}`,
        `🌦️ Conditions: ${clothing.conditions}`,
        `👕 Recommended:`,
        `  • Top: ${clothing.top}`,
        `  • Bottom: ${clothing.bottom}`,
        `  • Outer: ${clothing.outer || 'None'}`,
        `  • Accessories: ${clothing.accessories?.join(', ') || 'None'}`
      ].join('\n');

      await createNotification(userId, {
        type: 'clothing_recommendation',
        title: '👗 Clothing Recommendation',
        body: clothingText,
        data: {
          icon: '/icons/clothing.png',
          ...clothing
        }
      });

      await sendPushNotification(userId, {
        title: '👗 Clothing Recommendation',
        body: `${clothing.temp}°C: Wear ${clothing.top} & ${clothing.bottom}`,
        tag: 'clothing-rec',
        icon: '/icons/clothing.png'
      });
    } catch (error) {
      console.error('Send clothing recommendation error:', error);
    }
  }

  // ==================== INTERNAL NOTIFICATION CREATION ====================

  async function createNotification(userId, notificationData) {
    try {
      const { data, error } = await SupabaseService.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          ...notificationData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Create notification error:', error);
      return null;
    }
  }

  async function sendPushNotification(userId, pushData) {
    try {
      const tokens = await SupabaseService.getDeviceTokens(userId);
      
      for (const token of tokens) {
        if (token.platform === 'web' && token.endpoint) {
          // Send to Web Push API
          await fetch(token.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '24h'
            },
            body: JSON.stringify({
              notification: pushData
            })
          });
        }
      }
    } catch (error) {
      console.error('Send push notification error:', error);
    }
  }

  // ==================== NOTIFICATION CENTER UI ====================

  async function displayNotificationCenter() {
    const user = SupabaseService.getCurrentUser();
    if (!user) return;

    const notifications = await SupabaseService.getNotifications(user.id, 50);

    return notifications.map(notif => ({
      id: notif.id,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      read: notif.read,
      sent_at: new Date(notif.sent_at),
      data: notif.data
    }));
  }

  async function markAllAsRead(userId) {
    const notifications = await SupabaseService.getUnreadNotifications(userId);
    
    for (const notif of notifications) {
      await SupabaseService.markNotificationAsRead(notif.id);
    }

    return { success: true, count: notifications.length };
  }

  // ==================== SCHEDULED NOTIFICATIONS ====================

  async function setupScheduledNotifications(userId) {
    const schedules = await SupabaseService.getNotificationSchedules(userId);

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;

      const [hour, minute] = schedule.time_of_day.split(':');
      const nextRun = getNextRunTime(hour, minute, schedule.days_of_week);

      // Set timeout for next run
      const timeUntilRun = nextRun.getTime() - Date.now();
      
      if (timeUntilRun > 0) {
        setTimeout(() => {
          executeScheduledNotification(schedule);
          // Reschedule for next day
          setupScheduledNotifications(userId);
        }, timeUntilRun);
      }
    }
  }

  function getNextRunTime(hour, minute, daysOfWeek) {
    const now = new Date();
    let next = new Date();
    next.setHours(parseInt(hour), parseInt(minute), 0, 0);

    // If time has passed today, start tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    // Find next valid day
    while (!daysOfWeek.includes(String(next.getDay()))) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  async function executeScheduledNotification(schedule) {
    try {
      switch (schedule.type) {
        case 'daily_planner':
          // Call daily planner API and send notification
          console.log('Execute daily planner notification');
          break;
        case 'clothing_recommendation':
          // Get weather and generate clothing recommendation
          console.log('Execute clothing recommendation notification');
          break;
        case 'weather_summary':
          // Get weather summary
          console.log('Execute weather summary notification');
          break;
      }

      // Update last_sent timestamp
      await SupabaseService.updateNotificationSchedule(schedule.id, {
        last_sent: new Date().toISOString()
      });
    } catch (error) {
      console.error('Execute scheduled notification error:', error);
    }
  }

  // ==================== REAL-TIME SUBSCRIPTIONS ====================

  function subscribeToRealtimeNotifications(userId) {
    const channel = SupabaseService.subscribeToNotifications(userId, (notification) => {
      // Show browser notification
      if (serviceWorkerRegistration) {
        serviceWorkerRegistration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.data?.icon || '/icons/app.png',
          badge: '/icons/badge.png',
          tag: notification.data?.tag || 'notification',
          data: notification.data
        });
      }

      // Also show in-app toast
      showNotificationToast(notification);
    });

    return channel;
  }

  function showNotificationToast(notification) {
    // Create toast element (integrate with your UI)
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
      <div class="toast-header">${notification.title}</div>
      <div class="toast-body">${notification.body}</div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => toast.remove(), 5000);
  }

  // ==================== UTILITIES ====================

  async function getUserByEmail(email) {
    try {
      const { data, error } = await SupabaseService.supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get user by email error:', error);
      return null;
    }
  }

  return {
    init,
    subscribeToPushNotifications,
    sendPasswordResetNotification,
    sendWeatherAlertNotification,
    sendDisasterAlertNotification,
    sendDailyPlannerNotification,
    sendClothingRecommendationNotification,
    displayNotificationCenter,
    markAllAsRead,
    setupScheduledNotifications,
    subscribeToRealtimeNotifications,
    showNotificationToast
  };
})();

export default NotificationManager;
