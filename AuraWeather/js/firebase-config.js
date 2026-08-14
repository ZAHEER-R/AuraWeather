/* ============================================================
   Firebase Configuration Template
   Replace with your Firebase project credentials
   ============================================================ */

// Get these values from your Firebase Console:
// 1. Go to Project Settings
// 2. Look for "Your apps" section
// 3. Copy the config from your web app

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyALvdenjKsojeOH_gIP1BNNq0Jmr0s1mKE",
  authDomain: "auraweather-7122006.firebaseapp.com",
  projectId: "auraweather-7122006",
  storageBucket: "auraweather-7122006.firebasestorage.app",
  messagingSenderId: "278746406041",
  appId: "1:278746406041:web:92ce9679933c1919f3ac08",
  measurementId: "G-HVT49H104E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export default firebaseConfig;

/* ============================================================
   SETUP INSTRUCTIONS
   ============================================================

1. Create a Firebase Project:
   - Go to https://console.firebase.google.com
   - Click "Create a new project" and name it "AuraWeather"
   
2. Enable Firestore Database:
   - In Firebase Console, go to "Firestore Database"
   - Click "Create Database"
   - Choose "Start in test mode" (then update security rules)
   - Select a region close to your users
   
3. Enable Authentication:
   - In Firebase Console, go to "Authentication"
   - Click "Get started"
   - Enable "Email/Password" provider
   - Enable "Google" provider (add your OAuth credentials)
   
4. Get Configuration:
   - Go to Project Settings (gear icon)
   - Scroll to "Your apps"
   - Click "</>" (Web icon)
   - Copy the config object
   - Paste it into this file, replacing placeholder values
   
5. Update Security Rules:
   - Go to Firestore Database > Rules
   - Replace with rules from FIREBASE_SCHEMA.md
   - Click "Publish"
   
6. Optional - Enable Firestore Offline Persistence:
   - Already enabled in firebase-service.js
   - Data syncs automatically when connection resumes

============================================================ */
