export const MONTH_LABELS: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
};

const MONTHS_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export function normalizeFullName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getPaymentDocId(studentId: string, year: number, month: number): string {
  return `${studentId}_${year}_${month}`;
}

export function parseMonthValue(value: unknown): number | null {
  if (!value) return null;
  
  const text = normalizeFullName(String(value));
  
  const index = MONTHS_NAMES.findIndex(m => text.includes(m));
  if (index >= 0) return index + 1;

  const num = Number(value);
  if (Number.isInteger(num) && num >= 1 && num <= 12) {
    return num;
  }

  return null;
}

export function detectPaymentStatus(cellValue: unknown): 'confirmed' | 'negative' | 'ambiguous' {
  if (cellValue === null || cellValue === undefined) return 'negative';
  
  const text = normalizeFullName(String(cellValue));
  const num = Number(cellValue);

  const positiveValues = ['si', 'sí', 'x', 'ok', 'pago', 'pagado', 'abonado', 'presente'];
  if (positiveValues.includes(text)) return 'confirmed';
  
  if (!isNaN(num) && num > 0) return 'confirmed';

  const negativeValues = ['no', 'debe', 'pendiente', 'sin pago', '0', 'false', 'nop', 'ausente'];
  if (negativeValues.includes(text)) return 'negative';

  return 'ambiguous';
}