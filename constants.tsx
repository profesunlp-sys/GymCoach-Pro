
import { Apparatus, Discipline } from './types';

export const SKILL_TREE: Record<Apparatus, { name: string, difficulty: string }[]> = {
  'Suelo': [
    { name: 'Rol adelante', difficulty: 'Basico' },
    { name: 'Vertical', difficulty: 'Basico' },
    { name: 'Rueda', difficulty: 'Basico' },
    { name: 'Mortero', difficulty: 'A' },
    { name: 'Flic-Flac', difficulty: 'A' },
    { name: 'Salto mortal', difficulty: 'A' },
    { name: 'Doble pirueta', difficulty: 'C' },
    { name: 'Triple pirueta', difficulty: 'E' }
  ],
  'Viga': [
    { name: 'Caminata Relevé', difficulty: 'Basico' },
    { name: 'Arabesque', difficulty: 'Basico' },
    { name: 'Salto Gato', difficulty: 'Basico' },
    { name: 'Giro 360', difficulty: 'A' },
    { name: 'Vertical', difficulty: 'A' },
    { name: 'Flic-Flac viga', difficulty: 'B' }
  ],
  'Paralelas': [
    { name: 'Suspensión', difficulty: 'Basico' },
    { name: 'Dominada', difficulty: 'Basico' },
    { name: 'Pasaje piernas', difficulty: 'A' },
    { name: 'Vuelo', difficulty: 'A' },
    { name: 'Gigante', difficulty: 'B' },
    { name: 'Salida C', difficulty: 'C' }
  ],
  'Salto': [
    { name: 'Carrera explosiva', difficulty: 'Basico' },
    { name: 'Pique', difficulty: 'Basico' },
    { name: 'Mortero', difficulty: 'A' },
    { name: 'Yurchenko', difficulty: 'B' },
    { name: 'Tsukahara', difficulty: 'C' }
  ],
  'Anillas': [
    { name: 'Soporte L', difficulty: 'A' },
    { name: 'Dislocación', difficulty: 'A' },
    { name: 'Salida hombros', difficulty: 'B' },
    { name: 'Cristo', difficulty: 'C' },
    { name: 'Plancha', difficulty: 'D' }
  ],
  'Arzones': [
    { name: 'Círculos', difficulty: 'A' },
    { name: 'Tijeras', difficulty: 'A' },
    { name: 'Molinos', difficulty: 'B' },
    { name: 'Salida vertical', difficulty: 'B' }
  ],
  'Barra Fija': [
    { name: 'Vuelos', difficulty: 'A' },
    { name: 'Kippe', difficulty: 'A' },
    { name: 'Gigantes', difficulty: 'B' },
    { name: 'Tkachev', difficulty: 'C' }
  ]
};

export const DISCIPLINAS: Discipline[] = ['GAF', 'GAM', 'Trampolín', 'Rítmica'];
export const NIVELES = ['Iniciación', 'Escuela', 'Promocional', 'Nivel 1-3', 'Nivel 4-6', 'Elite'];
