import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { motion } from 'motion/react';

interface BulkPaymentImportProps {
  onComplete: (count: number) => void;
  onCancel: () => void;
}

export const BulkPaymentImport: React.FC<BulkPaymentImportProps> = ({ onComplete, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number, matched: number, alreadyRegistered: number, ignored: { row: any, reason: string }[] } | null>(null);

  const normalizeText = (text: any) => {
    if (text === null || text === undefined) return "";
    return text.toString().trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const getMonthName = (dateInput: any) => {
    try {
      if (!dateInput) return null;
      let date: Date;
      let year: number = new Date().getFullYear();

      if (typeof dateInput === 'number') {
        // Si es un número pequeño (1-12), es el mes directo
        if (dateInput >= 1 && dateInput <= 12) {
          const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
          return { mes: months[dateInput - 1], anio: year };
        }
        // Si es un número grande, es fecha Excel
        date = new Date((dateInput - 25569) * 86400 * 1000);
      } else {
        const str = dateInput.toString().trim();
        // Intentar detectar si es un mes escrito
        const monthsLower = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const monthsCapitalized = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        
        const foundIndex = monthsLower.findIndex(m => str.toLowerCase().includes(m));
        if (foundIndex !== -1) return { mes: monthsCapitalized[foundIndex], anio: year };

        // Intentar detectar formato fecha DD/MM/YYYY
        const parts = str.split('/');
        if (parts.length >= 2) {
          const d = parseInt(parts[0]);
          const m = parseInt(parts[1]);
          const y = parts[2] ? parseInt(parts[2]) : year;
          date = new Date(y, m - 1, d);
        } else {
          date = new Date(dateInput);
        }
      }

      if (isNaN(date.getTime())) return null;
      const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      return { mes: months[date.getMonth()], anio: date.getFullYear() };
    } catch (e) { return null; }
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
        const sheetName = workbook.SheetNames.find(n => n.toUpperCase().includes("PAGOS") || n.toUpperCase().includes("CONTROL")) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rows.length === 0) throw new Error('El archivo está vacío.');

        let headerRowIndex = -1;
        let colIndices: Record<string, number> = { nombre: -1, mes: -1, monto: -1, fecha: -1, tramite: -1 };

        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i];
          if (!row) continue;
          for (let j = 0; j < row.length; j++) {
            const cell = normalizeText(row[j]);
            if (colIndices.nombre === -1 && (cell.includes('apellido') || cell.includes('nombre'))) colIndices.nombre = j;
            if (colIndices.mes === -1 && (cell === 'mes' || cell.includes('cuota'))) colIndices.mes = j;
            if (colIndices.monto === -1 && (cell.includes('importe') || cell.includes('monto'))) colIndices.monto = j;
            if (colIndices.fecha === -1 && (cell.includes('fecha'))) colIndices.fecha = j;
            if (colIndices.tramite === -1 && (cell.includes('tramite') || cell.includes('detalle'))) colIndices.tramite = j;
          }
          if (colIndices.nombre !== -1 && (colIndices.mes !== -1 || colIndices.fecha !== -1)) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) throw new Error('No encontré las columnas necesarias.');

        const dataRows = rows.slice(headerRowIndex + 1).filter(r => r[colIndices.nombre]);
        const batch = writeBatch(db);
        let matchedCount = 0;
        const ignoredRows: { row: any, reason: string }[] = [];

        const alumnosSnap = await getDocs(collection(db, 'alumnos'));
        const allAlumnos = alumnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        const gruposSnap = await getDocs(collection(db, 'grupos'));
        const allGrupos = gruposSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        const currentYear = new Date().getFullYear();
        let alreadyRegisteredCount = 0;

        const studentPaymentsMap: Record<string, any[]> = {};
        const studentGroupUpdates: Record<string, string> = {};
        const studentRefs: Record<string, any> = {};

        for (const rowData of dataRows) {
          const tramiteValue = colIndices.tramite !== -1 ? normalizeText(rowData[colIndices.tramite]) : "";
          
          // FILTRO FLEXIBLE: Gimnasia Artística, Gim. Artística, G. Artística, etc.
          const isGymnastics = tramiteValue.includes("gimnasia artistica") || 
                              (tramiteValue.includes("gimnasia") && tramiteValue.includes("infantil")) ||
                              tramiteValue.includes("g.a.i");
          
          if (!isGymnastics) continue;

          const nameValue = rowData[colIndices.nombre];
          let mesData = colIndices.mes !== -1 ? getMonthName(rowData[colIndices.mes]) : null;
          if (!mesData && colIndices.fecha !== -1) mesData = getMonthName(rowData[colIndices.fecha]);

          if (!nameValue || !mesData) continue;

          const normalizedInputName = normalizeText(nameValue);
          
          const student = allAlumnos.find(a => {
            const sn = normalizeText(a.nombre);
            const inputParts = normalizedInputName.split(' ').filter(p => p.length > 2);
            return sn === normalizedInputName || (inputParts.length > 0 && inputParts.every(part => sn.includes(part)));
          });

          if (student) {
            // DETECCION DE GRUPO: Intentamos encontrar si el tramite describe un grupo existente
            let matchedGrupoName = null;
            for (const g of allGrupos) {
              const gNameNorm = normalizeText(g.nombre);
              const gHorarioNorm = normalizeText(g.horario);
              const gDiasNorm = (g.dias || []).map((d: string) => normalizeText(d));
              
              // Si el trámite contiene el nombre del grupo
              if (gNameNorm.length > 5 && tramiteValue.includes(gNameNorm)) {
                matchedGrupoName = g.nombre;
                break;
              }
              
              // Si el trámite contiene los días Y el horario
              const containsHorario = gHorarioNorm.length > 2 && tramiteValue.includes(gHorarioNorm);
              const containsAllDias = gDiasNorm.length > 0 && gDiasNorm.every((d: string) => tramiteValue.includes(d));
              
              if (containsHorario && containsAllDias) {
                matchedGrupoName = g.nombre;
                break;
              }
            }

            if (matchedGrupoName && (!student.grupo || student.grupo === 'SIN GRUPO')) {
              studentGroupUpdates[student.id] = matchedGrupoName;
            }

            // Evitar duplicados: Verificamos si el alumno ya tiene este mes/año pagado en su historial
            const yaRegistrado = student.pagosMensuales?.some((p: any) => 
              p.mes?.toLowerCase() === mesData.mes.toLowerCase() && p.anio === mesData.anio
            );
            
            // También verificamos si ya lo procesamos en esta misma planilla
            const yaProcesadoEnBatch = studentPaymentsMap[student.id]?.some((p: any) => 
              p.mes?.toLowerCase() === mesData.mes.toLowerCase() && p.anio === mesData.anio
            );

            if (!yaRegistrado && !yaProcesadoEnBatch) {
              if (!studentPaymentsMap[student.id]) {
                studentPaymentsMap[student.id] = [];
                studentRefs[student.id] = doc(db, 'alumnos', student.id);
              }

              studentPaymentsMap[student.id].push({
                mes: mesData.mes,
                anio: mesData.anio || currentYear,
                fechaPago: new Date().toISOString(),
                monto: colIndices.monto !== -1 ? parseFloat(rowData[colIndices.monto]) || 0 : 0,
                importado: true,
                categoria: rowData[colIndices.tramite] || "Gimnasia Artística"
              });
              matchedCount++;
            } else {
              alreadyRegisteredCount++;
            }
          } else {
            ignoredRows.push({ row: rowData, reason: `No se encontró a: "${nameValue}"` });
          }
        }

        // Aplicamos todos los pagos agrupados por alumno
        for (const studentId in studentPaymentsMap) {
          const updateData: any = {
            pagosMensuales: arrayUnion(...studentPaymentsMap[studentId])
          };
          
          if (studentGroupUpdates[studentId]) {
            updateData.grupo = studentGroupUpdates[studentId];
          }

          batch.update(studentRefs[studentId], updateData);
        }

        if (matchedCount > 0 || Object.keys(studentGroupUpdates).length > 0) await batch.commit();

        setStats({
          total: dataRows.length,
          matched: matchedCount,
          alreadyRegistered: alreadyRegisteredCount,
          ignored: ignoredRows
        });

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const [showIgnored, setShowIgnored] = useState(false);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <div className="bg-ios-blue text-white p-3 rounded-xl"><span className="material-icons-outlined">verified_user</span></div>
          <button onClick={onCancel} className="text-secondary"><span className="material-icons-outlined">close</span></button>
        </div>
        
        <div>
          <h2 className="text-xl font-bold">Importar Gimnasia Artística</h2>
          <p className="text-xs text-secondary italic">Filtrando automáticamente solo pagos de Gimnasia Infantil.</p>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-bold">{error}</div>}

        {stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-ios-green/5 p-3 rounded-2xl text-center border border-ios-green/10">
                <div className="text-2xl font-bold text-ios-green">{stats.matched}</div>
                <div className="text-[9px] uppercase text-ios-green/70 font-bold">Nuevos</div>
              </div>
              <div className="bg-ios-blue/5 p-3 rounded-2xl text-center border border-ios-blue/10">
                <div className="text-2xl font-bold text-ios-blue">{stats.alreadyRegistered}</div>
                <div className="text-[9px] uppercase text-ios-blue/70 font-bold">Ya estaban</div>
              </div>
              <button 
                onClick={() => setShowIgnored(!showIgnored)}
                className={`p-3 rounded-2xl text-center border transition-all ${showIgnored ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}
              >
                <div className="text-2xl font-bold text-secondary">{stats.ignored.length}</div>
                <div className="text-[9px] uppercase text-secondary font-bold">No encontrados</div>
              </button>
            </div>

           

            <p className="text-[11px] text-center text-secondary leading-tight px-4">
              Los redondelitos de los alumnos vinculados ahora aparecerán marcados en el panel de pagos.
            </p>
            <button onClick={() => onComplete(stats.matched)} className="w-full py-4 bg-ios-blue text-white rounded-xl font-bold shadow-lg">FINALIZAR</button>
          </div>
        ) : (
          <label className="block border-2 border-dashed border-ios-blue/20 rounded-3xl p-10 text-center cursor-pointer hover:bg-ios-blue/5 transition-all">
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            <span className="material-icons-outlined text-4xl text-ios-blue mb-2">auto_awesome</span>
            <p className="font-bold text-sm text-ios-blue">Procesar Planilla</p>
            <p className="text-[10px] text-secondary mt-1">Solo se procesarán los pagos de Gimnasia Artística Infantil</p>
          </label>
        )}
      </div>
    </motion.div>
  );
};
