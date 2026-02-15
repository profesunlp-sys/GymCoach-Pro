
import React, { useState, useEffect, useMemo } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, StaffMember, Biometrics, Discipline, PaymentStatus } from './types.ts';
import { DISCIPLINAS, NIVELES } from './constants.tsx';

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

  const [newAlumno, setNewAlumno] = useState({
    nombre: '',
    dni: '',
    disciplina: 'GAF' as Discipline,
    nivel: 'Iniciación',
    estadoPago: 'Al día' as PaymentStatus
  });

  const loadData = async () => {
    try {
      const a = await db.alumnos.toArray();
      const s = await db.staff.toArray();
      setAlumnos(a);
      setStaff(s);
      
      if (a.length === 0) {
        await db.alumnos.add({
          nombre: 'Valentina Silva', dni: '12345678', disciplina: 'GAF', nivel: 'Elite',
          fechaIngreso: new Date().toISOString(), estadoPago: 'Al día', asistenciasHistoricas: 156,
          qrCode: 'VAL_123', alertas: [], habilidades: [],
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
      <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-3xl">
        <svg width={size} height={size} className="overflow-visible">
          {[0.5, 1].map((level, idx) => (
            <polygon key={idx} points={Array(5).fill(0).map((_, i) => {
              const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
              return `${center + radius * level * Math.cos(angle)},${center + radius * level * Math.sin(angle)}`;
            }).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="1" />
          ))}
          <polygon points={points} fill="rgba(79, 70, 229, 0.2)" stroke="#6366f1" strokeWidth="2" />
          {labels.map((label, i) => {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            return <text key={i} x={center + (radius + 20) * Math.cos(angle)} y={center + (radius + 20) * Math.sin(angle)} fontSize="8" fontWeight="800" textAnchor="middle" fill="#94a3b8" className="uppercase">{label}</text>;
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
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.5em] mb-12">Performance Suite 2025</p>
          <button onClick={() => setIsLoggedIn(true)} className="w-full py-5 bg-indigo-600 text-white rounded-full font-extrabold uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Sincronizar Terminal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-36 font-sans">
      <header className="pt-14 px-8 pb-8 bg-white/80 backdrop-blur-xl rounded-b-[3rem] shadow-sm flex justify-between items-end border-b border-slate-100 sticky top-0 z-40">
        <div>
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mb-1">Elite System</p>
          <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">{vista}</h2>
        </div>
        <button className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><i className="fas fa-bell text-sm"></i></button>
      </header>

      <main className="px-6 py-8 page-transition">
        {vista === 'Hub' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <h3 className="text-xl font-bold italic uppercase mb-1">Estado Hoy</h3>
                <div className="flex gap-4 mt-6">
                  <div className="bg-white/5 p-4 rounded-2xl flex-1">
                    <p className="text-2xl font-black italic">{alumnos.length}</p>
                    <p className="text-[7px] font-bold text-slate-500 uppercase">Atletas</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl flex-1">
                    <p className="text-2xl font-black italic text-indigo-400">92%</p>
                    <p className="text-[7px] font-bold text-slate-500 uppercase">Salud</p>
                  </div>
                </div>
            </div>
            <button onClick={() => setVista('Alumnos')} className="w-full py-6 bg-white border border-slate-100 rounded-3xl flex items-center justify-between px-8 text-indigo-600 font-black uppercase text-xs tracking-widest">
                Gestión de Alumnos <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        )}

        {vista === 'Alumnos' && !selectedAlumno && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm flex items-center px-6 border border-slate-100">
                <i className="fas fa-search text-slate-300 mr-4"></i>
                <input type="text" placeholder="BUSCAR..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent py-2 text-[10px] font-bold text-slate-800 outline-none uppercase tracking-widest" />
              </div>
              <button onClick={() => setShowAddModal(true)} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <i className="fas fa-plus"></i>
              </button>
            </div>
            <div className="space-y-3">
              {filteredAlumnos.map(a => (
                <div key={a.id} onClick={() => setSelectedAlumno(a)} 
                  className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl italic ${a.estadoPago === 'Al día' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>{a.nombre.charAt(0)}</div>
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
          <div className="space-y-6">
            <button onClick={() => setSelectedAlumno(null)} className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-2">
              <i className="fas fa-arrow-left"></i> Volver
            </button>
            <div className="bg-white p-8 rounded-[3rem] shadow-xl text-center">
               <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-3xl font-black italic shadow-2xl">{selectedAlumno.nombre.charAt(0)}</div>
               <h3 className="text-2xl font-black text-slate-900 uppercase">{selectedAlumno.nombre}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase mb-8">DNI: {selectedAlumno.dni}</p>
               <RadarChart data={selectedAlumno.biometria} />
               <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase">Asistencias</p>
                    <p className="text-xl font-black text-slate-800">{selectedAlumno.asistenciasHistoricas}</p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${selectedAlumno.estadoPago === 'Al día' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                    <p className="text-[7px] font-black uppercase opacity-60">Pago</p>
                    <p className="text-[10px] font-black uppercase">{selectedAlumno.estadoPago}</p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {vista === 'Staff' && (
          <div className="space-y-4">
            {staff.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${s.isClockedIn ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm uppercase">{s.nombre}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{s.rol}</p>
                  </div>
                </div>
                <button onClick={async () => {
                  const ns = !s.isClockedIn;
                  await db.staff.update(s.id!, { isClockedIn: ns });
                  loadData();
                }} className={`px-6 py-3 rounded-full font-black uppercase text-[9px] ${s.isClockedIn ? 'bg-rose-50 text-rose-600' : 'bg-indigo-600 text-white'}`}>
                  {s.isClockedIn ? 'Check-Out' : 'Check-In'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL NUEVO ALUMNO */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-6 animate-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-xl font-black uppercase italic mb-8">Nuevo Atleta</h3>
            <form onSubmit={handleAddAlumno} className="space-y-4">
              <input type="text" placeholder="NOMBRE COMPLETO" required value={newAlumno.nombre} onChange={e => setNewAlumno({...newAlumno, nombre: e.target.value})}
                className="w-full bg-slate-50 p-5 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none border border-slate-100" />
              <input type="text" placeholder="DNI / DOCUMENTO" required value={newAlumno.dni} onChange={e => setNewAlumno({...newAlumno, dni: e.target.value})}
                className="w-full bg-slate-50 p-5 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none border border-slate-100" />
              <div className="flex gap-2">
                <select value={newAlumno.disciplina} onChange={e => setNewAlumno({...newAlumno, disciplina: e.target.value as Discipline})}
                  className="flex-1 bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase border border-slate-100">
                  {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={newAlumno.nivel} onChange={e => setNewAlumno({...newAlumno, nivel: e.target.value})}
                  className="flex-1 bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase border border-slate-100">
                  {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-[9px] font-black uppercase text-slate-400">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase">Registrar</button>
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
