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
const calculateAges = (dob: string) => {
  if (!dob) return { current: 0, dec31: 0, category: 'N/A' };
  const birth = new Date(dob);
  const now = new Date();
  const dec31 = new Date(now.getFullYear(), 11, 31);

  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;

  const ageDec31 = dec31.getFullYear() - birth.getFullYear();

  let category = "Baby Gym";
  if (ageDec31 >= 16) category = "Mayor";
  else if (ageDec31 >= 13) category = "Juvenil";
  else if (ageDec31 >= 11) category = "Infantil";
  else if (ageDec31 >= 9) category = "Pre-Infantil";
  else if (ageDec31 >= 7) category = "Mini";

  return { current: age, dec31: ageDec31, category };
};

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

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vista, setVista] = useState<ViewMode>('Hub');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [clarificationText, setClarificationText] = useState("");

  // States para Alertas e IA
  const [notificacionActiva, setNotificacionActiva] = useState<{titulo: string, desc: string, tipo: string} | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiDraft, setAiDraft] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Student Form State (Used for both Add and Edit)
  const emptyAlumno: Partial<Alumno> = {
    nombre: '',
    dni: '',
    fechaNacimiento: '',
    fechaPrimeraClase: new Date().toISOString().split('T')[0],
    disciplina: 'GAF',
    nivel: 'Iniciación',
    estadoPago: 'Al día',
    contacto: {
      padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '',
      familiarNombre: '', familiarTelefono: '', emergenciaNombre: '', emergenciaTelefono: ''
    }
  };
  const [formAlumno, setFormAlumno] = useState<Partial<Alumno>>(emptyAlumno);

  const loadData = async () => {
    try {
      const a = await db.alumnos.toArray();
      const s = await db.staff.toArray();
      const c = await db.clases.toArray();
      setAlumnos(a);
      setStaff(s);
      setClases(c);
      
      if (a.length === 0) {
        await db.alumnos.add({
          nombre: 'Valentina Silva', dni: '12345678', disciplina: 'GAF', nivel: 'Promocional',
          fechaNacimiento: '2012-05-15', fechaIngreso: new Date('2024-01-15').toISOString(),
          fechaPrimeraClase: '2024-01-20',
          estadoPago: 'Al día', asistenciasHistoricas: 156,
          qrCode: 'VAL_123', alertas: ['Absentismo Crítico'], habilidades: [],
          biometria: { fuerza: 85, flexibilidad: 92, tecnica: 78, resistencia: 70, coordinacion: 88 },
          contacto: {
            madreNombre: 'Mariana Silva', madreTelefono: '+5491122334455',
            emergenciaNombre: 'Clínica Central', emergenciaTelefono: '911'
          }
        });
        if (c.length === 0) {
            const mockClases: Clase[] = [
                { fecha: new Date(2024, 4, 10).toISOString(), grupo: 'Promocional', warmup: ['Trote', 'Brazos'], apparatusUsed: ['Viga'], skillsCovered: ['Caminata Relevé'] },
                { fecha: new Date(2024, 4, 12).toISOString(), grupo: 'Promocional', warmup: ['Saltos'], apparatusUsed: ['Suelo'], skillsCovered: ['Rueda'] },
                { fecha: new Date(2024, 4, 15).toISOString(), grupo: 'Promocional', warmup: ['Articulaciones'], apparatusUsed: ['Salto'], skillsCovered: ['Pique'] }
            ];
            for (const mc of mockClases) await db.clases.add(mc);
        }
        setAlumnos(await db.alumnos.toArray());
        setClases(await db.clases.toArray());
      }
    } catch (err) {
      console.error("DB Error:", err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) loadData();
  }, [isLoggedIn]);

  const attendanceStats = useMemo(() => {
    if (!selectedAlumno) return { annual: new Array(12).fill(0), currentMonthClasses: [] };
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const annual = new Array(12).fill(0);
    const currentMonthClasses: Clase[] = [];
    clases.forEach(clase => {
      const classDate = new Date(clase.fecha);
      if (classDate.getFullYear() === currentYear && (clase.grupo === selectedAlumno.nivel || clase.grupo === 'General')) {
        annual[classDate.getMonth()]++;
        if (classDate.getMonth() === currentMonth) currentMonthClasses.push(clase);
      }
    });
    return { annual, currentMonthClasses };
  }, [clases, selectedAlumno]);

  // --- ACTIONS ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        processRecordedAudio(blob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) { console.error("Error micrófono:", err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

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
    } catch (err) {
      console.error("Error analizando:", err);
      setIsAnalyzing(false);
    }
  };

  // Fixed missing saveClassFromAi function
  const saveClassFromAi = async () => {
    if (!aiAnalysisResult) return;
    try {
      const newClase: Clase = {
        fecha: new Date().toISOString(),
        grupo: aiAnalysisResult.grupo || 'General',
        entrenador: aiAnalysisResult.entrenador || 'Staff',
        warmup: aiAnalysisResult.warmup || [],
        apparatusUsed: aiAnalysisResult.apparatusUsed || [],
        skillsCovered: aiAnalysisResult.skillsCovered || []
      };
      await db.clases.add(newClase);
      await loadData();
      setAiAnalysisResult(null);
      setVista('Hub');
      setNotificacionActiva({
        titulo: "Reporte Guardado",
        desc: "La clase ha sido registrada exitosamente.",
        tipo: "success"
      });
      // Clear notification after 3 seconds
      setTimeout(() => setNotificacionActiva(null), 3000);
    } catch (err) {
      console.error("Error guardando clase:", err);
    }
  };

  const handleTriggerAiAction = async () => {
    if (!selectedAlumno) return;
    setShowAiModal(true);
    setIsGeneratingAi(true);
    try {
      const msg = await getDraftMessage('alerta', selectedAlumno.nombre);
      setAiDraft(msg);
    } catch (e) { setAiDraft("Error IA."); } finally { setIsGeneratingAi(false); }
  };

  const handleSendWhatsapp = (num?: string) => {
    const text = encodeURIComponent(aiDraft || "Hola, desde GymCoach Pro Elite.");
    const target = num || "";
    window.open(`https://wa.me/${target.replace(/\D/g, '')}?text=${text}`, '_blank');
  };

  const handleCall = (num?: string) => { if (num) window.location.href = `tel:${num}`; };

  const filteredAlumnos = useMemo(() => {
    return alumnos.filter(a => a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || a.dni.includes(searchQuery));
  }, [alumnos, searchQuery]);

  const handleSaveAlumno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAlumno.nombre || !formAlumno.dni || !formAlumno.fechaNacimiento) return;
    
    if (showEditModal && formAlumno.id) {
      await db.alumnos.update(formAlumno.id, formAlumno);
      setShowEditModal(false);
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
      setShowAddModal(false);
    }
    await loadData();
    setFormAlumno(emptyAlumno);
  };

  const openEdit = (a: Alumno, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFormAlumno(a);
    setShowEditModal(true);
  };

  const ContactCard = ({ title, name, phone, icon }: { title: string, name?: string, phone?: string, icon: string }) => {
    if (!name && !phone) return null;
    return (
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col gap-3 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
            <p className="text-sm font-bold text-slate-800 uppercase mt-1">{name || 'N/A'}</p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">{phone || 'Sin número'}</p>
          </div>
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><i className={`fas ${icon}`}></i></div>
        </div>
        {phone && (
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleCall(phone)} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest">Llamar</button>
            <button onClick={() => handleSendWhatsapp(phone)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[8px] font-black uppercase tracking-widest">WhatsApp</button>
          </div>
        )}
      </div>
    );
  };

  const AttendanceChart = ({ data }: { data: number[] }) => {
    const months = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const max = Math.max(...data, 5);
    const colorClass = selectedAlumno ? getAvatarColor(selectedAlumno.nombre) : 'bg-indigo-500';
    return (
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex justify-between items-end h-32 gap-1.5 px-2">
          {data.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
              <div 
                className={`w-full rounded-t-lg transition-all duration-500 bg-gradient-to-t ${colorClass} opacity-20 group-hover:opacity-100`}
                style={{ height: `${(val / max) * 100}%`, minHeight: val > 0 ? '4px' : '0' }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">{val} cl</div>
              </div>
              <span className="text-[8px] font-black text-slate-400 uppercase">{months[i]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const StudentFormModal = ({ isOpen, onClose, title }: { isOpen: boolean, onClose: () => void, title: string }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
        <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-10 shadow-2xl border border-white/20 overflow-y-auto max-h-[92vh]">
          <h3 className="text-2xl font-black uppercase italic mb-8 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <i className={`fas ${title.includes('Editar') ? 'fa-user-pen' : 'fa-user-plus'} text-xl`}></i>
            </div>
            {title}
          </h3>
          <form onSubmit={handleSaveAlumno} className="space-y-8">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">1. Personales</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><input type="text" required placeholder="NOMBRE" value={formAlumno.nombre} onChange={e => setFormAlumno({...formAlumno, nombre: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase outline-none" /></div>
                <input type="text" required placeholder="DNI" value={formAlumno.dni} onChange={e => setFormAlumno({...formAlumno, dni: e.target.value})} className="bg-slate-50 p-4 rounded-2xl text-[10px] font-bold outline-none" />
                <input type="date" required value={formAlumno.fechaNacimiento} onChange={e => setFormAlumno({...formAlumno, fechaNacimiento: e.target.value})} className="bg-slate-50 p-4 rounded-2xl text-[10px] font-bold outline-none" />
                <div className="col-span-2">
                    <label className="text-[7px] font-black text-indigo-400 uppercase ml-2 mb-1 block">Inicio Primera Clase</label>
                    <input type="date" required value={formAlumno.fechaPrimeraClase} onChange={e => setFormAlumno({...formAlumno, fechaPrimeraClase: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-bold outline-none" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">2. Contacto</p>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="MADRE" value={formAlumno.contacto?.madreNombre} onChange={e => setFormAlumno({...formAlumno, contacto: {...formAlumno.contacto!, madreNombre: e.target.value}})} className="bg-slate-50 p-4 rounded-2xl text-[10px] font-bold outline-none" />
                <input type="text" placeholder="TEL MADRE" value={formAlumno.contacto?.madreTelefono} onChange={e => setFormAlumno({...formAlumno, contacto: {...formAlumno.contacto!, madreTelefono: e.target.value}})} className="bg-slate-50 p-4 rounded-2xl text-[10px] font-bold outline-none" />
                <input type="text" placeholder="PADRE" value={formAlumno.contacto?.padreNombre} onChange={e => setFormAlumno({...formAlumno, contacto: {...formAlumno.contacto!, padreNombre: e.target.value}})} className="bg-slate-50 p-4 rounded-2xl text-[10px] font-bold outline-none" />
                <input type="text" placeholder="TEL PADRE" value={formAlumno.contacto?.padreTelefono} onChange={e => setFormAlumno({...formAlumno, contacto: {...formAlumno.contacto!, padreTelefono: e.target.value}})} className="bg-slate-50 p-4 rounded-2xl text-[10px] font-bold outline-none" />
              </div>
            </div>
            <div className="flex gap-4 pt-6">
              <button type="button" onClick={onClose} className="flex-1 py-5 text-[10px] font-black uppercase text-slate-400">Cancelar</button>
              <button type="submit" className="flex-2 py-5 bg-indigo-600 text-white rounded-[2rem] text-[10px] font-black uppercase shadow-xl shadow-indigo-100">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const Nav = () => (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md glass rounded-[2.5rem] p-3 flex items-center justify-around shadow-2xl z-50 border border-white/50">
      {[ { v: 'Hub', i: 'fa-house-user' }, { v: 'Alumnos', i: 'fa-user-ninja' }, { v: 'Calendario', i: 'fa-calendar-alt' }, { v: 'Staff', i: 'fa-id-badge' } ].map(item => (
        <button key={item.v} onClick={() => { setVista(item.v as ViewMode); setSelectedAlumno(null); }} 
          className={`flex flex-col items-center gap-1.5 transition-all px-4 py-2 rounded-2xl ${vista === item.v ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
          <i className={`fas ${item.i} text-lg`}></i>
          <span className="text-[8px] font-bold uppercase tracking-tighter">{item.v}</span>
        </button>
      ))}
    </nav>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen auth-bg flex flex-col items-center justify-center p-8 text-white">
        <div className="z-10 w-full max-w-sm text-center page-transition">
          <div className="w-20 h-20 bg-white/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-2xl"><i className="fas fa-medal text-3xl text-amber-400"></i></div>
          <h1 className="text-4xl font-extrabold italic uppercase tracking-tighter mb-2 leading-none">GYMCOACH<br/><span className="text-indigo-400">PRO ELITE</span></h1>
          <button onClick={() => setIsLoggedIn(true)} className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-full font-extrabold uppercase text-xs tracking-widest shadow-xl">Sincronizar Terminal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-36 font-sans">
      {/* Rendering notification component */}
      {notificacionActiva && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-md bg-white border border-slate-100 p-6 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-300">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${notificacionActiva.tipo === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            <i className={`fas ${notificacionActiva.tipo === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase text-slate-900">{notificacionActiva.titulo}</p>
            <p className="text-[8px] font-bold text-slate-500 uppercase">{notificacionActiva.desc}</p>
          </div>
          <button onClick={() => setNotificacionActiva(null)} className="p-2 text-slate-300"><i className="fas fa-times"></i></button>
        </div>
      )}

      <header className="pt-14 px-8 pb-8 bg-white/80 backdrop-blur-xl rounded-b-[3rem] shadow-sm flex justify-between items-end border-b border-slate-100 sticky top-0 z-40">
        <div>
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mb-1">Elite System</p>
          <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">{vista === 'NuevaClase' ? 'Reporte' : vista}</h2>
        </div>
      </header>

      <main className="px-6 py-8 page-transition">
        {vista === 'Hub' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xl font-bold italic uppercase mb-1">Estado Hoy</h3>
                  <div className="flex gap-4 mt-6">
                    <div className="bg-white/5 p-4 rounded-2xl flex-1 border border-white/10">
                      <p className="text-2xl font-black italic">{alumnos.length}</p>
                      <p className="text-[7px] font-bold text-slate-500 uppercase">Atletas</p>
                    </div>
                  </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex gap-4">
              <div className="flex-1 bg-white p-4 rounded-[1.5rem] shadow-sm flex items-center px-6 border border-slate-100">
                <i className="fas fa-search text-slate-300 mr-4"></i>
                <input type="text" placeholder="BUSCAR ATLETA..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent py-2 text-[10px] font-bold text-slate-800 outline-none uppercase tracking-widest" />
              </div>
              <button onClick={() => { setFormAlumno(emptyAlumno); setShowAddModal(true); }} className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg active:scale-90 transition-all"><i className="fas fa-plus"></i></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredAlumnos.map(a => (
                  <div key={a.id} 
                    onClick={() => setSelectedAlumno(a)} 
                    onDoubleClick={() => openEdit(a)}
                    className={`group bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden`}>
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

        {selectedAlumno && (
          <div className="space-y-8 page-transition pb-10">
            <div className="flex justify-between items-center">
              <button onClick={() => setSelectedAlumno(null)} className="text-[9px] font-extrabold text-indigo-600 uppercase flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full w-fit"><i className="fas fa-arrow-left"></i> Volver</button>
              <button onClick={() => openEdit(selectedAlumno)} className="text-[9px] font-extrabold text-slate-600 uppercase flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full w-fit"><i className="fas fa-user-pen"></i> Editar Datos</button>
            </div>
            <div className="bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-slate-100">
              <div className={`bg-gradient-to-br ${getAvatarColor(selectedAlumno.nombre)} p-12 text-center relative overflow-hidden`}>
                 <div className="absolute inset-0 bg-black/10"></div>
                 <div className="w-24 h-24 bg-white/20 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 text-4xl font-black italic backdrop-blur-xl border border-white/20 shadow-2xl relative z-10">{selectedAlumno.nombre.charAt(0)}</div>
                 <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter relative z-10">{selectedAlumno.nombre}</h3>
                 <div className="flex justify-center gap-2 mt-4 relative z-10">
                    <span className="px-3 py-1 bg-white/20 text-white text-[8px] font-black uppercase rounded-full border border-white/30 backdrop-blur-md">{selectedAlumno.disciplina}</span>
                    <span className="px-3 py-1 bg-white/20 text-white text-[8px] font-black uppercase rounded-full border border-white/30 backdrop-blur-md">{selectedAlumno.nivel}</span>
                 </div>
              </div>

              <div className="p-8 space-y-12">
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-2">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><i className="fas fa-chart-column text-indigo-500"></i> Rendimiento de Asistencia (Anual)</h4>
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase italic">Año {new Date().getFullYear()}</span>
                  </div>
                  <AttendanceChart data={attendanceStats.annual} />
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center px-2">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><i className="fas fa-list-check text-emerald-500"></i> Contenido Mensual Cubierto</h4>
                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase italic">Este Mes</span>
                  </div>
                  <div className="space-y-4">
                    {attendanceStats.currentMonthClasses.length > 0 ? attendanceStats.currentMonthClasses.map((clase, i) => (
                      <div key={i} className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-6 shadow-sm hover:border-emerald-200 transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-[10px] font-black text-slate-900 uppercase">{new Date(clase.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Entrenador: {clase.entrenador}</p>
                          </div>
                          <span className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[10px] text-slate-400 shadow-sm font-bold">{i+1}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex flex-wrap gap-1.5"><span className="text-[7px] font-black text-indigo-500 uppercase mr-1 mt-1.5">Warmup:</span>{clase.warmup?.map((w, j) => <span key={j} className="px-2 py-0.5 bg-white text-[8px] font-bold text-slate-600 rounded-lg border border-slate-100">{w}</span>)}</div>
                          <div className="flex flex-wrap gap-1.5"><span className="text-[7px] font-black text-violet-500 uppercase mr-1 mt-1.5">Aparatos:</span>{clase.apparatusUsed?.map((a, j) => <span key={j} className="px-2 py-0.5 bg-violet-50 text-[8px] font-black text-violet-600 rounded-lg border border-violet-100">{a}</span>)}</div>
                          <div className="flex flex-wrap gap-1.5"><span className="text-[7px] font-black text-emerald-500 uppercase mr-1 mt-1.5">Habilidades:</span>{clase.skillsCovered?.map((s, j) => <span key={j} className="px-2 py-0.5 bg-emerald-50 text-[8px] font-black text-emerald-600 rounded-lg border border-emerald-100">{s}</span>)}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                        <i className="fas fa-calendar-xmark text-slate-200 text-3xl mb-4"></i>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin asistencias este mes</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><i className="fas fa-address-book text-indigo-500"></i> Red de Contacto y Seguridad</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ContactCard title="Madre" name={selectedAlumno.contacto?.madreNombre} phone={selectedAlumno.contacto?.madreTelefono} icon="fa-person-dress" />
                    <ContactCard title="Padre" name={selectedAlumno.contacto?.padreNombre} phone={selectedAlumno.contacto?.padreTelefono} icon="fa-person" />
                    <div className="bg-rose-50 p-6 rounded-[2.5rem] border border-rose-100 flex flex-col gap-3 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Emergencias Médicas</p>
                          <p className="text-sm font-bold text-rose-900 uppercase mt-1">{selectedAlumno.contacto?.emergenciaNombre || 'Servicio Médico'}</p>
                          <p className="text-[10px] font-black text-rose-600 mt-0.5">{selectedAlumno.contacto?.emergenciaTelefono || '911'}</p>
                        </div>
                        <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg animate-pulse"><i className="fas fa-truck-medical"></i></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {vista === 'NuevaClase' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6"><i className="fas fa-microphone-lines text-2xl"></i></div>
              <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter mb-2">Reporte por Voz</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Habla sobre el calentamiento, los aparatos usados y las habilidades trabajadas hoy.</p>
              <div className="mt-12 mb-8 flex flex-col items-center">
                <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${isRecording ? 'bg-rose-500 scale-125 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-200'}`}>
                  {isRecording ? <div className="flex gap-1 items-end h-6">{[1,2,3,4].map(i => <div key={i} className="w-1.5 bg-white rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`, height: `${Math.random()*100}%`}}></div>)}</div> : <i className="fas fa-microphone text-white text-3xl"></i>}
                </button>
                <p className="mt-6 text-[9px] font-black uppercase text-indigo-600 tracking-[0.2em]">{isRecording ? "Grabando... Suelta para finalizar" : "Mantén pulsado para hablar"}</p>
              </div>
            </div>
            {isAnalyzing && (
              <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 text-center animate-pulse">
                 <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                 <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">IA Analizando...</p>
              </div>
            )}
            {aiAnalysisResult && !isAnalyzing && (
              <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 animate-in zoom-in duration-300">
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Resumen Extraído</h4>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded-full border border-emerald-100">Listo</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase mb-2">Warmup</p><div className="flex flex-wrap gap-1.5">{aiAnalysisResult.warmup?.map((w: string, i: number) => <span key={i} className="px-2 py-1 bg-white text-[9px] font-bold text-slate-600 rounded-lg border border-slate-100">{w}</span>)}</div></div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase mb-2">Aparatos</p><div className="flex flex-wrap gap-1.5">{aiAnalysisResult.apparatusUsed?.map((a: string, i: number) => <span key={i} className="px-2 py-1 bg-indigo-50 text-[9px] font-black text-indigo-600 rounded-lg border border-indigo-100">{a}</span>)}</div></div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase mb-2">Habilidades</p><div className="flex flex-wrap gap-1.5">{aiAnalysisResult.skillsCovered?.map((s: string, i: number) => <span key={i} className="px-2 py-1 bg-emerald-50 text-[9px] font-black text-emerald-600 rounded-lg border border-emerald-100">{s}</span>)}</div></div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setAiAnalysisResult(null)} className="flex-1 py-4 text-[9px] font-black uppercase text-slate-400">Descartar</button>
                    <button onClick={saveClassFromAi} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-xl shadow-indigo-100">Confirmar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <StudentFormModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Nuevo Registro Atleta" />
      <StudentFormModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Datos Atleta" />

      <Nav />
    </div>
  );
};

export default App;
