
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
              <h3 className="text-2xl font-bold text-black tracking-tight mb-4">Edades del Grupo</h3>
              <div className="space-y-4">
                {[
                  { range: "3-5 años", icon: "child_care", desc: "Pre-Mini" },
                  { range: "6-9 años", icon: "face", desc: "Mini / Pre-Infantil" },
                  { range: "10-15 años", icon: "sports_gymnastics", desc: "Juveniles" }
                ].map((item) => (
                  <button 
                    key={item.range}
                    onClick={() => setClaseAgeRange(item.range)}
                    className={`w-full p-6 rounded-[2rem] border-2 transition-all text-left flex items-center gap-6 ${
                      claseAgeRange === item.range 
                        ? 'border-primary bg-white shadow-[0_0_20px_rgba(0,122,255,0.1)]' 
                        : 'border-black/5 bg-white'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${claseAgeRange === item.range ? 'bg-primary text-white' : 'bg-ios-gray text-secondary'}`}>
                      <span className="material-icons-outlined text-2xl">{item.icon}</span>
                    </div>
                    <div className="flex-1">
                      <span className={`text-xl font-bold block leading-none ${claseAgeRange === item.range ? 'text-primary' : 'text-black'}`}>
                        {item.range}
                      </span>
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-widest mt-1">{item.desc}</span>
                    </div>
                    {claseAgeRange === item.range && (
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-sm">
                        <span className="material-icons-outlined text-white text-[14px]">check</span>
                      </div>
                    )}
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
              <h3 className="text-2xl font-bold text-black tracking-tight">Aparatos</h3>
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
                    className={`relative p-6 rounded-[2.5rem] border-2 transition-all aspect-square flex flex-col items-center justify-center gap-2 ${
                      fasePrincipal.includes(opt.name) 
                        ? 'border-primary bg-white shadow-[0_0_20px_rgba(0,122,255,0.2)] ring-4 ring-primary/5' 
                        : 'border-black/5 bg-white shadow-sm'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${fasePrincipal.includes(opt.name) ? 'bg-primary text-white' : 'bg-ios-gray text-secondary'}`}>
                      <span className="material-icons-outlined text-3xl">{opt.icon}</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${fasePrincipal.includes(opt.name) ? 'text-primary' : 'text-secondary'}`}>{opt.name}</span>
                    
                    <div className="absolute top-4 right-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${fasePrincipal.includes(opt.name) ? 'bg-primary border-primary' : 'border-black/10'}`}>
                        {fasePrincipal.includes(opt.name) && <span className="material-icons-outlined text-white text-[14px]">check</span>}
                      </div>
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
              <div className="bg-white rounded-3xl shadow-ios border border-black/5 overflow-hidden">
                <div className="p-6 border-b border-black/5 flex items-center gap-3">
                   <div className="w-6 h-6 bg-[#34C759] rounded-full flex items-center justify-center">
                     <span className="material-icons-outlined text-white text-[14px]">check</span>
                   </div>
                   <h3 className="text-lg font-bold text-black">Resumen de la Clase</h3>
                </div>
                
                <div className="divide-y divide-black/5">
                  <div className="px-6 py-4 flex justify-between items-center">
                    <span className="text-base font-medium text-black">Grupo:</span>
                    <span className="text-base text-black">{claseGrupo}</span>
                  </div>
                  <div className="px-6 py-4 flex justify-between items-center">
                    <span className="text-base font-medium text-black">Fecha:</span>
                    <span className="text-base text-black">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="px-6 py-4 flex justify-between items-center">
                    <span className="text-base font-medium text-black">Rango de Edad:</span>
                    <span className="text-base text-black">{claseAgeRange || 'No especificado'}</span>
                  </div>
                  <div className="px-6 py-4 flex justify-between items-center">
                    <span className="text-base font-medium text-black">Asistencia:</span>
                    <span className="text-base text-black">{Object.values(asistenciasHoy).filter(Boolean).length} / {alumnos.filter(a => a.grupo === claseGrupo).length} alumnos</span>
                  </div>
                  <div className="px-6 py-4">
                    <span className="text-base font-medium text-black block mb-1">Aparatos Trabajados:</span>
                    <p className="text-base text-black font-medium">
                      {fasePrincipal.length > 0 ? fasePrincipal.join(', ') : '-'}
                    </p>
                  </div>
                  <div className="px-6 py-4">
                    <span className="text-base font-medium text-black block mb-1">Habilidades Dominadas:</span>
                    <p className="text-base text-black opacity-80">{claseObjetivos || '-'}</p>
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
      <div className="min-h-screen bg-ios-gray page-transition pb-24">
        {/* Header Hero */}
        <div className="bg-white px-6 pt-12 pb-8 shadow-sm border-b border-black/5">
          <header className="flex items-center justify-between mb-6">
            <button 
              onClick={() => setVista('HistorialClases')} 
              className="text-primary font-medium flex items-center gap-1 active:scale-95 transition-all"
            >
              <span className="material-icons-outlined text-lg">arrow_back_ios</span>
              <span>Historial</span>
            </button>
            <div className="flex gap-2">
              <button 
                onClick={() => handleEditClase(selectedClase)}
                className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:scale-90 transition-all"
              >
                <span className="material-icons-outlined text-lg">edit</span>
              </button>
              <button 
                onClick={() => handleDeleteClase(selectedClase)}
                className="w-10 h-10 rounded-full bg-ios-red/10 flex items-center justify-center text-ios-red active:scale-90 transition-all"
              >
                <span className="material-icons-outlined text-lg">delete</span>
              </button>
            </div>
          </header>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{new Date(selectedClase.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <h2 className="text-3xl font-bold text-black tracking-tight">{selectedClase.grupo}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-secondary">{selectedClase.entrenador || 'Coach Pro'}</span>
              <span className="w-1 h-1 rounded-full bg-black/10"></span>
              <span className="text-xs font-medium text-secondary">{selectedClase.ageRange || 'Todas las edades'}</span>
            </div>
          </div>
        </div>

        <div className="px-6 -mt-6 space-y-8">
          {/* Quick Stats Rows - Image 1 Style */}
          <div className="bg-white rounded-[2rem] shadow-ios border border-black/5 divide-y divide-black/5 overflow-hidden">
            <div className="p-5 flex justify-between items-center group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-ios-blue/10 rounded-xl flex items-center justify-center text-primary">
                  <span className="material-icons-outlined">groups</span>
                </div>
                <span className="text-sm font-bold text-black">Asistencia</span>
              </div>
              <span className="text-base font-bold text-black">
                {Array.isArray(selectedClase.asistencias) ? selectedClase.asistencias.length : 0} presentes
              </span>
            </div>
            <div className="p-5 flex justify-between items-center group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-ios-orange/10 rounded-xl flex items-center justify-center text-ios-orange">
                  <span className="material-icons-outlined">timer</span>
                </div>
                <span className="text-sm font-bold text-black">Duración Total</span>
              </div>
              <span className="text-base font-bold text-black">
                {parseInt(selectedClase.faseInicialDuration || '0') + parseInt(selectedClase.fasePrincipalDuration || '0') + parseInt(selectedClase.faseFinalDuration || '0')} min
              </span>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-secondary uppercase tracking-widest px-1">Fases del Entrenamiento</h3>
              
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 space-y-6">
                {/* Intro */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                    <h4 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Entrada en Calor</h4>
                    <span className="text-[10px] font-bold text-black/20 ml-auto">{selectedClase.faseInicialDuration}m</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedClase.faseInicial?.map((act, i) => (
                      <span key={i} className="text-xs font-medium text-black/70 bg-ios-gray px-3 py-1.5 rounded-lg border border-black/5">{act}</span>
                    ))}
                  </div>
                </div>

                {/* Main */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-ios-blue"></div>
                    <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest">Fase Principal (Aparatos)</h4>
                    <span className="text-[10px] font-bold text-black/20 ml-auto">{selectedClase.fasePrincipalDuration}m</span>
                  </div>
                  <div className="space-y-4">
                    {selectedClase.fasePrincipal?.map((aparato, i) => (
                      <div key={i} className="space-y-2 pl-4 border-l-2 border-primary/10">
                        <p className="text-xs font-bold text-black uppercase tracking-tight">{aparato}</p>
                        <div className="flex flex-wrap gap-2">
                          {(Array.isArray(selectedClase.habilidadesPorAparato?.[aparato]) ? selectedClase.habilidadesPorAparato?.[aparato] : [])?.map((hab: string, j: number) => (
                            <span key={j} className="text-[10px] font-medium text-black/60 bg-ios-gray/50 px-3 py-1.5 rounded-lg">{hab}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cooldown */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                    <h4 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Vuelta a la calma</h4>
                    <span className="text-[10px] font-bold text-black/20 ml-auto">{selectedClase.faseFinalDuration}m</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedClase.faseFinal?.map((act, i) => (
                      <span key={i} className="text-xs font-medium text-black/70 bg-ios-gray px-3 py-1.5 rounded-lg border border-black/5">{act}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-xs font-bold text-secondary uppercase tracking-widest px-1">Notas de la Clase</h3>
               <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-black/5 space-y-4 italic">
                  <div>
                    <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Objetivos Logrados</h4>
                    <p className="text-sm text-black/70 leading-relaxed">
                      "{selectedClase.objetivos || 'No se registraron objetivos específicos.'}"
                    </p>
                  </div>
                  <div className="pt-4 border-t border-black/5">
                    <h4 className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Observaciones</h4>
                    <p className="text-sm text-black/70 leading-relaxed">
                      "{selectedClase.observaciones || 'Sin observaciones adicionales.'}"
                    </p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (vista === 'HistorialClases' || vista === 'Clases') {
    return (
      <div className="min-h-screen bg-ios-gray page-transition pb-24">
        <header className="px-6 pt-12 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => handleNavigation('Dashboard')} 
              className="text-primary font-medium flex items-center gap-1 active:scale-95 transition-all"
            >
              <span className="material-icons-outlined text-lg">arrow_back_ios</span>
              <span>Dashboard</span>
            </button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigation('NuevaClase')}
              className="w-10 h-10 rounded-full bg-ios-blue shadow-lg flex items-center justify-center text-white active:scale-90 transition-all"
            >
              <span className="material-icons-outlined text-lg">add</span>
            </motion.button>
          </div>
          <h2 className="text-3xl font-bold text-black tracking-tight">Historial de Clases</h2>
        </header>

        <div className="px-6 space-y-6">
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            <div className="relative flex-1 min-w-[140px]">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">calendar_today</span>
              <input 
                type="date" 
                value={planesFilterDate}
                onChange={(e) => setPlanesFilterDate(e.target.value)}
                className="w-full bg-white border border-transparent rounded-xl pl-10 pr-4 py-3 text-[10px] text-black font-bold uppercase tracking-widest outline-none shadow-sm focus:border-primary/20 transition-all"
              />
            </div>
            <div className="relative flex-1 min-w-[140px]">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">person</span>
              <select 
                value={planesFilterCoach}
                onChange={(e) => setPlanesFilterCoach(e.target.value)}
                className="w-full bg-white border border-transparent rounded-xl pl-10 pr-4 py-3 text-[10px] text-black font-bold uppercase tracking-widest outline-none shadow-sm focus:border-primary/20 transition-all appearance-none"
              >
                <option value="Todos">Todos los Coaches</option>
                {Array.from(new Set(clases.map(c => c.entrenador).filter(Boolean))).map(coach => (
                  <option key={coach} value={coach || ""}>{coach}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {clases
              .filter(c => {
                const matchesDate = planesFilterDate ? c.fecha.startsWith(planesFilterDate) : true;
                const matchesCoach = planesFilterCoach === 'Todos' ? true : c.entrenador === planesFilterCoach;
                return matchesDate && matchesCoach;
              })
              .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
              .map((clase, idx) => (
              <motion.div 
                key={clase.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => { setSelectedClase(clase); setVista('ClaseDetalle'); }}
                className="bg-white p-5 rounded-[2rem] shadow-ios border border-black/5 hover:border-primary/20 active:bg-ios-gray transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-ios-gray flex flex-col items-center justify-center group-hover:bg-primary/10 transition-all">
                      <span className="text-base font-bold text-black leading-none">{new Date(clase.fecha).getDate()}</span>
                      <span className="text-[8px] font-bold text-primary uppercase tracking-tighter mt-0.5">{new Date(clase.fecha).toLocaleString('es-ES', { month: 'short' })}</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-black tracking-tight leading-tight">{clase.grupo}</h4>
                      <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">{clase.entrenador || 'Coach Pro'}</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-ios-gray flex items-center justify-center text-black/10 group-hover:text-primary transition-colors">
                    <span className="material-icons-outlined text-lg">chevron_right</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {clase.fasePrincipal?.map((aparato, i) => (
                    <span key={i} className="text-[10px] font-bold text-secondary bg-ios-gray px-3 py-1.5 rounded-lg uppercase tracking-tight">{aparato}</span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-black/5">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="material-icons-outlined text-sm text-secondary">schedule</span>
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                        {parseInt(clase.faseInicialDuration || '0') + parseInt(clase.fasePrincipalDuration || '0') + parseInt(clase.faseFinalDuration || '0')} min
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-icons-outlined text-sm text-secondary">groups</span>
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                        {Array.isArray(clase.asistencias) ? clase.asistencias.length : 0} alumnos
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {clases.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 bg-white rounded-[2.5rem] border border-dashed border-black/10 mx-2 shadow-sm">
                <div className="w-20 h-20 bg-ios-gray rounded-full flex items-center justify-center">
                  <span className="material-icons-outlined text-secondary text-4xl">history_edu</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-black font-bold text-lg tracking-tight">Sin Historial</h3>
                  <p className="text-secondary text-xs font-medium">Todavía no has registrado ninguna clase.</p>
                </div>
                <Button 
                  onClick={() => handleNavigation('NuevaClase')}
                  className="px-10 !rounded-full !py-4 shadow-lg"
                >
                  Registrar Primera Clase
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
