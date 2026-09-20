/**
 * FIREBASE CONFIGURATION & FIRESTORE INTEGRATION
 * 
 * Replace the firebaseConfig placeholder values below with your own Firebase project keys!
 * To get your Firebase keys:
 * 1. Go to https://console.firebase.google.com/
 * 2. Click "Add project" (or select your existing project).
 * 3. Add a Web App (</> icon) and copy the firebaseConfig object.
 * 4. Enable "Cloud Firestore" database in test mode (or production with public write access).
 */

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if user has updated Firebase config
const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY";

let db = null;

if (isFirebaseConfigured && typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("🔥 Firebase initialized successfully!");
  } catch (err) {
    console.warn("Firebase initialization error:", err);
  }
} else {
  console.log("ℹ️ Running in Local Storage mode. Fill in firebaseConfig in firebase-config.js to enable live Cloud Sync across the internet!");
}
