
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../App';
import { Clase, GrupoConfig, ViewMode } from '../../types';

interface StaffProps {
  userRole: string;
  isAddingProfesor: boolean;
  newProfesorName: string;
  isSavingProfesor: boolean;
  profesoresList: { id?: string, nombre: string }[];
  clases: Clase[];
  grupos: GrupoConfig[];
  setIsAddingProfesor: (val: boolean) => void;
  setNewProfesorName: (val: string) => void;
  handleAddProfesor: () => void;
  setSelectedProfesor: (val: string) => void;
  handleNavigation: (vista: ViewMode) => void;
  handleDeleteProfesor: (id: string, nombre: string) => void;
  vista: ViewMode;
  selectedProfesor: string | null;
}

export const Staff: React.FC<StaffProps> = ({
  userRole,
  isAddingProfesor,
  newProfesorName,
  isSavingProfesor,
  profesoresList,
  clases,
  grupos,
  setIsAddingProfesor,
  setNewProfesorName,
  handleAddProfesor,
  setSelectedProfesor,
  handleNavigation,
  handleDeleteProfesor,
  vista,
  selectedProfesor
}) => {
  if (vista === 'Profesores') {
    return (
      <div className="px-6 py-8 space-y-8 page-transition pb-24 relative">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Profesores</h2>
            <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Staff de Entrenamiento</p>
          </div>
          <button 
            onClick={() => setIsAddingProfesor(!isAddingProfesor)}
            className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 active:scale-90 transition-all"
          >
            <span className="material-icons-outlined text-sm">{isAddingProfesor ? 'close' : 'person_add'}</span>
          </button>
        </header>
        
        {isAddingProfesor && (
          <div className="glass-card rounded-2xl p-5 border border-primary/30 space-y-4 shadow-neon-cyan">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Nuevo Profesor</h3>
            <input 
              type="text" 
              placeholder="Nombre completo" 
              className="w-full bg-antigravity-charcoal border rounded-xl px-4 py-3 text-sm text-white border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
              value={newProfesorName}
              onChange={e => setNewProfesorName(e.target.value)}
            />
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setIsAddingProfesor(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white font-bold text-xs uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddProfesor}
                disabled={!newProfesorName.trim() || isSavingProfesor}
                className="flex-1 py-3 rounded-xl bg-primary text-antigravity-black font-bold text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {isSavingProfesor ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {profesoresList.map((prof, idx) => {
            const profClases = clases.filter(c => c.entrenador === prof.nombre);
            const profGrupos = grupos.filter(g => g.entrenador === prof.nombre);
            return (
              <div 
                key={prof.id || idx} 
                className="glass-card rounded-3xl p-6 border border-white/5 active:scale-95 transition-all flex items-center justify-between group"
              >
                <div 
                  className="flex items-center gap-4 flex-1 cursor-pointer"
                  onClick={() => { setSelectedProfesor(prof.nombre); handleNavigation('ProfesorDetalle'); }}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                    <span className="material-icons-outlined text-primary text-2xl">badge</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">{prof.nombre}</h4>
                    <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">{profGrupos.length} Grupos • {profClases.length} Clases</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProfesor(prof.id!, prof.nombre);
                    }}
                    className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="material-icons-outlined text-sm">delete</span>
                  </button>
                  <span className="material-icons-outlined text-white/40">chevron_right</span>
                </div>
              </div>
            );
          })}
          {profesoresList.length === 0 && (
            <p className="text-center text-white/40 py-10 text-sm italic">No hay profesores registrados.</p>
          )}
        </div>

        <button 
          onClick={() => setIsAddingProfesor(true)}
          className="absolute bottom-28 right-6 w-16 h-16 bg-neon-blue text-white rounded-2xl flex items-center justify-center neon-fab-blue active:scale-95 transition-all z-30"
        >
          <span className="material-symbols-outlined text-[32px] font-light">person_add</span>
        </button>
      </div>
    );
  }

  if (vista === 'ProfesorDetalle' && selectedProfesor) {
    return (
      <div className="px-6 py-8 space-y-8 page-transition pb-24">
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => handleNavigation('Profesores')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-white font-black text-2xl uppercase tracking-tighter">{selectedProfesor}</h2>
            <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Reporte de Actividad</p>
          </div>
        </header>

        <section className="space-y-4">
          <h3 className="text-white font-bold text-lg px-1">Grupos a cargo</h3>
          <div className="grid grid-cols-2 gap-4">
            {(() => {
              const profGruposActuales = grupos.filter(g => g.entrenador === selectedProfesor);
              const profGruposHistoricos = Array.from(new Set(clases.filter(c => c.entrenador === selectedProfesor).map(c => c.grupo)));
              
              if (profGruposActuales.length > 0) {
                return profGruposActuales.map(g => (
                  <div key={g.id} className="glass-card rounded-2xl p-4 border border-white/5">
                    <h4 className="font-bold text-white text-sm">{g.nombre}</h4>
                    <p className="text-[10px] text-white/80 mt-1">{g.horario}</p>
                  </div>
                ));
              } else if (profGruposHistoricos.length > 0) {
                return profGruposHistoricos.map((nombre, idx) => (
                  <div key={idx} className="glass-card rounded-2xl p-4 border border-white/5 opacity-70">
                    <h4 className="font-bold text-white text-sm">{nombre}</h4>
                    <p className="text-[10px] text-white/60 mt-1">Histórico</p>
                  </div>
                ));
              } else {
                return <p className="text-sm text-white/60 col-span-2 px-1">No tiene grupos registrados.</p>;
              }
            })()}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-white font-bold text-lg px-1">Clases Registradas</h3>
          <div className="space-y-3">
            {clases.filter(c => c.entrenador === selectedProfesor).map(clase => (
              <div key={clase.id} className="glass-card rounded-2xl p-5 border border-white/5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-sm">{clase.grupo}</h4>
                    <p className="text-[10px] text-white/70">{new Date(clase.fecha).toLocaleDateString()} • {clase.horario}</p>
                  </div>
                </div>
                
                {clase.faseInicial && clase.faseInicial.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-primary font-bold mb-1">Entrada en calor</p>
                    <div className="flex flex-wrap gap-1">
                      {clase.faseInicial.map((item, i) => <span key={i} className="text-[10px] bg-white/5 text-white/90 px-2 py-1 rounded-md">{item}</span>)}
                    </div>
                  </div>
                )}
                
                {clase.fasePrincipal && clase.fasePrincipal.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-primary font-bold mb-1">Fase Principal</p>
                    <div className="flex flex-wrap gap-1">
                      {clase.fasePrincipal.map((item, i) => <span key={i} className="text-[10px] bg-white/5 text-white/90 px-2 py-1 rounded-md">{item}</span>)}
                    </div>
                    
                    {clase.habilidadesPorAparato && Object.keys(clase.habilidadesPorAparato).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {Object.entries(clase.habilidadesPorAparato).map(([aparato, habilidades]) => (
                          habilidades.length > 0 && (
                            <div key={aparato} className="bg-white/5 p-2 rounded-lg border border-white/10">
                              <p className="text-[9px] font-bold text-white mb-1">{aparato}</p>
                              <ul className="list-disc list-inside text-[10px] text-white/90 space-y-0.5">
                                {habilidades.map((hab, idx) => (
                                  <li key={idx}>{hab}</li>
                                ))}
                              </ul>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {clase.faseFinal && clase.faseFinal.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-primary font-bold mb-1">Fase Final</p>
                    <div className="flex flex-wrap gap-1">
                      {clase.faseFinal.map((item, i) => <span key={i} className="text-[10px] bg-white/5 text-white/90 px-2 py-1 rounded-md">{item}</span>)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return null;
};
