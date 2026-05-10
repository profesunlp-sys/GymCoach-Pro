/**
 * Shared string utility functions for GymCoach-Pro.
 * Centralizes text normalization to avoid duplication across components.
 */

/**
 * Normalizes any value to a lowercase, accent-free, trimmed string.
 * Used for fuzzy name matching and column header detection.
 */
export const normalizeText = (text: unknown): string => {
  if (text === null || text === undefined) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
};

/**
 * Splits a name into meaningful parts (words longer than 2 chars),
 * normalizing accents and commas first.
 */
export const normalizeNameParts = (name: unknown): string[] => {
  return normalizeText(name)
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter((part: string) => part.length > 2);
};

/**
 * Fuzzy student finder: matches by DNI, exact name, or partial word overlap.
 */
export const findStudentByName = <T extends { id: string; nombre: string; dni?: string }>(
  students: T[],
  rawName: unknown
): T | undefined => {
  const normalizedInput = normalizeText(rawName).replace(/,/g, ' ');
  const inputParts = normalizeNameParts(rawName);
  const inputDni = String(rawName ?? '').match(/\b\d{7,9}\b/)?.[0];

  return students.find((student) => {
    const studentName = normalizeText(student.nombre).replace(/,/g, ' ');
    const studentParts = normalizeNameParts(student.nombre);

    const dniMatches = !!inputDni && student.dni === inputDni;
    const exactNameMatches = studentName === normalizedInput;
    const allInputPartsMatch =
      inputParts.length > 0 && inputParts.every((p) => studentName.includes(p));
    const allStudentPartsMatch =
      studentParts.length > 0 && studentParts.every((p) => normalizedInput.includes(p));

    return dniMatches || exactNameMatches || allInputPartsMatch || allStudentPartsMatch;
  });
};
