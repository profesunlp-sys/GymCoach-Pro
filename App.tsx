import React, { useState, useEffect, useMemo } from 'react';
import Dexie, { type EntityTable } from 'dexie';
import { Alumno, Clase, ViewMode, StaffMember, Biometrics, Discipline, PaymentStatus, Skill, Apparatus } from './types.ts';
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

  // Calendar State
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Detalle de asistencias con contenido
  const [asistenciasDetalladas, setAsistenciasDetalladas] = useState<Clase[]>([]);
  const [asistenciaAnual, setAsistenciaAnual] = useState<number[]>(new Array(12).fill(0));

  const [newAlumno, setNewAlumno] = useState({
    nombre: '',
    dni: '',
    fechaNacimiento: '',
    disciplina: 'GAF' as Discipline,
    nivel: 'Iniciación',
    estadoPago: 'Al día' as PaymentStatus
  });

  const loadData = async () => {
    try {
      const a = await db.alumnos.toArray();
      const s = await db.staff.toArray();
      const c = await db.clases.toArray();
      setAlumnos(a);
      setStaff(s);
      setClases(c);
      
      if (a.length === 0) {
        const initialSkills: Skill[] = [
          { id: '1', name: 'Rol adelante', status: 'Dominado', apparatus: 'Suelo', level: 1 },
          { id: '2', name: 'Vertical', status: 'En Proceso', apparatus: 'Suelo', level: 1 },
          { id: '3', name: 'Rueda', status: 'Dominado', apparatus: 'Suelo', level: 2 },
          { id: '4', name: 'Salto Gato', status: 'No Iniciado', apparatus: 'Viga', level: 1 },
        ];

        await db.alumnos.add({
          nombre: 'Valentina Silva', dni: '12345678', disciplina: 'GAF', nivel: 'Promocional',
          fechaNacimiento: '2012-05-15', fechaIngreso: new Date('2024-01-15').toISOString(), 
          estadoPago: 'Al día', asistenciasHistoricas: 156,
          qrCode: 'VAL_123', alertas: [], habilidades: initialSkills,
          biometria: { fuerza: 85, flexibilidad: 92, tecnica: 78, resistencia: 70, coordinacion: 88 }
        });
        setAlumnos(await db.alumnos.toArray());
      }
      if (s.length === 0) {
        await db.staff.add({ id: 1, nombre: 'Marcos Ortega', rol: 'Head Coach', isClockedIn: false });
        setStaff(await db.staff.toArray());
      }
      if (c.length === 0) {
        const today = new Date();
        const mockClases: Clase[] = [
          { 
            fecha: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(), 
            grupo: 'Avanzados GAF', horario: '17:00 - 19:00', entrenador: 'Marcos Ortega',
            warmup: ['Articulaciones', 'Saltos'], apparatusUsed: ['Suelo', 'Viga'], skillsCovered: ['Flic-Flac', 'Salto Gato']
          },
          { 
            fecha: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString(), 
            grupo: 'Escuela GAM', horario: '16:00 - 18:00', entrenador: 'Sofia Lopez',
            warmup: ['Core', 'Estiramiento'], apparatusUsed: ['Salto', 'Suelo'], skillsCovered: ['Mortero', 'Vertical']
          },
          { 
            fecha: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString(), 
            grupo: 'Iniciación', horario: '15:00 - 16:30', entrenador: 'Marcos Ortega',
            warmup: ['Juegos', 'Flexibilidad'], apparatusUsed: ['Suelo'], skillsCovered: ['Rol adelante']
          }
        ];
        for (const cl of mockClases) {
          await db.clases.add(cl);
        }
        setClases(await db.clases.toArray());
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
      const now = new Date();
      const mockDetalle: Clase[] = [
        { 
          fecha: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(), 
          grupo: selectedAlumno.nivel,
          entrenador: 'Marcos Ortega', warmup: ['Trote', 'Brazos'], apparatusUsed: ['Viga', 'Suelo'], skillsCovered: ['Caminata Relevé', 'Rueda']
        },
        { 
          fecha: new Date(now.getFullYear(), now.getMonth(), 12).toISOString(), 
          grupo: selectedAlumno.nivel,
          entrenador: 'Marcos Ortega', warmup: ['Core', 'Muñecas'], apparatusUsed: ['Paralelas'], skillsCovered: ['Suspensión', 'Dominada']
        },
        { 
          fecha: new Date(now.getFullYear(), now.getMonth(), 19).toISOString(), 
          grupo: selectedAlumno.nivel,
          entrenador: 'Sofia Lopez', warmup: ['Estiramiento activo'], apparatusUsed: ['Suelo'], skillsCovered: ['Vertical', 'Pasaje']
        }
      ];
      setAsistenciasDetalladas(mockDetalle);
      const mockAnual = [12, 14, 10, 8, 15, 11, 4, 0, 0, 0, 0, 0];
      setAsistenciaAnual(mockAnual);
    }
  }, [selectedAlumno]);

  const filteredAlumnos = useMemo(() => {
    return alumnos.filter(a => 
      a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.dni.includes(searchQuery)
    );
  }, [alumnos, searchQuery]);

  const handleAddAlumno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlumno.nombre || !newAlumno.dni || !newAlumno.fechaNacimiento) return;

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
    setNewAlumno({ nombre: '', dni: '', fechaNacimiento: '', disciplina: 'GAF', nivel: 'Iniciación', estadoPago: 'Al día' });
  };

  // --- CALENDAR LOGIC ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDay; i > 0; i--) days.push({ day: prevMonthLastDay - i + 1, currentMonth: false, date: new Date(year, month - 1, prevMonthLastDay - i + 1) });
    for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
    return days;
  };

  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && 
    d1.getMonth() === d2.getMonth() && 
    d1.getDate() === d2.getDate();

  const CalendarView = () => {
    const calendarDays = getDaysInMonth(currentMonth);
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const classesForSelectedDay = clases.filter(c => isSameDay(new Date(c.fecha), selectedCalendarDate));

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Card del Calendario */}
        <div className="bg-white rounded-[2.5rem] shadow-xl p-6 border border-slate-100">
          <div className="flex justify-between items-center mb-6 px-2">
            <h3 className="text-sm font-black uppercase italic text-slate-900 tracking-tighter">
              {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} 
                className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} 
                className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-4">
            {dayNames.map(name => <div key={name} className="text-center text-[8px] font-black text-slate-400 uppercase tracking-widest py-2">{name}</div>)}
            {calendarDays.map((d, i) => {
              const hasClasses = clases.some(c => isSameDay(new Date(c.fecha), d.date));
              const isSelected = isSameDay(d.date, selectedCalendarDate);
              const isToday = isSameDay(d.date, new Date());
              return (
                <button 
                  key={i} 
                  onClick={() => setSelectedCalendarDate(d.date)} 
                  className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all ${!d.currentMonth ? 'opacity-20' : 'opacity-100'} ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-transparent text-slate-700'} ${!isSelected && isToday ? 'border-2 border-indigo-100' : ''}`}
                >
                  <span className={`text-[10px] font-bold ${isSelected ? 'font-black' : ''}`}>{d.day}</span>
                  {hasClasses && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 bg-indigo-500 rounded-full"></div>}
                  {hasClasses && isSelected && <div className="absolute bottom-1.5 w-1 h-1 bg-white rounded-full"></div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Agenda del día seleccionado */}
        <div className="space-y-4">
          <div className="flex justify-between items-end px-2">
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Agenda del día</p>
              <h4 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">
                {selectedCalendarDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
              </h4>
            </div>
            <button className="px-4 py-2 bg-slate-900 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-xl">
              <i className="fas fa-plus mr-1"></i> Agendar Clase
            </button>
          </div>

          <div className="space-y-3">
            {classesForSelectedDay.map((c, idx) => (
              <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center gap-4 shadow-sm hover:border-indigo-100 transition-all cursor-pointer">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex flex-col items-center justify-center">
                  <i className="fas fa-clock text-xs mb-1"></i>
                  <span className="text-[7px] font-black text-center leading-none">{c.horario?.split(' - ')[0]}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{c.grupo}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                    <i className="fas fa-user-tie mr-1 text-indigo-300"></i> {c.entrenador || 'Coach Principal'}
                  </p>
                </div>
                <i className="fas fa-chevron-right text-slate-200 text-xs"></i>
              </div>
            ))}
            {classesForSelectedDay.length === 0 && (
              <div className="py-12 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                <i className="fas fa-mug-hot text-slate-200 text-3xl mb-3"></i>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sin actividades programadas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- COMPONENTES DE VISUALIZACIÓN ---

  const AttendanceBarChart = ({ data }: { data: number[] }) => {
    const maxVal = Math.max(...data, 1);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    return (
      <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Asistencia Mensual {new Date().getFullYear()}</h4>
        <div className="flex items-end justify-between h-32 gap-1.5 px-2">
          {data.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div 
                className={`w-full rounded-t-lg transition-all duration-700 ${i === new Date().getMonth() ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-indigo-200'}`}
                style={{ height: `${(val / maxVal) * 100}%`, minHeight: val > 0 ? '4px' : '0' }}
              ></div>
              <span className="text-[7px] font-bold text-slate-400 uppercase">{months[i]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const DetailedAttendanceList = ({ clases }: { clases: Clase[] }) => {
    return (
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <i className="fas fa-list-check text-indigo-500"></i> Bitácora de Entrenamiento
        </h4>
        <div className="space-y-4">
          {clases.map((cl, idx) => (
            <div key={idx} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black text-indigo-500 uppercase">{new Date(cl.fecha).toLocaleDateString('es-ES', { weekday: 'long' })}</p>
                  <p className="text-xl font-black italic text-slate-900 uppercase">{new Date(cl.fecha).getDate()} {new Date(cl.fecha).toLocaleDateString('es-ES', { month: 'short' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Coach</p>
                  <p className="text-[10px] font-black text-slate-700 uppercase">{cl.entrenador}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-50">
                <div className="flex flex-wrap gap-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase w-full mb-1">Entrada en calor</span>
                  {cl.warmup?.map((w, i) => (
                    <span key={i} className="px-3 py-1 bg-slate-100 text-slate-500 text-[8px] font-bold uppercase rounded-full">{w}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase w-full mb-1">Aparatos</span>
                  {cl.apparatusUsed?.map((a, i) => (
                    <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-500 text-[8px] font-black uppercase rounded-full">{a}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase w-full mb-1">Habilidades trabajadas</span>
                  {cl.skillsCovered?.map((s, i) => (
                    <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded-full border border-emerald-100">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const RadarChart = ({ data, size = 180 }: { data: Biometrics, size?: number }) => {
    const center = size / 2;
    const radius = size * 0.35;
    const labels = ['Fuerza', 'Flex', 'Téc', 'Res', 'Coor'];
    const values = [data.fuerza, data.flexibilidad, data.tecnica, data.resistencia, data.coordinacion];
    const points = values.map((v, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return `${center + radius * (v / 100) * Math.cos(angle)},${center + radius * (v / 100) * Math.sin(angle)}`;
    }).join(' ');
    
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
        <svg width={size} height={size} className="overflow-visible">
          {[0.25, 0.5, 0.75, 1].map((level, idx) => (
            <polygon key={idx} points={Array(5).fill(0).map((_, i) => {
              const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
              return `${center + radius * level * Math.cos(angle)},${center + radius * level * Math.sin(angle)}`;
            }).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray={idx === 3 ? "0" : "2"} />
          ))}
          <polygon points={points} fill="rgba(79, 70, 229, 0.15)" stroke="#6366f1" strokeWidth="2.5" />
          {labels.map((label, i) => {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const x = center + (radius + 28) * Math.cos(angle);
            const y = center + (radius + 28) * Math.sin(angle);
            return (
              <text key={i} x={x} y={y} fontSize="9" fontWeight="800" textAnchor="middle" fill="#64748b" className="uppercase tracking-tighter">{label}</text>
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
          <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">
            {vista === 'Calendario' ? 'Agenda' : vista}
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
                    <div className="bg-white/5 p-4 rounded-2xl flex-1 border border-white/10">
                      <p className="text-2xl font-black italic text-indigo-400">92%</p>
                      <p className="text-[7px] font-bold text-slate-500 uppercase">Salud</p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <i className="fas fa-chart-line text-8xl -rotate-12"></i>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setVista('Alumnos')} className="aspect-square bg-white border border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-sm active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <i className="fas fa-users text-xl"></i>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Alumnos</span>
              </button>
              <button onClick={() => setVista('Calendario')} className="aspect-square bg-white border border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-sm active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <i className="fas fa-calendar-day text-xl"></i>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Agenda</span>
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
          <div className="space-y-6 page-transition pb-10">
            <button onClick={() => setSelectedAlumno(null)} className="text-[9px] font-extrabold text-indigo-600 uppercase flex items-center gap-2 mb-2 bg-indigo-50 px-4 py-2 rounded-full w-fit">
              <i className="fas fa-arrow-left"></i> Volver a la lista
            </button>
            
            <div className="bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-slate-100">
              <div className="bg-slate-900 p-8 text-center relative">
                 <div className="w-24 h-24 bg-white/10 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 text-4xl font-black italic backdrop-blur-xl border border-white/20 shadow-2xl">{selectedAlumno.nombre.charAt(0)}</div>
                 <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">{selectedAlumno.nombre}</h3>
                 <div className="flex justify-center gap-2 mt-4">
                    <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[8px] font-black uppercase rounded-full border border-indigo-500/30">{selectedAlumno.disciplina}</span>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[8px] font-black uppercase rounded-full border border-emerald-500/30">{selectedAlumno.nivel}</span>
                 </div>
              </div>

              <div className="p-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Información de Edad</p>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-[9px] font-bold text-slate-500">NACIMIENTO</span>
                        <span className="text-[10px] font-black text-slate-900 uppercase">{selectedAlumno.fechaNacimiento || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[9px] font-bold text-slate-500">EDAD ACTUAL</span>
                        <span className="text-[10px] font-black text-indigo-600 italic">{calculateAges(selectedAlumno.fechaNacimiento).current} AÑOS</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[9px] font-bold text-slate-500">EDAD AL 31 DIC</span>
                        <span className="text-[10px] font-black text-indigo-600 italic">{calculateAges(selectedAlumno.fechaNacimiento).dec31} AÑOS</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-800 uppercase">CATEGORÍA FIG</span>
                        <span className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full">{calculateAges(selectedAlumno.fechaNacimiento).category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex flex-col justify-center gap-4 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">DNI / ID</p>
                        <p className="text-xs font-bold text-slate-700 mb-2">{selectedAlumno.dni}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Ingreso</p>
                        <p className="text-xs font-bold text-slate-700">{new Date(selectedAlumno.fechaIngreso).toLocaleDateString()}</p>
                  </div>
                </div>

                <AttendanceBarChart data={asistenciaAnual} />

                <div>
                   <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2"><i className="fas fa-chart-pie text-indigo-500"></i> Perfil Biométrico</h4>
                   <RadarChart data={selectedAlumno.biometria} />
                </div>

                <DetailedAttendanceList clases={asistenciasDetalladas} />
              </div>
            </div>
          </div>
        )}

        {vista === 'Calendario' && <CalendarView />}

        {vista === 'Staff' && (
          <div className="space-y-4">
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-lg mb-6">
               <h3 className="text-xl font-bold italic uppercase">Control de Staff</h3>
               <p className="text-[9px] opacity-70 uppercase tracking-widest mt-1">Registro de actividad y presencia</p>
            </div>
            {staff.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${s.isClockedIn ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <div><p className="font-bold text-slate-900 text-sm uppercase">{s.nombre}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{s.rol}</p></div>
                </div>
                <button onClick={async () => {
                  const ns = !s.isClockedIn;
                  await db.staff.update(s.id!, { isClockedIn: ns });
                  loadData();
                }} className={`px-6 py-3 rounded-full font-black uppercase text-[9px] tracking-widest transition-all ${s.isClockedIn ? 'bg-rose-50 text-rose-600 shadow-inner' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}>{s.isClockedIn ? 'Check-Out' : 'Check-In'}</button>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-white/20 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-black uppercase italic mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fas fa-user-plus text-sm"></i></div>
              Nuevo Atleta
            </h3>
            <form onSubmit={handleAddAlumno} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-4">Nombre y Apellido</label>
                <input type="text" placeholder="EJ: JUAN PEREZ" required value={newAlumno.nombre} onChange={e => setNewAlumno({...newAlumno, nombre: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none border border-slate-100 focus:border-indigo-300 transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-4">DNI / Documento</label>
                <input type="text" placeholder="SIN PUNTOS NI ESPACIOS" required value={newAlumno.dni} onChange={e => setNewAlumno({...newAlumno, dni: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none border border-slate-100 focus:border-indigo-300 transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-4">Fecha de Nacimiento</label>
                <input type="date" required value={newAlumno.fechaNacimiento} onChange={e => setNewAlumno({...newAlumno, fechaNacimiento: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase outline-none border border-slate-100 focus:border-indigo-300 transition-colors" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-4">Disciplina</label>
                  <select value={newAlumno.disciplina} onChange={e => setNewAlumno({...newAlumno, disciplina: e.target.value as Discipline})} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase border border-slate-100 outline-none">{DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}</select>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-4">Nivel</label>
                  <select value={newAlumno.nivel} onChange={e => setNewAlumno({...newAlumno, nivel: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-bold uppercase border border-slate-100 outline-none">{NIVELES.map(n => <option key={n} value={n}>{n}</option>)}</select>
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-[9px] font-black uppercase text-slate-400">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase shadow-lg shadow-indigo-100 active:scale-95 transition-all">Registrar</button>
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