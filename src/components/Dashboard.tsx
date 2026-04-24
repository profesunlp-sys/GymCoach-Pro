
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
  onOpenBulkPayment: () => void;
  onOpenBulkImportStudents: () => void;
  setSelectedAlumno: (a: Alumno | null) => void;
  setStudentForm: (form: any) => void;
  setIsAddingAlumno: (val: boolean) => void;
  studentForm: any;
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
  onOpenBulkPayment,
  onOpenBulkImportStudents,
  setSelectedAlumno,
  setStudentForm,
  setIsAddingAlumno,
  studentForm
}) => {
  const [selectedProfesorDetail, setSelectedProfesorDetail] = useState<string | null>(null);
  
  const coachGrupos = grupos.filter(g => g.entrenador === user?.displayName);
  const [selectedGroupInternal, setSelectedGroupInternal] = useState<GrupoConfig | null>(coachGrupos.length === 1 ? coachGrupos[0] : null);

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
                {userRole === 'Coordinator' ? 'VISTA DEL COORDINADOR' : 'Terminal • Entrenador'}
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
        /* VISTA DEL COORDINADOR */
        <div className="space-y-10">
          <section className="space-y-6">
            <div className="flex justify-between items-end px-1">
              <div>
                <h3 className="title-antigravity text-xl">Gestión Centralizada</h3>
                <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Acciones de Coordinación</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Botón de Carga Masiva */}
              <motion.button 
                whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }}
                onClick={onOpenBulkImportStudents} 
                className="relative w-full h-44 rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-emerald-500/20 border border-white/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600"></div>
                <div className="absolute top-0 right-0 p-6 opacity-20">
                  <span className="material-icons-outlined text-[100px] text-white rotate-12">upload_file</span>
                </div>
                
                <div className="absolute inset-0 p-10 flex flex-col justify-center items-start text-left">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/30 mb-4">
                    <span className="material-icons-outlined text-white text-3xl">group_add</span>
                  </div>
                  <div>
                    <h4 className="text-white text-3xl font-black uppercase tracking-tighter leading-none mb-1">Carga Masiva</h4>
                    <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Importar gimnastas desde CSV/Excel</p>
                  </div>
                </div>
              </motion.button>

              {/* Botón de Reportes Globales */}
              <motion.button 
                whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }}
                onClick={() => setVista('AsistenciaStats')}
                className="relative w-full h-44 rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-primary/20 border border-white/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-neon-blue"></div>
                <div className="absolute top-0 right-0 p-6 opacity-20">
                  <span className="material-icons-outlined text-[100px] text-white -rotate-12">analytics</span>
                </div>
                
                <div className="absolute inset-0 p-10 flex flex-col justify-center items-start text-left">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/30 mb-4">
                    <span className="material-icons-outlined text-white text-3xl">insights</span>
                  </div>
                  <div>
                    <h4 className="text-white text-3xl font-black uppercase tracking-tighter leading-none mb-1">Reportes Finanzas</h4>
                    <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Estadísticas de pagos y asistencia</p>
                  </div>
                </div>
              </motion.button>
            </div>
          </section>

          {/* Resumen de Alertas (Original collapsed logic) */}
          <section className="space-y-6">
             <div className="flex justify-between items-end px-1">
                <h3 className="title-antigravity text-xl text-rose-500">Alertas de Hoy</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-6 rounded-3xl border-rose-500/20">
                   <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Pagos Vencidos</p>
                   <p className="text-3xl font-black text-white">{alumnosConPagosVencidos.length}</p>
                </div>
                <div className="glass-card p-6 rounded-3xl border-rose-500/20">
                   <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Obs. Médicas</p>
                   <p className="text-3xl font-black text-white">{alumnosConObservacionesMedicas.length}</p>
                </div>
                <div className="glass-card p-6 rounded-3xl border-rose-500/20">
                   <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Sin Actividad</p>
                   <p className="text-3xl font-black text-white">{gruposSinClaseEstaSemana.length} <span className="text-xs text-white/40">Grupos</span></p>
                </div>
             </div>
          </section>
        </div>
      ) : (
        /* VISTA DEL ENTRENADOR */
        <div className="space-y-8">
          {(() => {
            if (!selectedGroupInternal) {
              return (
                <div className="space-y-6 pt-2">
                  <div className="px-1">
                    <h3 className="text-white/60 text-sm font-bold uppercase tracking-widest">¿Con qué grupo trabajás hoy?</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {coachGrupos.length > 0 ? (
                      coachGrupos.map(g => (
                        <motion.button
                          key={g.id}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedGroupInternal(g)}
                          className="glass-card p-8 rounded-[2.5rem] border border-white/10 hover:border-primary/40 flex items-center justify-between group transition-all"
                        >
                          <div className="text-left">
                            <h4 className="text-2xl font-black text-white uppercase tracking-tighter group-hover:text-primary transition-colors">{g.nombre}</h4>
                            <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">
                              {Array.isArray(g.dias) ? g.dias.join(', ') : g.dias} • {g.horario}
                            </p>
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                            <span className="material-icons-outlined">arrow_forward</span>
                          </div>
                        </motion.button>
                      ))
                    ) : (
                      <div className="glass-card p-12 rounded-[2.5rem] border border-dashed border-white/20 text-center space-y-6">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto opacity-30">
                          <span className="material-icons-outlined text-4xl">group_off</span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-white/60 font-medium">Todavía no tenés grupos configurados.</p>
                          <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">Creá el primero para empezar a trabajar</p>
                        </div>
                        <Button onClick={() => setVista('Horario')} className="px-8 py-4 !rounded-2xl mx-auto">
                          Crear mi primer grupo
                        </Button>
                      </div>
                    )}
                  </div>

                  {coachGrupos.length > 0 && (
                    <div className="flex justify-center pt-4">
                      <button 
                        onClick={() => setVista('Horario')}
                        className="text-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:brightness-125 transition-all"
                      >
                        <span className="material-icons-outlined text-sm">add_circle</span>
                        Crear nuevo grupo
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // Vista de acciones para el Grupo Seleccionado
            const groupStudents = alumnos.filter(a => a.grupo === selectedGroupInternal.nombre);

            return (
              <div className="space-y-8 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center px-1">
                  <div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{selectedGroupInternal.nombre}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-2 flex items-center gap-2">
                       <span className="w-1 h-1 bg-primary rounded-full"></span>
                       {Array.isArray(selectedGroupInternal.dias) ? selectedGroupInternal.dias.join(', ') : selectedGroupInternal.dias} • {selectedGroupInternal.horario}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedGroupInternal(null)}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all shadow-lg active:scale-90"
                    title="Cambiar de grupo"
                  >
                    <span className="material-icons-outlined text-sm">swap_horiz</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* PASAR LISTA */}
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setActiveGroup(selectedGroupInternal); setVista('AsistenciaLista'); }}
                    className="relative w-full h-40 rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-cyan-500/20 border border-white/10"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500"></div>
                    <div className="absolute top-0 right-0 p-6 opacity-20">
                      <span className="material-icons-outlined text-[80px] text-white rotate-12">fact_check</span>
                    </div>
                    <div className="absolute inset-0 p-10 flex flex-col justify-center items-start text-left">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/30 mb-3">
                        <span className="material-icons-outlined text-white text-2xl">playlist_add_check</span>
                      </div>
                      <div>
                        <h4 className="text-white text-2xl font-black uppercase tracking-tighter leading-none mb-1">Pasar Lista</h4>
                        <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Registrar asistencia de hoy</p>
                      </div>
                    </div>
                  </motion.button>

                  {/* REGISTRAR CLASE */}
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { 
                      setActiveGroup(selectedGroupInternal);
                      setRegistrationStep(1); 
                      setVista('NuevaClase'); 
                    }}
                    className="relative w-full h-40 rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-indigo-500/20 border border-white/10"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600"></div>
                    <div className="absolute top-0 right-0 p-6 opacity-20">
                      <span className="material-symbols-outlined text-[80px] text-white rotate-12">assignment_turned_in</span>
                    </div>
                    <div className="absolute inset-0 p-10 flex flex-col justify-center items-start text-left">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/30 mb-3">
                        <span className="material-symbols-outlined text-white text-2xl">school</span>
                      </div>
                      <div>
                        <h4 className="text-white text-2xl font-black uppercase tracking-tighter leading-none mb-1">Registrar Clase</h4>
                        <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Anotar lo que trabajaste hoy</p>
                      </div>
                    </div>
                  </motion.button>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Gimnastas del grupo</h3>
                    <div className="text-[10px] font-bold text-primary px-3 py-1 bg-primary/10 rounded-full">
                      {groupStudents.length} alumnas
                    </div>
                  </div>

                  <div className="space-y-3">
                    {groupStudents.length > 0 ? groupStudents.map(alumno => (
                      <div key={alumno.id} className="glass-card rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                            <span className="text-xs font-black text-white/40">{alumno.nombre.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white leading-none">{alumno.nombre}</p>
                            <p className="text-[8px] uppercase tracking-widest text-white/30 mt-1">{alumno.nivel}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedAlumno(alumno);
                            setVista('AlumnoDetalle');
                          }}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 active:scale-95 transition-all"
                        >
                          <span className="material-icons-outlined text-sm">visibility</span>
                        </button>
                      </div>
                    )) : (
                      <div className="py-12 text-center text-white/20 uppercase font-black text-[10px] tracking-widest border border-dashed border-white/10 rounded-[2rem] bg-white/5">
                        Aún no hay alumnas en este grupo
                      </div>
                    )}
                    
                    <button 
                      onClick={() => {
                        setStudentForm({ ...studentForm, grupo: selectedGroupInternal.nombre });
                        setIsAddingAlumno(true);
                        setVista('Alumnos');
                      }}
                      className="w-full py-5 rounded-2xl border border-dashed border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary/10 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      <span className="material-icons-outlined text-sm">person_add</span>
                      Agregar alumna al grupo
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
