
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clase, GrupoConfig, ViewMode, Alumno, Discipline, Apparatus, SkillStatus } from '../../types';
import { User } from 'firebase/auth';
import { Button } from '../../App';
import { SKILL_TREE, DISCIPLINAS, NIVELES } from '../../constants';

interface ClasesProps {
  vista: ViewMode;
  setVista: (vista: ViewMode) => void;
  registrationStep: number;
  setRegistrationStep: (step: number) => void;
  isEditingClase: boolean;
  setIsEditingClase: (val: boolean) => void;
  setEditingClaseId: (id: string | null) => void;
  editingClaseId: string | null;
  claseGrupo: string;
  setClaseGrupo: (grupo: string) => void;
  grupos: GrupoConfig[];
  alumnos: Alumno[];
  asistenciasHoy: Record<string, boolean>;
  toggleAttendance: (alumnoId: string) => void;
  userRole: string;
  user: any;
  handleSaveManualClass: () => void;
  faseInicialDuration: string;
  setFaseInicialDuration: (val: string) => void;
  faseInicial: string[];
  setFaseInicial: React.Dispatch<React.SetStateAction<string[]>>;
  customInicial: string;
  setCustomInicial: (val: string) => void;
  fasePrincipalDuration: string;
  setFasePrincipalDuration: (val: string) => void;
  fasePrincipal: string[];
  setFasePrincipal: React.Dispatch<React.SetStateAction<string[]>>;
  habilidadesPorAparato: Record<string, string[]>;
  setHabilidadesPorAparato: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  customHabilidad: Record<string, string>;
  setCustomHabilidad: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  faseFinalDuration: string;
  setFaseFinalDuration: (val: string) => void;
  faseFinal: string[];
  setFaseFinal: React.Dispatch<React.SetStateAction<string[]>>;
  customFinal: string;
  setCustomFinal: (val: string) => void;
  claseObjetivos: string;
  setClaseObjetivos: (val: string) => void;
  claseObservaciones: string;
  setClaseObservaciones: (val: string) => void;
  claseAgeRange: string;
  setClaseAgeRange: (val: string) => void;
  selectedClase: Clase | null;
  setSelectedClase: (clase: Clase | null) => void;
  clases: Clase[];
  planesFilterDate: string;
  setPlanesFilterDate: (val: string) => void;
  planesFilterCoach: string;
  setPlanesFilterCoach: (val: string) => void;
  handleDeleteClase: (clase: Clase) => void;
  handleEditClase: (clase: Clase) => void;
  handleNavigation: (vista: ViewMode) => void;
  setNotificacion: (notif: { t: string, d: string } | null) => void;
  disciplinas: { id?: string, nombre: string }[];
  warmupOptions: { id?: string, nombre: string }[];
  cooldownOptions: { id?: string, nombre: string }[];
  handleSaveWarmupOption: (name: string) => void;
  handleUpdateWarmupOption: (id: string, name: string) => void;
  handleDeleteWarmupOption: (id: string) => void;
  handleSaveCooldownOption: (name: string) => void;
  handleUpdateCooldownOption: (id: string, name: string) => void;
  handleDeleteCooldownOption: (id: string) => void;
}

export const Clases: React.FC<ClasesProps> = ({
  vista,
  setVista,
  registrationStep,
  setRegistrationStep,
  isEditingClase,
  setIsEditingClase,
  setEditingClaseId,
  claseGrupo,
  setClaseGrupo,
  grupos,
  alumnos,
  asistenciasHoy,
  toggleAttendance,
  userRole,
  user,
  handleSaveManualClass,
  faseInicialDuration,
  setFaseInicialDuration,
  faseInicial,
  setFaseInicial,
  customInicial,
  setCustomInicial,
  fasePrincipalDuration,
  setFasePrincipalDuration,
  fasePrincipal,
  setFasePrincipal,
  habilidadesPorAparato,
  setHabilidadesPorAparato,
  customHabilidad,
  setCustomHabilidad,
  faseFinalDuration,
  setFaseFinalDuration,
  faseFinal,
  setFaseFinal,
  customFinal,
  setCustomFinal,
  claseObjetivos,
  setClaseObjetivos,
  claseObservaciones,
  setClaseObservaciones,
  claseAgeRange,
  setClaseAgeRange,
  selectedClase,
  setSelectedClase,
  clases,
  planesFilterDate,
  setPlanesFilterDate,
  planesFilterCoach,
  setPlanesFilterCoach,
  handleDeleteClase,
  handleEditClase,
  handleNavigation,
  setNotificacion,
  disciplinas,
  warmupOptions,
  cooldownOptions,
  handleSaveWarmupOption,
  handleUpdateWarmupOption,
  handleDeleteWarmupOption,
  handleSaveCooldownOption,
  handleUpdateCooldownOption,
  handleDeleteCooldownOption
}) => {
  if (vista === 'NuevaClase') {
    return (
      <div className="min-h-screen bg-ios-gray space-y-0 page-transition pt-4 pb-24">
        {/* Apple Style Header */}
        <header className="px-6 flex items-center justify-between mb-2">
          <button 
            onClick={() => {
              if (registrationStep > 1) {
                setRegistrationStep(registrationStep - 1);
              } else {
                setVista('Dashboard');
                setIsEditingClase(false);
                setEditingClaseId(null);
              }
            }} 
            className="text-primary font-medium flex items-center gap-1 active:scale-95 transition-all"
          >
            <span className="material-icons-outlined text-lg">arrow_back_ios</span>
            <span>Atrás</span>
          </button>
          
          <div className="flex-1 text-center">
            <h2 className="text-black font-bold text-lg tracking-tight">{isEditingClase ? 'Editar' : 'Nueva'} Clase</h2>
          </div>

          <div className="w-16"> {/* Spacer */}</div>
        </header>

        {/* Progress Bar */}
        <div className="px-6 mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Paso {registrationStep} de 6</span>
            <span className="text-[10px] font-bold text-primary">{Math.round((registrationStep/6)*100)}%</span>
          </div>
          <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(registrationStep/6)*100}%` }}
              className="h-full bg-primary"
            />
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {/* Paso 1: Selección de Grupo */}
          {registrationStep === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 space-y-6"
            >
              <h3 className="text-2xl font-bold text-black tracking-tight mb-4">¿Con qué grupo entrenamos hoy?</h3>
              <div className="space-y-3">
                {grupos
                  .filter(g => userRole === 'Coordinator' || !user?.displayName || g.entrenador === user.displayName)
                  .map(g => (
                  <button 
                    key={g.id}
                    onClick={() => setClaseGrupo(g.nombre)}
                    className={`w-full p-5 rounded-2xl border transition-all text-left flex items-center justify-between ${
                      claseGrupo === g.nombre 
                        ? 'border-primary bg-white shadow-ios ring-1 ring-primary/20' 
                        : 'border-black/5 bg-white shadow-sm hover:border-black/10'
                    }`}
                  >
                    <div>
                      <span className={`text-lg font-bold block ${claseGrupo === g.nombre ? 'text-primary' : 'text-black'}`}>
                        {g.nombre}
                      </span>
                      <span className="text-xs text-secondary font-medium">
                        {g.horario}
                      </span>
                    </div>
                    {claseGrupo === g.nombre && (
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <span className="material-icons-outlined text-white text-sm">check</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Paso 2: Rango de Edad */}
          {registrationStep === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 space-y-6"
            >
              <h3 className="text-2xl font-bold text-black tracking-tight mb-4">Rango de edad del grupo</h3>
              <div className="space-y-4">
                {[
                  { range: "3 a 5 años", emoji: "👶" },
                  { range: "6 a 9 años", emoji: "🧒" },
                  { range: "10 a 15 años", emoji: "👦" }
                ].map((item) => (
                  <button 
                    key={item.range}
                    onClick={() => setClaseAgeRange(item.range)}
                    className={`w-full p-6 rounded-2xl border transition-all text-left flex items-center justify-between ${
                      claseAgeRange === item.range 
                        ? 'border-primary bg-white shadow-ios ring-1 ring-primary/20' 
                        : 'border-black/5 bg-white shadow-sm'
                    }`}
                  >
                    <span className={`text-xl font-bold ${claseAgeRange === item.range ? 'text-primary' : 'text-secondary'}`}>
                      {item.range}
                    </span>
                    <span className="text-3xl">{item.emoji}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Paso 3: Asistencia */}
          {registrationStep === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 space-y-6"
            >
              <div className="flex justify-between items-end">
                <h3 className="text-2xl font-bold text-black tracking-tight">Asistencia del día</h3>
                <span className="text-sm font-bold text-primary mb-1">
                  {Object.values(asistenciasHoy).filter(Boolean).length} / {alumnos.filter(a => a.grupo === claseGrupo).length} presentes
                </span>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border border-black/5 divide-y divide-black/5">
                {alumnos.filter(a => a.grupo === claseGrupo).map(alumno => (
                  <div 
                    key={alumno.id}
                    onClick={() => alumno.id && toggleAttendance(alumno.id)}
                    className="p-5 flex items-center justify-between cursor-pointer active:bg-black/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${alumno.id && asistenciasHoy[alumno.id] ? 'bg-primary/10 text-primary' : 'bg-ios-gray text-secondary'}`}>
                        <span className="material-icons-outlined text-xl">{alumno.id && asistenciasHoy[alumno.id] ? 'check' : 'person'}</span>
                      </div>
                      <span className={`text-base font-semibold ${alumno.id && asistenciasHoy[alumno.id] ? 'text-black' : 'text-secondary'}`}>{alumno.nombre}</span>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${alumno.id && asistenciasHoy[alumno.id] ? 'bg-primary border-primary' : 'border-black/10'}`}>
                      {alumno.id && asistenciasHoy[alumno.id] && <span className="material-icons-outlined text-white text-[14px]">check</span>}
                    </div>
                  </div>
                ))}
                {alumnos.filter(a => a.grupo === claseGrupo).length === 0 && (
                  <div className="p-10 text-center text-secondary text-sm italic">
                    Sin alumnos en este grupo.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Paso 4: Aparatos */}
          {registrationStep === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 space-y-6"
            >
              <h3 className="text-2xl font-bold text-black tracking-tight">Aparatos trabajados</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: "Viga", icon: "horizontal_rule" },
                  { name: "Paralelas Asimétricas", icon: "reorder" },
                  { name: "Suelo", icon: "check_box_outline_blank" },
                  { name: "Salto", icon: "arrow_upward" }
                ].map((opt) => (
                  <button 
                    key={opt.name}
                    onClick={() => setFasePrincipal(prev => prev.includes(opt.name) ? prev.filter(o => o !== opt.name) : [...prev, opt.name])}
                    className={`relative p-6 rounded-3xl border transition-all aspect-square flex flex-col items-center justify-center gap-3 ${
                      fasePrincipal.includes(opt.name) 
                        ? 'border-primary bg-white shadow-ios ring-1 ring-primary/20' 
                        : 'border-black/5 bg-white shadow-sm'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${fasePrincipal.includes(opt.name) ? 'bg-primary/10 text-primary' : 'bg-ios-gray text-secondary'}`}>
                      <span className="material-icons-outlined text-2xl">{opt.icon}</span>
                    </div>
                    <span className="text-sm font-bold text-black text-center">{opt.name}</span>
                    
                    <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${fasePrincipal.includes(opt.name) ? 'bg-primary border-primary' : 'border-black/10'}`}>
                      {fasePrincipal.includes(opt.name) && <span className="material-icons-outlined text-white text-[12px]">check</span>}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Paso 5: Habilidades y Observaciones */}
          {registrationStep === 5 && (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 space-y-6"
            >
              <h3 className="text-2xl font-bold text-black tracking-tight">Detalles del entrenamiento</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest px-1">Habilidades trabajadas</label>
                  <textarea 
                    value={claseObjetivos}
                    onChange={(e) => setClaseObjetivos(e.target.value)}
                    className="w-full bg-white border border-black/10 rounded-2xl p-5 text-sm min-h-[120px] shadow-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Ej: Roles, verticales, enlace en viga..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-secondary uppercase tracking-widest px-1">Observaciones generales</label>
                  <textarea 
                    value={claseObservaciones}
                    onChange={(e) => setClaseObservaciones(e.target.value)}
                    className="w-full bg-white border border-black/10 rounded-2xl p-5 text-sm min-h-[120px] shadow-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Notas sobre el comportamiento o desempeño del grupo..."
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Paso 6: Resumen */}
          {registrationStep === 6 && (
            <motion.div 
              key="step6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 space-y-6"
            >
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-16 h-16 bg-ios-green/10 text-ios-green rounded-full flex items-center justify-center mb-2">
                  <span className="material-icons-outlined text-3xl">task_alt</span>
                </div>
                <h3 className="text-xl font-bold text-black tracking-tight">Resumen de clase</h3>
                <p className="text-secondary text-sm">Verificá los datos antes de guardar</p>
              </div>

              <div className="bg-white rounded-3xl shadow-ios border border-black/5 overflow-hidden">
                <div className="divide-y divide-black/5 p-2">
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm font-medium text-secondary">Grupo</span>
                    <span className="text-sm font-bold text-black">{claseGrupo}</span>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm font-medium text-secondary">Fecha</span>
                    <span className="text-sm font-bold text-black">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm font-medium text-secondary">Rango de edad</span>
                    <span className="text-sm font-bold text-primary">{claseAgeRange || 'No especificado'}</span>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm font-medium text-secondary">Asistencia</span>
                    <span className="text-sm font-bold text-black">{Object.values(asistenciasHoy).filter(Boolean).length} presentes</span>
                  </div>
                  <div className="p-4">
                    <span className="text-sm font-medium text-secondary block mb-2">Aparatos</span>
                    <div className="flex flex-wrap gap-2">
                      {fasePrincipal.length > 0 ? fasePrincipal.map(a => (
                        <span key={a} className="px-3 py-1 bg-ios-gray text-black text-[10px] font-bold rounded-full">{a}</span>
                      )) : <span className="text-sm font-bold text-black">-</span>}
                    </div>
                  </div>
                  <div className="p-4">
                    <span className="text-sm font-medium text-secondary block mb-1">Habilidades</span>
                    <p className="text-sm text-black line-clamp-2">{claseObjetivos || '-'}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Footer Navigation Button */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-ios-gray via-ios-gray/95 to-transparent z-40">
          <Button 
            onClick={() => {
              if (registrationStep === 1 && !claseGrupo) {
                setNotificacion({ t: "Error", d: "Seleccioná un grupo." });
                setTimeout(() => setNotificacion(null), 3000);
                return;
              }
              if (registrationStep === 6) {
                handleSaveManualClass();
              } else {
                setRegistrationStep(registrationStep + 1);
              }
            }}
            className="w-full !py-6 !rounded-[2rem] text-sm tracking-[0.1em] shadow-lg active:scale-95 transition-all"
          >
            {registrationStep === 6 ? 'Guardar Clase' : 'Continuar'}
          </Button>
        </div>
      </div>
    );
  }

  if (vista === 'ClaseDetalle' && selectedClase) {
    return (
      <div className="px-6 py-8 space-y-8 page-transition pb-24">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setVista('HistorialClases')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
              <span className="material-icons-outlined">arrow_back</span>
            </button>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Detalle de Clase</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">{selectedClase.grupo} • {new Date(selectedClase.fecha).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => handleEditClase(selectedClase)}
              className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 active:scale-90 transition-all"
            >
              <span className="material-icons-outlined">edit</span>
            </button>
            <button 
              onClick={() => handleDeleteClase(selectedClase)}
              className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20 active:scale-90 transition-all"
            >
              <span className="material-icons-outlined">delete</span>
            </button>
          </div>
        </header>

        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Calor</p>
                <p className="text-sm font-black text-primary">{selectedClase.faseInicialDuration || '0'}m</p>
              </div>
              <div className="text-center p-3 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Principal</p>
                <p className="text-sm font-black text-primary">{selectedClase.fasePrincipalDuration || '0'}m</p>
              </div>
              <div className="text-center p-3 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Final</p>
                <p className="text-sm font-black text-primary">{selectedClase.faseFinalDuration || '0'}m</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-neon-cyan"></span>
                  Entrada en Calor
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedClase.faseInicial?.map((act, i) => (
                    <span key={i} className="text-[10px] font-bold text-white/80 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">{act}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-neon-cyan"></span>
                  Fase Principal
                </h4>
                <div className="space-y-4">
                  {selectedClase.fasePrincipal?.map((aparato, i) => (
                    <div key={i} className="space-y-2 pl-3 border-l border-white/10">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">{aparato}</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedClase.habilidadesPorAparato?.[aparato]?.map((hab, j) => (
                          <span key={j} className="text-[10px] font-bold text-white/80 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">{hab}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-neon-cyan"></span>
                  Vuelta a la calma
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedClase.faseFinal?.map((act, i) => (
                    <span key={i} className="text-[10px] font-bold text-white/80 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">{act}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Objetivos Logrados</h4>
            <p className="text-xs text-white/80 leading-relaxed italic">
              {selectedClase.objetivos || 'No se registraron objetivos específicos.'}
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Observaciones</h4>
            <p className="text-xs text-white/80 leading-relaxed italic">
              {selectedClase.observaciones || 'Sin observaciones adicionales.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (vista === 'HistorialClases' || vista === 'Clases') {
    return (
      <div className="px-6 py-8 space-y-8 page-transition pb-24">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => handleNavigation('Dashboard')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
              <span className="material-icons-outlined">arrow_back</span>
            </button>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Historial</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Planificaciones Guardadas</p>
            </div>
          </div>
          <button 
            onClick={() => handleNavigation('NuevaClase')}
            className="w-10 h-10 rounded-full bg-primary shadow-neon-cyan flex items-center justify-center text-antigravity-black active:scale-90 transition-all"
          >
            <span className="material-icons-outlined">add</span>
          </button>
        </header>

        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          <div className="relative flex-1 min-w-[140px]">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">calendar_today</span>
            <input 
              type="date" 
              value={planesFilterDate}
              onChange={(e) => setPlanesFilterDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[10px] text-white font-bold uppercase tracking-widest outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <div className="relative flex-1 min-w-[140px]">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">person</span>
            <select 
              value={planesFilterCoach}
              onChange={(e) => setPlanesFilterCoach(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[10px] text-white font-bold uppercase tracking-widest outline-none focus:border-primary/50 transition-all appearance-none"
            >
              <option value="Todos">Todos</option>
              {Array.from(new Set(clases.map(c => c.entrenador).filter(Boolean))).map(coach => (
                <option key={coach} value={coach || ""}>{coach}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {clases
            .filter(c => {
              const matchesDate = planesFilterDate ? c.fecha.startsWith(planesFilterDate) : true;
              const matchesCoach = planesFilterCoach === 'Todos' ? true : c.entrenador === planesFilterCoach;
              return matchesDate && matchesCoach;
            })
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
            .map(clase => (
            <div 
              key={clase.id} 
              onClick={() => { setSelectedClase(clase); setVista('ClaseDetalle'); }}
              className="glass-card p-5 rounded-3xl border border-white/5 hover:border-primary/30 transition-all group cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-antigravity-charcoal flex flex-col items-center justify-center border border-white/5 group-hover:border-primary/30 transition-all">
                    <span className="text-xs font-black text-white leading-none">{new Date(clase.fecha).getDate()}</span>
                    <span className="text-[8px] font-black text-primary uppercase tracking-tighter">{new Date(clase.fecha).toLocaleString('default', { month: 'short' })}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{clase.grupo}</h4>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">{clase.entrenador || 'Coach Pro'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {clase.fasePrincipal?.slice(0, 2).map((aparato, i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-primary shadow-neon-cyan"></span>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mb-4">
                {clase.fasePrincipal?.map((aparato, i) => (
                  <span key={i} className="text-[8px] font-black text-white/60 bg-white/5 px-2 py-1 rounded-md border border-white/5 uppercase tracking-widest">{aparato}</span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="material-icons-outlined text-[12px] text-primary">schedule</span>
                    <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
                      {parseInt(clase.faseInicialDuration || '0') + parseInt(clase.fasePrincipalDuration || '0') + parseInt(clase.faseFinalDuration || '0')} min
                    </span>
                  </div>
                </div>
                <span className="material-icons-outlined text-primary text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </div>
            </div>
          ))}

          {clases.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 glass-card rounded-[2.5rem] border-dashed border-white/10 mx-2">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/5 shadow-inner">
                <span className="material-icons-outlined text-white/10 text-4xl">history_edu</span>
              </div>
              <div className="space-y-2 px-8">
                <h3 className="text-white font-black text-lg uppercase tracking-tight leading-tight">Sin Historial</h3>
                <p className="text-white/40 text-xs leading-relaxed">Todavía no has registrado ninguna clase en GymCoach Pro.</p>
              </div>
              <button 
                onClick={() => handleNavigation('NuevaClase')}
                className="px-8 py-4 bg-primary text-antigravity-black font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-neon-cyan hover:scale-105 active:scale-95 transition-all"
              >
                Registrar Primera Clase
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
