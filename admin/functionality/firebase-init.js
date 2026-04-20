/**
 * firebase-init.js
 * Single source of truth for Firebase config + initialization.
 * Loaded first by every admin page before any other script.
 */

const firebaseConfig = {
  apiKey: "AIzaSyCJu7TeRp-umZinY5o1jhN6-LS8EnyM8W4",
  authDomain: "gopal-8f354.firebaseapp.com",
  databaseURL: "https://gopal-8f354-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gopal-8f354",
  storageBucket: "gopal-8f354.firebasestorage.app",
  messagingSenderId: "385964781466",
  appId: "1:385964781466:web:4ef5af2e69982d56f6d423"
};

// Guard against double-initialisation (e.g. hot reload)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Global references used by all other scripts
const auth = firebase.auth();
const db   = firebase.database();

// Log out when the browser tab / session closes
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
