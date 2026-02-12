
export type AgeGroup = '3 a 5 años' | '6 a 9 años' | '10 a 15 años';

export type Apparatus = 'Viga de equilibrio' | 'Paralelas asimétricas' | 'Suelo' | 'Salto';

export interface ClassRecord {
  date: string;
  day: string;
  month: string;
  groupName: string;
  schedule: string;
  daysOfWeek: string[];
  ageGroups: AgeGroup[];
  attendance: { name: string; present: boolean }[];
  warmupSkills: string[];
  apparatus: Apparatus[];
  apparatusDetails: Record<Apparatus, string[]>;
}

export enum Step {
  GroupInfo = 0,
  AgeGroup = 1,
  Attendance = 2,
  Warmup = 3,
  ApparatusSelection = 4,
  ApparatusDetails = 5,
  Summary = 6,
  Success = 7
}

export type ViewMode = 'Registro' | 'Estadisticas';

export interface HistoryEntry {
  date: string;
  group: string;
  ageGroups: string[];
  presentCount: number;
  warmup: string[];
  apparatus: string[];
  details: Record<string, string[]>;
}
