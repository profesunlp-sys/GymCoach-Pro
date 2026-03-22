import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Alumno, GrupoConfig, Skill, AsistenciaRecord, Feedback } from '../types';
import { Button } from '../App';
import Tooltip from './Tooltip';

interface AlumnosProps {
  vista: string;
  setVista: (v: any) => void;
  alumnos: Alumno[];
  grupos: GrupoConfig[];
  niveles: { id?: string; nombre: string }[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedGrupoFilter: string;
  setSelectedGrupoFilter: (g: string) => void;
  selectedNivelFilter: string;
  setSelectedNivelFilter: (n: string) => void;
  alumnosFilterMode: 'all' | 'alerts';
  setAlumnosFilterMode: (m: 'all' | 'alerts') => void;
  isAddingAlumno: boolean;
  setIsAddingAlumno: (b: boolean) => void;
  studentForm: Partial<Alumno>;
  setStudentForm: (f: Partial<Alumno>) => void;
  handleSaveStudent: () => void;
  handleDeleteStudent: (id: string) => void;
  selectedAlumno: Alumno | null;
  setSelectedAlumno: (a: Alumno | null) => void;
  alumnoAsistencias: AsistenciaRecord[];
  isLoadingAsistencias: boolean;
  isAddingSkill: boolean;
  setIsAddingSkill: (b: boolean) => void;
  newSkill: Partial<Skill>;
  setNewSkill: (s: Partial<Skill>) => void;
  handleSaveSkill: () => void;
  handleDeleteSkill: (id: string) => void;
  editingSkillId: string | null;
  setEditingSkillId: (id: string | null) => void;
  editingSkillData: Partial<Skill>;
  setEditingSkillData: (d: Partial<Skill>) => void;
  skillSearchQuery: string;
  setSkillSearchQuery: (q: string) => void;
  skillApparatusFilter: string;
  setSkillApparatusFilter: (f: string) => void;
  feedbacks: Feedback[];
  newFeedback: string;
  setNewFeedback: (f: string) => void;
  handleAddFeedback: () => void;
  handleDeleteFeedback: (id: string) => void;
  setIsBulkImporting: (b: boolean) => void;
  userRole: string;
}

const Alumnos: React.FC<AlumnosProps> = ({
  vista,
  setVista,
  alumnos,
  grupos,
  niveles,
  searchQuery,
  setSearchQuery,
  selectedGrupoFilter,
  setSelectedGrupoFilter,
  selectedNivelFilter,
  setSelectedNivelFilter,
  alumnosFilterMode,
  setAlumnosFilterMode,
  isAddingAlumno,
  setIsAddingAlumno,
  studentForm,
  setStudentForm,
  handleSaveStudent,
  handleDeleteStudent,
  selectedAlumno,
  setSelectedAlumno,
  alumnoAsistencias,
  isLoadingAsistencias,
  isAddingSkill,
  setIsAddingSkill,
  newSkill,
  setNewSkill,
  handleSaveSkill,
  handleDeleteSkill,
  editingSkillId,
  setEditingSkillId,
  editingSkillData,
  setEditingSkillData,
  skillSearchQuery,
  setSkillSearchQuery,
  skillApparatusFilter,
  setSkillApparatusFilter,
  feedbacks,
  newFeedback,
  setNewFeedback,
  handleAddFeedback,
  handleDeleteFeedback,
  setIsBulkImporting,
  userRole
}) => {
  if (vista !== 'Alumnos' && vista !== 'AlumnoDetalle') return null;

  const filteredAlumnos = alumnos
    .filter(a => alumnosFilterMode === 'alerts' ? (a.alertas && a.alertas.length > 0 && a.alertas[0] !== '') : true)
    .filter(a => selectedGrupoFilter === 'Todos' || a.grupo === selectedGrupoFilter)
    .filter(a => selectedNivelFilter === 'Todos' || a.nivel === selectedNivelFilter)
    .filter(a => a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || a.dni.includes(searchQuery));

  if (vista === 'Alumnos') {
    return (
      <div className="px-6 py-8 space-y-8 page-transition pb-24">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="title-antigravity text-3xl">
              {alumnosFilterMode === 'alerts' ? 'Obs. de Salud' : 'Gimnastas'}
            </h2>
            <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">
              {alumnosFilterMode === 'alerts' ? 'Gimnastas con Alertas Médicas' : `Base de Datos ${userRole === 'Coordinator' ? 'Global' : 'del Grupo'}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Total</p>
              <p className="text-2xl font-black text-white">{filteredAlumnos.length}</p>
            </div>
            {alumnosFilterMode === 'all' && (
              <div className="flex gap-2">
                <Tooltip text="Importación Masiva">
                  <Button 
                    onClick={() => setIsBulkImporting(true)}
                    variant="secondary"
                    className="w-10 h-10 !p-0 rounded-full"
                  >
                    <span className="material-icons-outlined text-sm">upload_file</span>
                  </Button>
                </Tooltip>
                <Tooltip text={isAddingAlumno ? 'Cerrar' : 'Nuevo Gimnasta'}>
                  <Button 
                    onClick={() => setIsAddingAlumno(!isAddingAlumno)}
                    variant={isAddingAlumno ? 'danger' : 'primary'}
                    className="w-10 h-10 !p-0 rounded-full"
                  >
                    <span className="material-icons-outlined text-sm">{isAddingAlumno ? 'close' : 'person_add'}</span>
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
        </header>

        {/* Filters and Search */}
        <div className="space-y-4">
          <div className="flex gap-2 p-1 bg-white/5 rounded-2xl">
            <button 
              onClick={() => setAlumnosFilterMode('all')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${alumnosFilterMode === 'all' ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'text-white/40 hover:text-white/60'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setAlumnosFilterMode('alerts')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${alumnosFilterMode === 'alerts' ? 'bg-rose-500 text-white shadow-neon-rose' : 'text-white/40 hover:text-white/60'}`}
            >
              Alertas
            </button>
          </div>

          <div className="relative group">
            <span className="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors">search</span>
            <input 
              type="text" 
              placeholder="Buscar por nombre o DNI..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-antigravity-charcoal border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white outline-none focus:border-primary/50 transition-all placeholder:text-white/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-bold text-white/40 ml-1">Grupo</label>
              <select 
                value={selectedGrupoFilter}
                onChange={(e) => setSelectedGrupoFilter(e.target.value)}
                className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-xs text-white appearance-none outline-none focus:border-primary/50 transition-all"
              >
                <option value="Todos">Todos los Grupos</option>
                {grupos.map(g => <option key={g.id} value={g.nombre}>{g.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-bold text-white/40 ml-1">Nivel</label>
              <select 
                value={selectedNivelFilter}
                onChange={(e) => setSelectedNivelFilter(e.target.value)}
                className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-xs text-white appearance-none outline-none focus:border-primary/50 transition-all"
              >
                <option value="Todos">Todos los Niveles</option>
                {niveles.map(n => <option key={n.id} value={n.nombre}>{n.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Add Alumno Form */}
        <AnimatePresence>
          {isAddingAlumno && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="glass-card rounded-[2rem] p-6 border border-primary/30 bg-primary/5 space-y-6">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Nuevo Gimnasta</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/60 ml-1">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={studentForm.nombre}
                      onChange={(e) => setStudentForm({ ...studentForm, nombre: e.target.value })}
                      className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all"
                      placeholder="Ej: Juan Perez"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/60 ml-1">DNI</label>
                      <input 
                        type="text" 
                        value={studentForm.dni}
                        onChange={(e) => setStudentForm({ ...studentForm, dni: e.target.value })}
                        className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all"
                        placeholder="Sin puntos"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/60 ml-1">Disciplina</label>
                      <select 
                        value={studentForm.disciplina}
                        onChange={(e) => setStudentForm({ ...studentForm, disciplina: e.target.value as any })}
                        className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all"
                      >
                        <option value="GAF">GAF</option>
                        <option value="GAM">GAM</option>
                        <option value="Trampolín">Trampolín</option>
                        <option value="Acrobática">Acrobática</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/60 ml-1">Grupo</label>
                      <select 
                        value={studentForm.grupo}
                        onChange={(e) => setStudentForm({ ...studentForm, grupo: e.target.value })}
                        className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all"
                      >
                        <option value="">Seleccionar...</option>
                        {grupos.map(g => <option key={g.id} value={g.nombre}>{g.nombre}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/60 ml-1">Nivel</label>
                      <select 
                        value={studentForm.nivel}
                        onChange={(e) => setStudentForm({ ...studentForm, nivel: e.target.value })}
                        className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all"
                      >
                        <option value="">Seleccionar...</option>
                        {niveles.map(n => <option key={n.id} value={n.nombre}>{n.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/60 ml-1">Alertas Médicas (Opcional)</label>
                    <textarea 
                      value={studentForm.alertas?.[0] || ''}
                      onChange={(e) => setStudentForm({ ...studentForm, alertas: [e.target.value] })}
                      className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all h-20"
                      placeholder="Alergias, asma, lesiones previas..."
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => setIsAddingAlumno(false)}
                    variant="secondary"
                    className="flex-1 py-4 rounded-2xl"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSaveStudent}
                    className="flex-1 py-4 rounded-2xl shadow-neon-cyan"
                  >
                    Guardar Gimnasta
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alumnos List */}
        <div className="space-y-3">
          {filteredAlumnos.length === 0 ? (
            <div className="text-center py-12 opacity-30">
              <span className="material-icons-outlined text-4xl mb-2">person_off</span>
              <p className="text-xs uppercase font-black tracking-widest">No se encontraron gimnastas</p>
            </div>
          ) : (
            filteredAlumnos.map((alumno, idx) => (
              <motion.div 
                key={alumno.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => { setSelectedAlumno(alumno); setVista('AlumnoDetalle'); }}
                className="glass-card rounded-2xl p-4 border border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer hover:border-primary/30"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/30 transition-colors">
                    <span className="text-xs font-black text-white/40 group-hover:text-primary">{alumno.nombre.charAt(0)}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{alumno.nombre}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/40">{alumno.grupo}</span>
                      <span className="w-1 h-1 rounded-full bg-white/10"></span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-primary/60">{alumno.nivel}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {alumno.alertas && alumno.alertas.length > 0 && alumno.alertas[0] !== '' && (
                    <div className="w-6 h-6 rounded-lg bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                      <span className="material-icons-outlined text-rose-500 text-[14px]">warning</span>
                    </div>
                  )}
                  <span className="material-icons-outlined text-white/20 group-hover:text-primary transition-colors">chevron_right</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (vista === 'AlumnoDetalle' && selectedAlumno) {
    return (
      <div className="min-h-screen bg-antigravity-black page-transition pb-24">
        {/* Header Hero */}
        <div className="relative h-64 bg-gradient-to-b from-primary/20 to-antigravity-black px-6 pt-12">
          <button 
            onClick={() => setVista('Alumnos')}
            className="w-10 h-10 rounded-full bg-antigravity-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white mb-6 active:scale-90 transition-all"
          >
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          
          <div className="flex items-end gap-6">
            <div className="w-24 h-24 rounded-3xl bg-antigravity-charcoal border-2 border-primary shadow-neon-cyan flex items-center justify-center relative overflow-hidden">
              <span className="text-4xl font-black text-primary/20 absolute inset-0 flex items-center justify-center select-none">{selectedAlumno.nombre.charAt(0)}</span>
              <span className="text-3xl font-black text-white relative z-10">{selectedAlumno.nombre.charAt(0)}</span>
            </div>
            <div className="pb-2 space-y-1">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{selectedAlumno.nombre}</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">{selectedAlumno.grupo}</span>
                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">{selectedAlumno.nivel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 -mt-6 space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card rounded-2xl p-4 border border-white/5 text-center space-y-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/40 block">Asistencia</span>
              <span className="text-lg font-black text-primary">85%</span>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-white/5 text-center space-y-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/40 block">Skills</span>
              <span className="text-lg font-black text-emerald-500">12</span>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-white/5 text-center space-y-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/40 block">Nivel</span>
              <span className="text-lg font-black text-amber-500">{selectedAlumno.nivel.split(' ')[1] || '1'}</span>
            </div>
          </div>

          {/* Alertas Médicas */}
          {selectedAlumno.alertas && selectedAlumno.alertas.length > 0 && selectedAlumno.alertas[0] !== '' && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30 shrink-0">
                <span className="material-icons-outlined text-rose-500">warning</span>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Observación Médica</h4>
                <p className="text-sm text-rose-200/80 leading-relaxed italic">"{selectedAlumno.alertas[0]}"</p>
              </div>
            </div>
          )}

          {/* Tabs Section */}
          <div className="space-y-6">
            <div className="flex border-b border-white/5">
              <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary border-b-2 border-primary">Progreso</button>
              <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/40">Asistencia</button>
              <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/40">Contacto</button>
            </div>

            {/* Skills Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Habilidades</h3>
                <Button 
                  onClick={() => setIsAddingSkill(true)}
                  className="!py-1.5 !px-3 !text-[8px]"
                >
                  Añadir Skill
                </Button>
              </div>

              {/* Skill Filters */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {['Todos', 'Suelo', 'Salto', 'Viga', 'Paralelas'].map(app => (
                  <button 
                    key={app}
                    onClick={() => setSkillApparatusFilter(app)}
                    className={`px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${skillApparatusFilter === app ? 'bg-primary text-antigravity-black' : 'bg-white/5 text-white/40'}`}
                  >
                    {app}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {selectedAlumno.skills?.filter(s => skillApparatusFilter === 'Todos' || s.apparatus === skillApparatusFilter).map((skill) => (
                  <div key={skill.id} className="glass-card rounded-2xl p-4 border border-white/5 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${skill.status === 'Logrado' ? 'bg-emerald-500 shadow-neon-emerald' : skill.status === 'En Proceso' ? 'bg-amber-500 shadow-neon-amber' : 'bg-white/20'}`}></div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{skill.name}</h4>
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">{skill.apparatus} • Nivel {skill.level}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingSkillId(skill.id);
                          setEditingSkillData(skill);
                          setIsAddingSkill(true);
                        }}
                        className="p-2 text-white/40 hover:text-primary transition-colors"
                      >
                        <span className="material-icons-outlined text-sm">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteSkill(skill.id)}
                        className="p-2 text-white/40 hover:text-rose-500 transition-colors"
                      >
                        <span className="material-icons-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-widest px-1">Observaciones del Coach</h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newFeedback}
                    onChange={(e) => setNewFeedback(e.target.value)}
                    placeholder="Escribir observación..."
                    className="flex-1 bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary/50 transition-all"
                  />
                  <Button onClick={handleAddFeedback} className="!px-4">
                    <span className="material-icons-outlined text-sm">send</span>
                  </Button>
                </div>
                <div className="space-y-3">
                  {feedbacks.map((f) => (
                    <div key={f.id} className="glass-card rounded-2xl p-4 border border-white/5 space-y-2 relative group">
                      <div className="flex justify-between items-start">
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">{f.date}</span>
                        <button 
                          onClick={() => handleDeleteFeedback(f.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-rose-500"
                        >
                          <span className="material-icons-outlined text-xs">delete</span>
                        </button>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed italic">"{f.content}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-8 border-t border-white/5">
              <button 
                onClick={() => handleDeleteStudent(selectedAlumno.id)}
                className="w-full py-4 rounded-2xl border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/5 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-icons-outlined text-sm">person_remove</span>
                Eliminar Gimnasta
              </button>
            </div>
          </div>
        </div>

        {/* Skill Modal */}
        {isAddingSkill && (
          <div className="fixed inset-0 z-[120] bg-antigravity-black/95 backdrop-blur-md flex items-center justify-center p-6">
            <div className="glass-card w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 space-y-6 animate-in zoom-in duration-300">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">{editingSkillId ? 'Editar Skill' : 'Añadir Skill'}</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/60 ml-1">Nombre de la Habilidad</label>
                  <input 
                    type="text" 
                    value={editingSkillId ? editingSkillData.name : newSkill.name}
                    onChange={(e) => editingSkillId ? setEditingSkillData({...editingSkillData, name: e.target.value}) : setNewSkill({...newSkill, name: e.target.value})}
                    className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/60 ml-1">Aparato</label>
                    <select 
                      value={editingSkillId ? editingSkillData.apparatus : newSkill.apparatus}
                      onChange={(e) => editingSkillId ? setEditingSkillData({...editingSkillData, apparatus: e.target.value as any}) : setNewSkill({...newSkill, apparatus: e.target.value as any})}
                      className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all"
                    >
                      <option value="Suelo">Suelo</option>
                      <option value="Salto">Salto</option>
                      <option value="Viga">Viga</option>
                      <option value="Paralelas">Paralelas</option>
                      <option value="Barra">Barra</option>
                      <option value="Anillas">Anillas</option>
                      <option value="Arzones">Arzones</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/60 ml-1">Estado</label>
                    <select 
                      value={editingSkillId ? editingSkillData.status : newSkill.status}
                      onChange={(e) => editingSkillId ? setEditingSkillData({...editingSkillData, status: e.target.value as any}) : setNewSkill({...newSkill, status: e.target.value as any})}
                      className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all"
                    >
                      <option value="No Iniciado">No Iniciado</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Logrado">Logrado</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={() => {
                    setIsAddingSkill(false);
                    setEditingSkillId(null);
                  }}
                  variant="secondary"
                  className="flex-1 py-4 rounded-2xl"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveSkill}
                  className="flex-1 py-4 rounded-2xl shadow-neon-cyan"
                >
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default Alumnos;
