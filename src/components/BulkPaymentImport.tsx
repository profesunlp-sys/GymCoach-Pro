import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { motion, AnimatePresence } from 'motion/react';

type ImportedPayment = {
  mes: string;
  anio: number;
  fechaPago: string;
  monto: number;
  importado: boolean;
  categoria: string;
};

type ImportedStudent = {
  id: string;
  nombre: string;
  dni?: string;
  grupo?: string;
  pagosMensuales?: ImportedPayment[];
};

type ImportedGroup = {
  id: string;
  nombre: string;
  horario?: string;
  dias?: string[] | string;
};

type PaymentMonth = { mes: string; anio: number };

interface BulkPaymentImportProps {
  onComplete: (count: number) => void;
  onCancel: () => void;
}

export const BulkPaymentImport: React.FC<BulkPaymentImportProps> = ({ onComplete, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number, matched: number, alreadyRegistered: number, ignored: { row: unknown[], reason: string }[] } | null>(null);

  const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const normalizeText = (text: unknown) => {
    if (text === null || text === undefined) return "";
    return text.toString().trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const getMonthName = (dateInput: unknown): PaymentMonth | null => {
    try {
      if (!dateInput) return null;
      let date: Date;
      let year: number = new Date().getFullYear();

      if (typeof dateInput === 'number') {
        // Si es un número pequeño (1-12), es el mes directo
        if (dateInput >= 1 && dateInput <= 12) {
          return { mes: MONTHS[dateInput - 1], anio: year };
        }
        // Si es un número grande, es fecha Excel serial
        // IMPORTANTE: usar UTC para evitar desfase de zona horaria (bug clásico)
        const msUtc = (dateInput - 25569) * 86400 * 1000;
        const d = new Date(msUtc);
        return { mes: MONTHS[d.getUTCMonth()], anio: d.getUTCFullYear() };
      } else {
        const str = dateInput.toString().trim();
        // Detectar si es un mes escrito (ej: "Marzo 2026", "MARZO")
        const monthsLower = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const normalizedDateText = normalizeText(str);

        const foundIndex = monthsLower.findIndex(m => normalizedDateText.includes(m));
        if (foundIndex !== -1) {
          const yearMatch = str.match(/(20\d{2})/);
          return { mes: MONTHS[foundIndex], anio: yearMatch ? parseInt(yearMatch[1], 10) : year };
        }

        // Formato DD/MM/YYYY o DD/MM/YY
        const parts = str.split('/');
        if (parts.length >= 2) {
          const m = parseInt(parts[1]);
          const y = parts[2] ? parseInt(parts[2]) : year;
          const fullYear = y < 100 ? 2000 + y : y;
          if (m >= 1 && m <= 12) return { mes: MONTHS[m - 1], anio: fullYear };
        }

        // Último recurso: Date nativa
        date = new Date(str);
      }

      if (isNaN(date!.getTime())) return null;
      return { mes: MONTHS[date!.getUTCMonth()], anio: date!.getUTCFullYear() };
    } catch (e) { return null; }
  };

  const isTargetGymnasticsActivity = (value: string) => {
    const normalized = normalizeText(value);
    // Filtro amplio: acepta cualquier fila que mencione gimnasia artística
    // La oficina puede usar distintas denominaciones: GAF, GAI, G.A., Artística, etc.
    return (
      normalized.includes('gimnasia') ||
      normalized.includes('gaf') ||
      normalized.includes('g.a') ||
      normalized.includes('artistica') ||
      normalized.includes('artistico') ||
      normalized.includes('gai')
    );
  };

  const normalizeNameParts = (name: unknown) => {
    return normalizeText(name)
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter((part: string) => part.length > 2);
  };

  const findStudent = (allAlumnos: ImportedStudent[], rawName: unknown) => {
    const normalizedInputName = normalizeText(rawName).replace(/,/g, ' ');
    const inputParts = normalizeNameParts(rawName);
    const inputDni = String(rawName ?? '').match(/\b\d{7,9}\b/)?.[0];

    return allAlumnos.find((student: ImportedStudent) => {
      const studentName = normalizeText(student.nombre).replace(/,/g, ' ');
      const studentParts = normalizeNameParts(student.nombre);
      const dniMatches = !!inputDni && student.dni === inputDni;
      const exactNameMatches = studentName === normalizedInputName;
      const allInputPartsMatch = inputParts.length > 0 && inputParts.every((part: string) => studentName.includes(part));
      const allStudentPartsMatch = studentParts.length > 0 && studentParts.every((part: string) => normalizedInputName.includes(part));

      return dniMatches || exactNameMatches || allInputPartsMatch || allStudentPartsMatch;
    });
  };

  const findMonthInRow = (row: unknown[]) => {
    for (const cell of row) {
      const month = getMonthName(cell);
      if (month) return month;
    }
    return null;
  };

  const isPaidCell = (cell: unknown) => {
    const normalized = normalizeText(cell);
    if (!normalized) return false;
    return !['no', 'nop', 'debe', 'pendiente', 'sin pago', '0', 'false'].includes(normalized);
  };

  const getHeaderMonthColumns = (row: unknown[]) => {
    return row.reduce<{ index: number; month: PaymentMonth }[]>((acc, cell, index) => {
      const month = getMonthName(cell);
      if (month) acc.push({ index, month });
      return acc;
    }, []);
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

        if (workbook.SheetNames.length === 0) throw new Error('El archivo no contiene hojas.');

        // ── Verificar autenticación antes de llamar a Firestore ──
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No estás autenticado. Recargá la página (Ctrl+Shift+R) e iniciá sesión nuevamente.');
        }

        // ── Cargar datos de Firebase UNA SOLA VEZ antes de procesar hojas ──
        const alumnosSnap = await getDocs(collection(db, 'alumnos'));
        const allAlumnos = alumnosSnap.docs.map(d => ({ id: d.id, ...d.data() } as ImportedStudent));

        const gruposSnap = await getDocs(collection(db, 'grupos'));
        const allGrupos = gruposSnap.docs.map(d => ({ id: d.id, ...d.data() } as ImportedGroup));

        const currentYear = new Date().getFullYear();

        // ── Acumuladores compartidos entre TODAS las hojas ──
        const studentPaymentsMap: Record<string, ImportedPayment[]> = {};
        const studentGroupUpdates: Record<string, string> = {};
        const studentRefs: Record<string, ReturnType<typeof doc>> = {};
        let matchedCount = 0;
        let alreadyRegisteredCount = 0;
        let totalDataRows = 0;
        const ignoredRows: { row: unknown[], reason: string }[] = [];

        // ── Iterar TODAS las hojas del archivo ──
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          if (rows.length === 0) continue;

          let headerRowIndex = -1;
          let colIndices: Record<string, number> = { nombre: -1, mes: -1, monto: -1, fecha: -1, tramite: -1, actividad: -1 };
          let monthColumns: { index: number; month: PaymentMonth }[] = [];

          for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i];
            if (!row) continue;
            for (let j = 0; j < row.length; j++) {
              const cell = normalizeText(row[j]);
              if (colIndices.nombre === -1 && (cell.includes('apellido') || cell.includes('nombre') || cell.includes('alumno') || cell.includes('gimnasta') || cell.includes('deportista'))) colIndices.nombre = j;
              if (colIndices.mes === -1 && (cell === 'mes' || cell.includes('cuota') || cell.includes('periodo') || cell.includes('mensualidad'))) colIndices.mes = j;
              if (colIndices.monto === -1 && (cell.includes('importe') || cell.includes('monto') || cell.includes('valor') || cell.includes('precio'))) colIndices.monto = j;
              if (colIndices.fecha === -1 && (cell.includes('fecha') || cell.includes('pago'))) colIndices.fecha = j;
              if (colIndices.tramite === -1 && (cell.includes('tramite') || cell.includes('detalle') || cell.includes('concepto') || cell.includes('descripcion'))) colIndices.tramite = j;
              if (colIndices.actividad === -1 && (cell.includes('actividad') || cell.includes('disciplina') || cell.includes('categoria'))) colIndices.actividad = j;
            }
            const detectedMonthColumns = getHeaderMonthColumns(row);
            if (colIndices.nombre !== -1 && (colIndices.mes !== -1 || colIndices.fecha !== -1 || detectedMonthColumns.length > 0)) {
              headerRowIndex = i;
              monthColumns = detectedMonthColumns;
              break;
            }
          }

          // Hoja sin encabezados reconocibles → la salteamos sin error
          if (headerRowIndex === -1) continue;

          const dataRows = rows.slice(headerRowIndex + 1).filter(r => r[colIndices.nombre]);
          totalDataRows += dataRows.length;

        for (const rowData of dataRows) {
          // Todas las filas del archivo se procesan — el componente es específico de GAI.
          // activityValue se mantiene para la detección de grupo (NO para filtrar filas).
          const activityValue = [
            colIndices.actividad !== -1 ? normalizeText(String(rowData[colIndices.actividad] ?? '')) : '',
            colIndices.tramite  !== -1 ? normalizeText(String(rowData[colIndices.tramite]  ?? '')) : '',
            normalizeText(rowData.join(' ')),
            normalizeText(sheetName)
          ].join(' ');
          const nameValue = rowData[colIndices.nombre];
          let mesData = null;
          if (colIndices.mes !== -1) mesData = getMonthName(rowData[colIndices.mes]);
          if (!mesData && colIndices.fecha !== -1) mesData = getMonthName(rowData[colIndices.fecha]);

          let monthsToRegister: PaymentMonth[] = [];

          if (mesData) {
            monthsToRegister = [mesData];
          } else if (monthColumns.length > 0) {
            monthsToRegister = monthColumns
                .filter(({ index }) => isPaidCell(rowData[index]))
                .map(({ month }) => month);
          }
          
          if (monthsToRegister.length === 0) {
             const fallbackMonth = findMonthInRow(rowData);
             if (fallbackMonth) monthsToRegister = [fallbackMonth];
          }

          // Filtrar solo meses de la temporada activa: Marzo–Noviembre
          // Enero y Febrero no tienen actividad y no deben importarse
          const MESES_TEMPORADA = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre'];
          monthsToRegister = monthsToRegister.filter(m => MESES_TEMPORADA.includes(m.mes));

          if (!nameValue || monthsToRegister.length === 0) continue;

          const student = findStudent(allAlumnos, nameValue);

          if (student) {
            // DETECCION DE GRUPO: Intentamos encontrar si el tramite describe un grupo existente
            let matchedGrupoName = null;
            for (const g of allGrupos) {
              const gNameNorm = normalizeText(g.nombre);
              const gHorarioNorm = normalizeText(g.horario);
              const groupDays = Array.isArray(g.dias) ? g.dias : String(g.dias || '').split(/[,y]+/);
              const gDiasNorm = groupDays.map((d: string) => normalizeText(d)).filter(Boolean);

              // Si el trámite contiene el nombre del grupo
              if (gNameNorm.length > 5 && activityValue.includes(gNameNorm)) {
                matchedGrupoName = g.nombre;
                break;
              }

              // Si el trámite contiene los días Y el horario
              const containsHorario = gHorarioNorm.length > 2 && activityValue.includes(gHorarioNorm);
              const containsAllDias = gDiasNorm.length > 0 && gDiasNorm.every((d: string) => activityValue.includes(d));

              if (containsHorario && containsAllDias) {
                matchedGrupoName = g.nombre;
                break;
              }
            }

            if (matchedGrupoName && (!student.grupo || student.grupo === 'SIN GRUPO')) {
              studentGroupUpdates[student.id] = matchedGrupoName;
            }

            for (const paymentMonth of monthsToRegister) {
              // Evitar duplicados: Verificamos si el alumno ya tiene este mes/año pagado en su historial
              const yaRegistrado = student.pagosMensuales?.some((p: ImportedPayment) =>
                p.mes?.toLowerCase() === paymentMonth.mes.toLowerCase() && p.anio === paymentMonth.anio
              );

              // También verificamos si ya lo procesamos en esta misma planilla
              const yaProcesadoEnBatch = studentPaymentsMap[student.id]?.some((p: ImportedPayment) =>
                p.mes?.toLowerCase() === paymentMonth.mes.toLowerCase() && p.anio === paymentMonth.anio
              );

              if (!yaRegistrado && !yaProcesadoEnBatch) {
                if (!studentPaymentsMap[student.id]) {
                  studentPaymentsMap[student.id] = [];
                  studentRefs[student.id] = doc(db, 'alumnos', student.id);
                }

                // Categoria: si hay columna de actividad/trámite usarla, si no siempre usar el default
                // (evitamos usar sheetName porque puede ser "Hoja1" y romper el filtro de isPaid en ControlPagos)
                const rawActividad = colIndices.actividad !== -1 ? String(rowData[colIndices.actividad] ?? '') : '';
                const rawTramite   = colIndices.tramite  !== -1 ? String(rowData[colIndices.tramite]  ?? '') : '';
                const categoriaFinal = rawActividad || rawTramite || 'Gimnasia Artística Infantil';

                // Sanitizar año: si el valor no es un año razonable (ej: serial Excel como 150335)
                // usamos el año actual en su lugar
                const safeAnio = (paymentMonth.anio >= 2020 && paymentMonth.anio <= 2035)
                  ? paymentMonth.anio
                  : currentYear;

                studentPaymentsMap[student.id].push({
                  mes: paymentMonth.mes,
                  anio: safeAnio,
                  fechaPago: new Date().toISOString(),
                  monto: colIndices.monto !== -1 ? parseFloat(String(rowData[colIndices.monto])) || 0 : 0,
                  importado: true,
                  categoria: categoriaFinal
                });
                matchedCount++;
              } else {
                alreadyRegisteredCount++;
              }
            }
          } else {
            ignoredRows.push({ row: rowData, reason: `No se encontró a: "${nameValue}"` });
          }
        }
        } // ── fin loop hojas ──

        if (totalDataRows === 0) throw new Error('No se encontraron filas de datos en ninguna hoja del archivo.');

        // ── Aplicar todos los pagos acumulados en un solo batch ──
        const batch = writeBatch(db);
        for (const studentId in studentPaymentsMap) {
          const updateData: { pagosMensuales: ReturnType<typeof arrayUnion>; grupo?: string } = {
            pagosMensuales: arrayUnion(...studentPaymentsMap[studentId])
          };

          if (studentGroupUpdates[studentId]) {
            updateData.grupo = studentGroupUpdates[studentId];
          }

          batch.update(studentRefs[studentId], updateData);
        }

        if (matchedCount > 0 || Object.keys(studentGroupUpdates).length > 0) await batch.commit();

        setStats({
          total: totalDataRows,
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

            <AnimatePresence>
              {showIgnored && stats.ignored.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-gray-50 rounded-2xl p-4 border border-black/5 max-h-48 overflow-y-auto">
                    <p className="text-[10px] font-bold text-secondary uppercase mb-2">No se encontraron estos nombres:</p>
                    <div className="space-y-1">
                      {stats.ignored.map((item, idx) => (
                        <div key={idx} className="text-xs text-black border-b border-black/5 pb-1 last:border-0 flex justify-between">
                          <span>{String(item.row[0] || 'Sin nombre')}</span>
                          <span className="text-[9px] text-red-400 italic">No existe en base</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
