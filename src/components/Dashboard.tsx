
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
        /* VISTA DEL ENTRENADOR — Rediseñado para uso diario */
        <div className="space-y-8">
          {/* ═══ ACCIONES PRINCIPALES — Uso Diario ═══ */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-white/30 tracking-[0.3em] px-1">Acciones del Día</h3>
            
            <div className="space-y-4">
              {/* PASAR LISTA — Hero Card Cyan */}
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { setRegistrationStep(1); setVista('NuevaClase'); }}
                className="relative w-full h-44 rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-primary/20"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary via-neon-blue to-primary"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10"></div>
                <div className="absolute bottom-[-15%] right-[-8%] opacity-[0.08]">
                   <span className="material-icons-outlined text-[140px] text-black rotate-[-15deg]">checklist</span>
                </div>
                <div className="absolute inset-0 p-7 flex flex-col justify-between items-start">
                  <div className="w-14 h-14 bg-antigravity-black/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30">
                    <span className="material-icons-outlined text-black text-3xl">add_task</span>
                  </div>
                  <div className="text-left">
                    <h4 className="text-black text-2xl font-black uppercase tracking-tighter leading-none">Pasar Lista</h4>
                    <p className="text-black/50 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Registrar asistencia de hoy</p>
                  </div>
                </div>
              </motion.button>

              {/* REGISTRAR CLASE — Hero Card Púrpura/Azul — Acceso directo al formulario */}
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { setRegistrationStep(1); setVista('NuevaClase'); }}
                className="relative w-full h-44 rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-accent-purple/20"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent-purple via-indigo-500 to-neon-blue"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10"></div>
                <div className="absolute bottom-[-15%] right-[-8%] opacity-[0.08]">
                   <span className="material-icons-outlined text-[140px] text-white rotate-[-15deg]">edit_note</span>
                </div>
                <div className="absolute inset-0 p-7 flex flex-col justify-between items-start">
                  <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30">
                    <span className="material-icons-outlined text-white text-3xl">edit_note</span>
                  </div>
                  <div className="text-left">
                    <h4 className="text-white text-2xl font-black uppercase tracking-tighter leading-none">Registrar Clase</h4>
                    <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Anotar lo que trabajaste hoy</p>
                  </div>
                </div>
              </motion.button>
            </div>
          </section>

          {/* ═══ ACCESO RÁPIDO — Uso Frecuente ═══ */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-white/30 tracking-[0.3em] px-1">Acceso Rápido</h3>
            <div className="grid grid-cols-2 gap-4">
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => handleNavigation('Alumnos')}
                className="glass-card rounded-[2rem] p-6 border border-white/5 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all text-center"
              >
                <div className="w-12 h-12 bg-accent-purple/10 rounded-2xl flex items-center justify-center border border-accent-purple/20">
                  <span className="material-symbols-outlined text-accent-purple text-2xl">group</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-black text-white uppercase tracking-tight">Mis Alumnos</span>
                  <p className="text-[7px] text-white/40 uppercase font-bold">Ver y gestionar gimnastas</p>
                </div>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setVista('Horario')}
                className="glass-card rounded-[2rem] p-6 border border-white/5 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all text-center"
              >
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                  <span className="material-symbols-outlined text-amber-500 text-2xl">event_note</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-black text-white uppercase tracking-tight">Mis Grupos</span>
                  <p className="text-[7px] text-white/40 uppercase font-bold">Horarios y grupos</p>
                </div>
              </motion.button>
            </div>
          </section>

          {/* ═══ HOY EN EL GIMNASIO — Panel de actividad en tiempo real ═══ */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-white/30 tracking-[0.3em] px-1">Hoy en el Gimnasio</h3>
            
            <div className="space-y-3">
              {/* Asistencia de hoy */}
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                const asistenciasHoy = asistencias.filter(a => a.fecha?.split('T')[0] === today && a.presente);
                const totalAlumnosHoy = asistenciasHoy.length;
                const totalAlumnos = alumnos.length;
                return (
                  <div className="glass-card rounded-2xl p-4 border border-white/5 flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${totalAlumnosHoy > 0 ? 'bg-primary/10 border border-primary/20' : 'bg-white/5 border border-white/10'}`}>
                      <span className={`material-icons-outlined text-xl ${totalAlumnosHoy > 0 ? 'text-primary' : 'text-white/30'}`}>how_to_reg</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {totalAlumnosHoy > 0 ? (
                        <>
                          <p className="text-sm font-black text-white tracking-tight">
                            {totalAlumnosHoy} / {totalAlumnos} <span className="text-white/50 font-bold text-xs">presentes hoy</span>
                          </p>
                          <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-primary rounded-full shadow-neon-cyan transition-all" style={{ width: `${Math.round((totalAlumnosHoy / (totalAlumnos || 1)) * 100)}%` }}></div>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-white/40 font-medium">Sin asistencia registrada hoy</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Última clase registrada */}
              {(() => {
                const misClases = clases
                  .filter(c => c.entrenador === user?.displayName || c.entrenador === user?.email)
                  .sort((a, b) => b.fecha.localeCompare(a.fecha));
                const ultima = misClases[0];
                return (
                  <div className="glass-card rounded-2xl p-4 border border-white/5 flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ultima ? 'bg-accent-purple/10 border border-accent-purple/20' : 'bg-white/5 border border-white/10'}`}>
                      <span className={`material-icons-outlined text-xl ${ultima ? 'text-accent-purple' : 'text-white/30'}`}>history_edu</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {ultima ? (
                        <>
                          <p className="text-sm font-black text-white tracking-tight truncate">{ultima.grupo}</p>
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
                            {new Date(ultima.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-white/40 font-medium">No registraste clases todavía</p>
                      )}
                    </div>
                    {ultima && (
                      <span className="text-[8px] text-accent-purple/60 font-black uppercase tracking-widest shrink-0">Última clase</span>
                    )}
                  </div>
                );
              })()}

              {/* Alertas médicas */}
              {(() => {
                const alumnosConAlertas = alumnos.filter(a => 
                  (a.observacionesMedicas && a.observacionesMedicas.trim() !== '') ||
                  (a.alertas && a.alertas.length > 0 && a.alertas.some(al => al.trim() !== ''))
                );
                const count = alumnosConAlertas.length;
                return (
                  <div className={`glass-card rounded-2xl p-4 border flex items-center gap-4 ${count > 0 ? 'border-amber-500/20' : 'border-white/5'}`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${count > 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                      <span className={`material-icons-outlined text-xl ${count > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {count > 0 ? 'warning' : 'verified_user'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {count > 0 ? (
                        <>
                          <p className="text-sm font-black text-amber-400 tracking-tight">{count} alumno{count > 1 ? 's' : ''} con alertas</p>
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">Revisá observaciones médicas</p>
                        </>
                      ) : (
                        <p className="text-xs text-emerald-400 font-bold">Sin alertas médicas activas</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
