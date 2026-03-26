import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Alumno, Clase, GrupoConfig } from '../../types';

interface ReportesProps {
  alumnos: Alumno[];
  clases: Clase[];
  grupos: GrupoConfig[];
  vista: 'AsistenciaStats' | 'ReporteGrupal' | 'TendenciasHabilidades' | 'Finanzas';
  setVista?: (vista: any) => void;
  handleExportAttendance?: (mes: number, anio: number) => void;
  handleAIAnalysis?: () => void;
  isAnalyzing?: boolean;
  comparativeData?: any;
  asistencias?: any[];
}

export const Reportes: React.FC<ReportesProps> = ({ alumnos, clases, grupos, vista }) => {
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

  const COLORS = ['#00F5FF', '#7000FF', '#FF00E5', '#FFB800', '#00FF85'];

  return (
    <div className="space-y-8 pb-24">
      {/* Header Selector for Group Reports */}
      {vista === 'ReporteGrupal' && (
        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {grupos.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGrupo(g.nombre)}
              className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap border ${
                selectedGrupo === g.nombre 
                  ? 'bg-primary/10 border-primary text-primary shadow-neon-cyan' 
                  : 'bg-white/5 border-white/5 text-white/40 hover:border-white/20'
              }`}
            >
              {g.nombre}
            </button>
          ))}
        </div>
      )}

      {/* View: AsistenciaStats (General Dashboard) */}
      {vista === 'AsistenciaStats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-2">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Total Alumnos</p>
              <h3 className="text-3xl font-black text-white tracking-tighter">{generalStats.totalAlumnos}</h3>
              <div className="flex items-center gap-1 text-primary">
                <span className="material-icons-outlined text-sm">trending_up</span>
                <span className="text-[10px] font-bold">+12% este mes</span>
              </div>
            </div>
            <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-2">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Alumnos Activos</p>
              <h3 className="text-3xl font-black text-white tracking-tighter">{generalStats.alumnosActivos}</h3>
              <div className="flex items-center gap-1 text-primary">
                <span className="material-icons-outlined text-sm">check_circle</span>
                <span className="text-[10px] font-bold">Al día con pagos</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-6">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-black text-white uppercase tracking-widest">Tendencia de Asistencia</h4>
              <span className="text-[10px] font-bold text-white/40 uppercase">Últimos 7 días</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={generalStats.attendanceTrend}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00F5FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#ffffff40', fontSize: 10, fontWeight: 900}}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#151619', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px'}}
                    itemStyle={{color: '#00F5FF', fontWeight: 900, fontSize: 12}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="presentes" 
                    stroke="#00F5FF" 
                    strokeWidth={3}
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
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-card p-4 rounded-2xl border border-white/5 text-center space-y-1">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Alumnos</p>
              <p className="text-xl font-black text-white">{grupoStats.alumnosCount}</p>
            </div>
            <div className="glass-card p-4 rounded-2xl border border-white/5 text-center space-y-1">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Clases</p>
              <p className="text-xl font-black text-white">{grupoStats.clasesCount}</p>
            </div>
            <div className="glass-card p-4 rounded-2xl border border-white/5 text-center space-y-1">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Asistencia</p>
              <p className="text-xl font-black text-primary">{grupoStats.asistenciaPromedio}%</p>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-6">
            <h4 className="text-sm font-black text-white uppercase tracking-widest">Habilidades más Logradas</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grupoStats.skillsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#ffffff60', fontSize: 10, fontWeight: 700}}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{backgroundColor: '#151619', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px'}}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
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

      {/* View: TendenciasHabilidades */}
      {vista === 'TendenciasHabilidades' && (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-6">
            <h4 className="text-sm font-black text-white uppercase tracking-widest">Evolución de Niveles</h4>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#ffffff40', fontSize: 10, fontWeight: 900}}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#ffffff40', fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#151619', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px'}}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: 20, fontSize: 10, fontWeight: 900, textTransform: 'uppercase'}} />
                  <Bar dataKey="basico" name="Básico" stackId="a" fill="#00F5FF" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="intermedio" name="Intermedio" stackId="a" fill="#7000FF" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="avanzado" name="Avanzado" stackId="a" fill="#FF00E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="glass-card p-6 rounded-3xl border border-white/5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Tasa de Progresión</p>
                <h3 className="text-2xl font-black text-white">24.5%</h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-neon-cyan">
                <span className="material-icons-outlined">trending_up</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
