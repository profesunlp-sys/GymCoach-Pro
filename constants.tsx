
import { AgeGroup, Apparatus } from './types';

export const AGE_GROUPS: AgeGroup[] = ['3 a 5 años', '6 a 9 años', '10 a 15 años'];

export const DEFAULT_WARMUP_SKILLS = [
  'Elongación',
  'Postura',
  'Saltabilidad',
  'Equilibrio',
  'Articulaciones',
  'Fuerza Core'
];

export const APPARATUS_OPTIONS: Apparatus[] = [
  'Viga de equilibrio',
  'Paralelas asimétricas',
  'Suelo',
  'Salto'
];

export const SUGGESTED_SKILLS: Record<Apparatus, string[]> = {
  'Viga de equilibrio': ['Caminata', 'Giro', 'Salto de gato', 'Arabeque'],
  'Paralelas asimétricas': ['Suspensión', 'Salida', 'Dominada', 'Vuelo'],
  'Suelo': ['Rol adelante', 'Rueda', 'Vertical', 'Mortero'],
  'Salto': ['Mortero', 'Rondo', 'Media Luna', 'Pasaje']
};
