
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../App';
import { GrupoConfig, ViewMode, Alumno, Clase, UserRole, Feedback, AsistenciaRecord } from '../../types';

interface DashboardProps {
  userRole: UserRole;
  user: any;
  grupos: GrupoConfig[];
  alumnos: Alumno[];
  clases: Clase[];
  asistencias: AsistenciaRecord[];
  feedbacks: Feedback[];
  profesoresList: { id?: string, nombre: string }[];
  setVista: (vista: ViewMode) => void;
  handleNavigation: (vista: ViewMode) => void;
  handleLogout: () => void;
  isFocusMode: boolean;
  setIsFocusMode: (val: boolean) => void;
  showMoreOptions: boolean;
  setShowMoreOptions: (val: boolean) => void;
  alertasGlobales: any[];
  asistenciasGlobales: Record<string, { presentes: number, total: number }>;
  setActiveGroup: (g: GrupoConfig) => void;
  setRegistrationStep: (step: number) => void;
  setUserRole: React.Dispatch<React.SetStateAction<UserRole>>;
  COORDINATOR_EMAIL: string;
  onOpenBulkPayment: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  userRole,
  user,
  grupos,
  alumnos,
  clases,
  asistencias,
  feedbacks,
  profesoresList,
  setVista,
  handleNavigation,
  handleLogout,
  isFocusMode,
  setIsFocusMode,
  showMoreOptions,
  setShowMoreOptions,
  alertasGlobales,
  asistenciasGlobales,
  setActiveGroup,
  setRegistrationStep,
  setUserRole,
  COORDINATOR_EMAIL,
  onOpenBulkPayment
}) => {
  const [selectedProfesorDetail, setSelectedProfesorDetail] = useState<string | null>(null);

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr.split('T')[0] === today;
  };

  const isThisMonth = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const clasesHoy = clases.filter(c => isToday(c.fecha)).length;
  
  // Alertas prioritarias para el coordinador
  const alumnosConPagosVencidos = alumnos.filter(a => a.pagoVencido);
  const alumnosConObservacionesMedicas = alumnos.filter(a => a.observacionesMedicas && a.observacionesMedicas.trim() !== '');
  
  // Grupos sin clase registrada esta semana
  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
  };
  const startOfWeek = getStartOfWeek();
  const gruposSinClaseEstaSemana = grupos.filter(g => {
    const clasesGrupo = clases.filter(c => c.grupo === g.nombre && c.fecha >= startOfWeek);
    return clasesGrupo.length === 0;
  });

  // Feedback urgente
  const feedbacksUrgentes = feedbacks.filter(f => f.urgente);

  // Estadísticas por profesor
  const getProfesorStats = (profName: string) => {
    const profGrupos = grupos.filter(g => g.entrenador === profName);
    const profAlumnos = alumnos.filter(a => profGrupos.some(g => g.nombre === a.grupo));
    const profClasesMes = clases.filter(c => c.entrenador === profName && isThisMonth(c.fecha));
    
    // Asistencia promedio
    const profAsistenciasMes = asistencias.filter(r => 
      profGrupos.some(g => g.nombre === r.grupo) && isThisMonth(r.fecha)
    );
    const totalPresentes = profAsistenciasMes.filter(r => r.presente).length;
    const asistenciaPromedio = profAsistenciasMes.length > 0 
      ? Math.round((totalPresentes / profAsistenciasMes.length) * 100) 
      : 0;

    // Indicador de actividad (Verde/Amarillo/Rojo)
    // Verde: > 8 clases al mes, Amarillo: 4-8, Rojo: < 4
    let color = 'text-rose-500';
    if (profClasesMes.length >= 8) color = 'text-emerald-500';
    else if (profClasesMes.length >= 4) color = 'text-amber-500';

    return {
      gruposCount: profGrupos.length,
      alumnosCount: profAlumnos.length,
      clasesMes: profClasesMes.length,
      asistenciaPromedio,
      color,
      grupos: profGrupos,
      alumnos: profAlumnos,
      clasesRecientes: clases.filter(c => c.entrenador === profName).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5)
    };
  };

  return (
    <div className="px-6 space-y-8 page-transition pt-4 pb-24">
      <header className="flex justify-between items-center py-2">
        <div className="flex items-center gap-4">
          <motion.div 
            whileHover={{ rotate: -15, scale: 1.1 }}
            className="w-12 h-12 bg-gradient-to-br from-primary to-neon-blue rounded-2xl flex items-center justify-center shadow-neon-cyan border border-white/20"
          >
            <span className="material-icons-outlined text-antigravity-black text-2xl">fitness_center</span>
          </motion.div>
          <div>
            <h1 className="title-antigravity text-2xl leading-none">
              GymCoach <span className="text-primary italic">Pro</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-neon-cyan"></span>
              <span className="text-[9px] uppercase font-black tracking-[0.2em] text-white/50">
                {userRole === 'Coordinator' ? 'Control Center • Ejecutivo' : 'Terminal • Entrenador'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isFocusMode ? 'bg-primary border-primary text-antigravity-black shadow-neon-cyan' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}
            title={isFocusMode ? "Desactivar Modo Enfoque" : "Activar Modo Enfoque"}
          >
            <span className="material-icons-outlined text-sm">{isFocusMode ? 'visibility_off' : 'visibility'}</span>
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all flex items-center justify-center"
            title="Cerrar Sesión"
          >
            <span className="material-icons-outlined text-sm">logout</span>
          </motion.button>
          {user?.email === COORDINATOR_EMAIL && (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setUserRole(prev => prev === 'Coordinator' ? 'Coach' : 'Coordinator')}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
              title="Cambiar Rol"
            >
              <span className="material-symbols-outlined text-sm">cached</span>
            </motion.button>
          )}
        </div>
      </header>

      {/* Saludo dinámico */}
      <section className="px-1">
        <h2 className="text-white text-lg font-light">
          Hola, <span className="font-black text-primary uppercase tracking-tight">{user?.displayName?.split(' ')[0] || (userRole === 'Coordinator' ? 'Coordinador' : 'Profe')}</span>
        </h2>
        <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </section>

      {userRole === 'Coordinator' ? (
        /* PANEL EJECUTIVO DEL COORDINADOR */
        <div className="space-y-10">
          {/* ... (keep coordinator code as is) */}
        </div>
      ) : (
        /* VISTA DEL ENTRENADOR */
        <div className="space-y-10">
          {/* Acciones Críticas - Reordered as requested */}
          <section className="space-y-6">
            <h3 className="text-[10px] uppercase font-black text-white/30 tracking-[0.3em] px-1">Control de Operaciones</h3>
            
            <div className="space-y-4">
              {/* Horarios y Tendencias (Analytics) Primero */}
              <div className="grid grid-cols-2 gap-4">
                <motion.button 
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setVista('Horario')}
                  className="glass-card rounded-[2rem] p-6 border border-white/5 flex flex-col items-center justify-center gap-4 active:scale-95 transition-all text-center"
                >
                  <div className="w-12 h-12 bg-accent-purple/10 rounded-2xl flex items-center justify-center border border-accent-purple/20">
                    <span className="material-symbols-outlined text-accent-purple text-2xl">event_note</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black text-white uppercase tracking-tight">Horarios</span>
                    <p className="text-[7px] text-white/40 uppercase font-bold">Mis Grupos</p>
                  </div>
                </motion.button>

                <motion.button 
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setVista('AsistenciaStats')}
                  className="glass-card rounded-[2rem] p-6 border border-white/5 flex flex-col items-center justify-center gap-4 active:scale-95 transition-all text-center"
                >
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                    <span className="material-symbols-outlined text-emerald-500 text-2xl">monitoring</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black text-white uppercase tracking-tight">Analytics</span>
                    <p className="text-[7px] text-white/40 uppercase font-bold">Reportes</p>
                  </div>
                </motion.button>
              </div>

              {/* Pasar Lista Debajo */}
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { setRegistrationStep(1); setVista('NuevaClase'); }}
                className="relative w-full h-48 rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-primary/10"
              >
                <div className="absolute inset-0 bg-primary shadow-inner"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                <div className="absolute bottom-[-20%] right-[-10%] opacity-10 scale-150 rotate-[-15deg]">
                   <span className="material-icons-outlined text-[160px] text-black">checklist</span>
                </div>
                
                <div className="absolute inset-0 p-8 flex flex-col justify-between items-start">
                  <div className="w-12 h-12 bg-antigravity-black/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30">
                    <span className="material-icons-outlined text-black text-2xl">add_task</span>
                  </div>
                  <div className="text-left">
                    <h4 className="text-black text-2xl font-black uppercase tracking-tighter leading-none">Pasar Lista</h4>
                    <p className="text-black/60 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Registrar Asistencia Hoy</p>
                  </div>
                </div>
              </motion.button>
            </div>
          </section>

          {/* Más Opciones (Acordeón) */}
          <section className="space-y-4">
            <button 
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="w-full flex items-center justify-between px-1 group"
            >
              <h3 className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em]">Más herramientas</h3>
              <span className={`material-icons-outlined text-white/40 transition-transform ${showMoreOptions ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            
            <AnimatePresence>
              {showMoreOptions && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <button 
                      onClick={() => handleNavigation('Alumnos')}
                      className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2 active:scale-95 transition-all"
                    >
                      <span className="material-icons-outlined text-accent-purple text-xl">person_search</span>
                      <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Alumnos</span>
                      <span className="text-[7px] text-white/40 uppercase">Gimnastas</span>
                    </button>
                    <button 
                      onClick={() => handleNavigation('HistorialClases')}
                      className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2 active:scale-95 transition-all"
                    >
                      <span className="material-icons-outlined text-indigo-400 text-xl">history</span>
                      <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Historial</span>
                      <span className="text-[7px] text-white/40 uppercase">Clases</span>
                    </button>
                    <button 
                      onClick={() => handleNavigation('Planes')}
                      className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2 active:scale-95 transition-all"
                    >
                      <span className="material-icons-outlined text-amber-500 text-xl">menu_book</span>
                      <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Centro Técnico</span>
                      <span className="text-[7px] text-white/40 uppercase">Manuales</span>
                    </button>
                    <button 
                      onClick={() => handleNavigation('Emergencias')}
                      className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2 active:scale-95 transition-all"
                    >
                      <span className="material-icons-outlined text-rose-500 text-xl">emergency</span>
                      <span className="text-[8px] font-bold text-white uppercase tracking-tighter">S.O.S</span>
                      <span className="text-[7px] text-white/40 uppercase">Emergencias</span>
                    </button>
                    <button 
                      onClick={() => setVista('ReporteBiometrico')}
                      className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2 active:scale-95 transition-all"
                    >
                      <span className="material-icons-outlined text-amber-500 text-xl">biotech</span>
                      <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Mapeo Bio</span>
                      <span className="text-[7px] text-white/40 uppercase">Condición</span>
                    </button>
                    {(userRole as string) === 'Coordinator' && (
                      <>
                        <button 
                          onClick={() => handleNavigation('Profesores')}
                          className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2 active:scale-95 transition-all"
                        >
                          <span className="material-icons-outlined text-primary text-xl">badge</span>
                          <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Staff</span>
                          <span className="text-[7px] text-white/40 uppercase">Profesores</span>
                        </button>
                        <button 
                          onClick={onOpenBulkPayment}
                          className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2 active:scale-95 transition-all"
                        >
                          <span className="material-icons-outlined text-emerald-500 text-xl">fact_check</span>
                          <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Importar</span>
                          <span className="text-[7px] text-white/40 uppercase">Pagos</span>
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      )}
    </div>
  );
};
