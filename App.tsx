
import React, { useState, useEffect, useMemo } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, StaffMember, Biometrics } from './types.ts';
import { SKILL_TREE } from './constants.tsx';
import * as gemini from './services/geminiService.ts';

// --- DATABASE ---
const db = new Dexie('GymCoachElite_v3') as Dexie & {
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
  const [searchQuery, setSearchQuery] = useState("");

  // --- DATA LOADING ---
  useEffect(() => {
    if (!isLoggedIn) return;
    const initData = async () => {
      try {
        const a = await db.alumnos.toArray();
        const s = await db.staff.toArray();
        
        if (a.length === 0) {
          const defaultStudent: Alumno = {
            nombre: 'Valentina Silva',
            dni: '12345678',
            disciplina: 'GAF',
            nivel: 'Elite Junior',
            fechaIngreso: new Date().toISOString(),
            estadoPago: 'Al día',
            asistenciasHistoricas: 156,
            qrCode: 'VAL_123',
            alertas: [],
            habilidades: [],
            biometria: { fuerza: 85, flexibilidad: 92, tecnica: 78, resistencia: 70, coordinacion: 88 }
          };
          await db.alumnos.add(defaultStudent);
          const updatedA = await db.alumnos.toArray();
          setAlumnos(updatedA);
        } else {
          setAlumnos(a);
        }

        if (s.length === 0) {
          const defaultCoach: StaffMember = { id: 1, nombre: 'Marcos Ortega', rol: 'Head Coach', isClockedIn: false };
          await db.staff.add(defaultCoach);
          const updatedS = await db.staff.toArray();
          setStaff(updatedS);
        } else {
          setStaff(s);
        }
      } catch (err) {
        console.error("Database initialization failed:", err);
      }
    };
    initData();
  }, [isLoggedIn]);

  const filteredAlumnos = useMemo(() => {
    return alumnos.filter(a => 
      a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.dni.includes(searchQuery)
    );
  }, [alumnos, searchQuery]);

  // --- RADAR CHART COMPONENT ---
  const RadarChart = ({ data }: { data: Biometrics }) => {
    const safeData = data || { fuerza: 0, flexibilidad: 0, tecnica: 0, resistencia: 0, coordinacion: 0 };
    const size = 180;
    const center = size / 2;
    const radius = size * 0.35;
    const metrics = [
      { label: 'Fuerza', val: safeData.fuerza },
      { label: 'Flex', val: safeData.flexibilidad },
      { label: 'Téc', val: safeData.tecnica },
      { label: 'Res', val: safeData.resistencia },
      { label: 'Coor', val: safeData.coordinacion },
    ];
    
    const coordinates = metrics.map((m, i) => {
      const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
      const x = center + radius * (m.val / 100) * Math.cos(angle);
      const y = center + radius * (m.val / 100) * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="flex flex-col items-center justify-center p-2">
        <svg width={size} height={size} className="overflow-visible">
          {[0.2, 0.4, 0.6, 0.8, 1].map((level, idx) => (
            <polygon key={idx} points={metrics.map((_, i) => {
              const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
              return `${center + radius * level * Math.cos(angle)},${center + radius * level * Math.sin(angle)}`;
            }).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="1" />
          ))}
          <polygon points={coordinates} fill="rgba(79, 70, 229, 0.15)" stroke="#6366f1" strokeWidth="2" />
          {metrics.map((m, i) => {
            const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
            const lx = center + (radius + 20) * Math.cos(angle);
            const ly = center + (radius + 20) * Math.sin(angle);
            return (
              <text key={i} x={lx} y={ly} fontSize="9" fontWeight="700" textAnchor="middle" fill="#64748b" className="uppercase">
                {m.label}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  const Nav = () => (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md glass rounded-[2.5rem] p-3 flex items-center justify-around shadow-2xl z-50 border border-white/50">
      {[
        { v: 'Hub', i: 'fa-house-user' },
        { v: 'Atletas', i: 'fa-user-ninja' },
        { v: 'Progreso', i: 'fa-chart-line' },
        { v: 'Finanzas', i: 'fa-sack-dollar' },
        { v: 'Staff', i: 'fa-id-badge' }
      ].map(item => (
        <button 
          key={item.v} 
          onClick={() => { setVista(item.v as ViewMode); setSelectedAlumno(null); }} 
          className={`flex flex-col items-center gap-1.5 transition-all px-4 py-2 rounded-2xl ${vista === item.v ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'}`}
        >
          <i className={`fas ${item.i} text-lg`}></i>
          <span className="text-[8px] font-bold uppercase tracking-tighter">{item.v}</span>
        </button>
      ))}
    </nav>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen auth-bg flex flex-col items-center justify-center p-8 text-white">
        <div className="z-10 w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-white/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 backdrop-blur-3xl border border-white/10 shadow-2xl">
            <i className="fas fa-medal text-3xl text-amber-400"></i>
          </div>
          <h1 className="text-4xl font-extrabold italic uppercase tracking-tighter mb-2">GYMCOACH<br/><span className="text-indigo-400">PRO ELITE</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.5em] mb-12">Performance Analytics</p>
          <button 
            onClick={() => setIsLoggedIn(true)} 
            className="w-full py-5 bg-indigo-600 text-white rounded-full font-extrabold uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-36 font-sans">
      <header className="pt-14 px-8 pb-8 bg-white/80 backdrop-blur-xl rounded-b-[3rem] shadow-sm flex justify-between items-end border-b border-slate-100 sticky top-0 z-40">
        <div>
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mb-1">Elite Suite</p>
          <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">{vista}</h2>
        </div>
        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
          <i className="fas fa-bell text-sm"></i>
        </div>
      </header>

      <main className="px-6 py-8 page-transition">
        {vista === 'Hub' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <h3 className="text-xl font-bold italic uppercase mb-1">Entrenamiento Activo</h3>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-6">Centro de Alto Rendimiento</p>
                <div className="flex gap-4">
                  <div className="bg-white/10 p-4 rounded-2xl border border-white/5">
                    <p className="text-2xl font-black italic">{alumnos.length}</p>
                    <p className="text-[7px] font-bold text-slate-500 uppercase">Atletas</p>
                  </div>
                  <div className="bg-white/10 p-4 rounded-2xl border border-white/5">
                    <p className="text-2xl font-black italic text-indigo-400">92%</p>
                    <p className="text-[7px] font-bold text-slate-500 uppercase">Asistencia</p>
                  </div>
                </div>
                <i className="fas fa-dumbbell absolute -bottom-10 -right-10 text-[12rem] text-white/[0.03] -rotate-12"></i>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 bento-card">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Retención</p>
                <p className="text-2xl font-black text-indigo-950 italic">98.4%</p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 bento-card">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bajas</p>
                <p className="text-2xl font-black text-rose-500 italic">1.6%</p>
              </div>
            </div>
          </div>
        )}

        {vista === 'Atletas' && !selectedAlumno && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center px-6 border border-slate-100">
              <i className="fas fa-search text-slate-300 mr-4"></i>
              <input 
                type="text" 
                placeholder="BUSCAR ATLETA..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent py-2 text-[10px] font-bold text-slate-800 outline-none uppercase tracking-widest" 
              />
            </div>
            
            <div className="space-y-3">
              {filteredAlumnos.map(a => (
                <div 
                  key={a.id} 
                  onClick={() => setSelectedAlumno(a)} 
                  className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl italic shadow-inner ${a.estadoPago === 'Al día' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                      {a.nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm uppercase">{a.nombre}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{a.disciplina} • {a.nivel}</p>
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-slate-200 text-xs"></i>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedAlumno && (
          <div className="space-y-6 animate-fadeIn">
            <button onClick={() => setSelectedAlumno(null)} className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-2">
              <i className="fas fa-arrow-left"></i> Volver
            </button>
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 text-center">
               <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-3xl font-black italic shadow-2xl shadow-indigo-200">
                 {selectedAlumno.nombre.charAt(0)}
               </div>
               <h3 className="text-2xl font-black italic text-slate-900 uppercase leading-none">{selectedAlumno.nombre}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase mt-3 mb-8">{selectedAlumno.nivel}</p>
               
               <RadarChart data={selectedAlumno.biometria} />
               
               <div className="grid grid-cols-2 gap-4 mt-8">
                  <button className="py-4 bg-indigo-950 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest">Skills</button>
                  <button className="py-4 bg-white text-indigo-950 border-2 border-indigo-950 rounded-2xl font-black uppercase text-[9px] tracking-widest">ID Card</button>
               </div>
            </div>
          </div>
        )}

        {vista === 'Staff' && (
          <div className="space-y-4 animate-fadeIn">
            {staff.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group bento-card">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${s.isClockedIn ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-slate-300'}`}></div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm uppercase">{s.nombre}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{s.rol}</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    const newStatus = !s.isClockedIn;
                    await db.staff.update(s.id!, { isClockedIn: newStatus });
                    const updatedS = await db.staff.toArray();
                    setStaff(updatedS);
                  }}
                  className={`px-6 py-3 rounded-full font-black uppercase text-[9px] transition-all ${s.isClockedIn ? 'bg-rose-50 text-rose-600' : 'bg-indigo-600 text-white'}`}
                >
                  {s.isClockedIn ? 'Salida' : 'Entrada'}
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
