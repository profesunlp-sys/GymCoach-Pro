import React, { useState, useEffect, useMemo } from 'react';

// --- TIPOS ---
type ViewMode = 'Registro' | 'Students' | 'Classes' | 'Profile';

interface Student {
  name: string;
  dni: string;
  level: string;
  squad: string;
  status: 'Active' | 'Inactive';
  type: 'Competitive' | 'Junior' | 'Elite';
  birthDate: string; // Formato YYYY-MM-DD
}

// --- UTILIDADES DE CÁLCULO ---
const getStudentAges = (birthDate: string) => {
  if (!birthDate) return { current: 0, dec31: 0, category: 'N/A' };
  
  const birth = new Date(birthDate);
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // Edad Actual Exacta
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  // Edad Federativa (Al 31 de Diciembre del año en curso)
  const dec31Age = currentYear - birth.getFullYear();

  // Categorías Federativas Estándar
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
      <svg width="110" height="110">
        <circle stroke="#f1f5f9" strokeWidth="10" fill="transparent" r={radius} cx="55" cy="55" />
        <circle
          className="progress-ring__circle"
          stroke="#3b82f6"
          strokeWidth="10"
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset: offset }}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx="55"
          cy="55"
        />
      </svg>
      <span className="absolute text-xl font-black text-slate-800">{percentage}%</span>
    </div>
  );
};

const StudentFormModal = ({ 
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
  const ages = useMemo(() => getStudentAges(formData.birthDate), [formData.birthDate]);

  const updateField = (field: keyof Student, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 card-shadow space-y-6 max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-black text-slate-800 uppercase italic">
            {isNew ? 'Nuevo Alumno' : 'Editar Alumno'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <div className="space-y-5">
          {/* Información Personal */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Nombre Completo</label>
              <input 
                value={formData.name} 
                onChange={e => updateField('name', e.target.value)}
                className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                placeholder="Ej. Mia Anderson"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">DNI / ID</label>
                <input 
                  value={formData.dni} 
                  onChange={e => updateField('dni', e.target.value)}
                  className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                  placeholder="ID Alumno"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Nivel</label>
                <input 
                  value={formData.level} 
                  onChange={e => updateField('level', e.target.value)}
                  className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                  placeholder="Nivel 4"
                />
              </div>
            </div>
          </div>

          {/* Cálculo de Edad y Categoría */}
          <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 space-y-4">
            <div>
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2 mb-1 block">Fecha de Nacimiento</label>
              <input 
                type="date" 
                value={formData.birthDate} 
                onChange={e => updateField('birthDate', e.target.value)}
                className="w-full px-6 py-3.5 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Edad Actual</p>
                <p className="text-2xl font-black text-slate-800">{ages.current} <span className="text-xs text-slate-300">años</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Al 31 de Dic</p>
                <p className="text-2xl font-black text-blue-600">{ages.dec31} <span className="text-xs text-blue-300">años</span></p>
              </div>
            </div>
            <div className="bg-indigo-600 p-4 rounded-2xl text-center shadow-lg shadow-indigo-100">
               <p className="text-[9px] font-black text-indigo-200 uppercase mb-1 tracking-[0.2em]">Categoría Sugerida</p>
               <p className="text-lg font-black text-white italic">{ages.category}</p>
            </div>
          </div>

          {/* Datos Deportivos */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Escuadrón / Grupo</label>
              <input 
                value={formData.squad} 
                onChange={e => updateField('squad', e.target.value)}
                className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                placeholder="Escuadrón Junior"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Estado</label>
                <select 
                  value={formData.status} 
                  onChange={e => updateField('status', e.target.value as any)}
                  className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
                >
                  <option value="Active">Activo</option>
                  <option value="Inactive">Inactivo</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Perfil</label>
                <select 
                  value={formData.type} 
                  onChange={e => updateField('type', e.target.value as any)}
                  className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
                >
                  <option value="Competitive">Competitivo</option>
                  <option value="Junior">Junior</option>
                  <option value="Elite">Elite</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
          <button 
            onClick={() => onSave(formData)} 
            disabled={!formData.name || !formData.dni || !formData.birthDate}
            className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 disabled:opacity-50 active:scale-95 transition-all"
          >
            {isNew ? 'Crear Alumno' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- APLICACIÓN PRINCIPAL ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('Students');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<{data: Student, isNew: boolean} | null>(null);
  
  // Estado inicial con persistencia
  const [masterList, setMasterList] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem('gymcoach_db_v16');
      return saved ? JSON.parse(saved) : [
        { name: 'Mia Anderson', dni: '88241', level: 'Level 4', squad: 'Junior Squad', status: 'Active', type: 'Competitive', birthDate: '2014-05-14' },
        { name: 'Ana García', dni: '88242', level: 'Level 5', squad: 'Senior Squad', status: 'Active', type: 'Elite', birthDate: '2012-03-22' }
      ];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => { 
    localStorage.setItem('gymcoach_db_v16', JSON.stringify(masterList)); 
  }, [masterList]);

  const handleSaveStudent = (updated: Student) => {
    if (editingStudent?.isNew) {
      setMasterList(prev => [...prev, updated]);
    } else {
      setMasterList(prev => prev.map(s => s.dni === editingStudent?.data.dni ? updated : s));
      // Si el alumno seleccionado es el que se editó, actualizar su vista
      if (selectedStudent?.dni === editingStudent?.data.dni) {
        setSelectedStudent(updated);
      }
    }
    setEditingStudent(null);
  };

  const agesForSelected = useMemo(() => selectedStudent ? getStudentAges(selectedStudent.birthDate) : null, [selectedStudent]);

  // VISTA DE DETALLE (STUDENT INSIGHTS)
  if (selectedStudent) {
    return (
      <div className="min-h-screen bg-white pb-32 animate-fadeIn">
        <div className="flex items-center justify-between p-6 sticky top-0 bg-white z-50">
          <button onClick={() => setSelectedStudent(null)} className="text-slate-400 text-2xl hover:text-slate-600 transition-colors">
            <i className="fas fa-chevron-left"></i>
          </button>
          <h2 className="text-lg font-bold text-slate-800">Student Insights</h2>
          <button onClick={() => setEditingStudent({data: selectedStudent, isNew: false})} className="text-blue-500 text-xl hover:bg-blue-50 p-2 rounded-full transition-colors">
            <i className="fas fa-pen"></i>
          </button>
        </div>

        <div className="px-6 space-y-6">
          {/* Perfil */}
          <div className="bg-white rounded-[3rem] border border-slate-100 p-8 flex flex-col items-center card-shadow">
            <div className="w-28 h-28 rounded-full border-4 border-blue-100 bg-slate-50 flex items-center justify-center text-4xl text-slate-300 font-black mb-4">
              {selectedStudent.name.charAt(0)}
            </div>
            <h3 className="text-2xl font-black text-slate-800">{selectedStudent.name}</h3>
            <p className="text-slate-400 font-medium text-sm mt-1">{selectedStudent.level} • ID: #{selectedStudent.dni}</p>
            <div className="bg-indigo-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase mt-5 shadow-md italic">
              {agesForSelected?.category}
            </div>
            <div className="flex gap-3 mt-4">
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${selectedStudent.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {selectedStudent.status}
              </span>
              <span className="bg-purple-50 text-purple-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase">
                {selectedStudent.type}
              </span>
            </div>
          </div>

          {/* Estadísticas Rápidas */}
          <div className="bg-white rounded-[3rem] border border-slate-100 p-8 card-shadow">
            <h4 className="font-bold text-slate-800 mb-6 flex justify-between items-center">
              Attendance Rate <span className="text-[10px] text-slate-300 font-medium">Last 30 Days</span>
            </h4>
            <div className="flex items-center gap-8">
              <AttendanceRing percentage={85} />
              <div className="flex-1 space-y-3">
                <div className="flex justify-between text-sm border-b border-slate-50 pb-2">
                  <span className="text-slate-400 font-medium">Asistidas</span>
                  <span className="font-black text-slate-800">17 Clases</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium">Ausencias</span>
                  <span className="font-black text-red-500">3 Clases</span>
                </div>
              </div>
            </div>
          </div>

          {/* Análisis IA Pedagógico */}
          <div className="bg-blue-50/50 rounded-[3rem] border border-blue-100 p-8 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm">
                <i className="fas fa-sparkles"></i>
              </div>
              <h4 className="text-blue-600 font-black text-[10px] uppercase tracking-widest">Pedagogical Insight</h4>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed italic">
              Con <b>{agesForSelected?.current} años</b>, {selectedStudent.name.split(' ')[0]} se sitúa en la categoría <b>{agesForSelected?.category.split(' ')[0]}</b>. Su desarrollo muscular indica que es el momento ideal para introducir elementos de rotación compleja en viga.
            </p>
          </div>
        </div>

        {/* Bottom Navigation Mockup */}
        <div className="fixed bottom-0 left-0 right-0 bg-white bottom-nav px-8 py-4 flex items-center justify-between z-[60] border-t border-slate-50">
          <button onClick={() => {setViewMode('Registro'); setSelectedStudent(null);}} className="text-slate-400 flex flex-col items-center gap-1 opacity-50"><i className="fas fa-home text-lg"></i><span className="text-[9px] font-black uppercase">Home</span></button>
          <button onClick={() => {setViewMode('Students'); setSelectedStudent(null);}} className="text-blue-500 flex flex-col items-center gap-1"><i className="fas fa-users text-lg"></i><span className="text-[9px] font-black uppercase">Alumnos</span></button>
          <div className="relative -top-8"><button className="w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center text-xl active:scale-95 transition-all"><i className="fas fa-plus"></i></button></div>
          <button className="text-slate-400 flex flex-col items-center gap-1 opacity-50"><i className="fas fa-calendar-alt text-lg"></i><span className="text-[9px] font-black uppercase">Clases</span></button>
          <button className="text-slate-400 flex flex-col items-center gap-1 opacity-50"><i className="fas fa-user text-lg"></i><span className="text-[9px] font-black uppercase">Perfil</span></button>
        </div>
      </div>
    );
  }

  // VISTA DE DIRECTORIO (ALUMNOS)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 pb-36 animate-fadeIn">
      {editingStudent && (
        <StudentFormModal 
          student={editingStudent.data} 
          isNew={editingStudent.isNew} 
          onClose={() => setEditingStudent(null)} 
          onSave={handleSaveStudent} 
        />
      )}

      <header className="py-8 text-center w-full max-w-md">
        <h1 className="text-4xl font-black italic text-indigo-900 uppercase tracking-tighter">GymCoach Pro</h1>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em] mt-2">Elite Pedagogy Platform</p>
      </header>

      <main className="w-full max-w-md space-y-6">
        <div className="flex bg-white rounded-3xl p-1 shadow-sm border border-slate-100 mb-8">
          <button onClick={() => setViewMode('Registro')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black transition-all ${viewMode === 'Registro' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>REGISTRO</button>
          <button onClick={() => setViewMode('Students')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black transition-all ${viewMode === 'Students' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>ALUMNOS</button>
        </div>

        {viewMode === 'Students' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
              <h3 className="font-black text-xl italic uppercase text-slate-800 tracking-tight">Directorio Maestro</h3>
              <p className="text-[9px] font-black text-slate-300 uppercase italic">Doble clic para editar</p>
            </div>
            
            {masterList.length === 0 ? (
              <div className="bg-white p-12 rounded-[2.5rem] text-center border-2 border-dashed border-slate-100 opacity-50">
                <i className="fas fa-user-plus text-4xl text-slate-200 mb-4 block"></i>
                <p className="text-slate-400 font-bold text-sm">No hay alumnos registrados</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {masterList.map(s => (
                  <div 
                    key={s.dni} 
                    onClick={() => setSelectedStudent(s)} 
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingStudent({data: s, isNew: false}); }} 
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-blue-500 transition-all hover:translate-x-1"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center font-black text-indigo-900 border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-black text-lg text-slate-800 leading-none">{s.name}</h4>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{getStudentAges(s.birthDate).category.split(' ')[0]}</span>
                          <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.dni}</span>
                        </div>
                      </div>
                    </div>
                    <i className="fas fa-chevron-right text-slate-200 group-hover:text-indigo-600 transition-colors"></i>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'Registro' && (
          <div className="bg-white p-12 rounded-[3.5rem] text-center border border-slate-100 card-shadow animate-fadeIn">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
              <i className="fas fa-clipboard-check"></i>
            </div>
            <h3 className="font-black text-xl text-slate-800 uppercase italic">Control Secuencial</h3>
            <p className="text-slate-400 text-sm mt-4 font-medium px-4 leading-relaxed">Inicia el flujo pedagógico para registrar asistencia y habilidades del día.</p>
            <button className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-full font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-100 active:scale-95 transition-all">
              Nueva Sesión
            </button>
          </div>
        )}
      </main>

      {/* Navegación Inferior Global */}
      <div className="fixed bottom-0 left-0 right-0 bg-white px-8 py-5 flex items-center justify-between z-[60] border-t border-slate-50 bottom-nav">
          <button onClick={() => setViewMode('Registro')} className={`${viewMode === 'Registro' ? 'text-indigo-600' : 'text-slate-300'} flex flex-col items-center gap-1 transition-colors`}>
            <i className="fas fa-home text-xl"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button onClick={() => setViewMode('Students')} className={`${viewMode === 'Students' ? 'text-indigo-600' : 'text-slate-300'} flex flex-col items-center gap-1 transition-colors`}>
            <i className="fas fa-users text-xl"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">Alumnos</span>
          </button>
          <div className="relative -top-10">
            <button 
              onClick={() => setEditingStudent({
                isNew: true, 
                data: {name: '', dni: '', level: 'Nivel 1', squad: 'General', status: 'Active', type: 'Junior', birthDate: '2015-01-01'}
              })} 
              className="w-16 h-16 bg-blue-500 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl hover:scale-110 active:scale-90 transition-all border-4 border-white"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
          <button className="text-slate-300 flex flex-col items-center gap-1 hover:text-indigo-400 transition-colors">
            <i className="fas fa-calendar-alt text-xl"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">Clases</span>
          </button>
          <button className="text-slate-300 flex flex-col items-center gap-1 hover:text-indigo-400 transition-colors">
            <i className="fas fa-user text-xl"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">Perfil</span>
          </button>
      </div>

      <footer className="mt-12 py-10 opacity-20">
        <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-400">GymCoach Elite • Visual Sync v15.2</p>
      </footer>
    </div>
  );
};

export default App;