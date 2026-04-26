
import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { Alumno, GrupoConfig, ViewMode, Clase } from '../../types';

interface FinanzasProps {
  vista: ViewMode;
  setVista: (vista: ViewMode) => void;
  handleExportAttendance: () => void;
  handleAIAnalysis: () => void;
  isAnalyzing: boolean;
  comparativeData: any[];
  alumnos: Alumno[];
  grupos: GrupoConfig[];
  presentCount: number;
  clases: Clase[];
  asistencias: any;
  selectedDisciplina: string;
  setSelectedDisciplina: (d: string) => void;
  planesFilterDate: string;
  setPlanesFilterDate: (d: string) => void;
  planesFilterCoach: string;
  setPlanesFilterCoach: (c: string) => void;
}

export const Finanzas: React.FC<FinanzasProps> = ({
  vista,
  setVista,
  handleExportAttendance,
  handleAIAnalysis,
  isAnalyzing,
  comparativeData,
  alumnos,
  grupos,
  presentCount
}) => {
  if (vista !== 'AsistenciaStats') return null;

  return (
    <div className="px-6 py-8 space-y-8 page-transition pb-24">
      <header className="flex items-center gap-4">
        <button onClick={() => setVista('Dashboard')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Estadísticas</h2>
          <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Análisis de Asistencia</p>
        </div>
        <button 
          onClick={handleExportAttendance}
          className="ml-auto w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 active:scale-90 transition-all"
          title="Exportar Excel"
        >
          <span className="material-icons-outlined">download</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Analysis Button */}
        <div className="md:col-span-2">
          <button 
            onClick={handleAIAnalysis}
            disabled={isAnalyzing}
            className="w-full glass-card rounded-[2rem] p-8 border border-primary/20 bg-primary/5 flex items-center justify-between group hover:bg-primary/10 transition-all"
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 shadow-neon-cyan group-hover:scale-110 transition-transform">
                <span className="material-icons-outlined text-primary text-3xl">{isAnalyzing ? 'sync' : 'psychology'}</span>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Análisis con IA</h3>
                <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Obtener insights y sugerencias</p>
              </div>
            </div>
            <span className="material-icons-outlined text-primary/50 group-hover:translate-x-2 transition-transform">arrow_forward</span>
          </button>
        </div>

        {/* Comparativa de Asistencia por Grupo */}
        <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4 md:col-span-2">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xs font-black text-white/80 uppercase tracking-widest">Comparativa de Asistencia (%)</h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span className="text-[8px] text-white/50 uppercase font-bold">Asistencia</span>
              </div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#ffffff40" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(val) => `${val}%`}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  cursor={{ fill: '#ffffff05' }}
                  formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Asistencia Promedio']}
                />
                <Bar dataKey="asistencia" fill="url(#colorAsistencia)" radius={[6, 6, 0, 0]}>
                  <defs>
                    <linearGradient id="colorAsistencia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-2 pt-4 border-t border-white/5">
            {comparativeData.slice(0, 4).map((data, i) => (
              <div key={i} className="space-y-1">
                <p className="text-[8px] text-white/40 uppercase font-bold truncate">{data.name}</p>
                <p className="text-lg font-black text-white">{data.asistencia.toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico de Tendencia */}
        <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4">
          <h3 className="text-xs font-black text-white/80 uppercase tracking-widest px-2">Tendencia Mensual</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={alumnos.reduce((acc: any[], al) => {
                const month = new Date(al.fechaIngreso).toLocaleString('default', { month: 'short' });
                const existing = acc.find(i => i.name === month);
                if (existing) existing.count++;
                else acc.push({ name: month, count: 1 });
                return acc;
              }, []).slice(-6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#00F0FF', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="count" stroke="#00F0FF" strokeWidth={3} dot={{ r: 4, fill: '#00F0FF' }} activeDot={{ r: 6, stroke: '#00F0FF', strokeWidth: 2, fill: '#151619' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribución por Grupo */}
        <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4">
          <h3 className="text-xs font-black text-white/80 uppercase tracking-widest px-2">Alumnos por Grupo</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grupos.map(g => ({
                name: g.nombre,
                alumnos: alumnos.filter(a => a.grupo === g.nombre).length
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  cursor={{ fill: '#ffffff05' }}
                />
                <Bar dataKey="alumnos" fill="#A855F7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Estado de Pagos */}
        <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4">
          <h3 className="text-xs font-black text-white/80 uppercase tracking-widest px-2">Estado de Matrículas</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Al día', value: alumnos.filter(a => a.estadoPago === 'Al día').length, color: '#10B981' },
                    { name: 'Pendiente', value: alumnos.filter(a => a.estadoPago === 'Pendiente').length, color: '#F59E0B' },
                    { name: 'Vencido', value: alumnos.filter(a => a.estadoPago === 'Vencido').length, color: '#EF4444' }
                  ]}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                >
                  {[
                    { color: '#10B981' },
                    { color: '#F59E0B' },
                    { color: '#EF4444' }
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resumen de Asistencia Hoy */}
        <div className="glass-card rounded-[2rem] p-6 border border-white/5 flex flex-col justify-center items-center text-center space-y-4">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 shadow-neon-cyan">
            <span className="material-icons-outlined text-primary text-4xl">how_to_reg</span>
          </div>
          <div>
            <h4 className="text-3xl font-black text-white">{presentCount}</h4>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Presentes Hoy</p>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary shadow-neon-cyan" style={{ width: `${(presentCount / (alumnos.length || 1)) * 100}%` }}></div>
          </div>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
            {Math.round((presentCount / (alumnos.length || 1)) * 100)}% de la matrícula total
          </p>
        </div>

        {/* Control Anual de Pagos (Grid 12 meses) */}
        <div className="glass-card rounded-[2rem] p-8 border border-white/5 space-y-6 md:col-span-2 overflow-hidden bg-white/[0.02]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Control Anual de Cuotas</h3>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Pagado
                <span className="w-2 h-2 rounded-full bg-rose-500 ml-2"></span> Pendiente
              </p>
            </div>
            <div className="flex bg-antigravity-charcoal/50 p-1 rounded-xl border border-white/5">
              {['2024', '2025', '2026'].map(y => (
                <button 
                  key={y}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${new Date().getFullYear().toString() === y ? 'bg-primary text-black shadow-neon-cyan' : 'text-white/40 hover:text-white'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto pb-4 -mx-2">
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="text-left py-4 px-4 text-[9px] font-black text-white/30 uppercase tracking-[0.2em] sticky left-0 bg-antigravity-dark z-10">Alumno</th>
                  {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map(m => (
                    <th key={m} className="text-center py-4 px-2 text-[9px] font-black text-white/40 uppercase tracking-widest">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alumnos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')).map((alumno) => {
                  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                  const currentYear = new Date().getFullYear();

                  return (
                    <tr key={alumno.id} className="group">
                      <td className="bg-white/[0.03] rounded-l-2xl py-4 px-4 border-l border-t border-b border-white/5 sticky left-0 z-10 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black border border-primary/20">
                            {alumno.nombre?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white leading-none whitespace-nowrap">{alumno.nombre}</p>
                            <p className="text-[8px] text-white/30 uppercase font-bold mt-1 tracking-widest">{alumno.grupo}</p>
                          </div>
                        </div>
                      </td>
                      {months.map((month) => {
                        const isPaid = alumno.pagosMensuales?.some(p => p.mes === month && p.anio === currentYear);
                        return (
                          <td key={month} className="bg-white/[0.015] border-t border-b border-white/5 py-4 px-1 text-center">
                            <div className="flex justify-center">
                              {isPaid ? (
                                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                  <span className="material-icons-outlined text-sm">check_circle</span>
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-lg bg-rose-500/5 border border-rose-500/10 flex items-center justify-center text-rose-500/40">
                                  <span className="material-symbols-outlined text-sm font-light">radio_button_unchecked</span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="bg-white/[0.03] rounded-r-2xl border-r border-t border-b border-white/5 px-2"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Progreso por Grupo */}
        <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4 md:col-span-2">
          <h3 className="text-xs font-black text-white/80 uppercase tracking-widest px-2">Progreso Técnico por Grupo (Habilidades Dominadas)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grupos.map(g => {
                const groupAlumnos = alumnos.filter(a => a.grupo === g.nombre);
                const totalSkills = groupAlumnos.reduce((sum, a) => sum + (a.habilidades?.filter(s => s.status === 'Dominado' || s.status === 'Elite').length || 0), 0);
                const avgSkills = groupAlumnos.length > 0 ? (totalSkills / groupAlumnos.length).toFixed(1) : 0;
                return {
                  name: g.nombre,
                  avg: parseFloat(avgSkills as string)
                };
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  cursor={{ fill: '#ffffff05' }}
                />
                <Bar dataKey="avg" fill="#00F0FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
