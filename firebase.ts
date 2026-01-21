// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCLoJp47X5XWORmjbjgG-6mFQTZkGkyun4",
  authDomain: "my-uno-app.firebaseapp.com",
  projectId: "my-uno-app",
  storageBucket: "my-uno-app.firebasestorage.app",
  messagingSenderId: "1078453764976",
  appId: "1:1078453764976:web:a21b3c99ec3630c92d45b5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);