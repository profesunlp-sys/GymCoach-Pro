import React, { useState, useEffect, useRef } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, GrupoConfig } from './types.ts';
import { processClassAudio } from './services/geminiService.ts';

// --- DATABASE CONFIGURATION ---
const db = new Dexie('GymCoachEliteDB_Antigravity') as Dexie & {
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
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  
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
      // Seed with some dummy data if needed
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
      horario: `${startTime} - ${endTime}`
    });
    setNewGroupName("");
    setSelectedDays([]);
    loadData();
    setNotificacion({ t: "Grupo Creado", d: `El grupo ${newGroupName} ha sido guardado.` });
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
        setNotificacion({ t: "Registro IA", d: `Clase procesada con éxito.` });
        setIsAnalyzing(false);
        setVista('Dashboard');
      } catch (e) {
        setIsAnalyzing(false);
        setNotificacion({ t: "Error IA", d: "No se pudo interpretar el reporte." });
      }
      setTimeout(() => setNotificacion(null), 4000);
    };
  };

  const timeOptions = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];

  if (!isLoggedIn) return (
    <div className="auth-bg flex flex-col items-center justify-center p-8 text-white min-h-screen">
      <div className="z-10 w-full max-w-sm text-center page-transition">
        <div className="w-24 h-24 bg-white/10 glass-effect rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/20">
          <span className="material-icons-round text-primary text-5xl">fitness_center</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tighter mb-2">GymCoach <span className="text-primary">Pro</span></h1>
        <p className="text-white/60 text-sm mb-12">Elite Gymnastics Management</p>
        <button onClick={() => setIsLoggedIn(true)} className="w-full py-5 bg-white text-accent-blue rounded-full font-bold uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">
          Sincronizar Terminal
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-background-light dark:bg-background-dark shadow-2xl relative overflow-hidden flex flex-col font-display">
      
      {/* iOS Bar */}
      <div className="h-12 w-full flex items-center justify-between px-6 pt-2 bg-transparent sticky top-0 z-[60]">
        <span className="text-sm font-semibold dark:text-white">9:41</span>
        <div className="flex gap-1.5 items-center dark:text-white">
          <span className="material-icons-round text-[18px]">signal_cellular_alt</span>
          <span className="material-icons-round text-[18px]">wifi</span>
          <span className="material-icons-round text-[18px]">battery_full</span>
        </div>
      </div>

      <header className="px-6 py-4 flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-blue rounded-xl flex items-center justify-center shadow-lg">
            <span className="material-icons-round text-white">fitness_center</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight dark:text-white">
            GymCoach <span className="text-accent-blue">Pro</span>
          </h1>
        </div>
        <button className="w-10 h-10 rounded-full bg-slate-200 dark:bg-card-dark flex items-center justify-center relative">
          <span className="material-icons-round text-slate-600 dark:text-slate-400">notifications</span>
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-background-dark"></span>
        </button>
      </header>

      <main className="flex-1 px-6 pb-24 overflow-y-auto space-y-8">
        
        {vista === 'Dashboard' && (
          <div className="space-y-8 page-transition">
            {/* Main Banner */}
            <section className="antigravity-gradient rounded-[32px] p-7 mt-2 relative overflow-hidden shadow-glow-purple">
              <div className="relative z-10">
                <h2 className="text-2xl font-extrabold text-white mb-1">¡Hola José María!</h2>
                <p className="text-white/80 text-sm mb-8">Configura tu semana para empezar.</p>
                <button onClick={() => setVista('NuevaClase')} className="bg-white text-accent-blue font-bold px-7 py-3.5 rounded-full flex items-center gap-3 shadow-xl active:scale-95 transition-transform text-sm">
                  <span className="material-icons-round text-lg">add_circle</span>
                  Registrar Clase
                </button>
              </div>
              <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-accent-purple/30 rounded-full blur-2xl"></div>
            </section>

            {/* Schedule Config */}
            <section className="space-y-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-primary active-glow">Configuración de Horario</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Define tus días de entrenamiento habituales</p>
              </div>
              
              <div className="bg-slate-100 dark:bg-card-dark/50 border border-slate-200 dark:border-white/5 rounded-[32px] p-7 space-y-8">
                {/* Day Selectors */}
                <div className="flex justify-between items-center">
                  {['L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => {
                    const id = `${day}-${idx}`;
                    const isSelected = selectedDays.includes(id);
                    return (
                      <button 
                        key={id}
                        onClick={() => toggleDay(id)}
                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/10 text-primary shadow-neon' 
                            : 'border-slate-300 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Group Name Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Nombre del Grupo</label>
                  <input 
                    className="w-full bg-white dark:bg-black/20 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 ring-primary/30 dark:text-white ios-input-shadow font-medium"
                    placeholder="Ej. Avanzados"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Desde</label>
                    <div className="relative">
                      <select 
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full neon-border rounded-2xl bg-white dark:bg-black/20 p-4 font-bold text-sm appearance-none focus:ring-0 dark:text-white"
                      >
                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="material-icons-round text-primary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Hasta</label>
                    <div className="relative">
                      <select 
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full neon-border rounded-2xl bg-white dark:bg-black/20 p-4 font-bold text-sm appearance-none focus:ring-0 dark:text-white"
                      >
                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="material-icons-round text-primary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSaveGroup}
                  className="w-full neon-border bg-primary/10 hover:bg-primary/20 text-primary py-5 rounded-[20px] font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <span className="material-icons-round text-xl">save</span>
                  Guardar Configuración
                </button>
              </div>
            </section>

            {/* Quick Stats */}
            <section className="grid grid-cols-2 gap-4">
              <div className="bg-slate-100 dark:bg-card-dark p-6 rounded-[32px] border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-icons-round text-accent-blue text-sm">calendar_today</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Clases</span>
                </div>
                <div className="text-4xl font-black mb-1 dark:text-white">{clases.length}</div>
                <p className="text-[10px] text-slate-400">Actividad del mes</p>
              </div>
              <div className="bg-slate-100 dark:bg-card-dark p-6 rounded-[32px] border border-slate-200 dark:border-white/5 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-icons-round text-accent-blue text-sm">group</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Alumnos</span>
                </div>
                <div className="text-4xl font-black mb-1 dark:text-white">{alumnos.length}</div>
                <button onClick={() => setVista('Alumnos')} className="text-[10px] text-primary font-bold flex items-center gap-1">
                  <span className="material-icons-round text-[12px]">person_add</span>
                  Añadir primero
                </button>
                <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/5 blur-xl rounded-full"></div>
              </div>
            </section>

            {/* Info Card */}
            <section className="bg-gradient-to-br from-[#0A1A2F] to-[#040911] border border-white/5 p-7 rounded-[32px] shadow-2xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                  <span className="material-icons-round text-primary">info</span>
                </div>
                <h4 className="font-bold text-white text-lg">Primeros Pasos</h4>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Bienvenido a tu panel personalizado. Completa la configuración de tu horario para que podamos ayudarte a organizar tus grupos y asistencias de manera automática.
              </p>
            </section>
          </div>
        )}

        {vista === 'NuevaClase' && (
          <div className="space-y-8 page-transition pt-4">
            <div className="bg-slate-100 dark:bg-card-dark rounded-[40px] p-10 text-center border border-slate-200 dark:border-white/5 shadow-2xl">
              <div className="w-24 h-24 bg-primary/10 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-neon border border-primary/20">
                <span className="material-icons-round text-primary text-5xl">mic</span>
              </div>
              <h2 className="text-2xl font-black dark:text-white mb-2 italic tracking-tighter uppercase">Reporte IA Pro</h2>
              <p className="text-sm text-slate-500 mb-12 max-w-[240px] mx-auto font-medium">Describe la sesión de hoy: Calentamiento, Aparatos y Logros.</p>
              
              <div className="relative flex flex-col items-center">
                <button 
                  onMouseDown={startRecording} onMouseUp={stopRecording}
                  onTouchStart={startRecording} onTouchEnd={stopRecording}
                  className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isRecording 
                      ? 'bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)] scale-110' 
                      : 'bg-primary shadow-neon hover:scale-105 active:scale-95'
                  }`}
                >
                  {isRecording ? (
                    <div className="flex gap-2 items-end h-10">
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} className="w-2 bg-white rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`, height: `${40 + Math.random()*60}%`}}></div>
                      ))}
                    </div>
                  ) : (
                    <span className="material-icons-round text-white text-5xl">mic</span>
                  )}
                </button>
                <div className="mt-12">
                  <p className="text-[11px] font-black uppercase text-primary tracking-[0.3em] active-glow">
                    {isRecording ? "Sincronizando Voz..." : "Mantén presionado"}
                  </p>
                </div>
              </div>
            </div>

            {isAnalyzing && (
              <div className="bg-primary/5 p-12 rounded-[32px] border border-primary/20 text-center animate-pulse flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="text-xs font-black uppercase text-primary tracking-widest">IA Interpretando Reporte...</p>
              </div>
            )}
          </div>
        )}

        {(vista === 'Alumnos' || vista === 'Horario' || vista === 'Ajustes') && (
          <div className="py-32 text-center space-y-6 page-transition">
            <div className="w-20 h-20 bg-slate-100 dark:bg-card-dark rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-700">
               <span className="material-icons-round text-5xl">construction</span>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Módulo: {vista}</p>
            <button onClick={() => setVista('Dashboard')} className="bg-primary/10 text-primary font-bold text-xs px-8 py-4 rounded-full border border-primary/20 hover:bg-primary/20 transition-all">
              Volver al Centro de Control
            </button>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/90 dark:bg-background-dark/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 px-8 pt-4 pb-10 flex justify-between items-center z-50">
        {[
          { v: 'Dashboard', i: 'dashboard' },
          { v: 'Alumnos', i: 'groups' },
          { v: 'Horario', i: 'calendar_month' },
          { v: 'Ajustes', i: 'settings' }
        ].map(item => (
          <button 
            key={item.v} 
            onClick={() => setVista(item.v as ViewMode)}
            className={`flex flex-col items-center gap-1.5 transition-all ${vista === item.v ? 'text-primary active-glow' : 'text-slate-400 dark:text-slate-600'}`}
          >
            <span className="material-icons-round text-[26px]">{item.i}</span>
            <span className="text-[10px] font-black uppercase tracking-tighter">{item.v}</span>
          </button>
        ))}
      </nav>

      <div className="fixed bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full z-[60]"></div>

      {/* Notifications */}
      {notificacion && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[380px] bg-[#0A1A2F]/95 backdrop-blur-xl text-white p-5 rounded-3xl shadow-glow-purple border border-white/10 flex items-center gap-4 animate-in slide-in-from-top-12 duration-500">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30">
            <span className="material-icons-round text-primary">auto_awesome</span>
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