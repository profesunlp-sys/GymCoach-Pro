
import { Apparatus, Discipline } from './types';

export const SKILL_TREE: Record<Apparatus, string[]> = {
  'Suelo': ['Rol adelante', 'Vertical', 'Rueda', 'Mortero', 'Flic-Flac', 'Salto mortal', 'Doble pirueta'],
  'Viga': ['Caminata Relevé', 'Arabesque', 'Salto Gato', 'Giro 360', 'Vertical', 'Flic-Flac viga'],
  'Paralelas': ['Suspensión', 'Dominada', 'Pasaje piernas', 'Vuelo', 'Gigante', 'Salida C'],
  'Salto': ['Carrera explosiva', 'Pique', 'Mortero', 'Yurchenko', 'Tsukahara'],
  'Anillas': ['Soporte L', 'Dislocación', 'Salida hombros', 'Cristo', 'Plancha'],
  'Arzones': ['Círculos', 'Tijeras', 'Molinos', 'Salida vertical'],
  'Barra Fija': ['Vuelos', 'Kippe', 'Gigantes', 'Tkachev']
};

export const DISCIPLINAS: Discipline[] = ['GAF', 'GAM', 'Trampolín', 'Rítmica'];
export const NIVELES = ['Iniciación', 'Escuela', 'Promocional', 'Nivel 1-3', 'Nivel 4-6', 'Elite'];
