import React, { useState, useEffect, useRef } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, GrupoConfig, ContactoFamilia } from './types.ts';
import { processClassAudio } from './services/geminiService.ts';

// --- DATABASE CONFIGURATION ---
const db = new Dexie('GymCoachEliteDB_AntigravityV5') as Dexie & {
  alumnos: EntityTable<Alumno, 'id'>;
  clases: EntityTable<Clase, 'id'>;
  grupos: EntityTable<GrupoConfig, 'id'>;
};

db.version(2).stores({
  alumnos: '++id, dni, nombre, estadoPago, disciplina, grupo',
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
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:00");

  // Selected Group Context
  const [activeGroup, setActiveGroup] = useState<GrupoConfig | null>(null);

  // Student Form State
  const [studentForm, setStudentForm] = useState<Partial<Alumno>>({
    nombre: '',
    dni: '',
    disciplina: 'GAF',
    nivel: 'Iniciación',
    fechaNacimiento: '',
    fechaPrimeraClase: new Date().toISOString().split('T')[0],
    alertas: [],
    contacto: {
      padreNombre: '', padreTelefono: '',
      madreNombre: '', madreTelefono: '',
      emergenciaNombre: '', emergenciaTelefono: ''
    }
  });
  
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
    setNotificacion({ t: "Éxito", d: `Grupo ${newGroupName} configurado.` });
    setTimeout(() => setNotificacion(null), 3000);
  };

  const handleSaveStudent = async () => {
    if (!studentForm.nombre || !studentForm.dni) {
      setNotificacion({ t: "Error", d: "Nombre y DNI son obligatorios." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }

    const newStudent: Alumno = {
      ...studentForm as Alumno,
      grupo: activeGroup?.nombre || 'Sin Grupo',
      fechaIngreso: new Date().toISOString(),
      estadoPago: 'Al día',
      habilidades: [],
      biometria: { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 },
      qrCode: `QR_${studentForm.dni}`,
      asistenciasHistoricas: 0
    };

    await db.alumnos.add(newStudent);
    loadData();
    setNotificacion({ t: "Atleta Registrado", d: `${newStudent.nombre} ha sido añadido al grupo.` });
    setVista('Dashboard');
    // Reset form
    setStudentForm({
      nombre: '', dni: '', disciplina: 'GAF', nivel: 'Iniciación',
      fechaNacimiento: '', fechaPrimeraClase: new Date().toISOString().split('T')[0],
      alertas: [], contacto: { padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '', emergenciaNombre: '', emergenciaTelefono: '' }
    });
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
        setNotificacion({ t: "IA Assistant", d: `Clase registrada correctamente.` });
        setIsAnalyzing(false);
        setVista('Dashboard');
      } catch (e) {
        setIsAnalyzing(false);
        setNotificacion({ t: "Error", d: "No se pudo interpretar el reporte." });
      }
      setTimeout(() => setNotificacion(null), 3000);
    };
  };

  const timeIntervals = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"];

  if (!isLoggedIn) return (
    <div className="auth-bg flex flex-col items-center justify-center p-8 text-white min-h-screen">
      <div className="z-10 w-full max-w-sm text-center page-transition">
        <div className="w-20 h-20 bg-accent-purple rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/10">
          <span className="material-icons-outlined text-white text-4xl">fitness_center</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tighter mb-2">GymCoach <span className="text-primary">Pro</span></h1>
        <p className="text-white/50 text-sm mb-12">High Performance Gymnastics Management</p>
        <button onClick={() => setIsLoggedIn(true)} className="w-full py-5 bg-white text-indigo-900 rounded-[2rem] font-bold uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">
          Acceder al Sistema
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-background-light dark:bg-background-dark shadow-2xl relative overflow-hidden flex flex-col font-display pb-32">
      
      {/* Status Bar */}
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

      <main className="flex-1 px-6 mt-4 space-y-8 overflow-y-auto">
        
        {vista === 'Dashboard' && (
          <div className="space-y-8 page-transition">
            {/* Banner Principal */}
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
            </section>

            {/* Configuración Formulario */}
            <section className="space-y-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-primary font-bold text-lg active-glow">Configuración de Horario</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs">Define tus días de entrenamiento habituales</p>
              </div>
              
              <div className="glass-card rounded-[2.5rem] p-6 space-y-6">
                <div className="flex justify-between items-center px-1">
                  {['L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => {
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

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Nombre del Grupo</label>
                    <input 
                      className="w-full bg-slate-900/40 border-none rounded-2xl px-5 py-4 text-sm dark:text-white placeholder:text-slate-600 focus:ring-1 ring-primary/30"
                      placeholder="Ej. Avanzados"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Desde</label>
                      <select 
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-slate-900/40 border-none rounded-2xl px-4 py-3 text-sm dark:text-white focus:ring-1 ring-primary/30 appearance-none"
                      >
                        {timeIntervals.map(t => <option key={t} value={t} className="bg-background-dark">{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Hasta</label>
                      <select 
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-slate-900/40 border-none rounded-2xl px-4 py-3 text-sm dark:text-white focus:ring-1 ring-primary/30 appearance-none"
                      >
                        {timeIntervals.map(t => <option key={t} value={t} className="bg-background-dark">{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSaveGroup}
                  className="w-full py-4.5 rounded-2xl border border-primary text-primary font-bold flex items-center justify-center gap-2 bg-primary/5 active:bg-primary/10 transition-colors shadow-neon-cyan"
                >
                  <span className="material-icons-outlined text-sm">save</span>
                  <span>Guardar Configuración</span>
                </button>
              </div>
            </section>

            {/* Listado de Grupos Configurados */}
            {grupos.length > 0 && (
              <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-white font-bold text-lg tracking-tight">Mis Grupos Configurados</h3>
                  <button className="text-primary text-xs font-semibold hover:underline">Ver todos</button>
                </div>
                <div className="space-y-4">
                  {grupos.map((g, idx) => (
                    <div key={idx} className="glass-card rounded-[1.5rem] p-6 flex flex-col gap-5 border border-white/5">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-lg tracking-tight">{g.nombre}</h4>
                          <p className="text-xs text-slate-400 mt-1 font-medium italic">
                            {g.dias.map(d => {
                              const map: any = {L:'Lun', M:'Mar', Mi:'Mié', J:'Jue', V:'Vie', S:'Sáb'};
                              return map[d.split('-')[0]] || d.split('-')[0];
                            }).join(', ')} • {g.horario}
                          </p>
                        </div>
                        <div className="bg-[#0f2a30] text-primary text-[10px] font-bold px-3 py-1 rounded-lg border border-primary/20 tracking-widest shadow-neon-cyan">
                          ACTIVE
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setActiveGroup(g);
                          setVista('RegistroAlumno');
                        }} 
                        className="w-full py-3.5 rounded-2xl neon-border text-primary font-bold text-sm shadow-neon-cyan flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all bg-primary/5"
                      >
                        <span className="material-icons-outlined text-[20px]">fact_check</span>
                        <span>Listas de Asistencia</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Info Card */}
            <section className="bg-gradient-to-br from-[#0f172a] to-black rounded-[2.5rem] p-7 border border-slate-800/50 shadow-2xl space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-800/80 rounded-2xl flex items-center justify-center border border-slate-700/50 shadow-inner">
                  <span className="material-icons-outlined text-primary text-2xl">info</span>
                </div>
                <h3 className="font-bold text-slate-100 text-xl tracking-tight leading-none">Primeros Pasos</h3>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                Bienvenido a tu panel personalizado. Completa la configuración de tu horario para que podamos ayudarte a organizar tus grupos y asistencias de manera automática.
              </p>
            </section>
          </div>
        )}

        {/* VISTA DE REGISTRO DE ALUMNO (Listas de Asistencia) */}
        {vista === 'RegistroAlumno' && activeGroup && (
          <div className="space-y-8 page-transition pb-12">
            <div className="flex items-center gap-4 px-1">
              <button onClick={() => setVista('Dashboard')} className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-primary">
                <span className="material-icons-outlined">arrow_back</span>
              </button>
              <div>
                <h2 className="text-white font-bold text-xl">{activeGroup.nombre}</h2>
                <p className="text-primary text-[10px] font-bold uppercase tracking-widest">Añadir Atletas a la Lista</p>
              </div>
            </div>

            <div className="glass-card rounded-[2.5rem] p-6 space-y-8">
              {/* Sección 1: Datos Personales */}
              <div className="space-y-4">
                <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Datos Personales</h4>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Nombre y Apellido</label>
                    <input 
                      className="w-full bg-slate-900/40 border-none rounded-2xl px-5 py-3.5 text-sm dark:text-white"
                      value={studentForm.nombre}
                      onChange={(e) => setStudentForm({...studentForm, nombre: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">DNI</label>
                      <input 
                        className="w-full bg-slate-900/40 border-none rounded-2xl px-5 py-3.5 text-sm dark:text-white"
                        value={studentForm.dni}
                        onChange={(e) => setStudentForm({...studentForm, dni: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">F. Nacimiento</label>
                      <input 
                        type="date"
                        className="w-full bg-slate-900/40 border-none rounded-2xl px-4 py-3 text-sm dark:text-white"
                        value={studentForm.fechaNacimiento}
                        onChange={(e) => setStudentForm({...studentForm, fechaNacimiento: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 2: Datos Federativos y Salud */}
              <div className="space-y-4">
                <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Información Médica y Federativa</h4>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Datos de Salud / Alergias</label>
                    <textarea 
                      className="w-full bg-slate-900/40 border-none rounded-2xl px-5 py-3.5 text-sm dark:text-white h-24"
                      placeholder="Indique afecciones, alergias o cuidados especiales..."
                      onChange={(e) => setStudentForm({...studentForm, alertas: [e.target.value]})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Datos Federativos</label>
                    <input 
                      className="w-full bg-slate-900/40 border-none rounded-2xl px-5 py-3.5 text-sm dark:text-white"
                      placeholder="Nº Licencia, Club Anterior..."
                      onChange={(e) => setStudentForm({...studentForm, datosFederativos: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Día Inicio Clases (Trial)</label>
                    <input 
                      type="date"
                      className="w-full bg-slate-900/40 border-none rounded-2xl px-5 py-3.5 text-sm dark:text-white"
                      value={studentForm.fechaPrimeraClase}
                      onChange={(e) => setStudentForm({...studentForm, fechaPrimeraClase: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Contactos Familiares */}
              <div className="space-y-4">
                <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Contactos de Familia</h4>
                <div className="space-y-6">
                  {/* Padre */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Nombre Padre</label>
                      <input className="w-full bg-slate-900/40 border-none rounded-2xl px-4 py-3 text-xs dark:text-white" 
                             onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, padreNombre: e.target.value}})}/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Tel. Padre</label>
                      <input className="w-full bg-slate-900/40 border-none rounded-2xl px-4 py-3 text-xs dark:text-white" 
                             onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, padreTelefono: e.target.value}})}/>
                    </div>
                  </div>
                  {/* Madre */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Nombre Madre</label>
                      <input className="w-full bg-slate-900/40 border-none rounded-2xl px-4 py-3 text-xs dark:text-white" 
                             onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, madreNombre: e.target.value}})}/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Tel. Madre</label>
                      <input className="w-full bg-slate-900/40 border-none rounded-2xl px-4 py-3 text-xs dark:text-white" 
                             onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, madreTelefono: e.target.value}})}/>
                    </div>
                  </div>
                  {/* Emergencia */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Contacto Emergencia</label>
                      <input className="w-full bg-slate-900/40 border-none rounded-2xl px-4 py-3 text-xs dark:text-white" 
                             onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, emergenciaNombre: e.target.value}})}/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Tel. Emergencia</label>
                      <input className="w-full bg-slate-900/40 border-none rounded-2xl px-4 py-3 text-xs dark:text-white" 
                             onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, emergenciaTelefono: e.target.value}})}/>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSaveStudent}
                className="w-full py-5 rounded-2xl bg-primary text-background-dark font-black uppercase tracking-widest text-xs shadow-neon-cyan active:scale-95 transition-all"
              >
                Registrar Atleta en {activeGroup.nombre}
              </button>
            </div>
          </div>
        )}

        {/* Grabación IA */}
        {vista === 'NuevaClase' && (
          <div className="space-y-8 page-transition pt-8">
            <div className="glass-card rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden">
              <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-neon-cyan border border-primary/20">
                <span className="material-icons-outlined text-primary text-5xl">mic</span>
              </div>
              <h2 className="text-2xl font-black dark:text-white mb-2 italic tracking-tighter uppercase">Reporte IA</h2>
              <p className="text-sm text-slate-500 mb-12 max-w-[240px] mx-auto font-medium">Habla sobre el entrenamiento de hoy.</p>
              <div className="relative flex flex-col items-center">
                <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                  className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 ${isRecording ? 'bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.5)] scale-110' : 'bg-primary shadow-neon-cyan-strong hover:scale-105 active:scale-95'}`}>
                  {isRecording ? <div className="flex gap-2 items-end h-10">{[1,2,3,4,5,6].map(i => (<div key={i} className="w-2 bg-white rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`, height: `${40 + Math.random()*60}%`}}></div>))}</div> : <span className="material-icons-outlined text-white text-5xl">mic</span>}
                </button>
                <div className="mt-12"><p className="text-[11px] font-black uppercase text-primary tracking-[0.3em] active-glow">{isRecording ? "Grabando..." : "Mantén para hablar"}</p></div>
              </div>
            </div>
            {isAnalyzing && <div className="glass-card p-12 rounded-[2.5rem] text-center animate-pulse flex flex-col items-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div><p className="text-xs font-black uppercase text-primary tracking-widest">Analizando...</p></div>}
          </div>
        )}

        {/* Placeholders */}
        {(vista === 'Alumnos' || vista === 'Horario' || vista === 'Ajustes') && (
          <div className="py-32 text-center space-y-6 page-transition">
            <div className="w-20 h-20 glass-card rounded-full flex items-center justify-center mx-auto mb-4 text-slate-700">
               <span className="material-icons-outlined text-5xl">construction</span>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Módulo: {vista}</p>
            <button onClick={() => setVista('Dashboard')} className="text-primary font-bold text-xs bg-primary/10 px-8 py-4 rounded-full border border-primary/20">
              Regresar
            </button>
          </div>
        )}
      </main>

      {/* Navegación Inferior */}
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

      {/* Notificaciones */}
      {notificacion && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[380px] bg-[#0A1A2F]/90 backdrop-blur-xl text-white p-5 rounded-3xl shadow-neon-cyan border border-white/10 flex items-center gap-4 animate-in slide-in-from-top-12 duration-500">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30">
            <span className="material-icons-outlined text-primary">check_circle</span>
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