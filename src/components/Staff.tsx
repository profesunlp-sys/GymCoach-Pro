
import React from 'react';
import { motion } from 'motion/react';
import { Button, BackButton } from '../../App';
import { Clase, GrupoConfig, ViewMode, Alumno, UserRole, AsistenciaRecord } from '../../types';

interface StaffProps {
  userRole: UserRole;
  isAddingProfesor: boolean;
  newProfesorName: string;
  isSavingProfesor: boolean;
  profesoresList: { id?: string, nombre: string }[];
  clases: Clase[];
  grupos: GrupoConfig[];
  alumnos: Alumno[];
  asistencias: AsistenciaRecord[];
  setIsAddingProfesor: (val: boolean) => void;
  setNewProfesorName: (val: string) => void;
  handleAddProfesor: () => void;
  setSelectedProfesor: (val: string) => void;
  handleNavigation: (vista: ViewMode) => void;
  setVista: (vista: ViewMode) => void;
  handleDeleteProfesor: (id: string, nombre: string) => void;
  handleUpdateProfesor: (id: string, nombre: string) => void;
  vista: ViewMode;
  selectedProfesor: string | null;
  setSelectedClase: (clase: Clase | null) => void;
  setNotificacion: (notif: { t: string, d: string } | null) => void;
}

export const Staff: React.FC<StaffProps> = ({
  userRole,
  isAddingProfesor,
  newProfesorName,
  isSavingProfesor,
  profesoresList,
  clases,
  grupos,
  alumnos,
  asistencias,
  setIsAddingProfesor,
  setNewProfesorName,
  handleAddProfesor,
  setSelectedProfesor,
  handleNavigation,
  setVista,
  handleDeleteProfesor,
  handleUpdateProfesor,
  vista,
  selectedProfesor,
  setSelectedClase,
  setNotificacion
}) => {
  if (vista === 'Profesores') {
    return (
      <div className="px-6 py-8 space-y-8 page-transition pb-24 relative">
        <BackButton onClick={() => setVista('Dashboard')} />
        <header className="flex justify-between items-end pt-8">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Staff</h2>
            <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Gestión de Profesores</p>
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
            
            // Estadísticas del mes actual
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const clasesEsteMes = profClases.filter(c => c.fecha >= firstDayOfMonth).length;
            
            // Alumnos totales asignados
            const alumnosAsignados = profGrupos.reduce((acc, g) => acc + (alumnos.filter(a => a.grupo === g.nombre).length), 0);
            
            // Promedio de asistencia (simulado o calculado si hay datos)
            const totalPresentes = profClases.reduce((acc, c) => acc + (asistencias.filter(a => a.fecha === c.fecha && a.grupo === c.grupo && a.presente).length), 0);
            const totalEsperados = profClases.reduce((acc, c) => acc + (alumnos.filter(a => a.grupo === c.grupo).length), 0);
            const promedioAsistencia = totalEsperados > 0 
              ? Math.round((totalPresentes / totalEsperados) * 100)
              : 0;

            // Indicador de estado
            const statusColor = clasesEsteMes > 8 ? 'bg-emerald-500' : clasesEsteMes > 4 ? 'bg-amber-500' : 'bg-rose-500';

            return (
              <div 
                key={prof.id || idx} 
                className="glass-card rounded-3xl p-6 border border-white/5 active:scale-[0.98] transition-all flex flex-col gap-4 group"
                onClick={() => { setSelectedProfesor(prof.nombre); handleNavigation('ProfesorDetalle'); }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 relative">
                      <span className="material-icons-outlined text-primary text-2xl">badge</span>
                      <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-antigravity-black ${statusColor}`}></div>
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">{prof.nombre}</h4>
                      <p className="text-[10px] text-primary font-black uppercase tracking-widest">Profesor de Gimnasia</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newName = prompt("Editar nombre del profesor:", prof.nombre);
                        if (newName && newName.trim() && newName !== prof.nombre) {
                          handleUpdateProfesor(prof.id!, newName.trim());
                        }
                      }}
                      className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center"
                    >
                      <span className="material-icons-outlined text-sm">edit</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProfesor(prof.id!, prof.nombre);
                      }}
                      className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center"
                    >
                      <span className="material-icons-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white font-black text-sm">{profGrupos.length}</span>
                    <span className="text-[8px] text-white/40 uppercase font-bold">Grupos</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white font-black text-sm">{clasesEsteMes}</span>
                    <span className="text-[8px] text-white/40 uppercase font-bold">Clases Mes</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white font-black text-sm">{promedioAsistencia}%</span>
                    <span className="text-[8px] text-white/40 uppercase font-bold">Asistencia</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">{alumnosAsignados} Alumnos Asignados</span>
                  <div className="flex items-center gap-1 text-primary">
                    <span className="text-[10px] font-black uppercase tracking-widest">Ver Detalle</span>
                    <span className="material-icons-outlined text-sm">chevron_right</span>
                  </div>
                </div>
              </div>
            );
          })}
          {profesoresList.length === 0 && (
            <p className="text-center text-white/40 py-10 text-sm italic">No hay profesores registrados.</p>
          )}
        </div>
      </div>
    );
  }

  if (vista === 'ProfesorDetalle' && selectedProfesor) {
    const profClases = clases.filter(c => c.entrenador === selectedProfesor);
    const profGrupos = grupos.filter(g => g.entrenador === selectedProfesor);
    
    // Estadísticas del mes
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const firstDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    
    const clasesEsteMes = profClases.filter(c => c.fecha >= firstDayOfMonth).length;
    const clasesMesPasado = profClases.filter(c => c.fecha >= firstDayOfPrevMonth && c.fecha < firstDayOfMonth).length;
    
    const diffClases = clasesEsteMes - clasesMesPasado;

    // Habilidades trabajadas (extraídas de las clases)
    const habilidadesTrabajadas = Array.from(new Set(profClases.flatMap(c => {
      const habs = [];
      if (c.fasePrincipal) habs.push(...c.fasePrincipal);
      if (c.habilidadesPorAparato) {
        Object.values(c.habilidadesPorAparato).forEach(h => habs.push(...h));
      }
      return habs;
    }))).slice(0, 8);

    return (
      <div className="px-6 py-8 space-y-8 page-transition pb-24">
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => handleNavigation('Profesores')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          <div className="flex-1">
            <h2 className="text-white font-black text-2xl uppercase tracking-tighter">{selectedProfesor}</h2>
            <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Perfil del Entrenador</p>
          </div>
          <Button variant="danger" className="w-10 h-10 !p-0 rounded-xl relative">
            <span className="material-icons-outlined text-sm">feedback</span>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-antigravity-black"></div>
          </Button>
        </header>

        {/* Estadísticas del Mes */}
        <section className="space-y-4">
          <h3 className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em] px-1">Estadísticas del Mes</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-3xl p-5 border border-white/5 space-y-2">
              <span className="text-[10px] text-white/40 uppercase font-bold block">Clases Dictadas</span>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-white">{clasesEsteMes}</span>
                <span className={`text-[10px] font-bold mb-1 ${diffClases >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {diffClases >= 0 ? '+' : ''}{diffClases} vs mes ant.
                </span>
              </div>
            </div>
            <div className="glass-card rounded-3xl p-5 border border-white/5 space-y-2">
              <span className="text-[10px] text-white/40 uppercase font-bold block">Alumnos Activos</span>
              <span className="text-3xl font-black text-primary">{profGrupos.reduce((acc, g) => acc + (alumnos.filter(a => a.grupo === g.nombre).length), 0)}</span>
            </div>
          </div>
        </section>

        {/* Grupos a cargo */}
        <section className="space-y-4">
          <h3 className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em] px-1">Grupos a cargo</h3>
          <div className="space-y-3">
            {profGrupos.length > 0 ? profGrupos.map(g => {
              const groupStudents = alumnos.filter(a => a.grupo === g.nombre).length;
              return (
                <div key={g.id} className="glass-card rounded-2xl p-4 border border-white/5 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white text-sm">{g.nombre}</h4>
                    <p className="text-[10px] text-white/60 mt-0.5">{g.horario}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-primary block">{groupStudents} Alumnos</span>
                    <span className="text-[8px] text-white/40 uppercase font-bold tracking-widest">Inscriptos</span>
                  </div>
                </div>
              );
            }) : (
              <p className="text-sm text-white/60 px-1 italic">No tiene grupos asignados actualmente.</p>
            )}
          </div>
        </section>

        {/* Habilidades Trabajadas */}
        <section className="space-y-4">
          <h3 className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em] px-1">Habilidades Trabajadas</h3>
          <div className="flex flex-wrap gap-2">
            {habilidadesTrabajadas.length > 0 ? habilidadesTrabajadas.map((hab, idx) => (
              <span key={idx} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {hab}
              </span>
            )) : (
              <p className="text-sm text-white/60 px-1 italic">Sin registro de habilidades este mes.</p>
            )}
          </div>
        </section>

        {/* Historial de Clases */}
        <section className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-[10px] uppercase font-black text-white/40 tracking-[0.2em]">Historial de clases</h3>
            <button 
              onClick={() => handleNavigation('HistorialClases')}
              className="text-[10px] text-primary font-bold uppercase hover:underline"
            >
              Ver todo
            </button>
          </div>
          <div className="space-y-3">
            {profClases.slice(0, 5).map(clase => (
              <div 
                key={clase.id} 
                onClick={() => { setSelectedClase?.(clase); setVista('ClaseDetalle'); }}
                className="glass-card rounded-2xl p-5 border border-white/5 flex items-center gap-4 cursor-pointer hover:border-primary/30 transition-all"
              >
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40">
                  <span className="material-icons-outlined text-sm">event</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-white text-sm">{clase.grupo}</h4>
                  <p className="text-[10px] text-white/60">{new Date(clase.fecha).toLocaleDateString()} • {clase.horario}</p>
                </div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">{asistencias.filter(a => a.fecha === clase.fecha && a.grupo === clase.grupo && a.presente).length} Presentes</span>
              </div>
            ))}
          </div>
        </section>

        <Button 
          onClick={() => {
            setNotificacion?.({ t: "Feedback", d: "Sección de feedback en desarrollo. Próximamente disponible." });
            setTimeout(() => setNotificacion?.(null), 3000);
          }}
          className="w-full py-4 rounded-2xl shadow-neon-cyan flex items-center justify-center gap-2"
        >
          <span className="material-icons-outlined">feedback</span>
          Ver Feedback del Coordinador
        </Button>
      </div>
    );
  }

  return null;
};
