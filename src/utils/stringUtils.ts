// src/utils/stringUtils.ts

/**
 * Normaliza un texto eliminando tildes, convirtiendo a minúsculas y recortando espacios.
 * Útil para búsquedas y comparaciones insensibles a acentos.
 */
export const normalizeText = (text: string | null | undefined): string => {
  if (text === null || text === undefined) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Compara dos textos normalizados y devuelve true si son iguales.
 */
export const normalizedEquals = (a: string | null | undefined, b: string | null | undefined): boolean => {
  return normalizeText(a) === normalizeText(b);
};

/**
 * Verifica si un texto normalizado contiene otro (búsqueda parcial).
 */
export const normalizedContains = (text: string | null | undefined, search: string): boolean => {
  return normalizeText(text).includes(normalizeText(search));
};

/**
 * Busca un alumno por nombre (coincidencia de todas las partes) o por DNI.
 * @param alumnos Lista de alumnos.
 * @param nombre Nombre a buscar.
 * @param dni DNI a buscar (opcional).
 */
export const findStudentByName = (alumnos: any[], nombre: string, dni?: string | null): any | null => {
  const normalizedInputName = normalizeText(nombre);
  const inputParts = normalizedInputName.split(/\s+/).filter(p => p.length > 2);
  const normalizedDni = dni ? dni.toString().replace(/\D/g, '') : null;

  return alumnos.find((a: any) => {
    // Buscar por DNI primero
    if (normalizedDni && a.dni?.toString().replace(/\D/g, '') === normalizedDni) return true;
    // Buscar por nombre completo exacto
    const normalizedAlumnoName = normalizeText(a.nombre);
    if (normalizedAlumnoName === normalizedInputName) return true;
    // Buscar por partes del nombre (todas las palabras deben coincidir)
    if (inputParts.length >= 2) {
      return inputParts.every(part => normalizedAlumnoName.includes(part));
    }
    return false;
  });
};