import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface BulkPaymentImportProps {
  onComplete: (count: number) => void;
  onCancel: () => void;
}

export const BulkPaymentImport: React.FC<BulkPaymentImportProps> = ({ onComplete, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number, matched: number, ignored: { row: any, reason: string }[] } | null>(null);

  const normalizeText = (text: any) => {
    if (!text) return "";
    return text.toString().trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  // Función para encontrar una columna en la fila sin importar mayúsculas/minúsculas
  const getValueByPossibleKeys = (row: any, possibleKeys: string[]) => {
    const keys = Object.keys(row);
    for (const key of keys) {
      const normalizedKey = normalizeText(key);
      if (possibleKeys.some(pk => normalizedKey === normalizeText(pk) || normalizedKey.includes(normalizeText(pk)))) {
        return row[key];
      }
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setStats(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertimos a JSON pero filtramos filas que no tengan contenido real
        const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        // Limpieza: solo filas que tengan ALGO de texto en alguna columna
        const jsonData = rawData.filter((row: any) => 
          Object.values(row).some(val => val !== null && val !== undefined && val.toString().trim() !== "")
        );

        if (jsonData.length === 0) {
          throw new Error('El archivo parece estar vacío o no tiene datos válidos.');
        }

        const batch = writeBatch(db);
        let matchedCount = 0;
        const ignoredRows: { row: any, reason: string }[] = [];

        const alumnosSnap = await getDocs(collection(db, 'alumnos'));
        const allAlumnos = alumnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        const currentYear = new Date().getFullYear();
        const now = new Date().toISOString();

        for (const row of jsonData as any[]) {
          // Buscamos columnas con nombres flexibles
          const name = getValueByPossibleKeys(row, ['Nombre', 'Alumno', 'Gimnasta', 'Socio', 'Apellido']);
          const mes = getValueByPossibleKeys(row, ['Mes', 'Cuota', 'Periodo', 'Mes de pago']);
          const monto = getValueByPossibleKeys(row, ['Monto', 'Importe', 'Total', 'Valor', 'Pago']);

          if (!name || !mes) {
            // Si la fila está casi vacía la ignoramos silenciosamente
            if (!name && !mes) continue; 
            
            ignoredRows.push({ row, reason: `Faltan datos en fila de: ${name || 'Sin Nombre'}` });
            continue;
          }

          const normalizedInputName = normalizeText(name);
          
          const student = allAlumnos.find(a => {
            const studentName = normalizeText(a.nombre);
            return studentName === normalizedInputName || 
                   (studentName.length > 5 && normalizedInputName.includes(studentName)) || 
                   (normalizedInputName.length > 5 && studentName.includes(normalizedInputName));
          });

          if (student) {
            const studentRef = doc(db, 'alumnos', student.id);
            batch.update(studentRef, {
              pagosMensuales: arrayUnion({
                mes: mes.toString(),
                anio: currentYear,
                fechaPago: now,
                monto: monto || 0,
                importado: true,
                importadoEn: now
              })
            });
            matchedCount++;
          } else {
            ignoredRows.push({ row, reason: `No se encontró a: "${name}"` });
          }
        }

        if (matchedCount > 0) {
          await batch.commit();
        }

        setStats({
          total: jsonData.length,
          matched: matchedCount,
          ignored: ignoredRows
        });

      } catch (err: any) {
        console.error('Import error:', err);
        setError(err.message || 'Error al procesar el archivo');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className="w-14 h-14 bg-ios-blue text-white rounded-2xl flex items-center justify-center shadow-lg">
              <span className="material-icons-outlined text-3xl">upload_file</span>
            </div>
            <button onClick={onCancel} className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary">
              <span className="material-icons-outlined">close</span>
            </button>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-black tracking-tight">Importar Pagos</h2>
            <p className="text-secondary text-xs">Subí tu Excel para sincronizar cuotas automáticamente.</p>
          </div>

          {error && (
            <div className="p-4 bg-ios-red/10 border border-ios-red/20 rounded-2xl text-xs text-ios-red font-medium">
              {error}
            </div>
          )}

          {stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-ios-gray rounded-3xl p-6 text-center border border-black/5">
                  <div className="text-3xl font-black text-ios-green">{stats.matched}</div>
                  <div className="text-[9px] font-bold text-secondary uppercase tracking-widest mt-1">Sincronizados</div>
                </div>
                <div className="bg-ios-gray rounded-3xl p-6 text-center border border-black/5">
                  <div className="text-3xl font-black text-ios-red">{stats.ignored.length}</div>
                  <div className="text-[9px] font-bold text-secondary uppercase tracking-widest mt-1">Ignorados</div>
                </div>
              </div>

              {stats.ignored.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest ml-1">Detalle de ignorados:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                    {stats.ignored.slice(0, 100).map((item, i) => (
                      <div key={i} className="text-[10px] p-2 bg-ios-gray/50 rounded-xl border border-black/5 text-secondary">
                        {item.reason}
                      </div>
                    ))}
                    {stats.ignored.length > 100 && <p className="text-[9px] text-center text-secondary py-2">...y {stats.ignored.length - 100} más</p>}
                  </div>
                </div>
              )}

              <button 
                onClick={() => onComplete(stats.matched)}
                className="w-full py-5 bg-ios-blue text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-ios active:scale-95 transition-all"
              >
                Entendido
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <label className="relative group cursor-pointer block">
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isProcessing} className="hidden" />
                <div className={`border-2 border-dashed border-black/10 rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 transition-all ${isProcessing ? 'opacity-50' : 'hover:border-ios-blue/40 hover:bg-ios-blue/5'}`}>
                  {isProcessing ? (
                    <div className="w-12 h-12 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-icons-outlined text-secondary text-5xl group-hover:text-ios-blue transition-colors">cloud_upload</span>
                  )}
                  <div className="text-center">
                    <p className="text-sm font-bold text-black">{isProcessing ? 'Procesando...' : 'Seleccionar Archivo'}</p>
                    <p className="text-[10px] text-secondary mt-1 uppercase tracking-widest">Excel (.xlsx, .xls)</p>
                  </div>
                </div>
              </label>

              <div className="bg-ios-blue/5 rounded-2xl p-4 border border-ios-blue/10">
                <p className="text-[10px] text-ios-blue font-medium leading-relaxed">
                  <span className="font-bold">Tip:</span> No importa si las columnas están en mayúsculas o si el Excel tiene filas vacías al final, ahora el sistema las limpia automáticamente.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
