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

export interface ContactoFamilia {
  padreNombre?: string;
  padreTelefono?: string;
  madreNombre?: string;
  madreTelefono?: string;
  familiarNombre?: string;
  familiarTelefono?: string;
  emergenciaNombre?: string;
  emergenciaTelefono?: string;
}

export interface Alumno {
  id?: number;
  nombre: string;
  dni: string;
  disciplina: Discipline;
  nivel: string;
  grupo?: string; 
  fechaNacimiento: string;
  fechaIngreso: string;
  fechaPrimeraClase: string;
  estadoPago: PaymentStatus;
  habilidades: Skill[];
  biometria: Biometrics;
  qrCode: string;
  asistenciasHistoricas: number;
  alertas: string[]; 
  datosFederativos?: string;
  contacto?: ContactoFamilia;
}

export interface AsistenciaRecord {
  id?: number;
  fecha: string; // ISO string date
  alumnoId: number;
  grupo: string;
  presente: boolean;
}

export interface Clase {
  id?: number;
  fecha: string;
  grupo: string;
  horario?: string;
  entrenador?: string;
  warmup?: string[];
  apparatusUsed?: Apparatus[];
  skillsCovered?: string[];
}

export interface GrupoConfig {
  id?: number;
  nombre: string;
  dias: string[];
  horario: string;
}

export type ViewMode = 'Dashboard' | 'Horario' | 'Alumnos' | 'Ajustes' | 'NuevaClase' | 'RegistroAlumno' | 'AsistenciaLista' | 'ReportePDF';
