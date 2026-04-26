import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

interface BulkPaymentImportProps {
  onComplete: (count: number) => void;
  onCancel: () => void;
}

export const BulkPaymentImport: React.FC<BulkPaymentImportProps> = ({ onComplete, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number, matched: number } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as any[];

          if (data.length === 0) {
            setError("El archivo Excel está vacío.");
            setIsProcessing(false);
            return;
          }

          // Intentar identificar las columnas (Nombre, Apellido, DNI, Mes, Año)
          // Asumiremos que el Excel tiene columnas con nombres similares
          const matchedCount = await processExcelData(data);
          setStats({ total: data.length, matched: matchedCount });
          onComplete(matchedCount);
        } catch (err) {
          setError("Error al procesar el archivo. Asegúrate que sea un Excel válido.");
          setIsProcessing(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setError("Error al leer el archivo.");
      setIsProcessing(false);
    }
  };

  const processExcelData = async (data: any[]) => {
    const batch = writeBatch(db);
    let count = 0;

    // Obtener todos los alumnos para cruzar datos
    const alumnosSnapshot = await getDocs(collection(db, 'alumnos'));
    const alumnosMap = new Map();
    alumnosSnapshot.docs.forEach(doc => {
      const d = doc.data();
      alumnosMap.set(d.nombre.toLowerCase().trim(), doc.id);
      if (d.dni) alumnosMap.set(d.dni.toString().trim(), doc.id);
    });

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    for (const row of data) {
      // Intentar encontrar el nombre en las columnas posibles
      const nombreRaw = row.Nombre || row.nombre || row.Alumno || row.alumno || row['Nombre y Apellido'];
      const dniRaw = row.DNI || row.dni || row.Documento;
      const mesRaw = row.Mes || row.mes || currentMonth;
      const añoRaw = row.Año || row.año || row.anio || currentYear;

      let alumnoId = null;
      if (dniRaw) alumnoId = alumnosMap.get(dniRaw.toString().trim());
      if (!alumnoId && nombreRaw) alumnoId = alumnosMap.get(nombreRaw.toLowerCase().trim());

      if (alumnoId) {
        const pagoId = `${alumnoId}_${añoRaw}_${mesRaw}`;
        const pagoRef = doc(db, 'pagos', pagoId);
        
        batch.set(pagoRef, {
          alumnoId,
          mes: parseInt(mesRaw),
          año: parseInt(añoRaw),
          fechaImportacion: serverTimestamp(),
          metodo: 'Excel',
          originalRow: JSON.stringify(row).substring(0, 500) // Guardar referencia por si acaso
        }, { merge: true });
        
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    return count;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-ios-blue"></div>
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-bold text-black tracking-tight">Importar Pagos</h3>
            <p className="text-secondary text-sm">Sincroniza alumnos pagados desde Excel</p>
          </div>
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary">
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        {!isProcessing && !stats && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-black/5 rounded-[2rem] p-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-ios-blue/10 text-ios-blue rounded-full flex items-center justify-center">
                <span className="material-icons-outlined text-3xl">upload_file</span>
              </div>
              <div>
                <p className="text-sm font-bold text-black">Selecciona el archivo Excel</p>
                <p className="text-[10px] text-secondary uppercase tracking-widest mt-1">Formatos: .xlsx, .xls, .csv</p>
              </div>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            
            <div className="bg-ios-gray/50 rounded-2xl p-4">
              <h4 className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Consejos para el Excel:</h4>
              <ul className="text-[10px] text-secondary space-y-1.5 list-disc pl-4 font-medium">
                <li>La primera fila debe tener los nombres de las columnas.</li>
                <li>Usa columnas llamadas "Nombre", "DNI" o "Alumno".</li>
                <li>La app intentará emparejar por nombre exacto o DNI.</li>
              </ul>
            </div>
          </div>
        )}

        {isProcessing && !stats && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-black">Procesando archivo...</p>
            <p className="text-[10px] text-secondary">Cruzando datos con la lista de alumnos</p>
          </div>
        )}

        {stats && (
          <div className="py-8 text-center space-y-6">
            <div className="w-20 h-20 bg-ios-green/10 text-ios-green rounded-full flex items-center justify-center mx-auto">
              <span className="material-icons-outlined text-4xl">check_circle</span>
            </div>
            <div>
              <h4 className="text-xl font-bold text-black">¡Importación Exitosa!</h4>
              <p className="text-sm text-secondary mt-1">
                Se han identificado y marcado <strong>{stats.matched}</strong> pagos de {stats.total} filas del Excel.
              </p>
            </div>
            <button 
              onClick={() => onComplete(stats.matched)}
              className="w-full py-4 bg-ios-blue text-white rounded-2xl font-bold text-sm shadow-ios"
            >
              Cerrar y Ver Resultados
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-ios-red/10 border border-ios-red/20 rounded-2xl flex items-start gap-3">
            <span className="material-icons-outlined text-ios-red text-lg">error_outline</span>
            <p className="text-xs text-ios-red font-medium">{error}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
