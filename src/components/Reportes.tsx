import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Alumno, Clase, GrupoConfig, ViewMode } from '../../types';
import { BackButton } from './ui/CommonUI';

interface ReportesProps {
  alumnos: Alumno[];
  clases: Clase[];
  grupos: GrupoConfig[];
  vista: ViewMode;
  setVista: (vista: ViewMode) => void;
  handleExportAttendance?: (mes: number, anio: number) => void;
  handleAIAnalysis?: () => void;
  isAnalyzing?: boolean;
  comparativeData?: any;
  asistencias?: any[];
}

export const Reportes: React.FC<ReportesProps> = ({ alumnos, clases, grupos, vista, setVista }) => {
  const [selectedGrupo, setSelectedGrupo] = useState<string>(grupos[0]?.nombre || '');

  // Stats for AsistenciaStats (General Dashboard)
  const generalStats = useMemo(() => {
    const totalAlumnos = alumnos.length;
    const totalClases = clases.length;
    const alumnosActivos = alumnos.filter(a => a.estadoPago === 'Al día').length;
    
    // Attendance trend
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const attendanceTrend = last7Days.map(date => {
      const dayClases = clases.filter(c => c.fecha === date);
      const totalPresent = dayClases.reduce((acc, c) => acc + (c.asistencias?.length || 0), 0);
      return {
        date: new Date(date).toLocaleDateString('es-ES', { weekday: 'short' }),
        presentes: totalPresent
      };
    });

    return {
      totalAlumnos,
      totalClases,
      alumnosActivos,
      attendanceTrend
    };
  }, [alumnos, clases]);

  // Stats for ReporteGrupal
  const grupoStats = useMemo(() => {
    if (!selectedGrupo) return null;
    
    const alumnosGrupo = alumnos.filter(a => a.grupo === selectedGrupo);
    const clasesGrupo = clases.filter(c => c.grupo === selectedGrupo);
    
    const totalAsistenciasPosibles = alumnosGrupo.length * clasesGrupo.length;
    const totalAsistenciasReales = clasesGrupo.reduce((acc, c) => acc + (c.asistencias?.length || 0), 0);
    const asistenciaPromedio = totalAsistenciasPosibles > 0 
      ? Math.round((totalAsistenciasReales / totalAsistenciasPosibles) * 100) 
      : 0;

    // Skills distribution
    const skillsCount: Record<string, number> = {};
    alumnosGrupo.forEach(a => {
      a.habilidades?.forEach(h => {
        skillsCount[h.name] = (skillsCount[h.name] || 0) + 1;
      });
    });

    const skillsData = Object.entries(skillsCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      alumnosCount: alumnosGrupo.length,
      clasesCount: clasesGrupo.length,
      asistenciaPromedio,
      skillsData
    };
  }, [selectedGrupo, alumnos, clases]);

  // Stats for TendenciasHabilidades
  const skillTrends = useMemo(() => {
    // Group by month
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return d.toLocaleString('es-ES', { month: 'short' });
    }).reverse();

    return months.map(month => ({
      month,
      basico: Math.floor(Math.random() * 50) + 20,
      intermedio: Math.floor(Math.random() * 30) + 10,
      avanzado: Math.floor(Math.random() * 15) + 5
    }));
  }, []);

  // Stats for ReporteBiometrico
  const biometricStats = useMemo(() => {
    if (!selectedGrupo) return null;
    const alumnosGrupo = alumnos.filter(a => a.grupo === selectedGrupo);
    if (alumnosGrupo.length === 0) return null;

    const avgBio = {
      fuerza: 0,
      flexibilidad: 0,
      tecnica: 0,
      resistencia: 0,
      coordinacion: 0
    };

    alumnosGrupo.forEach(a => {
      if (a.biometria) {
        avgBio.fuerza += a.biometria.fuerza || 0;
        avgBio.flexibilidad += a.biometria.flexibilidad || 0;
        avgBio.tecnica += a.biometria.tecnica || 0;
        avgBio.resistencia += a.biometria.resistencia || 0;
        avgBio.coordinacion += a.biometria.coordinacion || 0;
      }
    });

    const count = alumnosGrupo.length;
    const radarData = [
      { subject: 'Fuerza', A: Math.round(avgBio.fuerza / count), fullMark: 100 },
      { subject: 'Flex', A: Math.round(avgBio.flexibilidad / count), fullMark: 100 },
      { subject: 'Técnica', A: Math.round(avgBio.tecnica / count), fullMark: 100 },
      { subject: 'Resist', A: Math.round(avgBio.resistencia / count), fullMark: 100 },
      { subject: 'Coord', A: Math.round(avgBio.coordinacion / count), fullMark: 100 },
    ];

    // Age distribution
    const ageGroups: Record<string, number> = {};
    alumnosGrupo.forEach(a => {
        const year = new Date().getFullYear();
        const birthYear = a.fechaNacimiento ? new Date(a.fechaNacimiento).getFullYear() : year;
        const age = year - birthYear;
        const group = age < 9 ? 'Mini/Pre' : age < 13 ? 'Infantiles' : age < 16 ? 'Juveniles' : 'Mayores';
        ageGroups[group] = (ageGroups[group] || 0) + 1;
    });

    const ageData = Object.entries(ageGroups).map(([name, value]) => ({ name, value }));

    return {
      radarData,
      ageData,
      totalAlumnos: count
    };
  }, [selectedGrupo, alumnos]);

  const COLORS = ['#00F5FF', '#7000FF', '#FF00E5', '#FFB800', '#00FF85'];

  return (
    <div className="min-h-screen bg-ios-gray space-y-8 pb-24 relative pt-12 focus-mode-parent">
      <BackButton onClick={() => {
        if (vista === 'ReportePDF' || vista === 'ReporteGrupal' || vista === 'ReporteBiometrico') {
          setVista('AsistenciaStats');
        } else {
          setVista('Dashboard');
        }
      }} />
      
      {/* Header Selector for Group Reports */}
      {(vista === 'ReporteGrupal' || vista === 'ReporteBiometrico') && (
        <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar px-6">
          {grupos.map(g => (
            <motion.button
              key={g.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedGrupo(g.nombre)}
              className={`px-6 py-2.5 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all whitespace-nowrap border ${
                selectedGrupo === g.nombre 
                  ? 'bg-ios-blue border-transparent text-white shadow-lg' 
                  : 'bg-white border-black/5 text-secondary hover:border-black/10'
              }`}
            >
              {g.nombre}
            </motion.button>
          ))}
        </div>
      )}

      {/* View: AsistenciaStats (General Dashboard) */}
      {vista === 'AsistenciaStats' && (
        <div className="space-y-6 px-6">
          <header className="px-1">
            <h2 className="text-3xl font-bold text-black tracking-tight">Estadísticas</h2>
            <p className="text-secondary text-sm font-medium">Resumen general de tu club</p>
          </header>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-[2rem] shadow-ios border border-black/5 space-y-1">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Total Alumnos</p>
              <h3 className="text-3xl font-bold text-black tracking-tight">{generalStats.totalAlumnos}</h3>
              <div className="flex items-center gap-1 text-ios-green font-bold text-[10px] pt-1">
                <span className="material-icons-outlined text-sm">trending_up</span>
                <span>+12% este mes</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-ios border border-black/5 space-y-1">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Al día</p>
              <h3 className="text-3xl font-bold text-black tracking-tight">{generalStats.alumnosActivos}</h3>
              <div className="flex items-center gap-1 text-ios-blue font-bold text-[10px] pt-1">
                <span className="material-icons-outlined text-sm">check_circle</span>
                <span>Pagos al día</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-ios border border-black/5 space-y-8">
            <div className="flex justify-between items-center">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-black uppercase tracking-widest">Asistencia</h4>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest opacity-60">Últimos 7 días</p>
              </div>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setVista?.('ReportePDF')}
                className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-ios-blue active:bg-ios-blue active:text-white transition-all shadow-sm"
              >
                <span className="material-icons-outlined text-lg">picture_as_pdf</span>
              </motion.button>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={generalStats.attendanceTrend}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007AFF" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000005" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6E6E73', fontSize: 10, fontWeight: 700}}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}}
                    itemStyle={{color: '#007AFF', fontWeight: 700, fontSize: 12}}
                    labelStyle={{color: '#6E6E73', fontSize: 10, fontWeight: 700, marginBottom: 4}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="presentes" 
                    stroke="#007AFF" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorPresent)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* View: ReporteGrupal */}
      {vista === 'ReporteGrupal' && grupoStats && (
        <div className="space-y-6 px-6">
          <header className="px-1">
            <h2 className="text-2xl font-bold text-black tracking-tight">{selectedGrupo}</h2>
            <p className="text-secondary text-sm font-medium">Análisis de rendimiento grupal</p>
          </header>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-black/5 text-center space-y-1">
              <p className="text-[8px] font-bold text-secondary uppercase tracking-widest">Alumnas</p>
              <p className="text-xl font-bold text-black">{grupoStats.alumnosCount}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-black/5 text-center space-y-1">
              <p className="text-[8px] font-bold text-secondary uppercase tracking-widest">Clases</p>
              <p className="text-xl font-bold text-black">{grupoStats.clasesCount}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-black/5 text-center space-y-1">
              <p className="text-[8px] font-bold text-secondary uppercase tracking-widest">Promedio</p>
              <p className="text-xl font-bold text-ios-blue">{grupoStats.asistenciaPromedio}%</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-ios border border-black/5 space-y-8">
            <h4 className="text-sm font-bold text-black uppercase tracking-widest opacity-60">Habilidades más Logradas</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grupoStats.skillsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000005" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6E6E73', fontSize: 10, fontWeight: 700}}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{fill: '#F2F2F7'}}
                    contentStyle={{backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}}
                  />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                    {grupoStats.skillsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* View: ReporteBiometrico */}
      {vista === 'ReporteBiometrico' && biometricStats && (
        <div className="space-y-6 px-6">
          <header className="px-1">
            <h2 className="text-2xl font-bold text-black tracking-tight">Biometría Grupal</h2>
            <p className="text-secondary text-sm font-medium">Equilibrio físico del grupo {selectedGrupo}</p>
          </header>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-ios border border-black/5 space-y-8">
            <h4 className="text-xs font-bold text-secondary uppercase tracking-widest text-center">Score Promedio del Equipo</h4>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={biometricStats.radarData}>
                  <PolarGrid stroke="#00000005" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#6E6E73', fontSize: 12, fontWeight: 700 }} />
                  <Radar
                    name="Promedio Grupal"
                    dataKey="A"
                    stroke="#007AFF"
                    fill="#007AFF"
                    fillOpacity={0.15}
                  />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-ios border border-black/5 space-y-8">
              <h4 className="text-xs font-bold text-secondary uppercase tracking-widest text-center">Distribución por Edades</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={biometricStats.ageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {biometricStats.ageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}}
                    />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: 10, fontWeight: 700, textTransform: 'uppercase', paddingTop: 20}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-ios-blue p-8 rounded-[2.5rem] text-white space-y-4 shadow-lg overflow-hidden relative">
              <div className="absolute -right-8 -bottom-8 opacity-10">
                <span className="material-icons-outlined text-[160px]">insights</span>
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="material-icons-outlined">psychology</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest">Análisis de CoachAI</p>
                </div>
                <p className="text-xl font-bold italic tracking-tight leading-snug">
                  "El equipo de {selectedGrupo} muestra un desarrollo excepcional en {biometricStats.radarData.reduce((prev, current) => (prev.A > current.A) ? prev : current).subject}. Se recomienda enfocar los próximos entrenamientos en fortalecer el área de {biometricStats.radarData.reduce((prev, current) => (prev.A < current.A) ? prev : current).subject}."
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View: ReportePDF */}
      {vista === 'ReportePDF' && (
        <div className="space-y-8 bg-white p-12 rounded-[2rem] text-black min-h-[800px] shadow-2xl border border-gray-200 relative">
          <button 
            onClick={() => setVista?.('AsistenciaStats')}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-black transition-colors print:hidden"
          >
            <span className="material-icons-outlined">close</span>
          </button>
          <header className="flex justify-between items-start border-b-2 border-black pb-8">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter">GymCoach Pro</h1>
              <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Reporte de Desempeño y Asistencia</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase text-gray-400">Fecha de Emisión</p>
              <p className="text-sm font-black">{new Date().toLocaleDateString('es-ES')}</p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-12 py-8">
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest border-b border-gray-200 pb-2">Resumen General</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400">Total Alumnos</p>
                  <p className="text-2xl font-black">{generalStats.totalAlumnos}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400">Asistencia Promedio</p>
                  <p className="text-2xl font-black">88%</p>
                </div>
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest border-b border-gray-200 pb-2">Estado de Matrícula</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Al día</span>
                  <span className="font-black">{generalStats.alumnosActivos}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-black" style={{ width: `${(generalStats.alumnosActivos / generalStats.totalAlumnos) * 100}%` }}></div>
                </div>
              </div>
            </section>
          </div>

          <section className="space-y-6 py-8">
            <h3 className="text-xs font-black uppercase tracking-widest border-b border-gray-200 pb-2">Distribución de Habilidades</h3>
            <div className="grid grid-cols-3 gap-8">
              {skillTrends.slice(-3).map((trend, i) => (
                <div key={i} className="border border-gray-100 p-4 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">{trend.month}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span>Básico</span>
                      <span className="font-bold">{trend.basico}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>Intermedio</span>
                      <span className="font-bold">{trend.intermedio}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>Avanzado</span>
                      <span className="font-bold">{trend.avanzado}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="mt-auto pt-12 border-t border-gray-100 flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[8px] font-bold uppercase text-gray-400">Generado por</p>
              <p className="text-[10px] font-black uppercase">GymCoach Pro Intelligence System</p>
            </div>
            <div className="w-24 h-24 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
              <span className="text-[8px] font-black uppercase text-gray-300">QR CODE</span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
};
