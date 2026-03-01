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
  id?: string;
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
  id?: string;
  fecha: string; // ISO string date
  alumnoId: string;
  grupo: string;
  presente: boolean;
}

export interface Clase {
  id?: string;
  fecha: string;
  grupo: string;
  horario?: string;
  entrenador?: string;
  faseInicial?: string[];
  fasePrincipal?: string[];
  faseFinal?: string[];
  habilidadesPorAparato?: Record<string, string[]>;
  warmup?: string[]; // Legacy
  apparatusUsed?: string[]; // Legacy
  skillsCovered?: string[]; // Legacy
}

export interface GrupoConfig {
  id?: string;
  nombre: string;
  dias: string[];
  horario: string;
  entrenador?: string;
}

export type UserRole = 'Coach' | 'Coordinator';

export interface Feedback {
  id?: string;
  claseId: string;
  author: string;
  text: string;
  timestamp: string;
}

export type ViewMode = 'Dashboard' | 'Horario' | 'Alumnos' | 'Ajustes' | 'NuevaClase' | 'RegistroAlumno' | 'AsistenciaLista' | 'ReportePDF' | 'ClaseDetalle' | 'Planes' | 'AlumnoDetalle' | 'Profesores' | 'ProfesorDetalle';
