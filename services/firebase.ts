/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBbuRw3J7t_8xQc-6_qOqQDdjEEWZgSHaY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gymcoachpro-c0c8e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gymcoachpro-c0c8e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gymcoachpro-c0c8e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "923517600594",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:923517600594:web:a81bdd1a150b7f22dcf08b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Force local persistence to avoid losing session on refresh
setPersistence(auth, browserLocalPersistence);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Collections
export const COLLECTIONS = {
  ALUMNOS: "alumnos",
  CLASES: "clases",
  GRUPOS: "grupos",
  ASISTENCIAS: "asistencias",
  FEEDBACK: "feedback",
  PROFESORES: "profesores",
  NIVELES: "niveles",
  DISCIPLINAS: "disciplinas",
  WARMUP_OPTIONS: "warmup_options",
  COOLDOWN_OPTIONS: "cooldown_options",
  CONFIG: "config",
  SOURCES: "sources",
  AGE_CATEGORIES: "age_categories",
  PHYSICAL_CATEGORIES: "physical_categories",
  PAGOS: "pagos",
  STAFF: "staff"
};

// Generic helpers
export const getCollectionData = async (collectionName: string) => {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    console.error(`Error getting data from ${collectionName}:`, error);
    throw new Error(`No se pudieron cargar los datos de ${collectionName}. Verifica tu conexión o permisos. (${error.message})`);
  }
};

export const addDocument = async (collectionName: string, data: any) => {
  try {
    return await addDoc(collection(db, collectionName), data);
  } catch (error: any) {
    console.error(`Error adding document to ${collectionName}:`, error);
    throw new Error(`No se pudo guardar la información en ${collectionName}. Verifica tu conexión o permisos. (${error.message})`);
  }
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  try {
    const docRef = doc(db, collectionName, id);
    return await updateDoc(docRef, data);
  } catch (error: any) {
    console.error(`Error updating document ${id} in ${collectionName}:`, error);
    throw new Error(`No se pudo actualizar la información. Verifica tu conexión o permisos. (${error.message})`);
  }
};

export const deleteDocument = async (collectionName: string, id: string) => {
  try {
    const docRef = doc(db, collectionName, id);
    return await deleteDoc(docRef);
  } catch (error: any) {
    console.error(`Error deleting document ${id} in ${collectionName}:`, error);
    throw new Error(`No se pudo eliminar el registro. Verifica tu conexión o permisos. (${error.message})`);
  }
};

export const getAttendanceByStudent = async (studentId: string) => {
  try {
    const q = query(collection(db, COLLECTIONS.ASISTENCIAS), where("alumnoId", "==", studentId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    console.error(`Error getting attendance for student ${studentId}:`, error);
    return [];
  }
};
