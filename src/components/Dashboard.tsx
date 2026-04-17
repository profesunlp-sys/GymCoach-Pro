
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  COORDINATOR_EMAIL
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
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-purple/20 rounded-xl flex items-center justify-center border border-accent-purple/30 shadow-neon-purple">
            <span className="material-icons-outlined text-accent-purple">fitness_center</span>
          </div>
          <div>
            <h1 className="title-antigravity text-xl leading-none">GymCoach <span className="text-primary">Pro</span></h1>
            <span className="text-[8px] uppercase tracking-[0.2em] text-primary/60 font-bold">
              {userRole === 'Coordinator' ? 'Panel de Control Ejecutivo' : 'Modo Entrenador'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setIsFocusMode(!isFocusMode)}
            variant={isFocusMode ? 'primary' : 'secondary'}
            className="w-10 h-10 !p-0 rounded-full"
            title={isFocusMode ? "Desactivar Modo Enfoque" : "Activar Modo Enfoque"}
          >
            <span className="material-icons-outlined text-sm">{isFocusMode ? 'visibility_off' : 'visibility'}</span>
          </Button>
          {user?.email === COORDINATOR_EMAIL && (
            <Button 
              onClick={() => setUserRole(prev => prev === 'Coordinator' ? 'Coach' : 'Coordinator')}
              variant="outline"
              className="w-10 h-10 !p-0 rounded-full"
              title="Cambiar entre Coordinador y Profe"
            >
              <span className="material-icons-outlined text-sm">swap_horiz</span>
            </Button>
          )}
          <Button 
            onClick={handleLogout}
            variant="danger"
            className="w-10 h-10 !p-0 rounded-full"
            title="Cerrar Sesión"
          >
            <span className="material-icons-outlined text-sm">logout</span>
          </Button>
        </div>
      </header>

      {userRole === 'Coordinator' ? (
        /* PANEL EJECUTIVO DEL COORDINADOR */
        <div className="space-y-8">
          {/* Resumen del Día */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em] px-1">Resumen del Día</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col gap-1">
                <span className="text-white/40 text-[10px] uppercase font-bold">Alumnos Totales</span>
                <span className="text-2xl font-black text-white">{alumnos.length}</span>
              </div>
              <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col gap-1">
                <span className="text-white/40 text-[10px] uppercase font-bold">Grupos Activos</span>
                <span className="text-2xl font-black text-primary">{grupos.length}</span>
              </div>
              <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col gap-1">
                <span className="text-white/40 text-[10px] uppercase font-bold">Clases Hoy</span>
                <span className="text-2xl font-black text-accent-purple">{clasesHoy}</span>
              </div>
              <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col gap-1">
                <span className="text-white/40 text-[10px] uppercase font-bold">Staff Activo</span>
                <span className="text-2xl font-black text-emerald-500">{profesoresList.length}</span>
              </div>
            </div>
          </section>

          {/* Alertas Prioritarias */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-rose-500/60 tracking-[0.2em] px-1">Alertas Prioritarias</h3>
            <div className="space-y-3">
              {feedbacksUrgentes.length > 0 && (
                <div className="bg-rose-500/20 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 bg-rose-500/30 rounded-xl flex items-center justify-center text-rose-500">
                    <span className="material-icons-outlined">priority_high</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{feedbacksUrgentes.length} Feedback Urgentes</p>
                    <p className="text-[10px] text-rose-200/60 font-medium">Revisión inmediata requerida</p>
                  </div>
                  <Button variant="danger" className="h-8 px-3 text-[10px]" onClick={() => setVista('Alumnos')}>Ver</Button>
                </div>
              )}

              {alumnosConPagosVencidos.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                    <span className="material-icons-outlined">payments</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{alumnosConPagosVencidos.length} Pagos Vencidos</p>
                    <p className="text-[10px] text-white/60">Requiere seguimiento administrativo</p>
                  </div>
                  <Button variant="outline" className="h-8 px-3 text-[10px]" onClick={() => setVista('Alumnos')}>Ver</Button>
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

          {/* Estado del Staff (Tarjetas de Profesores) */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-emerald-500/60 tracking-[0.2em] px-1">Estado del Staff</h3>
            <div className="grid grid-cols-1 gap-4">
              {profesoresList.map(prof => {
                const stats = getProfesorStats(prof.nombre);
                return (
                  <div 
                    key={prof.id} 
                    onClick={() => setSelectedProfesorDetail(prof.nombre)}
                    className="glass-card rounded-3xl p-5 border border-white/5 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 relative">
                      <span className="material-icons-outlined text-white/40">person</span>
                      <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-antigravity-black ${stats.color.replace('text-', 'bg-')}`}></div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-sm font-bold text-white truncate">{prof.nombre}</h4>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[9px] text-white/40 uppercase font-bold">{stats.gruposCount} Grupos</span>
                        <span className="text-[9px] text-white/40 uppercase font-bold">{stats.alumnosCount} Alumnos</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-white">{stats.asistenciaPromedio}%</p>
                      <p className="text-[8px] text-white/40 uppercase font-bold">Asistencia</p>
                    </div>
                    <span className="material-icons-outlined text-white/20 group-hover:text-primary transition-colors">chevron_right</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Reportes Ejecutivos */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-black text-primary/60 tracking-[0.2em] px-1">Reportes Ejecutivos</h3>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => setVista('AsistenciaStats')}
                className="glass-card rounded-3xl p-5 border border-white/5 flex items-center gap-4 active:scale-[0.98] transition-all group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-neon-cyan">
                  <span className="material-icons-outlined text-primary">analytics</span>
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-sm font-bold text-white">Estadísticas de Asistencia</h4>
                  <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Tendencias y Presentismo</p>
                </div>
                <span className="material-icons-outlined text-white/20 group-hover:text-primary transition-colors">chevron_right</span>
              </button>

              <button 
                onClick={() => setVista('ReporteGrupal')}
                className="glass-card rounded-3xl p-5 border border-white/5 flex items-center gap-4 active:scale-[0.98] transition-all group"
              >
                <div className="w-12 h-12 bg-accent-purple/10 rounded-2xl flex items-center justify-center border border-accent-purple/20 shadow-neon-purple">
                  <span className="material-icons-outlined text-accent-purple">groups</span>
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-sm font-bold text-white">Reporte por Grupos</h4>
                  <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Desempeño Colectivo</p>
                </div>
                <span className="material-icons-outlined text-white/20 group-hover:text-accent-purple transition-colors">chevron_right</span>
              </button>

              <button 
                onClick={() => setVista('TendenciasHabilidades')}
                className="glass-card rounded-3xl p-5 border border-white/5 flex items-center gap-4 active:scale-[0.98] transition-all group"
              >
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-neon-emerald">
                  <span className="material-icons-outlined text-emerald-500">auto_graph</span>
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-sm font-bold text-white">Tendencias de Habilidades</h4>
                  <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Evolución Técnica</p>
                </div>
                <span className="material-icons-outlined text-white/20 group-hover:text-emerald-500 transition-colors">chevron_right</span>
              </button>

              <button 
                onClick={() => setVista('ReporteBiometrico')}
                className="glass-card rounded-3xl p-5 border border-white/5 flex items-center gap-4 active:scale-[0.98] transition-all group"
              >
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-neon-amber">
                  <span className="material-icons-outlined text-amber-500">biotech</span>
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-sm font-bold text-white">Mapeo Biofísico</h4>
                  <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Análisis de Condición Física</p>
                </div>
                <span className="material-icons-outlined text-white/20 group-hover:text-amber-500 transition-colors">chevron_right</span>
              </button>
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
        <div className="space-y-8">
          {/* Bienvenida para nuevos usuarios */}
          {grupos.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-3xl p-8 border border-primary/30 bg-primary/5 space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto border border-primary/30">
                <span className="material-icons-outlined text-primary text-3xl">waving_hand</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">¡Bienvenido, Profe!</h2>
                <p className="text-sm text-white/60">Para empezar a usar la app, primero necesitamos crear tu primer grupo de alumnos.</p>
              </div>
              <Button 
                onClick={() => setVista('Horario')}
                className="w-full py-4 rounded-2xl shadow-neon-cyan"
              >
                Crear mi primer grupo
              </Button>
            </motion.div>
          )}

          {/* Acciones Principales Simplificadas */}
          <section className="space-y-4">
            <div className="px-1">
              <h3 className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em]">Accesos Rápidos</h3>
              <p className="text-[10px] text-primary/60 mt-1">¿Por dónde empezar? Tocá Lista de Asistencia para registrar la clase de hoy.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => { setRegistrationStep(1); setVista('NuevaClase'); }}
                className="glass-card rounded-3xl p-6 border border-primary/20 bg-primary/5 flex items-center gap-6 active:scale-[0.98] transition-all group ring-2 ring-primary/20"
              >
                <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 shadow-neon-cyan group-hover:scale-110 transition-transform">
                  <span className="material-icons-outlined text-primary text-3xl">add_task</span>
                </div>
                <div className="text-left">
                  <span className="text-lg font-bold text-white block">Lista de Asistencia</span>
                  <span className="text-[10px] text-primary font-black uppercase tracking-widest">Registrar clase de hoy</span>
                </div>
              </button>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setVista('Horario')}
                  className="glass-card rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-all"
                >
                  <div className="w-12 h-12 bg-accent-purple/10 rounded-xl flex items-center justify-center border border-accent-purple/20 shadow-neon-purple">
                    <span className="material-icons-outlined text-accent-purple text-2xl">groups</span>
                  </div>
                  <span className="text-xs font-bold text-white">Mis Grupos</span>
                </button>

                <button 
                  onClick={() => setVista('AsistenciaStats')}
                  className="glass-card rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-all"
                >
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 shadow-neon-emerald">
                    <span className="material-icons-outlined text-emerald-500 text-2xl">analytics</span>
                  </div>
                  <span className="text-xs font-bold text-white">Reportes</span>
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
                      <button 
                        onClick={() => handleNavigation('Profesores')}
                        className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center gap-2 active:scale-95 transition-all"
                      >
                        <span className="material-icons-outlined text-primary text-xl">badge</span>
                        <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Staff</span>
                        <span className="text-[7px] text-white/40 uppercase">Profesores</span>
                      </button>
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
