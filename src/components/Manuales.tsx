
import React from 'react';
import { ViewMode } from '../../types';

interface ManualesProps {
  vista: ViewMode;
  setVista: (vista: ViewMode) => void;
  DISCIPLINAS: string[];
  NIVELES: string[];
  selectedDisciplina: string;
  setSelectedDisciplina: (val: string) => void;
  selectedNivel: string;
  setSelectedNivel: (val: string) => void;
  SKILL_TREE: any;
}

export const Manuales: React.FC<ManualesProps> = ({
  vista,
  setVista,
  DISCIPLINAS,
  NIVELES,
  selectedDisciplina,
  setSelectedDisciplina,
  selectedNivel,
  setSelectedNivel,
  SKILL_TREE
}) => {
  if (vista !== 'Planes') return null;

  return (
    <div className="px-6 py-8 space-y-8 page-transition pb-24">
      <header className="flex items-center gap-4">
        <button onClick={() => setVista('Dashboard')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Centro Técnico</h2>
          <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Manuales y Progresiones</p>
        </div>
      </header>

      <div className="space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {DISCIPLINAS.map(d => (
            <button 
              key={d}
              onClick={() => setSelectedDisciplina(d)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedDisciplina === d ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-white/5 text-white/60 border border-white/5'}`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {NIVELES.map(n => (
            <button 
              key={n}
              onClick={() => setSelectedNivel(n)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedNivel === n ? 'bg-white text-antigravity-black' : 'bg-white/5 text-white/40 border border-white/5'}`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {Object.entries(SKILL_TREE[selectedDisciplina as keyof typeof SKILL_TREE] || {}).map(([aparato, categorias]: [string, any]) => (
            <div key={aparato} className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                  <span className="material-icons-outlined text-primary text-xl">fitness_center</span>
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">{aparato}</h3>
              </div>
              
              <div className="space-y-4">
                {Object.entries(categorias).map(([cat, skills]: [string, any]) => (
                  <div key={cat} className="space-y-2">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest px-1">{cat}</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {skills.map((skill: string, idx: number) => (
                        <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all">
                          <span className="text-xs text-white/90">{skill}</span>
                          <span className="material-icons-outlined text-white/20 group-hover:text-primary transition-colors text-sm">info</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
