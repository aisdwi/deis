import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD6-vnZfYNOtkIC07MUXacQkTuFMxfRBQs",
  authDomain: "deis-79e03.firebaseapp.com",
  projectId: "deis-79e03",
  storageBucket: "deis-79e03.firebasestorage.app",
  messagingSenderId: "873757164643",
  appId: "1:873757164643:web:0471a4055528c4e3ef2456",
  measurementId: "G-S8HQ6P8H8W"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

export { auth, db };