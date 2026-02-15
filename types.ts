
export type Discipline = 'GAF' | 'GAM' | 'Trampolín' | 'Rítmica';
export type Apparatus = 'Suelo' | 'Viga' | 'Paralelas' | 'Salto' | 'Anillas' | 'Arzones' | 'Barra Fija';
export type SkillStatus = 'No Iniciado' | 'En Proceso' | 'Dominado' | 'Elite';
export type PaymentStatus = 'Al día' | 'Pendiente' | 'Vencido' | 'Exento';

export interface Biometrics {
  fuerza: number;
  flexibilidad: number;
  tecnica: number;
  resistencia: number;
  coordinacion: number;
}

export interface Skill {
  id: string;
  name: string;
  status: SkillStatus;
  apparatus: Apparatus;
  level: number;
}

export interface Alumno {
  id?: number;
  nombre: string;
  dni: string;
  disciplina: Discipline;
  nivel: string;
  fechaIngreso: string;
  estadoPago: PaymentStatus;
  habilidades: Skill[];
  biometria: Biometrics;
  qrCode: string;
  asistenciasHistoricas: number;
  alertas: string[];
}

// Added missing Clase interface referenced in App.tsx
export interface Clase {
  id?: number;
  fecha: string;
  grupo: string;
}

export interface StaffMember {
  id: number;
  nombre: string;
  rol: 'Coach' | 'Admin' | 'Head Coach';
  clockIn?: string;
  isClockedIn: boolean;
}

export interface Evento {
  id: number;
  nombre: string;
  fecha: string;
  tipo: 'Competencia' | 'Gala' | 'Examen';
  inscritos: number;
}

export type ViewMode = 'Hub' | 'Atletas' | 'Progreso' | 'Finanzas' | 'Eventos' | 'Staff' | 'NuevaClase' | 'Config';
