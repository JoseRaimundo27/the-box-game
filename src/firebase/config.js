import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDw0NnrLNPnxhm7UyvrhD1wZU7D56B8rTQ",
  authDomain: "the-box-game-d2dd6.firebaseapp.com",
  databaseURL: "https://the-box-game-d2dd6-default-rtdb.firebaseio.com",
  projectId: "the-box-game-d2dd6",
  storageBucket: "the-box-game-d2dd6.firebasestorage.app",
  messagingSenderId: "652663715974",
  appId: "1:652663715974:web:bbf4aa0b9f95f2b4b7f907",
  measurementId: "G-4P14TXP1RN"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);