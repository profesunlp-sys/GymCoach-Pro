import React, { useState, useEffect, useRef } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, GrupoConfig } from './types.ts';
import { processClassAudio } from './services/geminiService.ts';

// --- DATABASE CONFIGURATION ---
const db = new Dexie('GymCoachEliteDB_AntigravityV2') as Dexie & {
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

    if (a.length === 0 && g.length === 0) {
      // Seed with sample data if empty
      await db.alumnos.add({
        nombre: 'Atleta Pro', dni: '001', disciplina: 'GAF', nivel: 'Promocional',
        fechaNacimiento: '2015-01-01', fechaIngreso: new Date().toISOString(),
        fechaPrimeraClase: new Date().toISOString(), estadoPago: 'Al día', 
        asistenciasHistoricas: 15, alertas: [], habilidades: [],
        biometria: { fuerza: 70, flexibilidad: 80, tecnica: 60, resistencia: 65, coordinacion: 75 },
        qrCode: 'QR_001'
      });
      loadData();
    }
  };

  useEffect(() => { if (isLoggedIn) loadData(); }, [isLoggedIn]);

  const handleSaveGroup = async () => {
    if (!newGroupName || selectedDays.length === 0) {
      setNotificacion({ t: "Error", d: "Nombre y días obligatorios." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }
    
    await db.grupos.add({
      nombre: newGroupName,
      dias: selectedDays,
      horario: "18:00 - 20:00"
    });
    setNewGroupName("");
    setSelectedDays([]);
    loadData();
    setNotificacion({ t: "Grupo Guardado", d: `El grupo ${newGroupName} está activo.` });
    setTimeout(() => setNotificacion(null), 3000);
  };

  const toggleDay = (dayId: string) => {
    setSelectedDays(prev => prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]);
  };

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
        setNotificacion({ t: "Reporte IA", d: `Sesión de ${newClase.grupo} registrada.` });
        setIsAnalyzing(false);
        setVista('Dashboard');
      } catch (e) {
        setIsAnalyzing(false);
        setNotificacion({ t: "Error", d: "No se pudo interpretar el reporte." });
      }
      setTimeout(() => setNotificacion(null), 3000);
    };
  };

  if (!isLoggedIn) return (
    <div className="auth-bg flex flex-col items-center justify-center p-8 text-white min-h-screen">
      <div className="z-10 w-full max-w-sm text-center page-transition">
        <div className="w-20 h-20 bg-accent-purple rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/10">
          <span className="material-icons-outlined text-white text-4xl">fitness_center</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tighter mb-2">GymCoach <span className="text-primary">Pro</span></h1>
        <p className="text-white/50 text-sm mb-12">High Performance Gymnastics Management</p>
        <button onClick={() => setIsLoggedIn(true)} className="w-full py-5 bg-white text-indigo-900 rounded-[2rem] font-bold uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">
          Iniciar Panel de Control
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-background-light dark:bg-background-dark shadow-2xl relative overflow-hidden flex flex-col font-display pb-32">
      
      {/* iOS Status Bar */}
      <div className="h-11 w-full flex items-center justify-between px-8 pt-4 bg-transparent sticky top-0 z-[60]">
        <span className="text-sm font-semibold dark:text-white">9:41</span>
        <div className="flex gap-2 items-center dark:text-white">
          <span className="material-icons-outlined text-[18px]">signal_cellular_alt</span>
          <span className="material-icons-outlined text-[18px]">wifi</span>
          <span className="material-icons-outlined text-[18px]">battery_full</span>
        </div>
      </div>

      <header className="px-6 py-4 flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-purple rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="material-icons-outlined text-white">fitness_center</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight dark:text-white">
            GymCoach <span className="text-primary">Pro</span>
          </h1>
        </div>
        <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center relative">
          <span className="material-icons-outlined text-slate-400">notifications</span>
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white dark:border-background-dark active-glow"></span>
        </button>
      </header>

      <main className="flex-1 px-6 mt-4 space-y-6 overflow-y-auto">
        
        {vista === 'Dashboard' && (
          <div className="space-y-8 page-transition">
            {/* Gradient Banner */}
            <section className="gradient-header rounded-[2.5rem] p-7 relative overflow-hidden shadow-2xl">
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white mb-1">¡Hola José María!</h2>
                <p className="text-indigo-100 text-sm mb-7">Configura tu semana para empezar.</p>
                <button onClick={() => setVista('NuevaClase')} className="bg-white text-indigo-700 font-bold px-7 py-3.5 rounded-[1.25rem] flex items-center gap-2 shadow-xl active:scale-95 transition-transform text-sm">
                  <span className="material-icons-outlined text-sm">add_circle</span>
                  <span>Registrar Clase</span>
                </button>
              </div>
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl"></div>
            </section>

            {/* Schedule Config */}
            <section className="space-y-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-primary font-bold text-lg active-glow">Configuración de Horario</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs">Define tus días de entrenamiento habituales</p>
              </div>
              
              <div className="glass-card rounded-[2.5rem] p-6 space-y-6">
                <div className="flex justify-between items-center px-1">
                  {['L', 'M', 'M', 'J', 'V'].map((day, idx) => {
                    const id = `${day}-${idx}`;
                    const isSelected = selectedDays.includes(id);
                    return (
                      <button 
                        key={id}
                        onClick={() => toggleDay(id)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                          isSelected 
                            ? 'border-2 border-primary shadow-neon-cyan text-primary' 
                            : 'bg-slate-800/50 text-slate-500'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <input 
                    className="w-full bg-slate-900/40 border-none rounded-2xl px-5 py-4 text-sm dark:text-white placeholder:text-slate-600 focus:ring-1 ring-primary/30"
                    placeholder="Nombre del Grupo (Ej. Avanzados)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>

                <div className="border-2 border-dashed border-slate-700/50 rounded-2xl p-4 flex items-center gap-3">
                  <span className="material-icons-outlined text-primary">more_time</span>
                  <span className="text-slate-400 text-sm italic">Añade horarios para los días seleccionados...</span>
                </div>

                <button 
                  onClick={handleSaveGroup}
                  className="w-full py-4.5 rounded-2xl border border-primary text-primary font-bold flex items-center justify-center gap-2 bg-primary/5 active:bg-primary/10 transition-colors"
                >
                  <span className="material-icons-outlined text-sm">save</span>
                  <span>Guardar Configuración</span>
                </button>
              </div>
            </section>

            {/* Quick Stats Grid */}
            <section className="grid grid-cols-2 gap-4">
              <div className="glass-card rounded-[2rem] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-icons-outlined text-indigo-400 text-sm">calendar_month</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Total Clases</span>
                </div>
                <div className="text-3xl font-bold mb-1 dark:text-white">{clases.length}</div>
                <p className="text-[10px] text-slate-500">Sin actividad hoy</p>
              </div>
              <div className="glass-card rounded-[2rem] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-icons-outlined text-blue-400 text-sm">groups</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Alumnos</span>
                </div>
                <div className="text-3xl font-bold mb-1 dark:text-white">{alumnos.length}</div>
                <button onClick={() => setVista('Alumnos')} className="text-[10px] text-primary font-bold flex items-center gap-1">
                  <span className="material-icons-outlined text-[12px]">person_add</span>
                  Invitar primero
                </button>
              </div>
            </section>

            {/* Configured Groups */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-100 font-bold text-lg">Mis Grupos Configurados</h3>
                <button className="text-primary text-xs font-semibold">Ver todos</button>
              </div>
              <div className="space-y-4">
                {grupos.length > 0 ? grupos.map((g, idx) => (
                  <div key={idx} className="glass-card rounded-[2rem] p-5 flex flex-col gap-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-100 text-base">{g.nombre}</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          {g.dias.map(d => d.split('-')[0]).join(', ')} • {g.horario}
                        </p>
                      </div>
                      <div className="bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1 rounded-lg border border-primary/20">
                        ACTIVE
                      </div>
                    </div>
                    <button onClick={() => setVista('Alumnos')} className="w-full py-3.5 rounded-xl neon-border text-primary font-bold text-sm shadow-neon-cyan flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                      <span className="material-icons-outlined text-sm">fact_check</span>
                      <span>Listas de Asistencia</span>
                    </button>
                  </div>
                )) : (
                  <div className="p-8 text-center glass-card rounded-[2rem] border-dashed border-slate-700/50">
                    <p className="text-slate-500 text-xs font-medium italic">Aún no has configurado grupos.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Help Card */}
            <section className="bg-gradient-to-br from-[#0f172a] to-black rounded-[2.5rem] p-7 border border-slate-800/50 shadow-2xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-11 h-11 bg-slate-800/80 rounded-2xl flex items-center justify-center border border-slate-700/50">
                  <span className="material-icons-outlined text-primary">info</span>
                </div>
                <h3 className="font-bold text-slate-100 text-lg">Primeros Pasos</h3>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Bienvenido a tu panel personalizado. Completa la configuración de tu horario para que podamos ayudarte a organizar tus grupos y asistencias de manera automática.
              </p>
            </section>
          </div>
        )}

        {/* Recording View */}
        {vista === 'NuevaClase' && (
          <div className="space-y-8 page-transition pt-8">
            <div className="glass-card rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden">
              <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-neon-cyan border border-primary/20">
                <span className="material-icons-outlined text-primary text-5xl">mic</span>
              </div>
              <h2 className="text-2xl font-black dark:text-white mb-2 italic tracking-tighter uppercase">Reporte IA</h2>
              <p className="text-sm text-slate-500 mb-12 max-w-[240px] mx-auto font-medium">Describe la sesión de hoy: Calentamiento, Aparatos y Logros.</p>
              
              <div className="relative flex flex-col items-center">
                <button 
                  onMouseDown={startRecording} onMouseUp={stopRecording}
                  onTouchStart={startRecording} onTouchEnd={stopRecording}
                  className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isRecording 
                      ? 'bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.5)] scale-110' 
                      : 'bg-primary shadow-neon-cyan-strong hover:scale-105 active:scale-95'
                  }`}
                >
                  {isRecording ? (
                    <div className="flex gap-2 items-end h-10">
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} className="w-2 bg-white rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`, height: `${40 + Math.random()*60}%`}}></div>
                      ))}
                    </div>
                  ) : (
                    <span className="material-icons-outlined text-white text-5xl">mic</span>
                  )}
                </button>
                <div className="mt-12">
                  <p className="text-[11px] font-black uppercase text-primary tracking-[0.3em] active-glow">
                    {isRecording ? "Grabando... Suelta para procesar" : "Mantén presionado para hablar"}
                  </p>
                </div>
              </div>
            </div>

            {isAnalyzing && (
              <div className="glass-card p-12 rounded-[2.5rem] text-center animate-pulse flex flex-col items-center border-primary/20">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="text-xs font-black uppercase text-primary tracking-widest">IA Procesando Audio...</p>
              </div>
            )}
          </div>
        )}

        {/* Placeholders */}
        {(vista === 'Alumnos' || vista === 'Horario' || vista === 'Ajustes') && (
          <div className="py-32 text-center space-y-6 page-transition">
            <div className="w-20 h-20 glass-card rounded-full flex items-center justify-center mx-auto mb-4 text-slate-700">
               <span className="material-icons-outlined text-5xl">construction</span>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Módulo: {vista}</p>
            <button onClick={() => setVista('Dashboard')} className="text-primary font-bold text-xs bg-primary/10 px-8 py-4 rounded-full border border-primary/20 hover:bg-primary/20 transition-all">
              Volver al Dashboard
            </button>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-background-dark/80 backdrop-blur-xl border-t border-slate-800/50 px-8 pt-4 pb-10 flex justify-between items-center z-50">
        {[
          { v: 'Dashboard', i: 'grid_view' },
          { v: 'Alumnos', i: 'people' },
          { v: 'Horario', i: 'calendar_today' },
          { v: 'Ajustes', i: 'settings' }
        ].map(item => (
          <button 
            key={item.v} 
            onClick={() => setVista(item.v as ViewMode)}
            className={`flex flex-col items-center gap-1.5 transition-all ${vista === item.v ? 'text-primary active-glow' : 'text-slate-500'}`}
          >
            <span className="material-icons-outlined text-[26px]">{item.i}</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.v}</span>
          </button>
        ))}
      </nav>

      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-800 rounded-full z-[60]"></div>

      {/* Notifications */}
      {notificacion && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[380px] bg-[#0A1A2F]/90 backdrop-blur-xl text-white p-5 rounded-3xl shadow-neon-cyan border border-white/10 flex items-center gap-4 animate-in slide-in-from-top-12 duration-500">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30">
            <span className="material-icons-outlined text-primary">auto_awesome</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{notificacion.t}</p>
            <p className="text-[11px] text-slate-300 font-medium mt-1">{notificacion.d}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;