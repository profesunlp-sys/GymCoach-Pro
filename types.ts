
export type AgeGroup = '3 a 5 años' | '6 a 9 años' | '10 a 15 años';

export type Apparatus = 'Viga de equilibrio' | 'Paralelas asimétricas' | 'Suelo' | 'Salto';

export interface ClassRecord {
  date: string;
  ageGroups: AgeGroup[];
  warmupSkills: string[];
  apparatus: Apparatus[];
  apparatusDetails: Record<Apparatus, string[]>;
}

export enum Step {
  AgeGroup = 1,
  Warmup = 2,
  ApparatusSelection = 3,
  ApparatusDetails = 4,
  Summary = 5,
  Success = 6
}
