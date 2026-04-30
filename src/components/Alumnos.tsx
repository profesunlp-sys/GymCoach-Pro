import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alumno, GrupoConfig, Skill, AsistenciaRecord, Feedback } from '../../types';
import { Button, EditableDropdown, Tooltip, BackButton } from '../../App';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

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
  selectedAgeFilter: string;
  setSelectedAgeFilter: (a: string) => void;
  selectedPhysicalFilter: string;
  setSelectedPhysicalFilter: (p: string) => void;
  alumnosFilterMode: 'all' | 'alerts' | 'myGroups';
  setAlumnosFilterMode: (m: 'all' | 'alerts' | 'myGroups') => void;
  currentCoachGroupsNames?: string[];
  currentUserName?: string;
  currentUserId?: string;
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
  handleUpdateFeedback: (id: string, text: string) => void;
  handleDeleteFeedback: (id: string) => void;
  setIsBulkImporting: (b: boolean) => void;
  userRole: string;
  handleSaveLevel: (name: string) => void;
  handleUpdateLevel: (id: string, name: string) => void;
  handleDeleteLevel: (id: string) => void;
  handleQuickSaveGroup: (name: string) => void;
  handleUpdateGroupQuick: (id: string, name: string) => void;
  handleDeleteGroup: (group: GrupoConfig) => void;
  handleUpdateSkill: () => void;
  handleToggleSkillFavorite: (skillId: string) => void;
  handleUpdateBiometrics: (alumnoId: string, biometria: any) => void;
  ageCategories: { id?: string; nombre: string }[];
  physicalCategories: { id?: string; nombre: string }[];
  handleSaveAgeCategory: (name: string) => void;
  handleUpdateAgeCategory: (id: string, name: string) => void;
  handleDeleteAgeCategory: (id: string) => void;
  handleSavePhysicalCategory: (name: string) => void;
  handleUpdatePhysicalCategory: (id: string, name: string) => void;
  handleDeletePhysicalCategory: (id: string) => void;
  disciplinas: { id?: string; nombre: string }[];
  handleSaveDisciplina: (name: string) => void;
  handleUpdateDisciplina: (id: string, nombre: string) => void;
  handleDeleteDisciplina: (id: string) => void;
  handleDeduplicateStudents: () => void;
  sendPaymentReminder?: (alumno: Alumno) => void;
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
  handleUpdateFeedback,
  handleDeleteFeedback,
  setIsBulkImporting,
  userRole,
  handleSaveLevel,
  handleUpdateLevel,
  handleDeleteLevel,
  handleQuickSaveGroup,
  handleUpdateGroupQuick,
  handleDeleteGroup,
  handleUpdateSkill,
  handleToggleSkillFavorite,
  selectedAgeFilter,
  setSelectedAgeFilter,
  selectedPhysicalFilter,
  setSelectedPhysicalFilter,
  handleUpdateBiometrics,
  ageCategories,
  physicalCategories,
  handleSaveAgeCategory,
  handleUpdateAgeCategory,
  handleDeleteAgeCategory,
  handleSavePhysicalCategory,
  handleUpdatePhysicalCategory,
  handleDeletePhysicalCategory,
  disciplinas,
  handleSaveDisciplina,
  handleUpdateDisciplina,
  handleDeleteDisciplina,
  handleDeduplicateStudents,
  sendPaymentReminder,
  currentCoachGroupsNames,
  currentUserName,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'Progreso' | 'Asistencia' | 'Bio' | 'Contacto' | 'Pagos'>('Progreso');
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [isEditingBiometrics, setIsEditingBiometrics] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const calculateAgeGroup = (birthDateStr?: string) => {
    if (!birthDateStr) return 'Desconocido';
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    if (age < 7) return ageCategories[0]?.nombre || 'Pre-Mini';
    if (age <= 8) return ageCategories[1]?.nombre || 'Mini';
    if (age <= 10) return ageCategories[2]?.nombre || 'Pre-Infantil';
    if (age <= 12) return ageCategories[3]?.nombre || 'Infantil';
    if (age <= 15) return ageCategories[4]?.nombre || 'Juvenil';
    return ageCategories[5]?.nombre || 'Mayor';
  };

  const getPhysicalScore = (biometria?: any) => {
    if (!biometria) return 0;
    const values = [biometria.fuerza, biometria.flexibilidad, biometria.tecnica, biometria.resistencia, biometria.coordinacion];
    return values.reduce((a, b) => a + (b || 0), 0) / values.length;
  };

  const getPhysicalCategory = (score: number) => {
    if (score >= 80) return physicalCategories[0]?.nombre || 'Elite';
    if (score >= 60) return physicalCategories[1]?.nombre || 'Bueno';
    if (score >= 40) return physicalCategories[2]?.nombre || 'Regular';
    return physicalCategories[3]?.nombre || 'Bajo';
  };

  if (vista !== 'Alumnos' && vista !== 'AlumnoDetalle') return null;

  const filteredAlumnos = alumnos.filter(a => {
    const query = searchQuery.toLowerCase().trim();
    if (query === "") {
      // Filtros estándar cuando no hay búsqueda
      if (alumnosFilterMode === 'alerts' && !(a.alertas && a.alertas.length > 0 && a.alertas[0] !== '')) return false;
      
      if (alumnosFilterMode === 'myGroups') {
        const belongsToMyGroups = currentCoachGroupsNames && currentCoachGroupsNames.some(gn => (gn || "").trim() === (a.grupo || "").trim());
        const isMyStudent = a.userId === currentUserId;
        
        if (!belongsToMyGroups && !isMyStudent) return false;
      }

      if (selectedGrupoFilter !== 'Todos' && (a.grupo || "").trim() !== selectedGrupoFilter.trim()) return false;
      if (selectedNivelFilter !== 'Todos' && (a.nivel || "").trim() !== selectedNivelFilter.trim()) return false;
      if (selectedAgeFilter !== 'Todos' && calculateAgeGroup(a.fechaNacimiento) !== selectedAgeFilter) return false;
      if (selectedPhysicalFilter !== 'Cualquiera' && getPhysicalCategory(getPhysicalScore(a.biometria)) !== selectedPhysicalFilter) return false;
      return true;
    }

    // Búsqueda inteligente (FUZZY / KEYWORDS)
    // 1. Match por DNI (si aplica)
    if (a.dni && a.dni.includes(query)) return true;

    // 2. Match por palabras clave en nombre
    const searchTerms = query.split(/\s+/).filter(t => t.length > 0);
    const studentName = a.nombre.toLowerCase();
    
    // El alumno coincide si TODAS las palabras de búsqueda están presentes en su nombre (en cualquier orden)
    return searchTerms.every(term => studentName.includes(term));
  });

  if (vista === 'Alumnos') {
    return (
      <div className="min-h-screen bg-ios-gray px-6 py-8 space-y-6 page-transition pb-24 relative pt-12 focus-mode-parent">
        <BackButton onClick={() => setVista('Dashboard')} />
        <header className="flex justify-between items-end px-1">
          <div>
            <h2 className="text-3xl font-bold text-black tracking-tight">
              {alumnosFilterMode === 'alerts' ? 'Salud y Alertas' : 'Gimnastas'}
            </h2>
            <p className="text-secondary text-sm font-medium mt-1">
              {alumnosFilterMode === 'alerts' ? 'Gimnastas con observaciones' : 'Listado general de alumnas'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Total</p>
              <p className="text-2xl font-bold text-black">{filteredAlumnos.length}</p>
            </div>
            {alumnosFilterMode === 'all' && (
              <div className="flex gap-2">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsBulkImporting(true)}
                  className="w-10 h-10 rounded-full bg-white shadow-sm border border-black/5 text-secondary flex items-center justify-center transition-all"
                >
                  <span className="material-icons-outlined text-lg">upload_file</span>
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDeduplicateStudents}
                  className="w-10 h-10 rounded-full bg-white shadow-sm border border-black/5 text-ios-red flex items-center justify-center transition-all"
                  title="Limpiar Duplicados"
                >
                  <span className="material-icons-outlined text-lg">cleaning_services</span>
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsAddingAlumno(!isAddingAlumno)}
                  className={`w-10 h-10 rounded-full shadow-sm border flex items-center justify-center transition-all ${isAddingAlumno ? 'bg-ios-red border-ios-red text-white' : 'bg-ios-blue border-ios-blue text-white'}`}
                >
                  <span className="material-icons-outlined text-lg">{isAddingAlumno ? 'close' : 'person_add'}</span>
                </motion.button>
              </div>
            )}
          </div>
        </header>

        {/* Filters and Search */}
        <div className="space-y-4">
          <div className="flex gap-1 p-1 bg-black/5 rounded-2xl">
            <button 
              onClick={() => setAlumnosFilterMode('all')}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${alumnosFilterMode === 'all' ? 'bg-white text-black shadow-sm' : 'text-secondary hover:text-black/60'}`}
            >
              Cualquiera
            </button>
            <button 
              onClick={() => setAlumnosFilterMode('alerts')}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${alumnosFilterMode === 'alerts' ? 'bg-ios-red text-white shadow-sm' : 'text-secondary hover:text-black/60'}`}
            >
              Alertas
            </button>
          </div>

          <div className="relative group">
            <span className="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors">search</span>
            <input 
              type="text" 
              placeholder="Buscar por nombre o DNI..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-transparent rounded-[1.2rem] pl-12 pr-4 py-4 text-sm text-black outline-none focus:border-primary/20 shadow-sm transition-all placeholder:text-secondary/50"
            />
          </div>
        </div>

        {/* Alumnos List */}
        <div className="space-y-3 pt-2">
          {filteredAlumnos.length === 0 ? (
            <div className="text-center py-16 text-secondary/40 space-y-2">
              <span className="material-icons-outlined text-5xl">person_off</span>
              <p className="text-xs font-bold uppercase tracking-widest">
                {selectedGrupoFilter !== 'Todos' ? "No hay alumnas registradas en este grupo" : "No se encontraron gimnastas"}
              </p>
            </div>
          ) : (
            filteredAlumnos.map((alumno, idx) => (
              <motion.div 
                key={alumno.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => { setSelectedAlumno(alumno); setVista('AlumnoDetalle'); }}
                className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-black/5 flex items-center justify-between group active:bg-ios-gray transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-ios-gray flex items-center justify-center">
                    <span className="text-sm font-bold text-secondary">{alumno.nombre.charAt(0)}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-black leading-tight">{alumno.nombre}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-tight">{alumno.grupo}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-black/10"></span>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-tight">{alumno.nivel}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {alumno.alertas && alumno.alertas.length > 0 && alumno.alertas[0] !== '' && (
                    <div className="w-7 h-7 rounded-full bg-ios-red/10 flex items-center justify-center border border-ios-red/10">
                      <span className="material-icons-outlined text-ios-red text-sm">warning</span>
                    </div>
                  )}
                  <span className="material-icons-outlined text-black/10 text-lg">chevron_right</span>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Filters Grid */}
        <div className="pt-6 border-t border-black/5 space-y-6 pb-40">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">Otros Filtros</h3>
           </div>
           
           <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <EditableDropdown 
                label="Grupo"
                value={selectedGrupoFilter === 'Todos' ? '' : selectedGrupoFilter}
                onChange={(val) => setSelectedGrupoFilter(val || 'Todos')}
                options={grupos}
                onAdd={handleQuickSaveGroup}
                onEdit={handleUpdateGroupQuick}
                onDelete={(id) => {
                  const g = grupos.find(group => group.id === id);
                  if (g) handleDeleteGroup(g);
                }}
                placeholder="Todos"
              />
              <EditableDropdown 
                label="Nivel"
                value={selectedNivelFilter === 'Todos' ? '' : selectedNivelFilter}
                onChange={(val) => setSelectedNivelFilter(val || 'Todos')}
                options={niveles}
                onAdd={handleSaveLevel}
                onEdit={handleUpdateLevel}
                onDelete={handleDeleteLevel}
                placeholder="Todos"
              />
              
              {ageCategories.length > 0 && (
                <EditableDropdown 
                  label="Categoría Edad"
                  value={selectedAgeFilter === 'Todos' ? '' : selectedAgeFilter}
                  onChange={(val) => setSelectedAgeFilter(val || 'Todos')}
                  options={ageCategories}
                  onAdd={handleSaveAgeCategory}
                  onEdit={handleUpdateAgeCategory}
                  onDelete={handleDeleteAgeCategory}
                  placeholder="Todas"
                />
              )}

              {physicalCategories.length > 0 && (
                <EditableDropdown 
                  label="Condición Física"
                  value={selectedPhysicalFilter === 'Cualquiera' ? '' : selectedPhysicalFilter}
                  onChange={(val) => setSelectedPhysicalFilter(val || 'Cualquiera')}
                  options={physicalCategories}
                  onAdd={handleSavePhysicalCategory}
                  onEdit={handleUpdatePhysicalCategory}
                  onDelete={handleDeletePhysicalCategory}
                  placeholder="Cualquiera"
                />
              )}
           </div>
        </div>

        {/* Add Alumno Form */}
        <AnimatePresence>
          {isAddingAlumno && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden fixed inset-x-0 bottom-0 z-50 px-6 pb-24 bg-gradient-to-t from-ios-gray via-ios-gray to-transparent pt-32"
            >
              <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl border border-black/5 space-y-4 max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <h3 className="text-xl font-bold text-black tracking-tight">{isEditingStudent ? 'Editar Perfil' : 'Nueva Gimnasta'}</h3>
                  <button 
                    onClick={() => {
                      setIsAddingAlumno(false);
                      setIsEditingStudent(false);
                    }}
                    className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary"
                  >
                    <span className="material-icons-outlined text-base">close</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 py-2">
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={studentForm.nombre || ''}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onChange={(e) => {
                        setStudentForm({ ...studentForm, nombre: e.target.value });
                        setShowSuggestions(true);
                      }}
                      className="w-full bg-ios-gray rounded-xl px-4 py-3 text-sm text-black outline-none border border-transparent focus:border-primary/20 transition-all font-medium"
                      placeholder="Ej: Sofía González"
                    />
                    {showSuggestions && studentForm.nombre && alumnos.filter(a => {
                      if (!a.nombre) return false;
                      const searchTerms = studentForm.nombre!.toLowerCase().trim().split(/\s+/);
                      const targetName = a.nombre.toLowerCase();
                      const matches = searchTerms.every(term => targetName.includes(term));
                      return matches && a.nombre !== studentForm.nombre;
                    }).length > 0 && (
                      <div className="absolute top-full mt-2 w-full bg-white border border-black/5 rounded-xl shadow-xl overflow-hidden z-[60] max-h-40 overflow-y-auto">
                        {alumnos.filter(a => {
                          if (!a.nombre) return false;
                          const searchTerms = studentForm.nombre!.toLowerCase().trim().split(/\s+/);
                          const targetName = a.nombre.toLowerCase();
                          const matches = searchTerms.every(term => targetName.includes(term));
                          return matches && a.nombre !== studentForm.nombre;
                        }).map(alumno => (
                          <div 
                            key={alumno.id}
                            className="px-4 py-2 hover:bg-ios-gray cursor-pointer border-b border-black/5 last:border-0 text-sm font-medium"
                            onMouseDown={() => {
                              setStudentForm(alumno);
                              setIsEditingStudent(true);
                              setShowSuggestions(false);
                            }}
                          >
                            {alumno.nombre}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">DNI / Documento</label>
                      <input 
                        type="text" 
                        value={studentForm.dni}
                        onChange={(e) => setStudentForm({ ...studentForm, dni: e.target.value })}
                        className="w-full bg-ios-gray rounded-xl px-4 py-3 text-sm text-black outline-none border border-transparent focus:border-primary/20 transition-all font-medium"
                        placeholder="Nro"
                      />
                    </div>
                    <EditableDropdown 
                      label="Disciplina"
                      value={studentForm.disciplina || ''}
                      onChange={(val) => setStudentForm({ ...studentForm, disciplina: (val as any) })}
                      options={disciplinas}
                      onAdd={handleSaveDisciplina}
                      onEdit={handleUpdateDisciplina}
                      onDelete={handleDeleteDisciplina}
                      placeholder="..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditableDropdown 
                      label="Grupo"
                      value={studentForm.grupo || ''}
                      onChange={(val) => setStudentForm({ ...studentForm, grupo: val })}
                      options={grupos}
                      onAdd={handleQuickSaveGroup}
                      onEdit={handleUpdateGroupQuick}
                      onDelete={(id) => {
                        const g = grupos.find(group => group.id === id);
                        if (g) handleDeleteGroup(g);
                      }}
                      placeholder="..."
                    />
                    <EditableDropdown 
                      label="Nivel"
                      value={studentForm.nivel || ''}
                      onChange={(val) => setStudentForm({ ...studentForm, nivel: val })}
                      options={niveles}
                      onAdd={handleSaveLevel}
                      onEdit={handleUpdateLevel}
                      onDelete={handleDeleteLevel}
                      placeholder="..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Observaciones Médicas</label>
                    <textarea 
                      value={studentForm.alertas?.[0] || ''}
                      onChange={(e) => setStudentForm({ ...studentForm, alertas: [e.target.value] })}
                      className="w-full bg-ios-gray rounded-xl px-4 py-3 text-sm text-black outline-none border border-transparent focus:border-primary/20 transition-all font-medium h-20"
                      placeholder="Alergias, asma..."
                    />
                  </div>
                </div>
                
                <div className="shrink-0 pt-2">
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      handleSaveStudent();
                      setIsEditingStudent(false);
                      setIsAddingAlumno(false);
                    }}
                    className="w-full py-4 rounded-full bg-ios-blue text-white text-sm font-bold shadow-lg"
                  >
                    {isEditingStudent ? 'Guardar Cambios' : 'Registrar Gimnasta'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (vista === 'AlumnoDetalle' && selectedAlumno) {
    return (
      <div className="min-h-screen bg-ios-gray page-transition pb-24 focus-mode-parent">
        <div className="relative bg-white px-6 pt-10 pb-4 shadow-sm border-b border-black/5">
          <BackButton onClick={() => setVista('Alumnos')} />
          
          <div className="flex items-start gap-4 mt-8">
            <div className="w-20 h-20 rounded-full bg-ios-gray border-4 border-white shadow-lg flex items-center justify-center relative overflow-hidden shrink-0">
               <span className="text-3xl font-bold text-primary">{selectedAlumno.nombre.charAt(0)}</span>
            </div>
            <div className="flex-1 flex justify-between items-start pt-1">
              <div className="space-y-0.5">
                <h2 className="text-2xl font-bold text-black tracking-tight leading-none truncate max-w-[180px]">{selectedAlumno.nombre}</h2>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 group cursor-pointer bg-ios-gray px-2 py-0.5 rounded-md text-[10px]" onClick={() => {
                    const groupNames = grupos.map(g => g.nombre);
                    const newGroup = prompt(`Cambiar grupo de ${selectedAlumno.nombre}.\nGrupos disponibles: ${groupNames.join(', ')}`, selectedAlumno.grupo);
                    if (newGroup && newGroup !== selectedAlumno.grupo && groupNames.includes(newGroup)) {
                      setStudentForm({ ...selectedAlumno, grupo: newGroup });
                      setTimeout(() => handleSaveStudent(), 100);
                    } else if (newGroup && !groupNames.includes(newGroup)) {
                      alert("El grupo ingresado no existe.");
                    }
                  }}>
                    <span className="font-bold text-primary hover:underline">{selectedAlumno.grupo || 'Sin Grupo'}</span>
                    <span className="material-icons-outlined text-[10px] text-primary/60">swap_horiz</span>
                  </div>
                  <div className="group cursor-pointer bg-ios-gray px-2 py-0.5 rounded-md text-[10px]" onClick={() => {
                    const levelNames = niveles.map(n => n.nombre);
                    const newLevel = prompt(`Cambiar nivel de ${selectedAlumno.nombre}.\nNiveles disponibles: ${levelNames.join(', ')}`, selectedAlumno.nivel);
                    if (newLevel && newLevel !== selectedAlumno.nivel && levelNames.includes(newLevel)) {
                        setStudentForm({ ...selectedAlumno, nivel: newLevel });
                        setTimeout(() => handleSaveStudent(), 100);
                    } else if (newLevel && !levelNames.includes(newLevel)) {
                        alert("El nivel ingresado no existe.");
                    }
                  }}>
                    <span className="font-bold text-secondary hover:underline">{selectedAlumno.nivel || 'Sin Nivel'}</span>
                    <span className="material-icons-outlined text-[10px] text-secondary/60">swap_horiz</span>
                  </div>
                </div>
              </div>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setStudentForm(selectedAlumno);
                  setIsEditingStudent(true);
                  setIsAddingAlumno(true);
                }}
                className="w-8 h-8 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:scale-90 transition-all z-50"
              >
                <span className="material-icons-outlined text-sm">edit</span>
              </motion.button>
            </div>
          </div>
        </div>

        <div className="px-6 space-y-4 pt-4 pb-12">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-3 shadow-sm border border-black/5 text-center space-y-0.5">
              <span className="text-[8px] font-bold uppercase tracking-widest text-secondary block">Asistencia</span>
              <span className="text-lg font-bold text-black">85%</span>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border border-black/5 text-center space-y-0.5">
              <span className="text-[8px] font-bold uppercase tracking-widest text-secondary block">Skills</span>
              <span className="text-lg font-bold text-ios-green">12</span>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border border-black/5 text-center space-y-0.5">
              <span className="text-[8px] font-bold uppercase tracking-widest text-secondary block">Nivel</span>
              <span className="text-lg font-bold text-ios-orange">{selectedAlumno.nivel?.split(' ')[1] || '1'}</span>
            </div>
          </div>

          {/* Alertas Médicas */}
          {selectedAlumno.alertas && selectedAlumno.alertas.length > 0 && selectedAlumno.alertas[0] !== '' && (
            <div className="bg-ios-red/10 border border-ios-red/10 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-ios-red/20 flex items-center justify-center border border-ios-red/10 shrink-0">
                <span className="material-icons-outlined text-sm text-ios-red">warning</span>
              </div>
              <div>
                <h4 className="text-[9px] font-bold uppercase tracking-widest text-ios-red mb-0.5">Observación Médica</h4>
                <p className="text-xs font-medium text-ios-red/80 leading-relaxed italic">"{selectedAlumno.alertas[0]}"</p>
              </div>
            </div>
          )}

          {/* Tabs Section */}
          <div className="space-y-4">
            <div className="flex border-b border-black/5 w-full">
              {['Progreso', 'Asistencia', 'Contacto', 'Pagos', 'Bio'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-widest text-center transition-all ${activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-secondary'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'Progreso' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                {/* Skills Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">Habilidades</h3>
                    <button 
                      onClick={() => setIsAddingSkill(true)}
                      className="text-primary text-[10px] font-bold uppercase tracking-widest"
                    >
                      + Añadir
                    </button>
                  </div>

                  {/* Skill Filters */}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {['Todos', 'Suelo', 'Salto', 'Viga', 'Paralelas'].map(app => (
                      <button 
                        key={app}
                        onClick={() => setSkillApparatusFilter(app)}
                        className={`px-5 py-2 rounded-full text-[10px] font-bold tracking-tight whitespace-nowrap transition-all ${skillApparatusFilter === app ? 'bg-primary text-white shadow-sm' : 'bg-white text-secondary border border-black/5'}`}
                      >
                        {app}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {selectedAlumno.habilidades?.filter((s: Skill) => skillApparatusFilter === 'Todos' || s.apparatus === skillApparatusFilter).map((skill: Skill) => (
                      <div key={skill.id} className="bg-white rounded-2xl p-5 shadow-sm border border-black/5 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${skill.status === 'Logrado' ? 'bg-ios-green shadow-sm shadow-ios-green' : skill.status === 'En Proceso' ? 'bg-ios-orange shadow-sm shadow-ios-orange' : 'bg-ios-gray'}`}></div>
                          <div>
                            <h4 className="text-sm font-bold text-black">{skill.name}</h4>
                            <span className="text-[10px] font-medium text-secondary uppercase tracking-tight">{skill.apparatus} • Nivel {skill.level}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setEditingSkillId(skill.id);
                              setEditingSkillData(skill);
                              setIsAddingSkill(true);
                            }}
                            className="w-8 h-8 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:scale-90 transition-all"
                          >
                            <span className="material-icons-outlined text-sm">edit</span>
                          </button>
                          <button 
                            onClick={() => handleDeleteSkill(skill.id)}
                            className="w-8 h-8 rounded-full bg-ios-red/10 flex items-center justify-center text-ios-red active:scale-90 transition-all"
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
                  <h3 className="text-xs font-bold text-secondary uppercase tracking-widest px-1">Observaciones del Coach</h3>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newFeedback}
                        onChange={(e) => setNewFeedback(e.target.value)}
                        placeholder="Escribir observación..."
                        className="flex-1 bg-white border border-black/5 rounded-2xl px-5 py-4 text-sm text-black outline-none focus:border-primary/20 shadow-sm transition-all"
                      />
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={handleAddFeedback} 
                        className="w-14 h-14 bg-ios-blue text-white rounded-2xl flex items-center justify-center shadow-lg"
                      >
                        <span className="material-icons-outlined">send</span>
                      </motion.button>
                    </div>
                    <div className="space-y-3">
                      {feedbacks.map((f) => (
                        <div key={f.id} className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-black/5 space-y-2 relative group">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{new Date(f.timestamp).toLocaleDateString()}</span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  const newText = prompt("Editar observación:", f.text);
                                  if (newText && newText.trim() && newText !== f.text) {
                                    handleUpdateFeedback(f.id!, newText.trim());
                                  }
                                }}
                                className="w-8 h-8 rounded-full bg-ios-gray flex items-center justify-center text-secondary"
                              >
                                <span className="material-icons-outlined text-xs">edit</span>
                              </button>
                              <button 
                                onClick={() => handleDeleteFeedback(f.id!)}
                                className="w-8 h-8 rounded-full bg-ios-red/10 flex items-center justify-center text-ios-red"
                              >
                                <span className="material-icons-outlined text-xs">delete</span>
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-black/80 leading-relaxed italic">"{f.text}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Asistencia' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest px-1">Historial de Asistencia</h3>
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 divide-y divide-black/5 overflow-hidden">
                  {isLoadingAsistencias ? (
                    <div className="p-10 text-center text-secondary italic">Cargando asistencias...</div>
                  ) : alumnoAsistencias.length > 0 ? (
                    alumnoAsistencias.map((a, idx) => (
                      <div key={idx} className="p-5 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${a.presente ? 'bg-ios-green/10 text-ios-green' : 'bg-ios-red/10 text-ios-red'}`}>
                            <span className="material-icons-outlined text-xl">{a.presente ? 'check_circle' : 'cancel'}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-black">{new Date(a.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            <p className="text-[10px] text-secondary font-medium uppercase tracking-tight">{a.grupo}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${a.presente ? 'text-ios-green' : 'text-ios-red'}`}>
                          {a.presente ? 'Presente' : 'Ausente'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center text-secondary text-sm italic">No hay registros de asistencia.</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Bio' && selectedAlumno.biometria && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">Biometría Radar</h3>
                  <button 
                    onClick={() => {
                      if (isEditingBiometrics) {
                        handleUpdateBiometrics(selectedAlumno.id!, selectedAlumno.biometria);
                      }
                      setIsEditingBiometrics(!isEditingBiometrics);
                    }}
                    className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-all ${isEditingBiometrics ? 'bg-ios-green text-white shadow-sm' : 'bg-ios-gray text-secondary'}`}
                  >
                    {isEditingBiometrics ? 'Guardar Cambios' : 'Editar Valores'}
                  </button>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-ios border border-black/5 flex flex-col items-center">
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                        { subject: 'Fuerza', A: selectedAlumno.biometria.fuerza, fullMark: 100 },
                        { subject: 'Flex', A: selectedAlumno.biometria.flexibilidad, fullMark: 100 },
                        { subject: 'Técnica', A: selectedAlumno.biometria.tecnica, fullMark: 100 },
                        { subject: 'Resist', A: selectedAlumno.biometria.resistencia, fullMark: 100 },
                        { subject: 'Coord', A: selectedAlumno.biometria.coordinacion, fullMark: 100 },
                      ]}>
                        <PolarGrid stroke="#00000010" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#6E6E73', fontSize: 10, fontWeight: 700 }} />
                        <Radar
                          name={selectedAlumno.nombre}
                          dataKey="A"
                          stroke="#007AFF"
                          fill="#007AFF"
                          fillOpacity={0.15}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary block mb-1">Score Físico General</span>
                    <span className={`text-4xl font-bold ${
                      getPhysicalScore(selectedAlumno.biometria) >= 80 ? 'text-ios-green' :
                      getPhysicalScore(selectedAlumno.biometria) >= 60 ? 'text-ios-blue' :
                      'text-ios-orange'
                    }`}>
                      {Math.round(getPhysicalScore(selectedAlumno.biometria))}%
                    </span>
                  </div>
                </div>

                {isEditingBiometrics && (
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5 space-y-6">
                    {(['fuerza', 'flexibilidad', 'tecnica', 'resistencia', 'coordinacion'] as const).map((key) => (
                      <div key={key} className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-black uppercase tracking-widest capitalize">{key}</label>
                          <span className="text-sm font-bold text-primary">{selectedAlumno.biometria![key]}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="100" step="5"
                          value={selectedAlumno.biometria![key]}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            handleUpdateBiometrics(selectedAlumno.id!, { ...selectedAlumno.biometria, [key]: val });
                          }}
                          className="w-full accent-ios-blue h-1.5 bg-ios-gray rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Contacto' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest px-1">Información de Contacto</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 space-y-6">
                    <div className="flex items-center gap-3 text-primary border-b border-black/5 pb-3">
                      <span className="material-icons-outlined">family_restroom</span>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">Familia y Emergencia</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-4 divide-y divide-black/5">
                      {selectedAlumno.contacto?.padreNombre && (
                        <div className="pt-4 first:pt-0 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] text-secondary uppercase font-bold tracking-widest">Padre / Tutor</p>
                            <p className="text-sm text-black font-bold">{selectedAlumno.contacto.padreNombre}</p>
                            <p className="text-xs text-secondary">{selectedAlumno.contacto.padreTelefono}</p>
                          </div>
                          <a href={`tel:${selectedAlumno.contacto.padreTelefono}`} className="w-10 h-10 rounded-full bg-ios-blue/10 text-ios-blue flex items-center justify-center">
                            <span className="material-icons-outlined text-sm">phone</span>
                          </a>
                        </div>
                      )}
                      {selectedAlumno.contacto?.madreNombre && (
                        <div className="pt-4 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] text-secondary uppercase font-bold tracking-widest">Madre / Tutor</p>
                            <p className="text-sm text-black font-bold">{selectedAlumno.contacto.madreNombre}</p>
                            <p className="text-xs text-secondary">{selectedAlumno.contacto.madreTelefono}</p>
                          </div>
                          <a href={`tel:${selectedAlumno.contacto.madreTelefono}`} className="w-10 h-10 rounded-full bg-ios-blue/10 text-ios-blue flex items-center justify-center">
                            <span className="material-icons-outlined text-sm">phone</span>
                          </a>
                        </div>
                      )}
                      {selectedAlumno.contacto?.emergenciaNombre && (
                        <div className="pt-4 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] text-ios-red uppercase font-bold tracking-widest">Emergencia</p>
                            <p className="text-sm text-black font-bold">{selectedAlumno.contacto.emergenciaNombre}</p>
                            <p className="text-xs text-ios-red font-bold">{selectedAlumno.contacto.emergenciaTelefono}</p>
                          </div>
                          <a href={`tel:${selectedAlumno.contacto.emergenciaTelefono}`} className="w-10 h-10 rounded-full bg-ios-red text-white flex items-center justify-center shadow-sm">
                            <span className="material-icons-outlined text-sm">phone_locked</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 space-y-4">
                    <div className="flex items-center gap-3 text-secondary border-b border-black/5 pb-3">
                      <span className="material-icons-outlined">info</span>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">Datos Administrativos</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] text-secondary uppercase font-bold tracking-widest">DNI / Documento</p>
                        <p className="text-sm text-black font-bold">{selectedAlumno.dni}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] text-secondary uppercase font-bold tracking-widest">Fecha Ingreso</p>
                        <p className="text-sm text-black font-bold">{new Date(selectedAlumno.fechaIngreso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Pagos' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">Historial de Pagos</h3>
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${selectedAlumno.pagoVencido ? 'bg-ios-red text-white' : 'bg-ios-green text-white'}`}>
                    {selectedAlumno.pagoVencido ? 'Pago Vencido' : 'Al Día'}
                  </span>
                </div>
                <div className="bg-white rounded-[2.5rem] p-6 shadow-ios border border-black/5 space-y-4">
                  <div className="space-y-3">
                    {selectedAlumno.pagosMensuales && selectedAlumno.pagosMensuales.length > 0 ? (
                      [...selectedAlumno.pagosMensuales].sort((a,b) => b.anio !== a.anio ? b.anio - a.anio : 0).map((pago, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-ios-gray rounded-2xl">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                              <span className="material-icons-outlined text-ios-blue">receipt_long</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-black uppercase leading-tight">{pago.mes} {pago.anio}</p>
                              <p className="text-[10px] text-secondary font-medium tracking-tight mt-0.5">Pagado el {new Date(pago.fechaPago).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className="material-icons-outlined text-ios-green">check_circle</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center text-secondary text-sm italic">No hay registros de pagos mensuales.</div>
                    )}
                  </div>
                  
                  {selectedAlumno.pagoVencido && sendPaymentReminder && (
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => sendPaymentReminder(selectedAlumno)}
                      className="w-full py-5 rounded-[1.2rem] bg-ios-blue text-white text-sm font-bold shadow-lg flex items-center justify-center gap-2 mt-4"
                    >
                      <span className="material-icons-outlined text-lg">notifications_active</span>
                      Enviar Recordatorio WhatsApp
                    </motion.button>
                  )}
                </div>
              </div>
            )}

            {/* Danger Zone */}
            <div className="pt-12">
               <button 
                onClick={() => handleDeleteStudent(selectedAlumno.id!)}
                className="w-full py-4 rounded-2xl bg-white border border-ios-red/20 text-ios-red text-xs font-bold uppercase tracking-widest active:bg-ios-red active:text-white transition-all flex items-center justify-center gap-2"
               >
                <span className="material-icons-outlined text-lg">person_remove</span>
                Eliminar del Sistema
               </button>
            </div>
          </div>
        </div>

        {/* Skill Modal */}
        {isAddingSkill && (
          <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-end justify-center">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              className="bg-white w-full max-w-sm rounded-t-[2.5rem] p-8 pb-12 shadow-2xl border-t border-black/5 space-y-8"
            >
              <div className="flex justify-between items-center">
                 <h3 className="text-2xl font-bold text-black tracking-tight">{editingSkillId ? 'Editar Habilidad' : 'Nueva Habilidad'}</h3>
                 <button onClick={() => { setIsAddingSkill(false); setEditingSkillId(null); }} className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary">
                    <span className="material-icons-outlined">close</span>
                 </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Nombre de la Habilidad</label>
                  <input 
                    type="text" 
                    value={editingSkillId ? editingSkillData.name : newSkill.name}
                    onChange={(e) => editingSkillId ? setEditingSkillData({...editingSkillData, name: e.target.value}) : setNewSkill({...newSkill, name: e.target.value})}
                    placeholder="Ej: Salto Mortal"
                    className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none font-medium border border-transparent focus:border-primary/20 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Aparato</label>
                    <select 
                      value={editingSkillId ? editingSkillData.apparatus : newSkill.apparatus}
                      onChange={(e) => editingSkillId ? setEditingSkillData({...editingSkillData, apparatus: e.target.value as any}) : setNewSkill({...newSkill, apparatus: e.target.value as any})}
                      className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none font-medium appearance-none"
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
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Estado</label>
                    <select 
                      value={editingSkillId ? editingSkillData.status : newSkill.status}
                      onChange={(e) => editingSkillId ? setEditingSkillData({...editingSkillData, status: e.target.value as any}) : setNewSkill({...newSkill, status: e.target.value as any})}
                      className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none font-medium appearance-none"
                    >
                      <option value="No Iniciado">No Iniciado</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Logrado">Logrado</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSaveSkill}
                  className="flex-1 py-5 rounded-[1.2rem] bg-ios-blue text-white text-sm font-bold shadow-lg"
                >
                  Guardar Habilidad
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default Alumnos;
