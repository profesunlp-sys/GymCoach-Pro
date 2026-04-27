import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
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
    let processedRows = 0;

    // Obtener todos los alumnos para cruzar datos
    const alumnosSnapshot = await getDocs(collection(db, 'alumnos'));
    const allAlumnos: any[] = alumnosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const removeAccents = (str: string) => {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    const currentYear = new Date().getFullYear();
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const normalizeMonth = (val: any): string => {
      if (typeof val === 'number') {
        return monthNames[val - 1] || monthNames[0];
      }
      const s = removeAccents(String(val).trim().toLowerCase());
      const n = parseInt(s);
      if (!isNaN(n)) return monthNames[n - 1] || monthNames[0];
      
      const found = monthNames.find(m => removeAccents(m.toLowerCase()) === s);
      if (found) return found;

      return String(val).charAt(0).toUpperCase() + String(val).slice(1);
    };
    const currentMonthName = monthNames[new Date().getMonth()];

    // Función de comparación de palabras clave (FUZZY MATCHING BÁSICO)
    const findAlumnoByKeywords = (searchName: string) => {
      const searchNameNorm = removeAccents(searchName.toLowerCase());
      const searchTerms = searchNameNorm.split(/\s+/).filter((t: string) => t.length > 1);
      if (searchTerms.length === 0) return null;

      return allAlumnos.find(alumno => {
        const studentName = removeAccents(alumno.nombre.toLowerCase());
        // Verificamos si al menos las palabras clave del nombre del Excel aparecen en el nombre registrado
        const matchesAll = searchTerms.every((term: string) => studentName.includes(term));
        const inverseMatches = studentName.split(/\s+/).filter((t: string) => t.length > 1).every((term: string) => searchNameNorm.includes(term));
        return matchesAll || inverseMatches;
      });
    };

    for (const row of data) {
      // FILTRO DE ACTIVIDAD (REQUISITO: SOLO GIMNASIA ARTISTICA INFANTIL)
      const actividadRaw = row.Actividad || row.actividad || row.Clase || row.clase || row.Disciplina || row.Actividades || '';
      const normalizeActividad = removeAccents(String(actividadRaw).toUpperCase().trim());
      
      // Si el archivo tiene columna de actividad, filtramos pero con más flexibilidad
      if (actividadRaw && !normalizeActividad.includes('GIMNASIA') && !normalizeActividad.includes('ARTISTICA')) {
        continue;
      }
      
      // Intentar encontrar el nombre en las columnas posibles
      const nombreRaw = row.Nombre || row.nombre || row.Alumno || row.alumno || row['Nombre y Apellido'] || row['Nombre Alumno'] || row.Gimnasta || row.gimnasta;
      const dniRaw = (row.DNI || row.dni || row.Documento || row.documento || row.Cedula || row.CUIL || '').toString().trim();
      const añoRaw = row.Año || row.año || row.anio || row.Periodo || row.periodo || currentYear;

      let matchedAlumno = null;

      // 1. PRIORIDAD: DNI
      if (dniRaw && dniRaw !== '' && dniRaw !== '0') {
        matchedAlumno = allAlumnos.find(a => {
          const aDni = (a.dni || '').toString().trim();
          return aDni !== '' && aDni !== 'No especificado' && aDni === dniRaw;
        });
      }

      // 2. SECUNDARIO: NOMBRE EXACTO
      if (!matchedAlumno && nombreRaw) {
        const cleanName = removeAccents(String(nombreRaw).toLowerCase().trim());
        matchedAlumno = allAlumnos.find(a => removeAccents(a.nombre.toLowerCase().trim()) === cleanName);
      }

      // 3. TERCIARIO: COINCIDENCIA DE PALABRAS CLAVE (FUZZY)
      if (!matchedAlumno && nombreRaw) {
        matchedAlumno = findAlumnoByKeywords(String(nombreRaw));
      }

      if (matchedAlumno && matchedAlumno.id) {
        processedRows++;
        const alumnoId = matchedAlumno.id;
        const alumnoRef = doc(db, 'alumnos', alumnoId);
        
        // Determinar qué meses se están pagando en esta fila
        const paymentsInRow: { mes: string, anio: number }[] = [];

        // CASO A: Columna "Mes" explícita
        const mesRaw = row.Mes || row.mes;
        if (mesRaw) {
          paymentsInRow.push({
            mes: normalizeMonth(mesRaw),
            anio: parseInt(añoRaw.toString())
          });
        } 
        
        // CASO B: Meses como columnas (Enero, Febrero, Mar, Abr...)
        const possibleMonthKeys = Object.keys(row);
        possibleMonthKeys.forEach(key => {
          const normalizedKey = key.trim().toLowerCase();
          // Verificar si la columna parece ser un mes
          const monthIdx = monthNames.findIndex(m => m.toLowerCase() === normalizedKey || m.toLowerCase().startsWith(normalizedKey.slice(0,3)));
          
          if (monthIdx !== -1) {
            const cellValue = String(row[key]).toLowerCase().trim();
            // Si la celda tiene alguna marca de pago (X, SI, PAGO, OK, 1, etc)
            if (['x', 'si', 'pago', 'ok', '1', 'checked', 'true', 'pagado'].includes(cellValue)) {
              paymentsInRow.push({
                mes: monthNames[monthIdx],
                anio: parseInt(añoRaw.toString())
              });
            }
          }
        });

        // Si no se encontró ningún mes específico pero la fila existe, usamos el mes actual por defecto
        if (paymentsInRow.length === 0) {
          paymentsInRow.push({
            mes: currentMonthName,
            anio: parseInt(añoRaw.toString())
          });
        }

        // Aplicar todos los pagos encontrados para este alumno
        for (const payment of paymentsInRow) {
          // Evitar duplicados en el mismo proceso si ya lo agregamos (aunque arrayUnion lo maneja en DB)
          batch.update(alumnoRef, {
            pagosMensuales: arrayUnion({
              ...payment,
              fechaPago: new Date().toISOString(),
              importado: true
            })
          });
          count++;
        }
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
