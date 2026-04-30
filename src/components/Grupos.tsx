
import React, { useState } from 'react';
import { GrupoConfig, ViewMode, Alumno } from '../../types';
import { EditableDropdown, BackButton } from '../../App';
import { motion, AnimatePresence } from 'motion/react';

interface GruposProps {
  vista: ViewMode;
  setVista: (vista: ViewMode) => void;
  editingGroup: GrupoConfig | null;
  setEditingGroup: (group: GrupoConfig | null) => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  newCoachName: string;
  setNewCoachName: (name: string) => void;
  newGrupoDias: string;
  setNewGrupoDias: (dias: string) => void;
  newGrupoHorario: string;
  setNewGrupoHorario: (horario: string) => void;
  newGrupoRangoEdad: string;
  setNewGrupoRangoEdad: (rango: string) => void;
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
  newGrupoDias,
  setNewGrupoDias,
  newGrupoHorario,
  setNewGrupoHorario,
  newGrupoRangoEdad,
  setNewGrupoRangoEdad,
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
                setNewGrupoDias("");
                setNewGrupoHorario("");
                setNewGrupoRangoEdad("3 a 5 años");
              }}
              className="text-[10px] text-primary uppercase font-bold tracking-widest transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 shadow-ios border border-black/5 space-y-8">
          <div className="space-y-5">
            <div className="space-y-1">
              <EditableDropdown
                label="Nombre de la Profesor/a"
                options={profesoresList}
                value={newCoachName}
                onChange={setNewCoachName}
                onAdd={handleAddProfesor}
                onEdit={(oldId, newName) => handleUpdateProfesor(oldId, newName)}
                onDelete={(oldId) => handleDeleteProfesor(oldId, newCoachName)}
                placeholder="Seleccionar o añadir..."
              />
            </div>
            
            <div className="space-y-3">
               <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Días de la semana</label>
               <div className="flex gap-2">
                 {[
                   { l: 'Lu', v: 'Lu' },
                   { l: 'Ma', v: 'Ma' },
                   { l: 'Mi', v: 'Mi' },
                   { l: 'Ju', v: 'Ju' },
                   { l: 'Vi', v: 'Vi' },
                   { l: 'Sá', v: 'Sá' }
                 ].map(day => {
                   const isSelected = newGrupoDias.includes(day.v);
                   return (
                     <button
                       key={day.v}
                       type="button"
                       onClick={() => {
                         const currentDays = newGrupoDias.split(',').map(d => d.trim()).filter(Boolean);
                         let newDays = [...currentDays];
                         if (newDays.includes(day.v)) {
                           newDays = newDays.filter(d => d !== day.v);
                         } else {
                           newDays.push(day.v);
                         }
                         const order = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
                         newDays.sort((a,b) => order.indexOf(a) - order.indexOf(b));
                         setNewGrupoDias(newDays.join(', '));
                       }}
                       className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center transition-all ${isSelected ? 'bg-ios-blue text-white shadow-lg' : 'bg-ios-gray text-secondary hover:bg-black/5'}`}
                     >
                       {day.l}
                     </button>
                   );
                 })}
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Inicia</label>
                  <input 
                    type="time" 
                    className="w-full bg-ios-gray border-none rounded-2xl p-5 text-black placeholder:text-secondary/40 outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all text-sm font-bold font-mono"
                    value={newGrupoHorario.split(' a ')[0] || ''}
                    onChange={(e) => {
                      const end = newGrupoHorario.split(' a ')[1] || '';
                      setNewGrupoHorario(`${e.target.value}${end ? ' a ' + end : ''}`);
                    }}
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Finaliza</label>
                  <input 
                    type="time"
                    className="w-full bg-ios-gray border-none rounded-2xl p-5 text-black placeholder:text-secondary/40 outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all text-sm font-bold font-mono"
                    value={newGrupoHorario.split(' a ')[1] || ''}
                    onChange={(e) => {
                      const start = newGrupoHorario.split(' a ')[0] || '';
                      setNewGrupoHorario(`${start}${e.target.value ? ' a ' + e.target.value : ''}`);
                    }}
                  />
               </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">¿Qué edad tiene tu grupo?</label>
              <select
                className="w-full bg-ios-gray border-none rounded-2xl p-5 text-black placeholder:text-secondary/40 outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all font-bold appearance-none relative"
                value={newGrupoRangoEdad}
                onChange={(e) => setNewGrupoRangoEdad(e.target.value)}
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "1.5em" }}
              >
                <option value="3 a 5 años">3 a 5 años</option>
                <option value="6 a 9 años">6 a 9 años</option>
                <option value="10 a 15 años">10 a 15 años</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Nombre del Grupo</label>
              <input 
                placeholder="Ej: Nivel Inicial" 
                className="w-full bg-ios-gray border-none rounded-2xl p-5 text-black placeholder:text-secondary/40 outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all font-bold"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
          </div>

          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={handleSaveGroup} 
            className="w-full py-5 rounded-[1.2rem] bg-ios-blue text-white font-bold shadow-lg flex items-center justify-center gap-2 text-sm"
          >
            <span className="material-icons-outlined text-lg">{editingGroup ? 'save' : 'add_circle'}</span>
            <span>{editingGroup ? 'Guardar Cambios' : 'Crear y Continuar'}</span>
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
                    <span className="material-icons-outlined text-[14px]">child_care</span>
                    <span className="text-xs font-medium">Rango de edad: {g.rangoEdad || "No especificado"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-secondary">
                    <span className="material-icons-outlined text-[14px]">calendar_today</span>
                    <span className="text-xs font-medium">Días: {Array.isArray(g.dias) ? g.dias.join(', ') : g.dias}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-secondary">
                    <span className="material-icons-outlined text-[14px]">schedule</span>
                    <span className="text-xs font-medium">Horario: {g.horario}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-secondary">
                    <span className="material-icons-outlined text-[14px]">groups</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {alumnos.filter(a => (a.grupo || "").trim().toLowerCase() === (g.nombre || "").trim().toLowerCase()).length} Gimnastas vinculadas
                    </span>
                  </div>
                  {g.entrenador && (
                    <div className="flex items-center gap-1.5 text-ios-blue mt-1">
                      <span className="material-icons-outlined text-[14px]">person</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Profesora: {g.entrenador}</span>
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
                    setNewGrupoDias(Array.isArray(g.dias) ? g.dias.join(', ') : g.dias);
                    setNewGrupoHorario(g.horario);
                    setNewGrupoRangoEdad(g.rangoEdad || "3 a 5 años");
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
