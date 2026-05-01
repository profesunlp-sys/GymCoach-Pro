/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) || (firebaseConfig as any).measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || (firebaseConfig as any).firestoreDatabaseId || '(default)'
};

const app = initializeApp(config);

// Warn if authDomain seems misconfigured (should be .firebaseapp.com)
if (config.authDomain && config.authDomain.includes('vercel.app')) {
  console.warn("⚠️ ALERTA DE CONFIGURACIÓN: Tu 'authDomain' de Firebase está configurado como un dominio de Vercel. Esto suele causar errores 'invalid-continue-uri'. El 'authDomain' debe ser el original de Firebase (ej: proyecto.firebaseapp.com).");
}

export const db = getFirestore(app, config.firestoreDatabaseId);
export const auth = getAuth(app);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
  STAFF: "staff",
  HABILIDADES: "habilidades"
};

// Generic helpers
export const getCollectionData = async (collectionName: string) => {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    handleFirestoreError(error, OperationType.GET, collectionName);
    return []; // Never reached but for TS
  }
};

export const getFilteredCollectionData = async (collectionName: string, field: string, value: string) => {
  try {
    const q = query(collection(db, collectionName), where(field, "==", value));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    handleFirestoreError(error, OperationType.GET, collectionName);
    return []; // Never reached
  }
};

export const addDocument = async (collectionName: string, data: any) => {
  try {
    return await addDoc(collection(db, collectionName), data);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, collectionName);
  }
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  try {
    const docRef = doc(db, collectionName, id);
    return await updateDoc(docRef, data);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, collectionName);
  }
};

export const deleteDocument = async (collectionName: string, id: string) => {
  try {
    const docRef = doc(db, collectionName, id);
    return await deleteDoc(docRef);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.DELETE, collectionName);
  }
};

export const getAttendanceByStudent = async (studentId: string) => {
  try {
    const q = query(collection(db, COLLECTIONS.ASISTENCIAS), where("alumnoId", "==", studentId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    handleFirestoreError(error, OperationType.GET, COLLECTIONS.ASISTENCIAS);
    return [];
  }
};
