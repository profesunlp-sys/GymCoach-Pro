
import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { Alumno, GrupoConfig, ViewMode } from '../types';

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
