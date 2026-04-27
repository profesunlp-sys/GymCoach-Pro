
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, BackButton } from '../../App';
import { GrupoConfig, ViewMode, Alumno, Clase, UserRole, Feedback, AsistenciaRecord } from '../../types';
import Papa from "papaparse";
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

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
  
  const coachGrupos = grupos.filter(g => g.entrenadorId === user?.uid || g.entrenador === user?.displayName);
  const [selectedGroupInternal, setSelectedGroupInternal] = useState<GrupoConfig | null>(coachGrupos.length === 1 ? coachGrupos[0] : null);

  const [syncStatus, setSyncStatus] = useState<any>(null);

  React.useEffect(() => {
    if (userRole === 'Coordinator') {
      const fetchStatus = () => {
        fetch('/api/sync/status')
          .then(res => res.json())
          .then(setSyncStatus)
          .catch(() => {});
      };
      fetchStatus();
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const formatRelTime = (isoStr: string) => {
    if (!isoStr) return 'Nunca';
    const diff = Math.floor((new Date().getTime() - new Date(isoStr).getTime()) / 60000);
    if (diff < 1) return 'Recién';
    if (diff < 60) return `Hace ${diff} min`;
    return new Date(isoStr).toLocaleTimeString();
  };

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
  
  const currentMonthIdx = new Date().getMonth();
  const isPaymentCycleActive = currentMonthIdx >= 2 && currentMonthIdx <= 10; // Marzo a Noviembre

  // Alertas prioritarias para el coordinador
  const alumnosConPagosVencidos = isPaymentCycleActive ? alumnos.filter(a => a.pagoVencido) : [];
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
    <div className="min-h-screen bg-ios-gray space-y-6 page-transition pt-4 pb-24 px-6 focus-mode-parent">
      <header className="flex justify-between items-center py-2">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ rotate: -5, scale: 1.05 }}
            className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-ios border border-black/5"
          >
            <span className="material-icons-outlined text-primary text-2xl">fitness_center</span>
          </motion.div>
          <div>
            <h1 className="text-xl font-bold text-black tracking-tight leading-none">
              GymCoach <span className="text-primary">Pro</span>
            </h1>
            <p className="text-[10px] font-bold tracking-wider text-secondary uppercase mt-1">
              {userRole === 'Coordinator' ? 'Coordinación' : 'Entrenador'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.email === COORDINATOR_EMAIL && (
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setUserRole(prev => prev === 'Coordinator' ? 'Coach' : 'Coordinator')}
              className="w-10 h-10 rounded-full bg-white shadow-sm border border-black/5 text-secondary hover:text-primary transition-all flex items-center justify-center"
              title="Cambiar Rol"
            >
              <span className="material-symbols-outlined text-xl">cached</span>
            </motion.button>
          )}
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="w-10 h-10 rounded-full bg-white shadow-sm border border-black/5 text-secondary hover:text-ios-red transition-all flex items-center justify-center"
            title="Cerrar Sesión"
          >
            <span className="material-icons-outlined text-xl">logout</span>
          </motion.button>
        </div>
      </header>

      {/* Saludo y Fecha */}
      <section className="px-1">
        <h2 className="text-3xl font-bold text-black tracking-tight">
          Hola, {user?.displayName?.split(' ')[0] || (userRole === 'Coordinator' ? 'Coordinador' : 'Profesor')}
        </h2>
        <p className="text-secondary text-sm font-medium mt-1">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </section>

      {userRole === 'Coordinator' ? (
        /* VISTA DEL COORDINADOR */
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Registro de Pagos / Finanzas */}
            <motion.button 
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              onClick={() => setVista('ControlPagos')}
              className="relative w-full p-6 rounded-[2rem] bg-white shadow-ios border border-black/5 text-left flex items-center gap-5 group"
            >
              <div className="w-14 h-14 bg-ios-blue/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-outlined text-ios-blue text-3xl">payments</span>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-black leading-tight">Control de Pagos</h4>
                <p className="text-secondary text-xs font-medium">Gimnasia Artística Infantil</p>
              </div>
              <span className="material-icons-outlined text-black/10 group-hover:text-primary transition-colors">chevron_right</span>
            </motion.button>

            {/* Carga Masiva */}
            <motion.button 
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              onClick={onOpenBulkImportStudents}
              className="relative w-full p-6 rounded-[2rem] bg-white shadow-ios border border-black/5 text-left flex items-center gap-5 group"
            >
              <div className="w-14 h-14 bg-ios-green/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-outlined text-ios-green text-3xl">group_add</span>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-black leading-tight">Carga Masiva</h4>
                <p className="text-secondary text-xs font-medium">Importar alumnos CSV/Excel</p>
              </div>
              <span className="material-icons-outlined text-black/10 group-hover:text-primary transition-colors">chevron_right</span>
            </motion.button>

            {/* Google Sheets Sync */}
            <div className="md:col-span-2 bg-gradient-to-br from-ios-green/5 to-ios-blue/5 border border-black/5 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <span className="material-icons-outlined text-[100px]">sync</span>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10">
                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-black flex items-center gap-2">
                    <span className="material-icons-outlined text-ios-green">description</span>
                    Google Sheets Sync
                  </h4>
                  <p className="text-secondary text-xs font-medium">Sincronización automática de asistencia cada 5 min</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      fetch('/api/auth/google/url')
                        .then(res => res.json())
                        .then(data => window.open(data.url, '_blank', 'width=600,height=600'));
                    }}
                    className="!py-3 !px-5 !rounded-2xl"
                  >
                    Conectar
                  </Button>
                  <Button 
                    onClick={async () => {
                      try {
                        setSyncStatus(prev => ({ ...prev, isSyncing: true, lastError: null }));
                        console.log("Iniciando sincronización manual...");

                        const SHEET_URLS = {
                          // Martes y Jueves
                          'lunes_miercoles': {
                            id: '1FaCHHOmhR66_04sa_XcdxmX3A5qdOVWZHHtpHThz5Ys',
                            tabs: ['LOLA', 'MILI', 'LUCÍA', 'SABRI', 'CATA']
                          },
                          
                          // Sábados
                          'sabados': {
                            id: '1mxo6JKc5uhCs7pw0-UJ-xevC5Iyl2aOvuCHhksWkK2g',
                            tabs: ['LOLA-LU', 'MAY', 'SABRI', 'CATA', 'MILI']
                          }
                        };
                        
                        let importedTotal = 0;
                        const logMessages = [];
                        
                        const monthsMap: Record<string, number> = {
                          'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6, 'JULIO': 7,
                          'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12,
                          'ENERO': 1, 'FEBRERO': 2
                        };

                        for (const [sheetKey, sheetConfig] of Object.entries(SHEET_URLS)) {
                          for (const tabName of sheetConfig.tabs) {
                            const url = `https://docs.google.com/spreadsheets/d/${sheetConfig.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
                            console.log(`[${sheetKey}] Descargando Tab ${tabName}: ${url}`);
                            
                            let res;
                            try {
                                res = await fetch(url);
                            } catch (e: any) {
                                console.error(`Error de red al intentar descargar Tab ${tabName}: ${e.message}`);
                                continue;
                            }

                            if (!res.ok) {
                               console.error(`Tab ${tabName} no accesible (${res.status}). Asegúrate de que los enlaces sean públicos.`);
                               continue;
                            }
                            
                            const csvText = await res.text();
                            
                            const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
                            if (parsed.errors.length) console.warn("Errores de parseo:", parsed.errors);
                            
                            const rows = parsed.data as any[][];
                            if (rows.length < 3) {
                              console.warn(`Tab ${tabName} ignorada: no tiene suficientes filas.`);
                              continue;
                            }
                            
                            const ageGroup = (rows[0][1] || '').trim();
                            const columnDates: Record<number, string> = {};
                            let currentMonthNum = new Date().getMonth() + 1;
                            const currentYear = new Date().getFullYear();

                            for (let i = 4; i < rows[1].length; i++) {
                               const monthStr = (rows[0][i] || '').trim().toUpperCase();
                               if (monthStr && monthsMap[monthStr]) {
                                  currentMonthNum = monthsMap[monthStr];
                               }
                               const dayStr = (rows[1][i] || '').trim().toUpperCase();
                               if (dayStr && dayStr !== 'PAGO') {
                                  const day = parseInt(dayStr);
                                  if (!isNaN(day)) {
                                    const fm = currentMonthNum.toString().padStart(2, '0');
                                    const fd = day.toString().padStart(2, '0');
                                    columnDates[i] = `${currentYear}-${fm}-${fd}`;
                                  }
                               }
                            }

                            let tabImported = 0;

                            for (let r = 2; r < rows.length; r++) {
                              const studentName = (rows[r][1] || '').trim();
                              if (!studentName || studentName.toLowerCase().includes('apellido y nombre')) continue;

                              const alumnosRef = collection(db, 'alumnos');
                              const q = query(alumnosRef, where('nombre', '==', studentName));
                              const alumnosSnap = await getDocs(q);
                              
                              let alumnaId = "";
                              let syncState = "sincronizado";

                              if (alumnosSnap.empty) {
                                alumnaId = "DNI_PENDIENTE_" + studentName.replace(/\s+/g, '_');
                                syncState = "pendiente de verificación";
                              } else {
                                const alumno = alumnosSnap.docs[0].data();
                                alumnaId = alumno.dni || alumnosSnap.docs[0].id;
                              }

                              for (let c = 4; c < rows[r].length; c++) {
                                 if (columnDates[c]) {
                                    const cellValue = (rows[r][c] || '').trim().toUpperCase();
                                    if (cellValue === 'P' || cellValue === 'X') {
                                       const date = columnDates[c];
                                       const isPresent = cellValue === 'P';
                                       
                                       const asisRef = collection(db, 'asistencias');
                                       const qAsis = query(asisRef, where('alumnaNombre', '==', studentName), where('fecha', '==', date));
                                       const existingSnap = await getDocs(qAsis);

                                       const recordData = {
                                         fecha: date,
                                         alumnaId,
                                         alumnaNombre: studentName,
                                         grupo: ageGroup || "Sin Grupo",
                                         presente: isPresent,
                                         observacion: `Tab: ${tabName}`,
                                         origen: "google_sheets_matrix",
                                         sincronizadoEn: serverTimestamp(),
                                         estado_sync: syncState
                                       };

                                       if (existingSnap.empty) {
                                         await addDoc(asisRef, recordData);
                                         importedTotal++;
                                         tabImported++;
                                       } else {
                                         const existingDoc = existingSnap.docs[0];
                                         const exData = existingDoc.data();
                                         if (exData.presente !== recordData.presente) {
                                           await updateDoc(doc(db, 'asistencias', existingDoc.id), {
                                             ...recordData,
                                             conflicto_resuelto: true
                                           });
                                           importedTotal++;
                                           tabImported++;
                                         }
                                       }
                                    }
                                 }
                              }
                            }
                            const logMsg = `Tab ${tabName}: ${tabImported} registros sincronizados.`;
                            console.log(logMsg);
                            logMessages.push(logMsg);
                          }
                        }

                        console.log("Sincronización finalizada exitosamente. Total Importados:", importedTotal);
                        setSyncStatus({ isSyncing: false, lastError: null, lastSync: new Date().toISOString(), recordsProcessed: importedTotal });
                        alert(`✅ Sincronizado:\n\nTotal: ${importedTotal} registros.\n\n${logMessages.join('\n')}`);
                      } catch (error: any) {
                        console.error("Error crítico en sincronización:", error);
                        setSyncStatus(prev => ({ ...prev, isSyncing: false, lastError: error.message }));
                        alert(`❌ Error: ${error.message}`);
                      }
                    }}
                    className="!py-3 !px-5 !rounded-2xl bg-ios-green shadow-ios-green/20"
                    disabled={syncStatus?.isSyncing}
                  >
                    {syncStatus?.isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-black/5">
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mb-1">Estado</p>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${syncStatus?.isSyncing ? 'bg-ios-orange animate-pulse' : (syncStatus?.lastError ? 'bg-ios-red' : 'bg-ios-green')}`}></div>
                    <p className={`text-xs font-bold ${syncStatus?.lastError ? 'text-ios-red' : 'text-black'}`}>
                      {syncStatus?.isSyncing ? 'Sincronizando...' : (syncStatus?.lastError ? 'Error de conexión' : 'Activo')}
                    </p>
                  </div>
                  {syncStatus?.lastError && (
                    <p className="text-[8px] text-ios-red mt-1 leading-tight line-clamp-2" title={syncStatus.lastError}>
                      {syncStatus.lastError}
                    </p>
                  )}
                </div>
                <div className="bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-black/5">
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mb-1">Última Sinc.</p>
                  <p className="text-xs font-bold text-black">{formatRelTime(syncStatus?.lastSync)}</p>
                </div>
                <div className="bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-black/5 col-span-2">
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mb-1 shadow-sm">Registros (Última vez)</p>
                  <div className="flex items-center gap-2">
                     <span className="text-xs font-black text-ios-blue">{syncStatus?.recordsProcessed || 0} Importados</span>
                     <div className="flex gap-1.5 ml-auto">
                        <span className="px-2 py-0.5 bg-ios-blue/10 text-ios-blue rounded text-[8px] font-black uppercase">Asistencia</span>
                        <span className="px-2 py-0.5 bg-ios-green/10 text-ios-green rounded text-[8px] font-black uppercase">Gimnastas</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reportes Globales */}
            <motion.button 
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              onClick={() => setVista('AsistenciaStats')}
              className="relative w-full p-6 rounded-[2rem] bg-white shadow-ios border border-black/5 text-left flex items-center gap-5 group"
            >
              <div className="w-14 h-14 bg-ios-orange/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-outlined text-ios-orange text-3xl">insights</span>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-black leading-tight">Reportes y Estadísticas</h4>
                <p className="text-secondary text-xs font-medium">Análisis de rendimiento y asistencia</p>
              </div>
              <span className="material-icons-outlined text-black/10 group-hover:text-primary transition-colors">chevron_right</span>
            </motion.button>
          </section>

          {/* Resumen Alertas */}
          <section className="space-y-4">
             <h3 className="text-xs font-bold text-secondary uppercase tracking-widest ml-1">Estado de hoy</h3>
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-black/5">
                   <p className="text-secondary text-[10px] font-bold uppercase tracking-tight mb-1">Pagos Vencidos</p>
                   <p className={`text-2xl font-bold ${alumnosConPagosVencidos.length > 0 ? 'text-ios-red' : 'text-black'}`}>{alumnosConPagosVencidos.length}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-black/5">
                   <p className="text-secondary text-[10px] font-bold uppercase tracking-tight mb-1">Obs. Médicas</p>
                   <p className={`text-2xl font-bold ${alumnosConObservacionesMedicas.length > 0 ? 'text-ios-orange' : 'text-black'}`}>{alumnosConObservacionesMedicas.length}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-black/5 col-span-2 flex justify-between items-center">
                   <div>
                    <p className="text-secondary text-[10px] font-bold uppercase tracking-tight mb-1">Grupos sin actividad semanal</p>
                    <p className="text-2xl font-bold text-black">{gruposSinClaseEstaSemana.length} Grupos</p>
                   </div>
                   <span className="material-icons-outlined text-ios-gray text-3xl">event_busy</span>
                </div>
             </div>
          </section>
        </div>
      ) : (
        /* VISTA DEL ENTRENADOR */
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {(() => {
            if (!selectedGroupInternal) {
              return (
                <div className="space-y-6 pt-2">
                  <div className="px-1 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">¿Con qué grupo trabajás hoy?</h3>
                    <span className="text-[10px] font-bold text-primary">{coachGrupos.length} Grupos</span>
                  </div>
                  
                  <div className="space-y-3">
                    {coachGrupos.length > 0 ? (
                      coachGrupos.map(g => (
                        <motion.button
                          key={g.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedGroupInternal(g)}
                          className="w-full bg-white p-6 rounded-[2rem] shadow-ios border border-transparent hover:border-primary/20 flex items-center justify-between group transition-all"
                        >
                          <div className="text-left flex items-center gap-4">
                            <div className="w-12 h-12 bg-ios-gray rounded-2xl flex items-center justify-center text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-all">
                              <span className="material-icons-outlined">calendar_today</span>
                            </div>
                            <div>
                              <h4 className="text-xl font-bold text-black tracking-tight group-hover:text-primary transition-colors">{g.nombre}</h4>
                              <p className="text-xs text-secondary font-medium">
                                {Array.isArray(g.dias) ? g.dias.join(', ') : g.dias} • {g.horario}
                              </p>
                            </div>
                          </div>
                          <span className="material-icons-outlined text-black/10 group-hover:text-primary transition-colors">arrow_forward_ios</span>
                        </motion.button>
                      ))
                    ) : (
                      <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-dashed border-black/10 text-center space-y-6">
                        <div className="w-20 h-20 bg-ios-gray rounded-full flex items-center justify-center mx-auto">
                          <span className="material-icons-outlined text-4xl text-secondary">group_off</span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-black font-bold">Sin grupos asignados</p>
                          <p className="text-secondary text-xs">Creá tu primer grupo para comenzar</p>
                        </div>
                        <Button onClick={() => setVista('Horario')} className="px-8 !rounded-full mx-auto">
                          Crear mi primer grupo
                        </Button>
                      </div>
                    )}
                  </div>

                  {coachGrupos.length > 0 && (
                    <div className="flex justify-center pt-2">
                      <button 
                        onClick={() => setVista('Horario')}
                        className="text-primary text-sm font-bold flex items-center gap-2 active:scale-95 transition-all"
                      >
                        <span className="material-icons-outlined">add_circle_outline</span>
                        Crear nuevo grupo
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // Vista de acciones para el Grupo Seleccionado
            const groupStudents = alumnos.filter(a => a.grupo === selectedGroupInternal.nombre);
            const clasesGrupo = clases.filter(c => c.grupo === selectedGroupInternal.nombre);

            return (
              <div className="space-y-8 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-ios border border-black/5 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <span className="material-icons-outlined text-[120px] text-black">groups</span>
                  </div>
                  
                  <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{Array.isArray(selectedGroupInternal.dias) ? selectedGroupInternal.dias.join(', ') : selectedGroupInternal.dias}</span>
                        <h3 className="text-4xl font-bold text-black tracking-tight">{selectedGroupInternal.nombre}</h3>
                        <p className="text-secondary text-sm font-medium">{selectedGroupInternal.horario}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedGroupInternal(null)}
                        className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:scale-90 transition-all"
                      >
                        <span className="material-icons-outlined text-xl">swap_horiz</span>
                      </button>
                    </div>

                    {clasesGrupo.length === 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-primary/5 border border-primary/20 rounded-3xl p-5 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <span className="material-icons-outlined text-primary">auto_awesome</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-black">¡Grupo nuevo!</p>
                            <p className="text-[10px] font-medium text-secondary">Registrá el contenido de tu primera clase abajo.</p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                       <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setActiveGroup(selectedGroupInternal); setVista('AsistenciaLista'); }}
                        className="flex flex-col items-center justify-center gap-3 p-6 bg-ios-blue text-white rounded-3xl shadow-lg active:scale-95 transition-all"
                       >
                         <span className="material-icons-outlined text-3xl">fact_check</span>
                         <span className="text-xs font-bold uppercase tracking-widest">Asistencia</span>
                       </motion.button>
                       <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { 
                          setActiveGroup(selectedGroupInternal);
                          setRegistrationStep(1); 
                          setVista('NuevaClase'); 
                        }}
                        className="flex flex-col items-center justify-center gap-3 p-6 bg-primary text-white rounded-3xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
                       >
                         <span className="material-symbols-outlined text-3xl">add_task</span>
                         <span className="text-xs font-bold uppercase tracking-widest text-center">Nueva Clase</span>
                       </motion.button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">Gimnastas ({groupStudents.length})</h3>
                    <button 
                      onClick={() => {
                        setStudentForm({ ...studentForm, grupo: selectedGroupInternal.nombre });
                        setIsAddingAlumno(true);
                        setVista('Alumnos');
                      }}
                      className="text-primary text-[10px] font-bold uppercase tracking-widest"
                    >
                      + Agregar
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl shadow-sm border border-black/5 divide-y divide-black/5 overflow-hidden">
                    {groupStudents.length > 0 ? groupStudents.map(alumno => (
                      <div 
                        key={alumno.id} 
                        onClick={() => {
                          setSelectedAlumno(alumno);
                          setVista('AlumnoDetalle');
                        }}
                        className="p-5 flex items-center justify-between active:bg-ios-gray transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center">
                            <span className="text-sm font-bold text-secondary">{alumno.nombre.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-black">{alumno.nombre}</p>
                            <p className="text-[10px] font-medium text-secondary">{alumno.nivel}</p>
                          </div>
                        </div>
                        <span className="material-icons-outlined text-black/10 text-lg">chevron_right</span>
                      </div>
                    )) : (
                      <div className="p-10 text-center text-secondary text-sm italic">
                        Sin gimnastas registrados.
                      </div>
                    )}
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
