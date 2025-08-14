// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA-pfzL9lXK1nY66_ps2rdauL0q_dKXKlU",
  authDomain: "pracenje-proizvoda.firebaseapp.com",
  projectId: "pracenje-proizvoda",
  storageBucket: "pracenje-proizvoda.appspot.com",
  appId: "1:895591711314:web:d48f93bbf4e894a91e158b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

