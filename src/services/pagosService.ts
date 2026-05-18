import * as XLSX from 'xlsx';
import { collection, getDocs, query, where, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { normalizeFullName, getPaymentDocId, parseMonthValue, detectPaymentStatus, MONTH_LABELS } from '../utils/paymentUtils';
import type { ParsedPaymentRow } from '../types/payment';

export async function processExcelPreview(
  file: File, 
  selectedYear: number
): Promise<{ rows: ParsedPaymentRow[], stats: any }> {
  
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  
  const alumnosSnap = await getDocs(collection(db, 'alumnos'));
  const studentsMap = new Map<string, { id: string; nombre: string; apellido?: string }>();
  const nameCounts = new Map<string, number>();

  alumnosSnap.docs.forEach(doc => {
    const data = doc.data();
    const fullName = [data.nombre, data.apellido, data.nombreCompleto].filter(Boolean).join(' ');
    const normalizedName = normalizeFullName(fullName);
    
    if (!normalizedName) return;

    const count = nameCounts.get(normalizedName) || 0;
    nameCounts.set(normalizedName, count + 1);
    
    studentsMap.set(normalizedName, {
      id: doc.id,
      nombre: data.nombre,
      apellido: data.apellido
    });
  });

  const parsedRows: ParsedPaymentRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) continue;

    let headerRowIndex = -1;
    let nameColIndex = -1;
    const monthCols: { index: number; month: number }[] = [];

    for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
      const row = jsonData[i];
      const possibleNameIdx = row.findIndex((cell: any) => {
        const txt = normalizeFullName(cell);
        return txt.includes('nombre') || txt.includes('apellido') || txt.includes('alumna');
      });

      const possibleMonths = row.map((cell: any, idx: number) => ({
        idx,
        month: parseMonthValue(cell)
      })).filter((item: any) => item.month !== null) as { idx: number; month: number }[];

      if (possibleNameIdx !== -1 && possibleMonths.length > 0) {
        headerRowIndex = i;
        nameColIndex = possibleNameIdx;
        monthCols.push(...possibleMonths.map(m => ({ index: m.idx, month: m.month })));
        break;
      }
    }

    if (headerRowIndex === -1 || nameColIndex === -1) continue;

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rawName = String(row[nameColIndex] ?? '').trim();
      if (!rawName) continue;

      const normalizedName = normalizeFullName(rawName);
      const student = studentsMap.get(normalizedName);
      const isDuplicate = (nameCounts.get(normalizedName) || 0) > 1;

      monthCols.forEach(({ index: colIdx, month }) => {
        const cellValue = row[colIdx];
        const statusType = detectPaymentStatus(cellValue);

        if (statusType === 'negative') return;

        let finalStatus: ParsedPaymentRow['status'] = 'unmatched';
        let studentId: string | undefined;
        let studentName: string | undefined;

        if (isDuplicate) {
          finalStatus = 'duplicated';
        } else if (statusType === 'ambiguous') {
          finalStatus = 'ambiguous';
          if (student) {
            studentId = student.id;
            studentName = student.nombre;
          }
        } else if (student) {
          finalStatus = 'matched';
          studentId = student.id;
          studentName = student.nombre;
        }

        parsedRows.push({
          sheetName,
          rowNumber: i + 1,
          rawName,
          normalizedName,
          year: selectedYear,
          month,
          amount: typeof cellValue === 'number' ? cellValue : 0,
          status: finalStatus,
          studentId,
          studentName,
          raw: row
        });
      });
    }
  }

  const stats = {
    total: parsedRows.length,
    matched: parsedRows.filter(r => r.status === 'matched').length,
    unmatched: parsedRows.filter(r => r.status === 'unmatched').length,
    duplicated: parsedRows.filter(r => r.status === 'duplicated').length,
    ambiguous: parsedRows.filter(r => r.status === 'ambiguous').length,
  };

  return { rows: parsedRows, stats };
}

export async function savePaymentsAndAudit(
  rows: ParsedPaymentRow[],
  fileName: string,
  userEmail: string,
  selectedYear: number
) {
  const batch = writeBatch(db);
  const importId = `import_${Date.now()}`;
  
  const matchedRows = rows.filter(r => r.status === 'matched');
  const problemRows = rows.filter(r => r.status !== 'matched');

  for (const row of matchedRows) {
    if (!row.studentId) continue;
    
    const pagoRef = doc(db, 'pagos', getPaymentDocId(row.studentId, row.year, row.month));
    
    batch.set(pagoRef, {
      id: getPaymentDocId(row.studentId, row.year, row.month),
      studentId: row.studentId,
      studentName: row.studentName || row.rawName,
      normalizedName: row.normalizedName,
      anio: row.year,
      mes: row.month,
      mesLabel: MONTH_LABELS[row.month],
      checked: true,
      monto: row.amount,
      source: 'excel',
      importId,
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  for (const row of problemRows) {
    const rowRef = doc(collection(db, 'paymentImportRows'));
    const cleanRaw = Array.isArray(row.raw)
      ? row.raw.map((val: unknown) => val === undefined ? null : val)
      : row.raw ?? null;

    batch.set(rowRef, {
      importId,
      status: row.status || null,
      rawName: row.rawName || null,
      normalizedName: row.normalizedName || null,
      sheetName: row.sheetName || null,
      rowNumber: row.rowNumber ?? null,
      year: row.year ?? null,
      month: row.month ?? null,
      mesLabel: MONTH_LABELS[row.month] || 'Desconocido',
      studentId: row.studentId || null,
      raw: cleanRaw,
      createdAt: serverTimestamp()
    });
  }

  const importRef = doc(db, 'paymentImports', importId);
  batch.set(importRef, {
    id: importId,
    fileName,
    createdBy: userEmail,
    createdAt: serverTimestamp(),
    selectedYear,
    totalRows: rows.length,
    matchedPayments: matchedRows.length,
    unmatchedRows: rows.filter(r => r.status === 'unmatched').length,
    duplicatedRows: rows.filter(r => r.status === 'duplicated').length,
    ambiguousRows: rows.filter(r => r.status === 'ambiguous').length,
    status: 'completed'
  });

  await batch.commit();
  return importId;
}

export async function rebuildStudentsFromExcel(file: File) {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const newStudentsSet = new Map<string, string>();

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (!jsonData.length) continue;

    let headerRowIndex = -1;
    let nameColIndex = -1;
    let categoryColIndex = -1;

    for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
      const row = jsonData[i];
      if (!Array.isArray(row)) continue;

      if (nameColIndex === -1) {
        nameColIndex = row.findIndex((c: any) => {
          const t = normalizeFullName(c);
          return t.includes('nombre') || t.includes('alumna') || t.includes('apellido');
        });
      }

      if (categoryColIndex === -1) {
        categoryColIndex = row.findIndex((c: any) => {
          const t = normalizeFullName(c);
          return t.includes('categoria') || t.includes('categoría') || t.includes('grupo') || t.includes('especialidad');
        });
      }

      if (nameColIndex !== -1) {
        headerRowIndex = i;
      }

      if (headerRowIndex !== -1 && categoryColIndex !== -1) {
        break;
      }
    }

    if (nameColIndex === -1) continue;

    const sheetMatchesCategory = normalizeFullName(sheetName).includes('gim') || normalizeFullName(sheetName).includes('artistica');

    for (let rowIndex = headerRowIndex + 1; rowIndex < jsonData.length; rowIndex++) {
      const row = jsonData[rowIndex];
      if (!Array.isArray(row)) continue;

      const rawName = String(row[nameColIndex] ?? '').trim();
      if (!rawName) continue;

      let includeRow = false;
      if (categoryColIndex !== -1) {
        const categoryValue = String(row[categoryColIndex] ?? '');
        const normalizedCategory = normalizeFullName(categoryValue);
        includeRow = normalizedCategory.includes('gim') || normalizedCategory.includes('artistica');
      } else if (sheetMatchesCategory) {
        includeRow = true;
      } else {
        const rowText = row.map((cell: any) => String(cell ?? '')).join(' ');
        const normalizedRowText = normalizeFullName(rowText);
        includeRow = normalizedRowText.includes('gim') || normalizedRowText.includes('artistica');
      }

      if (!includeRow) continue;

      const normalizedName = normalizeFullName(rawName);
      if (!normalizedName) continue;

      if (!newStudentsSet.has(normalizedName)) {
        newStudentsSet.set(normalizedName, rawName);
      }
    }
  }

  const alumnosSnap = await getDocs(collection(db, 'alumnos'));
  if (!alumnosSnap.empty) {
    let deleteBatch = writeBatch(db);
    let deleteCount = 0;

    for (const alumnoDoc of alumnosSnap.docs) {
      deleteBatch.delete(alumnoDoc.ref);
      deleteCount++;

      if (deleteCount >= 400) {
        await deleteBatch.commit();
        deleteBatch = writeBatch(db);
        deleteCount = 0;
      }
    }

    if (deleteCount > 0) {
      await deleteBatch.commit();
    }
  }

  let created = 0;
  let insertBatch = writeBatch(db);
  let insertCount = 0;

  for (const [normalizedName, originalName] of newStudentsSet) {
    const newRef = doc(collection(db, 'alumnos'));
    insertBatch.set(newRef, {
      nombre: originalName,
      nombreNormalizado: normalizedName,
      activo: true,
      origen: 'excel_rebuild',
      createdAt: serverTimestamp()
    });
    created++;
    insertCount++;

    if (insertCount >= 400) {
      await insertBatch.commit();
      insertBatch = writeBatch(db);
      insertCount = 0;
    }
  }

  if (insertCount > 0) {
    await insertBatch.commit();
  }

  return { creados: created };
  } catch (error) {
    return { creados: 0, error: (error as Error).message };
  }
}