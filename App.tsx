
import React, { useState, useEffect, useMemo } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, StaffMember, Biometrics, Discipline, PaymentStatus } from './types.ts';
import { SKILL_TREE, DISCIPLINAS, NIVELES } from './constants.tsx';
import * as gemini from './services/geminiService.ts';

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

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vista, setVista] = useState<ViewMode>('Hub');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state for new Alumno
  const [newAlumno, setNewAlumno] = useState({
    nombre: '',
    dni: '',
    disciplina: 'GAF' as Discipline,
    nivel: 'Iniciación',
    estadoPago: 'Al día' as PaymentStatus
  });

  // --- INITIALIZE DATA ---
  const loadData = async () => {
    try {
      const a = await db.alumnos.toArray();
      const s = await db.staff.toArray();
      setAlumnos(a);
      setStaff(s);
      
      // Seed data if empty
      if (a.length === 0) {
        await db.alumnos.add({
          nombre: 'Valentina Silva', dni: '12345678', disciplina: 'GAF', nivel: 'Elite',
          fechaIngreso: new Date().toISOString(), estadoPago: 'Al día', asistenciasHistoricas: 156,
          qrCode: 'VAL_123', alertas: [], habilidades: [],
          biometria: { fuerza: 85, flexibilidad: 92, tecnica: 78, resistencia: 70, coordinacion: 88 }
        });
        const updatedA = await db.alumnos.toArray();
        setAlumnos(updatedA);
      }
      if (s.length === 0) {
        await db.staff.add({ id: 1, nombre: 'Marcos Ortega', rol: 'Head Coach', isClockedIn: false });
        const updatedS = await db.staff.toArray();
        setStaff(updatedS);
      }
    } catch (err) {
      console.error("DB Error:", err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) loadData();
  }, [isLoggedIn]);

  const filteredAlumnos = useMemo(() => {
    return alumnos.filter(a => 
      a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.dni.includes(searchQuery)
    );
  }, [alumnos, searchQuery]);

  const handleAddAlumno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlumno.nombre || !newAlumno.dni) return;

    const student: Alumno = {
      ...newAlumno,
      fechaIngreso: new Date().toISOString(),
      asistenciasHistoricas: 0,
      qrCode: `QR_${newAlumno.dni}`,
      alertas: [],
      habilidades: [],
      biometria: { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 }
    };
    
    await db.alumnos.add(student);
    setShowAddModal(false);
    await loadData();
    setNewAlumno({ nombre: '', dni: '', disciplina: 'GAF', nivel: 'Iniciación', estadoPago: 'Al día' });
  };

  // --- COMPONENTS ---
  const RadarChart = ({ data }: { data: Biometrics }) => {
    const size = 160;
    const center = size / 2;
    const radius = size * 0.35;
    const labels = ['Fuerza', 'Flex', 'Téc', 'Res', 'Coor'];
    const values = [data.fuerza, data.flexibilidad, data.tecnica, data.resistencia, data.coordinacion];
    
    const points = values.map((v, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return `${center + radius * (v / 100) * Math.cos(angle)},${center + radius * (v / 100) * Math.sin(angle)}`;
    }).join(' ');

    return (
      <div className="flex flex-col items-center justify-center p-2 bg-slate-50/50 rounded-3xl border border-slate-100/50">
        <svg width={size} height={size} className="overflow-visible">
          {[0.5, 1].map((level, idx) => (
            <polygon key={idx} points={Array(5).fill(0).map((_, i) => {
              const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
              return `${center + radius * level * Math.cos(angle)},${center + radius * level * Math.sin(angle)}`;
            }).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="1" />
          ))}
          <polygon points={points} fill="rgba(79, 70, 229, 0.2)" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
          {labels.map((label, i) => {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const tx = center + (radius + 20) * Math.cos(angle);
            const ty = center + (radius + 20) * Math.sin(angle);
            return <text key={i} x={tx} y={ty} fontSize="8" fontWeight="800" textAnchor="middle" fill="#94a3b8" className="uppercase tracking-tighter">{label}</text>;
          })}
        </svg>
      </div>
    );
  };

  const Nav = () => (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md glass rounded-[2.5rem] p-3 flex items-center justify-around shadow-2xl z-50 border border-white/50">
      {[
        { v: 'Hub', i: 'fa-house-user' },
        { v: 'Alumnos', i: 'fa-user-ninja' },
        { v: 'Progreso', i: 'fa-chart-line' },
        { v: 'Finanzas', i: 'fa-sack-dollar' },
        { v: 'Staff', i: 'fa-id-badge' }
      ].map(item => (
        <button key={item.v} onClick={() => { setVista(item.v as ViewMode); setSelectedAlumno(null); }} 
          className={`flex flex-col items-center gap-1.5 transition-all px-4 py-2 rounded-2xl ${vista === item.v ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}>
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
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.5em] mb-12">Performance Suite 2025</p>
          <button onClick={() => setIsLoggedIn(true)} className="w-full py-5 bg-indigo-600 text-white rounded-full font-extrabold uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all hover:bg-indigo-500">Acceder al Sistema</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-36 font-sans">
      <header className="pt-14 px-8 pb-8 bg-white/80 backdrop-blur-xl rounded-b-[3rem] shadow-sm flex justify-between items-end border-b border-slate-100 sticky top-0 z-40">
        <div>
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mb-1">Academy OS</p>
          <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">{vista}</h2>
        </div>
        <button className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center hover:bg-indigo-100 transition-colors">
          <i className="fas fa-bell text-sm"></i>
        </button>
      </header>

      <main className="px-6 py-8 page-transition">
        {vista === 'Hub' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <h3 className="text-xl font-bold italic uppercase mb-1">Estado de Operación</h3>
                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mb-6">Métricas de Rendimiento</p>
                <div className="flex gap-4">
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex-1">
                    <p className="text-3xl font-black italic">{alumnos.length}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase">Alumnos Activos</p>
                  </div>
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex-1">
                    <p className="text-3xl font-black italic text-indigo-400">92%</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase">Ratio de Retención</p>
                  </div>
                </div>
                <i className="fas fa-chart-line absolute -bottom-10 -right-10 text-[10rem] text-white/[0.03] -rotate-12"></i>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setVista('Alumnos')} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-start gap-4 active:scale-95 transition-all text-left group">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <i className="fas fa-users"></i>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atletas</p>
                  <p className="text-lg font-bold text-slate-900 italic uppercase">Gestión</p>
                </div>
              </button>
              <button onClick={() => setVista('Staff')} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-start gap-4 active:scale-95 transition-all text-left group">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <i className="fas fa-user-tie"></i>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Personal</p>
                  <p className="text-lg font-bold text-slate-900 italic uppercase">Control</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {vista === 'Alumnos' && !selectedAlumno && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm flex items-center px-6 border border-slate-100 focus-within:border-indigo-300 transition-colors">
                <i className="fas fa-search text-slate-300 mr-4"></i>
                <input 
                  type="text" 
                  placeholder="BUSCAR NOMBRE O DNI..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent py-2 text-[10px] font-bold text-slate-800 outline-none uppercase tracking-widest placeholder:text-slate-300" 
                />
              </div>
              <button 
                onClick={() => setShowAddModal(true)} 
                className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 active:scale-90 transition-all hover:bg-indigo-700"
              >
                <i className="fas fa-plus text-lg"></i>
              </button>
            </div>
            
            <div className="space-y-3">
              {filteredAlumnos.length > 0 ? filteredAlumnos.map(a => (
                <div key={a.id} onClick={() => setSelectedAlumno(a)} 
                  className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer hover:border-indigo-200">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl italic shadow-inner ${a.estadoPago === 'Al día' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                      {a.nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm uppercase">{a.nombre}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-wider">{a.disciplina} • {a.nivel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.estadoPago !== 'Al día' && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    )}
                    <i className="fas fa-chevron-right text-slate-200 text-xs"></i>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center">
                  <i className="fas fa-user-slash text-4xl text-slate-100 mb-4"></i>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No se encontraron alumnos</p>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedAlumno && (
          <div className="space-y-6 page-transition">
            <button onClick={() => setSelectedAlumno(null)} className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-2 px-2 hover:translate-x-1 transition-transform">
              <i className="fas fa-arrow-left"></i> Volver al Directorio
            </button>
            
            <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-50 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -mr-10 -mt-10"></div>
               
               <div className="text-center relative z-10">
                 <div className="w-24 h-24 bg-indigo-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-4xl font-black italic shadow-2xl shadow-indigo-100">
                   {selectedAlumno.nombre.charAt(0)}
                 </div>
                 <h3 className="text-2xl font-black italic text-slate-900 uppercase leading-none">{selectedAlumno.nombre}</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase mt-3 mb-8 tracking-[0.2em]">{selectedAlumno.nivel}</p>
                 
                 <RadarChart data={selectedAlumno.biometria} />
                 
                 <div className="grid grid-cols-2 gap-4 mt-8">
                    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">DNI / ID</p>
                      <p className="text-xs font-bold text-slate-800">{selectedAlumno.dni}</p>
                    </div>
                    <div className={`p-5 rounded-3xl border text-left ${selectedAlumno.estadoPago === 'Al día' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado de Pago</p>
                      <p className={`text-[10px] font-black uppercase italic ${selectedAlumno.estadoPago === 'Al día' ? 'text-emerald-600' : 'text-rose-600'}`}>{selectedAlumno.estadoPago}</p>
                    </div>
                 </div>

                 <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
                    <button className="py-4 bg-indigo-950 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg active:scale-95 transition-all">Ver Evolución</button>
                    <button className="py-4 bg-white text-indigo-950 border-2 border-indigo-950 rounded-2xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all">Exportar ID</button>
                 </div>
               </div>
            </div>
          </div>
        )}

        {vista === 'Staff' && (
          <div className="space-y-4">
            {staff.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${s.isClockedIn ? 'bg-emerald-500 shadow-lg shadow-emerald-200 animate-pulse' : 'bg-slate-300'}`}></div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm uppercase">{s.nombre}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{s.rol}</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    const ns = !s.isClockedIn;
                    await db.staff.update(s.id!, { isClockedIn: ns });
                    await loadData();
                  }} 
                  className={`px-6 py-3 rounded-full font-black uppercase text-[9px] tracking-widest transition-all active:scale-90 ${s.isClockedIn ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}
                >
                  {s.isClockedIn ? 'Salida' : 'Entrada'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL NUEVO ALUMNO */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-6 animate-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-500">
              <i className="fas fa-times text-xl"></i>
            </button>
            
            <h3 className="text-xl font-black uppercase italic mb-8 flex items-center gap-3">
              <i className="fas fa-user-plus text-indigo-600"></i> Nuevo Atleta
            </h3>
            
            <form onSubmit={handleAddAlumno} className="space-y-5">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Nombre Completo</label>
                <input 
                  type="text" 
                  placeholder="Ej. Juan Pérez" 
                  required 
                  value={newAlumno.nombre} 
                  onChange={e => setNewAlumno({...newAlumno, nombre: e.target.value})}
                  className="w-full bg-slate-50 p-5 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none border border-slate-100 focus:border-indigo-300 focus:bg-white transition-all" 
                />
              </div>
              
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">DNI / Documento</label>
                <input 
                  type="text" 
                  placeholder="Nro de Identificación" 
                  required 
                  value={newAlumno.dni} 
                  onChange={e => setNewAlumno({...newAlumno, dni: e.target.value})}
                  className="w-full bg-slate-50 p-5 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none border border-slate-100 focus:border-indigo-300 focus:bg-white transition-all" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Disciplina</label>
                  <select 
                    value={newAlumno.disciplina} 
                    onChange={e => setNewAlumno({...newAlumno, disciplina: e.target.value as Discipline})}
                    className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase outline-none border border-slate-100 appearance-none bg-[url('https://cdn0.iconfinder.com/data/icons/lucide-vol-2/24/chevron-down-512.png')] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat"
                  >
                    {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Nivel</label>
                  <select 
                    value={newAlumno.nivel} 
                    onChange={e => setNewAlumno({...newAlumno, nivel: e.target.value})}
                    className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase outline-none border border-slate-100 appearance-none bg-[url('https://cdn0.iconfinder.com/data/icons/lucide-vol-2/24/chevron-down-512.png')] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat"
                  >
                    {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-4 mt-10">
                <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all hover:bg-indigo-700">Registrar Atleta</button>
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
