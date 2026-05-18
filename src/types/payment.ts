export type PaymentSource = 'excel' | 'manual';

export interface PaymentRecord {
  id: string;
  studentId: string;
  studentName: string;
  normalizedName: string;
  anio: number;
  mes: number;
  mesLabel: string;
  checked: boolean;
  monto: number;
  source: PaymentSource;
  importId?: string;
  sheetName?: string;
  rowNumber?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface PaymentImportRecord {
  id: string;
  fileName: string;
  createdBy: string;
  createdAt: any;
  selectedYear: number;
  totalRows: number;
  matchedPayments: number;
  unmatchedRows: number;
  duplicatedRows: number;
  ambiguousRows: number;
  status: 'completed' | 'failed';
}

export interface ParsedPaymentRow {
  sheetName: string;
  rowNumber: number;
  rawName: string;
  normalizedName: string;
  year: number;
  month: number;
  amount: number;
  status: 'matched' | 'unmatched' | 'duplicated' | 'ambiguous';
  studentId?: string;
  studentName?: string;
  raw: any[];
}