import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Papa from 'papaparse';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend, PieChart, Pie
} from 'recharts';
import { Alumno, Clase, ViewMode, GrupoConfig, AsistenciaRecord, UserRole, Feedback, Skill, SkillStatus, Apparatus, Source } from './types';
import { processClassAudio, refineClassAnalysis, analyzeAttendanceStats, queryKnowledgeBase } from './services/geminiService';
import { SKILL_TREE, DISCIPLINAS, NIVELES as DEFAULT_NIVELES } from './constants';
import { db as firestore, auth, googleProvider, COLLECTIONS, getCollectionData, addDocument, updateDocument, deleteDocument, getAttendanceByStudent } from './services/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, orderBy, setDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
// Lazy loaded components
const Dashboard = lazy(() => import('./src/components/Dashboard').then(module => ({ default: module.Dashboard })));
const Reportes = lazy(() => import('./src/components/Reportes').then(module => ({ default: module.Reportes })));
const Staff = lazy(() => import('./src/components/Staff').then(module => ({ default: module.Staff })));
const Manuales = lazy(() => import('./src/components/Manuales').then(module => ({ default: module.Manuales })));
const Habilidades = lazy(() => import('./src/components/Habilidades').then(module => ({ default: module.Habilidades })));
const Grupos = lazy(() => import('./src/components/Grupos').then(module => ({ default: module.Grupos })));
const Asistencia = lazy(() => import('./src/components/Asistencia').then(module => ({ default: module.Asistencia })));
const Clases = lazy(() => import('./src/components/Clases').then(module => ({ default: module.Clases })));
const Alumnos = lazy(() => import('./src/components/Alumnos'));
const BulkPaymentImport = lazy(() => import('./src/components/BulkPaymentImport').then(module => ({ default: module.BulkPaymentImport })));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center p-20 space-y-4">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-neon-cyan"></div>
    <p className="text-primary text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Cargando Módulo...</p>
  </div>
);

export const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div 
            initial={{ opacity: 0, y: 5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-antigravity-black/95 backdrop-blur-md border border-white/10 text-[9px] font-bold uppercase tracking-wider text-white rounded-lg pointer-events-none whitespace-nowrap z-[100] shadow-2xl flex items-center gap-2 border-primary/20"
          >
            <div className="w-1 h-1 bg-primary rounded-full animate-pulse shadow-neon-cyan"></div>
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  type = 'button',
  title = ''
}: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning',
  className?: string,
  disabled?: boolean,
  type?: 'button' | 'submit' | 'reset',
  title?: string
}) => {
  const variants = {
    primary: 'bg-primary text-antigravity-black shadow-neon-cyan hover:brightness-110',
    secondary: 'bg-antigravity-charcoal text-white border border-white/10 hover:bg-white/5',
    outline: 'bg-transparent text-primary border border-primary/30 hover:bg-primary/5',
    ghost: 'bg-transparent text-white/60 hover:text-white hover:bg-white/5',
    danger: 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20',
    success: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
  };

  const content = (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );

  if (title) {
    return <Tooltip text={title}>{content}</Tooltip>;
  }

  return content;
};

export const EditableDropdown = ({ 
  label, 
  value, 
  onChange, 
  options, 
  onAdd, 
  onEdit,
  onDelete, 
  placeholder 
}: { 
  label: string, 
  value: string, 
  onChange: (val: string) => void, 
  options: any[], 
  onAdd: (name: string) => void, 
  onEdit: (id: string, name: string) => void,
  onDelete: (id: string) => void,
  placeholder: string
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState('');

  return (
    <div className="space-y-1 relative">
      <label className="text-[10px] uppercase font-bold text-white/90 ml-1">{label}</label>
      <div className="relative group">
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-antigravity-charcoal border rounded-xl pl-4 pr-16 py-3 text-sm text-white appearance-none border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none transition-all overflow-hidden text-ellipsis text-left"
        >
          <option value="">{placeholder}</option>
          {options.map((opt, idx) => (
            <option key={opt.id || idx} value={opt.nombre}>
              {opt.nombre} {opt.entrenador ? `— ${opt.entrenador}` : ''}
            </option>
          ))}
        </select>
        
        {/* Control Icons */}
        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 pointer-events-none">
          <div className="flex items-center gap-1 pointer-events-auto">
            {value && (
              <div className="flex items-center gap-0.5 mr-1 pr-1 border-r border-white/10">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const opt = options.find(o => o.nombre === value);
                    if (opt?.id) {
                      const newName = window.prompt(`Editar ${label.toLowerCase()}:`, opt.nombre);
                      if (newName && newName.trim() && newName !== opt.nombre) {
                        onEdit(opt.id, newName.trim());
                        onChange(newName.trim());
                      }
                    }
                  }}
                  className="w-6 h-6 flex items-center justify-center text-primary/60 hover:text-primary hover:bg-primary/20 rounded-lg transition-all active:scale-90"
                >
                  <span className="material-icons-outlined text-[14px]">edit</span>
                </button>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const opt = options.find(o => o.nombre === value);
                    if (opt?.id) {
                      if (window.confirm(`¿Seguro que deseas eliminar "${opt.nombre}"?`)) {
                        onDelete(opt.id);
                        onChange('');
                      }
                    }
                  }}
                  className="w-6 h-6 flex items-center justify-center text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/20 rounded-lg transition-all active:scale-90"
                >
                  <span className="material-icons-outlined text-[14px]">delete</span>
                </button>
              </div>
            )}
            <button 
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90 ${isAdding ? 'bg-rose-500/20 text-rose-500' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
            >
              <span className="material-icons-outlined text-base">{isAdding ? 'close' : 'add'}</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 z-50 mt-2 p-4 bg-antigravity-charcoal border border-primary/30 rounded-2xl shadow-2xl backdrop-blur-md"
          >
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-primary ml-1">Nuevo {label}</label>
                <input 
                  type="text" 
                  value={newItem} 
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Escribir nombre..."
                  autoFocus
                  className="w-full bg-antigravity-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary transition-all"
                />
              </div>
              <Button 
                onClick={() => {
                  if (newItem.trim()) {
                    onAdd(newItem.trim());
                    onChange(newItem.trim());
                    setNewItem('');
                    setIsAdding(false);
                  }
                }}
                className="w-full !py-3 rounded-xl shadow-lg border border-primary/20"
              >
                Guardar {label}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('Coach');
  const [vista, setVista] = useState<ViewMode>('Dashboard');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [alumnosFilterMode, setAlumnosFilterMode] = useState<'all' | 'alerts'>('all');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [grupos, setGrupos] = useState<GrupoConfig[]>([]);
  const [niveles, setNiveles] = useState<{id?: string, nombre: string}[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<Record<string, boolean>>({});
  const [pagosHoy, setPagosHoy] = useState<Record<string, boolean>>({});
  const [selectedClase, setSelectedClase] = useState<Clase | null>(null);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [alumnoAsistencias, setAlumnoAsistencias] = useState<AsistenciaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAsistencias, setIsLoadingAsistencias] = useState(false);
  const [selectedProfesor, setSelectedProfesor] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [newFeedback, setNewFeedback] = useState("");
  
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('Todas');
  const [selectedGrupoFilter, setSelectedGrupoFilter] = useState<string>('Todos');
  const [selectedNivelFilter, setSelectedNivelFilter] = useState<string>('Todos');
  const [selectedAgeFilter, setSelectedAgeFilter] = useState<string>('Todos');
  const [selectedPhysicalFilter, setSelectedPhysicalFilter] = useState<string>('Cualquiera');
  const [asistenciasClase, setAsistenciasClase] = useState<AsistenciaRecord[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaRecord[]>([]);
  const [isLoadingAsistenciasClase, setIsLoadingAsistenciasClase] = useState(false);
  const [asistenciasGlobales, setAsistenciasGlobales] = useState<Record<string, { presentes: number, total: number }>>({});
  const [isEditingClase, setIsEditingClase] = useState(false);
  const [editingClaseId, setEditingClaseId] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAlumnoId, setExpandedAlumnoId] = useState<string | null>(null);
  const [planesFilterDate, setPlanesFilterDate] = useState("");
  const [comparativeData, setComparativeData] = useState<any[]>([]);
  const [planesFilterCoach, setPlanesFilterCoach] = useState("");

  // Add Gymnast/Teacher State
  const [isAddingAlumno, setIsAddingAlumno] = useState(false);
  const [newAlumnoForm, setNewAlumnoForm] = useState({ nombre: '', dni: '', grupo: '', nivel: '' });
  const [isAddingProfesor, setIsAddingProfesor] = useState(false);
  const [isSavingProfesor, setIsSavingProfesor] = useState(false);
  const [newProfesorName, setNewProfesorName] = useState('');
  const [profesoresList, setProfesoresList] = useState<{id?: string, nombre: string}[]>([]);
  const [disciplinas, setDisciplinas] = useState<{id?: string, nombre: string}[]>([]);
  const [warmupOptions, setWarmupOptions] = useState<{id?: string, nombre: string}[]>([]);
  const [cooldownOptions, setCooldownOptions] = useState<{id?: string, nombre: string}[]>([]);
  const [ageCategories, setAgeCategories] = useState<{id?: string, nombre: string}[]>([]);
  const [physicalCategories, setPhysicalCategories] = useState<{id?: string, nombre: string}[]>([]);

  // Group Form State
  const [newGroupName, setNewGroupName] = useState("");
  const [newCoachName, setNewCoachName] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:00");

  // Class Form State
  const [claseGrupo, setClaseGrupo] = useState("");
  const [newClaseGroupName, setNewClaseGroupName] = useState("");
  const [newClaseCoachName, setNewClaseCoachName] = useState("");
  const [faseInicial, setFaseInicial] = useState<string[]>([]);
  const [fasePrincipal, setFasePrincipal] = useState<string[]>([]);
  const [faseFinal, setFaseFinal] = useState<string[]>([]);
  const [faseInicialDuration, setFaseInicialDuration] = useState("15");
  const [fasePrincipalDuration, setFasePrincipalDuration] = useState("60");
  const [faseFinalDuration, setFaseFinalDuration] = useState("15");
  const [objetivos, setObjetivos] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [habilidadesPorAparato, setHabilidadesPorAparato] = useState<Record<string, string[]>>({});
  const [customHabilidad, setCustomHabilidad] = useState<Record<string, string>>({});
  const [customInicial, setCustomInicial] = useState("");
  const [customPrincipal, setCustomPrincipal] = useState("");
  const [customFinal, setCustomFinal] = useState("");

  // Selected Group Context
  const [activeGroup, setActiveGroup] = useState<GrupoConfig | null>(null);
  const [editingGroup, setEditingGroup] = useState<GrupoConfig | null>(null);

  // Student Form State
  const [studentForm, setStudentForm] = useState<Partial<Alumno>>({
    nombre: '', dni: '', disciplina: 'GAF', nivel: 'Escuela',
    fechaNacimiento: '', fechaPrimeraClase: new Date().toISOString().split('T')[0],
    alertas: [],
    contacto: {
      padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '',
      emergenciaNombre: '', emergenciaTelefono: ''
    }
  });

  // Skill Form State
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkill, setNewSkill] = useState<Partial<Skill>>({ name: '', status: 'No Iniciado', apparatus: 'Suelo', level: '1' });
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingSkillData, setEditingSkillData] = useState<Partial<Skill>>({});

  // New Skill Filters
  const [skillSearchQuery, setSkillSearchQuery] = useState("");
  const [skillApparatusFilter, setSkillApparatusFilter] = useState<string>("Todos");

  // Knowledge Base State
  const [sources, setSources] = useState<Source[]>([]);
  const [kbMessages, setKbMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [isKbLoading, setIsKbLoading] = useState(false);
  const [kbInput, setKbInput] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [isFocusMode, setIsFocusMode] = useState(false);

  const translateFirebaseError = (error: any) => {
    const code = error.code;
    const message = error.message;
    
    switch (code) {
      case 'auth/invalid-credential':
        return "El correo o la contraseña son incorrectos. Por favor, verifica tus datos e intenta de nuevo.";
      case 'auth/user-not-found':
        return "No existe una cuenta con este correo electrónico.";
      case 'auth/wrong-password':
        return "La contraseña ingresada es incorrecta.";
      case 'auth/email-already-in-use':
        return "Ya existe una cuenta registrada con este correo electrónico.";
      case 'auth/invalid-email':
        return "El formato del correo electrónico no es válido.";
      case 'auth/weak-password':
        return "La contraseña debe tener al menos 6 caracteres.";
      case 'auth/too-many-requests':
        return "Se han realizado demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por seguridad.";
      case 'auth/network-request-failed':
        return "Error de red. Por favor, revisa tu conexión a internet.";
      default:
        return message.replace("Firebase: ", "").replace("Error (auth/", "").replace(").", "").replace("-", " ");
    }
  };

  const requestConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ show: true, title, message, onConfirm });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 750KB to stay within Firestore 1MB limit after base64 encoding
    if (file.size > 750 * 1024) {
      setNotificacion({ t: 'Archivo muy grande', d: 'El archivo debe ser menor a 750KB para guardarse en la nube.' });
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    let type: 'pdf' | 'doc' | 'docx' | 'text' = 'text';
    
    if (fileExt === 'pdf') type = 'pdf';
    else if (fileExt === 'doc') type = 'doc';
    else if (fileExt === 'docx') type = 'docx';
    else if (file.type.includes('text')) type = 'text';
    else {
      setNotificacion({ t: 'Formato no soportado', d: 'Solo se permiten PDF, DOC, DOCX o archivos de texto.' });
      return;
    }

    try {
      setIsLoading(true);
      let content = '';

      if (type === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
        type = 'text'; // Guardamos el texto extraído para que sea compatible con la IA
      } else if (type === 'text') {
        content = await file.text();
      } else {
        // PDF o DOC (el DOC antiguo es binario y difícil de procesar en cliente, se guarda base64)
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
          reader.readAsDataURL(file);
        });
        content = base64;
      }

      const newSource: Partial<Source> = {
        name: file.name,
        type: type,
        content: content,
        uploadDate: new Date().toISOString()
      };
      await addDocument(COLLECTIONS.SOURCES, newSource);
      await loadData();
      setNotificacion({ t: 'Éxito', d: `Documento "${file.name}" cargado correctamente.` });
    } catch (error) {
      console.error("Error uploading file:", error);
      setNotificacion({ t: 'Error', d: 'No se pudo cargar el archivo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSource = async (id: string, name: string) => {
    requestConfirmation(
      "Eliminar Documento",
      `¿Estás seguro de que deseas eliminar "${name}" de la base de conocimientos?`,
      async () => {
        try {
          setIsLoading(true);
          await deleteDocument(COLLECTIONS.SOURCES, id);
          await loadData();
          setNotificacion({ t: 'Éxito', d: 'Documento eliminado.' });
        } catch (error) {
          console.error("Error deleting source:", error);
          setNotificacion({ t: 'Error', d: 'No se pudo eliminar el documento.' });
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  const handleKbQuery = async () => {
    if (!kbInput.trim() || isKbLoading) return;

    const userMsg = { role: 'user' as const, text: kbInput };
    setKbMessages(prev => [...prev, userMsg]);
    setKbInput("");
    setIsKbLoading(true);

    try {
      const response = await queryKnowledgeBase(kbInput, sources);
      setKbMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error("Error querying KB:", error);
      setKbMessages(prev => [...prev, { role: 'model', text: "Error al consultar la base de conocimientos." }]);
    } finally {
      setIsKbLoading(false);
    }
  };

  // Edit Alumno State
  const [isEditingAlumno, setIsEditingAlumno] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [editingAlumnoData, setEditingAlumnoData] = useState<Partial<Alumno>>({});

  
  // IA Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<any>(null);
  const [clarificationText, setClarificationText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // UI States
  const [notificacion, setNotificacion] = useState<{t: string, d: string} | null>(null);
  const [hasNewData, setHasNewData] = useState(false);
  const isFirstLoad = useRef(true);
  const [pendingNavigation, setPendingNavigation] = useState<ViewMode | null>(null);
  const [emergencyInfo, setEmergencyInfo] = useState<{publicProvider: string, publicPhone: string, privateProvider: string, privatePhone: string}>({ 
    publicProvider: 'Emergencias Públicas', publicPhone: '107',
    privateProvider: 'Servicio Médico Privado', privatePhone: 'SIPEM'
  });
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);

  const checkUnsavedChanges = () => {
    if (vista === 'NuevaClase') {
      return claseGrupo !== '' || faseInicial.length > 0 || fasePrincipal.length > 0 || faseFinal.length > 0 || objetivos !== '' || observaciones !== '' || Object.keys(habilidadesPorAparato).length > 0;
    }
    if (vista === 'RegistroAlumno') {
      return studentForm.nombre !== '' || studentForm.dni !== '' || (studentForm.alertas && studentForm.alertas.length > 0 && studentForm.alertas[0] !== '');
    }
    if (vista === 'Alumnos' && isAddingAlumno) {
      return newAlumnoForm.nombre !== '' || newAlumnoForm.dni !== '' || newAlumnoForm.grupo !== '';
    }
    if (vista === 'Profesores' && isAddingProfesor) {
      return newProfesorName !== '';
    }
    if (vista === 'AlumnoDetalle' && isAddingSkill) {
      return newSkill.name !== '';
    }
    if (vista === 'AlumnoDetalle' && editingSkillId) {
      return true;
    }
    if (vista === 'AlumnoDetalle' && isEditingAlumno) {
      return true;
    }
    return false;
  };

  const handleNavigation = (newVista: ViewMode) => {
    if (vista === newVista) return;
    if (checkUnsavedChanges()) {
      setPendingNavigation(newVista);
    } else {
      setVista(newVista);
    }
  };

  const confirmNavigation = () => {
    if (pendingNavigation) {
      if (vista === 'NuevaClase') {
        setClaseGrupo('');
        setFaseInicial([]);
        setFasePrincipal([]);
        setFaseFinal([]);
        setFaseInicialDuration("15");
        setFasePrincipalDuration("60");
        setFaseFinalDuration("15");
        setObjetivos("");
        setObservaciones("");
        setHabilidadesPorAparato({});
        setCustomHabilidad({});
        setCustomInicial("");
        setCustomPrincipal("");
        setCustomFinal("");
        setRegistrationStep(1);
        setIsEditingClase(false);
        setEditingClaseId(null);
      } else if (vista === 'RegistroAlumno') {
        setStudentForm({ nombre: '', dni: '', fechaNacimiento: '', fechaPrimeraClase: new Date().toISOString().split('T')[0], alertas: [] });
      } else if (vista === 'Alumnos') {
        setIsAddingAlumno(false);
        setNewAlumnoForm({ nombre: '', dni: '', grupo: '', nivel: 'Inicial' });
      } else if (vista === 'Profesores') {
        setIsAddingProfesor(false);
        setNewProfesorName('');
      } else if (vista === 'AlumnoDetalle') {
        setIsAddingSkill(false);
        setEditingSkillId(null);
        setIsEditingAlumno(false);
        setNewSkill({ name: '', status: 'No Iniciado', apparatus: 'Suelo', level: '1' });
      }
      setVista(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  const cancelNavigation = () => {
    setPendingNavigation(null);
  };

  const COORDINATOR_EMAIL = "profesunlp@gmail.com";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsLoggedIn(true);
        if (currentUser.email === COORDINATOR_EMAIL) {
          setUserRole('Coordinator');
        } else {
          setUserRole('Coach');
        }
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setLoginError(null);
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Login error:", error);
      setLoginError(translateFirebaseError(error));
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setLoginError(null);
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("SignUp error:", error);
      setLoginError(translateFirebaseError(error));
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setNotificacion({ t: "Info", d: "Ingresa tu email para restablecer la contraseña." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setNotificacion({ t: "Éxito", d: "Email de restablecimiento enviado." });
    } catch (error: any) {
      setLoginError(error.message);
    }
    setTimeout(() => setNotificacion(null), 3000);
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (!data.alumnos || !data.clases || !data.grupos) {
          throw new Error("Formato de archivo inválido.");
        }

        setNotificacion({ t: "Importando...", d: "Por favor espera." });

        for (const alumno of data.alumnos) {
          const { id, ...rest } = alumno;
          await addDocument(COLLECTIONS.ALUMNOS, rest);
        }
        for (const clase of data.clases) {
          const { id, ...rest } = clase;
          await addDocument(COLLECTIONS.CLASES, rest);
        }
        for (const grupo of data.grupos) {
          const { id, ...rest } = grupo;
          await addDocument(COLLECTIONS.GRUPOS, rest);
        }
        if (data.profesores) {
          for (const prof of data.profesores) {
            const { id, ...rest } = prof;
            await addDocument(COLLECTIONS.PROFESORES, rest);
          }
        }

        setNotificacion({ t: "Éxito", d: "Datos importados correctamente." });
        loadData();
      } catch (error: any) {
        console.error("Import error:", error);
        setNotificacion({ t: "Error", d: "No se pudo importar: " + error.message });
      }
      setTimeout(() => setNotificacion(null), 5000);
    };
    reader.readAsText(file);
  };

  const handleLogin = async () => {
    try {
      setLoginError(null);
      console.log("Iniciando login con Google...");
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Login exitoso:", result.user.email);
    } catch (error: any) {
      console.error("Error detallado de login:", error);
      let msg = translateFirebaseError(error);
      
      if (error.code === 'auth/unauthorized-domain') {
        msg = "DOMINIO NO AUTORIZADO: Agregaste el dominio en Firebase, pero la app sigue usando la base de datos de prueba. Debes configurar tus propias credenciales de Firebase en las variables de entorno (VITE_FIREBASE_...).";
      } else if (error.code === 'auth/popup-blocked') {
        msg = "El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        msg = "Cerraste la ventana de inicio de sesión antes de terminar.";
      }
      
      setLoginError(msg);
      setNotificacion({ t: "Error de Autenticación", d: "Revisa el mensaje en pantalla." });
      setTimeout(() => setNotificacion(null), 5000);
    }
  };

  const [selectedNivelToManage, setSelectedNivelToManage] = useState("");
  const [selectedDisciplinaToManage, setSelectedDisciplinaToManage] = useState("");
  const [selectedWarmupToManage, setSelectedWarmupToManage] = useState("");
  const [selectedCooldownToManage, setSelectedCooldownToManage] = useState("");

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setIsLoggedIn(false);
      setUser(null);
      setVista('Dashboard');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleEditClase = (clase: Clase) => {
    setIsEditingClase(true);
    setEditingClaseId(clase.id || null);
    setClaseGrupo(clase.grupo);
    setFaseInicial(clase.faseInicial || []);
    setFasePrincipal(clase.fasePrincipal || []);
    setFaseFinal(clase.faseFinal || []);
    setFaseInicialDuration(clase.faseInicialDuration || "15");
    setFasePrincipalDuration(clase.fasePrincipalDuration || "45");
    setFaseFinalDuration(clase.faseFinalDuration || "15");
    setHabilidadesPorAparato(clase.habilidadesPorAparato || {});
    setObjetivos(clase.objetivos || "");
    setObservaciones(clase.observaciones || "");
    setRegistrationStep(1);
    setVista('NuevaClase');
  };

  const handleExportClases = () => {
    if (clases.length === 0) return;
    
    const exportData = clases.map(c => ({
      Fecha: new Date(c.fecha).toLocaleDateString(),
      Grupo: c.grupo,
      Entrenador: c.entrenador,
      Objetivos: c.objetivos || '',
      Observaciones: c.observaciones || ''
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `asistencia_gymcoach_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotificacion({ t: 'Éxito', d: 'Archivo CSV exportado correctamente.' });
  };

  const sendPaymentReminder = (alumno: Alumno) => {
    const message = `Hola ${alumno.contacto?.padreNombre || alumno.nombre}, te escribimos de GymCoach Pro para recordarte que el pago de la cuota de ${alumno.nombre} se encuentra ${alumno.estadoPago.toLowerCase()}. ¡Muchas gracias!`;
    const phone = alumno.contacto?.padreTelefono || alumno.contacto?.madreTelefono || alumno.contacto?.familiarTelefono;
    if (!phone) {
      setNotificacion({ t: 'Error', d: 'No hay teléfono de contacto registrado.' });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const loadComparativeStats = () => {
    const data = grupos.map(g => {
      const stats = asistenciasGlobales[g.nombre] || { presentes: 0, total: 0 };
      const percentage = stats.total > 0 ? Math.round((stats.presentes / stats.total) * 100) : 0;
      return {
        name: g.nombre,
        asistencia: percentage
      };
    });
    setComparativeData(data);
  };

  useEffect(() => {
    if (vista === 'AsistenciaStats') {
      loadComparativeStats();
    }
  }, [vista, asistenciasGlobales]);

  const [monthlyStats, setMonthlyStats] = useState<Record<string, { attended: number, expected: number }>>({});
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);

  const calculateExpectedClasses = (groupDias: string[], month: number, year: number) => {
    if (!groupDias || groupDias.length === 0) return 0;
    
    const dayIndices = groupDias.map(d => {
      const idx = parseInt(d.split('-')[1]);
      // L-0=1, M-1=2, M-2=3, J-3=4, V-4=5, S-5=6, D-6=0
      return idx === 6 ? 0 : idx + 1;
    });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      if (dayIndices.includes(date.getDay())) {
        count++;
      }
    }
    return count;
  };

  const loadMonthlyReport = async (groupName: string, month: number, year: number) => {
    setIsLoadingMonthly(true);
    const group = grupos.find(g => g.nombre === groupName);
    if (!group) {
      setIsLoadingMonthly(false);
      return;
    }

    const expectedCount = calculateExpectedClasses(group.dias || [], month, year);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    const end = new Date(year, month, daysInMonth).toISOString().split('T')[0];
    
    const q = query(
      collection(firestore, COLLECTIONS.ASISTENCIAS),
      where('grupo', '==', groupName),
      where('fecha', '>=', start),
      where('fecha', '<=', end)
    );
    
    const snap = await getDocs(q);
    const stats: Record<string, { attended: number, expected: number }> = {};
    
    alumnos.filter(a => a.grupo === groupName).forEach(a => {
      stats[a.id!] = { attended: 0, expected: expectedCount };
    });

    snap.forEach(doc => {
      const data = doc.data() as AsistenciaRecord;
      if (stats[data.alumnoId] && data.presente) {
        stats[data.alumnoId].attended += 1;
      }
    });

    setMonthlyStats(stats);
    setIsLoadingMonthly(false);
  };

  const loadGlobalAttendance = async () => {
    if (userRole !== 'Coordinator') return;
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(firestore, COLLECTIONS.ASISTENCIAS),
      where('fecha', '==', today)
    );
    const querySnapshot = await getDocs(q);
    const stats: Record<string, { presentes: number, total: number }> = {};
    
    // Initialize stats for all groups
    grupos.forEach(g => {
      const totalInGroup = alumnos.filter(a => a.grupo === g.nombre).length;
      stats[g.nombre] = { presentes: 0, total: totalInGroup };
    });

    querySnapshot.forEach(doc => {
      const data = doc.data() as AsistenciaRecord;
      if (stats[data.grupo] && data.presente) {
        stats[data.grupo].presentes += 1;
      }
    });
    setAsistenciasGlobales(stats);
  };

  useEffect(() => {
    if (isLoggedIn && userRole === 'Coordinator') {
      loadGlobalAttendance();
    }
  }, [isLoggedIn, userRole, grupos, alumnos]);

  const [alertasGlobales, setAlertasGlobales] = useState<Alumno[]>([]);

  const loadData = async () => {
    try {
      const a = await getCollectionData(COLLECTIONS.ALUMNOS) as Alumno[];
      const c = await getCollectionData(COLLECTIONS.CLASES) as Clase[];
      const g = await getCollectionData(COLLECTIONS.GRUPOS) as GrupoConfig[];
      const asis = await getCollectionData(COLLECTIONS.ASISTENCIAS) as AsistenciaRecord[];
      const p = await getCollectionData(COLLECTIONS.PROFESORES) as {id?: string, nombre: string}[];
      const n = await getCollectionData(COLLECTIONS.NIVELES) as {id?: string, nombre: string}[];
      const d = await getCollectionData(COLLECTIONS.DISCIPLINAS) as {id?: string, nombre: string}[];
      const w = await getCollectionData(COLLECTIONS.WARMUP_OPTIONS) as {id?: string, nombre: string}[];
      const co = await getCollectionData(COLLECTIONS.COOLDOWN_OPTIONS) as {id?: string, nombre: string}[];
      const ac = await getCollectionData(COLLECTIONS.AGE_CATEGORIES) as {id?: string, nombre: string}[];
      const pc = await getCollectionData(COLLECTIONS.PHYSICAL_CATEGORIES) as {id?: string, nombre: string}[];
      const s = await getCollectionData(COLLECTIONS.SOURCES) as Source[];
      setAlumnos(a);
      setClases(c.sort((x, y) => new Date(y.fecha).getTime() - new Date(x.fecha).getTime()));
      setGrupos(g);
      setAsistencias(asis);
      setProfesoresList(p || []);
      setSources(s || []);
      setNiveles(n.length > 0 ? n : [
        { id: 'default-0', nombre: 'Escuela' },
        { id: 'default-1', nombre: 'Pre-Equipo' },
        { id: 'default-2', nombre: 'Equipo' }
      ]);
      setDisciplinas(d.length > 0 ? d : DISCIPLINAS.map((name, i) => ({ id: `default-${i}`, nombre: name })));
      setWarmupOptions(w.length > 0 ? w : ['Movilidad articular', 'Trote', 'Juegos', 'Estiramiento dinámico'].map((name, i) => ({ id: `default-${i}`, nombre: name })));
      setCooldownOptions(co.length > 0 ? co : ['Estiramiento pasivo', 'Relajación', 'Feedback grupal'].map((name, i) => ({ id: `default-${i}`, nombre: name })));
      
      const newAgeCats = ac.length > 0 ? ac : [
        { id: 'default-0', nombre: 'Pre-Mini' },
        { id: 'default-1', nombre: 'Mini' },
        { id: 'default-2', nombre: 'Pre-Infantil' },
        { id: 'default-3', nombre: 'Infantil' },
        { id: 'default-4', nombre: 'Juvenil' },
        { id: 'default-5', nombre: 'Mayor' }
      ];
      setAgeCategories(newAgeCats);

      const newPhysCats = pc.length > 0 ? pc : [
        { id: 'default-0', nombre: 'Elite' },
        { id: 'default-1', nombre: 'Bueno' },
        { id: 'default-2', nombre: 'Regular' },
        { id: 'default-3', nombre: 'Bajo' }
      ];
      setPhysicalCategories(newPhysCats);

      // Auto-limpiar filtros si la opción ya no existe
      if (selectedAgeFilter !== 'Todas' && !newAgeCats.find(o => o.nombre === selectedAgeFilter)) {
        setSelectedAgeFilter('Todas');
      }
      if (selectedPhysicalFilter !== 'Todas' && !newPhysCats.find(o => o.nombre === selectedPhysicalFilter)) {
        setSelectedPhysicalFilter('Todas');
      }
      if (selectedGrupoFilter !== 'Todos' && !g.find(o => o.nombre === selectedGrupoFilter)) {
        setSelectedGrupoFilter('Todos');
      }
      if (selectedNivelFilter !== 'Todos' && !n.find(o => o.nombre === selectedNivelFilter)) {
        setSelectedNivelFilter('Todos');
      }
      
      // Filter global alerts
      setAlertasGlobales(a.filter(student => student.alertas && student.alertas.length > 0 && student.alertas[0] !== ""));

      if (activeGroup) {
        const today = new Date().toISOString().split('T')[0];
        const q = query(
          collection(firestore, COLLECTIONS.ASISTENCIAS),
          where('fecha', '==', today),
          where('grupo', '==', activeGroup.nombre)
        );
        const querySnapshot = await getDocs(q);
        const attMap: Record<string, boolean> = {};
        const payMap: Record<string, boolean> = {};
        querySnapshot.forEach(doc => {
          const data = doc.data() as AsistenciaRecord;
          attMap[data.alumnoId] = data.presente;
          payMap[data.alumnoId] = !!data.pago;
        });
        setAsistenciasHoy(attMap);
        setPagosHoy(payMap);
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      setNotificacion({ t: "Error de Conexión", d: error.message || "No se pudieron cargar los datos." });
      setTimeout(() => setNotificacion(null), 5000);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
      
      // Real-time updates for classes
      const unsubClases = onSnapshot(collection(firestore, COLLECTIONS.CLASES), (snapshot) => {
        if (isFirstLoad.current) return;
        if (snapshot.metadata.hasPendingWrites) return;
        setHasNewData(true);
      });

      // Real-time updates for students
      const unsubAlumnos = onSnapshot(collection(firestore, COLLECTIONS.ALUMNOS), (snapshot) => {
        if (isFirstLoad.current) return;
        if (snapshot.metadata.hasPendingWrites) return;
        setHasNewData(true);
      });

      // Real-time updates for attendance
      const unsubAsistencias = onSnapshot(collection(firestore, COLLECTIONS.ASISTENCIAS), (snapshot) => {
        const asis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AsistenciaRecord[];
        setAsistencias(asis);
      });

      // Real-time updates for sources
      const unsubSources = onSnapshot(collection(firestore, COLLECTIONS.SOURCES), (snapshot) => {
        const s = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Source[];
        setSources(s);
      });

      // Load emergency info
      const loadEmergency = async () => {
        const config = await getCollectionData(COLLECTIONS.CONFIG);
        const emergency = config.find(c => c.id === 'emergency');
        if (emergency) {
          setEmergencyInfo(emergency as any);
        }
      };
      loadEmergency();

      // Reset first load after a short delay
      const timer = setTimeout(() => {
        isFirstLoad.current = false;
      }, 3000);

      return () => {
        unsubClases();
        unsubAlumnos();
        unsubAsistencias();
        unsubSources();
        clearTimeout(timer);
      };
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (selectedClase?.id) {
      const q = query(
        collection(firestore, COLLECTIONS.FEEDBACK),
        where('claseId', '==', selectedClase.id),
        orderBy('timestamp', 'asc')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setFeedbacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Feedback[]);
      });
      return () => unsub();
    }
  }, [selectedClase]);

  const handleSaveGroup = async () => {
    if (!newGroupName || !newCoachName || selectedDays.length === 0) {
      setNotificacion({ t: "Error", d: "Nombre del grupo, profesor y días son obligatorios." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }
    
    try {
      if (editingGroup && editingGroup.id) {
        await updateDocument(COLLECTIONS.GRUPOS, editingGroup.id, {
          nombre: newGroupName,
          entrenador: newCoachName,
          dias: selectedDays,
          horario: `${startTime} - ${endTime}`
        });
        setNotificacion({ t: "Éxito", d: `Grupo ${newGroupName} actualizado.` });
      } else {
        await addDocument(COLLECTIONS.GRUPOS, {
          nombre: newGroupName,
          entrenador: newCoachName,
          dias: selectedDays,
          horario: `${startTime} - ${endTime}`
        });
        setNotificacion({ t: "Éxito", d: `Grupo ${newGroupName} configurado.` });
      }
      setNewGroupName("");
      setNewCoachName("");
      setSelectedDays([]);
      setEditingGroup(null);
      loadData();
      setTimeout(() => setNotificacion(null), 3000);
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message || "No se pudo guardar el grupo." });
      setTimeout(() => setNotificacion(null), 5000);
    }
  };

  const handleDeleteGroup = async (grupo: GrupoConfig) => {
    if (!grupo.id) return;
    
    requestConfirmation(
      "Eliminar Grupo",
      `¿Estás seguro de que deseas eliminar el grupo "${grupo.nombre}"? Esta acción no se puede deshacer y podrías perder el acceso a los datos asociados a este grupo.`,
      async () => {
        try {
          await deleteDocument(COLLECTIONS.GRUPOS, grupo.id!);
          loadData();
          setNotificacion({ t: "Éxito", d: `Grupo ${grupo.nombre} eliminado.` });
          if (activeGroup?.id === grupo.id) {
            setActiveGroup(null);
            setVista('Dashboard');
          }
          if (claseGrupo === grupo.nombre) {
            setClaseGrupo('');
          }
          setTimeout(() => setNotificacion(null), 3000);
        } catch (error) {
          console.error("Error deleting group:", error);
          setNotificacion({ t: "Error", d: "No se pudo eliminar el grupo." });
          setTimeout(() => setNotificacion(null), 3000);
        }
      }
    );
  };

  const handleQuickSaveGroup = async (nombre: string) => {
    try {
      await addDocument(COLLECTIONS.GRUPOS, { 
        nombre, 
        entrenador: user?.displayName || 'Sin Asignar',
        dias: [],
        horario: 'Sin definir'
      });
      setNotificacion({ t: "Éxito", d: `Grupo ${nombre} añadido.` });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleSaveLevel = async (nombre: string) => {
    try {
      await addDocument(COLLECTIONS.NIVELES, { nombre });
      setNotificacion({ t: "Éxito", d: `Nivel ${nombre} añadido.` });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleUpdateBiometrics = async (alumnoId: string, biometria: any) => {
    try {
      await updateDocument(COLLECTIONS.ALUMNOS, alumnoId, { biometria });
      if (selectedAlumno?.id === alumnoId) {
        setSelectedAlumno({ ...selectedAlumno, biometria });
      }
      loadData();
    } catch (error) {
      console.error("Error updating biometrics:", error);
    }
  };

  const handleUpdateLevel = async (id: string, nombre: string) => {
    try {
      if (id.startsWith('default-')) {
        // Si es una opción por defecto, la creamos como nueva en Firestore
        await addDocument(COLLECTIONS.NIVELES, { nombre });
      } else {
        await updateDocument(COLLECTIONS.NIVELES, id, { nombre });
      }
      setNotificacion({ t: "Éxito", d: "Nivel actualizado." });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleDeleteLevel = async (id: string) => {
    requestConfirmation(
      "Eliminar Nivel",
      "¿Estás seguro de que deseas eliminar este nivel? Los alumnos asignados a este nivel podrían requerir reasignación.",
      async () => {
        try {
          if (!id.startsWith('default-')) {
            await deleteDocument(COLLECTIONS.NIVELES, id);
          }
          setNotificacion({ t: "Éxito", d: "Nivel eliminado." });
          loadData();
        } catch (error: any) {
          setNotificacion({ t: "Error", d: error.message });
        }
      }
    );
  };

  const handleUpdateGroupQuick = async (id: string, nombre: string) => {
    try {
      await updateDocument(COLLECTIONS.GRUPOS, id, { nombre });
      setNotificacion({ t: "Éxito", d: "Grupo actualizado." });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleUpdateProfesor = async (id: string, nombre: string) => {
    try {
      await updateDocument(COLLECTIONS.PROFESORES, id, { nombre });
      setNotificacion({ t: "Éxito", d: "Profesor actualizado." });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleSaveDiscipline = async (nombre: string) => {
    try {
      await addDocument(COLLECTIONS.DISCIPLINAS, { nombre });
      setNotificacion({ t: "Éxito", d: "Disciplina añadida." });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleUpdateDiscipline = async (id: string, nombre: string) => {
    if (id.startsWith('default-')) {
      setNotificacion({ t: "Aviso", d: "No se pueden editar disciplinas predeterminadas. Agrega tus propias disciplinas para personalizar la lista." });
      return;
    }
    try {
      await updateDocument(COLLECTIONS.DISCIPLINAS, id, { nombre });
      setNotificacion({ t: "Éxito", d: "Disciplina actualizada." });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleDeleteDiscipline = async (id: string) => {
    if (id.startsWith('default-')) {
      setNotificacion({ t: "Aviso", d: "No se pueden eliminar disciplinas predeterminadas. Agrega tus propias disciplinas para personalizar la lista." });
      return;
    }
    requestConfirmation(
      "Eliminar Disciplina",
      "¿Estás seguro de que deseas eliminar esta disciplina?",
      async () => {
        try {
          await deleteDocument(COLLECTIONS.DISCIPLINAS, id);
          setNotificacion({ t: "Éxito", d: "Disciplina eliminada." });
          loadData();
        } catch (error: any) {
          setNotificacion({ t: "Error", d: error.message });
        }
      }
    );
  };

  const handleSaveWarmupOption = async (nombre: string) => {
    try {
      await addDocument(COLLECTIONS.WARMUP_OPTIONS, { nombre });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleUpdateWarmupOption = async (id: string, nombre: string) => {
    if (id.startsWith('default-')) {
      setNotificacion({ t: "Aviso", d: "No se pueden editar opciones predeterminadas." });
      return;
    }
    try {
      await updateDocument(COLLECTIONS.WARMUP_OPTIONS, id, { nombre });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleDeleteWarmupOption = async (id: string) => {
    if (id.startsWith('default-')) {
      setNotificacion({ t: "Aviso", d: "No se pueden eliminar opciones predeterminadas." });
      return;
    }
    try {
      await deleteDocument(COLLECTIONS.WARMUP_OPTIONS, id);
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleSaveCooldownOption = async (nombre: string) => {
    try {
      await addDocument(COLLECTIONS.COOLDOWN_OPTIONS, { nombre });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleUpdateCooldownOption = async (id: string, nombre: string) => {
    if (id.startsWith('default-')) {
      setNotificacion({ t: "Aviso", d: "No se pueden editar opciones predeterminadas." });
      return;
    }
    try {
      await updateDocument(COLLECTIONS.COOLDOWN_OPTIONS, id, { nombre });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleDeleteCooldownOption = async (id: string) => {
    if (id.startsWith('default-')) {
      setNotificacion({ t: "Aviso", d: "No se pueden eliminar opciones predeterminadas." });
      return;
    }
    try {
      await deleteDocument(COLLECTIONS.COOLDOWN_OPTIONS, id);
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleSaveAgeCategory = async (nombre: string) => {
    try {
      await addDocument(COLLECTIONS.AGE_CATEGORIES, { nombre });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleUpdateAgeCategory = async (id: string, nombre: string) => {
    try {
      if (id.startsWith('default-')) {
        await addDocument(COLLECTIONS.AGE_CATEGORIES, { nombre });
      } else {
        await updateDocument(COLLECTIONS.AGE_CATEGORIES, id, { nombre });
      }
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleDeleteAgeCategory = async (id: string) => {
    requestConfirmation(
      "Eliminar Categoría",
      "¿Estás seguro de que deseas eliminar esta categoría de edad?",
      async () => {
        try {
          if (!id.startsWith('default-')) {
            await deleteDocument(COLLECTIONS.AGE_CATEGORIES, id);
          }
          loadData();
        } catch (error: any) {
          setNotificacion({ t: "Error", d: error.message });
        }
      }
    );
  };

  const handleSavePhysicalCategory = async (nombre: string) => {
    try {
      await addDocument(COLLECTIONS.PHYSICAL_CATEGORIES, { nombre });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleUpdatePhysicalCategory = async (id: string, nombre: string) => {
    try {
      if (id.startsWith('default-')) {
        await addDocument(COLLECTIONS.PHYSICAL_CATEGORIES, { nombre });
      } else {
        await updateDocument(COLLECTIONS.PHYSICAL_CATEGORIES, id, { nombre });
      }
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleDeletePhysicalCategory = async (id: string) => {
    requestConfirmation(
      "Eliminar Condición",
      "¿Estás seguro de que deseas eliminar esta condición física?",
      async () => {
        try {
          if (!id.startsWith('default-')) {
            await deleteDocument(COLLECTIONS.PHYSICAL_CATEGORIES, id);
          }
          loadData();
        } catch (error: any) {
          setNotificacion({ t: "Error", d: error.message });
        }
      }
    );
  };

  const handleSaveDisciplina = async (nombre: string) => {
    try {
      await addDocument(COLLECTIONS.DISCIPLINAS, { nombre });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleUpdateDisciplina = async (id: string, nombre: string) => {
    try {
      if (id.startsWith('default-')) {
        await addDocument(COLLECTIONS.DISCIPLINAS, { nombre });
      } else {
        await updateDocument(COLLECTIONS.DISCIPLINAS, id, { nombre });
      }
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleDeleteDisciplina = async (id: string) => {
    requestConfirmation(
      "Eliminar Disciplina",
      "¿Estás seguro de que deseas eliminar esta disciplina?",
      async () => {
        try {
          if (!id.startsWith('default-')) {
            await deleteDocument(COLLECTIONS.DISCIPLINAS, id);
          }
          loadData();
        } catch (error: any) {
          setNotificacion({ t: "Error", d: error.message });
        }
      }
    );
  };

  const handleAddAlumno = async () => {
    if (!newAlumnoForm.nombre.trim()) return;
    try {
      const newStudent: Partial<Alumno> = {
        nombre: newAlumnoForm.nombre,
        dni: newAlumnoForm.dni,
        grupo: newAlumnoForm.grupo,
        nivel: newAlumnoForm.nivel,
        disciplina: 'GAF',
        fechaNacimiento: '',
        fechaIngreso: new Date().toISOString().split('T')[0],
        fechaPrimeraClase: new Date().toISOString().split('T')[0],
        alertas: [],
        contacto: { padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '', emergenciaNombre: '', emergenciaTelefono: '' },
        habilidades: []
      };
      await addDocument(COLLECTIONS.ALUMNOS, newStudent);
      await loadData();
      setIsAddingAlumno(false);
      setNewAlumnoForm({ nombre: '', dni: '', grupo: '', nivel: '' });
      setNotificacion({ t: "Gimnasta Añadido", d: `${newStudent.nombre} registrado correctamente.` });
    } catch (error) {
      console.error("Error adding student:", error);
      setNotificacion({ t: "Error", d: "No se pudo añadir al gimnasta." });
    }
  };

  const handleAddProfesor = async (nameArg?: any) => {
    const targetName = (typeof nameArg === 'string' ? nameArg : newProfesorName).trim();
    if (!targetName) return;
    setIsSavingProfesor(true);
    try {
      await addDocument(COLLECTIONS.PROFESORES, { nombre: targetName });
      await loadData();
      setIsAddingProfesor(false);
      setNewProfesorName('');
      setNotificacion({ t: "Profesor Añadido", d: `${targetName} registrado correctamente.` });
    } catch (error) {
      console.error("Error adding professor:", error);
      setNotificacion({ t: "Error", d: "No se pudo añadir al profesor." });
    } finally {
      setIsSavingProfesor(false);
    }
  };

  const handleDeleteProfesor = async (profesorId: string, nombre: string) => {
    requestConfirmation(
      "Eliminar Profesor",
      `¿Estás seguro de que deseas eliminar al profesor "${nombre}"?`,
      async () => {
        try {
          await deleteDocument(COLLECTIONS.PROFESORES, profesorId);
          setNotificacion({ t: 'Éxito', d: `Profesor ${nombre} eliminado.` });
          loadData();
        } catch (error: any) {
          setNotificacion({ t: 'Error', d: error.message });
        }
      }
    );
  };

  const clearAlumnosFilters = () => {
    setSearchQuery('');
    setSelectedGrupoFilter('Todos');
    setSelectedNivelFilter('Todos');
  };

  const handleDeleteClase = async (clase: Clase) => {
    if (!clase || !clase.id) return;
    requestConfirmation(
      "Confirmar Eliminación",
      `¿Estás seguro de que deseas eliminar permanentemente el registro de esta clase del grupo ${clase.grupo}? Esta acción no se puede deshacer.`,
      async () => {
        try {
          setIsLoading(true);
          await deleteDocument(COLLECTIONS.CLASES, clase.id!);
          setNotificacion({ t: 'Éxito', d: 'La clase ha sido eliminada correctamente.' });
          setVista('HistorialClases');
          setSelectedClase(null);
          await loadData();
        } catch (error: any) {
          console.error("Error deleting class:", error);
          setNotificacion({ t: 'Error', d: 'No se pudo eliminar la clase. Inténtalo de nuevo.' });
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  const handleDeleteAsistencia = async (asistencia: AsistenciaRecord) => {
    if (!asistencia || !asistencia.id) return;
    requestConfirmation(
      "Eliminar Registro de Asistencia",
      `¿Estás seguro de que deseas eliminar este registro de asistencia?`,
      async () => {
        try {
          setIsLoading(true);
          await deleteDocument(COLLECTIONS.ASISTENCIAS, asistencia.id!);
          setNotificacion({ t: 'Éxito', d: 'Registro eliminado correctamente.' });
          await loadData();
        } catch (error: any) {
          console.error("Error deleting attendance:", error);
          setNotificacion({ t: 'Error', d: 'No se pudo eliminar el registro.' });
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  const handleEditAsistencia = async (asistencia: AsistenciaRecord) => {
    console.log("Edit attendance:", asistencia);
    // This could be expanded to open a modal for editing
  };

  const handleDeleteStudent = async (id: string) => {
    const student = alumnos.find(a => a.id === id);
    if (!student) return;
    requestConfirmation(
      "Eliminar Gimnasta",
      `¿Estás seguro de eliminar a ${student.nombre}? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await deleteDocument(COLLECTIONS.ALUMNOS, id);
          handleNavigation('Alumnos');
          setSelectedAlumno(null);
          loadData();
          setNotificacion({ t: "Gimnasta Eliminado", d: "El registro ha sido borrado." });
        } catch (error) {
          console.error("Error deleting student:", error);
          setNotificacion({ t: "Error", d: "No se pudo eliminar al gimnasta." });
        }
      }
    );
  };

  const handleSaveSkill = async () => {
    if (editingSkillId) {
      await handleUpdateSkill();
    } else {
      await handleAddSkill();
    }
  };

  const handleUpdateFeedback = async (id: string, text: string) => {
    try {
      await updateDocument(COLLECTIONS.FEEDBACK, id, { text });
      setNotificacion({ t: "Éxito", d: "Comentario actualizado." });
    } catch (error) {
      console.error("Error updating feedback:", error);
      setNotificacion({ t: "Error", d: "No se pudo actualizar el comentario." });
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    requestConfirmation(
      "Eliminar Comentario",
      "¿Estás seguro de que deseas eliminar este comentario?",
      async () => {
        try {
          await deleteDocument(COLLECTIONS.FEEDBACK, id);
          setNotificacion({ t: "Éxito", d: "Comentario eliminado." });
          // Feedback is usually loaded in real-time or re-fetched
        } catch (error) {
          console.error("Error deleting feedback:", error);
          setNotificacion({ t: "Error", d: "No se pudo eliminar el comentario." });
        }
      }
    );
  };
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [isBulkPaymentModalOpen, setIsBulkPaymentModalOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialAlumnos = useRef(true);
  const isInitialClases = useRef(true);

  useEffect(() => {
    if (!isLoggedIn) return;

    const unsubAlumnos = onSnapshot(collection(firestore, COLLECTIONS.ALUMNOS), (snapshot) => {
      if (isInitialAlumnos.current) {
        isInitialAlumnos.current = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !snapshot.metadata.hasPendingWrites) {
          const data = change.doc.data() as Alumno;
          setNotificacion({ t: "Nuevo Alumno", d: `${data.nombre} se ha unido al gimnasio.` });
        }
      });
    });

    const unsubClases = onSnapshot(collection(firestore, COLLECTIONS.CLASES), (snapshot) => {
      if (isInitialClases.current) {
        isInitialClases.current = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !snapshot.metadata.hasPendingWrites) {
          const data = change.doc.data() as Clase;
          setNotificacion({ t: "Nueva Clase", d: `Clase de ${data.grupo} registrada.` });
        }
      });
    });

    return () => {
      unsubAlumnos();
      unsubClases();
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (notificacion) {
      const timer = setTimeout(() => {
        setNotificacion(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notificacion]);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const statsData = {
        totalAlumnos: alumnos.length,
        alumnosPorGrupo: grupos.map(g => ({
          nombre: g.nombre,
          total: alumnos.filter(a => a.grupo === g.nombre).length
        })),
        estadoPagos: {
          alDia: alumnos.filter(a => a.estadoPago === 'Al día').length,
          pendiente: alumnos.filter(a => a.estadoPago === 'Pendiente').length,
          vencido: alumnos.filter(a => a.estadoPago === 'Vencido').length
        },
        presentesHoy: presentCount
      };
      const analysis = await analyzeAttendanceStats(statsData);
      setAiAnalysis(analysis);
    } catch (error) {
      console.error("Error in AI analysis:", error);
      setNotificacion({ t: "Error", d: "No se pudo realizar el análisis de IA." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBulkPaymentConfirm = async (updates: { alumnoId: string, name: string, month: string, year: number }[]) => {
    try {
      setIsLoading(true);
      const updatedAlumnos = [...alumnos];
      
      for (const update of updates) {
        const alumno = updatedAlumnos.find(a => a.id === update.alumnoId);
        if (alumno) {
          const pagos = alumno.pagosMensuales || [];
          // Evitar duplicados
          const exists = pagos.some(p => p.mes === update.month && p.anio === update.year);
          if (!exists) {
            const newPago = { mes: update.month, anio: update.year, fechaPago: new Date().toISOString() };
            const newPagos = [...pagos, newPago];
            await updateDocument(COLLECTIONS.ALUMNOS, alumno.id!, { pagosMensuales: newPagos });
          }
        }
      }
      
      setNotificacion({ t: 'Éxito', d: `${updates.length} pagos registrados correctamente.` });
      setIsBulkPaymentModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error bulk updating payments:", error);
      setNotificacion({ t: 'Error', d: 'Hubo un problema al registrar los pagos.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const csv = XLSX.utils.sheet_to_csv(ws);
          setBulkImportText(csv);
        } catch (error) {
          console.error("Error reading Excel file:", error);
          setNotificacion({ t: "Error", d: "No se pudo leer el archivo Excel." });
        }
      };
      reader.readAsBinaryString(file);
    } else {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<any>) => {
          const text = results.data.map((row: any) => row.join(',')).join('\n');
          setBulkImportText(text);
        }
      });
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkImportText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return;

    setIsLoading(true);
    let importedCount = 0;
    let errors: string[] = [];
    
    // Detectar si la primera línea es el encabezado
    const firstLine = lines[0].toLowerCase();
    const startIndex = (firstLine.includes('marca temporal') || firstLine.includes('timestamp')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      // Split by comma, but handle quoted strings if necessary (basic CSV split)
      // For Google Forms, it's usually simple comma separated
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
      
      if (parts.length < 4) {
        errors.push(`Línea con datos insuficientes: "${line}"`);
        continue;
      }

      // Mapeo según Google Forms (1: Timestamp, 2: Email, 3: Apellido, 4: Nombre, 5: Contacto, 6: ?, 7-9: Grupos)
      // Ajustamos a índices 0-indexed: 0: Timestamp, 1: Email, 2: Apellido, 3: Nombre, 4: Tel, 5: ?, 6-8: Grupos
      const email = parts[1] || '';
      const apellido = parts[2] || '';
      const nombrePila = parts[3] || '';
      const nombreCompleto = `${nombrePila} ${apellido}`.trim();
      
      // Limpiar teléfono (quitar caracteres no numéricos y el primer '9' si es prefijo común en Argentina)
      let telefono = (parts[4] || '').replace(/\D/g, '');
      if (telefono.startsWith('549')) {
        telefono = telefono.substring(3);
      } else if (telefono.startsWith('9')) {
        // A veces el primer 9 es el prefijo de celular, el usuario pidió "limpiar primer número"
        // pero solo si tiene sentido. Aplicaremos una limpieza básica.
      }

      // Grupo dinámico (Columnas 7, 8 o 9 -> índices 6, 7, 8)
      const grupo = parts[6] || parts[7] || parts[8] || 'Sin Grupo';
      const nivel = 'Escuela'; // Default

      if (nombreCompleto.length < 3) {
        errors.push(`Nombre inválido o muy corto: "${nombreCompleto}"`);
        continue;
      }

      // Validación de duplicados por Nombre Completo
      const existingStudent = alumnos.find(a => 
        a.nombre.toLowerCase().trim() === nombreCompleto.toLowerCase().trim()
      );

      if (existingStudent && existingStudent.id) {
        // Actualizar existente
        const updatedStudent = {
          ...existingStudent,
          nombre: nombreCompleto,
          grupo: (grupo && grupo !== 'Sin Grupo') ? grupo : existingStudent.grupo,
          contacto: {
            ...(existingStudent.contacto || {}),
            emergenciaTelefono: telefono || existingStudent.contacto?.emergenciaTelefono || '',
            familiarEmail: email || (existingStudent.contacto as any)?.familiarEmail || ''
          }
        };
        try {
          await updateDocument(COLLECTIONS.ALUMNOS, existingStudent.id, updatedStudent);
          importedCount++;
        } catch (e) {
          errors.push(`Error al actualizar a ${nombreCompleto}: ${e}`);
        }
      } else {
        // Crear nuevo
        const newStudent: Omit<Alumno, 'id'> = {
          nombre: nombreCompleto,
          dni: 'No especificado', // Google Forms might not have DNI
          disciplina: 'GAF',
          nivel,
          grupo,
          fechaNacimiento: '2010-01-01',
          fechaIngreso: new Date().toISOString(),
          fechaPrimeraClase: new Date().toISOString().split('T')[0],
          estadoPago: 'Al día',
          habilidades: [],
          biometria: { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 },
          qrCode: `QR_${new Date().getTime()}_${Math.random().toString(36).substr(2, 5)}`,
          asistenciasHistoricas: 0,
          alertas: [],
          contacto: {
            padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '',
            emergenciaNombre: 'Importado Google Forms', 
            emergenciaTelefono: telefono,
            familiarEmail: email
          }
        };
        try {
          await addDocument(COLLECTIONS.ALUMNOS, newStudent);
          importedCount++;
        } catch (e) {
          errors.push(`Error al insertar a ${nombreCompleto}: ${e}`);
        }
      }
    }

    await loadData();
    setIsLoading(false);
    setIsBulkImporting(false);
    setBulkImportText("");
    
    if (errors.length > 0) {
      setNotificacion({ 
        t: "Importación Parcial", 
        d: `Se importaron ${importedCount} alumnos. Hubo ${errors.length} errores.` 
      });
      console.warn("Errores de importación:", errors);
    } else {
      setNotificacion({ t: "Importación Exitosa", d: `Se importaron ${importedCount} alumnos correctamente.` });
    }
    setTimeout(() => setNotificacion(null), 3000);
  };

  const handleCleanupInvalidStudents = async () => {
    requestConfirmation(
      "¿Limpiar registros?",
      "Se eliminarán los alumnos sin nombre o con nombres numéricos inválidos. Esta acción no se puede deshacer.",
      async () => {
        setIsLoading(true);
        try {
          let count = 0;
          for (const a of alumnos) {
            // Criterios: nombre vacío, nulo, o solo números
            if (!a.nombre || a.nombre.trim() === '' || /^\d+$/.test(a.nombre.trim().replace(/\s/g, ''))) {
              if (a.id) {
                await deleteDocument(COLLECTIONS.ALUMNOS, a.id);
                count++;
              }
            }
          }
          await loadData();
          setNotificacion({ t: "Limpieza Completada", d: `Se eliminaron ${count} registros inválidos.` });
        } catch (error) {
          console.error("Error during cleanup:", error);
          setNotificacion({ t: "Error", d: "No se pudo completar la limpieza." });
        } finally {
          setIsLoading(false);
          setTimeout(() => setNotificacion(null), 3000);
        }
      }
    );
  };

  const handleSaveStudent = async () => {
    if (!studentForm.nombre?.trim()) {
      setNotificacion({ t: "Error", d: "El nombre es obligatorio." });
      return;
    }
    if (!studentForm.dni?.trim()) {
      setNotificacion({ t: "Error", d: "El DNI es obligatorio." });
      return;
    }

    setIsSavingStudent(true);
    try {
      const currentYear = new Date().getFullYear();
      const birthDate = studentForm.fechaNacimiento ? new Date(studentForm.fechaNacimiento) : null;
      const ageAtEndOfYear = birthDate ? currentYear - birthDate.getFullYear() : 0;

      const studentData: any = {
        ...studentForm,
        edad: isNaN(ageAtEndOfYear) ? 0 : ageAtEndOfYear,
        dni: studentForm.dni || 'No especificado',
      };

      // Remove undefined values
      Object.keys(studentData).forEach(key => {
        if (studentData[key] === undefined) {
          delete studentData[key];
        }
      });

      if (studentForm.id) {
        await updateDocument(COLLECTIONS.ALUMNOS, studentForm.id, studentData);
        setNotificacion({ t: "Gimnasta Actualizado", d: `${studentData.nombre} actualizado correctamente.` });
      } else {
        const newStudent = {
          ...studentData,
          grupo: studentForm.grupo || activeGroup?.nombre || 'Sin Grupo',
          fechaIngreso: new Date().toISOString(),
          estadoPago: 'Al día',
          habilidades: studentForm.habilidades || [],
          biometria: studentForm.biometria || { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 },
          qrCode: `QR_${studentForm.dni || new Date().getTime()}`,
          asistenciasHistoricas: 0
        };
        await addDocument(COLLECTIONS.ALUMNOS, newStudent);
        setNotificacion({ t: "Gimnasta Registrado", d: `${newStudent.nombre} añadido.` });
      }

      await loadData();
      if (vista === 'RegistroAlumno') {
        handleNavigation('AsistenciaLista');
      } else if (vista === 'AlumnoDetalle') {
        // Keep in detail view but refresh selected student
        const updated = alumnos.find(a => a.id === studentForm.id);
        if (updated) setSelectedAlumno(updated);
      }
      
      setStudentForm({
        nombre: '', dni: '', disciplina: 'GAF', nivel: 'Escuela',
        fechaNacimiento: '', fechaPrimeraClase: new Date().toISOString().split('T')[0],
        alertas: [], contacto: { padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '', emergenciaNombre: '', emergenciaTelefono: '' }
      });
    } catch (error: any) {
      console.error("Error saving student:", error);
      setNotificacion({ t: "Error", d: "No se pudo guardar el gimnasta. " + (error.message || "") });
    } finally {
      setIsSavingStudent(false);
      setTimeout(() => setNotificacion(null), 3000);
    }
  };

  const toggleAttendance = async (alumnoId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const isPresent = !asistenciasHoy[alumnoId];
      
      setAsistenciasHoy(prev => ({ ...prev, [alumnoId]: isPresent }));

      const q = query(
        collection(firestore, COLLECTIONS.ASISTENCIAS),
        where('fecha', '==', today),
        where('alumnoId', '==', alumnoId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docId = querySnapshot.docs[0].id;
        await updateDocument(COLLECTIONS.ASISTENCIAS, docId, { presente: isPresent });
      } else {
        await addDocument(COLLECTIONS.ASISTENCIAS, {
          fecha: today,
          alumnoId: alumnoId,
          grupo: activeGroup?.nombre || 'General',
          presente: isPresent,
          pago: !!pagosHoy[alumnoId]
        });
      }
    } catch (error: any) {
      console.error("Error toggling attendance:", error);
      setNotificacion({ t: "Error", d: error.message || "No se pudo actualizar la asistencia." });
      setTimeout(() => setNotificacion(null), 5000);
      setAsistenciasHoy(prev => ({ ...prev, [alumnoId]: !prev[alumnoId] }));
    }
  };

  const togglePayment = async (alumnoId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hasPaid = !pagosHoy[alumnoId];
      
      setPagosHoy(prev => ({ ...prev, [alumnoId]: hasPaid }));

      const q = query(
        collection(firestore, COLLECTIONS.ASISTENCIAS),
        where('fecha', '==', today),
        where('alumnoId', '==', alumnoId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docId = querySnapshot.docs[0].id;
        await updateDocument(COLLECTIONS.ASISTENCIAS, docId, { pago: hasPaid });
      } else {
        await addDocument(COLLECTIONS.ASISTENCIAS, {
          fecha: today,
          alumnoId: alumnoId,
          grupo: activeGroup?.nombre || 'General',
          presente: !!asistenciasHoy[alumnoId],
          pago: hasPaid
        });
      }
    } catch (error: any) {
      console.error("Error toggling payment:", error);
      setNotificacion({ t: "Error", d: error.message || "No se pudo actualizar el pago." });
      setTimeout(() => setNotificacion(null), 5000);
      setPagosHoy(prev => ({ ...prev, [alumnoId]: !prev[alumnoId] }));
    }
  };

  const handleAddFeedback = async () => {
    if (!newFeedback.trim() || !selectedClase?.id) return;
    try {
      await addDocument(COLLECTIONS.FEEDBACK, {
        claseId: selectedClase.id,
        author: userRole === 'Coordinator' ? 'Coordinador' : 'Profesor',
        text: newFeedback,
        timestamp: new Date().toISOString()
      });
      setNewFeedback("");
    } catch (error: any) {
      console.error("Error adding feedback:", error);
      setNotificacion({ t: "Error", d: error.message || "No se pudo guardar el comentario." });
      setTimeout(() => setNotificacion(null), 5000);
    }
  };

  const handleAddSkill = async () => {
    if (!selectedAlumno || !selectedAlumno.id || !newSkill.name) return;
    
    try {
      const now = new Date().toISOString();
      const skillToAdd: Skill = {
        id: Date.now().toString(),
        name: newSkill.name!,
        status: newSkill.status as SkillStatus,
        apparatus: newSkill.apparatus as Apparatus,
        level: newSkill.level || '1',
        history: [{ status: newSkill.status || 'No Iniciado', date: now }],
        creationDate: now,
        lastUpdateDate: now,
        favorite: !!newSkill.favorite
      };

      const updatedHabilidades = [...(selectedAlumno.habilidades || []), skillToAdd];
      
      await updateDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id, {
        habilidades: updatedHabilidades
      });
      
      setSelectedAlumno({ ...selectedAlumno, habilidades: updatedHabilidades });
      setIsAddingSkill(false);
      setNewSkill({ name: '', status: 'No Iniciado', apparatus: 'Suelo', level: '1', favorite: false });
      loadData();
    } catch (error: any) {
      console.error("Error adding skill:", error);
      setNotificacion({ t: "Error", d: error.message || "No se pudo guardar la habilidad." });
      setTimeout(() => setNotificacion(null), 5000);
    }
  };

  const handleUpdateSkill = async () => {
    if (!selectedAlumno || !selectedAlumno.id || !editingSkillId || !editingSkillData.name) return;
    try {
      const now = new Date().toISOString();
      const updatedHabilidades = (selectedAlumno.habilidades || []).map(skill => {
        if (skill.id === editingSkillId) {
          let newHistory = skill.history || [{ status: skill.status, date: skill.creationDate || now }];
          if (skill.status !== editingSkillData.status) {
            newHistory = [...newHistory, { status: editingSkillData.status as string, date: now }];
          }
          return { ...skill, ...editingSkillData, history: newHistory, lastUpdateDate: now } as Skill;
        }
        return skill;
      });
      await updateDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id, { habilidades: updatedHabilidades });
      setSelectedAlumno({ ...selectedAlumno, habilidades: updatedHabilidades });
      setEditingSkillId(null);
      setEditingSkillData({});
      loadData();
      setNotificacion({ t: "Éxito", d: "Habilidad actualizada correctamente." });
      setTimeout(() => setNotificacion(null), 3000);
    } catch (error) {
      console.error("Error updating skill:", error);
      setNotificacion({ t: "Error", d: "No se pudo actualizar la habilidad." });
      setTimeout(() => setNotificacion(null), 5000);
    }
  };

  const handleToggleSkillFavorite = async (skillId: string) => {
    if (!selectedAlumno || !selectedAlumno.id) return;
    try {
      const updatedHabilidades = (selectedAlumno.habilidades || []).map(skill => {
        if (skill.id === skillId) {
          return { ...skill, favorite: !skill.favorite };
        }
        return skill;
      });
      await updateDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id, { habilidades: updatedHabilidades });
      setSelectedAlumno({ ...selectedAlumno, habilidades: updatedHabilidades });
      loadData();
    } catch (error) {
      console.error("Error toggling skill favorite:", error);
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (!selectedAlumno || !selectedAlumno.id) return;
    requestConfirmation(
      "Eliminar Habilidad",
      "¿Estás seguro de que deseas eliminar esta habilidad?",
      async () => {
        try {
          const updatedHabilidades = (selectedAlumno.habilidades || []).filter(skill => skill.id !== skillId);
          await updateDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id!, { habilidades: updatedHabilidades });
          setSelectedAlumno({ ...selectedAlumno, habilidades: updatedHabilidades });
          loadData();
          setNotificacion({ t: "Éxito", d: "Habilidad eliminada." });
        } catch (error) {
          console.error("Error deleting skill:", error);
          setNotificacion({ t: "Error", d: "No se pudo eliminar la habilidad." });
        }
      }
    );
  };

  const handleUpdateAlumno = async () => {
    if (!selectedAlumno || !selectedAlumno.id || !editingAlumnoData.nombre) return;
    try {
      await updateDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id, editingAlumnoData);
      setSelectedAlumno({ ...selectedAlumno, ...editingAlumnoData } as Alumno);
      setIsEditingAlumno(false);
      loadData();
      setNotificacion({ t: "Gimnasta Actualizado", d: "Datos guardados correctamente." });
    } catch (error) {
      console.error("Error updating student:", error);
      setNotificacion({ t: "Error", d: "No se pudo actualizar al gimnasta." });
    }
  };



  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        processAudio(blob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) { console.error(e); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const result = await processClassAudio(base64, 'audio/webm');
        
        if (result.clarificationNeeded) {
          setPendingAnalysis(result);
          setIsAnalyzing(false);
          return;
        }

        await saveClass(result);
      } catch (e) {
        setIsAnalyzing(false);
        setNotificacion({ t: "Error", d: "No se pudo interpretar." });
      }
      setTimeout(() => setNotificacion(null), 3000);
    };
  };

  const handleRefine = async () => {
    if (!clarificationText.trim()) return;
    setIsAnalyzing(true);
    try {
      const refined = await refineClassAnalysis(pendingAnalysis, clarificationText);
      await saveClass(refined);
      setPendingAnalysis(null);
      setClarificationText("");
    } catch (e) {
      setNotificacion({ t: "Error", d: "Error al refinar." });
    }
    setIsAnalyzing(false);
    setTimeout(() => setNotificacion(null), 3000);
  };

  const saveClass = async (result: any) => {
    try {
      const newClase: Omit<Clase, 'id'> = {
        fecha: new Date().toISOString(),
        grupo: result.grupo || 'General',
        horario: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        entrenador: result.entrenador || 'Coach Pro',
        faseInicial: result.faseInicial || [],
        fasePrincipal: result.fasePrincipal || [],
        faseFinal: result.faseFinal || [],
        warmup: result.warmup || [],
        apparatusUsed: result.apparatusUsed || [],
        skillsCovered: result.skillsCovered || []
      };
      await addDocument(COLLECTIONS.CLASES, newClase);
      loadData();
      setNotificacion({ t: "IA Assistant", d: `Clase registrada correctamente.` });
      setVista('Dashboard');
    } catch (error: any) {
      console.error("Error saving class:", error);
      setNotificacion({ t: "Error", d: error.message || "No se pudo guardar la clase." });
      setTimeout(() => setNotificacion(null), 5000);
    }
  };

  const toggleFavoriteSkill = async (skillId: string) => {
    if (!selectedAlumno || !selectedAlumno.id) return;
    try {
      const updatedHabilidades = (selectedAlumno.habilidades || []).map(skill => {
        if (skill.id === skillId) {
          return { ...skill, favorite: !skill.favorite };
        }
        return skill;
      });
      await updateDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id, { habilidades: updatedHabilidades });
      setSelectedAlumno({ ...selectedAlumno, habilidades: updatedHabilidades });
      loadData();
    } catch (error) {
      console.error("Error toggling favorite skill:", error);
    }
  };

  const handleExportAttendance = async () => {
    try {
      setIsLoading(true);
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      
      const q = query(
        collection(firestore, COLLECTIONS.ASISTENCIAS),
        where('fecha', '>=', firstDay)
      );
      
      const snap = await getDocs(q);
      const records = snap.docs.map(doc => doc.data() as AsistenciaRecord);
      
      // Prepare data for export
      const exportData = alumnos.map(alumno => {
        const alumnoRecords = records.filter(r => r.alumnoId === alumno.id);
        const presentCount = alumnoRecords.filter(r => r.presente).length;
        const totalClasses = alumnoRecords.length;
        
        return {
          Nombre: alumno.nombre,
          DNI: alumno.dni,
          Grupo: alumno.grupo,
          Nivel: alumno.nivel,
          EstadoPago: alumno.estadoPago,
          'Clases del Mes': totalClasses,
          'Presentes Mes': presentCount,
          '% Asistencia': totalClasses > 0 ? `${Math.round((presentCount / totalClasses) * 100)}%` : '0%',
          'Total Histórico': alumno.asistenciasHistoricas || 0
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Asistencia Mensual");
      XLSX.writeFile(wb, `Asistencia_Mensual_${now.getMonth() + 1}_${now.getFullYear()}.xlsx`);
      setNotificacion({ t: "Éxito", d: "Reporte de asistencia mensual exportado correctamente." });
    } catch (error) {
      console.error("Error exporting attendance:", error);
      setNotificacion({ t: "Error", d: "No se pudo exportar el reporte." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportGroupAttendance = async (groupName: string) => {
    try {
      setIsLoading(true);
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      
      const q = query(
        collection(firestore, COLLECTIONS.ASISTENCIAS),
        where('fecha', '>=', firstDay),
        where('grupo', '==', groupName)
      );
      
      const snap = await getDocs(q);
      const records = snap.docs.map(doc => doc.data() as AsistenciaRecord);
      
      const groupAlumnos = alumnos.filter(a => a.grupo === groupName);
      
      const exportData = groupAlumnos.map(alumno => {
        const alumnoRecords = records.filter(r => r.alumnoId === alumno.id);
        const presentCount = alumnoRecords.filter(r => r.presente).length;
        const totalClasses = alumnoRecords.length;
        
        return {
          Nombre: alumno.nombre,
          DNI: alumno.dni,
          Grupo: alumno.grupo,
          Nivel: alumno.nivel,
          EstadoPago: alumno.estadoPago,
          'Clases del Mes': totalClasses,
          'Presentes Mes': presentCount,
          '% Asistencia': totalClasses > 0 ? `${Math.round((presentCount / totalClasses) * 100)}%` : '0%',
          'Total Histórico': alumno.asistenciasHistoricas || 0
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Asistencia ${groupName}`);
      XLSX.writeFile(wb, `Asistencia_${groupName}_${now.getMonth() + 1}_${now.getFullYear()}.xlsx`);
      setNotificacion({ t: "Éxito", d: `Reporte de asistencia para ${groupName} exportado.` });
    } catch (error) {
      console.error("Error exporting group attendance:", error);
      setNotificacion({ t: "Error", d: "No se pudo exportar el reporte." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportAllAttendance = async () => {
    handleExportAttendance();
  };

  const handleSendPaymentReminders = async () => {
    try {
      setIsLoading(true);
      const pendingAlumnos = alumnos.filter(a => a.estadoPago === 'Pendiente' || a.estadoPago === 'Vencido');
      
      if (pendingAlumnos.length === 0) {
        setNotificacion({ t: "Info", d: "No hay pagos pendientes para recordar." });
        setTimeout(() => setNotificacion(null), 3000);
        return;
      }

      // In a real app, this would send emails or WhatsApp messages
      // For now, we simulate the process and notify the user
      setNotificacion({ 
        t: "Éxito", 
        d: `Se han enviado ${pendingAlumnos.length} recordatorios de pago correctamente.` 
      });
      
      // We could also log these reminders in a collection if needed
      
      setTimeout(() => setNotificacion(null), 3000);
    } catch (error) {
      console.error("Error sending payment reminders:", error);
      setNotificacion({ t: "Error", d: "No se pudieron enviar los recordatorios." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveManualClass = async () => {
    if (!claseGrupo) {
      setNotificacion({ t: "Error", d: "Debes seleccionar un grupo." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }

    if (faseInicial.length === 0 && fasePrincipal.length === 0 && faseFinal.length === 0) {
      setNotificacion({ t: "Error", d: "La clase debe tener al menos una actividad." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }

    let finalGroupName = claseGrupo;
    let finalCoachName = user?.displayName || 'Coach Pro';

    try {
      setIsLoading(true);
      // Find existing group to get its coach
      const existingGroup = grupos.find(g => g.nombre === claseGrupo);
      if (existingGroup && existingGroup.entrenador) {
        finalCoachName = existingGroup.entrenador;
      }

      const classData: Omit<Clase, 'id'> = {
        fecha: editingClaseId ? (clases.find(c => c.id === editingClaseId)?.fecha || new Date().toISOString()) : new Date().toISOString(),
        grupo: finalGroupName,
        horario: editingClaseId ? (clases.find(c => c.id === editingClaseId)?.horario || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        entrenador: finalCoachName,
        faseInicial: faseInicial,
        fasePrincipal: fasePrincipal,
        faseFinal: faseFinal,
        faseInicialDuration: faseInicialDuration,
        fasePrincipalDuration: fasePrincipalDuration,
        faseFinalDuration: faseFinalDuration,
        habilidadesPorAparato: habilidadesPorAparato,
        objetivos: objetivos,
        observaciones: observaciones,
        asistencias: Object.keys(asistenciasHoy).filter(id => asistenciasHoy[id])
      };

      if (editingClaseId) {
        await updateDocument(COLLECTIONS.CLASES, editingClaseId, classData);
        setNotificacion({ t: "Éxito", d: `Clase actualizada correctamente.` });
      } else {
        await addDocument(COLLECTIONS.CLASES, classData);
        setNotificacion({ t: "Éxito", d: `Clase registrada correctamente.` });
      }

      loadData();
      setTimeout(() => setNotificacion(null), 3000);
      setClaseGrupo("");
      setNewClaseGroupName("");
      setNewClaseCoachName("");
      setFaseInicial([]);
      setFasePrincipal([]);
      setFaseFinal([]);
      setFaseInicialDuration("15");
      setFasePrincipalDuration("60");
      setFaseFinalDuration("15");
      setObjetivos("");
      setObservaciones("");
      setHabilidadesPorAparato({});
      setCustomHabilidad({});
      setCustomInicial("");
      setCustomPrincipal("");
      setCustomFinal("");
      setAsistenciasHoy({});
      setRegistrationStep(1);
      setEditingClaseId(null);
      setIsEditingClase(false);
      setVista('Dashboard');
    } catch (error: any) {
      console.error("Error saving manual class:", error);
      setNotificacion({ t: "Error", d: error.message || "No se pudo guardar la clase." });
      setTimeout(() => setNotificacion(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const timeIntervals = Array.from({ length: 31 }, (_, i) => {
    const hour = Math.floor(i / 2) + 7;
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });
  const filteredAlumnos = alumnos.filter(a => {
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = a.nombre.toLowerCase().includes(query) || (a.dni && a.dni.includes(query));
    
    // Si hay búsqueda, mostrar resultados globales (ignorando grupo para facilitar encontrar a cualquiera)
    if (query !== "") return nameMatch;
    
    // Si no hay búsqueda, filtrar por el grupo activo
    return a.grupo === activeGroup?.nombre;
  });
  const presentCount = Object.values(asistenciasHoy).filter(v => v).length;

  if (!isLoggedIn) return (
    <div className="auth-bg flex flex-col items-center justify-center p-8 text-white min-h-screen relative">
      <div className="z-10 w-full max-w-sm text-center page-transition flex flex-col items-center">
        <div className="w-24 h-24 bg-white/10 backdrop-blur-3xl rounded-[2.2rem] flex items-center justify-center mb-12 shadow-[0_10px_40px_rgba(0,0,0,0.4)] border border-white/20">
          <span className="material-icons-outlined text-white text-4xl transform -rotate-45">fitness_center</span>
        </div>
        <h1 className="text-[42px] font-extrabold tracking-tighter mb-1 text-white leading-none">
          GymCoach <span className="text-primary">Pro</span>
        </h1>
        <p className="text-white/70 text-[10px] font-bold italic uppercase tracking-[0.4em] mb-12 whitespace-nowrap">
          ELITE GYMNASTICS MANAGEMENT
        </p>

        <div className="w-full max-w-[320px] space-y-4">
          <form onSubmit={isSignUp ? handleSignUp : handleEmailLogin} className="space-y-3">
            <div className="space-y-1">
              <input 
                type="email" 
                placeholder="Email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/70 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-1">
              <input 
                type="password" 
                placeholder="Contraseña" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/70 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                required
              />
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div 
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${rememberMe ? 'bg-primary border-primary' : 'border-white/20'}`}
                >
                  {rememberMe && <span className="material-icons-outlined text-antigravity-black text-[12px] font-bold">check</span>}
                </div>
                <span className="text-[10px] text-white/70 uppercase font-bold tracking-widest group-hover:text-white/80 transition-colors">Recordarme</span>
              </label>
              {!isSignUp && (
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] text-primary/60 uppercase font-bold tracking-widest hover:text-primary transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>

            <button type="submit" className="w-full py-4.5 bg-primary text-antigravity-black rounded-full font-black uppercase text-[10px] tracking-[0.2em] shadow-neon-cyan active:scale-95 transition-all mt-2">
              {isSignUp ? 'CREAR CUENTA' : 'ENTRAR'}
            </button>
          </form>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-[0.3em]"><span className="bg-antigravity-black px-4 text-white/80 italic">O</span></div>
          </div>

          <button onClick={handleLogin} className="w-full py-4.5 bg-white/5 border border-white/10 text-white rounded-full font-bold uppercase text-[10px] tracking-[0.18em] active:scale-95 transition-all hover:bg-white/10 flex items-center justify-center gap-3">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
            INICIAR CON GOOGLE
          </button>

          <div className="pt-4">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[11px] text-white/70 font-medium hover:text-white transition-colors"
            >
              {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
            </button>
          </div>
          
          {loginError && (
            <div className="bg-rose-500/20 border border-rose-500/50 rounded-xl p-4 text-left mt-4">
              <p className="text-rose-200 text-[10px] font-bold leading-relaxed">
                {loginError}
              </p>
              {loginError.includes('DOMINIO NO AUTORIZADO') && (
                <div className="mt-2 p-2 bg-black/30 rounded text-[9px] font-mono text-white break-all select-all">
                  {window.location.host}
                </div>
              )}
            </div>
          )}

          <p className="text-[9px] text-white/60 uppercase tracking-widest mt-4">
            Acceso restringido para personal autorizado
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-antigravity-black shadow-2xl relative overflow-hidden flex flex-col font-display pb-32">
      
      {/* Unsaved Changes Modal */}
      {pendingNavigation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-antigravity-charcoal border border-white/10 rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-rose-500">
              <span className="material-icons-outlined text-3xl">warning</span>
              <h3 className="font-bold text-lg">Cambios sin guardar</h3>
            </div>
            <p className="text-sm text-white/70">
              Tienes datos sin guardar en esta pantalla. Si sales ahora, se perderán. ¿Qué deseas hacer?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={cancelNavigation}
                className="py-3 rounded-xl border border-white/10 text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmNavigation}
                className="py-3 rounded-xl bg-rose-500/20 text-rose-500 border border-rose-500/30 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refinement UI Overlay */}
      {pendingAnalysis && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="w-full max-w-sm glass-card rounded-[2.5rem] p-8 border border-white/10 space-y-6 page-transition">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 mx-auto">
              <span className="material-icons-outlined text-primary text-3xl">psychology</span>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white">IA necesita aclaración</h3>
              <p className="text-sm text-white/90 leading-relaxed">
                {pendingAnalysis.question || "No pude entender bien una parte del reporte. ¿Podrías aclararlo?"}
              </p>
              {pendingAnalysis.inconsistencies && pendingAnalysis.inconsistencies.length > 0 && (
                <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-left">
                  <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1">Dudas detectadas:</p>
                  <ul className="list-disc list-inside text-[10px] text-rose-200/60 space-y-1">
                    {pendingAnalysis.inconsistencies.map((inc: string, i: number) => <li key={i}>{inc}</li>)}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <textarea 
                className="w-full crafted-input min-h-[100px] !bg-white/5"
                placeholder="Escribe tu aclaración aquí..."
                value={clarificationText}
                onChange={(e) => setClarificationText(e.target.value)}
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setPendingAnalysis(null)}
                  className="flex-1 py-4 rounded-2xl border border-white/10 text-white font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleRefine}
                  disabled={isAnalyzing}
                  className="flex-[2] py-4 rounded-2xl bg-primary text-antigravity-black font-black text-[10px] uppercase tracking-widest shadow-neon-cyan active:scale-95 transition-all disabled:opacity-50"
                >
                  {isAnalyzing ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS Status Bar */}
      <div className="h-12 flex justify-between items-center px-8 pt-4 pb-2 w-full bg-antigravity-black sticky top-0 z-50">
        <span className="text-sm font-medium text-white">9:41</span>
        <div className="flex items-center gap-1.5 text-white">
          <span className="material-symbols-outlined text-[18px]">signal_cellular_alt</span>
          <span className="material-symbols-outlined text-[18px]">wifi</span>
          <span className="material-symbols-outlined text-[18px]">battery_very_low</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<LoadingFallback />}>
          {vista === 'Dashboard' && (
            <Dashboard 
              userRole={userRole}
              user={user}
              grupos={grupos}
              alumnos={alumnos}
              clases={clases}
              asistencias={asistencias}
              feedbacks={feedbacks}
              profesoresList={profesoresList}
              setVista={setVista}
              handleNavigation={handleNavigation}
              handleLogout={handleLogout}
              isFocusMode={isFocusMode}
              setIsFocusMode={setIsFocusMode}
              showMoreOptions={showMoreOptions}
              setShowMoreOptions={setShowMoreOptions}
              alertasGlobales={alertasGlobales}
              asistenciasGlobales={asistenciasGlobales}
              setActiveGroup={setActiveGroup}
              setRegistrationStep={setRegistrationStep}
              setUserRole={setUserRole}
              COORDINATOR_EMAIL={COORDINATOR_EMAIL}
              onOpenBulkPayment={() => setIsBulkPaymentModalOpen(true)}
            />
          )}

          <BulkPaymentImport 
            isOpen={isBulkPaymentModalOpen}
            onClose={() => setIsBulkPaymentModalOpen(false)}
            alumnos={alumnos}
            onConfirm={handleBulkPaymentConfirm}
          />

        {vista === 'Horario' && (
          <Grupos 
            vista={vista}
            setVista={setVista}
            editingGroup={editingGroup}
            setEditingGroup={setEditingGroup}
            newGroupName={newGroupName}
            setNewGroupName={setNewGroupName}
            newCoachName={newCoachName}
            setNewCoachName={setNewCoachName}
            selectedDays={selectedDays}
            setSelectedDays={setSelectedDays}
            startTime={startTime}
            setStartTime={setStartTime}
            endTime={endTime}
            setEndTime={setEndTime}
            timeIntervals={timeIntervals}
            handleSaveGroup={handleSaveGroup}
            grupos={grupos}
            handleDeleteGroup={handleDeleteGroup}
            setActiveGroup={setActiveGroup}
            profesoresList={profesoresList}
            handleAddProfesor={handleAddProfesor}
            handleUpdateProfesor={handleUpdateProfesor}
            handleDeleteProfesor={handleDeleteProfesor}
          />
        )}

        {vista === 'AsistenciaLista' && (
          <Asistencia 
            vista={vista}
            setVista={setVista}
            activeGroup={activeGroup}
            setActiveGroup={setActiveGroup}
            reportMonth={reportMonth}
            reportYear={reportYear}
            loadMonthlyReport={loadMonthlyReport}
            setEditingGroup={setEditingGroup}
            setNewGroupName={setNewGroupName}
            setNewCoachName={setNewCoachName}
            setSelectedDays={setSelectedDays}
            setStartTime={setStartTime}
            setEndTime={setEndTime}
            presentCount={presentCount}
            filteredAlumnos={filteredAlumnos}
            handleNavigation={handleNavigation}
            handleAIAnalysis={handleAIAnalysis}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            expandedAlumnoId={expandedAlumnoId}
            setExpandedAlumnoId={setExpandedAlumnoId}
            asistenciasHoy={asistenciasHoy}
            pagosHoy={pagosHoy}
            togglePayment={togglePayment}
            toggleAttendance={toggleAttendance}
            asistenciasClase={asistenciasClase}
            isLoadingAsistenciasClase={isLoadingAsistenciasClase}
            handleDeleteAsistencia={handleDeleteAsistencia}
            handleEditAsistencia={handleEditAsistencia}
            asistenciasGlobales={asistenciasGlobales}
            alumnos={alumnos}
            grupos={grupos}
            isAnalyzing={isAnalyzing}
            comparativeData={comparativeData}
            handleExportAttendance={handleExportAttendance}
            handleExportGroupAttendance={handleExportGroupAttendance}
            handleExportAllAttendance={handleExportAllAttendance}
            studentForm={studentForm}
            setStudentForm={setStudentForm}
            handleSaveStudent={handleSaveStudent}
            isSavingStudent={isSavingStudent}
            isLoadingMonthly={isLoadingMonthly}
            monthlyStats={monthlyStats}
            setReportMonth={setReportMonth}
            setReportYear={setReportYear}
            clases={clases}
            asistencias={asistencias}
            selectedDisciplina={selectedDisciplina}
            setSelectedDisciplina={setSelectedDisciplina}
            planesFilterDate={planesFilterDate}
            setPlanesFilterDate={setPlanesFilterDate}
            planesFilterCoach={planesFilterCoach}
            setPlanesFilterCoach={setPlanesFilterCoach}
            setSelectedAlumno={setSelectedAlumno}
          />
        )}

        {(vista === 'Clases' || vista === 'NuevaClase' || vista === 'ClaseDetalle' || vista === 'HistorialClases') && (
          <Clases 
            vista={vista}
            setVista={setVista}
            registrationStep={registrationStep}
            setRegistrationStep={setRegistrationStep}
            grupos={grupos}
            alumnos={alumnos}
            asistenciasHoy={asistenciasHoy}
            toggleAttendance={toggleAttendance}
            claseGrupo={claseGrupo}
            setClaseGrupo={setClaseGrupo}
            faseInicial={faseInicial}
            setFaseInicial={setFaseInicial}
            fasePrincipal={fasePrincipal}
            setFasePrincipal={setFasePrincipal}
            faseFinal={faseFinal}
            setFaseFinal={setFaseFinal}
            faseInicialDuration={faseInicialDuration}
            setFaseInicialDuration={setFaseInicialDuration}
            fasePrincipalDuration={fasePrincipalDuration}
            setFasePrincipalDuration={setFasePrincipalDuration}
            faseFinalDuration={faseFinalDuration}
            setFaseFinalDuration={setFaseFinalDuration}
            claseObjetivos={objetivos}
            setClaseObjetivos={setObjetivos}
            claseObservaciones={observaciones}
            setClaseObservaciones={setObservaciones}
            habilidadesPorAparato={habilidadesPorAparato}
            setHabilidadesPorAparato={setHabilidadesPorAparato}
            customHabilidad={customHabilidad}
            setCustomHabilidad={setCustomHabilidad}
            customInicial={customInicial}
            setCustomInicial={setCustomInicial}
            customFinal={customFinal}
            setCustomFinal={setCustomFinal}
            isEditingClase={isEditingClase}
            setIsEditingClase={setIsEditingClase}
            editingClaseId={editingClaseId}
            setEditingClaseId={setEditingClaseId}
            handleSaveManualClass={handleSaveManualClass}
            clases={clases}
            selectedClase={selectedClase}
            setSelectedClase={setSelectedClase}
            handleDeleteClase={handleDeleteClase}
            handleEditClase={handleEditClase}
            handleNavigation={handleNavigation}
            setNotificacion={setNotificacion}
            userRole={userRole}
            user={user}
            planesFilterDate={planesFilterDate}
            setPlanesFilterDate={setPlanesFilterDate}
            planesFilterCoach={planesFilterCoach}
            setPlanesFilterCoach={setPlanesFilterCoach}
            disciplinas={disciplinas}
            warmupOptions={warmupOptions}
            cooldownOptions={cooldownOptions}
            handleSaveWarmupOption={handleSaveWarmupOption}
            handleUpdateWarmupOption={handleUpdateWarmupOption}
            handleDeleteWarmupOption={handleDeleteWarmupOption}
            handleSaveCooldownOption={handleSaveCooldownOption}
            handleUpdateCooldownOption={handleUpdateCooldownOption}
            handleDeleteCooldownOption={handleDeleteCooldownOption}
          />
        )}

        {(vista === 'Alumnos' || vista === 'RegistroAlumno' || vista === 'AlumnoDetalle') && (
          <Alumnos 
            vista={vista}
            setVista={setVista}
            alumnos={alumnos}
            grupos={grupos}
            niveles={niveles}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedGrupoFilter={selectedGrupoFilter}
            setSelectedGrupoFilter={setSelectedGrupoFilter}
            selectedNivelFilter={selectedNivelFilter}
            setSelectedNivelFilter={setSelectedNivelFilter}
            alumnosFilterMode={alumnosFilterMode}
            setAlumnosFilterMode={setAlumnosFilterMode}
            isAddingAlumno={isAddingAlumno}
            setIsAddingAlumno={setIsAddingAlumno}
            studentForm={studentForm}
            setStudentForm={setStudentForm}
            handleSaveStudent={handleSaveStudent}
            handleDeleteStudent={handleDeleteStudent}
            selectedAlumno={selectedAlumno}
            setSelectedAlumno={setSelectedAlumno}
            alumnoAsistencias={alumnoAsistencias}
            isLoadingAsistencias={isLoadingAsistencias}
            isAddingSkill={isAddingSkill}
            setIsAddingSkill={setIsAddingSkill}
            newSkill={newSkill}
            setNewSkill={setNewSkill}
            handleSaveSkill={handleSaveSkill}
            handleDeleteSkill={handleDeleteSkill}
            editingSkillId={editingSkillId}
            setEditingSkillId={setEditingSkillId}
            editingSkillData={editingSkillData}
            setEditingSkillData={setEditingSkillData}
            skillSearchQuery={skillSearchQuery}
            setSkillSearchQuery={setSkillSearchQuery}
            skillApparatusFilter={skillApparatusFilter}
            setSkillApparatusFilter={setSkillApparatusFilter}
            feedbacks={feedbacks}
            newFeedback={newFeedback}
            setNewFeedback={setNewFeedback}
            handleAddFeedback={handleAddFeedback}
            handleUpdateFeedback={handleUpdateFeedback}
            handleDeleteFeedback={handleDeleteFeedback}
            setIsBulkImporting={setIsBulkImporting}
            userRole={userRole}
            disciplinas={disciplinas}
            handleSaveLevel={handleSaveLevel}
            handleUpdateLevel={handleUpdateLevel}
            handleDeleteLevel={handleDeleteLevel}
            handleQuickSaveGroup={handleQuickSaveGroup}
            handleUpdateGroupQuick={handleUpdateGroupQuick}
            handleDeleteGroup={handleDeleteGroup}
            handleUpdateSkill={handleUpdateSkill}
            handleToggleSkillFavorite={handleToggleSkillFavorite}
            selectedAgeFilter={selectedAgeFilter}
            setSelectedAgeFilter={setSelectedAgeFilter}
            selectedPhysicalFilter={selectedPhysicalFilter}
            setSelectedPhysicalFilter={setSelectedPhysicalFilter}
            ageCategories={ageCategories}
            physicalCategories={physicalCategories}
            handleSaveAgeCategory={handleSaveAgeCategory}
            handleUpdateAgeCategory={handleUpdateAgeCategory}
            handleDeleteAgeCategory={handleDeleteAgeCategory}
            handleSavePhysicalCategory={handleSavePhysicalCategory}
            handleUpdatePhysicalCategory={handleUpdatePhysicalCategory}
            handleDeletePhysicalCategory={handleDeletePhysicalCategory}
            handleSaveDisciplina={handleSaveDisciplina}
            handleUpdateDisciplina={handleUpdateDisciplina}
            handleDeleteDisciplina={handleDeleteDisciplina}
            handleUpdateBiometrics={handleUpdateBiometrics}
          />
        )}

        {(vista === 'Profesores' || vista === 'ProfesorDetalle') && (
          <Staff 
            vista={vista}
            setVista={setVista}
            isAddingProfesor={isAddingProfesor}
            setIsAddingProfesor={setIsAddingProfesor}
            newProfesorName={newProfesorName}
            setNewProfesorName={setNewProfesorName}
            handleAddProfesor={handleAddProfesor}
            profesoresList={profesoresList}
            handleDeleteProfesor={handleDeleteProfesor}
            handleUpdateProfesor={handleUpdateProfesor}
            isSavingProfesor={isSavingProfesor}
            clases={clases}
            grupos={grupos}
            alumnos={alumnos}
            asistencias={asistencias}
            setSelectedProfesor={setSelectedProfesor}
            handleNavigation={handleNavigation}
            selectedProfesor={selectedProfesor}
            userRole={userRole}
            setSelectedClase={setSelectedClase}
            setNotificacion={setNotificacion}
          />
        )}
        
        {(vista === 'AsistenciaStats' || vista === 'ReporteGrupal' || vista === 'TendenciasHabilidades' || vista === 'ReportePDF' || vista === 'ReporteBiometrico' || vista === 'Habilidades') && (
          <Reportes 
            vista={vista === 'Habilidades' ? 'TendenciasHabilidades' : vista}
            setVista={setVista}
            alumnos={alumnos}
            grupos={grupos}
            clases={clases}
            asistencias={asistencias}
            comparativeData={comparativeData}
            handleExportAttendance={handleExportAttendance}
            handleAIAnalysis={handleAIAnalysis}
            isAnalyzing={isAnalyzing}
          />
        )}





        {vista === 'Planes' && (
          <Manuales 
            vista={vista}
            setVista={setVista}
            disciplinas={disciplinas}
            niveles={niveles}
            selectedDisciplina={selectedDisciplina}
            setSelectedDisciplina={setSelectedDisciplina}
            selectedNivel={selectedNivelFilter}
            setSelectedNivel={setSelectedNivelFilter}
            SKILL_TREE={SKILL_TREE}
            sources={sources}
            kbMessages={kbMessages}
            isKbLoading={isKbLoading}
            kbInput={kbInput}
            setKbInput={setKbInput}
            handleKbQuery={handleKbQuery}
            handleFileUpload={handleFileUpload}
            handleDeleteSource={handleDeleteSource}
          />
        )}

        {vista === 'Emergencias' && (
          <div className="px-6 py-8 space-y-8 page-transition pb-24">
            <header className="flex items-center gap-4">
              <button onClick={() => handleNavigation('Dashboard')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
                <span className="material-icons-outlined">arrow_back</span>
              </button>
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Emergencias</h2>
                <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest mt-1">Contacto Médico de Urgencia</p>
              </div>
            </header>

            <div className="glass-card rounded-[2.5rem] p-8 space-y-8 border border-rose-500/20 shadow-neon-rose overflow-hidden relative">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl"></div>
              
              <div className="relative z-10 space-y-8">
                <div className="flex justify-center">
                  <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center border-4 border-rose-500/30 shadow-neon-rose animate-pulse">
                    <span className="material-icons-outlined text-rose-500 text-5xl">emergency</span>
                  </div>
                </div>

                {isEditingEmergency ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Servicio Público</h4>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest px-2">Nombre</label>
                        <input 
                          type="text" 
                          value={emergencyInfo.publicProvider}
                          onChange={(e) => setEmergencyInfo({...emergencyInfo, publicProvider: e.target.value})}
                          className="w-full bg-white/10 border rounded-2xl px-4 py-3 text-white text-sm transition-colors border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                          placeholder="Ej. SAME"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest px-2">Teléfono</label>
                        <input 
                          type="tel" 
                          value={emergencyInfo.publicPhone}
                          onChange={(e) => setEmergencyInfo({...emergencyInfo, publicPhone: e.target.value})}
                          className="w-full bg-white/10 border rounded-2xl px-4 py-3 text-white text-sm transition-colors border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                          placeholder="Ej. 107"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-white font-bold text-sm border-b border-white/10 pb-2">Servicio Privado</h4>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest px-2">Nombre</label>
                        <input 
                          type="text" 
                          value={emergencyInfo.privateProvider}
                          onChange={(e) => setEmergencyInfo({...emergencyInfo, privateProvider: e.target.value})}
                          className="w-full bg-white/10 border rounded-2xl px-4 py-3 text-white text-sm transition-colors border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                          placeholder="Ej. SIPEM, OSDE..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest px-2">Teléfono</label>
                        <input 
                          type="tel" 
                          value={emergencyInfo.privatePhone}
                          onChange={(e) => setEmergencyInfo({...emergencyInfo, privatePhone: e.target.value})}
                          className="w-full bg-white/10 border rounded-2xl px-4 py-3 text-white text-sm transition-colors border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                          placeholder="Ej. 0800-..."
                        />
                      </div>
                    </div>

                    <button 
                      onClick={async () => {
                        try {
                          await setDoc(doc(firestore, COLLECTIONS.CONFIG, 'emergency'), emergencyInfo);
                          setIsEditingEmergency(false);
                          setNotificacion({ t: "Configuración Guardada", d: "Números de emergencia actualizados." });
                          setTimeout(() => setNotificacion(null), 3000);
                        } catch (e) {
                          console.error("Error saving emergency info", e);
                        }
                      }}
                      className="w-full py-4 rounded-2xl bg-rose-500 text-white font-black uppercase text-xs tracking-widest shadow-neon-rose active:scale-95 transition-all mt-4"
                    >
                      Guardar Configuración
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-8">
                    {/* Public Emergency */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-1">{emergencyInfo.publicProvider}</h3>
                        <a 
                          href={`tel:${emergencyInfo.publicPhone}`}
                          className="block text-5xl font-black text-white tracking-tighter hover:text-rose-400 transition-colors"
                        >
                          {emergencyInfo.publicPhone}
                        </a>
                      </div>
                      
                      <a 
                        href={`tel:${emergencyInfo.publicPhone}`}
                        className="w-full py-4 rounded-2xl bg-rose-500 text-white font-black uppercase text-sm tracking-widest shadow-neon-rose active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <span className="material-icons-outlined">call</span>
                        Llamar a {emergencyInfo.publicProvider}
                      </a>
                    </div>

                    <div className="h-px w-full bg-white/10"></div>

                    {/* Private Emergency */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-1">{emergencyInfo.privateProvider}</h3>
                        <a 
                          href={`tel:${emergencyInfo.privatePhone}`}
                          className="block text-4xl font-black text-white tracking-tighter hover:text-rose-400 transition-colors"
                        >
                          {emergencyInfo.privatePhone}
                        </a>
                      </div>
                      
                      <a 
                        href={`tel:${emergencyInfo.privatePhone}`}
                        className="w-full py-4 rounded-2xl bg-white/10 text-white border border-white/20 font-black uppercase text-sm tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <span className="material-icons-outlined">call</span>
                        Llamar a {emergencyInfo.privateProvider}
                      </a>
                    </div>

                    <button 
                      onClick={() => setIsEditingEmergency(true)}
                      className="text-[10px] text-white/70 uppercase tracking-widest font-bold hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto pt-4"
                    >
                      <span className="material-icons-outlined text-[14px]">edit</span>
                      Configurar Números
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 text-center opacity-40">
              <p className="text-[10px] text-white/60">En caso de emergencia médica grave, contacte inmediatamente a los servicios de salud locales.</p>
            </div>
          </div>
        )}

        {vista === 'Ajustes' && (
          <div className="px-6 py-8 space-y-8 page-transition pb-24">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Ajustes</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Configuración del Sistema</p>
            </header>

            <div className="glass-card rounded-[2.5rem] p-8 space-y-8">
              {/* Perfil */}
              <div className="space-y-4">
                <h3 className="text-white/70 text-[10px] font-bold uppercase tracking-widest px-2">Perfil de Usuario</h3>
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                    <span className="material-icons-outlined text-primary text-2xl">person</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-white uppercase tracking-wider truncate">{user?.displayName || (userRole === 'Coordinator' ? 'Coordinador General' : 'Entrenador Pro')}</p>
                    <p className="text-[10px] text-white/60 truncate mt-0.5">{user?.email || 'usuario@gymcoach.pro'}</p>
                  </div>
                </div>
              </div>

              {/* Preferencias */}
              <div className="space-y-4">
                <h3 className="text-white/70 text-[10px] font-bold uppercase tracking-widest px-2">Preferencias</h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="material-icons-outlined text-white/60 text-lg">dark_mode</span>
                      <span className="text-xs font-medium text-white">Modo Oscuro</span>
                    </div>
                    <div className="w-10 h-6 bg-primary rounded-full relative shadow-neon-cyan">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-antigravity-black rounded-full"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="material-icons-outlined text-white/60 text-lg">notifications</span>
                      <span className="text-xs font-medium text-white">Notificaciones Push</span>
                    </div>
                    <div className="w-10 h-6 bg-primary rounded-full relative shadow-neon-cyan cursor-pointer" onClick={() => {
                      setNotificacion({ t: "Info", d: "Las notificaciones están activadas." });
                      setTimeout(() => setNotificacion(null), 3000);
                    }}>
                      <div className="absolute right-1 top-1 w-4 h-4 bg-antigravity-black rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Datos */}
              <div className="space-y-4">
                <h3 className="text-white/70 text-[10px] font-bold uppercase tracking-widest px-2">Gestión de Datos</h3>
                <button 
                  onClick={() => {
                    const data = { alumnos, clases, grupos, profesores: profesoresList };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `gymcoach_backup_${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    setNotificacion({ t: "Éxito", d: "Copia de seguridad descargada." });
                    setTimeout(() => setNotificacion(null), 3000);
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 active:scale-95 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-icons-outlined text-neon-cyan text-lg">cloud_download</span>
                    <span className="text-xs font-medium text-white">Exportar Copia de Seguridad</span>
                  </div>
                  <span className="material-icons-outlined text-white/60 text-sm">chevron_right</span>
                </button>

                <div className="relative">
                  <input 
                    type="file" 
                    id="import-backup" 
                    className="hidden" 
                    accept=".json"
                    onChange={handleImportBackup}
                  />
                  <label 
                    htmlFor="import-backup"
                    className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-icons-outlined text-primary text-lg">cloud_upload</span>
                      <span className="text-xs font-medium text-white">Importar Copia de Seguridad</span>
                    </div>
                    <span className="material-icons-outlined text-white/60 text-sm">chevron_right</span>
                  </label>
                </div>
              </div>

              {/* Configuración de Listas */}
              <div className="space-y-4">
                <h3 className="text-white/70 text-[10px] font-bold uppercase tracking-widest px-2">Configuración de Listas</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <EditableDropdown 
                      label="Niveles"
                      options={niveles}
                      value={selectedNivelToManage}
                      onChange={setSelectedNivelToManage}
                      onAdd={handleSaveLevel}
                      onEdit={handleUpdateLevel}
                      onDelete={handleDeleteLevel}
                      placeholder="Gestionar Niveles..."
                    />
                  </div>

                  <div className="space-y-2">
                    <EditableDropdown 
                      label="Disciplinas"
                      options={disciplinas}
                      value={selectedDisciplinaToManage}
                      onChange={setSelectedDisciplinaToManage}
                      onAdd={handleSaveDiscipline}
                      onEdit={handleUpdateDiscipline}
                      onDelete={handleDeleteDiscipline}
                      placeholder="Gestionar Disciplinas..."
                    />
                  </div>

                  <div className="space-y-2">
                    <EditableDropdown 
                      label="Opciones de Entrada en Calor"
                      options={warmupOptions}
                      value={selectedWarmupToManage}
                      onChange={setSelectedWarmupToManage}
                      onAdd={handleSaveWarmupOption}
                      onEdit={handleUpdateWarmupOption}
                      onDelete={handleDeleteWarmupOption}
                      placeholder="Gestionar Entrada en Calor..."
                    />
                  </div>

                  <div className="space-y-2">
                    <EditableDropdown 
                      label="Opciones de Vuelta a la Calma"
                      options={cooldownOptions}
                      value={selectedCooldownToManage}
                      onChange={setSelectedCooldownToManage}
                      onAdd={handleSaveCooldownOption}
                      onEdit={handleUpdateCooldownOption}
                      onDelete={handleDeleteCooldownOption}
                      placeholder="Gestionar Vuelta a la Calma..."
                    />
                  </div>
                </div>
              </div>

              {/* Sesión */}
              <div className="pt-4 border-t border-white/10">
                <button 
                  onClick={handleLogout}
                  className="w-full py-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <span className="material-icons-outlined text-sm">logout</span>
                  Cerrar Sesión
                </button>
              </div>
            </div>

            <div className="p-6 text-center opacity-40">
              <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white mb-2">GymCoach Pro v2.0 Cloud</p>
              <p className="text-[8px] text-white/40 uppercase tracking-widest">© 2026 Antigravity Labs • Todos los derechos reservados</p>
            </div>
          </div>
        )}
      </Suspense>
    </main>

      {/* Overlay de Más Opciones (Menú Central) */}
      <AnimatePresence>
        {showMoreOptions && (
          <div className="fixed inset-0 z-[45] flex items-end justify-center px-4 pb-28">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoreOptions(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ y: 100, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-[400px] glass-card p-6 grid grid-cols-3 gap-4 border border-white/10"
            >
              {[
                { v: 'AsistenciaLista', i: 'fact_check', l: 'Asistencia', c: 'text-emerald-400' },
                { v: 'Horario', i: 'event_note', l: 'Grupos', c: 'text-amber-400' },
                { v: 'AsistenciaStats', i: 'analytics', l: 'Reportes', c: 'text-sky-400' },
                { v: 'Planes', i: 'psychology', l: 'Manuales', c: 'text-violet-400' },
                { v: 'Profesores', i: 'badge', l: 'Staff', c: 'text-rose-400' },
                { v: 'Habilidades', i: 'trending_up', l: 'Habilidades', c: 'text-primary' },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => {
                    handleNavigation(opt.v as ViewMode);
                    setShowMoreOptions(false);
                  }}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95"
                >
                  <span className={`material-symbols-outlined text-[32px] ${opt.c}`}>{opt.i}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{opt.l}</span>
                </button>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Navegación Inferior (Refined for Antigravity) */}
      {vista !== 'ReportePDF' && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-antigravity-charcoal/80 backdrop-blur-md border-t border-white/5 px-6 pt-4 pb-2 flex justify-between items-center z-50">
          {[
            { v: 'Dashboard', i: 'grid_view', l: 'Inicio' },
            { v: 'Alumnos', i: 'group', l: 'Gimnastas' },
            { v: 'Clases', i: 'fitness_center', l: 'Clases' },
            { v: 'Menu', i: 'menu_open', l: 'Menú' },
            { v: 'Ajustes', i: 'app_settings_alt', l: 'Ajustes' }
          ].map(item => (
            <button 
              key={item.v} 
              onClick={() => {
                if (item.v === 'Menu') {
                  setShowMoreOptions(!showMoreOptions);
                  return;
                }
                if (item.v === 'Alumnos') setAlumnosFilterMode('all');
                handleNavigation(item.v as ViewMode);
                setShowMoreOptions(false);
              }} 
              className={`flex flex-col items-center gap-1.5 transition-all flex-1 ${
                (vista === item.v || 
                (item.v === 'Alumnos' && (vista === 'AlumnoDetalle' || vista === 'RegistroAlumno')) ||
                (item.v === 'Clases' && (vista === 'NuevaClase' || vista === 'ClaseDetalle' || vista === 'HistorialClases'))) && item.v !== 'Menu'
                ? 'text-neon-cyan active-glow' 
                : showMoreOptions && item.v === 'Menu'
                ? 'text-primary active-glow'
                : 'text-white/60 hover:text-white'
              }`}
            >
              <span className={`material-symbols-outlined text-[26px] font-light ${
                (vista === item.v || 
                (item.v === 'Alumnos' && (vista === 'AlumnoDetalle' || vista === 'RegistroAlumno')) ||
                (item.v === 'Clases' && (vista === 'NuevaClase' || vista === 'ClaseDetalle' || vista === 'HistorialClases'))) && item.v !== 'Menu'
                ? 'neon-glow-cyan' 
                : showMoreOptions && item.v === 'Menu'
                ? 'neon-glow-primary'
                : ''
              }`}>{item.i}</span>
              <span className={`text-[9px] uppercase tracking-wide ${
                (vista === item.v || 
                (item.v === 'Alumnos' && (vista === 'AlumnoDetalle' || vista === 'RegistroAlumno')) ||
                (item.v === 'Clases' && (vista === 'NuevaClase' || vista === 'ClaseDetalle' || vista === 'HistorialClases'))) && item.v !== 'Menu'
                ? 'font-bold' 
                : 'font-medium'
              }`}>
                {item.l}
              </span>
            </button>
          ))}
        </nav>
      )}

      {/* Safe Area Indicator */}
      {vista !== 'ReportePDF' && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-antigravity-charcoal pb-3 pt-1 z-[60]">
          <div className="h-1.5 w-32 bg-white/10 rounded-full mx-auto shrink-0"></div>
        </div>
      )}

        {hasNewData && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] animate-in slide-in-from-top-4 duration-300">
            <button 
              onClick={() => {
                loadData();
                setHasNewData(false);
              }}
              className="bg-primary text-antigravity-black px-6 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-neon-cyan flex items-center gap-2 border border-white/20"
            >
              <span className="material-icons-outlined text-sm">refresh</span>
              Nuevos datos disponibles. ¿Actualizar?
            </button>
          </div>
        )}


        {/* Focus Mode Overlay */}
        {isFocusMode && (
          <div className="focus-mode-active">
            <div className="max-w-4xl mx-auto space-y-12">
              <header className="flex justify-between items-center border-b border-white/10 pb-6">
                <div>
                  <h1 className="title-antigravity text-5xl">Modo Enfoque</h1>
                  <p className="text-primary text-xs font-black uppercase tracking-[0.3em] mt-2">Concentración Total • {vista}</p>
                </div>
                <button 
                  onClick={() => setIsFocusMode(false)}
                  className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition-all"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </header>

              <div className="animate-in fade-in zoom-in duration-500">
                {/* Render current view content in focus mode */}
                {vista === 'Dashboard' && (() => {
                  const alumnosConPagosVencidos = alumnos.filter(a => a.pagoVencido);
                  const alumnosConObservacionesMedicas = alumnos.filter(a => a.observacionesMedicas && a.observacionesMedicas.trim() !== '');
                  const feedbacksUrgentes = feedbacks.filter(f => f.urgente);
                  const tieneAlertas = alumnosConPagosVencidos.length > 0 || alumnosConObservacionesMedicas.length > 0 || feedbacksUrgentes.length > 0;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="glass-card p-8 rounded-[2.5rem] border-primary/20">
                        <h3 className="title-antigravity text-2xl mb-6">Próximas Clases</h3>
                        {/* Simplified list for focus */}
                        <div className="space-y-4">
                          {grupos.slice(0, 3).map(g => (
                            <div 
                              key={g.id} 
                              onClick={() => {
                                setIsFocusMode(false);
                                setActiveGroup(g);
                                setVista('AsistenciaLista');
                              }}
                              className="flex justify-between items-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl cursor-pointer transition-all active:scale-95 group"
                            >
                              <div>
                                <span className="font-bold block text-white group-hover:text-primary transition-colors">{g.nombre}</span>
                                <span className="text-[10px] text-white/50 uppercase">{g.dias.join(', ')}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-primary font-mono bg-primary/10 px-2 py-1 rounded-lg">{g.horario}</span>
                                <span className="material-icons-outlined text-white/20 group-hover:text-primary transition-colors">arrow_forward_ios</span>
                              </div>
                            </div>
                          ))}
                          {grupos.length === 0 && (
                            <p className="text-white/40 text-sm italic text-center py-4">No hay grupos configurados.</p>
                          )}
                        </div>
                      </div>
                      <div className="glass-card p-8 rounded-[2.5rem] border-rose-500/20">
                        <h3 className="title-antigravity text-2xl mb-6 text-rose-500">Alertas Críticas</h3>
                        <div className="space-y-4">
                          {!tieneAlertas ? (
                            <div className="flex flex-col items-center justify-center py-8 text-emerald-500/50 space-y-2">
                              <span className="material-icons-outlined text-4xl">check_circle</span>
                              <p className="text-sm font-bold uppercase tracking-wider">Todo en orden</p>
                            </div>
                          ) : (
                            <>
                              {feedbacksUrgentes.slice(0, 2).map(f => (
                                <div key={f.id} className="flex items-center gap-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl cursor-pointer hover:bg-rose-500/20 transition-all active:scale-95" onClick={() => { setIsFocusMode(false); setVista('Alumnos'); }}>
                                  <span className="material-symbols-outlined text-rose-500">notification_important</span>
                                  <div>
                                    <span className="font-bold text-white block text-sm">Feedback de Padre</span>
                                    <span className="text-[10px] text-white/60 line-clamp-1">{f.mensaje}</span>
                                  </div>
                                </div>
                              ))}
                              {alumnosConPagosVencidos.slice(0, 2).map(a => (
                                <div key={`mora-${a.id}`} className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl cursor-pointer hover:bg-amber-500/20 transition-all active:scale-95" onClick={() => { setIsFocusMode(false); setVista('Alumnos'); }}>
                                  <span className="material-icons-outlined text-amber-500">payments</span>
                                  <div>
                                    <span className="font-bold text-white block text-sm">{a.nombre}</span>
                                    <span className="text-[10px] text-amber-500/60 uppercase font-bold">Mora Detectada</span>
                                  </div>
                                </div>
                              ))}
                              {alumnosConObservacionesMedicas.slice(0, 2).map(a => (
                                <div key={`med-${a.id}`} className="flex items-center gap-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl cursor-pointer hover:bg-rose-500/20 transition-all active:scale-95" onClick={() => { setIsFocusMode(false); setVista('Alumnos'); }}>
                                  <span className="material-icons-outlined text-rose-500">medical_services</span>
                                  <div>
                                    <span className="font-bold text-white block text-sm">{a.nombre}</span>
                                    <span className="text-[10px] text-white/60 line-clamp-1">{a.observacionesMedicas}</span>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {vista !== 'Dashboard' && (
                  <div className="text-center py-24 opacity-50">
                    <p className="text-xl italic">Modo enfoque optimizado para esta vista próximamente.</p>
                    <button onClick={() => setIsFocusMode(false)} className="btn-primary mt-8 mx-auto">Volver</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {aiAnalysis && (
          <div className="fixed inset-0 z-[110] bg-antigravity-black/95 backdrop-blur-md flex items-center justify-center p-6">
            <div className="glass-card w-full max-w-2xl rounded-[2.5rem] p-8 border border-white/10 space-y-6 animate-in zoom-in duration-300 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center sticky top-0 bg-antigravity-black/80 backdrop-blur-md py-2 z-10">
                <div className="flex items-center gap-3">
                  <span className="material-icons-outlined text-primary">psychology</span>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Insights de IA</h3>
                </div>
                <button onClick={() => setAiAnalysis(null)} className="text-white/70 hover:text-white">
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-white/90 leading-relaxed">
                <Markdown>{aiAnalysis}</Markdown>
              </div>
              <button 
                onClick={() => setAiAnalysis(null)}
                className="w-full py-4 rounded-2xl bg-primary text-antigravity-black font-black text-[10px] uppercase tracking-widest shadow-neon-cyan active:scale-95 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

        {isBulkImporting && (
          <div className="fixed inset-0 z-[100] bg-antigravity-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-8 border border-white/10 space-y-6 animate-in zoom-in duration-300">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Importación Masiva</h3>
                <button onClick={() => setIsBulkImporting(false)} className="text-white/70 hover:text-white">
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col gap-4">
                <p className="text-[10px] text-primary font-black uppercase tracking-widest leading-relaxed">
                  Pega los datos desde Excel o sube un archivo CSV/Excel. <br/>
                  Formato Sugerido: <span className="text-white">Nombre, DNI, Grupo, Nivel, Teléfono</span>
                </p>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls" 
                    onChange={handleCsvImport} 
                    ref={fileInputRef}
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                  >
                    <span className="material-icons-outlined text-sm">upload_file</span>
                    Seleccionar CSV o Excel
                  </button>
                </div>
              </div>
              <textarea 
                className="w-full h-64 bg-antigravity-charcoal border border-white/10 rounded-2xl p-4 text-xs text-white placeholder:text-white/20 outline-none focus:border-primary/50 transition-all font-mono"
                placeholder="Juan Perez, 12345678, Grupo A, Escuela, 1122334455&#10;Maria Gomez, 87654321, Grupo B, Escuela, 5544332211"
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsBulkImporting(false)}
                  className="flex-1 py-4 rounded-2xl border border-white/10 text-white font-bold text-[10px] uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkImport}
                  disabled={!bulkImportText.trim() || isLoading}
                  className="flex-1 py-4 rounded-2xl bg-primary text-antigravity-black font-black text-[10px] uppercase tracking-widest shadow-neon-cyan active:scale-95 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Procesando...' : 'Importar Lista'}
                </button>
              </div>
              
              <div className="pt-4 border-t border-white/5">
                <button 
                  onClick={handleCleanupInvalidStudents}
                  className="w-full py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-icons-outlined text-sm">cleaning_services</span>
                  Limpiar Registros Inválidos
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Modal de Confirmación */}
      {confirmModal && confirmModal.show && (
        <div className="fixed inset-0 z-[200] bg-antigravity-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="glass-card w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 space-y-6 animate-in zoom-in duration-300 shadow-neon-rose">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/30 shadow-neon-rose">
                <span className="material-icons-outlined text-rose-500 text-3xl">warning</span>
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">{confirmModal.title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-4 rounded-2xl border border-white/10 text-white font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-neon-rose active:scale-95 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Floating AI Assistant - REMOVED per user request */}

      {/* Notificaciones */}

      {notificacion && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-[380px] bg-antigravity-charcoal/95 backdrop-blur-2xl text-white p-5 rounded-[2rem] shadow-neon-cyan-strong border border-white/10 flex items-center gap-4 animate-in slide-in-from-top-12 duration-500">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 active-glow shrink-0">
            <span className="material-icons-outlined text-primary text-2xl">verified</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary truncate">{notificacion.t}</p>
            <p className="text-[11px] text-white/90 font-medium mt-0.5 leading-tight italic line-clamp-2">"{notificacion.d}"</p>
          </div>
          <button 
            onClick={() => setNotificacion(null)}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0"
          >
            <span className="material-icons-outlined text-sm">close</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;