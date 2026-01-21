
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCLoJp47X5XWORmjbjgG-6mFQTZkGkyun4",
  authDomain: "my-uno-app.firebaseapp.com",
  projectId: "my-uno-app",
  storageBucket: "my-uno-app.firebasestorage.app",
  messagingSenderId: "1078453764976",
  appId: "1:1078453764976:web:a21b3c99ec3630c92d45b5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
