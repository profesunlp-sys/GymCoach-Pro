
import React, { useState, useEffect, useMemo } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, StaffMember, Biometrics } from './types';
import { SKILL_TREE } from './constants';
import * as gemini from './services/geminiService';

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
  const [cargando, setCargando] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
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
          setAlumnos([defaultStudent]);
        } else {
          setAlumnos(a);
        }

        if (s.length === 0) {
          const defaultCoach: StaffMember = { id: 1, nombre: 'Marcos Ortega', rol: 'Head Coach', isClockedIn: false };
          await db.staff.add(defaultCoach);
          setStaff([defaultCoach]);
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
    const size = 200;
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

    const webPaths = [0.2, 0.4, 0.6, 0.8, 1].map(level => {
      return metrics.map((_, i) => {
        const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
        const x = center + radius * level * Math.cos(angle);
        const y = center + radius * level * Math.sin(angle);
        return `${x},${y}`;
      }).join(' ');
    });

    return (
      <div className="flex flex-col items-center justify-center p-4">
        <svg width={size} height={size} className="overflow-visible">
          {webPaths.map((path, idx) => (
            <polygon key={idx} points={path} fill="none" stroke="#e2e8f0" strokeWidth="1" />
          ))}
          <polygon points={coordinates} fill="rgba(79, 70, 229, 0.15)" stroke="#6366f1" strokeWidth="2.5" />
          {metrics.map((m, i) => {
            const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
            const lx = center + (radius + 25) * Math.cos(angle);
            const ly = center + (radius + 25) * Math.sin(angle);
            return (
              <text key={i} x={lx} y={ly} fontSize="10" fontWeight="700" textAnchor="middle" fill="#64748b" className="uppercase tracking-widest">
                {m.label}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  // --- NAVIGATION COMPONENT ---
  const Nav = () => (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md glass rounded-[2.5rem] p-3 flex items-center justify-around shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 border border-white/50">
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
          className={`flex flex-col items-center gap-1.5 transition-all px-4 py-2 rounded-2xl ${vista === item.v ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <i className={`fas ${item.i} text-lg`}></i>
          <span className="text-[8px] font-bold uppercase tracking-tighter">{item.v}</span>
        </button>
      ))}
    </nav>
  );

  // --- LOGIN SCREEN ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen auth-bg flex flex-col items-center justify-center p-8 text-white relative">
        <div className="z-10 w-full max-w-sm text-center">
          <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-8 backdrop-blur-3xl border border-white/10 shadow-2xl">
            <i className="fas fa-medal text-4xl text-amber-400"></i>
          </div>
          <h1 className="text-5xl font-extrabold italic uppercase tracking-tighter mb-2 leading-none">GYMCOACH<br/><span className="text-indigo-400">PRO ELITE</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.6em] mb-12">Performance Analytics v3.0</p>
          <button 
            onClick={() => setIsLoggedIn(true)} 
            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-extrabold uppercase text-xs tracking-[0.15em] shadow-[0_0_30px_rgba(79,70,229,0.4)] active:scale-[0.97] transition-all"
          >
            Sincronizar Terminal
          </button>
          <p className="mt-12 text-[9px] text-slate-500 font-medium uppercase tracking-widest">Powered by Google Gemini AI</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-36 font-sans">
      {/* HEADER SECTION */}
      <header className="pt-14 px-8 pb-8 bg-white/80 backdrop-blur-xl rounded-b-[3.5rem] shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex justify-between items-end border-b border-slate-100 sticky top-0 z-40">
        <div>
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mb-1">Operational Hub</p>
          <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">{vista}</h2>
        </div>
        <div className="flex gap-2">
          <button className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"><i className="fas fa-search"></i></button>
          <button className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner relative">
            <i className="fas fa-bell text-sm"></i>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-indigo-50"></span>
          </button>
        </div>
      </header>

      <main className="px-6 py-8 page-transition">
        {vista === 'Hub' && (
          <div className="space-y-6">
            {/* HERO DASHBOARD */}
            <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xl font-bold italic uppercase mb-1">Entrenamiento Activo</h3>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-8">Mar 24 • Centro de Alto Rendimiento</p>
                <div className="flex items-center gap-6 mb-8">
                   <div className="text-center">
                     <p className="text-2xl font-black italic">42</p>
                     <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">ATLETAS</p>
                   </div>
                   <div className="w-px h-8 bg-slate-800"></div>
                   <div className="text-center">
                     <p className="text-2xl font-black italic">8</p>
                     <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">COACHES</p>
                   </div>
                   <div className="w-px h-8 bg-slate-800"></div>
                   <div className="text-center">
                     <p className="text-2xl font-black italic text-indigo-400">92%</p>
                     <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">ASISTENCIA</p>
                   </div>
                </div>
                <button onClick={() => setVista('NuevaClase')} className="bg-white text-slate-900 px-8 py-3.5 rounded-full font-black text-[9px] uppercase shadow-lg hover:scale-105 active:scale-95 transition-all">Iniciar Pase de Lista</button>
              </div>
              <i className="fas fa-dumbbell absolute -bottom-12 -right-12 text-[16rem] text-white/[0.03] -rotate-12 group-hover:rotate-0 transition-transform duration-700"></i>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 bento-card">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Retención</p>
                <p className="text-2xl font-black text-indigo-950 italic">98.4%</p>
                <div className="mt-2 text-[7px] font-bold text-emerald-500 flex items-center gap-1">
                  <i className="fas fa-arrow-up"></i> 0.2% MES ANT.
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 bento-card">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bajas (Churn)</p>
                <p className="text-2xl font-black text-rose-500 italic">1.6%</p>
                <div className="mt-2 text-[7px] font-bold text-slate-300 uppercase">Healthy Range</div>
              </div>
            </div>

            {/* ALERT SECTION */}
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
              Alertas de Riesgo
              <span className="text-[8px] bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">2 CRÍTICAS</span>
            </h4>
            <div className="space-y-3">
               {alumnos.slice(0, 1).map(a => (
                 <div key={a.id} className="bg-rose-50/50 border border-rose-100 p-5 rounded-[2.5rem] flex justify-between items-center bento-card">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200"><i className="fas fa-exclamation-triangle"></i></div>
                     <div>
                       <p className="font-bold text-rose-900 text-xs uppercase">{a.nombre}</p>
                       <p className="text-[8px] text-rose-500/70 font-bold uppercase tracking-widest">3 Faltas Consecutivas</p>
                     </div>
                   </div>
                   <button className="text-[8px] font-black text-rose-600 bg-white px-5 py-2.5 rounded-full shadow-sm hover:bg-rose-600 hover:text-white transition-all uppercase">Contactar</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {vista === 'Atletas' && !selectedAlumno && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-4 rounded-3xl shadow-sm flex items-center px-6 border border-slate-100 focus-within:border-indigo-300 transition-colors">
              <i className="fas fa-search text-slate-300 mr-4"></i>
              <input 
                type="text" 
                placeholder="FILTRAR POR NOMBRE O DNI..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent py-2 text-[10px] font-bold text-slate-800 outline-none uppercase tracking-widest placeholder:text-slate-300" 
              />
            </div>
            
            <div className="space-y-3">
              {filteredAlumnos.map(a => (
                <div 
                  key={a.id} 
                  onClick={() => setSelectedAlumno(a)} 
                  className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group hover:border-indigo-100"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl italic shadow-inner ${a.estadoPago === 'Al día' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                      {a.nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm uppercase group-hover:text-indigo-600 transition-colors">{a.nombre}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[8px] font-bold px-2.5 py-1 bg-slate-50 rounded-full text-slate-400 uppercase border border-slate-100">{a.disciplina}</span>
                        <span className={`text-[8px] font-bold px-2.5 py-1 rounded-full uppercase ${a.estadoPago === 'Al día' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{a.estadoPago}</span>
                      </div>
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-slate-200 text-xs group-hover:text-indigo-300 group-hover:translate-x-1 transition-all"></i>
                </div>
              ))}
              {filteredAlumnos.length === 0 && (
                <div className="text-center py-20 text-slate-300">
                  <i className="fas fa-ghost text-4xl mb-4 opacity-10"></i>
                  <p className="text-[10px] font-bold uppercase tracking-widest">No hay resultados</p>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedAlumno && (
          <div className="space-y-6 animate-fadeIn">
            <button onClick={() => setSelectedAlumno(null)} className="text-[9px] font-bold text-indigo-600 uppercase mb-2 flex items-center gap-2 px-2 hover:bg-indigo-50 w-fit py-1 rounded-lg transition-all">
              <i className="fas fa-arrow-left"></i> Volver a Directorio
            </button>
            
            <div className="bg-white p-8 rounded-[3.5rem] shadow-xl text-center border border-slate-50">
               <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-4xl font-black italic shadow-2xl shadow-indigo-200">
                 {selectedAlumno.nombre.charAt(0)}
               </div>
               <h3 className="text-2xl font-black italic text-slate-900 uppercase leading-tight">{selectedAlumno.nombre}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2 mb-8">{selectedAlumno.nivel} • DNI: {selectedAlumno.dni}</p>
               
               <div className="bg-slate-50 rounded-[3rem] p-6 mb-8 border border-slate-100 flex flex-col md:flex-row gap-8 items-center justify-center">
                  <RadarChart data={selectedAlumno.biometria} />
                  <div className="grid grid-cols-2 gap-4 w-full">
                     <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 text-left">
                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Efectividad</p>
                        <p className="text-xl font-black text-indigo-950 italic">74%</p>
                     </div>
                     <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 text-left">
                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Sesiones</p>
                        <p className="text-xl font-black text-indigo-950 italic">{selectedAlumno.asistenciasHistoricas}</p>
                     </div>
                     <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 text-left col-span-2">
                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Status Académico</p>
                        <p className="text-xs font-black text-emerald-600 uppercase italic">Progreso Excepcional</p>
                     </div>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <button className="py-4 bg-indigo-950 text-white rounded-3xl font-black uppercase text-[9px] tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all">Registrar Skill</button>
                  <button className="py-4 bg-white text-indigo-950 border-2 border-indigo-950 rounded-3xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all">Digital ID</button>
               </div>
            </div>
          </div>
        )}

        {vista === 'Finanzas' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-indigo-600 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
               <div className="relative z-10">
                 <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Recaudación Proyectada</p>
                 <p className="text-5xl font-black italic tracking-tighter">$12,450</p>
                 <div className="mt-8 flex gap-3">
                   <span className="text-[8px] font-bold bg-white/20 px-3 py-1.5 rounded-full uppercase">92% COBRADO</span>
                   <span className="text-[8px] font-bold bg-rose-400/30 text-rose-100 px-3 py-1.5 rounded-full uppercase">8% PENDIENTE</span>
                 </div>
               </div>
               <i className="fas fa-vault absolute -bottom-10 -right-10 text-[14rem] text-white/5 rotate-12"></i>
            </div>
            
            <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-100">
               <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-6 flex justify-between items-center">
                 Cuotas Vencidas
                 <i className="fas fa-ellipsis-h text-slate-300"></i>
               </h4>
               <div className="space-y-4">
                  {alumnos.length > 0 ? (
                    alumnos.map(a => (
                      <div key={a.id} className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xs uppercase">{a.nombre.charAt(0)}</div>
                          <div>
                            <p className="font-bold text-xs uppercase text-slate-800">{a.nombre}</p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Plan {a.nivel}</p>
                          </div>
                        </div>
                        <button className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                          <i className="fas fa-bell text-[10px]"></i>
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-[10px] text-slate-400 uppercase font-bold py-10">No hay registros financieros</p>
                  )}
               </div>
            </div>
          </div>
        )}

        {vista === 'Staff' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 gap-4">
              {staff.map(s => (
                <div key={s.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex items-center justify-between group bento-card">
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <div className="w-16 h-16 bg-slate-50 rounded-[1.8rem] flex items-center justify-center text-indigo-400 shadow-inner group-hover:scale-110 transition-transform">
                        <i className="fas fa-id-badge text-2xl"></i>
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white ${s.isClockedIn ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm uppercase">{s.nombre}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{s.rol}</p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      const newStatus = !s.isClockedIn;
                      await db.staff.update(s.id!, { isClockedIn: newStatus });
                      setStaff(await db.staff.toArray());
                    }}
                    className={`px-8 py-3.5 rounded-full font-black uppercase text-[9px] transition-all active:scale-95 ${s.isClockedIn ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'}`}
                  >
                    {s.isClockedIn ? 'Check-Out' : 'Check-In'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Nav />
    </div>
  );
};

export default App;
