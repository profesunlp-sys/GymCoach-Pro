
import React from 'react';
import { GrupoConfig, ViewMode } from '../../types';

interface GruposProps {
  vista: ViewMode;
  setVista: (vista: ViewMode) => void;
  editingGroup: GrupoConfig | null;
  setEditingGroup: (group: GrupoConfig | null) => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  newCoachName: string;
  setNewCoachName: (name: string) => void;
  selectedDays: string[];
  setSelectedDays: React.Dispatch<React.SetStateAction<string[]>>;
  startTime: string;
  setStartTime: (time: string) => void;
  endTime: string;
  setEndTime: (time: string) => void;
  timeIntervals: string[];
  handleSaveGroup: () => void;
  grupos: GrupoConfig[];
  handleDeleteGroup: (group: GrupoConfig) => void;
  setActiveGroup: (group: GrupoConfig) => void;
}

export const Grupos: React.FC<GruposProps> = ({
  vista,
  setVista,
  editingGroup,
  setEditingGroup,
  newGroupName,
  setNewGroupName,
  newCoachName,
  setNewCoachName,
  selectedDays,
  setSelectedDays,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  timeIntervals,
  handleSaveGroup,
  grupos,
  handleDeleteGroup,
  setActiveGroup
}) => {
  if (vista !== 'Horario') return null;

  return (
    <div className="px-6 py-8 space-y-8 page-transition">
      <header>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Horarios y Grupos</h2>
        <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Gestión de Clases</p>
      </header>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-accent-purple font-bold text-lg active-glow">
            {editingGroup ? 'Editar Grupo' : 'Configuración de Horario'}
          </h3>
          {editingGroup && (
            <button 
              onClick={() => {
                setEditingGroup(null);
                setNewGroupName("");
                setNewCoachName("");
                setSelectedDays([]);
              }}
              className="text-[10px] text-white/60 uppercase font-bold hover:text-white transition-colors"
            >
              Cancelar Edición
            </button>
          )}
        </div>
        <div className="glass-card rounded-[2.5rem] p-6 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="material-icons-outlined text-primary text-sm">calendar_month</span>
              <h4 className="text-[10px] uppercase font-black text-white/80 tracking-[0.2em]">Días de Entrenamiento</h4>
            </div>
            <div className="flex justify-between items-center px-1">
              {[
                { id: 'L-0', label: 'Lun' },
                { id: 'M-1', label: 'Mar' },
                { id: 'M-2', label: 'Mié' },
                { id: 'J-3', label: 'Jue' },
                { id: 'V-4', label: 'Vie' },
                { id: 'S-5', label: 'Sáb' },
                { id: 'D-6', label: 'Dom' }
              ].map((day) => {
                const isSelected = selectedDays.includes(day.id);
                return (
                  <div key={day.id} className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => setSelectedDays(prev => prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id])}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-300 ${
                        isSelected 
                          ? 'bg-primary text-antigravity-black shadow-neon-cyan scale-110' 
                          : 'bg-white/5 text-white/60 border border-white/5 hover:bg-white/10 hover:text-white/80'
                      }`}
                    >
                      {day.id.split('-')[0]}
                    </button>
                    <span className={`text-[8px] font-black uppercase tracking-[0.15em] transition-colors duration-300 ${isSelected ? 'text-primary' : 'text-white/80'}`}>
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <span className="material-icons-outlined text-primary text-sm">badge</span>
                <h4 className="text-[10px] uppercase font-black text-white/80 tracking-[0.2em]">Información del Grupo</h4>
              </div>
              <div className="space-y-4">
                <input className="w-full crafted-input"
                  placeholder="Nombre del Grupo (Ej. Avanzados)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                
                <input className="w-full crafted-input"
                  placeholder="Nombre y Apellido del Profesor" value={newCoachName} onChange={(e) => setNewCoachName(e.target.value)} />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <span className="material-icons-outlined text-primary text-sm">schedule</span>
                <h4 className="text-[10px] uppercase font-black text-white/80 tracking-[0.2em]">Franja Horaria</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-bold text-white/90 ml-1 tracking-widest">Hora Inicio</label>
                  <div className="relative">
                    <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-antigravity-charcoal rounded-2xl px-4 py-3.5 text-sm text-white appearance-none border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all">
                      {timeIntervals.map(t => <option key={t} value={t} className="bg-antigravity-charcoal">{t}</option>)}
                    </select>
                    <span className="material-icons-outlined absolute right-4 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none text-sm">expand_more</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-bold text-white/90 ml-1 tracking-widest">Hora Fin</label>
                  <div className="relative">
                    <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-antigravity-charcoal rounded-2xl px-4 py-3.5 text-sm text-white appearance-none border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all">
                      {timeIntervals.map(t => <option key={t} value={t} className="bg-antigravity-charcoal">{t}</option>)}
                    </select>
                    <span className="material-icons-outlined absolute right-4 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none text-sm">expand_more</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleSaveGroup} className="w-full py-4.5 rounded-2xl border border-primary text-primary font-black bg-primary/5 shadow-neon-cyan active:scale-[0.98] transition-all uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2">
            <span className="material-icons-outlined text-sm">{editingGroup ? 'save' : 'add_circle'}</span>
            <span>{editingGroup ? 'Actualizar Configuración' : 'Crear Nuevo Grupo'}</span>
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between px-1"><h3 className="text-white font-bold text-lg">Mis Grupos</h3></div>
        {grupos.length > 0 ? grupos.map((g, idx) => (
          <div key={idx} className="glass-card rounded-[1.5rem] p-6 space-y-5 border border-white/5">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-white text-lg tracking-tight leading-none">{g.nombre}</h4>
                <p className="text-xs text-white/90 mt-2 font-medium italic">{g.horario}</p>
                {g.entrenador && <p className="text-[10px] text-primary mt-1 font-bold uppercase tracking-wider">Prof: {g.entrenador}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1.5 rounded-lg border border-primary/20 tracking-wider shadow-neon-cyan uppercase">Active</div>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingGroup(g);
                      setNewGroupName(g.nombre);
                      setNewCoachName(g.entrenador || "");
                      setSelectedDays(g.dias || []);
                      const times = g.horario.split(' - ');
                      if (times.length === 2) {
                        setStartTime(times[0]);
                        setEndTime(times[1]);
                      }
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-primary bg-primary/10 p-2 rounded-lg border border-primary/20 hover:bg-primary/20 transition-all flex items-center justify-center"
                    title="Editar grupo"
                  >
                    <span className="material-icons-outlined text-[16px]">edit</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }}
                    className="text-rose-500 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center justify-center"
                    title="Eliminar grupo"
                  >
                    <span className="material-icons-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
            <button onClick={() => { setActiveGroup(g); setVista('AsistenciaLista'); }} className="w-full py-3.5 rounded-2xl border border-primary text-primary font-bold text-[11px] uppercase tracking-widest shadow-neon-cyan flex items-center justify-center gap-2.5 bg-primary/5 active:scale-95 transition-all">
              <span className="material-icons-outlined text-[18px]">fact_check</span> Listas de Asistencia
            </button>
          </div>
        )) : (
          <div className="p-10 text-center glass-card rounded-[2rem] border-dashed border-slate-700/50 italic text-white/80 text-xs font-medium">No hay grupos configurados aún.</div>
        )}
      </section>
    </div>
  );
};
