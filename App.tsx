import React, { useState, useEffect, useMemo, useRef } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, StaffMember, Biometrics, Discipline, PaymentStatus, Skill, Apparatus, ContactoFamilia } from './types.ts';
import { DISCIPLINAS, NIVELES } from './constants.tsx';
import { getDraftMessage, processClassAudio, refineClassAnalysis } from './services/geminiService.ts';

// --- DATABASE CONFIGURATION ---
const db = new Dexie('GymCoachEliteDB_v5') as Dexie & {
  alumnos: EntityTable<Alumno, 'id'>;
  clases: EntityTable<Clase, 'id'>;
  staff: EntityTable<StaffMember, 'id'>;
};

db.version(1).stores({
  alumnos: '++id, dni, nombre, estadoPago, disciplina',
  clases: '++id, fecha, grupo',
  staff: '++id, nombre, isClockedIn'
});

// --- HELPER FUNCTIONS ---
const getAvatarColor = (name: string) => {
  const colors = [
    'from-indigo-500 to-blue-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const ClaseCard: React.FC<{ clase: Clase }> = ({ clase }) => (
  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden">
    <div className="flex justify-between items-start mb-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[7px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">{clase.grupo}</span>
          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{clase.horario || '---'}</span>
        </div>
        <p className="text-[11px] font-black text-slate-900 uppercase">
          {new Date(clase.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 flex items-center gap-1">
          <i className="fas fa-user-tie text-[6px]"></i> Coach: {clase.entrenador}
        </p>
      </div>
      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
        <i className="fas fa-file-invoice text-xs"></i>
      </div>
    </div>
    
    <div className="space-y-3 pt-2 border-t border-slate-50">
      {clase.warmup && clase.warmup.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[7px] font-black text-slate-400 uppercase mr-1 mt-1.5">Warmup:</span>
          {clase.warmup.map((w, j) => (
            <span key={j} className="px-2 py-0.5 bg-slate-50 text-[8px] font-bold text-slate-600 rounded-lg">{w}</span>
          ))}
        </div>
      )}
      
      {clase.apparatusUsed && clase.apparatusUsed.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[7px] font-black text-violet-500 uppercase mr-1 mt-1.5">Aparatos:</span>
          {clase.apparatusUsed.map((a, j) => (
            <span key={j} className="px-2 py-0.5 bg-violet-50 text-[8px] font-black text-violet-600 rounded-lg border border-violet-100">{a}</span>
          ))}
        </div>
      )}
      
      {clase.skillsCovered && clase.skillsCovered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[7px] font-black text-emerald-500 uppercase mr-1 mt-1.5">Habilidades:</span>
          {clase.skillsCovered.map((s, j) => (
            <span key={j} className="px-2 py-0.5 bg-emerald-50 text-[8px] font-black text-emerald-600 rounded-lg border border-emerald-100">{s}</span>
          ))}
        </div>
      )}
    </div>
  </div>
);

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vista, setVista] = useState<ViewMode>('Hub');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFormModal, setShowFormModal] = useState<'add' | 'edit' | null>(null);

  // Coach Settings State
  const [coachSettings, setCoachSettings] = useState({
    name: "Coach Elite",
    selectedDays: [] as string[],
    selectedSlots: [] as string[]
  });

  // Audio Recording & IA
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [notificacionActiva, setNotificacionActiva] = useState<{titulo: string, desc: string, tipo: string} | null>(null);

  // Student Form State
  const emptyAlumno: Partial<Alumno> = {
    nombre: '', dni: '', fechaNacimiento: '', fechaPrimeraClase: new Date().toISOString().split('T')[0],
    disciplina: 'GAF', nivel: 'Iniciación', estadoPago: 'Al día',
    contacto: { padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '', familiarNombre: '', familiarTelefono: '', emergenciaNombre: '', emergenciaTelefono: '' }
  };
  const [formAlumno, setFormAlumno] = useState<Partial<Alumno>>(emptyAlumno);

  const loadData = async () => {
    try {
      const a = await db.alumnos.toArray();
      const s = await db.staff.toArray();
      const c = await db.clases.orderBy('fecha').reverse().toArray();
      setAlumnos(a);
      setStaff(s);
      setClases(c);
      
      // Load settings
      const savedSettings = localStorage.getItem('coach_settings');
      if (savedSettings) setCoachSettings(JSON.parse(savedSettings));

      if (a.length === 0) {
        await db.alumnos.add({
          nombre: 'Valentina Silva', dni: '12345678', disciplina: 'GAF', nivel: 'Promocional',
          fechaNacimiento: '2012-05-15', fechaIngreso: new Date('2024-01-15').toISOString(),
          fechaPrimeraClase: '2024-01-20',
          estadoPago: 'Al día', asistenciasHistoricas: 156,
          qrCode: 'VAL_123', alertas: ['Absentismo Crítico'], habilidades: [],
          biometria: { fuerza: 85, flexibilidad: 92, tecnica: 78, resistencia: 70, coordinacion: 88 },
          contacto: { madreNombre: 'Mariana Silva', madreTelefono: '+5491122334455', emergenciaNombre: 'Clínica Central', emergenciaTelefono: '911' }
        });
        setAlumnos(await db.alumnos.toArray());
      }
    } catch (err) { console.error("DB Error:", err); }
  };

  useEffect(() => { if (isLoggedIn) loadData(); }, [isLoggedIn]);

  const filteredAlumnos = useMemo(() => {
    return alumnos.filter(a => a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || a.dni.includes(searchQuery));
  }, [alumnos, searchQuery]);

  // --- SETTINGS LOGIC ---
  const handleToggleDay = (day: string) => {
    setCoachSettings(prev => {
      const newDays = prev.selectedDays.includes(day) 
        ? prev.selectedDays.filter(d => d !== day) 
        : [...prev.selectedDays, day];
      const next = { ...prev, selectedDays: newDays };
      localStorage.setItem('coach_settings', JSON.stringify(next));
      return next;
    });
  };

  const handleToggleSlot = (slot: string) => {
    setCoachSettings(prev => {
      const newSlots = prev.selectedSlots.includes(slot)
        ? prev.selectedSlots.filter(s => s !== slot)
        : [...prev.selectedSlots, slot];
      const next = { ...prev, selectedSlots: newSlots };
      localStorage.setItem('coach_settings', JSON.stringify(next));
      return next;
    });
  };

  const timeSlots = [
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"
  ];
  const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  // --- AUDIO LOGIC ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        processRecordedAudio(blob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) { console.error("Error micrófono:", err); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const processRecordedAudio = async (blob: Blob) => {
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const result = await processClassAudio(base64data, 'audio/webm');
        setAiAnalysisResult(result);
        setIsAnalyzing(false);
      };
    } catch (err) { console.error("Error analizando:", err); setIsAnalyzing(false); }
  };

  const saveClassFromAi = async () => {
    if (!aiAnalysisResult) return;
    try {
      const newClase: Clase = {
        fecha: new Date().toISOString(),
        grupo: aiAnalysisResult.grupo || 'General',
        horario: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        entrenador: aiAnalysisResult.entrenador || coachSettings.name,
        warmup: aiAnalysisResult.warmup || [],
        apparatusUsed: aiAnalysisResult.apparatusUsed || [],
        skillsCovered: aiAnalysisResult.skillsCovered || []
      };
      await db.clases.add(newClase);
      await loadData();
      setAiAnalysisResult(null);
      setVista('Calendario');
      setNotificacionActiva({ titulo: "Reporte Guardado", desc: "La información de la clase se ha archivado correctamente.", tipo: "success" });
      setTimeout(() => setNotificacionActiva(null), 4000);
    } catch (err) { console.error("Error guardando clase:", err); }
  };

  // --- ALUMNO FORM LOGIC ---
  const handleSaveAlumno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAlumno.nombre || !formAlumno.dni || !formAlumno.fechaNacimiento) return;
    
    if (showFormModal === 'edit' && formAlumno.id) {
      await db.alumnos.update(formAlumno.id, formAlumno);
      setNotificacionActiva({ titulo: "Actualizado", desc: "Datos del atleta actualizados.", tipo: "success" });
    } else {
      const student: Alumno = { 
        ...(formAlumno as Alumno), 
        fechaIngreso: new Date().toISOString(), 
        asistenciasHistoricas: 0, 
        qrCode: `QR_${formAlumno.dni}`, 
        alertas: [], 
        habilidades: [], 
        biometria: { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 } 
      };
      await db.alumnos.add(student);
      setNotificacionActiva({ titulo: "Registrado", desc: "Nuevo atleta añadido al sistema.", tipo: "success" });
    }
    
    await loadData();
    setShowFormModal(null);
    setFormAlumno(emptyAlumno);
    setTimeout(() => setNotificacionActiva(null), 3000);
  };

  const openEdit = (a: Alumno, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFormAlumno(a);
    setShowFormModal('edit');
  };

  const Nav = () => (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md glass rounded-[2.5rem] p-3 flex items-center justify-around shadow-2xl z-50 border border-white/50">
      {[ 
        { v: 'Hub', i: 'fa-house-user' }, 
        { v: 'Alumnos', i: 'fa-user-ninja' }, 
        { v: 'Calendario', i: 'fa-box-archive' }, 
        { v: 'Staff', i: 'fa-id-badge' } 
      ].map(item => (
        <button key={item.v} onClick={() => { setVista(item.v as ViewMode); setSelectedAlumno(null); }} 
          className={`flex flex-col items-center gap-1.5 transition-all px-4 py-2 rounded-2xl ${vista === item.v ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
          <i className={`fas ${item.i} text-lg`}></i>
          <span className="text-[8px] font-bold uppercase tracking-tighter">{item.v === 'Calendario' ? 'Archivo' : item.v}</span>
        </button>
      ))}
    </nav>
  );

  if (!isLoggedIn) return (
    <div className="min-h-screen auth-bg flex flex-col items-center justify-center p-8 text-white">
      <div className="z-10 w-full max-w-sm text-center page-transition">
        <div className="w-20 h-20 bg-white/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-2xl"><i className="fas fa-medal text-3xl text-amber-400"></i></div>
        <h1 className="text-4xl font-extrabold italic uppercase tracking-tighter mb-2 leading-none">GYMCOACH<br/><span className="text-indigo-400">PRO ELITE</span></h1>
        <button onClick={() => setIsLoggedIn(true)} className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-full font-extrabold uppercase text-xs tracking-widest shadow-xl">Sincronizar Terminal</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-36 font-sans">
      {/* Notificaciones */}
      {notificacionActiva && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-md bg-white border border-slate-100 p-6 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-300">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${notificacionActiva.tipo === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            <i className={`fas ${notificacionActiva.tipo === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase text-slate-900">{notificacionActiva.titulo}</p>
            <p className="text-[8px] font-bold text-slate-500 uppercase">{notificacionActiva.desc}</p>
          </div>
        </div>
      )}

      <header className="pt-14 px-8 pb-8 bg-white/80 backdrop-blur-xl rounded-b-[3rem] shadow-sm flex justify-between items-end border-b border-slate-100 sticky top-0 z-40">
        <div className="flex-1">
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mb-1">Elite System</p>
          <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">
            {vista === 'Calendario' ? 'Archivo Clases' : (vista === 'NuevaClase' ? 'Reporte Voz' : (vista === 'Config' ? 'Ajustes' : vista))}
          </h2>
        </div>
        <button onClick={() => setVista('Config')} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${vista === 'Config' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}`}>
          <i className="fas fa-gear"></i>
        </button>
      </header>

      <main className="px-6 py-8 page-transition">
        {vista === 'Hub' && (
          <div className="space-y-8">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xl font-bold italic uppercase mb-1">Estado del Gimnasio</h3>
                  <div className="flex gap-4 mt-6">
                    <div className="bg-white/5 p-4 rounded-2xl flex-1 border border-white/10 text-center">
                      <p className="text-2xl font-black italic">{alumnos.length}</p>
                      <p className="text-[7px] font-bold text-slate-500 uppercase">Atletas</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl flex-1 border border-white/10 text-center">
                      <p className="text-2xl font-black italic">{clases.length}</p>
                      <p className="text-[7px] font-bold text-slate-500 uppercase">Reportes</p>
                    </div>
                  </div>
                </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Sesiones Recientes</h4>
                <button onClick={() => setVista('Calendario')} className="text-[8px] font-black text-indigo-500 uppercase hover:underline">Ver Historial</button>
              </div>
              <div className="space-y-3">
                {clases.slice(0, 2).map((c, i) => <ClaseCard key={c.id || i} clase={c} />)}
                {clases.length === 0 && <div className="p-12 text-center text-[10px] font-bold text-slate-300 border border-dashed rounded-[2rem] uppercase">Sin reportes recientes</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button onClick={() => setVista('Alumnos')} className="aspect-square bg-white border border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-sm active:scale-95 transition-all">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><i className="fas fa-users text-xl"></i></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Alumnos</span>
              </button>
              <button onClick={() => setVista('NuevaClase')} className="aspect-square bg-white border border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-sm active:scale-95 transition-all">
                <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center"><i className="fas fa-microphone-lines text-xl"></i></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Reporte Voz</span>
              </button>
            </div>
          </div>
        )}

        {vista === 'Alumnos' && !selectedAlumno && (
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-1 bg-white p-4 rounded-[1.5rem] shadow-sm flex items-center px-6 border border-slate-100">
                <i className="fas fa-search text-slate-300 mr-4"></i>
                <input type="text" placeholder="BUSCAR ATLETA..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent py-2 text-[10px] font-bold text-slate-800 outline-none uppercase tracking-widest" />
              </div>
              <button onClick={() => { setFormAlumno(emptyAlumno); setShowFormModal('add'); }} className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <i className="fas fa-plus"></i>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredAlumnos.map(a => (
                <div key={a.id} onClick={() => setSelectedAlumno(a)} onDoubleClick={() => openEdit(a)} className={`group bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden`}>
                  <div className="flex items-center gap-5 relative z-10">
                    <div className={`w-16 h-16 rounded-[1.5rem] bg-gradient-to-br ${getAvatarColor(a.nombre)} flex items-center justify-center text-white font-black text-2xl italic shadow-lg`}>{a.nombre.charAt(0)}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">{a.nombre}</p>
                        <button onClick={(e) => openEdit(a, e)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                          <i className="fas fa-edit text-xs"></i>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase rounded-lg border border-indigo-100">{a.disciplina}</span>
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[8px] font-black uppercase rounded-lg border border-slate-200">{a.nivel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === 'Calendario' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center px-2">
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Archivo de Clases (Historial)</h4>
              <p className="text-[8px] font-bold text-slate-400 uppercase">{clases.length} Sesiones</p>
            </div>
            <div className="space-y-4">
              {clases.map((c, i) => <ClaseCard key={c.id || i} clase={c} />)}
              {clases.length === 0 && (
                <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
                  <i className="fas fa-box-open text-slate-200 text-4xl mb-4"></i>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Archivo Vacío</p>
                </div>
              )}
            </div>
          </div>
        )}

        {vista === 'Config' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center">
                  <i className="fas fa-calendar-check text-xl"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase italic text-slate-900 tracking-tight">Gestión de Horarios</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Define tu disponibilidad profesional</p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">1. Días de la semana</p>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map(day => (
                      <button 
                        key={day}
                        onClick={() => handleToggleDay(day)}
                        className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${coachSettings.selectedDays.includes(day) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">2. Rangos Horarios (17:00 - 20:00)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {timeSlots.map(slot => (
                      <button 
                        key={slot}
                        onClick={() => handleToggleSlot(slot)}
                        className={`p-4 rounded-[1.5rem] text-[11px] font-bold transition-all flex items-center justify-center gap-2 ${coachSettings.selectedSlots.includes(slot) ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100 shadow-sm'}`}
                      >
                        <i className={`fas fa-clock ${coachSettings.selectedSlots.includes(slot) ? 'text-white' : 'text-slate-300'}`}></i>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50">
                   <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 flex items-start gap-4">
                      <i className="fas fa-circle-info text-indigo-500 mt-1"></i>
                      <p className="text-[9px] font-bold text-indigo-900 uppercase leading-relaxed tracking-wider">
                        Tu configuración se utilizará para autocompletar reportes de clase y organizar el calendario del gimnasio.
                      </p>
                   </div>
                </div>
              </div>
            </section>

            <button 
              onClick={() => setVista('Hub')}
              className="w-full py-5 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all"
            >
              Confirmar y Volver al Hub
            </button>
          </div>
        )}

        {vista === 'NuevaClase' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-microphone-lines text-2xl"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter mb-2">Nuevo Reporte Voz</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Describe la sesión: warmup, aparatos y los logros técnicos de hoy.
              </p>
              
              <div className="mt-12 mb-8 flex flex-col items-center">
                <button 
                  onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                  className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${isRecording ? 'bg-rose-500 scale-110 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-200 hover:scale-105'}`}>
                  {isRecording ? <div className="flex gap-1 items-end h-6">{[1,2,3,4,5].map(i => <div key={i} className="w-1.5 bg-white rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`, height: `${40 + Math.random()*60}%`}}></div>)}</div> : <i className="fas fa-microphone text-white text-3xl"></i>}
                </button>
                <p className="mt-8 text-[9px] font-black uppercase text-indigo-600 tracking-[0.2em]">{isRecording ? "Grabando... Suelta para procesar" : "Mantén presionado para hablar"}</p>
              </div>
            </div>

            {isAnalyzing && (
              <div className="bg-indigo-50 p-10 rounded-[2.5rem] border border-indigo-100 text-center animate-pulse">
                 <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                 <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">IA Transcribiendo y Analizando...</p>
              </div>
            )}

            {aiAnalysisResult && !isAnalyzing && (
              <div className="bg-white rounded-[3rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in duration-300 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Información Procesada</h4>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded-full border border-emerald-100">IA Lista</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2"><i className="fas fa-fire text-orange-400"></i> Calentamiento</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiAnalysisResult.warmup?.map((w: string, i: number) => <span key={i} className="px-2 py-1 bg-white text-[9px] font-bold text-slate-600 rounded-lg border border-slate-100">{w}</span>)}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2"><i className="fas fa-vault text-violet-400"></i> Aparatos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiAnalysisResult.apparatusUsed?.map((a: string, i: number) => <span key={i} className="px-2 py-1 bg-indigo-50 text-[9px] font-black text-indigo-600 rounded-lg border border-indigo-100">{a}</span>)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setAiAnalysisResult(null)} className="flex-1 py-5 text-[9px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors">Descartar</button>
                    <button onClick={saveClassFromAi} className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-[9px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Confirmar y Guardar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedAlumno && (
          <div className="space-y-8 page-transition pb-10">
            <div className="flex justify-between items-center">
              <button onClick={() => setSelectedAlumno(null)} className="text-[9px] font-extrabold text-indigo-600 uppercase flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full w-fit hover:bg-indigo-100 transition-all"><i className="fas fa-arrow-left"></i> Volver</button>
              <button onClick={() => openEdit(selectedAlumno)} className="text-[9px] font-extrabold text-slate-500 uppercase flex items-center gap-2 bg-white border border-slate-100 px-4 py-2 rounded-full w-fit hover:border-indigo-200 transition-all"><i className="fas fa-edit"></i> Editar</button>
            </div>
            
            <div className="bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-slate-100">
              <div className={`bg-gradient-to-br ${getAvatarColor(selectedAlumno.nombre)} p-12 text-center relative overflow-hidden`}>
                 <div className="absolute inset-0 bg-black/10"></div>
                 <div className="w-24 h-24 bg-white/20 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 text-4xl font-black italic backdrop-blur-xl border border-white/20 shadow-2xl relative z-10">{selectedAlumno.nombre.charAt(0)}</div>
                 <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter relative z-10">{selectedAlumno.nombre}</h3>
              </div>
              
              <div className="p-8 space-y-12">
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-2">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <i className="fas fa-list-check text-emerald-500"></i> Historial Individual
                    </h4>
                  </div>
                  <div className="space-y-4">
                    {clases.filter(c => c.grupo === selectedAlumno.nivel || c.grupo === 'General').map((c, i) => <ClaseCard key={c.id || i} clase={c} />)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL COMPLETO DE ALUMNO */}
      {showFormModal && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-10 shadow-2xl border border-white/20 overflow-y-auto max-h-[92vh]">
            <h3 className="text-2xl font-black uppercase italic mb-8 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <i className={`fas ${showFormModal === 'edit' ? 'fa-user-pen' : 'fa-user-plus'} text-xl`}></i>
              </div>
              {showFormModal === 'edit' ? 'Editar Atleta' : 'Nuevo Atleta'}
            </h3>
            
            <form onSubmit={handleSaveAlumno} className="space-y-8">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">1. Información Personal</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input type="text" required placeholder="NOMBRE COMPLETO" value={formAlumno.nombre} onChange={e => setFormAlumno({...formAlumno, nombre: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-[11px] font-bold uppercase outline-none focus:ring-2 ring-indigo-100 transition-all" />
                  </div>
                  <input type="text" required placeholder="DNI / ID" value={formAlumno.dni} onChange={e => setFormAlumno({...formAlumno, dni: e.target.value})} className="bg-slate-50 p-4 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 ring-indigo-100" />
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-[7px] font-black text-slate-400 uppercase">F. Nacimiento</label>
                    <input type="date" required value={formAlumno.fechaNacimiento} onChange={e => setFormAlumno({...formAlumno, fechaNacimiento: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-[11px] font-bold outline-none" />
                  </div>
                  <div className="col-span-1">
                    <select value={formAlumno.disciplina} onChange={e => setFormAlumno({...formAlumno, disciplina: e.target.value as Discipline})} className="w-full bg-slate-50 p-4 rounded-2xl text-[11px] font-bold outline-none">
                      {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <select value={formAlumno.nivel} onChange={e => setFormAlumno({...formAlumno, nivel: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-[11px] font-bold outline-none">
                      {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">2. Contacto Familiar</p>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="MADRE / TUTOR" value={formAlumno.contacto?.madreNombre} onChange={e => setFormAlumno({...formAlumno, contacto: {...formAlumno.contacto!, madreNombre: e.target.value}})} className="bg-slate-50 p-4 rounded-2xl text-[11px] font-bold outline-none" />
                  <input type="text" placeholder="TEL MADRE" value={formAlumno.contacto?.madreTelefono} onChange={e => setFormAlumno({...formAlumno, contacto: {...formAlumno.contacto!, madreTelefono: e.target.value}})} className="bg-slate-50 p-4 rounded-2xl text-[11px] font-bold outline-none" />
                  <input type="text" placeholder="PADRE / TUTOR" value={formAlumno.contacto?.padreNombre} onChange={e => setFormAlumno({...formAlumno, contacto: {...formAlumno.contacto!, padreNombre: e.target.value}})} className="bg-slate-50 p-4 rounded-2xl text-[11px] font-bold outline-none" />
                  <input type="text" placeholder="TEL PADRE" value={formAlumno.contacto?.padreTelefono} onChange={e => setFormAlumno({...formAlumno, contacto: {...formAlumno.contacto!, padreTelefono: e.target.value}})} className="bg-slate-50 p-4 rounded-2xl text-[11px] font-bold outline-none" />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowFormModal(null)} className="flex-1 py-5 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors">Cerrar</button>
                <button type="submit" className="flex-[2] py-5 bg-indigo-600 text-white rounded-[2rem] text-[10px] font-black uppercase shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Guardar Datos</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Nav />
    </div>
  );
};

export default App;