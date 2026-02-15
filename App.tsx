import React, { useState, useEffect, useMemo, useRef } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, StaffMember, Biometrics, Discipline, PaymentStatus, Skill, Apparatus } from './types.ts';
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

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vista, setVista] = useState<ViewMode>('Hub');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
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
          estadoPago: 'Al día', asistenciasHistoricas: 156,
          qrCode: 'VAL_123', alertas: ['Absentismo Crítico'], habilidades: [],
          biometria: { fuerza: 85, flexibilidad: 92, tecnica: 78, resistencia: 70, coordinacion: 88 }
        });
        setAlumnos(await db.alumnos.toArray());
      }
      if (s.length === 0) {
        await db.staff.add({ id: 1, nombre: 'Marcos Ortega', rol: 'Head Coach', isClockedIn: false });
        setStaff(await db.staff.toArray());
      }
    } catch (err) {
      console.error("DB Error:", err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) loadData();
  }, [isLoggedIn]);

  useEffect(() => {
    if (selectedAlumno) {
      if (selectedAlumno.alertas && selectedAlumno.alertas.length > 0) {
        setNotificacionActiva({
          titulo: "Alerta de Rendimiento",
          desc: `${selectedAlumno.nombre} presenta: ${selectedAlumno.alertas[0]}`,
          tipo: "warning"
        });
      } else {
        setNotificacionActiva(null);
      }
    } else {
      setNotificacionActiva(null);
    }
  }, [selectedAlumno]);

  // --- AUDIO METHODS ---
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
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        processRecordedAudio(blob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
    }
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
      console.error("Error analizando audio:", err);
      setIsAnalyzing(false);
    }
  };

  const handleClarificationSubmit = async () => {
    if (!clarificationText) return;
    setIsAnalyzing(true);
    try {
      const result = await refineClassAnalysis(aiAnalysisResult, clarificationText);
      setAiAnalysisResult(result);
      setClarificationText("");
    } catch (err) {
      console.error("Error refinando:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveClassFromAi = async () => {
    if (!aiAnalysisResult) return;
    const newClass: Clase = {
      fecha: new Date().toISOString(),
      grupo: aiAnalysisResult.grupo || 'General',
      horario: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      entrenador: aiAnalysisResult.entrenador || 'Coach',
      warmup: aiAnalysisResult.warmup || [],
      apparatusUsed: aiAnalysisResult.apparatusUsed || [],
      skillsCovered: aiAnalysisResult.skillsCovered || []
    };
    await db.clases.add(newClass);
    setVista('Calendario');
    setAiAnalysisResult(null);
    loadData();
  };

  const handleTriggerAiAction = async () => {
    if (!selectedAlumno) return;
    setShowAiModal(true);
    setIsGeneratingAi(true);
    try {
      const msg = await getDraftMessage('alerta', selectedAlumno.nombre);
      setAiDraft(msg);
    } catch (e) {
      setAiDraft("No se pudo generar el mensaje.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSendWhatsapp = () => {
    const text = encodeURIComponent(aiDraft);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const filteredAlumnos = useMemo(() => {
    return alumnos.filter(a => 
      a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.dni.includes(searchQuery)
    );
  }, [alumnos, searchQuery]);

  // --- VIEWS ---

  const NuevaClaseVoiceView = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 text-center">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-microphone-lines text-2xl"></i>
        </div>
        <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter mb-2">Reporte por Voz</h3>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Habla sobre el calentamiento, los aparatos usados y las habilidades trabajadas hoy.</p>
        
        <div className="mt-12 mb-8 flex flex-col items-center">
          <button 
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${isRecording ? 'bg-rose-500 scale-125 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-200'}`}
          >
            {isRecording ? (
              <div className="flex gap-1 items-end h-6">
                {[1,2,3,4].map(i => <div key={i} className="w-1.5 bg-white rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`, height: `${Math.random()*100}%`}}></div>)}
              </div>
            ) : <i className="fas fa-microphone text-white text-3xl"></i>}
          </button>
          <p className="mt-6 text-[9px] font-black uppercase text-indigo-600 tracking-[0.2em]">{isRecording ? "Grabando... Suelta para finalizar" : "Mantén pulsado para hablar"}</p>
        </div>
      </div>

      {isAnalyzing && (
        <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 text-center animate-pulse">
           <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
           <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">IA Analizando tu mensaje...</p>
        </div>
      )}

      {aiAnalysisResult && !isAnalyzing && (
        <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 animate-in zoom-in duration-300">
          {aiAnalysisResult.clarificationNeeded ? (
            <div className="space-y-6">
              <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">Pregunta de la IA</p>
                <p className="text-xs font-bold text-slate-800 italic leading-relaxed">"{aiAnalysisResult.question}"</p>
              </div>
              <div className="space-y-2">
                <input 
                  type="text" 
                  value={clarificationText}
                  onChange={(e) => setClarificationText(e.target.value)}
                  placeholder="Escribe tu aclaración aquí..."
                  className="w-full bg-slate-50 p-4 rounded-2xl text-[11px] font-bold outline-none border border-slate-100 focus:border-indigo-300"
                />
                <button onClick={handleClarificationSubmit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg shadow-indigo-100">Enviar Aclaración</button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Resumen Extraído</h4>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded-full border border-emerald-100">Listo para guardar</span>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Calentamiento</p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiAnalysisResult.warmup?.map((w: string, i: number) => <span key={i} className="px-2 py-1 bg-white text-[9px] font-bold text-slate-600 rounded-lg border border-slate-100">{w}</span>)}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Aparatos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiAnalysisResult.apparatusUsed?.map((a: string, i: number) => <span key={i} className="px-2 py-1 bg-indigo-50 text-[9px] font-black text-indigo-600 rounded-lg border border-indigo-100">{a}</span>)}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Habilidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiAnalysisResult.skillsCovered?.map((s: string, i: number) => <span key={i} className="px-2 py-1 bg-emerald-50 text-[9px] font-black text-emerald-600 rounded-lg border border-emerald-100">{s}</span>)}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setAiAnalysisResult(null)} className="flex-1 py-4 text-[9px] font-black uppercase text-slate-400">Descartar</button>
                <button onClick={saveClassFromAi} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-xl shadow-indigo-100">Confirmar Registro</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const Nav = () => (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md glass rounded-[2.5rem] p-3 flex items-center justify-around shadow-2xl z-50 border border-white/50">
      {[
        { v: 'Hub', i: 'fa-house-user' },
        { v: 'Alumnos', i: 'fa-user-ninja' },
        { v: 'Calendario', i: 'fa-calendar-alt' },
        { v: 'Staff', i: 'fa-id-badge' }
      ].map(item => (
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
          <div className="w-20 h-20 bg-white/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 backdrop-blur-3xl border border-white/10 shadow-2xl">
            <i className="fas fa-medal text-3xl text-amber-400"></i>
          </div>
          <h1 className="text-4xl font-extrabold italic uppercase tracking-tighter mb-2 leading-none">GYMCOACH<br/><span className="text-indigo-400">PRO ELITE</span></h1>
          <button onClick={() => setIsLoggedIn(true)} className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-full font-extrabold uppercase text-xs tracking-widest shadow-xl">Sincronizar Terminal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-36 font-sans">
      {notificacionActiva && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[60] animate-in slide-in-from-top-10 duration-500">
           <div onClick={handleTriggerAiAction} className="bg-amber-50 border border-amber-200 p-4 rounded-3xl shadow-xl flex items-center gap-4 cursor-pointer active:scale-95 transition-all">
              <div className="w-10 h-10 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200"><i className="fas fa-triangle-exclamation"></i></div>
              <div className="flex-1"><p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{notificacionActiva.titulo}</p><p className="text-[11px] font-bold text-slate-700 leading-tight">{notificacionActiva.desc}</p></div>
              <i className="fas fa-chevron-right text-amber-300 text-xs"></i>
           </div>
        </div>
      )}

      <header className="pt-14 px-8 pb-8 bg-white/80 backdrop-blur-xl rounded-b-[3rem] shadow-sm flex justify-between items-end border-b border-slate-100 sticky top-0 z-40">
        <div>
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mb-1">Elite System</p>
          <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">
            {vista === 'NuevaClase' ? 'Reporte' : vista}
          </h2>
        </div>
        <button className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><i className="fas fa-bell text-sm"></i></button>
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
          <div className="space-y-6">
            <div className="flex gap-2">
              <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm flex items-center px-6 border border-slate-100">
                <i className="fas fa-search text-slate-300 mr-4"></i>
                <input type="text" placeholder="BUSCAR ATLETA..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent py-2 text-[10px] font-bold text-slate-800 outline-none uppercase tracking-widest" />
              </div>
            </div>
            <div className="space-y-3">
              {filteredAlumnos.map(a => (
                <div key={a.id} onClick={() => setSelectedAlumno(a)} 
                  className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xl italic">{a.nombre.charAt(0)}</div>
                    <div><p className="font-bold text-slate-800 text-sm uppercase">{a.nombre}</p><p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{a.disciplina} • {a.nivel}</p></div>
                  </div>
                  {a.alertas && a.alertas.length > 0 && <div className="w-2 h-2 bg-amber-500 rounded-full"></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === 'NuevaClase' && <NuevaClaseVoiceView />}

        {selectedAlumno && (
          <div className="space-y-6 page-transition pb-10">
            <button onClick={() => setSelectedAlumno(null)} className="text-[9px] font-extrabold text-indigo-600 uppercase flex items-center gap-2 mb-2 bg-indigo-50 px-4 py-2 rounded-full w-fit">
              <i className="fas fa-arrow-left"></i> Volver
            </button>
            <div className="bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-slate-100 p-8">
               <h3 className="text-2xl font-black text-slate-900 uppercase italic mb-6">{selectedAlumno.nombre}</h3>
               {selectedAlumno.alertas.length > 0 && (
                 <div className="bg-rose-50 p-6 rounded-[2.5rem] border border-rose-100 mb-8">
                    <p className="text-[8px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3">Problemas Detectados</p>
                    {selectedAlumno.alertas.map((al, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-700 uppercase">{al}</p>
                        <button onClick={handleTriggerAiAction} className="bg-rose-500 text-white px-4 py-2 rounded-full text-[8px] font-black uppercase shadow-lg shadow-rose-200">Atender con IA</button>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          </div>
        )}
      </main>

      {showAiModal && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-end sm:items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl border border-white/20">
              <h3 className="text-xl font-black uppercase italic mb-4 flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-wand-magic-sparkles text-sm"></i></div>
                 Borrador IA
              </h3>
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 min-h-[150px] relative">
                 {isGeneratingAi ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6">
                       <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                 ) : <p className="text-xs text-slate-700 font-medium leading-relaxed">{aiDraft}</p>}
              </div>
              <div className="flex flex-col gap-3 mt-8">
                <button onClick={handleSendWhatsapp} disabled={isGeneratingAi} className="w-full py-5 bg-emerald-500 text-white rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3">
                   <i className="fab fa-whatsapp text-lg"></i> Enviar vía WhatsApp
                </button>
                <button onClick={() => setShowAiModal(false)} className="w-full py-4 text-[9px] font-black uppercase text-slate-400">Descartar</button>
              </div>
           </div>
        </div>
      )}

      <Nav />
    </div>
  );
};

export default App;