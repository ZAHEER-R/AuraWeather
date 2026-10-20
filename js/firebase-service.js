/* ============================================================
   Firebase Service — V2 Backend Integration
   Handles all Firestore operations for AuraWeather
   ============================================================ */

import firebaseConfig from './firebase-config.js';

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const FirebaseService = (() => {
  let app, auth, db;
  let currentUser = null;

  function init() {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      
      // Enable offline persistence
      setPersistence(auth, browserLocalPersistence).catch(err => {
        console.warn('Offline persistence not available:', err);
      });

      // Listen to auth state changes
      onAuthStateChanged(auth, (user) => {
        currentUser = user;
        console.log('Auth state changed:', user?.email || 'logged out');
      });

      return true;
    } catch (error) {
      console.error('Firebase init error:', error);
      return false;
    }
  }

  // ==================== AUTH ====================

  async function signUp(email, password, name) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document
      await setDoc(doc(db, 'users', user.uid), {
        email: email.toLowerCase(),
        name: name || '',
        age: null,
        place: null,
        photo: null,
        auth_method: 'email-local',
        google_sub: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // Create default settings
      await setDoc(doc(db, 'user_settings', user.uid), {
        user_id: user.uid,
        theme: 'dark',
        temp_unit: 'celsius',
        alerts_enabled: true,
        news_alerts: true,
        weather_alerts: true,
        disaster_alerts: true,
        personal_alerts: true,
        updated_at: serverTimestamp()
      });

      return { success: true, user };
    } catch (error) {
      console.error('SignUp error:', error);
      return { success: false, error: error.message };
    }
  }

  async function signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Log login event
      await addDoc(collection(db, 'login_history'), {
        user_id: userCredential.user.uid,
        email: email.toLowerCase(),
        auth_method: 'email-local',
        success: true,
        ip_address: await getClientIP(),
        logged_at: serverTimestamp()
      });

      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('SignIn error:', error);
      
      // Log failed attempt
      await addDoc(collection(db, 'login_history'), {
        user_id: null,
        email: email.toLowerCase(),
        auth_method: 'email-local',
        success: false,
        logged_at: serverTimestamp()
      }).catch(() => {});

      return { success: false, error: error.message };
    }
  }

  async function signOut_() {
    try {
      await signOut(auth);
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
      const docSnap = await getDoc(doc(db, 'users', userId));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  async function updateUser(userId, data) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...data,
        updated_at: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== HEALTH PROFILES ====================

  async function getHealthProfile(userId) {
    try {
      const docSnap = await getDoc(doc(db, 'health_profiles', userId));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Get health profile error:', error);
      return null;
    }
  }

  async function setHealthProfile(userId, profileData) {
    try {
      await setDoc(doc(db, 'health_profiles', userId), {
        user_id: userId,
        ...profileData,
        updated_at: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Set health profile error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== USER SETTINGS ====================

  async function getSettings(userId) {
    try {
      const docSnap = await getDoc(doc(db, 'user_settings', userId));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Get settings error:', error);
      return null;
    }
  }

  async function updateSettings(userId, settings) {
    try {
      await updateDoc(doc(db, 'user_settings', userId), {
        ...settings,
        updated_at: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Update settings error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== SAVED PLACES ====================

  async function getSavedPlaces(userId) {
    try {
      const q = query(collection(db, 'saved_places'), where('user_id', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Get saved places error:', error);
      return [];
    }
  }

  async function addSavedPlace(userId, place) {
    try {
      const docRef = await addDoc(collection(db, 'saved_places'), {
        user_id: userId,
        ...place,
        saved_at: serverTimestamp()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Add saved place error:', error);
      return { success: false, error: error.message };
    }
  }

  async function removeSavedPlace(placeId) {
    try {
      await deleteDoc(doc(db, 'saved_places', placeId));
      return { success: true };
    } catch (error) {
      console.error('Remove saved place error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== SEARCH HISTORY ====================

  async function getSearchHistory(userId, maxResults = 30) {
    try {
      const q = query(
        collection(db, 'search_history'),
        where('user_id', '==', userId),
        orderBy('searched_at', 'desc'),
        limit(maxResults)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Get search history error:', error);
      return [];
    }
  }

  async function addSearchEvent(userId, query, place) {
    try {
      await addDoc(collection(db, 'search_history'), {
        user_id: userId,
        query: query,
        place: place,
        searched_at: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Add search event error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== LOGIN HISTORY ====================

  async function getLoginHistory(userId, maxResults = 50) {
    try {
      const q = query(
        collection(db, 'login_history'),
        where('user_id', '==', userId),
        orderBy('logged_at', 'desc'),
        limit(maxResults)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Get login history error:', error);
      return [];
    }
  }

  // ==================== TRAVEL DESTINATIONS ====================

  async function getTravelDestinations(userId) {
    try {
      const q = query(collection(db, 'travel_destinations'), where('user_id', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Get travel destinations error:', error);
      return [];
    }
  }

  async function addTravelDestination(userId, destination) {
    try {
      const docRef = await addDoc(collection(db, 'travel_destinations'), {
        user_id: userId,
        ...destination,
        saved_at: serverTimestamp()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Add travel destination error:', error);
      return { success: false, error: error.message };
    }
  }

  async function removeTravelDestination(destId) {
    try {
      await deleteDoc(doc(db, 'travel_destinations', destId));
      return { success: true };
    } catch (error) {
      console.error('Remove travel destination error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== DEVICE TOKENS ====================

  async function saveDeviceToken(userId, token, platform = 'web') {
    try {
      await addDoc(collection(db, 'device_tokens'), {
        user_id: userId,
        token: token,
        platform: platform,
        created_at: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Save device token error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== PASSWORD RESET ====================

  async function initPasswordReset(email, otp) {
    try {
      // Hash OTP (use simple hash for demo; use bcrypt in production)
      const otp_hash = await hashOTP(otp);
      
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min validity

      await addDoc(collection(db, 'password_resets'), {
        email: email.toLowerCase(),
        otp_hash: otp_hash,
        expires_at: expiresAt,
        used: false,
        created_at: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Init password reset error:', error);
      return { success: false, error: error.message };
    }
  }

  async function verifyOTPAndResetPassword(email, otp, newPassword) {
    try {
      const q = query(
        collection(db, 'password_resets'),
        where('email', '==', email.toLowerCase()),
        where('used', '==', false),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return { success: false, error: 'No valid reset request found' };
      }

      const resetDoc = snapshot.docs[0];
      const data = resetDoc.data();

      // Verify OTP
      const otp_hash = await hashOTP(otp);
      if (data.otp_hash !== otp_hash) {
        return { success: false, error: 'Invalid OTP' };
      }

      // Check expiry
      if (new Date() > data.expires_at.toDate()) {
        return { success: false, error: 'OTP expired' };
      }

      // Mark as used
      await updateDoc(resetDoc.ref, { used: true });

      // Update user password (this should ideally be done server-side)
      const userQuery = query(collection(db, 'users'), where('email', '==', email.toLowerCase()), limit(1));
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        const userId = userSnapshot.docs[0].id;
        const password_hash = await hashPassword(newPassword);
        await updateDoc(doc(db, 'users', userId), { password_hash });
      }

      return { success: true };
    } catch (error) {
      console.error('Verify OTP error:', error);
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

  async function hashOTP(otp) {
    // Simple hash for demo (use bcrypt in production)
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function hashPassword(password) {
    // Simple hash for demo (use bcrypt in production)
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ==================== BATCH OPERATIONS ====================

  async function migrateFromLocalStorage(userId) {
    try {
      const batch = writeBatch(db);

      // Migrate saved places
      const savedPlaces = JSON.parse(localStorage.getItem('aura_saved_cities') || '[]');
      for (const place of savedPlaces) {
        const docRef = doc(collection(db, 'saved_places'));
        batch.set(docRef, { user_id: userId, ...place, saved_at: serverTimestamp() });
      }

      // Migrate search history
      const searchHistory = JSON.parse(localStorage.getItem('aura_search_history') || '[]');
      for (const event of searchHistory) {
        const docRef = doc(collection(db, 'search_history'));
        batch.set(docRef, { user_id: userId, ...event, searched_at: serverTimestamp() });
      }

      // Migrate travel destinations
      const travelDests = JSON.parse(localStorage.getItem('aura_travel_dests') || '[]');
      for (const dest of travelDests) {
        const docRef = doc(collection(db, 'travel_destinations'));
        batch.set(docRef, { user_id: userId, ...dest, saved_at: serverTimestamp() });
      }

      await batch.commit();
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
    getLoginHistory,
    getTravelDestinations,
    addTravelDestination,
    removeTravelDestination,
    saveDeviceToken,
    initPasswordReset,
    verifyOTPAndResetPassword,
    migrateFromLocalStorage
  };
})();

export default FirebaseService;
