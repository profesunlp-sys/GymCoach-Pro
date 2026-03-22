
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Alumno, Skill, SkillStatus, Apparatus } from '../types';

interface HabilidadesProps {
  selectedAlumno: Alumno;
  isAddingSkill: boolean;
  setIsAddingSkill: (val: boolean) => void;
  skillSearchQuery: string;
  setSkillSearchQuery: (val: string) => void;
  skillApparatusFilter: string;
  setSkillApparatusFilter: (val: string) => void;
  SKILL_TREE: any;
  newSkill: Partial<Skill>;
  setNewSkill: (val: Partial<Skill>) => void;
  handleAddSkill: () => void;
  editingSkillId: string | null;
  setEditingSkillId: (val: string | null) => void;
  editingSkillData: Partial<Skill>;
  setEditingSkillData: (val: Partial<Skill>) => void;
  handleUpdateSkill: () => void;
  handleDeleteSkill: (id: string) => void;
  toggleFavoriteSkill: (id: string) => void;
}

export const Habilidades: React.FC<HabilidadesProps> = ({
  selectedAlumno,
  isAddingSkill,
  setIsAddingSkill,
  skillSearchQuery,
  setSkillSearchQuery,
  skillApparatusFilter,
  setSkillApparatusFilter,
  SKILL_TREE,
  newSkill,
  setNewSkill,
  handleAddSkill,
  editingSkillId,
  setEditingSkillId,
  editingSkillData,
  setEditingSkillData,
  handleUpdateSkill,
  handleDeleteSkill,
  toggleFavoriteSkill
}) => {
  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-white font-bold text-lg">Habilidades</h3>
        <button 
          onClick={() => setIsAddingSkill(!isAddingSkill)}
          className="text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1"
        >
          <span className="material-icons-outlined text-sm">{isAddingSkill ? 'close' : 'add'}</span>
          {isAddingSkill ? 'Cancelar' : 'Añadir'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">search</span>
          <input 
            type="text" 
            placeholder="Buscar habilidad por nombre..." 
            value={skillSearchQuery}
            onChange={(e) => setSkillSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white outline-none focus:border-primary/50 transition-all"
          />
          {skillSearchQuery && (
            <button 
              onClick={() => setSkillSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <span className="material-icons text-sm">close</span>
            </button>
          )}
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          {['Todos', 'Favoritos', ...Object.keys(SKILL_TREE)].map(ap => (
            <button
              key={ap}
              onClick={() => setSkillApparatusFilter(ap)}
              className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border flex items-center shrink-0 ${
                skillApparatusFilter === ap 
                  ? 'bg-primary text-antigravity-black border-primary shadow-neon-cyan' 
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              }`}
            >
              {ap === 'Favoritos' && <span className="material-icons text-[12px] mr-1.5">star</span>}
              {ap}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isAddingSkill && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card rounded-2xl p-5 border border-primary/30 space-y-4 shadow-neon-cyan"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest ml-1">Aparato</label>
              <select 
                className="w-full crafted-input"
                value={newSkill.apparatus}
                onChange={(e) => setNewSkill({...newSkill, apparatus: e.target.value as Apparatus, name: ''})}
              >
                {Object.keys(SKILL_TREE).map(ap => (
                  <option key={ap} value={ap}>{ap}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest ml-1">Habilidad (IFG Tree)</label>
              <select 
                className="w-full crafted-input"
                value={newSkill.name}
                onChange={(e) => {
                  const selectedSkill = SKILL_TREE[newSkill.apparatus as Apparatus]?.find((s: any) => s.name === e.target.value);
                  setNewSkill({
                    ...newSkill, 
                    name: e.target.value,
                    level: selectedSkill?.difficulty || '1'
                  });
                }}
              >
                <option value="">Seleccionar habilidad...</option>
                {SKILL_TREE[newSkill.apparatus as Apparatus]?.map((s: any) => (
                  <option key={s.name} value={s.name}>{s.name} ({s.difficulty})</option>
                ))}
                <option value="custom">-- Otra habilidad --</option>
              </select>
            </div>

            {newSkill.name === 'custom' && (
              <input 
                type="text" 
                placeholder="Nombre de la habilidad personalizada"
                className="w-full crafted-input"
                onChange={(e) => setNewSkill({...newSkill, name: e.target.value})}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest ml-1">Estado</label>
                <select 
                  className="w-full crafted-input"
                  value={newSkill.status}
                  onChange={(e) => setNewSkill({...newSkill, status: e.target.value as SkillStatus})}
                >
                  <option value="No Iniciado">No Iniciado</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Dominado">Dominado</option>
                  <option value="Elite">Elite</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest ml-1">Dificultad IFG</label>
                <input 
                  type="text" 
                  placeholder="Nivel/Dificultad"
                  className="w-full crafted-input"
                  value={newSkill.level}
                  onChange={(e) => setNewSkill({...newSkill, level: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 px-1">
              <button 
                onClick={() => setNewSkill({...newSkill, favorite: !newSkill.favorite})}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                  newSkill.favorite 
                    ? 'bg-primary/10 border-primary/30 text-primary' 
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                <span className="material-icons text-sm">{newSkill.favorite ? 'star' : 'star_border'}</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Favorito</span>
              </button>
            </div>

            <button 
              onClick={handleAddSkill}
              disabled={!newSkill.name || newSkill.name === 'custom'}
              className="w-full py-3 rounded-xl bg-primary text-antigravity-black font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all disabled:opacity-50 shadow-neon-cyan"
            >
              Guardar Habilidad
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {selectedAlumno.habilidades && selectedAlumno.habilidades.length > 0 ? (
          selectedAlumno.habilidades
            .filter(skill => {
              const matchesSearch = skill.name.toLowerCase().includes(skillSearchQuery.toLowerCase());
              const matchesApparatus = skillApparatusFilter === 'Todos' 
                ? true 
                : skillApparatusFilter === 'Favoritos' 
                  ? skill.favorite 
                  : skill.apparatus === skillApparatusFilter;
              return matchesSearch && matchesApparatus;
            })
            .sort((a, b) => {
              if (a.favorite && !b.favorite) return -1;
              if (!a.favorite && b.favorite) return 1;
              return 0;
            })
            .map(skill => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={skill.id} 
                className={`glass-card rounded-2xl p-4 border transition-all ${skill.favorite ? 'border-primary/40 bg-primary/5' : 'border-white/5'}`}
              >
                {editingSkillId === skill.id ? (
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="Nombre de la habilidad"
                      className="w-full bg-antigravity-charcoal border rounded-xl py-3 px-4 text-sm text-white transition-all border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                      value={editingSkillData.name || ''}
                      onChange={(e) => setEditingSkillData({...editingSkillData, name: e.target.value})}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        list="apparatus-list"
                        placeholder="Aparato"
                        className="bg-antigravity-charcoal border rounded-xl py-3 px-4 text-sm text-white transition-all border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                        value={editingSkillData.apparatus || ''}
                        onChange={(e) => setEditingSkillData({...editingSkillData, apparatus: e.target.value as Apparatus})}
                      />
                      <input 
                        list="status-list"
                        placeholder="Estado"
                        className="bg-antigravity-charcoal border rounded-xl py-3 px-4 text-sm text-white transition-all border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                        value={editingSkillData.status || ''}
                        onChange={(e) => setEditingSkillData({...editingSkillData, status: e.target.value as SkillStatus})}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-white/60 font-medium">Nivel:</label>
                      <input 
                        type="text" 
                        placeholder="Ej. 1, E2, USAG 3"
                        className="flex-1 bg-antigravity-charcoal border rounded-xl py-2 px-3 text-sm text-white transition-all border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                        value={editingSkillData.level || ''}
                        onChange={(e) => setEditingSkillData({...editingSkillData, level: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => handleDeleteSkill(skill.id)}
                        className="py-3 px-4 rounded-xl border border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-wider bg-red-500/10"
                      >
                        <span className="material-icons-outlined text-sm">delete</span>
                      </button>
                      <button 
                        onClick={() => { setEditingSkillId(null); setEditingSkillData({}); }}
                        className="flex-1 py-3 rounded-xl border border-white/10 text-white font-bold text-xs uppercase tracking-wider"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleUpdateSkill}
                        disabled={!editingSkillData.name?.trim()}
                        className="flex-1 py-3 rounded-xl bg-primary text-antigravity-black font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1" onClick={() => { setEditingSkillId(skill.id); setEditingSkillData(skill); }}>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{skill.name}</h4>
                          {skill.favorite && <span className="material-icons text-primary text-xs">star</span>}
                        </div>
                        <p className="text-[10px] text-white/80 font-medium uppercase tracking-wider mt-1">{skill.apparatus} • Nivel {skill.level}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleFavoriteSkill(skill.id); }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${skill.favorite ? 'text-primary' : 'text-white/30 hover:text-white/50'}`}
                        >
                          <span className="material-icons-outlined text-sm">{skill.favorite ? 'star' : 'star_border'}</span>
                        </button>
                        <div className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
                          skill.status === 'Dominado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          skill.status === 'En Proceso' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          skill.status === 'Elite' ? 'bg-accent-purple/10 text-accent-purple border-accent-purple/20' :
                          'bg-white/5 text-white/70 border-white/10'
                        }`}>
                          {skill.status}
                        </div>
                        <button 
                          onClick={() => { setEditingSkillId(skill.id); setEditingSkillData(skill); }}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 active:scale-90 transition-all"
                          title="Editar"
                        >
                          <span className="material-icons-outlined text-sm">edit</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteSkill(skill.id)}
                          className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 active:scale-90 transition-all"
                          title="Eliminar"
                        >
                          <span className="material-icons-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                    
                    {skill.history && skill.history.length > 0 && (
                      <div className="mt-1 pt-3 border-t border-white/5">
                        <p className="text-[9px] text-white/80 uppercase tracking-widest mb-2 font-bold">
                          Línea de tiempo
                          {skill.status === 'Dominado' && skill.history.length > 1 && (
                            <span className="text-emerald-400 ml-1">
                              (Logrado en {Math.ceil(Math.abs(new Date(skill.history[skill.history.length - 1].date).getTime() - new Date(skill.history[0].date).getTime()) / (1000 * 60 * 60 * 24))} días)
                            </span>
                          )}
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {skill.history.map((h, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                              <span className="text-white/90 min-w-[70px]">{new Date(h.date).toLocaleDateString()}</span>
                              <span className="text-white/80 font-medium">{h.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))
        ) : (
          <div className="py-10 text-center opacity-20 italic text-sm">No hay habilidades registradas.</div>
        )}
      </div>
    </section>
  );
};
