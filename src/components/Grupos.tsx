
import React, { useState } from 'react';
import { GrupoConfig, ViewMode, Alumno } from '../../types';
import { EditableDropdown, BackButton } from '../../App';
import { motion, AnimatePresence } from 'framer-motion';

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
  alumnos: Alumno[];
  handleUpdateStudentGroup: (studentId: string, groupName: string) => void;
  handleDeleteGroup: (group: GrupoConfig) => void;
  setActiveGroup: (group: GrupoConfig) => void;
  profesoresList: { id?: string, nombre: string }[];
  handleAddProfesor: (name: string) => void;
  handleUpdateProfesor: (id: string, name: string) => void;
  handleDeleteProfesor: (id: string, name: string) => void;
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
  alumnos,
  handleUpdateStudentGroup,
  handleDeleteGroup,
  setActiveGroup,
  profesoresList,
  handleAddProfesor,
  handleUpdateProfesor,
  handleDeleteProfesor
}) => {
  const [studentSearch, setStudentSearch] = useState("");
  if (vista !== 'Horario') return null;

  const filteredAlumnos = alumnos.filter(a => 
    a.nombre.toLowerCase().includes(studentSearch.toLowerCase()) ||
    (a.dni && a.dni.includes(studentSearch))
  );

  return (
    <div className="min-h-screen bg-ios-gray px-6 py-8 space-y-6 page-transition pb-24 relative pt-12 focus-mode-parent">
      <BackButton onClick={() => setVista('Dashboard')} />
      <header className="px-1">
        <h2 className="text-3xl font-bold text-black tracking-tight">Horarios y Grupos</h2>
        <p className="text-secondary text-sm font-medium mt-1">Gestión de tus clases y comisiones</p>
      </header>

      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">
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
              className="text-[10px] text-primary uppercase font-bold tracking-widest transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 shadow-ios border border-black/5 space-y-8">
          <div className="space-y-5">
            <div className="flex items-center gap-3 px-1">
              <span className="material-icons-outlined text-ios-blue text-lg">calendar_today</span>
              <h4 className="text-[10px] uppercase font-bold text-secondary tracking-widest">Días de Entrenamiento</h4>
            </div>
            <div className="flex justify-between items-center px-1 gap-2 overflow-x-auto no-scrollbar pb-1">
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
                  <div key={day.id} className="flex flex-col items-center gap-2 shrink-0">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedDays(prev => prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id])}
                      className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isSelected 
                          ? 'bg-ios-blue text-white shadow-lg scale-110' 
                          : 'bg-ios-gray text-secondary'
                      }`}
                    >
                      {day.id.split('-')[0]}
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <span className="material-icons-outlined text-ios-blue text-lg">edit_note</span>
                <h4 className="text-[10px] uppercase font-bold text-secondary tracking-widest">Información del Grupo</h4>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Nombre del Grupo</label>
                  <input 
                    type="text"
                    placeholder="Ej. Avanzados" 
                    value={newGroupName} 
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none border border-transparent focus:border-primary/20 transition-all font-medium"
                   />
                </div>
                
                <EditableDropdown 
                  label="Profesor"
                  value={newCoachName}
                  onChange={setNewCoachName}
                  options={profesoresList}
                  onAdd={handleAddProfesor}
                  onEdit={handleUpdateProfesor}
                  onDelete={(id) => {
                    const prof = profesoresList.find(p => p.id === id);
                    if (prof) handleDeleteProfesor(id, prof.nombre);
                  }}
                  placeholder="Seleccionar profesor..."
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <span className="material-icons-outlined text-ios-blue text-lg">watch_later</span>
                <h4 className="text-[10px] uppercase font-bold text-secondary tracking-widest">Franja Horaria</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[8px] uppercase font-bold text-secondary ml-1 tracking-widest">Hora Inicio</label>
                  <div className="relative">
                    <select 
                      value={startTime} 
                      onChange={(e) => setStartTime(e.target.value)} 
                      className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black appearance-none border border-transparent focus:border-primary/20 outline-none transition-all font-medium"
                    >
                      {timeIntervals.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="material-icons-outlined absolute right-4 top-1/2 -translate-y-1/2 text-secondary pointer-events-none text-sm">expand_more</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] uppercase font-bold text-secondary ml-1 tracking-widest">Hora Fin</label>
                  <div className="relative">
                    <select 
                      value={endTime} 
                      onChange={(e) => setEndTime(e.target.value)} 
                      className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black appearance-none border border-transparent focus:border-primary/20 outline-none transition-all font-medium"
                    >
                      {timeIntervals.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="material-icons-outlined absolute right-4 top-1/2 -translate-y-1/2 text-secondary pointer-events-none text-sm">expand_more</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={handleSaveGroup} 
            className="w-full py-5 rounded-[1.2rem] bg-ios-blue text-white font-bold shadow-lg flex items-center justify-center gap-2 text-sm"
          >
            <span className="material-icons-outlined text-lg">{editingGroup ? 'save' : 'add_circle'}</span>
            <span>{editingGroup ? 'Actualizar Configuración' : 'Crear Nuevo Grupo'}</span>
          </motion.button>

          {/* Selección de Alumnos (Base de Datos Global) */}
          <AnimatePresence>
            {editingGroup && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-8 border-t border-black/5 space-y-6 overflow-hidden"
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <span className="material-icons-outlined text-ios-blue text-lg">group_add</span>
                    <h4 className="text-[10px] uppercase font-bold text-secondary tracking-widest">Vincular Gimnastas</h4>
                  </div>
                  <div className="text-[10px] font-bold text-secondary px-3 py-1 bg-ios-gray rounded-full">
                    {alumnos.filter(a => a.grupo === editingGroup.nombre).length} Alumnas
                  </div>
                </div>

                <div className="relative group">
                  <span className="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-sm">search</span>
                  <input 
                    type="text"
                    placeholder="Buscar gimnasta..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full bg-ios-gray rounded-xl pl-12 pr-4 py-4 text-xs text-black outline-none border border-transparent focus:border-primary/20 transition-all font-medium"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto no-scrollbar space-y-2">
                  {filteredAlumnos.length > 0 ? filteredAlumnos.map(alumno => {
                    const isInThisGroup = alumno.grupo === editingGroup.nombre;
                    return (
                      <div 
                        key={alumno.id}
                        className={`flex items-center justify-between p-4 rounded-[1.2rem] border transition-all ${isInThisGroup ? 'bg-ios-blue/5 border-ios-blue/20' : 'bg-ios-gray border-transparent'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${isInThisGroup ? 'bg-ios-blue text-white' : 'bg-white text-secondary shadow-sm'}`}>
                            {alumno.nombre.charAt(0)}
                          </div>
                          <div>
                            <p className={`text-xs font-bold leading-tight ${isInThisGroup ? 'text-black' : 'text-secondary'}`}>{alumno.nombre}</p>
                            <p className="text-[8px] uppercase tracking-widest font-bold text-secondary/60 mt-0.5">
                              {isInThisGroup ? 'En este grupo' : alumno.grupo || 'Sin Comisión'}
                            </p>
                          </div>
                        </div>
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleUpdateStudentGroup(alumno.id!, isInThisGroup ? 'Sin Grupo' : editingGroup.nombre)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isInThisGroup ? 'bg-ios-red/10 text-ios-red' : 'bg-ios-blue/10 text-ios-blue'}`}
                        >
                          <span className="material-icons-outlined text-sm">
                            {isInThisGroup ? 'person_remove' : 'person_add'}
                          </span>
                        </motion.button>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8 text-secondary/30 space-y-1">
                      <span className="material-icons-outlined text-3xl">sentiment_dissatisfied</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest">Sin resultados</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <section className="space-y-4 pb-12">
        <div className="flex justify-between px-1">
          <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">Mis Grupos Activos</h3>
        </div>
        {grupos.length > 0 ? grupos.map((g, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-[2rem] p-6 shadow-ios border border-black/5 space-y-6"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-black text-xl tracking-tight leading-none">{g.nombre}</h4>
                  <span className="bg-ios-green/10 text-ios-green text-[8px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Online</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-secondary">
                    <span className="material-icons-outlined text-[14px]">schedule</span>
                    <span className="text-xs font-medium italic">{g.horario}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-secondary">
                    <span className="material-icons-outlined text-[14px]">groups</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {alumnos.filter(a => a.grupo === g.nombre).length} Gimnastas vinculadas
                    </span>
                  </div>
                  {g.entrenador && (
                    <div className="flex items-center gap-1.5 text-ios-blue mt-1">
                      <span className="material-icons-outlined text-[14px]">person</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Prof: {g.entrenador}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { 
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
                  className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:text-ios-blue transition-colors"
                >
                  <span className="material-icons-outlined text-lg">edit</span>
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDeleteGroup(g)}
                  className="w-10 h-10 rounded-full bg-ios-red/10 flex items-center justify-center text-ios-red"
                >
                  <span className="material-icons-outlined text-lg">delete</span>
                </motion.button>
              </div>
            </div>
            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={() => { setActiveGroup(g); setVista('AsistenciaLista'); }}
              className="w-full py-4 rounded-2xl bg-ios-gray border border-black/5 text-black font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:bg-ios-blue active:text-white"
            >
              <span className="material-icons-outlined text-lg">fact_check</span> 
              Control de Asistencia
            </motion.button>
          </motion.div>
        )) : (
          <div className="p-16 text-center bg-white rounded-[2.5rem] border border-dashed border-black/10 space-y-2">
            <span className="material-icons-outlined text-4xl text-secondary/20">event_busy</span>
            <p className="text-secondary text-xs font-bold uppercase tracking-widest">Sin grupos configurados</p>
          </div>
        )}
      </section>
    </div>
  );
};
