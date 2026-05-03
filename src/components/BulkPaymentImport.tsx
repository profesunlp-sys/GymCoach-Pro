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
  const [stats, setStats] = useState<{ total: number, matched: number, ignored: { row: any, reason: string }[] } | null>(null);

  const normalizeText = (text: any) => {
    if (text === null || text === undefined) return "";
    return text.toString().trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const getMonthName = (dateInput: any) => {
    try {
      if (!dateInput) return null;
      let date: Date;
      
      if (typeof dateInput === 'number') {
        // Excel date serial number
        date = new Date((dateInput - 25569) * 86400 * 1000);
      } else {
        // String date (e.g. "3/3/2026")
        const parts = dateInput.toString().split('/');
        if (parts.length >= 2) {
          date = new Date(parseInt(parts[2] || new Date().getFullYear().toString()), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
          date = new Date(dateInput);
        }
      }

      if (isNaN(date.getTime())) return null;

      const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      return months[date.getMonth()];
    } catch (e) {
      return null;
    }
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
        
        // Intentamos usar la hoja "PAGOS" o "CONTROL GENERAL", sino la primera
        const sheetName = workbook.SheetNames.find(n => n.toUpperCase().includes("PAGOS") || n.toUpperCase().includes("CONTROL")) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rows.length === 0) throw new Error('El archivo está vacío.');

        // Encontrar encabezados
        let headerRowIndex = -1;
        let colIndices: Record<string, number> = { nombre: -1, mes: -1, monto: -1, fecha: -1 };

        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i];
          if (!row) continue;
          for (let j = 0; j < row.length; j++) {
            const cell = normalizeText(row[j]);
            if (colIndices.nombre === -1 && (cell.includes('apellido') || cell.includes('nombre') || cell.includes('alumno'))) colIndices.nombre = j;
            if (colIndices.mes === -1 && (cell === 'mes' || cell.includes('cuota') || cell.includes('periodo'))) colIndices.mes = j;
            if (colIndices.monto === -1 && (cell.includes('importe') || cell.includes('monto') || cell.includes('pago'))) colIndices.monto = j;
            if (colIndices.fecha === -1 && (cell.includes('fecha'))) colIndices.fecha = j;
          }
          if (colIndices.nombre !== -1 && (colIndices.mes !== -1 || colIndices.fecha !== -1)) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          throw new Error('No encontré las columnas de "Nombre" y "Mes/Fecha". Revisá los encabezados.');
        }

        const dataRows = rows.slice(headerRowIndex + 1).filter(r => r[colIndices.nombre]);
        const batch = writeBatch(db);
        let matchedCount = 0;
        const ignoredRows: { row: any, reason: string }[] = [];

        const alumnosSnap = await getDocs(collection(db, 'alumnos'));
        const allAlumnos = alumnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const currentYear = new Date().getFullYear();

        for (const rowData of dataRows) {
          const nameValue = rowData[colIndices.nombre];
          let mesValue = colIndices.mes !== -1 ? rowData[colIndices.mes] : null;
          
          // Si no hay columna Mes, extraemos el nombre del mes de la Fecha
          if (!mesValue && colIndices.fecha !== -1) {
            mesValue = getMonthName(rowData[colIndices.fecha]);
          }

          if (!nameValue || !mesValue) continue;

          const normalizedInputName = normalizeText(nameValue);
          const student = allAlumnos.find(a => {
            const sn = normalizeText(a.nombre);
            return sn === normalizedInputName || sn.includes(normalizedInputName) || normalizedInputName.includes(sn);
          });

          if (student) {
            const studentRef = doc(db, 'alumnos', student.id);
            const monto = colIndices.monto !== -1 ? parseFloat(rowData[colIndices.monto]) || 0 : 0;
            
            batch.update(studentRef, {
              pagosMensuales: arrayUnion({
                mes: mesValue.toString().toLowerCase(),
                anio: currentYear,
                fechaPago: new Date().toISOString(),
                monto: monto,
                importado: true,
                metodo: 'Excel'
              })
            });
            matchedCount++;
          } else {
            ignoredRows.push({ row: rowData, reason: `No se encontró a: "${nameValue}"` });
          }
        }

        if (matchedCount > 0) await batch.commit();

        setStats({
          total: dataRows.length,
          matched: matchedCount,
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="bg-ios-blue text-white p-3 rounded-xl"><span className="material-icons-outlined">payments</span></div>
          <button onClick={onCancel} className="text-secondary"><span className="material-icons-outlined">close</span></button>
        </div>
        
        <div>
          <h2 className="text-xl font-bold">Importar desde Excel</h2>
          <p className="text-xs text-secondary">Detectamos automáticamente las hojas "PAGOS" o "CONTROL GENERAL".</p>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-bold">{error}</div>}

        {stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-4 rounded-2xl text-center">
                <div className="text-2xl font-bold text-green-600">{stats.matched}</div>
                <div className="text-[10px] uppercase text-secondary">Vinculados</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl text-center">
                <div className="text-2xl font-bold text-red-500">{stats.ignored.length}</div>
                <div className="text-[10px] uppercase text-secondary">No encontrados</div>
              </div>
            </div>
            <button onClick={() => onComplete(stats.matched)} className="w-full py-4 bg-ios-blue text-white rounded-xl font-bold">ENTENDIDO</button>
          </div>
        ) : (
          <label className="block border-2 border-dashed border-gray-200 rounded-3xl p-10 text-center cursor-pointer hover:bg-blue-50 transition-colors">
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            <span className="material-icons-outlined text-4xl text-gray-400 mb-2">cloud_upload</span>
            <p className="font-bold text-sm">Seleccionar Archivo</p>
            <p className="text-[10px] text-secondary mt-1">Soportamos nombres compuestos y fechas automáticas</p>
          </label>
        )}
      </div>
    </motion.div>
  );
};
