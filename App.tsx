
import React, { useState, useEffect } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, StaffMember, Biometrics } from './types';
import { SKILL_TREE } from './constants';
import * as gemini from './services/geminiService';

// --- DATABASE ---
const db = new Dexie('GymCoachMasterDBV2') as Dexie & {
  alumnos: EntityTable<Alumno, 'id'>;
  clases: EntityTable<Clase, 'id'>;
  staff: EntityTable<StaffMember, 'id'>;
};

db.version(1).stores({
  alumnos: '++id, dni, nombre, estadoPago, disciplina',
  clases: '++id, fecha, grupo',
  staff: '++id, nombre, isClockedIn'
});

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vista, setVista] = useState<ViewMode>('Hub');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [cargando, setCargando] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");

  // --- INIT ---
  useEffect(() => {
    if (!isLoggedIn) return;
    const load = async () => {
      try {
        const a = await db.alumnos.toArray();
        const s = await db.staff.toArray();
        setAlumnos(a);
        setStaff(s);

        if (a.length === 0) {
          await db.alumnos.add({
            nombre: 'Elena Rodríguez', dni: '4455', disciplina: 'GAF', nivel: 'Nivel 4',
            fechaIngreso: '2024-01-01', estadoPago: 'Al día', asistenciasHistoricas: 24,
            qrCode: 'STUDENT_4455', alertas: [], habilidades: [],
            biometria: { fuerza: 80, flexibilidad: 90, tecnica: 70, resistencia: 60, coordinacion: 85 }
          });
          setAlumnos(await db.alumnos.toArray());
        }
        if (s.length === 0) {
          await db.staff.add({ nombre: 'Coach Javier', rol: 'Head Coach', isClockedIn: false });
          setStaff(await db.staff.toArray());
        }
      } catch (err) {
        console.error("Error cargando base de datos:", err);
      }
    };
    load();
  }, [isLoggedIn, vista]);

  // --- RADAR CHART COMPONENT ---
  const RadarChart = ({ data }: { data: Biometrics }) => {
    // Fallback por si los datos biométricos no existen en registros antiguos
    const safeData = data || { fuerza: 0, flexibilidad: 0, tecnica: 0, resistencia: 0, coordinacion: 0 };
    const size = 160;
    const center = size / 2;
    const radius = size * 0.4;
    const points = [
      { label: 'Fuerza', val: safeData.fuerza },
      { label: 'Flex', val: safeData.flexibilidad },
      { label: 'Tec', val: safeData.tecnica },
      { label: 'Res', val: safeData.resistencia },
      { label: 'Coor', val: safeData.coordinacion },
    ];
    
    const coordinates = points.map((p, i) => {
      const angle = (Math.PI * 2 * i) / points.length - Math.PI / 2;
      const x = center + radius * (p.val / 100) * Math.cos(angle);
      const y = center + radius * (p.val / 100) * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="flex flex-col items-center">
        <svg width={size} height={size} className="overflow-visible">
          <polygon points={coordinates} fill="rgba(79, 70, 229, 0.2)" stroke="#4f46e5" strokeWidth="2" />
          {points.map((p, i) => {
            const angle = (Math.PI * 2 * i) / points.length - Math.PI / 2;
            const tx = center + (radius + 15) * Math.cos(angle);
            const ty = center + (radius + 15) * Math.sin(angle);
            return <text key={i} x={tx} y={ty} fontSize="8" fontWeight="bold" textAnchor="middle" fill="#64748b" className="uppercase">{p.label}</text>;
          })}
        </svg>
      </div>
    );
  };

  // --- NAVIGATION ---
  const Nav = () => (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-lg glass rounded-[3rem] p-4 flex items-center justify-between shadow-2xl z-50 border border-white/40">
      {[
        { v: 'Hub', i: 'fa-th-large' },
        { v: 'Atletas', i: 'fa-users' },
        { v: 'Progreso', i: 'fa-chart-pie' },
        { v: 'Finanzas', i: 'fa-wallet' },
        { v: 'Staff', i: 'fa-id-card' }
      ].map(item => (
        <button key={item.v} onClick={() => { setVista(item.v as ViewMode); setSelectedAlumno(null); }} className={`flex flex-col items-center gap-1 transition-all px-4 ${vista === item.v ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <i className={`fas ${item.i} text-xl`}></i>
          <span className="text-[7px] font-black uppercase tracking-tighter">{item.v}</span>
        </button>
      ))}
    </nav>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen auth-bg flex flex-col items-center justify-center p-10 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 backdrop-blur-3xl border border-white/20 shadow-2xl animate-bounce">
            <i className="fas fa-medal text-4xl text-yellow-400"></i>
          </div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-4">GYMCOACH<br/><span className="text-indigo-500">PRO ELITE</span></h1>
          <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.5em] mb-16 opacity-60">High Performance Management</p>
          <button onClick={() => setIsLoggedIn(true)} className="w-full py-6 bg-white text-indigo-950 rounded-full font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all">Iniciar Sistema</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-40">
      <header className="pt-16 px-10 pb-10 bg-white rounded-b-[4rem] shadow-sm flex justify-between items-end border-b border-slate-100">
        <div>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-2">Operational Hub</p>
          <h2 className="text-4xl font-black italic text-indigo-950 uppercase tracking-tighter leading-none">{vista}</h2>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setVista('Config')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300"><i className="fas fa-gear"></i></button>
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner"><i className="fas fa-bell"></i></div>
        </div>
      </header>

      <main className="p-8 page-transition">
        {vista === 'Hub' && (
          <div className="space-y-8">
            <div className="bg-indigo-950 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group">
              <h3 className="text-2xl font-black italic uppercase mb-2">Entrenamiento Hoy</h3>
              <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-10 opacity-70">Sesión Activa • {alumnos.length} Atletas</p>
              <div className="flex gap-4">
                <button onClick={() => setVista('NuevaClase')} className="bg-white text-indigo-950 px-8 py-4 rounded-full font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">Pasar Lista</button>
              </div>
              <i className="fas fa-dumbbell absolute -bottom-10 -right-10 text-[14rem] text-white/5 -rotate-12 group-hover:rotate-0 transition-transform duration-1000"></i>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-50">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Churn Rate</p>
                <p className="text-3xl font-black text-rose-500 italic">2.1%</p>
                <span className="text-[8px] font-bold text-emerald-500">Bajo Control</span>
              </div>
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-50">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Retention</p>
                <p className="text-3xl font-black text-indigo-950 italic">97.9%</p>
                <span className="text-[8px] font-bold text-slate-300">Elite Standards</span>
              </div>
            </div>

            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">Alertas Recientes</h4>
            <div className="space-y-4">
               {alumnos.filter(a => a.estadoPago === 'Vencido').slice(0, 2).map(a => (
                 <div key={a.id} className="bg-rose-50 border border-rose-100 p-6 rounded-[2.5rem] flex justify-between items-center">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><i className="fas fa-triangle-exclamation"></i></div>
                     <div>
                       <p className="font-black text-rose-900 text-xs uppercase">{a.nombre}</p>
                       <p className="text-[8px] text-rose-400 font-bold uppercase">Pago Vencido</p>
                     </div>
                   </div>
                   <button className="text-[9px] font-black text-rose-600 bg-white px-4 py-2 rounded-full shadow-sm">Notificar</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {vista === 'Atletas' && !selectedAlumno && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-full shadow-sm flex items-center px-8 border border-slate-100">
              <i className="fas fa-search text-slate-300 mr-4"></i>
              <input type="text" placeholder="FILTRAR ATLETAS..." className="w-full bg-transparent py-4 text-[10px] font-black text-slate-800 outline-none uppercase tracking-widest" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              {alumnos.map(a => (
                <div key={a.id} onClick={() => setSelectedAlumno(a)} className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-50 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group">
                  <div className="flex items-center gap-5">
                    <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center font-black text-2xl italic shadow-inner ${a.estadoPago === 'Al día' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                      {a.nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-indigo-950 text-sm uppercase group-hover:text-indigo-600 transition-colors">{a.nombre}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[8px] font-black px-2 py-1 bg-slate-100 rounded-full text-slate-500 uppercase">{a.disciplina}</span>
                        <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase ${a.estadoPago === 'Al día' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{a.estadoPago}</span>
                      </div>
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-slate-200 group-hover:translate-x-1 transition-transform"></i>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedAlumno && (
          <div className="space-y-8 animate-fadeIn">
            <button onClick={() => setSelectedAlumno(null)} className="text-[10px] font-black text-indigo-600 uppercase mb-4 flex items-center gap-2">
              <i className="fas fa-arrow-left"></i> Volver
            </button>
            <div className="bg-white p-10 rounded-[4rem] shadow-xl text-center border border-slate-50">
               <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-4xl font-black italic border-2 border-indigo-100">
                 {selectedAlumno.nombre.charAt(0)}
               </div>
               <h3 className="text-2xl font-black italic text-indigo-950 uppercase">{selectedAlumno.nombre}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{selectedAlumno.nivel}</p>
               
               <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {selectedAlumno.biometria && <RadarChart data={selectedAlumno.biometria} />}
                  <div className="flex flex-col justify-center text-left space-y-4">
                     <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Progreso Técnico</p>
                        <p className="text-xl font-black text-indigo-950 italic">74%</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Asistencias</p>
                        <p className="text-xl font-black text-indigo-950 italic">{selectedAlumno.asistenciasHistoricas}</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {vista === 'Progreso' && (
          <div className="space-y-8">
            <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-50">
               <h3 className="text-xl font-black italic text-indigo-950 uppercase mb-4">Análisis Biomecánico</h3>
               <div className="aspect-video bg-slate-900 rounded-[2.5rem] flex items-center justify-center">
                  <i className="fas fa-play text-white/10 text-4xl"></i>
               </div>
               <p className="text-center text-[10px] text-slate-400 font-black uppercase mt-6">Laboratorio de IA Activo</p>
            </div>
          </div>
        )}

        {vista === 'Finanzas' && (
          <div className="space-y-6">
            <div className="bg-emerald-500 p-10 rounded-[3.5rem] text-white shadow-xl relative overflow-hidden">
               <p className="text-[10px] font-black uppercase opacity-60 mb-2">Ingresos Estimados</p>
               <p className="text-5xl font-black italic tracking-tighter">$8,420</p>
               <i className="fas fa-coins absolute -bottom-10 -right-10 text-[12rem] text-white/10 rotate-12"></i>
            </div>
            
            <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-50">
               <h4 className="text-[10px] font-black text-indigo-950 uppercase tracking-widest mb-6">Membresías Pendientes</h4>
               <div className="space-y-4">
                  {alumnos.filter(a => a.estadoPago === 'Vencido').map(a => (
                    <div key={a.id} className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0">
                      <p className="font-black text-xs uppercase text-slate-800">{a.nombre}</p>
                      <button className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><i className="fas fa-paper-plane text-[10px]"></i></button>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {vista === 'Staff' && (
          <div className="space-y-8">
            {staff.map(s => (
              <div key={s.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${s.isClockedIn ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                  <div>
                    <p className="font-black text-indigo-950 text-sm uppercase">{s.nombre}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase">{s.rol}</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    const newStatus = !s.isClockedIn;
                    await db.staff.update(s.id!, { isClockedIn: newStatus });
                    setStaff(await db.staff.toArray());
                  }}
                  className={`px-6 py-3 rounded-full font-black uppercase text-[9px] transition-all ${s.isClockedIn ? 'bg-rose-50 text-rose-600' : 'bg-indigo-600 text-white'}`}
                >
                  {s.isClockedIn ? 'Salir' : 'Entrar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Nav />
    </div>
  );
};

export default App;
