import React, { useState, useEffect, useRef } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, GrupoConfig, AsistenciaRecord } from './types.ts';
import { processClassAudio } from './services/geminiService.ts';

// --- DATABASE CONFIGURATION ---
const db = new Dexie('GymCoachEliteDB_AntigravityV6') as Dexie & {
  alumnos: EntityTable<Alumno, 'id'>;
  clases: EntityTable<Clase, 'id'>;
  grupos: EntityTable<GrupoConfig, 'id'>;
  asistencias: EntityTable<AsistenciaRecord, 'id'>;
};

db.version(3).stores({
  alumnos: '++id, dni, nombre, estadoPago, disciplina, grupo',
  clases: '++id, fecha, grupo',
  grupos: '++id, nombre',
  asistencias: '++id, fecha, alumnoId, grupo'
});

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vista, setVista] = useState<ViewMode>('Dashboard');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [grupos, setGrupos] = useState<GrupoConfig[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<Record<number, boolean>>({});
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Group Form State
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:00");

  // Selected Group Context
  const [activeGroup, setActiveGroup] = useState<GrupoConfig | null>(null);

  // Student Form State
  const [studentForm, setStudentForm] = useState<Partial<Alumno>>({
    nombre: '', dni: '', disciplina: 'GAF', nivel: 'Escuela',
    fechaNacimiento: '', fechaPrimeraClase: new Date().toISOString().split('T')[0],
    alertas: [],
    contacto: {
      padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '',
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

    // Load today's attendance if in AsistenciaLista
    if (activeGroup) {
      const today = new Date().toISOString().split('T')[0];
      const todayAttendance = await db.asistencias
        .where('fecha')
        .equals(today)
        .and(record => record.grupo === activeGroup.nombre)
        .toArray();
      
      const attMap: Record<number, boolean> = {};
      todayAttendance.forEach(r => attMap[r.alumnoId] = r.presente);
      setAsistenciasHoy(attMap);
    }
  };

  useEffect(() => { if (isLoggedIn) loadData(); }, [isLoggedIn, activeGroup]);

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
    setNotificacion({ t: "Atleta Registrado", d: `${newStudent.nombre} añadido.` });
    setVista('AsistenciaLista');
    setTimeout(() => setNotificacion(null), 3000);
  };

  const toggleAttendance = async (alumnoId: number) => {
    const today = new Date().toISOString().split('T')[0];
    const isPresent = !asistenciasHoy[alumnoId];
    
    setAsistenciasHoy(prev => ({ ...prev, [alumnoId]: isPresent }));

    const existing = await db.asistencias
      .where({ fecha: today, alumnoId: alumnoId })
      .first();

    if (existing) {
      await db.asistencias.update(existing.id!, { presente: isPresent });
    } else {
      await db.asistencias.add({
        fecha: today,
        alumnoId: alumnoId,
        grupo: activeGroup?.nombre || 'General',
        presente: isPresent
      });
    }
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
        setNotificacion({ t: "Error", d: "No se pudo interpretar." });
      }
      setTimeout(() => setNotificacion(null), 3000);
    };
  };

  const filteredAlumnos = alumnos.filter(a => 
    a.grupo === activeGroup?.nombre && 
    (a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || a.dni.includes(searchQuery))
  );

  const presentCount = Object.values(asistenciasHoy).filter(v => v).length;

  if (!isLoggedIn) return (
    <div className="auth-bg flex flex-col items-center justify-center p-8 text-white min-h-screen">
      <div className="z-10 w-full max-w-sm text-center page-transition">
        <div className="w-20 h-20 bg-accent-purple rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/10">
          <span className="material-icons-outlined text-white text-4xl">fitness_center</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tighter mb-2">GymCoach <span className="text-primary">Pro</span></h1>
        <p className="text-white/50 text-sm mb-12 italic uppercase tracking-widest">Elite Gymnastics Management</p>
        <button onClick={() => setIsLoggedIn(true)} className="w-full py-5 bg-white text-indigo-900 rounded-[2rem] font-bold uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">
          Iniciar Panel de Control
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-background-light dark:bg-background-dark shadow-2xl relative overflow-hidden flex flex-col font-display pb-32">
      
      {/* Header Fijo */}
      <div className="h-11 w-full flex items-center justify-between px-8 pt-4 bg-transparent sticky top-0 z-[60]">
        <span className="text-sm font-semibold dark:text-white">9:41</span>
        <div className="flex gap-2 items-center dark:text-white">
          <span className="material-icons-outlined text-[18px]">signal_cellular_alt</span>
          <span className="material-icons-outlined text-[18px]">wifi</span>
          <span className="material-icons-outlined text-[18px]">battery_full</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        
        {vista === 'Dashboard' && (
          <div className="px-6 space-y-8 page-transition pt-4">
            <header className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent-purple rounded-xl flex items-center justify-center shadow-lg">
                  <span className="material-icons-outlined text-white">fitness_center</span>
                </div>
                <h1 className="text-xl font-bold dark:text-white">GymCoach <span className="text-primary">Pro</span></h1>
              </div>
              <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center">
                <span className="material-icons-outlined text-slate-400">notifications</span>
              </button>
            </header>

            <section className="gradient-header rounded-[2.5rem] p-7 relative overflow-hidden shadow-2xl">
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">¡Hola José María!</h2>
                <p className="text-indigo-100 text-sm mb-7">Configura tu semana para empezar.</p>
                <button onClick={() => setVista('NuevaClase')} className="bg-white text-indigo-700 font-bold px-7 py-3.5 rounded-[1.25rem] flex items-center gap-2 shadow-xl text-sm">
                  <span className="material-icons-outlined text-sm">add_circle</span> Registrar Clase
                </button>
              </div>
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            </section>

            <section className="space-y-4">
              <h3 className="text-primary font-bold text-lg active-glow">Configuración de Horario</h3>
              <div className="glass-card rounded-[2.5rem] p-6 space-y-6">
                <div className="flex justify-between items-center px-1">
                  {['L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => {
                    const id = `${day}-${idx}`;
                    const isSelected = selectedDays.includes(id);
                    return (
                      <button key={id} onClick={() => setSelectedDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])}
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm transition-all ${isSelected ? 'border-2 border-primary shadow-neon-cyan text-primary' : 'bg-slate-800/50 text-slate-500'}`}>
                        {day}
                      </button>
                    );
                  })}
                </div>
                <input className="w-full bg-slate-900/40 border-none rounded-2xl px-5 py-4 text-sm dark:text-white placeholder:text-slate-600 focus:ring-1 ring-primary/30"
                  placeholder="Nombre del Grupo (Ej. Avanzados)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                <button onClick={handleSaveGroup} className="w-full py-4.5 rounded-2xl border border-primary text-primary font-bold bg-primary/5 shadow-neon-cyan">
                  <span>Guardar Configuración</span>
                </button>
              </div>
            </section>

            {/* Listado de Grupos */}
            <section className="space-y-4">
              <div className="flex justify-between px-1"><h3 className="text-white font-bold text-lg">Mis Grupos Configurados</h3><span className="text-primary text-xs font-semibold">Ver todos</span></div>
              {grupos.length > 0 ? grupos.map((g, idx) => (
                <div key={idx} className="glass-card rounded-[1.5rem] p-6 space-y-5">
                  <div className="flex justify-between">
                    <div><h4 className="font-bold text-white text-lg">{g.nombre}</h4><p className="text-xs text-slate-400 mt-1 italic">{g.horario}</p></div>
                    <div className="bg-[#0f2a30] text-primary text-[10px] font-bold px-3 py-1.5 rounded-lg border border-primary/20 tracking-wider h-fit">ACTIVE</div>
                  </div>
                  <button onClick={() => { setActiveGroup(g); setVista('AsistenciaLista'); }} className="w-full py-3.5 rounded-2xl neon-border text-primary font-bold text-sm shadow-neon-cyan flex items-center justify-center gap-2 bg-primary/5">
                    <span className="material-icons-outlined text-[20px]">fact_check</span> Listas de Asistencia
                  </button>
                </div>
              )) : (
                <div className="p-10 text-center glass-card rounded-[2rem] border-dashed border-slate-700/50 italic text-slate-500 text-xs">Configura un grupo para ver asistencia.</div>
              )}
            </section>
          </div>
        )}

        {/* VISTA: LISTA DE ASISTENCIA (Pantalla de la silueta + toggle) */}
        {vista === 'AsistenciaLista' && activeGroup && (
          <div className="page-transition flex flex-col min-h-screen relative pb-32">
            <header className="px-6 py-6 bg-background-dark sticky top-11 z-40 border-b border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setVista('Dashboard')} className="w-10 h-10 flex items-center justify-center rounded-full glass-card text-white">
                  <span className="material-icons-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="text-[10px] font-black tracking-[0.3em] uppercase text-white/40">Control de Asistencia</h1>
                <button onClick={() => setVista('ReportePDF')} className="text-primary text-xs font-bold border border-primary/30 px-3 py-1.5 rounded-lg">PDF</button>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tighter">{activeGroup.nombre}</h2>
                  <p className="text-primary text-xs font-bold flex items-center gap-2 mt-1 active-glow">
                    <span className="material-icons-outlined text-[16px]">schedule</span> {activeGroup.horario}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Presentes</span>
                  <div className="text-2xl font-black text-primary active-glow">{presentCount}<span className="text-white/20 mx-1 font-light italic">/</span>{filteredAlumnos.length}</div>
                </div>
              </div>
            </header>

            <div className="px-6 py-4 sticky top-[160px] z-40 bg-background-dark/80 backdrop-blur-md">
              <div className="relative">
                <span className="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xl">search</span>
                <input 
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary/50 text-white placeholder:text-slate-600" 
                  placeholder="Buscar atleta por nombre o DNI..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <main className="px-6 space-y-4">
              {filteredAlumnos.length > 0 ? filteredAlumnos.map(alumno => (
                <div key={alumno.id} className="flex items-center justify-between p-4 rounded-3xl glass-card animate-in fade-in slide-in-from-right-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center overflow-hidden border border-white/5">
                        <span className="material-icons-outlined text-slate-600 text-3xl">account_circle</span>
                      </div>
                      {asistenciasHoy[alumno.id!] && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-background-dark active-glow"></div>}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white leading-none">{alumno.nombre}</h4>
                      <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1.5">{alumno.nivel}</p>
                    </div>
                  </div>
                  
                  {/* iOS Style Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={asistenciasHoy[alumno.id!] || false}
                      onChange={() => toggleAttendance(alumno.id!)}
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/60 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary/80 shadow-inner"></div>
                  </label>
                </div>
              )) : (
                <div className="py-20 text-center flex flex-col items-center space-y-6 opacity-30">
                  <span className="material-icons-outlined text-[80px]">person_off</span>
                  <p className="text-sm font-medium italic">No hay atletas en este grupo.<br/>Usa el botón inferior para añadir uno.</p>
                </div>
              )}
            </main>

            <button 
              onClick={() => setVista('RegistroAlumno')}
              className="fixed bottom-28 right-6 w-16 h-16 bg-primary text-background-dark rounded-3xl flex items-center justify-center shadow-neon-cyan active:scale-90 transition-all z-[100]"
            >
              <span className="material-symbols-outlined text-4xl">person_add</span>
            </button>
          </div>
        )}

        {/* VISTA: REGISTRO ALUMNO (Formulario detallado) */}
        {vista === 'RegistroAlumno' && activeGroup && (
          <div className="space-y-8 page-transition pb-12 px-6 pt-4">
            <header className="flex items-center gap-4">
              <button onClick={() => setVista('AsistenciaLista')} className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-primary">
                <span className="material-icons-outlined">arrow_back</span>
              </button>
              <div><h2 className="text-white font-bold text-xl uppercase tracking-tighter">Ficha de Inscripción</h2><p className="text-primary text-[10px] font-black uppercase tracking-widest">Grupo: {activeGroup.nombre}</p></div>
            </header>

            <div className="glass-card rounded-[2.5rem] p-7 space-y-8">
              <div className="space-y-4">
                <h4 className="text-white font-black text-xs border-b border-white/5 pb-2 uppercase tracking-widest opacity-40">Identificación</h4>
                <div className="space-y-4">
                  <input className="w-full bg-slate-900/60 border-none rounded-2xl px-5 py-4 text-sm dark:text-white" placeholder="Nombre y Apellido" value={studentForm.nombre} onChange={(e) => setStudentForm({...studentForm, nombre: e.target.value})}/>
                  <div className="grid grid-cols-2 gap-4">
                    <input className="w-full bg-slate-900/60 border-none rounded-2xl px-5 py-4 text-sm dark:text-white" placeholder="DNI" value={studentForm.dni} onChange={(e) => setStudentForm({...studentForm, dni: e.target.value})}/>
                    <input type="date" className="w-full bg-slate-900/60 border-none rounded-2xl px-4 py-4 text-sm dark:text-white" value={studentForm.fechaNacimiento} onChange={(e) => setStudentForm({...studentForm, fechaNacimiento: e.target.value})}/>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-white font-black text-xs border-b border-white/5 pb-2 uppercase tracking-widest opacity-40">Salud y Seguimiento</h4>
                <textarea className="w-full bg-slate-900/60 border-none rounded-2xl px-5 py-4 text-sm dark:text-white h-24" placeholder="Observaciones de salud, alergias o impedimentos..." onChange={(e) => setStudentForm({...studentForm, alertas: [e.target.value]})}/>
                <input className="w-full bg-slate-900/60 border-none rounded-2xl px-5 py-4 text-sm dark:text-white" placeholder="Datos Federativos (Nº Licencia / Club)" onChange={(e) => setStudentForm({...studentForm, datosFederativos: e.target.value})}/>
                <div className="space-y-1"><label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Fecha Prueba/Inicio</label><input type="date" className="w-full bg-slate-900/60 border-none rounded-2xl px-5 py-4 text-sm dark:text-white" value={studentForm.fechaPrimeraClase} onChange={(e) => setStudentForm({...studentForm, fechaPrimeraClase: e.target.value})}/></div>
              </div>

              <div className="space-y-4">
                <h4 className="text-white font-black text-xs border-b border-white/5 pb-2 uppercase tracking-widest opacity-40">Contactos Familiares</h4>
                <div className="grid grid-cols-2 gap-4">
                  <input className="w-full bg-slate-900/60 border-none rounded-2xl px-4 py-4 text-xs dark:text-white" placeholder="Papá (Nombre)" onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, padreNombre: e.target.value}})}/>
                  <input className="w-full bg-slate-900/60 border-none rounded-2xl px-4 py-4 text-xs dark:text-white" placeholder="Papá (Tel)" onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, padreTelefono: e.target.value}})}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input className="w-full bg-slate-900/60 border-none rounded-2xl px-4 py-4 text-xs dark:text-white" placeholder="Mamá (Nombre)" onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, madreNombre: e.target.value}})}/>
                  <input className="w-full bg-slate-900/60 border-none rounded-2xl px-4 py-4 text-xs dark:text-white" placeholder="Mamá (Tel)" onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, madreTelefono: e.target.value}})}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input className="w-full bg-slate-900/60 border-none rounded-2xl px-4 py-4 text-xs dark:text-white font-bold" placeholder="Emergencia (Vínculo)" onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, emergenciaNombre: e.target.value}})}/>
                  <input className="w-full bg-slate-900/60 border-none rounded-2xl px-4 py-4 text-xs dark:text-white font-bold text-primary" placeholder="Emergencia (Tel)" onChange={(e) => setStudentForm({...studentForm, contacto: {...studentForm.contacto!, emergenciaTelefono: e.target.value}})}/>
                </div>
              </div>

              <button onClick={handleSaveStudent} className="w-full py-5 rounded-3xl bg-primary text-background-dark font-black uppercase tracking-[0.2em] text-xs shadow-neon-cyan">
                Finalizar Registro Atleta
              </button>
            </div>
          </div>
        )}

        {/* VISTA: REPORTE PDF */}
        {vista === 'ReportePDF' && activeGroup && (
          <div className="page-transition p-8 bg-white text-black min-h-screen">
            <button onClick={() => setVista('AsistenciaLista')} className="mb-8 text-blue-600 font-bold print:hidden">← Volver al Sistema</button>
            <div className="border-4 border-black p-8 max-w-4xl mx-auto space-y-12">
              <header className="flex justify-between items-start border-b-2 border-slate-200 pb-8">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter">GymCoach Pro</h1>
                  <p className="text-lg font-bold text-slate-500">Reporte de Asistencia Mensual</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase text-xs">Grupo: <span className="text-blue-600">{activeGroup.nombre}</span></p>
                  <p className="font-bold uppercase text-xs">Mes: <span className="text-blue-600">Septiembre 2024</span></p>
                </div>
              </header>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 uppercase text-[10px] font-black tracking-widest border-y border-slate-300">
                    <th className="p-4 text-left">Atleta</th>
                    <th className="p-4 text-center">DNI</th>
                    <th className="p-4 text-center">Asistencias</th>
                    <th className="p-4 text-center">% Mensual</th>
                    <th className="p-4 text-right">Firma Tutor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlumnos.map(a => (
                    <tr key={a.id} className="border-b border-slate-100 text-sm">
                      <td className="p-4 font-bold uppercase">{a.nombre}</td>
                      <td className="p-4 text-center font-mono text-slate-500">{a.dni}</td>
                      <td className="p-4 text-center font-black">12/12</td>
                      <td className="p-4 text-center"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-black">100%</span></td>
                      <td className="p-4 text-right border-b-2 border-slate-200 w-32"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <footer className="pt-20 flex justify-between">
                <div className="text-center w-64 border-t-2 border-slate-300 pt-4"><p className="text-[10px] font-black uppercase">Sello Institucional</p></div>
                <div className="text-center w-64 border-t-2 border-slate-300 pt-4"><p className="text-[10px] font-black uppercase">Firma del Entrenador</p></div>
              </footer>

              <button onClick={() => window.print()} className="w-full py-4 mt-8 bg-black text-white font-bold uppercase tracking-widest rounded-xl print:hidden">Descargar / Imprimir PDF</button>
            </div>
          </div>
        )}

        {/* Grabación IA */}
        {vista === 'NuevaClase' && (
          <div className="space-y-8 page-transition pt-8 px-6">
            <div className="glass-card rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden">
              <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-neon-cyan border border-primary/20">
                <span className="material-icons-outlined text-primary text-5xl">mic</span>
              </div>
              <h2 className="text-2xl font-black dark:text-white mb-2 italic tracking-tighter uppercase">Reporte IA</h2>
              <div className="relative flex flex-col items-center mt-12">
                <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                  className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 ${isRecording ? 'bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.5)] scale-110' : 'bg-primary shadow-neon-cyan-strong hover:scale-105 active:scale-95'}`}>
                  {isRecording ? <div className="flex gap-2 items-end h-10">{[1,2,3,4,5,6].map(i => (<div key={i} className="w-2 bg-white rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`, height: `${40 + Math.random()*60}%`}}></div>))}</div> : <span className="material-icons-outlined text-white text-5xl">mic</span>}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Navegación Inferior */}
      {vista !== 'ReportePDF' && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-background-dark/80 backdrop-blur-xl border-t border-white/5 px-8 pt-4 pb-10 flex justify-between items-center z-50">
          {[
            { v: 'Dashboard', i: 'grid_view' },
            { v: 'Alumnos', i: 'people' },
            { v: 'Horario', i: 'calendar_today' },
            { v: 'Ajustes', i: 'settings' }
          ].map(item => (
            <button 
              key={item.v} 
              onClick={() => setVista(item.v as ViewMode)}
              className={`flex flex-col items-center gap-1.5 transition-all ${vista === item.v || (vista === 'AsistenciaLista' && item.v === 'Dashboard') ? 'text-primary active-glow' : 'text-slate-500'}`}
            >
              <span className="material-icons-outlined text-[26px]">{item.i}</span>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.v}</span>
            </button>
          ))}
        </nav>
      )}

      {vista !== 'ReportePDF' && <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-800 rounded-full z-[60]"></div>}

      {/* Notificaciones */}
      {notificacion && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[380px] bg-[#0A1A2F]/90 backdrop-blur-xl text-white p-5 rounded-3xl shadow-neon-cyan border border-white/10 flex items-center gap-4 animate-in slide-in-from-top-12 duration-500">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30"><span className="material-icons-outlined text-primary">check_circle</span></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-primary">{notificacion.t}</p><p className="text-[11px] text-slate-300 font-medium mt-1">{notificacion.d}</p></div>
        </div>
      )}
    </div>
  );
};

export default App;