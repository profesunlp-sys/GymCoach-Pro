
import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, onSnapshot, serverTimestamp, Timestamp, setDoc } from "firebase/firestore";

// Firebase App for Server
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

const app = express();
const PORT = 3000;

app.use(express.json());

// Google OAuth Setup
let oauth2Client: any = null;

function getOAuth2Client() {
  if (!oauth2Client) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/google/callback";

    if (!clientId || !clientSecret) {
      console.warn("GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET no configurados. Las funciones de Google Sheets estarán deshabilitadas.");
      return null;
    }

    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
  }
  return oauth2Client;
}

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.profile'
];

let syncStatus = {
  lastSync: null as string | null,
  recordsProcessed: 0,
  errors: [] as string[],
  isSyncing: false
};

// Global reference for the token (Should be persisted in Firestore)
let googleRefreshToken = "";

async function getAuthenticatedDoc(sheetId: string) {
  const client = getOAuth2Client();
  if (!client) throw new Error("Google OAuth no configurado en el servidor.");

  if (!googleRefreshToken && !process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error("No autenticado con Google. Por favor, conecta tu cuenta primero.");
  }
  
  client.setCredentials({
    refresh_token: googleRefreshToken || process.env.GOOGLE_REFRESH_TOKEN
  });

  const doc = new GoogleSpreadsheet(sheetId, client);
  await doc.loadInfo();
  return doc;
}

async function startServer() {
  // Try to load refresh token from Firestore on startup
  try {
    const configSnap = await getDocs(query(collection(db, 'config'), where('name', '==', 'google_sync')));
    if (!configSnap.empty) {
      const data = configSnap.docs[0].data();
      googleRefreshToken = data.refreshToken;
      syncStatus.lastSync = data.lastSync;
    }
  } catch (e) {
    console.warn("No se pudo cargar la configuración de sincronización desde Firestore.");
  }

  // API Routes
  app.get("/api/auth/google/url", (req, res) => {
    const client = getOAuth2Client();
    if (!client) return res.status(500).json({ error: "Google OAuth no configurado" });

    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    res.json({ url });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const client = getOAuth2Client();
    if (!client) return res.status(500).send("Google OAuth no configurado");

    const { code } = req.query;
    try {
      const { tokens } = await client.getToken(code as string);
      if (tokens.refresh_token) {
        googleRefreshToken = tokens.refresh_token;
        // Save to Firestore
        await setDoc(doc(db, 'config', 'google_sync'), {
          refreshToken: tokens.refresh_token,
          updatedAt: serverTimestamp(),
          name: 'google_sync'
        }, { merge: true });
      }
      
      res.send("<h1>Sincronización Activada</h1><p>GymCoach Pro ahora está conectado con tus Google Sheets.</p><script>setTimeout(() => window.close(), 2000)</script>");
    } catch (error) {
      console.error("Auth Error:", error);
      res.status(500).send("Error de autenticación");
    }
  });

  app.post("/api/sync/manual", async (req, res) => {
    if (syncStatus.isSyncing) return res.status(400).json({ error: "Sincronización en curso" });
    try {
      syncStatus.isSyncing = true;
      const result = await runSyncFromSheets();
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    } finally {
      syncStatus.isSyncing = false;
    }
  });

  app.get("/api/sync/status", (req, res) => {
    res.json(syncStatus);
  });

  // Task 4: Continuous Sync Listener (Firestore -> Sheets)
  onSnapshot(collection(db, 'asistencias'), (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'modified' || change.type === 'added') {
        const data = change.doc.data();
        // Only sync back if it wasn't originated from Google Sheets to avoid loops
        if (data.origen !== 'google_sheets') {
          await syncToSheets(data);
        }
      }
    });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Task 1: Sheets -> Firebase
async function runSyncFromSheets() {
  const doc = await getAuthenticatedDoc(process.env.GOOGLE_SHEET_ATTENDANCE_ID || "1FaCHHOmhR66_04sa_XcdxmX3A5qdOVWZHHtpHThz5Ys");
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  
  let imported = 0;
  let errors = 0;

  for (const row of rows) {
    // Expected Columns: Fecha, Alumna, Grupo, Presente/Ausente, Observación
    const fecha = row.get('Fecha');
    const alumnaNombre = row.get('Alumna');
    const grupo = row.get('Grupo');
    const presenteRaw = row.get('Presente/Ausente');
    const observacion = row.get('Observación') || "";
    
    if (!fecha || !alumnaNombre) continue;

    const presente = String(presenteRaw).toLowerCase().includes('si') || String(presenteRaw).toLowerCase().includes('presente') || presenteRaw === '1';

    // Business Logic: Check if student exists
    const alumnosSnap = await getDocs(query(collection(db, 'alumnos'), where('nombre', '==', alumnaNombre)));
    let alumnaId = "";
    let syncState = "sincronizado";

    if (alumnosSnap.empty) {
      // Task 1: Si una alumna no existe, crear registro temporal marcado como "pendiente de verificación"
      alumnaId = "DNI_PENDIENTE_" + alumnaNombre.replace(/\s+/g, '_');
      syncState = "pendiente de verificación";
    } else {
      const alumno = alumnosSnap.docs[0].data();
      alumnaId = alumno.dni || alumnosSnap.docs[0].id;
    }

    // Check if record already exists in Firebase to avoid duplicates
    const existingSnap = await getDocs(query(collection(db, 'asistencias'), 
      where('alumnaNombre', '==', alumnaNombre),
      where('fecha', '==', fecha)
    ));

    const recordData = {
      fecha,
      alumnaId,
      alumnaNombre,
      grupo: grupo || "Sin Grupo",
      presente,
      observacion,
      origen: "google_sheets",
      sincronizadoEn: serverTimestamp(),
      estado_sync: syncState
    };

    if (existingSnap.empty) {
      await addDoc(collection(db, 'asistencias'), recordData);
      imported++;
    } else {
      // Task 5: Conflict resolution - Last write wins
      const existingDoc = existingSnap.docs[0];
      const existingData = existingDoc.data();
      
      // Compare timestamps if available, otherwise assume latest sheet data is intent
      if (existingData.presente !== presente || existingData.observacion !== observacion) {
        await updateDoc(doc(db, 'asistencias', existingDoc.id), {
          ...recordData,
          conflicto_resuelto: true
        });
        imported++;
      }
    }
  }

  syncStatus.lastSync = new Date().toISOString();
  syncStatus.recordsProcessed = imported;
  
  return { imported, errors };
}

// Task 2: Firebase -> Sheets
async function syncToSheets(attendanceData: any) {
  try {
    const doc = await getAuthenticatedDoc(process.env.GOOGLE_SHEET_ATTENDANCE_ID || "1FaCHHOmhR66_04sa_XcdxmX3A5qdOVWZHHtpHThz5Ys");
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    // Find matching row
    const match = rows.find(r => 
      r.get('Fecha') === attendanceData.fecha && 
      r.get('Alumna') === attendanceData.alumnaNombre
    );

    if (match) {
      match.set('Presente/Ausente', attendanceData.presente ? 'SI' : 'NO');
      match.set('Observación', attendanceData.observacion || '');
      await match.save();
    } else {
      // Add new row if not found
      await sheet.addRow({
        'Fecha': attendanceData.fecha,
        'Alumna': attendanceData.alumnaNombre,
        'Grupo': attendanceData.grupo,
        'Presente/Ausente': attendanceData.presente ? 'SI' : 'NO',
        'Observación': attendanceData.observacion || ''
      });
    }
  } catch (e) {
    console.error("Error syncing to sheets:", e);
  }
}

// Task 4: Setup 5-minute interval
setInterval(() => {
  if (!syncStatus.isSyncing && googleRefreshToken) {
    runSyncFromSheets().catch(console.error);
  }
}, 5 * 60 * 1000);

startServer();
