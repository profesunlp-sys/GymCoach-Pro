import React, { useState, useEffect, useMemo, useRef } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, StaffMember, GrupoConfig } from './types.ts';
import { processClassAudio } from './services/geminiService.ts';

// --- DATABASE CONFIGURATION ---
const db = new Dexie('GymCoachEliteDB_v7') as Dexie & {
  alumnos: EntityTable<Alumno, 'id'>;
  clases: EntityTable<Clase, 'id'>;
  grupos: EntityTable<GrupoConfig, 'id'>;
};

db.version(1).stores({
  alumnos: '++id, dni, nombre, estadoPago, disciplina',
  clases: '++id, fecha, grupo',
  grupos: '++id, nombre'
});

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vista, setVista] = useState<ViewMode>('Dashboard');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [grupos, setGrupos] = useState<GrupoConfig[]>([]);
  
  // Group Form State
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  
  // IA Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // UI States
  const [notificacion, setNotificacion] = useState<{t: string, d: string} | null>(null);

  const loadData = async () => {
    const a = await db.alumnos.toArray();
    const c = await db.clases.toArray();
    const g = await db.grupos.toArray();
    setAlumnos(a);
    setClases(c);
    setGrupos(g);

    // Initial seed if empty
    if (a.length === 0 && g.length === 0) {
      await db.alumnos.add({
        nombre: 'Atleta Ejemplo', dni: '001', disciplina: 'GAF', nivel: 'Promocional',
        fechaNacimiento: '2015-01-01', fechaIngreso: new Date().toISOString(),
        fechaPrimeraClase: new Date().toISOString(), estadoPago: 'Al día', 
        asistenciasHistoricas: 10, alertas: [], habilidades: [],
        biometria: { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 },
        qrCode: 'QR_001'
      });
      loadData();
    }
  };

  useEffect(() => { if (isLoggedIn) loadData(); }, [isLoggedIn]);

  const handleSaveGroup = async () => {
    if (!newGroupName || selectedDays.length === 0) return;
    await db.grupos.add({
      nombre: newGroupName,
      dias: selectedDays,
      horario: "16:00 - 18:00" 
    });
    setNewGroupName("");
    setSelectedDays([]);
    loadData();
    setNotificacion({ t: "Grupo Guardado", d: "Configuración actualizada correctamente." });
    setTimeout(() => setNotificacion(null), 3000);
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  // Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        processAudio(blob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) { console.error(e); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const result = await processClassAudio(base64, 'audio/webm');
        const newClase: Clase = {
          fecha: new Date().toISOString(),
          grupo: result.grupo || 'General',
          horario: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          entrenador: result.entrenador || 'Coach Pro',
          warmup: result.warmup || [],
          apparatusUsed: result.apparatusUsed || [],
          skillsCovered: result.skillsCovered || []
        };
        await db.clases.add(newClase);
        loadData();
        setNotificacion({ t: "Clase Registrada", d: `Se procesó el audio para ${newClase.grupo}` });
        setIsAnalyzing(false);
        setVista('Dashboard');
      } catch (e) {
        setIsAnalyzing(false);
        setNotificacion({ t: "Error", d: "No se pudo procesar el audio." });
      }
      setTimeout(() => setNotificacion(null), 4000);
    };
  };

  if (!isLoggedIn) return (
    <div className="min-h-screen auth-bg flex flex-col items-center justify-center p-8 text-white">
      <div className="z-10 w-full max-w-sm text-center page-transition">
        <div className="w-20 h-20 bg-[#277bf1] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/10">
          <span className="material-icons text-white text-4xl">fitness_center</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tighter mb-2">GymCoach <span className="text-[#277bf1]">Pro</span></h1>
        <p className="text-slate-400 text-sm mb-10">High Performance Management</p>
        <button onClick={() => setIsLoggedIn(true)} className="w-full py-5 bg-white text-indigo-900 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Sincronizar Panel</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-white dark:bg-slate-900 shadow-2xl relative overflow-hidden flex flex-col font-display">
      
      {/* IOS Status Bar (Visual) */}
      <div className="h-12 flex justify-between items-center px-8 pt-4 pb-2 w-full bg-white dark:bg-slate-900 sticky top-0 z-50">
        <span className="text-sm font-semibold">9:41</span>
        <div className="flex items-center gap-1.5">
          <span className="material-icons text-[18px]">signal_cellular_alt</span>
          <span className="material-icons text-[18px]">wifi</span>
          <span className="material-icons text-[18px]">battery_full</span>
        </div>
      </div>

      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="bg-[#277bf1] p-1.5 rounded-lg flex items-center justify-center">
            <span className="material-icons text-white text-[20px]">fitness_center</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">GymCoach <span className="text-[#277bf1]">Pro</span></h1>
        </div>
        <button className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
          <span className="material-icons text-[20px]">notifications</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-8 pb-32">
        
        {vista === 'Dashboard' && (
          <div className="space-y-8 page-transition">
            {/* Welcome Banner */}
            <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#277bf1] to-[#60a5fa] p-7 shadow-lg shadow-blue-100">
              <div className="relative z-10 flex flex-col items-start gap-5">
                <div>
                  <h2 className="text-white text-2xl font-bold">¡Hola José María!</h2>
                  <p className="text-blue-50/90 text-sm mt-1">Configura tu semana para empezar.</p>
                </div>
                <button onClick={() => setVista('NuevaClase')} className="flex items-center gap-2 bg-white text-[#277bf1] px-6 py-3.5 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform">
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  <span>Registrar Clase</span>
                </button>
              </div>
              <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl"></div>
              <div className="absolute -right-4 top-2 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
            </section>

            {/* Schedule Config */}
            <section className="space-y-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Configuración de Horario</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Define un nuevo grupo y sus días</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-7 rounded-[2rem] ios-shadow border border-slate-100 dark:border-slate-700 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nombre del Grupo</label>
                  <input 
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-5 py-4 text-sm focus:ring-2 ring-blue-100 placeholder:text-slate-400 font-medium" 
                    placeholder="Ej. Avanzados, Juveniles..." 
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Días de Entrenamiento</label>
                  <div className="flex justify-between w-full">
                    {['L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => {
                      const id = `${day}-${idx}`;
                      const isSelected = selectedDays.includes(id);
                      return (
                        <button 
                          key={id}
                          onClick={() => toggleDay(id)}
                          className={`w-11 h-11 rounded-full border-2 font-bold text-sm transition-all flex items-center justify-center ${isSelected ? 'border-[#277bf1] bg-blue-50 text-[#277bf1]' : 'border-slate-100 text-slate-300'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">more_time</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium italic">Añade horarios para los días seleccionados...</span>
                  </div>
                  <button 
                    onClick={handleSaveGroup}
                    className="w-full py-4.5 bg-[#277bf1] text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 active:scale-[0.98] transition-all"
                  >
                    <span className="material-icons text-[18px]">save</span>
                    Guardar Configuración
                  </button>
                </div>
              </div>
            </section>

            {/* Configured Groups */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mis Grupos Configurados</h3>
                <span className="text-[10px] font-bold text-[#277bf1] bg-blue-50 px-2.5 py-1 rounded-full uppercase">{grupos.length} {grupos.length === 1 ? 'Grupo' : 'Grupos'}</span>
              </div>
              <div className="space-y-4">
                {grupos.map((g, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-800 rounded-[2rem] ios-shadow border border-slate-50 dark:border-slate-700 overflow-hidden">
                    <div className="p-6 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white">{g.nombre}</h4>
                          <div className="flex items-center gap-2 mt-2 text-slate-400">
                            <span className="material-icons text-[16px]">calendar_today</span>
                            <span className="text-xs font-semibold">{g.dias.map(d => d.split('-')[0]).join(', ')}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-slate-400">
                            <span className="material-icons text-[16px]">schedule</span>
                            <span className="text-xs font-semibold">{g.horario}</span>
                          </div>
                        </div>
                        <button className="w-8 h-8 flex items-center justify-center text-slate-300">
                          <span className="material-icons text-[20px]">more_vert</span>
                        </button>
                      </div>
                      <div className="pt-3 border-t border-slate-50 dark:border-slate-800">
                        <button onClick={() => setVista('Alumnos')} className="flex items-center justify-between w-full group">
                          <span className="text-[#277bf1] font-bold text-sm">Ver Lista de Asistencia</span>
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#277bf1] group-active:translate-x-1 transition-transform">
                            <span className="material-icons text-[20px]">chevron_right</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {grupos.length === 0 && (
                  <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sin grupos configurados</p>
                  </div>
                )}
              </div>
            </section>

            {/* Quick Stats */}
            <section className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] ios-shadow border border-slate-50">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <span className="material-icons text-[18px]">event_available</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total Clases</span>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">{clases.length}</div>
                <div className="text-[10px] text-slate-400 font-medium mt-1">Sin actividad este mes</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] ios-shadow border border-slate-50">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <span className="material-icons text-[18px]">group</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Alumnos</span>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">{alumnos.length}</div>
                <button onClick={() => setVista('Alumnos')} className="text-[10px] text-[#277bf1] font-bold mt-1 flex items-center gap-1">
                  <span className="material-icons text-[12px]">person_add</span> Añadir más
                </button>
              </div>
            </section>

            {/* Info Card */}
            <section className="bg-slate-900 rounded-[2rem] p-7 text-white flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2.5 rounded-xl">
                  <span className="material-icons text-[20px]">info</span>
                </div>
                <span className="font-bold">Primeros Pasos</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-400">Bienvenido a tu panel. Una vez configurado el grupo, podrás gestionar las asistencias diarias desde la sección de grupos.</p>
            </section>
          </div>
        )}

        {/* Voice Report View */}
        {vista === 'NuevaClase' && (
          <div className="space-y-8 page-transition">
            <div className="bg-white rounded-[2.5rem] p-8 text-center shadow-xl border border-slate-50">
              <div className="w-20 h-20 bg-blue-50 text-[#277bf1] rounded-3xl flex items-center justify-center mx-auto mb-6">
                <span className="material-icons text-3xl">mic</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 italic">Reporte de Clase IA</h2>
              <p className="text-sm text-slate-500 mt-2 px-4 leading-relaxed">Habla con naturalidad sobre los ejercicios, aparatos y nivel de hoy.</p>
              
              <div className="mt-12 mb-6 flex flex-col items-center">
                <button 
                  onMouseDown={startRecording} onMouseUp={stopRecording}
                  onTouchStart={startRecording} onTouchEnd={stopRecording}
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${isRecording ? 'bg-rose-500 scale-110' : 'bg-[#277bf1] hover:scale-105'}`}>
                  {isRecording ? (
                    <div className="flex gap-1.5 items-end h-8">
                      {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 bg-white rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`, height: `${50 + Math.random()*50}%`}}></div>)}
                    </div>
                  ) : <span className="material-icons text-white text-4xl">mic</span>}
                </button>
                <p className="mt-8 text-[11px] font-bold uppercase text-[#277bf1] tracking-[0.2em]">{isRecording ? "Grabando..." : "Mantén presionado para hablar"}</p>
              </div>
            </div>

            {isAnalyzing && (
              <div className="bg-blue-50 p-10 rounded-[2rem] border border-blue-100 text-center animate-pulse flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-[#277bf1] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs font-bold uppercase text-[#277bf1] tracking-widest">Analizando reporte...</p>
              </div>
            )}
          </div>
        )}

        {/* Placeholder Views */}
        {(vista === 'Horario' || vista === 'Alumnos' || vista === 'Ajustes') && (
          <div className="py-24 text-center space-y-4 page-transition">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
               <span className="material-icons text-3xl">construction</span>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Módulo en desarrollo: {vista}</p>
            <button onClick={() => setVista('Dashboard')} className="text-[#277bf1] font-bold text-xs bg-blue-50 px-6 py-3 rounded-xl">Regresar al Dashboard</button>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-slate-100 px-8 py-5 flex justify-between items-center z-50">
        {[
          { v: 'Dashboard', i: 'dashboard', label: 'Dashboard' },
          { v: 'Horario', i: 'calendar_month', label: 'Horario' },
          { v: 'Alumnos', i: 'school', label: 'Alumnos' },
          { v: 'Ajustes', i: 'settings', label: 'Ajustes' }
        ].map(item => (
          <button 
            key={item.v} 
            onClick={() => setVista(item.v as ViewMode)}
            className={`flex flex-col items-center gap-1.5 transition-all ${vista === item.v ? 'text-[#277bf1]' : 'text-slate-400'}`}
          >
            <span className={`material-icons text-[24px]`}>{item.i}</span>
            <span className={`text-[10px] font-bold ${vista === item.v ? 'opacity-100' : 'opacity-70'} transition-opacity`}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Pop Notifications */}
      {notificacion && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[380px] bg-slate-900 text-white p-5 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-10 duration-500">
          <div className="w-10 h-10 bg-[#277bf1] rounded-xl flex items-center justify-center">
            <span className="material-icons">check</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest">{notificacion.t}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{notificacion.d}</p>
          </div>
        </div>
      )}

      {/* Safe Area Indicator */}
      <div className="h-1.5 w-32 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-2 fixed bottom-2 left-1/2 -translate-x-1/2"></div>
    </div>
  );
};

export default App;