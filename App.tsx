import React, { useState, useEffect, useMemo } from 'react';

// --- DEFINICIÓN DE TIPOS ---
type ViewMode = 'Registro' | 'Students' | 'Classes' | 'Profile';

interface Student {
  name: string;
  dni: string;
  level: string;
  squad: string;
  status: 'Active' | 'Inactive';
  type: 'Competitive' | 'Junior' | 'Elite';
  birthDate: string; // YYYY-MM-DD
}

// --- UTILIDADES ---
const getDetailedAge = (birthDate: string) => {
  if (!birthDate) return { current: 0, dec31: 0, category: 'N/A' };
  
  const birth = new Date(birthDate);
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // Edad hoy
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  // Edad al finalizar el año (Criterio competencia)
  const dec31Age = currentYear - birth.getFullYear();

  // Categorías de Gimnasia
  let category = 'Sin Categoría';
  if (dec31Age >= 3 && dec31Age <= 5) category = 'Baby (3-5)';
  else if (dec31Age >= 6 && dec31Age <= 9) category = 'Pre-Infantil (6-9)';
  else if (dec31Age >= 10 && dec31Age <= 12) category = 'Infantil (10-12)';
  else if (dec31Age >= 13 && dec31Age <= 15) category = 'Juvenil (13-15)';
  else if (dec31Age >= 16) category = 'Mayor (16+)';

  return { current: age, dec31: dec31Age, category };
};

// --- COMPONENTES UI ---

const AttendanceRing = ({ percentage }: { percentage: number }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" className="drop-shadow-sm">
        <circle stroke="#f1f5f9" strokeWidth="8" fill="transparent" r={radius} cx="50" cy="50" />
        <circle
          className="progress-ring__circle"
          stroke="#3b82f6"
          strokeWidth="8"
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset: offset }}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
        />
      </svg>
      <span className="absolute text-lg font-black text-slate-800">{percentage}%</span>
    </div>
  );
};

const StudentModal = ({ 
  student, 
  onClose, 
  onSave,
  isNew = false
}: { 
  student: Student; 
  onClose: () => void; 
  onSave: (updated: Student) => void;
  isNew?: boolean;
}) => {
  const [formData, setFormData] = useState<Student>({ ...student });
  const ages = useMemo(() => getDetailedAge(formData.birthDate), [formData.birthDate]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 card-shadow space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">
            {isNew ? 'Nuevo Alumno' : 'Ficha del Alumno'}
          </h3>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-red-500 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Nombre y DNI */}
          <div className="grid gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Nombre Completo</label>
              <input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" 
                placeholder="Nombre del atleta"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">DNI / ID</label>
                <input 
                  value={formData.dni} 
                  onChange={e => setFormData({...formData, dni: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Nivel</label>
                <input 
                  value={formData.level} 
                  onChange={e => setFormData({...formData, level: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" 
                />
              </div>
            </div>
          </div>

          {/* Fecha y Categoría */}
          <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
            <div>
              <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-2 mb-1 block">Fecha de Nacimiento</label>
              <input 
                type="date" 
                value={formData.birthDate} 
                onChange={e => setFormData({...formData, birthDate: e.target.value})}
                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-blue-50 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Edad Hoy</p>
                <p className="text-2xl font-black text-slate-800">{ages.current}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-blue-50 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Edad 31/Dic</p>
                <p className="text-2xl font-black text-blue-600">{ages.dec31}</p>
              </div>
            </div>
            <div className="bg-indigo-600 p-4 rounded-2xl text-center shadow-lg shadow-indigo-100">
               <p className="text-[9px] font-black text-indigo-200 uppercase mb-1 tracking-widest">Categoría Automática</p>
               <p className="text-lg font-black text-white italic">{ages.category}</p>
            </div>
          </div>

          {/* Grupo y Perfil */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Estado</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({...formData, status: e.target.value as any})}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
              >
                <option value="Active">Activo</option>
                <option value="Inactive">Inactivo</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Perfil</label>
              <select 
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value as any})}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
              >
                <option value="Competitive">Competitivo</option>
                <option value="Junior">Junior</option>
                <option value="Elite">Elite</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase text-xs tracking-widest">Cancelar</button>
          <button 
            onClick={() => onSave(formData)} 
            disabled={!formData.name || !formData.dni || !formData.birthDate}
            className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {isNew ? 'Crear Atleta' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('Students');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<{data: Student, isNew: boolean} | null>(null);
  
  const [masterList, setMasterList] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem('gymcoach_v17_db');
      return saved ? JSON.parse(saved) : [
        { name: 'Mia Anderson', dni: '88241', level: 'Level 4', squad: 'Junior Squad', status: 'Active', type: 'Competitive', birthDate: '2014-05-14' },
        { name: 'Ana García', dni: '88242', level: 'Level 5', squad: 'Senior Squad', status: 'Active', type: 'Elite', birthDate: '2012-03-22' }
      ];
    } catch (e) { return []; }
  });

  useEffect(() => { 
    localStorage.setItem('gymcoach_v17_db', JSON.stringify(masterList)); 
  }, [masterList]);

  const handleSave = (updated: Student) => {
    if (editingStudent?.isNew) setMasterList(prev => [...prev, updated]);
    else setMasterList(prev => prev.map(s => s.dni === editingStudent?.data.dni ? updated : s));
    setEditingStudent(null);
    if (selectedStudent?.dni === updated.dni) setSelectedStudent(updated);
  };

  if (selectedStudent) {
    const studentAges = getDetailedAge(selectedStudent.birthDate);
    return (
      <div className="min-h-screen bg-white pb-32 animate-fadeIn">
        <div className="flex items-center justify-between p-6 bg-white sticky top-0 z-50">
          <button onClick={() => setSelectedStudent(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 text-xl"><i className="fas fa-chevron-left"></i></button>
          <h2 className="text-lg font-bold text-slate-800">Student Insights</h2>
          <button onClick={() => setEditingStudent({data: selectedStudent, isNew: false})} className="text-blue-500 text-xl w-10 h-10 flex items-center justify-center rounded-full bg-blue-50"><i className="fas fa-pen"></i></button>
        </div>

        <div className="px-6 space-y-6">
          <div className="bg-white rounded-[3rem] border border-slate-100 p-8 flex flex-col items-center card-shadow">
            <div className="w-24 h-24 rounded-full border-4 border-blue-50 bg-slate-50 flex items-center justify-center text-3xl text-indigo-900 font-black mb-4">
              {selectedStudent.name.charAt(0)}
            </div>
            <h3 className="text-2xl font-black text-slate-800">{selectedStudent.name}</h3>
            <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">{selectedStudent.level} • #{selectedStudent.dni}</p>
            <div className="bg-indigo-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase mt-5 shadow-md italic tracking-widest">
              {studentAges.category}
            </div>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 p-8 card-shadow">
            <h4 className="font-bold text-slate-800 mb-6 flex justify-between items-center text-sm uppercase tracking-tight">Asistencia Mensual</h4>
            <div className="flex items-center gap-8">
              <AttendanceRing percentage={85} />
              <div className="flex-1 space-y-3">
                <div className="flex justify-between text-sm border-b border-slate-50 pb-2"><span className="text-slate-400">Presente</span><span className="font-black text-slate-800">17 Clases</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Ausente</span><span className="font-black text-red-500">3 Clases</span></div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/50 rounded-[3rem] border border-blue-100 p-8 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm"><i className="fas fa-sparkles"></i></div>
              <h4 className="text-blue-600 font-black text-[10px] uppercase tracking-widest">Insight Pedagógico</h4>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed italic">
              Con <b>{studentAges.current} años</b>, {selectedStudent.name.split(' ')[0]} muestra un desarrollo físico acorde a la categoría <b>{studentAges.category.split(' ')[0]}</b>. Su enfoque este mes debe ser la verticalidad en paralelas.
            </p>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white bottom-nav px-10 py-5 flex items-center justify-between z-[60] border-t border-slate-50">
          <button onClick={() => {setSelectedStudent(null); setViewMode('Registro');}} className="text-slate-300 flex flex-col items-center gap-1"><i className="fas fa-home text-lg"></i><span className="text-[8px] font-black uppercase">Home</span></button>
          <button onClick={() => {setSelectedStudent(null); setViewMode('Students');}} className="text-blue-600 flex flex-col items-center gap-1"><i className="fas fa-users text-lg"></i><span className="text-[8px] font-black uppercase">Alumnos</span></button>
          <div className="relative -top-10"><button className="w-16 h-16 bg-blue-500 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl active:scale-90 transition-all border-4 border-white"><i className="fas fa-plus"></i></button></div>
          <button className="text-slate-300 flex flex-col items-center gap-1"><i className="fas fa-calendar-alt text-lg"></i><span className="text-[8px] font-black uppercase">Clases</span></button>
          <button className="text-slate-300 flex flex-col items-center gap-1"><i className="fas fa-user text-lg"></i><span className="text-[8px] font-black uppercase">Perfil</span></button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 pb-40">
      {editingStudent && <StudentModal student={editingStudent.data} isNew={editingStudent.isNew} onClose={() => setEditingStudent(null)} onSave={handleSave} />}

      <header className="py-10 text-center">
        <h1 className="text-4xl font-black italic text-indigo-900 uppercase tracking-tighter">GymCoach Pro</h1>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em] mt-2 italic">Elite Pedagogy Platform v17</p>
      </header>

      <main className="w-full max-w-md space-y-6">
        <div className="flex bg-white rounded-3xl p-1 shadow-sm border border-slate-100">
          <button onClick={() => setViewMode('Registro')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black transition-all ${viewMode === 'Registro' ? 'bg-indigo-900 text-white shadow-lg' : 'text-slate-400'}`}>REGISTRO</button>
          <button onClick={() => setViewMode('Students')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black transition-all ${viewMode === 'Students' ? 'bg-indigo-900 text-white shadow-lg' : 'text-slate-400'}`}>ALUMNOS</button>
        </div>

        {viewMode === 'Students' && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="font-black text-xl italic uppercase text-slate-800 px-4">Directorio Maestro</h3>
            <div className="grid gap-4">
              {masterList.map(s => (
                <div key={s.dni} onClick={() => setSelectedStudent(s)} onDoubleClick={(e) => { e.stopPropagation(); setEditingStudent({data: s, isNew: false}); }} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-blue-500 hover:translate-x-1 transition-all">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center font-black text-indigo-900 group-hover:bg-indigo-900 group-hover:text-white transition-colors">{s.name.charAt(0)}</div>
                    <div>
                      <h4 className="font-black text-lg text-slate-800 leading-none">{s.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">
                        {getDetailedAge(s.birthDate).category.split(' ')[0]} • #{s.dni}
                      </p>
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-slate-200 group-hover:text-indigo-900 transition-colors"></i>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'Registro' && (
          <div className="bg-white p-12 rounded-[3.5rem] text-center border border-slate-100 card-shadow animate-fadeIn">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6"><i className="fas fa-clipboard-list"></i></div>
            <h3 className="font-black text-xl text-slate-800 uppercase italic">Control de Sesión</h3>
            <p className="text-slate-400 text-sm mt-4 font-medium leading-relaxed">Inicia el flujo secuencial para registrar el progreso pedagógico de hoy.</p>
            <button className="w-full mt-10 py-5 bg-indigo-900 text-white rounded-full font-black uppercase text-xs shadow-xl shadow-indigo-100 active:scale-95 transition-all">Nueva Clase</button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md px-10 py-6 flex items-center justify-between z-[60] border-t border-slate-50 bottom-nav">
          <button onClick={() => setViewMode('Registro')} className={`${viewMode === 'Registro' ? 'text-indigo-900' : 'text-slate-300'} flex flex-col items-center gap-1 transition-colors`}><i className="fas fa-home text-xl"></i><span className="text-[8px] font-black uppercase tracking-widest">Home</span></button>
          <button onClick={() => setViewMode('Students')} className={`${viewMode === 'Students' ? 'text-indigo-900' : 'text-slate-300'} flex flex-col items-center gap-1 transition-colors`}><i className="fas fa-users text-xl"></i><span className="text-[8px] font-black uppercase tracking-widest">Alumnos</span></button>
          <div className="relative -top-12">
            <button 
              onClick={() => setEditingStudent({isNew: true, data: {name: '', dni: '', level: 'Nivel 1', squad: 'General', status: 'Active', type: 'Junior', birthDate: '2015-01-01'}})} 
              className="w-16 h-16 bg-blue-500 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl hover:scale-110 active:scale-90 transition-all border-4 border-white"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
          <button className="text-slate-300 flex flex-col items-center gap-1"><i className="fas fa-calendar-alt text-xl"></i><span className="text-[8px] font-black uppercase tracking-widest">Clases</span></button>
          <button className="text-slate-300 flex flex-col items-center gap-1"><i className="fas fa-user text-xl"></i><span className="text-[8px] font-black uppercase tracking-widest">Perfil</span></button>
      </nav>
    </div>
  );
};

export default App;