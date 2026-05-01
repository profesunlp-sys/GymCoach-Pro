
import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, serverTimestamp, setDoc } from "firebase/firestore";
import Papa from "papaparse";

import firebaseConfig from "./firebase-applet-config.json";

// Firebase App for Server
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

const app = express();
const PORT = 3000;

app.use(express.json());

let syncStatus = {
  lastSync: null as string | null,
  recordsProcessed: 0,
  lastError: null as string | null,
  isSyncing: false
};

async function obtenerDatosDesdeCSV(urlCsv: string): Promise<any[]> {
  const response = await fetch(urlCsv);
  if (!response.ok) {
    throw new Error(`Error al acceder al CSV: ${response.statusText}`);
  }
  const csvText = await response.text();
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error: any) => {
        reject(error);
      }
    });
  });
}

async function startServer() {
  // API Routes
  app.post("/api/sync/manual", async (req, res) => {
    if (syncStatus.isSyncing) return res.status(400).json({ error: "Sincronización en curso" });
    try {
      syncStatus.isSyncing = true;
      syncStatus.lastError = null;
      const result = await runSyncFromSheets();
      res.json(result);
    } catch (error: any) {
      console.error("Error manual sync:", error);
      syncStatus.lastError = error.message;
      res.status(500).json({ error: error.message });
    } finally {
      syncStatus.isSyncing = false;
    }
  });

  app.get("/api/sync/status", (req, res) => {
    res.json(syncStatus);
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

// Task 1: Sheets -> Firebase using CSV public export
async function runSyncFromSheets() {
  let imported = 0;
  let errors = 0;

  try {
    const SHEET_IDS = {
      asistencia: '1FaCHHOmhR66_04sa_XcdxmX3A5qdOVWZHHtpHThz5Ys', // GAF Lunes y Miércoles
      sabados: '1mxo6JKc5uhCs7pw0-UJ-xevC5Iyl2aOvuCHhksWkK2g',    // GAF Sábados
    };

    const SHEET_URLS = {
      asistencia: `https://docs.google.com/spreadsheets/d/${SHEET_IDS.asistencia}/export?format=csv&gid=0`,
      sabados: `https://docs.google.com/spreadsheets/d/${SHEET_IDS.sabados}/export?format=csv&gid=0`,
    };

    const urlsToSync = [SHEET_URLS.asistencia, SHEET_URLS.sabados];

    for (const url of urlsToSync) {
      const rows = await obtenerDatosDesdeCSV(url);
      
      for (const row of rows) {
        // Expected Columns: Fecha, Alumna, Grupo, Presente/Ausente, Observación
        const fecha = row['Fecha'] || row['fecha'] || row['FECHA'];
        const alumnaNombre = row['Alumna'] || row['alumna'] || row['ALUMNA'] || row['Gimnasta'] || row['Nombre'];
        const grupo = row['Grupo'] || row['grupo'] || row['GRUPO'];
        const presenteRaw = row['Presente/Ausente'] || row['presente/ausente'] || row['Asistencia'] || row['Presente'];
        const observacion = row['Observación'] || row['observacion'] || row['Observaciones'] || "";
        
        if (!fecha || !alumnaNombre) continue;

        const presente = String(presenteRaw).toLowerCase().includes('si') || String(presenteRaw).toLowerCase().includes('presente') || String(presenteRaw) === '1';

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
          fecha: fecha || "",
          alumnoId: alumnaId || "",
          alumnaNombre: alumnaNombre || "",
          grupo: grupo || "Sin Grupo",
          presente: !!presente,
          observacion: observacion || "",
          origen: "google_sheets",
          sincronizadoEn: serverTimestamp(),
          estado_sync: syncState || ""
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
    }

    syncStatus.lastSync = new Date().toISOString();
    syncStatus.recordsProcessed = imported;
    
    return { imported, errors };
  } catch (error: any) {
    throw new Error(`Sincronización CSV fallida: ${error.message}`);
  }
}

// Automatic sync logic was moved to client-side.
// server.ts remains for serving Vite and providing future endpoints.

startServer();
