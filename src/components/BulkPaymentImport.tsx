import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, query, where, getDocs, doc, writeBatch, arrayUnion } from 'firebase/firestore';
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

  const normalizeText = (text: string) => {
    return text.toString().trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quita tildes
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          throw new Error('El archivo está vacío');
        }

        const batch = writeBatch(db);
        let matchedCount = 0;
        const ignoredRows: { row: any, reason: string }[] = [];

        // Traemos todos los alumnos para comparar localmente (más eficiente para sets medianos)
        const alumnosSnap = await getDocs(collection(db, 'alumnos'));
        const allAlumnos = alumnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        const currentYear = new Date().getFullYear();
        const now = new Date().toISOString();

        for (const row of jsonData as any[]) {
          // Buscamos columnas comunes en Excels de pagos
          const name = row['Nombre'] || row['Alumno/a'] || row['Gimnasta'] || row['Nombre y Apellido'] || row['Socio'];
          const mes = row['Mes'] || row['Cuota'] || row['Periodo'];
          const monto = row['Monto'] || row['Importe'] || row['Total'];

          if (!name || !mes) {
            ignoredRows.push({ row, reason: 'Faltan campos requeridos (Nombre o Mes)' });
            continue;
          }

          const normalizedInputName = normalizeText(name);
          
          // Buscamos coincidencia
          const student = allAlumnos.find(a => {
            const studentName = normalizeText(a.nombre);
            return studentName === normalizedInputName || 
                   studentName.includes(normalizedInputName) || 
                   normalizedInputName.includes(studentName);
          });

          if (student) {
            const studentRef = doc(db, 'alumnos', student.id);
            // IMPORTANTE: Quitamos serverTimestamp() porque no funciona dentro de arrayUnion
            batch.update(studentRef, {
              pagosMensuales: arrayUnion({
                mes: mes.toString(),
                anio: currentYear,
                fechaPago: now,
                monto: monto || 0,
                importado: true,
                importadoEn: now // Usamos la fecha de JS aquí también
              })
            });
            matchedCount++;
          } else {
            ignoredRows.push({ row, reason: `No se encontró a: ${name}` });
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

        if (matchedCount > 0) {
          // No cerramos inmediatamente para que el usuario vea los resultados
        }
      } catch (err: any) {
        console.error('Import error:', err);
        setError(err.message || 'Error al procesar el archivo');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setError('Error al leer el archivo');
      setIsProcessing(false);
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
            <div className="w-14 h-14 bg-ios-blue text-white rounded-2xl flex items-center justify-center shadow-lg shadow-ios-blue/20">
              <span className="material-icons-outlined text-3xl">cloud_upload</span>
            </div>
            <button 
              onClick={onCancel}
              className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:scale-90 transition-all"
            >
              <span className="material-icons-outlined">close</span>
            </button>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-black tracking-tight">Importar Pagos</h2>
            <p className="text-secondary text-sm">Seleccioná un archivo Excel (.xlsx) con los pagos mensuales.</p>
          </div>

          {error && (
            <div className="p-4 bg-ios-red/10 border border-ios-red/20 rounded-2xl flex items-start gap-3">
              <span className="material-icons-outlined text-ios-red">error_outline</span>
              <p className="text-xs text-ios-red font-medium">{error}</p>
            </div>
          )}

          {stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-ios-gray rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-ios-green">{stats.matched}</div>
                  <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">Sincronizados</div>
                </div>
                <div className="bg-ios-gray rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-ios-red">{stats.ignored.length}</div>
                  <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">No Encontrados</div>
                </div>
              </div>

              {stats.ignored.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Detalles de errores:</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {stats.ignored.map((item, i) => (
                      <div key={i} className="text-[10px] p-2 bg-ios-red/5 rounded-xl border border-ios-red/10 text-ios-red/80">
                         {item.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={() => onComplete(stats.matched)}
                className="w-full py-4 bg-ios-blue text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-ios-blue/20 active:scale-95 transition-all"
              >
                Finalizar y Cerrar
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <label className="relative group cursor-pointer block">
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
                <div className={`border-2 border-dashed border-black/10 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 transition-all ${isProcessing ? 'opacity-50' : 'hover:border-ios-blue/40 hover:bg-ios-blue/5'}`}>
                  {isProcessing ? (
                    <div className="w-10 h-10 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-icons-outlined text-secondary text-4xl group-hover:text-ios-blue transition-colors">description</span>
                  )}
                  <div className="text-center">
                    <p className="text-sm font-bold text-black">{isProcessing ? 'Procesando...' : 'Hacé click para subir Excel'}</p>
                    <p className="text-[10px] text-secondary mt-1 uppercase tracking-widest">Excel (.xlsx)</p>
                  </div>
                </div>
              </label>

              <div className="bg-ios-gray/50 rounded-2xl p-4 space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-1">
                  <span className="material-icons-outlined text-sm">info</span>
                  Formato Sugerido
                </h4>
                <p className="text-[10px] text-secondary leading-relaxed">
                  Columnas: <span className="font-bold text-black">Nombre</span>, <span className="font-bold text-black">Mes</span> y <span className="font-bold text-black">Monto</span>.
                  <br/>La app busca coincidencias inteligentes ignorando acentos.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
