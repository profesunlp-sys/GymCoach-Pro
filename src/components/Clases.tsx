
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
      <div className="space-y-8 page-transition pt-8 px-6 pb-24">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => {
                if (registrationStep > 1) {
                  setRegistrationStep(registrationStep - 1);
                } else {
                  setVista('Dashboard');
                  setIsEditingClase(false);
                  setEditingClaseId(null);
                }
              }} 
              variant="secondary"
              className="w-10 h-10 !p-0 rounded-full"
            >
              <span className="material-icons-outlined">arrow_back</span>
            </Button>
            <div>
              <h2 className="text-white font-black text-2xl uppercase tracking-tighter">{isEditingClase ? 'Editar Clase' : 'Nueva Clase'}</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest">Paso {registrationStep} de 6</p>
            </div>
          </div>
          <div className="flex gap-2">
            {registrationStep < 6 ? (
              <Button 
                onClick={() => {
                  if (registrationStep === 1 && !claseGrupo) {
                    setNotificacion({ t: "Error", d: "Por favor selecciona un grupo." });
                    setTimeout(() => setNotificacion(null), 3000);
                    return;
                  }
                  setRegistrationStep(registrationStep + 1);
                }}
                className="px-6 shadow-neon-cyan"
              >
                Siguiente
              </Button>
            ) : (
              <Button 
                onClick={handleSaveManualClass}
                className="px-6 shadow-neon-cyan"
              >
                Finalizar
              </Button>
            )}
          </div>
        </header>

        {/* Indicador de Pasos */}
        <div className="flex gap-2 px-1">
          {[1, 2, 3, 4, 5, 6].map(step => (
            <div 
              key={step} 
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${step <= registrationStep ? 'bg-primary shadow-neon-cyan' : 'bg-white/10'}`}
            />
          ))}
        </div>
        
        <AnimatePresence mode="wait">
          {/* Paso 1: Selección de Grupo */}
          {registrationStep === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em]">¿Con qué grupo entrenamos hoy?</label>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {grupos
                    .filter(g => userRole === 'Coordinator' || !user?.displayName || g.entrenador === user.displayName)
                    .map(g => (
                    <button 
                      key={g.id}
                      onClick={() => setClaseGrupo(g.nombre)}
                      className={`glass-card p-6 rounded-3xl border transition-all text-left flex items-center justify-between ${
                        claseGrupo === g.nombre 
                          ? 'border-primary bg-primary/10 shadow-neon-cyan scale-[1.02]' 
                          : 'border-white/5 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div>
                        <span className={`text-lg font-bold block ${claseGrupo === g.nombre ? 'text-primary' : 'text-white'}`}>
                          {g.nombre}
                        </span>
                        <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest">
                          {g.horario}
                        </span>
                      </div>
                      {claseGrupo === g.nombre && (
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <span className="material-icons-outlined text-antigravity-black text-sm">check</span>
                        </div>
                      )}
                    </button>
                  ))}
                  {grupos.length === 0 && (
                    <div className="p-10 text-center glass-card rounded-3xl border-dashed border-white/10 italic text-white/40 text-sm">
                      No tienes grupos creados aún.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Paso 2: Asistencia */}
          {registrationStep === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em]">Marcar presentes</label>
                  <button 
                    onClick={() => setVista('RegistroAlumno')}
                    className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1"
                  >
                    <span className="material-icons-outlined text-sm">person_add</span>
                    Nuevo Alumno
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                  {alumnos.filter(a => a.grupo === claseGrupo).map(alumno => (
                    <button 
                      key={alumno.id}
                      onClick={() => alumno.id && toggleAttendance(alumno.id)}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        alumno.id && asistenciasHoy[alumno.id] 
                          ? 'bg-primary/10 border-primary shadow-neon-cyan' 
                          : 'bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${alumno.id && asistenciasHoy[alumno.id] ? 'bg-primary text-antigravity-black' : 'bg-white/10 text-white/40'}`}>
                          <span className="material-icons-outlined text-sm">{alumno.id && asistenciasHoy[alumno.id] ? 'check' : 'person'}</span>
                        </div>
                        <span className={`text-sm font-bold ${alumno.id && asistenciasHoy[alumno.id] ? 'text-white' : 'text-white/60'}`}>{alumno.nombre}</span>
                      </div>
                      {alumno.id && asistenciasHoy[alumno.id] && (
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Presente</span>
                      )}
                    </button>
                  ))}
                  {alumnos.filter(a => a.grupo === claseGrupo).length === 0 && (
                    <div className="p-10 text-center glass-card rounded-3xl border-dashed border-white/10 italic text-white/40 text-sm">
                      No hay alumnos registrados en este grupo.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Paso 3: Entrada en Calor */}
          {registrationStep === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Entrada en calor</label>
                  <div className="flex items-center gap-2 bg-antigravity-charcoal px-3 py-1 rounded-full border border-white/5">
                    <span className="material-icons-outlined text-[14px] text-white/70">schedule</span>
                    <input 
                      type="number" 
                      value={faseInicialDuration} 
                      onChange={(e) => setFaseInicialDuration(e.target.value)}
                      className="w-12 bg-transparent text-[10px] text-white font-bold outline-none text-center" 
                    />
                    <span className="text-[8px] text-white/80 uppercase font-black">min</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {warmupOptions.map(opt => (
                    <div key={opt.id || opt.nombre} className="relative group">
                      <button 
                        onClick={() => setFaseInicial(prev => prev.includes(opt.nombre) ? prev.filter(o => o !== opt.nombre) : [...prev, opt.nombre])}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${faseInicial.includes(opt.nombre) ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-antigravity-charcoal text-white/70 border border-white/5'}`}
                      >
                        {opt.nombre}
                      </button>
                      {opt.id && (
                        <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newName = prompt("Editar opción:", opt.nombre);
                              if (newName && newName.trim() && newName !== opt.nombre) {
                                handleUpdateWarmupOption(opt.id!, newName.trim());
                              }
                            }}
                            className="w-5 h-5 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-[10px]"
                          >
                            <span className="material-icons-outlined text-[10px]">edit</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWarmupOption(opt.id!);
                            }}
                            className="w-5 h-5 rounded-full bg-rose-500/20 backdrop-blur-md flex items-center justify-center text-rose-500 text-[10px]"
                          >
                            <span className="material-icons-outlined text-[10px]">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input 
                    type="text" 
                    value={customInicial} 
                    onChange={(e) => setCustomInicial(e.target.value)} 
                    placeholder="Añadir actividad personalizada..." 
                    className="flex-1 crafted-input !py-2 !text-[10px]"
                  />
                  <button 
                    onClick={() => { 
                      if(customInicial) { 
                        handleSaveWarmupOption(customInicial);
                        setFaseInicial(prev => [...prev, customInicial]); 
                        setCustomInicial(""); 
                      } 
                    }}
                    className="bg-white/10 text-white px-3 rounded-xl text-[10px] font-bold"
                  >
                    +
                  </button>
                </div>
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
              className="space-y-6"
            >
              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Fase Principal (Aparatos)</label>
                  <div className="flex items-center gap-2 bg-antigravity-charcoal px-3 py-1 rounded-full border border-white/5">
                    <span className="material-icons-outlined text-[14px] text-white/70">schedule</span>
                    <input 
                      type="number" 
                      value={fasePrincipalDuration} 
                      onChange={(e) => setFasePrincipalDuration(e.target.value)}
                      className="w-12 bg-transparent text-[10px] text-white font-bold outline-none text-center" 
                    />
                    <span className="text-[8px] text-white/80 uppercase font-black">min</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {disciplinas.map((opt) => (
                    <button 
                      key={opt.id || opt.nombre}
                      onClick={() => setFasePrincipal(prev => prev.includes(opt.nombre) ? prev.filter(o => o !== opt.nombre) : [...prev, opt.nombre])}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${fasePrincipal.includes(opt.nombre) ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-antigravity-charcoal text-white/70 border border-white/5'}`}
                    >
                      {opt.nombre}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Paso 5: Habilidades */}
          {registrationStep === 5 && (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Habilidades por Aparato</label>
                {fasePrincipal.length > 0 ? (
                  <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                    {fasePrincipal.map(aparato => (
                      <div key={aparato} className="space-y-2">
                        <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">{aparato}</p>
                        <div className="flex flex-wrap gap-2">
                          {(habilidadesPorAparato[aparato] || []).map((hab, idx) => (
                            <span key={idx} className="bg-primary/10 text-primary text-[10px] px-3 py-1.5 rounded-lg border border-primary/20 flex items-center gap-1">
                              {hab}
                              <button onClick={() => setHabilidadesPorAparato(prev => ({...prev, [aparato]: prev[aparato].filter((_, i) => i !== idx)}))}>
                                <span className="material-icons-outlined text-[12px]">close</span>
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={customHabilidad[aparato] || ""} 
                            onChange={(e) => setCustomHabilidad(prev => ({...prev, [aparato]: e.target.value}))} 
                            placeholder="Añadir habilidad..." 
                            className="flex-1 crafted-input !py-2 !text-[10px]"
                          />
                          <button 
                            onClick={() => { 
                              const hab = customHabilidad[aparato];
                              if(hab) { 
                                setHabilidadesPorAparato(prev => ({...prev, [aparato]: [...(prev[aparato] || []), hab]})); 
                                setCustomHabilidad(prev => ({...prev, [aparato]: ""})); 
                              } 
                            }}
                            className="bg-white/10 text-white px-3 rounded-xl text-[10px] font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center glass-card rounded-3xl border-dashed border-white/10 italic text-white/40 text-sm">
                    No has seleccionado aparatos en el paso anterior.
                  </div>
                )}
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
              className="space-y-6"
            >
              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Resumen de la Clase</label>
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Grupo</p>
                    <p className="text-white font-bold">{claseGrupo}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Asistencia</p>
                    <p className="text-white font-bold">{Object.values(asistenciasHoy).filter(Boolean).length} Alumnos Presentes</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Aparatos</p>
                    <p className="text-white font-bold">{fasePrincipal.join(', ') || 'Ninguno'}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-white/40 ml-1 tracking-widest">Objetivos</label>
                    <textarea 
                      value={claseObjetivos}
                      onChange={(e) => setClaseObjetivos(e.target.value)}
                      className="w-full crafted-input min-h-[80px] !text-[10px]"
                      placeholder="¿Qué buscamos lograr hoy?"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-white/40 ml-1 tracking-widest">Observaciones</label>
                    <textarea 
                      value={claseObservaciones}
                      onChange={(e) => setClaseObservaciones(e.target.value)}
                      className="w-full crafted-input min-h-[80px] !text-[10px]"
                      placeholder="Notas sobre el desempeño del grupo..."
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
            <div className="p-20 text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mx-auto">
                <span className="material-icons-outlined text-white/20 text-3xl">history</span>
              </div>
              <p className="text-white/40 text-sm italic">No hay clases registradas aún.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
