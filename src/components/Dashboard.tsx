
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
          Hola, <span className="font-black text-primary uppercase tracking-tight">{user?.displayName?.split(' ')[0] || (userRole === 'Coordinator' ? 'Coordinador' : 'Profesor')}</span>
        </h2>
        <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </section>

      {userRole === 'Coordinator' ? (
        /* PANEL EJECUTIVO DEL COORDINADOR */
        <div className="space-y-10">
          {/* Resumen del Día - Technical Grid */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-white/30 tracking-[0.3em] px-1 flex items-center gap-2">
               <span className="w-1 h-1 bg-white/30 rounded-full"></span> RESUMEN DE ACTIVIDAD
            </h3>
            <div className="grid grid-cols-2 gap-px bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">
              <div className="p-6 bg-antigravity-charcoal/50 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-white/40 mb-1">
                  <span className="material-icons-outlined text-[14px]">groups</span>
                  <span className="text-[9px] uppercase font-bold tracking-widest">Gimnastas</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-white font-mono tracking-tighter">{alumnos.length}</span>
                  <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                    <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-tighter">Activo</span>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-antigravity-charcoal/50 flex flex-col gap-2 border-l border-white/10">
                <div className="flex items-center gap-2 text-white/40 mb-1">
                  <span className="material-icons-outlined text-[14px]">category</span>
                  <span className="text-[9px] uppercase font-bold tracking-widest">Grupos</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-primary font-mono tracking-tighter">{grupos.length}</span>
                </div>
              </div>
              <div className="p-6 bg-antigravity-charcoal/50 flex flex-col gap-2 border-t border-white/10">
                <div className="flex items-center gap-2 text-white/40 mb-1">
                  <span className="material-icons-outlined text-[14px]">today</span>
                  <span className="text-[9px] uppercase font-bold tracking-widest">Sesiones Hoy</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-accent-purple font-mono tracking-tighter">{clasesHoy}</span>
                  <div className="px-2 py-0.5 bg-accent-purple/10 border border-accent-purple/20 rounded-md">
                    <span className="text-[8px] text-accent-purple font-bold uppercase tracking-tighter">Live</span>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-antigravity-charcoal/50 flex flex-col gap-2 border-l border-t border-white/10">
                <div className="flex items-center gap-2 text-white/40 mb-1">
                  <span className="material-icons-outlined text-[14px]">badge</span>
                  <span className="text-[9px] uppercase font-bold tracking-widest">Staff</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-emerald-500 font-mono tracking-tighter">{profesoresList.length}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Alertas Prioritarias */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-rose-500/50 tracking-[0.3em] px-1 flex items-center gap-2">
               <span className="w-1 h-1 bg-rose-500/50 rounded-full animate-ping"></span> ALERTAS CRÍTICAS
            </h3>
            <div className="space-y-3">
              {feedbacksUrgentes.length > 0 && (
                <motion.div 
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-5 flex items-center gap-5 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-1">
                    <div className="w-12 h-12 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all"></div>
                  </div>
                  <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-500/30 shadow-neon-rose">
                    <span className="material-symbols-outlined font-bold">notification_important</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-black text-[10px] uppercase tracking-widest opacity-60">Feedback Pendiente</p>
                    <p className="text-white font-bold text-lg leading-tight mt-0.5">{feedbacksUrgentes.length} Alertas de Padres</p>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="h-10 px-5 bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-neon-rose" 
                    onClick={() => setVista('Alumnos')}
                  >
                    Atender
                  </motion.button>
                </motion.div>
              )}

              {alumnosConPagosVencidos.length > 0 && (
                <div className="glass-card rounded-3xl p-5 flex items-center gap-5 border-amber-500/20">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/30">
                    <span className="material-icons-outlined">payments</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-black text-[10px] uppercase tracking-widest opacity-40">Administración</p>
                    <p className="text-white font-bold text-lg leading-tight mt-0.5">{alumnosConPagosVencidos.length} Moras Detectadas</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-amber-500/80 hover:text-amber-500 transition-colors" onClick={() => setVista('Alumnos')}>Revisar</button>
                    <button className="h-10 px-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest text-amber-500 hover:bg-amber-500/20 transition-all" onClick={onOpenBulkPayment}>Cargar Pagos</button>
                  </div>
                </div>
              )}
              
              {alumnosConObservacionesMedicas.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-500">
                    <span className="material-icons-outlined">medical_services</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{alumnosConObservacionesMedicas.length} Observaciones Médicas</p>
                    <p className="text-[10px] text-white/60">Pendientes de revisión técnica</p>
                  </div>
                  <Button variant="outline" className="h-8 px-3 text-[10px]" onClick={() => setVista('Alumnos')}>Revisar</Button>
                </div>
              )}

              {gruposSinClaseEstaSemana.length > 0 && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-500">
                    <span className="material-icons-outlined">event_busy</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{gruposSinClaseEstaSemana.length} Grupos sin Actividad</p>
                    <p className="text-[10px] text-white/60">Sin clases registradas esta semana</p>
                  </div>
                  <Button variant="outline" className="h-8 px-3 text-[10px]" onClick={() => setVista('Horario')}>Ver</Button>
                </div>
              )}
            </div>
          </section>

          {/* Estado del Staff (Technical Grid) */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-emerald-100/30 tracking-[0.3em] px-1 flex items-center gap-2">
               <span className="w-1 h-1 bg-emerald-500/50 rounded-full"></span> RENDIMIENTO DEL STAFF
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {profesoresList.map(prof => {
                const stats = getProfesorStats(prof.nombre);
                return (
                  <motion.div 
                    key={prof.id} 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedProfesorDetail(prof.nombre)}
                    className="glass-card rounded-3xl p-5 border border-white/5 flex items-center gap-4 cursor-pointer group hover:bg-white/[0.07] transition-all"
                  >
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                      <span className="material-icons-outlined text-white/40 text-2xl relative z-10">person</span>
                      <div className={`absolute bottom-0 left-0 right-0 h-1 ${stats.color.replace('text-', 'bg-')}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate uppercase tracking-tight">{prof.nombre}</h4>
                      <div className="flex gap-4 mt-1">
                        <div className="flex items-center gap-1.5 grayscale opacity-60">
                           <span className="material-icons-outlined text-[12px]">category</span>
                           <span className="text-[9px] text-white uppercase font-bold">{stats.gruposCount} Grupos</span>
                        </div>
                        <div className="flex items-center gap-1.5 grayscale opacity-60">
                           <span className="material-icons-outlined text-[12px]">groups</span>
                           <span className="text-[9px] text-white uppercase font-bold">{stats.alumnosCount} Alumnos</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right pr-2">
                      <p className={`text-lg font-black font-mono leading-none ${stats.color}`}>{stats.asistenciaPromedio}%</p>
                      <p className="text-[7px] text-white/30 uppercase font-black tracking-widest mt-1">Attendance</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Reportes Ejecutivos (Refined Cards) */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-primary/40 tracking-[0.3em] px-1 flex items-center gap-2">
               <span className="w-1 h-1 bg-primary/40 rounded-full"></span> BUSQUEDA E INSIGHTS
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <motion.button 
                whileHover={{ x: 4 }}
                onClick={() => setVista('AsistenciaStats')}
                className="group flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-3xl p-5 hover:bg-white/[0.06] transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">analytics</span>
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-sm font-bold text-white uppercase tracking-tight">Estadísticas de Asistencia</h4>
                  <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest mt-0.5">Métricas de Presentismo Global</p>
                </div>
                <span className="material-icons-outlined text-white/20 group-hover:text-primary transition-all">east</span>
              </motion.button>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setVista('ReporteGrupal')} className="glass-card rounded-[2rem] p-5 border border-white/5 flex flex-col gap-3 text-left group">
                   <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center text-accent-purple group-hover:bg-accent-purple/20 transition-colors">
                      <span className="material-symbols-outlined text-xl">groups</span>
                   </div>
                   <div>
                      <h5 className="text-[11px] font-black text-white uppercase tracking-tight">Reporte Grupal</h5>
                      <p className="text-[7px] text-white/40 uppercase font-black mt-1">Evolución Colectiva</p>
                   </div>
                </button>
                <button onClick={() => setVista('TendenciasHabilidades')} className="glass-card rounded-[2rem] p-5 border border-white/5 flex flex-col gap-3 text-left group">
                   <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
                      <span className="material-symbols-outlined text-xl">insights</span>
                   </div>
                   <div>
                      <h5 className="text-[11px] font-black text-white uppercase tracking-tight">Tendencias</h5>
                      <p className="text-[7px] text-white/40 uppercase font-black mt-1">Avance Técnico</p>
                   </div>
                </button>
              </div>
            </div>
          </section>

          {/* Estado de Asistencia Hoy */}
          <section className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <h3 className="text-[10px] uppercase font-black text-primary/60 tracking-[0.2em]">Asistencia por Grupo</h3>
              <button onClick={() => setVista('AsistenciaStats')} className="text-[10px] text-primary font-bold uppercase hover:underline">Ver Reportes y Estadísticas</button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
              {grupos.map((g) => {
                const stats = asistenciasGlobales[g.nombre] || { presentes: 0, total: 0 };
                const isTaken = stats.total > 0 && stats.presentes > 0;
                return (
                  <div 
                    key={g.id} 
                    onClick={() => { setActiveGroup(g); setVista('AsistenciaLista'); }}
                    className="min-w-[160px] glass-card rounded-3xl p-5 border border-white/5 space-y-3 active:scale-95 transition-all cursor-pointer"
                  >
                    <h4 className="text-xs font-bold text-white truncate">{g.nombre}</h4>
                    <div className="flex items-end justify-between">
                      <span className={`text-xl font-black ${isTaken ? 'text-primary' : 'text-rose-500'}`}>
                        {stats.presentes}<span className="text-[10px] text-white/80 mx-1">/</span>{stats.total}
                      </span>
                      <span className={`text-[8px] font-black uppercase tracking-widest ${isTaken ? 'text-primary/60' : 'text-rose-500/60'}`}>
                        {isTaken ? 'Enviada' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${isTaken ? 'bg-primary shadow-neon-cyan' : 'bg-rose-500'}`} 
                        style={{ width: `${stats.total > 0 ? (stats.presentes / stats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Modal Detalle Profesor */}
          <AnimatePresence>
            {selectedProfesorDetail && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-end justify-center"
                onClick={() => setSelectedProfesorDetail(null)}
              >
                <motion.div 
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  className="w-full max-w-[430px] bg-antigravity-charcoal rounded-t-[3rem] border-t border-white/10 p-8 space-y-8 max-h-[90vh] overflow-y-auto no-scrollbar"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10">
                        <span className="material-icons-outlined text-white/40 text-3xl">person</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedProfesorDetail}</h3>
                        <p className="text-primary text-[10px] font-black uppercase tracking-widest">Detalle del Profesor</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedProfesorDetail(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                      <span className="material-icons-outlined">close</span>
                    </button>
                  </div>

                  {(() => {
                    const stats = getProfesorStats(selectedProfesorDetail);
                    return (
                      <div className="space-y-8">
                        {/* Métricas Rápidas */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
                            <p className="text-xl font-black text-white">{stats.clasesMes}</p>
                            <p className="text-[8px] text-white/40 uppercase font-bold">Clases Mes</p>
                          </div>
                          <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
                            <p className="text-xl font-black text-primary">{stats.asistenciaPromedio}%</p>
                            <p className="text-[8px] text-white/40 uppercase font-bold">Asistencia</p>
                          </div>
                          <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
                            <p className="text-xl font-black text-accent-purple">{stats.gruposCount}</p>
                            <p className="text-[8px] text-white/40 uppercase font-bold">Grupos</p>
                          </div>
                        </div>

                        {/* Grupos y Horarios */}
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Grupos y Horarios</h4>
                          <div className="space-y-2">
                            {stats.grupos.map(g => (
                              <div key={g.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div>
                                  <p className="text-sm font-bold text-white">{g.nombre}</p>
                                  <p className="text-[10px] text-white/40">{g.dias.join(', ')}</p>
                                </div>
                                <span className="text-xs font-black text-primary">{g.horario}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Clases Recientes */}
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Clases Recientes</h4>
                          <div className="space-y-2">
                            {stats.clasesRecientes.map(c => (
                              <div key={c.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div>
                                  <p className="text-xs font-bold text-white">{new Date(c.fecha).toLocaleDateString()}</p>
                                  <p className="text-[10px] text-white/40">{c.grupo}</p>
                                </div>
                                <span className="material-icons-outlined text-emerald-500 text-sm">check_circle</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Button 
                          onClick={() => {
                            setSelectedProfesorDetail(null);
                            handleNavigation('Profesores');
                          }}
                          className="w-full py-4 rounded-2xl"
                        >
                          Ver Perfil Completo
                        </Button>
                      </div>
                    );
                  })()}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* VISTA DEL ENTRENADOR (EXISTENTE) */
        <div className="space-y-10">
          {/* Bienvenida y Estado Rápido */}
          <section className="relative px-1">
             <div className="absolute -top-10 -right-4 w-32 h-32 bg-primary/10 blur-[60px] pointer-events-none"></div>
             <motion.div 
               initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
               className="bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/5 rounded-[2.5rem] p-8 space-y-6"
             >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.3em]">Sesión Activa</p>
                    <h4 className="text-white text-xl font-black uppercase tracking-tight">Status del Día</h4>
                  </div>
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                     <span className="material-symbols-outlined text-white/40">rocket_launch</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[20px] font-black text-white font-mono">{clasesHoy}</p>
                    <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest">Clases Hoy</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[20px] font-black text-emerald-500 font-mono">{grupos.length}</p>
                    <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest">Tus Grupos</p>
                  </div>
                </div>

                {grupos.length === 0 && (
                  <Button 
                    onClick={() => setVista('Horario')}
                    className="w-full py-4 rounded-2xl shadow-neon-cyan !bg-primary !text-antigravity-black"
                  >
                    Configurar mis grupos
                  </Button>
                )}
             </motion.div>
          </section>

          {/* Acciones Críticas */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-white/30 tracking-[0.3em] px-1">Control de Operaciones</h3>
            <div className="grid grid-cols-1 gap-4">
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { setRegistrationStep(1); setVista('NuevaClase'); }}
                className="relative h-48 rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-primary/10"
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
                  <div>
                    <h4 className="text-black text-2xl font-black uppercase tracking-tighter leading-none">Pasar Lista</h4>
                    <p className="text-black/60 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Registrar Asistencia Hoy</p>
                  </div>
                </div>
              </motion.button>

              <div className="grid grid-cols-2 gap-4">
                <button 
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
                </button>

                <button 
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
                </button>
              </div>
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
