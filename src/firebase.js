import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase web configuration identifies this app; it is not an admin credential.
const firebaseConfig = {
  apiKey: "AIzaSyD6-vnZfYNOtkIC07MUXacQkTuFMxfRBQs",
  authDomain: "deis-79e03.firebaseapp.com",
  projectId: "deis-79e03",
  storageBucket: "deis-79e03.firebasestorage.app",
  messagingSenderId: "873757164643",
  appId: "1:873757164643:web:0471a4055528c4e3ef2456",
  measurementId: "G-S8HQ6P8H8W",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
