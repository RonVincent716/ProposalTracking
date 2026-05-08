import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver
} from "firebase/auth";
import { getStorage } from "firebase/storage"; // <-- Import Storage

const firebaseConfig = {
  apiKey: "AIzaSyBhCJK7ueC34n7hAFHYJg78tnXj8_eruBA",
  authDomain: "proposaltracking-a2983.firebaseapp.com",
  projectId: "proposaltracking-a2983",
  storageBucket: "proposaltracking-a2983.firebasestorage.app", // Update this line
  messagingSenderId: "445530687466",
  appId: "1:445530687466:web:9eedbc879e647be3801493"
};

const app = initializeApp(firebaseConfig);

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence,
      browserLocalPersistence,
      browserSessionPersistence
    ],
    popupRedirectResolver: browserPopupRedirectResolver
  });
} catch (error) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app); // <-- Initialize Storage
