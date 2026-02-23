import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBbuRw3J7t_8xQc-6_qOqQDdjEEWZgSHaY",
  authDomain: "gymcoachpro-c0c8e.firebaseapp.com",
  projectId: "gymcoachpro-c0c8e",
  storageBucket: "gymcoachpro-c0c8e.firebasestorage.app",
  messagingSenderId: "923517600594",
  appId: "1:923517600594:web:a81bdd1a150b7f22dcf08b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Collections
export const COLLECTIONS = {
  ALUMNOS: "alumnos",
  CLASES: "clases",
  GRUPOS: "grupos",
  ASISTENCIAS: "asistencias",
  FEEDBACK: "feedback"
};

// Generic helpers
export const getCollectionData = async (collectionName: string) => {
  const querySnapshot = await getDocs(collection(db, collectionName));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addDocument = async (collectionName: string, data: any) => {
  return await addDoc(collection(db, collectionName), data);
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  const docRef = doc(db, collectionName, id);
  return await updateDoc(docRef, data);
};
