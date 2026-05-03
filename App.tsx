import { PaymentPreprocessor } from './src/components/PaymentPreprocessor';
import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { ErrorBoundary } from './src/components/ErrorBoundary';
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
import { Button, Tooltip, BackButton, EditableDropdown } from './src/components/ui/CommonUI';
import { db as firestore, auth, googleProvider, COLLECTIONS, getCollectionData, getFilteredCollectionData, addDocument, updateDocument, deleteDocument, getAttendanceByStudent } from './services/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, orderBy, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
// Lazy loaded components
const Dashboard = lazy(() => import('./omponents/Dashboard').then(module => ({ default: module.Dashboard })));
const Reportes = lazy(() => import('./components/Reportes').then(module => ({ default: module.Reportes })));
const Staff = lazy(() => import('./components/Staff').then(module => ({ default: module.Staff })));
const Manuales = lazy(() => import('./omponents/Manuales').then(module => ({ default: module.Manuales })));
const Habilidades = lazy(() => import('./components/Habilidades').then(module => ({ default: module.Habilidades })));
const Grupos = lazy(() => import('./components/Grupos').then(module => ({ default: module.Grupos })));
const Asistencia = lazy(() => import('./components/Asistencia').then(module => ({ default: module.Asistencia })));
const Clases = lazy(() => import('./components/Clases').then(module => ({ default: module.Clases })));
const Alumnos = lazy(() => import('./components/Alumnos'));
const PaymentPreprocessor = lazy(() => import('./src/components/PaymentPreprocessor').then(module => ({ default: module.PaymentPreprocessor })));
const ControlPagos = lazy(() => import('./components/ControlPagos').then(module => ({ default: module.ControlPagos })));
const CoordinatorDashboard = lazy(() => import('./components/CoordinatorDashboard').then(module => ({ default: module.CoordinatorDashboard })));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center p-20 space-y-6">
    <div className="w-12 h-12 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
    <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Cargando Módulo</p>
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [vista, setVista] = useState<ViewMode>('Dashboard');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [alumnosFilterMode, setAlumnosFilterMode] = useState<'all' | 'alerts' | 'myGroups'>('all');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [grupos, setGrupos] = useState<GrupoConfig[]>([]);
  const [niveles, setNiveles] = useState<{id?: string, nombre: string}[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<Record<string, boolean>>({});
  const [pagosHoy, setPagosHoy] = useState<Record<string, boolean>>({});
  const [selectedClase, setSelectedClase] = useState<Clase | null>(null);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [alumnoAsistencias, setAlumnoAsistencias] = useState<AsistenciaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAsistencias, setIsLoadingAsistencias] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
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
  const [newGrupoRangoEdad, setNewGrupoRangoEdad] = useState("3 a 5 años");
  const [newGrupoDias, setNewGrupoDias] = useState("");
  const [newGrupoHorario, setNewGrupoHorario] = useState("");

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
  const [claseAgeRange, setClaseAgeRange] = useState<string>("");
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

  const userGroups = useMemo(() => {
    if (userRole === 'Coordinator') return grupos;
    const currentUid = user?.uid;
    const currentName = (user?.displayName || "").trim().toLowerCase();
    return grupos.filter(g => 
      (g.entrenador || "").trim().toLowerCase() === currentName ||
      (g.entrenadorId === currentUid) ||
      ((g as any).userId === currentUid)
    );
  }, [grupos, userRole, user]);

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
  const [groupCreatedSuccess, setGroupCreatedSuccess] = useState<string | null>(null);

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
      case 'auth/invalid-continue-uri':
        return "⚠️ ERROR DE REDIRECCIÓN (invalid-continue-uri): El dominio no está autorizado para redirección o el 'authDomain' está mal configurado. \n\n" +
               "1. Verifica que el dominio esté en Firebase Console -> Authorized Domains.\n" +
               "2. Asegúrate de que el 'authDomain' en tu configuración sea el original de Firebase (ej: proyecto.firebaseapp.com) y NO tu dominio de Vercel.";
      case 'auth/unauthorized-domain':
        return "⚠️ DOMINIO NO AUTORIZADO: El sitio '" + window.location.host + "' no tiene permiso para autenticarse. \n\n" +
               "SOLUCIÓN: Agrégalo en Firebase Console -> Authentication -> Settings -> Authorized Domains.";
      case 'auth/operation-not-allowed':
        return "⚠️ MÉTODO NO HABILITADO: El inicio de sesión (Google o Email) no está habilitado en tu Consola de Firebase -> Authentication -> Sign-in method.";
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

  const getAiTechnicalSuggestions = async (nivel: string, aparato: string, ageRange?: string): Promise<string[]> => {
    if (sources.length === 0) return [];
    
    try {
      const query = `Según los manuales, ¿cuáles son los ejercicios obligatorios para el Nivel ${nivel} en el aparato ${aparato}${ageRange ? ` para el rango de edad ${ageRange}` : ''}? Responde solo con una lista de ejercicios separados por comas, sin introducciones ni explicaciones.`;
      const response = await queryKnowledgeBase(query, sources);
      
      if (response.toLowerCase().includes("lo siento") || response.toLowerCase().includes("error")) {
        return [];
      }

      // Procesar la respuesta para obtener un array
      return response.split(',').map(s => s.trim()).filter(s => s.length > 0 && s.length < 100);
    } catch (error) {
      console.error("Error getting AI suggestions:", error);
      return [];
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
  const [notificacion, setNotificacion] = useState<{t: string, d: string, detalles?: string[], onConfirm?: () => void} | null>(null);
  const [showNotifDetails, setShowNotifDetails] = useState(false);
  const [hasNewData, setHasNewData] = useState(false);
  const isFirstLoad = useRef(true);

  const [onboardingStep, setOnboardingStep] = useState(0); // 0 = none, 1-4 = steps
  const [studentGuideCount, setStudentGuideCount] = useState(0);
  const [showStudentGuide, setShowStudentGuide] = useState(false);
  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState("");
  const [nuevoGrupoDias, setNuevoGrupoDias] = useState("");
  const [nuevoGrupoHorario, setNuevoGrupoHorario] = useState("17:00");
  const [nuevoGrupoRangoEdad, setNuevoGrupoRangoEdad] = useState("3 a 5 años");

  // Load student guide count
  useEffect(() => {
    const count = parseInt(localStorage.getItem('student_guide_count') || '0');
    setStudentGuideCount(count);
  }, []);

  const incrementStudentGuide = () => {
    const newCount = studentGuideCount + 1;
    setStudentGuideCount(newCount);
    localStorage.setItem('student_guide_count', newCount.toString());
  };

  // Auto-trigger onboarding
  useEffect(() => {
    const currentUid = user?.uid;
    const userDisplayName = user?.displayName;
    const userProfesoresIds = profesoresList.map(p => p.id);
    
    // Check if the user has any groups they created
    const userHasGroups = grupos.some(g => 
      g.entrenadorId === currentUid || 
      g.entrenador === userDisplayName ||
      (g.entrenadorId && userProfesoresIds.includes(g.entrenadorId)) ||
      (g as any).userId === currentUid ||
      // Fallback: If group has no owner info but user has created groups at all,
      // maybe we should trust it? Or check if the group is even linked to them.
      false 
    );
    
    if (userRole === 'Coach' && isDataLoaded && !userHasGroups && !isLoading && user && isFirstLoad.current) {
      setOnboardingStep(1);
    }
    isFirstLoad.current = false;
  }, [userRole, grupos, isLoading, user, isDataLoaded, profesoresList]);
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

  const COORDINATOR_EMAILS = ["profesunlp@gmail.com"];
  const STAFF_WHITELIST = ["mi.xt1032@gmail.com", "profesunlp@gmail.com"];

  // Handle chunk loading errors (typical in Vercel during redeploys)
  useEffect(() => {
    const handleError = (e: ErrorEvent | PromiseRejectionEvent) => {
      const message = (e as ErrorEvent).message || (e as any).reason?.message || "";
      if (message.includes("Failed to fetch dynamically imported module") || 
          message.includes("error loading dynamically imported module")) {
        setNotificacion({ 
          t: "Módulo Actualizado", 
          d: "Hay una nueva versión disponible. La aplicación se reiniciará para cargar los cambios.",
          onConfirm: () => window.location.reload()
        });
      }
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);
  
  const isCoordinatorEmail = (email: string | null | undefined) => {
    if (!email) return false;
    const lowerEmail = email.trim().toLowerCase();
    // Force specific coordinator email check
    if (lowerEmail === 'profesunlp@gmail.com') return true;
    return COORDINATOR_EMAILS.some(e => e.trim().toLowerCase() === lowerEmail);
  };
  
  const isStaffWhitelist = (email: string | null | undefined) => {
    if (!email) return false;
    const lowerEmail = email.trim().toLowerCase();
    return STAFF_WHITELIST.some(e => e.trim().toLowerCase() === lowerEmail);
  };

  const menuOptions = useMemo(() => {
    if (!userRole) return [];
    return [
      { v: 'AsistenciaLista', i: 'fact_check', l: 'Asistencia', c: 'text-emerald-600', role: 'Coach' },
      { v: 'Horario', i: 'event_note', l: 'Grupos', c: 'text-amber-600', role: 'Coach' },
      { v: 'AsistenciaStats', i: 'analytics', l: 'Estadísticas', c: 'text-sky-600', role: 'Coordinator' },
      { v: 'Planes', i: 'psychology', l: 'Manuales', c: 'text-violet-600', role: 'Coach' },
      { v: 'Profesores', i: 'badge', l: 'Staff', c: 'text-rose-600', role: 'Coordinator' },
      { v: 'Habilidades', i: 'trending_up', l: 'Habilidades', c: 'text-purple-600', role: 'Coach' },
      { v: 'ControlPagos', i: 'payments', l: 'Pagos', c: 'text-ios-blue', role: 'Coordinator' },
    ].filter(opt => {
      if (userRole === 'Coordinator') return true;
      return opt.role === userRole;
    });
  }, [userRole]);
  const [staffInfo, setStaffInfo] = useState<any>(null);

  // Security guard for routes
  useEffect(() => {
    const coordinatorOnlyViews: ViewMode[] = ['AsistenciaStats', 'ReporteGrupal', 'TendenciasHabilidades', 'ReportePDF', 'ControlPagos', 'Profesores', 'ProfesorDetalle'];
    
    // Solo si NO es coordinador ni staff, restringimos las vistas de coordinador
    if (userRole !== 'Coordinator' && coordinatorOnlyViews.includes(vista)) {
      setVista('Dashboard');
    }
    // El Coordinador YA NO es expulsado de las vistas de Coach.
  }, [vista, userRole]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsLoggedIn(true);

        try {
          // Determine role immediately by email (Whitelist)
          const isCoord = isCoordinatorEmail(currentUser.email);
          const isStaffMember = isStaffWhitelist(currentUser.email);
          
          let role: UserRole = isCoord ? 'Coordinator' : 'Coach';
          let staffData: any = null;

          // Single query for staff data
          const staffQuery = query(collection(firestore, COLLECTIONS.STAFF), where('uid', '==', currentUser.uid));
          const staffDocs = await getDocs(staffQuery);

          if (staffDocs.empty) {
            if (!isStaffMember) {
              // Not in whitelist and not in DB -> Access restricted
              setUserRole(null);
              setIsLoading(false);
              return;
            }
            // Whitelisted but not in DB yet -> Create profile
            staffData = {
              uid: currentUser.uid,
              email: currentUser.email,
              nombre: currentUser.displayName || (isCoord ? 'Coordinador' : 'Profesor'),
              role: role, // Use the role determined by email
              fechaRegistro: new Date().toISOString(),
              userId: currentUser.uid
            };
            try {
              const staffRef = doc(firestore, COLLECTIONS.STAFF, currentUser.uid);
              await setDoc(staffRef, staffData);
            } catch (e) {
              console.warn("Firestore save failed, using local state", e);
            }
          } else {
            // Exists in DB
            staffData = { id: staffDocs.docs[0].id, ...staffDocs.docs[0].data() };
            
            // PRIORITY FORCE: If email is in COORDINATOR_EMAILS, it MUST be Coordinator.
            // If it's only in STAFF_WHITELIST, it MUST be Coach.
            if (isCoord) {
              role = 'Coordinator';
            } else if (isStaffMember) {
              role = 'Coach';
            }
            
            // If the role in DB is different from what we just determined (whitelist-based), update it for next time
            if (staffData.role !== role) {
              try {
                await updateDoc(doc(firestore, COLLECTIONS.STAFF, staffData.id), { role: role });
                staffData.role = role;
              } catch (e) {
                console.warn("Could not sync role update to Firestore", e);
              }
            }
          }
          
          setStaffInfo(staffData);
          setUserRole(role);
          setIsLoading(false);
        } catch (error) {
          console.error("Error syncing staff:", error);
          // High-level fallback for whitelisted users
          if (isStaffWhitelist(currentUser.email)) {
            setUserRole(isCoordinatorEmail(currentUser.email) ? 'Coordinator' : 'Coach');
          }
          setIsLoading(false);
        }
      } else {
        setUser(null);
        setIsLoggedIn(false);
        setStaffInfo(null);
        setIsLoading(false);
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
            await addDocument(COLLECTIONS.STAFF, rest);
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
        msg = "⚠️ ERROR DE DOMINIO: Este sitio no está autorizado en Firebase.\n\n" +
              "Si estás en Vercel:\n" +
              "1. Debes crear TU PROPIO proyecto en console.firebase.google.com\n" +
              "2. En 'Authentication' > 'Settings' > 'Authorized Domains', agrega tu URL de Vercel.\n" +
              "3. Configura las 'Environment Variables' en Vercel con las credenciales de TU nuevo proyecto.";
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
    setIsLoading(true);
    try {
      const a = await getCollectionData(COLLECTIONS.ALUMNOS) as Alumno[];
      const c = await getCollectionData(COLLECTIONS.CLASES) as Clase[];
      const g = await getCollectionData(COLLECTIONS.GRUPOS) as GrupoConfig[];
      const asis = await getCollectionData(COLLECTIONS.ASISTENCIAS) as AsistenciaRecord[];
      const p = await getCollectionData(COLLECTIONS.STAFF) as {id?: string, nombre: string, userId?: string, uid?: string}[];
      const n = await getCollectionData(COLLECTIONS.NIVELES) as {id?: string, nombre: string}[];
      const d = await getCollectionData(COLLECTIONS.DISCIPLINAS) as {id?: string, nombre: string}[];
      const s = await getCollectionData(COLLECTIONS.SOURCES) as Source[];
      const w = await getCollectionData(COLLECTIONS.WARMUP_OPTIONS) as {id?: string, nombre: string}[];
      const co = await getCollectionData(COLLECTIONS.COOLDOWN_OPTIONS) as {id?: string, nombre: string}[];
      const ac = await getCollectionData(COLLECTIONS.AGE_CATEGORIES) as {id?: string, nombre: string}[];
      const pc = await getCollectionData(COLLECTIONS.PHYSICAL_CATEGORIES) as {id?: string, nombre: string}[];
      
      const currentUid = user?.uid || auth.currentUser?.uid;
      const isCoord = userRole === 'Coordinator';
      
      // Filter staff records: coordinators see all, coaches see only their own record(s)
      const filteredProfesores = isCoord ? p : (p || []).filter(prof => prof.uid === currentUid || prof.userId === currentUid);
      const myStaffIds = filteredProfesores.map(f => f.id);

      // Find all groups belonging to the user
      const coachGrupos = isCoord ? g : g.filter(grupo => {
          return grupo.entrenadorId === currentUid || 
          (grupo.entrenadorId && myStaffIds.includes(grupo.entrenadorId)) ||
          (grupo.entrenador && user?.displayName && grupo.entrenador.trim().toLowerCase() === user.displayName.trim().toLowerCase()) ||
          ((grupo as any).userId === currentUid);
      });
      const coachGruposNamesArray = coachGrupos.map(grupo => (grupo.nombre || "").trim().toLowerCase());
      
      // Set Alumnos (unfiltered for state, filtering happens in UI)
      setAlumnos(a);
      
      // Filter Classes
      const filteredClases = isCoord 
        ? c.sort((x, y) => new Date(y.fecha).getTime() - new Date(x.fecha).getTime()) 
        : c.filter(clase => coachGruposNamesArray.includes((clase.grupo || '').trim().toLowerCase())).sort((x, y) => new Date(y.fecha).getTime() - new Date(x.fecha).getTime());
      
      setClases(filteredClases);
      setGrupos(coachGrupos);
      
      // Filter Attendance registers
      const filteredAsistencias = isCoord 
        ? asis 
        : asis.filter(asi => coachGruposNamesArray.includes((asi.grupo || '').trim().toLowerCase()));
      
      setAsistencias(filteredAsistencias);
      setProfesoresList(filteredProfesores);
      setSources(s || []);
      
      // Default lists
      setNiveles(n.length > 0 ? n : [
        { id: 'default-0', nombre: 'Escuela' },
        { id: 'default-1', nombre: 'Pre-Equipo' },
        { id: 'default-2', nombre: 'Equipo' }
      ]);
      setDisciplinas(d.length > 0 ? d : DISCIPLINAS.map((name, i) => ({ id: `default-${i}`, nombre: name })));
      
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

      // Warmup/Cooldown fallback
      setWarmupOptions(w.length > 0 ? w : ['Movilidad articular', 'Trote', 'Juegos', 'Estiramiento dinámico'].map((name, i) => ({ id: `default-${i}`, nombre: name })));
      setCooldownOptions(co.length > 0 ? co : ['Estiramiento pasivo', 'Relajación', 'Feedback grupal'].map((name, i) => ({ id: `default-${i}`, nombre: name })));

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
      
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const curMonthIdx = new Date().getMonth();
      const currentMonthName = monthNames[curMonthIdx];
      const isCycleActive = curMonthIdx >= 2 && curMonthIdx <= 10;
      const currentYear = new Date().getFullYear();

      // Filter global alerts
      setAlertasGlobales(a.filter(student => {
        if (!student.alertas || student.alertas.length === 0 || student.alertas[0] === "") return false;
        if (!isCycleActive) {
          return student.alertas.some(al => !al.toLowerCase().includes('pago') && !al.toLowerCase().includes('deuda') && !al.toLowerCase().includes('mora'));
        }
        return true;
      }));

      setIsDataLoaded(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && userRole) {
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
  }, [isLoggedIn, userRole]);

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

  // Sincronización automática de pagosHoy y asistenciasHoy según el grupo activo
  useEffect(() => {
    const syncAttendanceAndPayments = async () => {
      if (activeGroup && isDataLoaded) {
        const today = new Date().toISOString().split('T')[0];
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const curMonth = new Date().getMonth();
        const currentMonthName = monthNames[curMonth];
        const currentYear = new Date().getFullYear();
        const isCycleActive = curMonth >= 2 && curMonth <= 10;

        try {
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
          });

          // Sincronizar pagos desde el historial mensual
          if (isCycleActive) {
            alumnos.forEach(alumno => {
              if (alumno.pagosMensuales?.some(p => p.mes === currentMonthName && p.anio === currentYear)) {
                payMap[alumno.id!] = true;
              }
            });
          }

          setAsistenciasHoy(attMap);
          setPagosHoy(payMap);
        } catch (err) {
          console.error("Error syncing attendance/payments:", err);
        }
      }
    };

    syncAttendanceAndPayments();
  }, [activeGroup, isDataLoaded, alumnos]);

  const handleSaveGroup = async () => {
    if (!newGroupName || !newCoachName || !newGrupoDias) {
      setNotificacion({ t: "Error", d: "Nombre del grupo, profesor y días son obligatorios." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }
    
    try {
      // Find coach in staff info to get UID
      const coach = profesoresList.find(p => p.nombre === newCoachName);
      
      let groupData: any = {
        nombre: newGroupName,
        entrenador: newCoachName,
        entrenadorId: coach?.id || user?.uid || '', // fallback to current user uid
        dias: newGrupoDias.split(',').map(d => d.trim()).filter(d => d),
        horario: newGrupoHorario,
        rangoEdad: newGrupoRangoEdad || "3 a 5 años",
        userId: user?.uid
      };

      if (editingGroup && editingGroup.id) {
        await updateDocument(COLLECTIONS.GRUPOS, editingGroup.id, groupData);
        setNotificacion({ t: "Éxito", d: `Grupo ${newGroupName} actualizado.` });
      } else {
        await addDocument(COLLECTIONS.GRUPOS, groupData);
        setNotificacion({ t: "Éxito", d: `Grupo ${newGroupName} configurado.` });
        setGroupCreatedSuccess(newGroupName);
      }
      setNewGroupName("");
      setNewCoachName("");
      setNewGrupoDias("");
      setNewGrupoHorario("");
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
      await updateDocument(COLLECTIONS.STAFF, id, { nombre });
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
        userId: user?.uid || auth.currentUser?.uid,
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
      const currentUid = user?.uid || auth.currentUser?.uid;
      await addDocument(COLLECTIONS.STAFF, { 
        nombre: targetName,
        userId: currentUid
      });
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

  const handleDeleteProfesor = async (profesorId: string) => {
    const prof = profesoresList.find(p => p.id === profesorId);
    const nombre = prof?.nombre || "Profesor";
    requestConfirmation(
      "Eliminar Profesor",
      `¿Estás seguro de que deseas eliminar al profesor "${nombre}"?`,
      async () => {
        try {
          await deleteDocument(COLLECTIONS.STAFF, profesorId);
          setNotificacion({ t: 'Éxito', d: `Profesor ${nombre} eliminado.` });
          loadData();
        } catch (error: any) {
          setNotificacion({ t: 'Error', d: error.message });
        }
      }
    );
  };

  const handleUpdateStudentGroup = async (studentId: string, groupName: string) => {
    try {
      await updateDocument(COLLECTIONS.ALUMNOS, studentId, { grupo: groupName });
      setNotificacion({ t: '¡Éxito!', d: groupName === 'Sin Grupo' ? 'Gimnasta desvinculada.' : 'Gimnasta reasignada correctamente.' });
      // Update local state directly for immediate feedback
      setAlumnos(prev => prev.map(a => a.id === studentId ? { ...a, grupo: groupName } : a));
    } catch (error) {
      console.error("Error updating student group:", error);
      setNotificacion({ t: 'Error', d: 'No se pudo realizar el cambio.' });
    }
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

  const handleDeduplicateStudents = async () => {
    try {
      setIsLoading(true);
      const studentMap = new Map<string, Alumno[]>();
      
      // Agrupamos: prioridad DNI válido, sino Nombre Normalizado
      alumnos.forEach(a => {
        const hasDni = a.dni && a.dni !== 'No especificado' && /^\d+$/.test(a.dni.trim());
        if (hasDni) {
          const key = `dni:${a.dni.trim()}`;
          if (!studentMap.has(key)) studentMap.set(key, []);
          studentMap.get(key)!.push(a);
        } else {
          const normalizedName = a.nombre.toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const key = `name:${normalizedName}`;
          if (!studentMap.has(key)) studentMap.set(key, []);
          studentMap.get(key)!.push(a);
        }
      });

      let deleteCount = 0;
      let mergeCount = 0;

      for (const group of Array.from(studentMap.values())) {
        if (group.length > 1) {
          // Survivor: el que tenga más datos
          const sorted = [...group].sort((a, b) => {
             const aScore = (a.dni !== 'No especificado' ? 1 : 0) + (a.contacto?.emergenciaTelefono ? 1 : 0) + (a.pagosMensuales?.length || 0);
             const bScore = (b.dni !== 'No especificado' ? 1 : 0) + (b.contacto?.emergenciaTelefono ? 1 : 0) + (b.pagosMensuales?.length || 0);
             return bScore - aScore;
          });

          const survivor = sorted[0];
          const duplicates = sorted.slice(1);

          for (const dupe of duplicates) {
            const updates: Partial<Alumno> = {};
            let needsUpdate = false;

            if (survivor.dni === 'No especificado' && dupe.dni !== 'No especificado') {
              updates.dni = dupe.dni;
              needsUpdate = true;
            }
            
            if (!survivor.contacto?.emergenciaTelefono && dupe.contacto?.emergenciaTelefono) {
              updates.contacto = { ...survivor.contacto, emergenciaTelefono: dupe.contacto.emergenciaTelefono };
              needsUpdate = true;
            }

            const survivorPayments = survivor.pagosMensuales || [];
            const dupePayments = dupe.pagosMensuales || [];
            const newPayments = [...survivorPayments];
            let addedPayment = false;
            
            for (const dp of dupePayments) {
              if (!newPayments.some(sp => sp.mes === dp.mes && sp.anio === dp.anio)) {
                newPayments.push(dp);
                addedPayment = true;
              }
            }
            
            if (addedPayment) {
              updates.pagosMensuales = newPayments;
              needsUpdate = true;
            }

            if (needsUpdate) {
              await updateDocument(COLLECTIONS.ALUMNOS, survivor.id!, updates);
              mergeCount++;
            }

            await deleteDocument(COLLECTIONS.ALUMNOS, dupe.id!);
            deleteCount++;
          }
        }
      }

      await loadData();
      setNotificacion({ 
        t: "Limpieza Completada", 
        d: `Se eliminaron ${deleteCount} duplicados y se fusionaron datos en ${mergeCount} registros.` 
      });
    } catch (error) {
      console.error("Error in deduplication:", error);
      setNotificacion({ t: "Error", d: "No se pudo completar la limpieza." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkPaymentConfirm = async (updates: { alumnoId: string, name: string, month: string, year: number }[]) => {
    try {
      setIsLoading(true);
      const updatedAlumnos = [...alumnos];
      const today = new Date();
      const currentMonthIndex = today.getMonth();
      const currentYear = today.getFullYear();
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const currentMonthName = months[currentMonthIndex];
      
      for (const update of updates) {
        const alumno = updatedAlumnos.find(a => a.id === update.alumnoId);
        if (alumno) {
          const pagos = alumno.pagosMensuales || [];
          // Evitar duplicados
          const exists = pagos.some(p => p.mes === update.month && p.anio === update.year);
          if (!exists) {
            const newPago = { mes: update.month, anio: update.year, fechaPago: today.toISOString() };
            const newPagos = [...pagos, newPago];
            
            const isCurrentMonth = update.month === currentMonthName && update.year === currentYear;
            const updateFields: any = { pagosMensuales: newPagos };
            
            if (isCurrentMonth) {
              updateFields.estadoPago = 'Al día';
              updateFields.pagoVencido = false;
            }

            await updateDocument(COLLECTIONS.ALUMNOS, alumno.id!, updateFields);
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

  const handleBulkImportSubmit = async () => {
    const lines = bulkImportText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return;

    setIsLoading(true);
    let importedCount = 0;
    let errors: string[] = [];
    
    // Header detection & Index mapping
    let startIndex = 0;
    let nameIdx = 0;
    let dniIdx = 1;
    let groupIdx = 2;
    let levelIdx = 3;
    let telIdx = 4;

    const firstLine = lines[0].toLowerCase();
    const possibleHeaders = firstLine.split(/[,;\t]/).map(h => h.trim());
    
    const hasHeader = possibleHeaders.some(h => 
      h.includes('nombre') || h.includes('alumno') || h.includes('dni') || h.includes('grupo')
    );

    if (hasHeader) {
      startIndex = 1;
      nameIdx = possibleHeaders.findIndex(h => h.includes('nombre') || h.includes('alumno'));
      if (nameIdx === -1) nameIdx = 0;
      
      dniIdx = possibleHeaders.findIndex(h => h.includes('dni') || h.includes('documento'));
      groupIdx = possibleHeaders.findIndex(h => h.includes('grupo') || h.includes('clase') || h.includes('actividad'));
      levelIdx = possibleHeaders.findIndex(h => h.includes('nivel') || h.includes('rango'));
      telIdx = possibleHeaders.findIndex(h => h.includes('tel') || h.includes('contacto') || h.includes('celular'));
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      // Split by comma, semicolon or tab
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      if (parts.length < 1 || !parts[nameIdx]) {
        if (line.trim() !== "") {
          errors.push(`Fila ${i + 1}: Sin nombre válido.`);
        }
        continue;
      }

      const nombre = parts[nameIdx];
      const dni = dniIdx !== -1 ? (parts[dniIdx] || '') : '';
      const grupo = groupIdx !== -1 ? (parts[groupIdx] || 'Sin Grupo') : 'Sin Grupo';
      const nivel = levelIdx !== -1 ? (parts[levelIdx] || 'Escuela') : 'Escuela';
      const telefono = telIdx !== -1 ? (parts[telIdx] || '') : '';

      // Validación básica
      if (nombre.length < 3) {
        errors.push(`Fila ${i + 1}: Nombre demasiado corto ("${nombre}").`);
        continue;
      }
      
      if (dni && !/^\d+$/.test(dni) && dni !== 'No especificado') {
        errors.push(`Fila ${i + 1}: DNI inválido (debe ser numérico: "${dni}") para "${nombre}".`);
        continue;
      }

      // Buscar si ya existe el alumno para evitar duplicados
      // 1. Prioridad: DNI (si existe)
      // 2. Secundario: Nombre y Grupo (si DNI no existe)
      let existingStudent = null;
      if (dni && dni !== 'No especificado') {
        existingStudent = alumnos.find(a => a.dni === dni);
      } else {
        existingStudent = alumnos.find(a => 
          a.nombre.toLowerCase() === nombre.toLowerCase() && 
          (a.grupo?.toLowerCase() || '') === grupo.toLowerCase()
        );
      }

      const newStudent: Omit<Alumno, 'id'> = {
        nombre,
        dni: dni || 'No especificado',
        disciplina: 'GAF',
        nivel,
        grupo,
        fechaNacimiento: '2010-01-01',
        fechaIngreso: new Date().toISOString(),
        fechaPrimeraClase: new Date().toISOString().split('T')[0],
        estadoPago: 'Al día',
        habilidades: [],
        biometria: { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 },
        qrCode: `QR_${dni || new Date().getTime()}_${Math.random().toString(36).substr(2, 5)}`,
        asistenciasHistoricas: 0,
        alertas: [],
        contacto: {
          padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '',
          emergenciaNombre: 'Contacto Masivo', emergenciaTelefono: telefono
        }
      };

      try {
        if (existingStudent && existingStudent.id) {
          // Actualizar solo los campos que vienen con información nueva o mantienen los existentes
          const updatedStudent = {
            ...existingStudent,
            nombre: nombre || existingStudent.nombre,
            dni: (dni && dni !== 'No especificado') ? dni : existingStudent.dni,
            grupo: (grupo && grupo !== 'Sin Grupo') ? grupo : existingStudent.grupo,
            nivel: (nivel && nivel !== 'Escuela') ? nivel : existingStudent.nivel,
            contacto: {
              ...(existingStudent.contacto || {}),
              emergenciaTelefono: telefono || existingStudent.contacto?.emergenciaTelefono || ''
            }
          };
          await updateDocument(COLLECTIONS.ALUMNOS, existingStudent.id, updatedStudent);
        } else {
          // Crear nuevo si no existe
          await addDocument(COLLECTIONS.ALUMNOS, newStudent);
        }
        importedCount++;
      } catch (e) {
        errors.push(`Fila ${i + 1}: Error al procesar a "${nombre}": ${e}`);
      }
    }

    await loadData();
    setIsLoading(false);
    setIsBulkImporting(false);
    setBulkImportText("");
    
    if (errors.length > 0) {
      setNotificacion({ 
        t: "Importación Parcial", 
        d: `Se importaron ${importedCount} alumnos. Hubo ${errors.length} errores.`,
        detalles: errors
      });
      console.warn("Errores de importación:", errors);
      // No cerramos automáticamente si hay errores para que el usuario pueda verlos
    } else {
      setNotificacion({ t: "Importación Exitosa", d: `Se importaron ${importedCount} alumnos correctamente.` });
      setTimeout(() => setNotificacion(null), 3000);
    }
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
        // Check for duplicates before adding
        if (studentForm.dni && studentForm.dni !== 'No especificado') {
          const duplicate = alumnos.find(a => a.dni === studentForm.dni);
          if (duplicate) {
            requestConfirmation(
              "Alumno ya registrado",
              `Ya existe un gimnasta con DNI ${studentForm.dni} (${duplicate.nombre}). ¿Deseas simplemente asignarlo al grupo actual?`,
              async () => {
                try {
                  setIsSavingStudent(true);
                  await updateDocument(COLLECTIONS.ALUMNOS, duplicate.id!, { 
                    grupo: studentForm.grupo || activeGroup?.nombre || 'Sin Grupo' 
                  });
                  setNotificacion({ t: "Éxito", d: `${duplicate.nombre} ahora está en el grupo ${studentForm.grupo || activeGroup?.nombre}` });
                  await loadData();
                  handleNavigation('AsistenciaLista');
                } catch (err: any) {
                  setNotificacion({ t: "Error", d: "No se pudo actualizar el grupo." });
                } finally {
                  setIsSavingStudent(false);
                }
              }
            );
            setIsSavingStudent(false);
            return;
          }
        }

        const newStudent = {
          ...studentData,
          grupo: studentForm.grupo || activeGroup?.nombre || 'Sin Grupo',
          fechaIngreso: new Date().toISOString(),
          estadoPago: 'Al día',
          habilidades: studentForm.habilidades || [],
          biometria: studentForm.biometria || { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 },
          qrCode: `QR_${studentForm.dni || new Date().getTime()}`,
          asistenciasHistoricas: 0,
          userId: user?.uid
        };
        await addDocument(COLLECTIONS.ALUMNOS, newStudent);
        setNotificacion({ t: "Gimnasta Registrado", d: `${newStudent.nombre} añadido.` });
        incrementStudentGuide();
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
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const now = new Date();
      const currentMonthName = monthNames[now.getMonth()];
      const currentYear = now.getFullYear();
      
      const hasPaid = !pagosHoy[alumnoId];
      setPagosHoy(prev => ({ ...prev, [alumnoId]: hasPaid }));

      const alumnoRef = doc(firestore, COLLECTIONS.ALUMNOS, alumnoId);
      const student = alumnos.find(a => a.id === alumnoId);
      
      if (!student) return;

      if (hasPaid) {
        // Agregar pago mensual
        await updateDocument(COLLECTIONS.ALUMNOS, alumnoId, {
          pagosMensuales: arrayUnion({
            mes: currentMonthName,
            anio: currentYear,
            fechaPago: now.toISOString()
          })
        });
      } else {
        // Quitar pago mensual
        const paymentToRemove = student.pagosMensuales?.find(p => p.mes === currentMonthName && p.anio === currentYear);
        if (paymentToRemove) {
          await updateDocument(COLLECTIONS.ALUMNOS, alumnoId, {
            pagosMensuales: arrayRemove(paymentToRemove)
          });
        }
      }

      // Sincronizar con la asistencia de hoy si existe
      const today = now.toISOString().split('T')[0];
      const q = query(
        collection(firestore, COLLECTIONS.ASISTENCIAS),
        where('fecha', '==', today),
        where('alumnoId', '==', alumnoId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        await updateDocument(COLLECTIONS.ASISTENCIAS, querySnapshot.docs[0].id, { pago: hasPaid });
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
        ageRange: claseAgeRange,
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
      setClaseAgeRange("");
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

  if (isLoading) return (
    <div className="auth-bg flex flex-col items-center justify-center min-h-screen">
      <LoadingFallback />
    </div>
  );

  if (!isLoggedIn) return (
    <div className="auth-bg flex flex-col items-center justify-center p-8 text-white min-h-screen relative">
      <div className="z-10 w-full max-w-sm text-center page-transition flex flex-col items-center">
        <div className="w-24 h-24 bg-white/10 backdrop-blur-3xl rounded-[2.2rem] flex items-center justify-center mb-12 shadow-[0_10px_40px_rgba(0,0,0,0.4)] border border-primary/20">
          <span className="material-icons-outlined text-white text-4xl transform -rotate-45">fitness_center</span>
        </div>
        <h1 className="text-[42px] font-extrabold tracking-tighter mb-1 text-white leading-none">
          GymCoach <span className="text-primary">Pro</span>
        </h1>
        <p className="text-primary text-[10px] font-bold italic uppercase tracking-[0.4em] mb-12 whitespace-nowrap">
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
                className="w-full bg-black/60 border border-white/20 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-1">
              <input 
                type="password" 
                placeholder="Contraseña" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all"
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
                <span className="text-[10px] text-white/90 uppercase font-bold tracking-widest group-hover:text-white transition-colors">Recordarme</span>
              </label>
              {!isSignUp && (
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] text-primary uppercase font-bold tracking-widest hover:text-primary/80 transition-colors"
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

          <button onClick={handleLogin} className="w-full py-4.5 bg-white/10 border border-white/10 text-white rounded-full font-bold uppercase text-[10px] tracking-[0.18em] active:scale-95 transition-all hover:bg-white/20 flex items-center justify-center gap-3">
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
              <p className="text-rose-200 text-[10px] font-bold leading-relaxed mb-3">
                {loginError}
              </p>
              
              {(loginError.includes('DOMINIO NO AUTORIZADO') || loginError.includes('ERROR DE REDIRECCIÓN')) && (
                <div className="space-y-3">
                  <div className="p-2 bg-black/30 border border-white/5 rounded text-[10px] font-mono text-white break-all select-all flex flex-col gap-1">
                    <span className="text-[8px] text-white/40 uppercase tracking-tighter">Dominio actual para copiar:</span>
                    <span className="font-bold">{window.location.host}</span>
                  </div>
                  
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-2">
                    <p className="text-[9px] text-blue-200 uppercase font-bold tracking-widest">¿Cómo lo arreglo?</p>
                    <ul className="text-[9px] text-blue-100 list-disc pl-4 space-y-1">
                      <li>Ve a tu consola de Firebase</li>
                      <li>Authentication → Settings → Authorized Domains</li>
                      <li>Añade el dominio de arriba</li>
                      <li>Si usas Vercel, verifica que tus VITE_ variables de entorno estén correctas</li>
                    </ul>
                  </div>
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
    <div className="max-w-[430px] mx-auto min-h-screen bg-ios-gray shadow-2xl relative overflow-hidden flex flex-col font-sans pb-32">
      
      {/* Unsaved Changes Modal */}
      {pendingNavigation && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-white border border-black/5 rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-rose-500">
              <span className="material-icons-outlined text-3xl">warning</span>
              <h3 className="font-bold text-lg">Cambios sin guardar</h3>
            </div>
            <p className="text-sm text-secondary leading-relaxed">
              Tienes datos sin guardar en esta pantalla. Si sales ahora, se perderán. ¿Qué deseas hacer?
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmNavigation}
                className="w-full py-3.5 rounded-xl bg-rose-500 text-white font-bold text-sm uppercase tracking-wide active:scale-95 transition-all hover:bg-rose-600 shadow-md shadow-rose-500/20"
              >
                Descartar y Salir
              </button>
              <button 
                onClick={cancelNavigation}
                className="w-full py-3.5 rounded-xl border border-black/10 text-secondary font-bold text-sm uppercase tracking-wide active:scale-95 transition-all hover:bg-black/5"
              >
                Continuar Editando
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
      <div className="h-12 flex justify-between items-center px-8 pt-4 pb-2 w-full bg-ios-gray sticky top-0 z-50">
        <span className="text-sm font-semibold text-black">9:41</span>
        <div className="flex items-center gap-1.5 text-black">
          <span className="material-symbols-outlined text-[18px]">signal_cellular_alt</span>
          <span className="material-symbols-outlined text-[18px]">wifi</span>
          <span className="material-symbols-outlined text-[18px]">battery_very_low</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary><Suspense fallback={<LoadingFallback />}>
          {vista === 'Dashboard' && userRole && (
            <Dashboard 
              userRole={userRole}
              user={user}
              grupos={userGroups}
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
              setUserRole={setUserRole as any}
              isCoordinatorEmail={isCoordinatorEmail}
              onOpenBulkPayment={() => setIsBulkPaymentModalOpen(true)}
              onOpenBulkImportStudents={() => { setIsBulkImporting(true); setOnboardingStep(0); }}
              setSelectedAlumno={setSelectedAlumno}
              setStudentForm={setStudentForm}
              setIsAddingAlumno={setIsAddingAlumno}
              studentForm={studentForm}
              setClaseGrupo={setClaseGrupo}
            />
          )}


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
            newGrupoDias={newGrupoDias}
            setNewGrupoDias={setNewGrupoDias}
            newGrupoHorario={newGrupoHorario}
            setNewGrupoHorario={setNewGrupoHorario}
            newGrupoRangoEdad={newGrupoRangoEdad}
            setNewGrupoRangoEdad={setNewGrupoRangoEdad}
            handleSaveGroup={handleSaveGroup}
            grupos={userGroups}
            alumnos={alumnos}
            handleUpdateStudentGroup={handleUpdateStudentGroup}
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
            setNewGrupoDias={setNewGrupoDias}
            setNewGrupoHorario={setNewGrupoHorario}
            setNewGrupoRangoEdad={setNewGrupoRangoEdad}
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
            grupos={userGroups}
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
            setClaseGrupo={setClaseGrupo}
            setRegistrationStep={setRegistrationStep}
            setIsEditingClase={setIsEditingClase}
          />
        )}

        {(vista === 'Clases' || vista === 'NuevaClase' || vista === 'ClaseDetalle' || vista === 'HistorialClases') && (
          <Clases 
            vista={vista}
            setVista={setVista}
            handleNavigation={handleNavigation}
            registrationStep={registrationStep}
            setRegistrationStep={setRegistrationStep}
            grupos={userGroups}
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
            claseAgeRange={claseAgeRange}
            setClaseAgeRange={setClaseAgeRange}
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
            selectedClase={selectedClase || null}
            setSelectedClase={setSelectedClase}
            handleDeleteClase={handleDeleteClase}
            handleEditClase={handleEditClase}
            setNotificacion={setNotificacion}
            userRole={userRole || 'Coach'}
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
            getAiTechnicalSuggestions={getAiTechnicalSuggestions}
            isKbLoading={isKbLoading}
          />
        )}

        {(vista === 'Alumnos' || vista === 'RegistroAlumno' || vista === 'AlumnoDetalle') && (
          <Alumnos 
            vista={vista}
            setVista={(v: any) => { if (v === 'Alumnos') setAlumnosFilterMode('all'); setVista(v); }}
            alumnos={alumnos}
            grupos={userGroups}
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
            userRole={userRole || 'Coach'}
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
            handleDeduplicateStudents={() => {
              setConfirmModal({
                show: true,
                title: "Limpiar Duplicados",
                message: "¿Estás seguro de que deseas eliminar registros duplicados exactos? Se fusionarán los datos de pagos y contacto antes de borrar.",
                onConfirm: handleDeduplicateStudents
              });
            }}
            handleUpdateBiometrics={handleUpdateBiometrics}
            sendPaymentReminder={sendPaymentReminder}
            currentCoachGroupsNames={grupos.map(g => g.nombre)}
            currentUserName={user?.displayName || ''}
            currentUserId={user?.uid}
          />
        )}

        {vista === 'ControlPagos' && (
          <ErrorBoundary><Suspense fallback={<LoadingFallback />}>
            <ControlPagos 
              onBack={() => setVista('Dashboard')} 
              onImportPayments={() => setIsBulkPaymentModalOpen(true)}
            />
          </Suspense></ErrorBoundary>
        )}

        {vista === 'CoordinatorDashboard' && (
          <ErrorBoundary><Suspense fallback={<LoadingFallback />}>
            <CoordinatorDashboard />
          </Suspense></ErrorBoundary>
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
            grupos={userGroups}
            alumnos={alumnos}
            asistencias={asistencias}
            setSelectedProfesor={setSelectedProfesor}
            handleNavigation={handleNavigation}
            selectedProfesor={selectedProfesor || ""}
            userRole={userRole || 'Coach'}
            setSelectedClase={setSelectedClase}
            setNotificacion={setNotificacion}
          />
        )}

        {(vista === 'AsistenciaStats' || vista === 'ReporteGrupal' || vista === 'TendenciasHabilidades' || vista === 'ReportePDF') && (
          <Reportes 
            vista={vista}
            setVista={setVista}
            alumnos={alumnos}
            grupos={userGroups}
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
          <div className="min-h-screen bg-ios-gray px-6 py-8 space-y-8 page-transition pb-24 relative max-w-[600px] mx-auto">
            <BackButton onClick={() => handleNavigation('Dashboard')} />
            <header className="flex items-center gap-4 pt-16">
              <div className="w-14 h-14 bg-ios-red/10 rounded-2xl flex items-center justify-center text-ios-red shadow-sm">
                <span className="material-icons-outlined text-3xl">emergency</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black tracking-tight">Emergencias</h2>
                <p className="text-secondary text-[10px] font-bold uppercase tracking-widest mt-1">Contacto Médico de Urgencia</p>
              </div>
            </header>

            <div className="bg-white rounded-[2.5rem] p-8 space-y-8 border border-black/5 shadow-ios overflow-hidden relative">
              <div className="relative z-10 space-y-8">
                {isEditingEmergency ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-black font-bold text-xs uppercase tracking-widest border-b border-black/5 pb-2">Servicio Público</h4>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest px-2">Nombre</label>
                        <input 
                          type="text" 
                          value={emergencyInfo.publicProvider}
                          onChange={(e) => setEmergencyInfo({...emergencyInfo, publicProvider: e.target.value})}
                          className="w-full bg-ios-gray border-none rounded-2xl px-4 py-4 text-black text-sm font-medium outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all"
                          placeholder="Ej. SAME"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest px-2">Teléfono</label>
                        <input 
                          type="tel" 
                          value={emergencyInfo.publicPhone}
                          onChange={(e) => setEmergencyInfo({...emergencyInfo, publicPhone: e.target.value})}
                          className="w-full bg-ios-gray border-none rounded-2xl px-4 py-4 text-black text-sm font-medium outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all font-mono"
                          placeholder="Ej. 107"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-black font-bold text-xs uppercase tracking-widest border-b border-black/5 pb-2">Servicio Privado</h4>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest px-2">Nombre</label>
                        <input 
                          type="text" 
                          value={emergencyInfo.privateProvider}
                          onChange={(e) => setEmergencyInfo({...emergencyInfo, privateProvider: e.target.value})}
                          className="w-full bg-ios-gray border-none rounded-2xl px-4 py-4 text-black text-sm font-medium outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all"
                          placeholder="Ej. SIPEM, OSDE..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest px-2">Teléfono</label>
                        <input 
                          type="tel" 
                          value={emergencyInfo.privatePhone}
                          onChange={(e) => setEmergencyInfo({...emergencyInfo, privatePhone: e.target.value})}
                          className="w-full bg-ios-gray border-none rounded-2xl px-4 py-4 text-black text-sm font-medium outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all font-mono"
                          placeholder="Ej. 0800-..."
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={async () => {
                        try {
                          await setDoc(doc(firestore, COLLECTIONS.CONFIG, 'emergency'), emergencyInfo);
                          setIsEditingEmergency(false);
                          setNotificacion({ t: "Guardado", d: "Números de emergencia actualizados." });
                          setTimeout(() => setNotificacion(null), 3000);
                        } catch (e) {
                          console.error("Error saving emergency info", e);
                        }
                      }}
                      className="w-full !rounded-[1.5rem]"
                    >
                      Guardar Configuración
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-10">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] mb-2">{emergencyInfo.publicProvider}</h3>
                        <a 
                          href={`tel:${emergencyInfo.publicPhone}`}
                          className="block text-6xl font-bold text-black tracking-tighter active:scale-95 transition-all"
                        >
                          {emergencyInfo.publicPhone}
                        </a>
                      </div>
                      <a 
                        href={`tel:${emergencyInfo.publicPhone}`}
                        className="w-full py-5 rounded-[1.5rem] bg-ios-red text-white font-bold uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <span className="material-icons-outlined">call</span>
                        Llamar ahora
                      </a>
                    </div>
                    <div className="h-px w-full bg-black/5"></div>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] mb-2">{emergencyInfo.privateProvider}</h3>
                        <a 
                          href={`tel:${emergencyInfo.privatePhone}`}
                          className="block text-4xl font-bold text-black tracking-tight active:scale-95 transition-all"
                        >
                          {emergencyInfo.privatePhone}
                        </a>
                      </div>
                      <a 
                        href={`tel:${emergencyInfo.privatePhone}`}
                        className="w-full py-5 rounded-[1.5rem] bg-ios-gray text-secondary border border-black/5 font-bold uppercase text-xs tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <span className="material-icons-outlined">call</span>
                        {emergencyInfo.privateProvider}
                      </a>
                    </div>
                    <button 
                      onClick={() => setIsEditingEmergency(true)}
                      className="text-[10px] text-ios-blue font-bold uppercase tracking-widest hover:underline flex items-center justify-center gap-1 mx-auto pt-4"
                    >
                      <span className="material-icons-outlined text-sm">edit</span>
                      Configurar Números
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 text-center opacity-40">
              <p className="text-[10px] text-secondary font-medium italic">En caso de emergencia médica grave, contacte inmediatamente a los servicios de salud locales.</p>
            </div>
          </div>
        )}

        {vista === 'Habilidades' && (
          <ErrorBoundary><Suspense fallback={<LoadingFallback />}>
            <Habilidades 
              alumnos={alumnos}
              setVista={setVista}
              handleNavigation={handleNavigation}
            />
          </Suspense></ErrorBoundary>
        )}

        {vista === 'Ajustes' && (
          <div className="min-h-screen bg-ios-gray px-6 py-8 space-y-8 page-transition pb-24 relative max-w-[600px] mx-auto">
            <BackButton onClick={() => handleNavigation('Dashboard')} />
            <header className="flex items-center gap-4 pt-16">
              <div className="w-14 h-14 bg-ios-blue/10 rounded-2xl flex items-center justify-center text-ios-blue shadow-sm">
                <span className="material-icons-outlined text-3xl">settings</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black tracking-tight">Ajustes</h2>
                <p className="text-secondary text-[10px] font-bold uppercase tracking-widest mt-1">Configuración del Sistema</p>
              </div>
            </header>

            <div className="bg-white rounded-[2.5rem] p-8 space-y-10 border border-black/5 shadow-ios">
              {/* Perfil */}
              <div className="space-y-4">
                <h3 className="text-secondary text-[10px] font-bold uppercase tracking-widest px-2">Perfil de Usuario</h3>
                <div className="flex items-center gap-5 p-5 bg-ios-gray rounded-[1.5rem] border border-black/5">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-secondary shadow-sm">
                    <span className="material-icons-outlined text-3xl">person</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-base font-bold text-black tracking-tight truncate">{user?.displayName || (userRole === 'Coordinator' ? 'Coordinador General' : 'Entrenador Pro')}</p>
                    <p className="text-xs text-secondary truncate mt-0.5">{user?.email || 'usuario@gymcoach.pro'}</p>
                  </div>
                </div>
              </div>

              {/* Preferencias */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-secondary text-[10px] font-bold uppercase tracking-widest">Preferencias</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-5 bg-ios-gray rounded-2xl border border-black/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-secondary shadow-sm">
                        <span className="material-icons-outlined text-xl">dark_mode</span>
                      </div>
                      <span className="text-sm font-bold text-black">Modo Claro (iOS Style)</span>
                    </div>
                    <div className="w-12 h-6 bg-ios-blue rounded-full relative transition-all">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-5 bg-ios-gray rounded-2xl border border-black/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-secondary shadow-sm">
                        <span className="material-icons-outlined text-xl">notifications</span>
                      </div>
                      <span className="text-sm font-bold text-black">Notificaciones Push</span>
                    </div>
                    <div className="w-12 h-6 bg-ios-blue rounded-full relative cursor-pointer shadow-inner" onClick={() => {
                      setNotificacion({ t: "Info", d: "Notificaciones activadas." });
                      setTimeout(() => setNotificacion(null), 3000);
                    }}>
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Datos */}
              <div className="space-y-4">
                <h3 className="text-secondary text-[10px] font-bold uppercase tracking-widest px-2">Copias de Seguridad</h3>
                
                <div className="grid grid-cols-1 gap-3">
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
                      setNotificacion({ t: "Éxito", d: "Backup descargado." });
                      setTimeout(() => setNotificacion(null), 3000);
                    }}
                    className="w-full flex items-center justify-between p-5 bg-ios-gray rounded-2xl border border-black/5 active:bg-black/5 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-ios-blue shadow-sm group-hover:scale-110 transition-transform">
                        <span className="material-icons-outlined text-xl">cloud_download</span>
                      </div>
                      <span className="text-sm font-bold text-black">Exportar JSON</span>
                    </div>
                    <span className="material-icons-outlined text-black/10">chevron_right</span>
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
                      className="w-full flex items-center justify-between p-5 bg-ios-gray rounded-2xl border border-black/5 active:bg-black/5 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-secondary shadow-sm group-hover:scale-110 transition-transform">
                          <span className="material-icons-outlined text-xl">cloud_upload</span>
                        </div>
                        <span className="text-sm font-bold text-black">Importar JSON</span>
                      </div>
                      <span className="material-icons-outlined text-black/10">chevron_right</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Configuración de Listas */}
              <div className="space-y-6">
                <h3 className="text-secondary text-[10px] font-bold uppercase tracking-widest px-2">Opciones de Listas</h3>
                
                <div className="space-y-6">
                  <EditableDropdown 
                    label="Niveles Deportivos"
                    options={niveles}
                    value={selectedNivelToManage}
                    onChange={setSelectedNivelToManage}
                    onAdd={handleSaveLevel}
                    onEdit={handleUpdateLevel}
                    onDelete={handleDeleteLevel}
                    placeholder="Gestionar..."
                  />

                  <EditableDropdown 
                    label="Disciplinas"
                    options={disciplinas}
                    value={selectedDisciplinaToManage}
                    onChange={setSelectedDisciplinaToManage}
                    onAdd={handleSaveDiscipline}
                    onEdit={handleUpdateDiscipline}
                    onDelete={handleDeleteDiscipline}
                    placeholder="Gestionar..."
                  />

                  <EditableDropdown 
                    label="Entradas en Calor"
                    options={warmupOptions}
                    value={selectedWarmupToManage}
                    onChange={setSelectedWarmupToManage}
                    onAdd={handleSaveWarmupOption}
                    onEdit={handleUpdateWarmupOption}
                    onDelete={handleDeleteWarmupOption}
                    placeholder="Gestionar..."
                  />

                  <EditableDropdown 
                    label="Vueltas a la Calma"
                    options={cooldownOptions}
                    value={selectedCooldownToManage}
                    onChange={setSelectedCooldownToManage}
                    onAdd={handleSaveCooldownOption}
                    onEdit={handleUpdateCooldownOption}
                    onDelete={handleDeleteCooldownOption}
                    placeholder="Gestionar..."
                  />
                </div>
              </div>

              {/* Sesión */}
              <div className="pt-8 border-t border-black/5">
                <button 
                  onClick={handleLogout}
                  className="w-full py-5 rounded-[1.5rem] bg-ios-red/10 text-ios-red font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm"
                >
                  <span className="material-icons-outlined text-lg">logout_variant</span>
                  Cerrar sesión segura
                </button>
              </div>
            </div>

            <div className="p-10 text-center opacity-30 space-y-1">
              <p className="text-[10px] font-bold text-black uppercase tracking-[0.3em]">GymCoach Pro 2.0</p>
              <p className="text-[9px] text-secondary font-medium uppercase tracking-widest">Plataforma de Alto Rendimiento</p>
            </div>
          </div>
        )}
      </Suspense></ErrorBoundary>
    </main>

      {/* Student Data Guide Tooltip */}
      <AnimatePresence>
        {vista === 'RegistroAlumno' && studentGuideCount < 3 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-6 right-6 z-[80] bg-white rounded-[2rem] p-6 border border-black/5 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <button 
                onClick={() => {
                  setStudentGuideCount(3);
                  localStorage.setItem('student_guide_count', '3');
                }} 
                className="text-black/10 hover:text-black transition-all"
              >
                <span className="material-icons-outlined text-sm">close</span>
              </button>
            </div>
            <div className="flex gap-5">
              <div className="w-12 h-12 bg-ios-blue/10 rounded-2xl flex items-center justify-center text-ios-blue shrink-0">
                <span className="material-icons-outlined">info</span>
              </div>
              <div className="space-y-1 pr-6">
                <h4 className="text-sm font-bold text-black tracking-tight">Consejo de Registro</h4>
                <p className="text-xs text-secondary leading-relaxed">
                  Asegúrate de incluir <span className="font-bold text-black">contacto de salud</span> y <span className="font-bold text-black">nivel deportivo</span> para un seguimiento preciso.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Created Success Overlay */}
      <AnimatePresence>
        {groupCreatedSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-white/80 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-10 border border-black/5 text-center space-y-8 shadow-2xl"
            >
              <div className="w-24 h-24 bg-ios-green/10 rounded-full flex items-center justify-center text-ios-green mx-auto border-4 border-ios-green/10">
                <span className="material-icons-outlined text-5xl">check_circle</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-black tracking-tight leading-none">¡Grupo Creado!</h3>
                <p className="text-secondary text-xs">Has creado el grupo <span className="text-black font-bold">{groupCreatedSuccess}</span> con éxito.</p>
              </div>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    const group = groupCreatedSuccess;
                    setGroupCreatedSuccess(null);
                    setStudentForm({ ...studentForm, grupo: group });
                    setVista('RegistroAlumno');
                    setNotificacion({ t: "Éxito", d: "Grupo creado. Ahora agregá tus alumnas." });
                  }}
                  className="w-full !py-6"
                >
                  Inscribir Alumnas ahora
                </Button>
                <button 
                  onClick={() => {
                    setGroupCreatedSuccess(null);
                    setVista('Dashboard');
                  }}
                  className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-black transition-all"
                >
                  Volver al Inicio
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding Overlay */}
      <AnimatePresence>
        {onboardingStep > 0 && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-3xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-lg rounded-[3rem] p-10 border border-black/5 space-y-8 shadow-2xl"
            >
              {onboardingStep === 1 && (
                <div className="text-center space-y-8">
                  <div className="w-24 h-24 bg-ios-blue/10 rounded-[2rem] flex items-center justify-center text-ios-blue shadow-sm mx-auto border border-ios-blue/5">
                    <span className="material-icons-outlined text-5xl">rocket_launch</span>
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-black tracking-tight">¡Bienvenido/a!</h2>
                    <p className="text-secondary text-sm leading-relaxed px-4">Configura tu gimnasio en solo 4 pasos para comenzar a gestionar tus clases de forma profesional.</p>
                  </div>
                  <div className="space-y-4">
                    <Button 
                      onClick={() => setOnboardingStep(2)}
                      className="w-full !py-6 !rounded-[1.5rem]"
                    >
                      Empezar Configuración
                    </Button>
                    <button 
                      onClick={() => setOnboardingStep(0)}
                      className="w-full py-2 text-[10px] font-bold text-secondary uppercase tracking-widest hover:text-black transition-all"
                    >
                      Omitir por ahora
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-black tracking-tight">Crea tu primer grupo</h2>
                    <p className="text-secondary text-xs">Un grupo organiza a tus gimnastas por horario o nivel. <br/>Ej: 'Escuelita Martes y Jueves'.</p>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <EditableDropdown
                        label="Nombre de la Profesor/a"
                        options={profesoresList}
                        value={newCoachName}
                        onChange={setNewCoachName}
                        onAdd={handleAddProfesor}
                        onEdit={handleUpdateProfesor}
                        onDelete={handleDeleteProfesor}
                        placeholder="Seleccionar o añadir..."
                      />
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-2">Días de la semana</label>
                       <div className="flex gap-2">
                         {[
                           { l: 'Lu', v: 'Lu' },
                           { l: 'Ma', v: 'Ma' },
                           { l: 'Mi', v: 'Mi' },
                           { l: 'Ju', v: 'Ju' },
                           { l: 'Vi', v: 'Vi' },
                           { l: 'Sá', v: 'Sá' }
                         ].map(day => {
                           const isSelected = nuevoGrupoDias.includes(day.v);
                           return (
                             <button
                               key={day.v}
                               type="button"
                               onClick={() => {
                                 const currentDays = nuevoGrupoDias.split(',').map(d => d.trim()).filter(Boolean);
                                 let newDays = [...currentDays];
                                 if (newDays.includes(day.v)) {
                                   newDays = newDays.filter(d => d !== day.v);
                                 } else {
                                   newDays.push(day.v);
                                 }
                                 const order = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
                                 newDays.sort((a,b) => order.indexOf(a) - order.indexOf(b));
                                 setNuevoGrupoDias(newDays.join(', '));
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
                          <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-2">Inicia</label>
                          <input 
                            type="time"
                            className="w-full bg-ios-gray border-none rounded-2xl p-5 text-black placeholder:text-secondary/40 outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all text-sm font-bold font-mono"
                            value={nuevoGrupoHorario.split(' a ')[0] || ''}
                            onChange={(e) => {
                              const end = nuevoGrupoHorario.split(' a ')[1] || '';
                              setNuevoGrupoHorario(`${e.target.value}${end ? ' a ' + end : ''}`);
                            }}
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-2">Finaliza</label>
                          <input 
                            type="time" 
                            className="w-full bg-ios-gray border-none rounded-2xl p-5 text-black placeholder:text-secondary/40 outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all text-sm font-bold font-mono"
                            value={nuevoGrupoHorario.split(' a ')[1] || ''}
                            onChange={(e) => {
                              const start = nuevoGrupoHorario.split(' a ')[0] || '';
                              setNuevoGrupoHorario(`${start}${e.target.value ? ' a ' + e.target.value : ''}`);
                            }}
                          />
                       </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-2">¿Qué edad tiene tu grupo?</label>
                      <select
                        className="w-full bg-ios-gray border-none rounded-2xl p-5 text-black placeholder:text-secondary/40 outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all font-bold appearance-none relative"
                        value={nuevoGrupoRangoEdad}
                        onChange={(e) => setNuevoGrupoRangoEdad(e.target.value)}
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "1.5em" }}
                      >
                        <option value="3 a 5 años">3 a 5 años</option>
                        <option value="6 a 9 años">6 a 9 años</option>
                        <option value="10 a 15 años">10 a 15 años</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-2">Nombre del Grupo</label>
                      <input 
                        placeholder="Ej: Nivel Inicial" 
                        className="w-full bg-ios-gray border-none rounded-2xl p-5 text-black placeholder:text-secondary/40 outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all font-bold"
                        value={nuevoGrupoNombre}
                        onChange={(e) => setNuevoGrupoNombre(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={async () => {
                      if (!newCoachName) {
                        setNotificacion({ t: "Error", d: "Debes seleccionar o añadir un profesor/a." });
                        setTimeout(() => setNotificacion(null), 3000);
                        return;
                      }
                      if (!nuevoGrupoNombre.trim() || !nuevoGrupoDias || !nuevoGrupoHorario) {
                        setNotificacion({ t: "Error", d: "Nombre del grupo, días y horario son obligatorios." });
                        setTimeout(() => setNotificacion(null), 3000);
                        return;
                      }
                      
                      const daysArray = nuevoGrupoDias.split(',').map(d => d.trim()).filter(d => d);
                      try {
                        const coach = profesoresList.find(p => p.nombre === newCoachName);
                        await addDocument(COLLECTIONS.GRUPOS, {
                          nombre: nuevoGrupoNombre,
                          entrenador: newCoachName,
                          entrenadorId: coach?.id || user?.uid || "",
                          dias: daysArray.length > 0 ? daysArray : ['Lu', 'Mi'],
                          horario: nuevoGrupoHorario,
                          rangoEdad: nuevoGrupoRangoEdad,
                          userId: user?.uid
                        });
                        loadData();
                        setOnboardingStep(3);
                      } catch (e) { console.error(e); }
                    }}
                    className="w-full !py-6 !rounded-[1.5rem]"
                  >
                    Crear y Continuar
                  </Button>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="text-center space-y-10">
                  <div className="space-y-4">
                    <h2 className="text-3xl font-bold text-black tracking-tight">Agrega gimnastas</h2>
                    <p className="text-secondary text-sm px-6">Ahora que tienes un grupo, ¡falta el equipo! Elige cómo quieres registrarlas.</p>
                  </div>
                  <div className="space-y-4 px-2">
                    <button 
                      onClick={() => { setVista('RegistroAlumno'); setOnboardingStep(0); }}
                      className="w-full flex items-center justify-between p-6 bg-ios-gray rounded-[1.5rem] border border-black/5 hover:bg-black/5 transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-ios-blue shadow-sm">
                          <span className="material-icons-outlined">person_add</span>
                        </div>
                        <span className="text-sm font-bold text-black">Una por una</span>
                      </div>
                      <span className="material-icons-outlined text-black/10">chevron_right</span>
                    </button>
                    <button 
                      onClick={() => { setIsBulkImporting(true); setOnboardingStep(4); }}
                      className="w-full flex items-center justify-between p-6 bg-ios-gray rounded-[1.5rem] border border-black/5 hover:bg-black/5 transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-secondary shadow-sm">
                          <span className="material-icons-outlined">upload_file</span>
                        </div>
                        <span className="text-sm font-bold text-black">Importar Excel/CSV</span>
                      </div>
                      <span className="material-icons-outlined text-black/10">chevron_right</span>
                    </button>
                    <button 
                      onClick={() => setOnboardingStep(0)}
                      className="text-[10px] font-bold text-secondary uppercase tracking-widest hover:text-black transition-all pt-4"
                    >
                      Lo haré más tarde
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 4 && (
                <div className="text-center space-y-10">
                  <div className="w-28 h-28 bg-ios-green/10 rounded-full flex items-center justify-center mx-auto border-4 border-ios-green/10">
                    <span className="material-icons-outlined text-ios-green text-6xl">verified</span>
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-black tracking-tight">¡Genial!</h2>
                    <p className="text-secondary text-sm leading-relaxed px-4">Ya tienes todo configurado. Recuerda que siempre puedes editar tus grupos y gimnastas en el menú.</p>
                  </div>
                  <Button 
                    onClick={() => { setOnboardingStep(0); setVista('Dashboard'); }}
                    className="w-full !py-6 !rounded-[1.5rem]"
                  >
                    Ir al Dashboard
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMoreOptions && menuOptions.length > 0 && (
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
              className="relative w-full max-w-[400px] bg-white rounded-[2.5rem] p-6 grid grid-cols-3 gap-4 shadow-2xl border border-black/5"
            >
              {menuOptions.map(opt => (
                <button 
                  key={opt.v}
                  onClick={() => {
                    handleNavigation(opt.v as ViewMode);
                    setShowMoreOptions(false);
                  }}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-ios-gray hover:bg-black/5 transition-all active:scale-95 border border-transparent"
                >
                  <span className={`material-symbols-outlined text-[32px] ${opt.c}`}>{opt.i}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">{opt.l}</span>
                </button>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Navegación Inferior (Refined for Antigravity) */}
      {vista !== 'ReportePDF' && onboardingStep === 0 && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/80 backdrop-blur-xl border-t border-black/5 px-6 pt-4 pb-8 flex justify-between items-center z-50">
          {(userRole === 'Coordinator' ? [
            { v: 'Dashboard', i: 'home', l: 'Inicio' },
            { v: 'ControlPagos', i: 'payments', l: 'Pagos' },
            { v: 'Profesores', i: 'badge', l: 'Staff' },
            { v: 'Menu', i: 'menu_open', l: 'Menú' },
            { v: 'Ajustes', i: 'settings', l: 'Ajustes' }
          ] : [
            { v: 'Dashboard', i: 'home', l: 'Inicio' },
            { v: 'Alumnos', i: 'group', l: 'Gimnastas' },
            { v: 'Horario', i: 'calendar_month', l: 'Grupos' },
            { v: 'Menu', i: 'menu_open', l: 'Menú' },
            { v: 'Ajustes', i: 'settings', l: 'Ajustes' }
          ]).map(item => (
            <button 
              key={item.v} 
              onClick={() => {
                if (item.v === 'Menu') {
                  setShowMoreOptions(!showMoreOptions);
                  return;
                }
                if (item.v === 'Alumnos') {
                  setAlumnosFilterMode(userRole === 'Coordinator' ? 'all' : 'myGroups');
                }
                handleNavigation(item.v as ViewMode);
                setShowMoreOptions(false);
              }} 
              className={`flex flex-col items-center gap-1.5 transition-all flex-1 ${
                ((item.v as string) === (vista as string) || 
                (item.v === 'Alumnos' && (vista === 'AlumnoDetalle' || vista === 'RegistroAlumno')) ||
                (item.v === 'Horario' && (vista === 'NuevaClase' || vista === 'ClaseDetalle' || vista === 'HistorialClases'))) && item.v !== 'Menu'
                ? 'text-primary' 
                : showMoreOptions && item.v === 'Menu'
                ? 'text-primary'
                : 'text-secondary hover:text-black'
              }`}
            >
              <span className={`material-symbols-outlined text-[26px] font-light ${
                ((item.v as string) === (vista as string) || 
                (item.v === 'Alumnos' && (vista === 'AlumnoDetalle' || vista === 'RegistroAlumno')) ||
                (item.v === 'Horario' && (vista === 'NuevaClase' || vista === 'ClaseDetalle' || vista === 'HistorialClases'))) && item.v !== 'Menu'
                ? 'fill-current' 
                : showMoreOptions && item.v === 'Menu'
                ? 'fill-current'
                : ''
              }`}>{item.i}</span>
              <span className={`text-[9px] uppercase tracking-wide ${
                ((item.v as string) === (vista as string) || 
                (item.v === 'Alumnos' && (vista === 'AlumnoDetalle' || vista === 'RegistroAlumno')) ||
                (item.v === 'Horario' && (vista === 'NuevaClase' || vista === 'ClaseDetalle' || vista === 'HistorialClases'))) && item.v !== 'Menu'
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
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] pb-3 pt-1 z-[70] pointer-events-none">
          <div className="h-1.5 w-32 bg-black/15 rounded-full mx-auto shrink-0 shadow-sm backdrop-blur-sm"></div>
        </div>
      )}

        {hasNewData && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[110] animate-in slide-in-from-top-4 duration-300">
            <button 
              onClick={() => {
                loadData();
                setHasNewData(false);
              }}
              className="bg-ios-blue text-white px-8 py-3 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-2xl flex items-center gap-3 border border-white/20 active:scale-95 transition-all"
            >
              <span className="material-icons-outlined text-sm">refresh</span>
              Nuevos datos disponibles
            </button>
          </div>
        )}


        {/* Focus Mode Overlay */}
        {isFocusMode && (
          <div className="fixed inset-0 z-[1000] bg-ios-gray overflow-y-auto">
            <div className="max-w-[800px] mx-auto px-6 py-20 space-y-12">
              <header className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-ios">
                <div>
                  <h1 className="text-3xl font-bold text-black tracking-tight">Modo Enfoque</h1>
                  <p className="text-ios-blue text-[10px] font-bold uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-ios-blue rounded-full animate-pulse shadow-ios"></span>
                    {vista} • Concentración Total
                  </p>
                </div>
                <button 
                  onClick={() => setIsFocusMode(false)}
                  className="w-12 h-12 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:scale-90 transition-all"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </header>

              <div className="animate-in fade-in zoom-in duration-500">
                {/* Render current view content in focus mode */}
                {vista === 'Dashboard' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Tarjeta 1: Próximas Clases */}
                    <div className="bg-white p-10 rounded-[3rem] shadow-ios flex flex-col h-full">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-bold text-black tracking-tight uppercase tracking-tighter">PRÓXIMAS CLASES</h3>
                        <span className="text-ios-blue material-icons-outlined text-4xl">schedule</span>
                      </div>
                      
                      <div className="space-y-5 flex-1">
                        {(() => {
                          const daysMap: Record<number, string> = { 0: 'Do', 1: 'Lu', 2: 'Ma', 3: 'Mi', 4: 'Ju', 5: 'Vi', 6: 'Sa' };
                          const todayStr = daysMap[new Date().getDay()];
                          const sortedGroups = [...grupos]
                            .filter(g => g.dias?.includes(todayStr))
                            .sort((a, b) => a.horario.localeCompare(b.horario));
                          
                          const displayGroups = sortedGroups.length > 0 ? sortedGroups : grupos.slice(0, 3);

                          return displayGroups.length > 0 ? displayGroups.map(g => (
                            <button 
                              key={g.id} 
                              onClick={() => {
                                setActiveGroup(g);
                                setVista('AsistenciaLista');
                                setIsFocusMode(false);
                              }}
                              className="w-full flex justify-between items-center p-6 bg-ios-gray hover:bg-black/5 rounded-[1.5rem] transition-all group"
                            >
                              <div className="flex flex-col items-start">
                                <span className="font-bold text-lg text-black group-hover:text-ios-blue transition-colors uppercase tracking-tight">{g.nombre}</span>
                                <span className="text-[10px] text-secondary uppercase font-bold tracking-widest">{g.entrenador}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-ios-blue font-mono text-xl font-bold">{g.horario}</span>
                              </div>
                            </button>
                          )) : (
                            <div className="py-12 text-center text-secondary/40 italic">No hay clases programadas para hoy.</div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Tarjeta 2: Alertas Críticas */}
                    <div className="bg-white p-10 rounded-[3rem] shadow-ios flex flex-col h-full">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-bold text-black tracking-tight uppercase tracking-tighter">ALERTAS CRÍTICAS</h3>
                        <span className="text-ios-red material-icons-outlined text-4xl">priority_high</span>
                      </div>
                      
                      <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-2">
                        {alumnos.filter(a => a.alertas && a.alertas.length > 0 && a.alertas[0] !== '').length > 0 ? (
                          alumnos.filter(a => a.alertas && a.alertas.length > 0 && a.alertas[0] !== '').map(a => (
                            <div key={a.id} className="p-6 bg-ios-red/5 border border-ios-red/10 rounded-[1.5rem] space-y-2">
                              <h5 className="font-bold text-black text-sm uppercase">{a.nombre}</h5>
                              <p className="text-[10px] text-ios-red leading-relaxed font-medium">{a.alertas?.join(' • ')}</p>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-4">
                            <div className="w-16 h-16 bg-ios-green/10 rounded-full flex items-center justify-center text-ios-green">
                              <span className="material-icons-outlined text-4xl">check_circle</span>
                            </div>
                            <p className="text-xs text-secondary/40 font-bold uppercase tracking-widest leading-loose">Todo tranquilo.<br/>No hay alertas críticas.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center pt-8">
               <button 
                  onClick={() => setIsFocusMode(false)}
                  className="px-10 py-5 rounded-[2rem] bg-black text-white font-bold uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all"
                >
                  Salir de Modo Enfoque
                </button>
              </div>
            </div>
          </div>
        )}

        {aiAnalysis && (
          <div className="fixed inset-0 z-[110] bg-white/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] p-10 border border-black/5 space-y-8 shadow-2xl animate-in zoom-in duration-300 max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center bg-white py-2 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-ios-blue/10 rounded-xl flex items-center justify-center text-ios-blue shadow-sm">
                    <span className="material-icons-outlined text-2xl">psychology</span>
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-xl font-bold text-black tracking-tight uppercase tracking-tighter">Insights de Coach IA</h3>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Análisis Inteligente</p>
                  </div>
                </div>
                <button 
                  onClick={() => setAiAnalysis(null)} 
                  className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:scale-90 transition-all shadow-sm"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="prose prose-sm max-w-none text-black leading-relaxed font-medium">
                  <Markdown>{aiAnalysis}</Markdown>
                </div>
              </div>
              <Button 
                onClick={() => setAiAnalysis(null)}
                className="w-full !py-6 !rounded-[1.5rem]"
              >
                Entendido
              </Button>
            </div>
          </div>
        )}

        {isBulkImporting && (
          <div className="fixed inset-0 z-[120] bg-white/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-10 border border-black/5 space-y-8 shadow-2xl animate-in zoom-in duration-300">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-white">
                    <span className="material-icons-outlined">upload_file</span>
                  </div>
                  <h3 className="text-xl font-bold text-black tracking-tight uppercase tracking-tighter">Importación Masiva</h3>
                </div>
                <button 
                    onClick={() => setIsBulkImporting(false)} 
                    className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:scale-90 transition-all shadow-sm"
                  >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="p-6 bg-ios-blue/5 border border-ios-blue/10 rounded-[2rem] space-y-4">
                  <p className="text-[10px] text-ios-blue font-bold uppercase tracking-widest leading-loose">
                    Pega los datos desde Excel o sube un archivo CSV/Excel. <br/>
                    <span className="text-black/40">Formato: Nombre, DNI, Grupo, Nivel, Teléfono</span>
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
                      className="flex-1 py-4 px-6 rounded-2xl bg-white border border-black/5 text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-md hover:bg-ios-gray transition-all active:scale-95"
                    >
                      <span className="material-icons-outlined text-sm text-ios-blue">file_open</span>
                      Sube tu archivo
                    </button>
                  </div>
                </div>

                <textarea 
                  className="w-full h-56 bg-ios-gray border-none rounded-[2rem] p-6 text-xs text-black placeholder:text-black/20 outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all font-mono font-bold"
                  placeholder="Juan Perez, 12, Grupo A, Escuela, 11223344&#10;Maria Gomez, 87, Grupo B, Escuela, 55443322"
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => setIsBulkImporting(false)}
                    className="py-5 rounded-[1.5rem] bg-ios-gray text-secondary font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      if (bulkImportText.trim()) {
                        handleBulkImportSubmit();
                        setIsBulkImporting(false);
                      }
                    }}
                    className="py-5 rounded-[1.5rem] bg-ios-blue text-white font-bold text-[10px] uppercase tracking-widest shadow-ios active:scale-95 transition-all"
                  >
                    Confirmar Importación
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isBulkPaymentModalOpen && (
          <BulkPaymentImport 
            onComplete={(count) => {
              setIsBulkPaymentModalOpen(false);
              setNotificacion({ t: "Importación Completa", d: `Se sincronizaron ${count} pagos exitosamente.` });
              loadData();
              setTimeout(() => setNotificacion(null), 3000);
            }}
            onCancel={() => setIsBulkPaymentModalOpen(false)}
          />
        )}

        {/* Modal de Confirmación */}
        {confirmModal && confirmModal.show && (
          <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 border border-black/5 space-y-8 shadow-2xl animate-in zoom-in duration-300">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-ios-red/10 rounded-3xl flex items-center justify-center border border-ios-red/10 shadow-sm">
                  <span className="material-icons-outlined text-ios-red text-4xl">warning_amber</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-black tracking-tight uppercase tracking-tighter">{confirmModal.title}</h3>
                  <p className="text-secondary text-sm leading-relaxed px-2">{confirmModal.message}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="py-5 rounded-[1.5rem] bg-ios-gray text-secondary font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="py-5 rounded-[1.5rem] bg-ios-red text-white font-bold text-[10px] uppercase tracking-widest shadow-ios active:scale-95 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notificaciones */}
        <AnimatePresence>
          {notificacion && (
            <motion.div 
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-[400px]"
            >
              <div 
                className={`bg-white/90 backdrop-blur-2xl p-5 rounded-[2rem] shadow-2xl border border-black/5 flex flex-col gap-3 transition-all ${notificacion.detalles ? 'cursor-pointer hover:bg-white' : ''}`}
                onClick={() => {
                  if (notificacion.detalles) {
                    setShowNotifDetails(!showNotifDetails);
                  }
                }}
              >
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 ${notificacion.t.includes('Error') || notificacion.t.includes('Parcial') ? 'bg-rose-500/10 text-rose-500' : 'bg-ios-blue/10 text-ios-blue'} rounded-2xl flex items-center justify-center shadow-sm shrink-0 border border-current/5`}>
                    <span className="material-icons-outlined text-2xl">
                      {notificacion.t.includes('Error') || notificacion.t.includes('Parcial') ? 'warning' : 'verified'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${notificacion.t.includes('Error') || notificacion.t.includes('Parcial') ? 'text-rose-600' : 'text-ios-blue'} truncate`}>{notificacion.t}</p>
                    <p className="text-xs text-black font-medium mt-0.5 leading-tight italic">"{notificacion.d}"</p>
                    {notificacion.detalles && !showNotifDetails && (
                      <p className="text-[9px] text-rose-500 font-bold uppercase mt-1 tracking-tighter animate-pulse">Haz clic para ver errores</p>
                    )}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotificacion(null);
                      setShowNotifDetails(false);
                    }}
                    className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary active:scale-90 transition-all hover:bg-black/5"
                  >
                    <span className="material-icons-outlined text-sm">close</span>
                  </button>
                </div>

                {notificacion.detalles && showNotifDetails && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="overflow-hidden border-t border-black/5 pt-3"
                  >
                    <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {notificacion.detalles.map((err, i) => (
                        <div key={i} className="flex gap-2 text-[10px] text-rose-600/80 font-medium bg-rose-500/5 p-2 rounded-xl">
                          <span className="shrink-0">•</span>
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };
  
  export default App;
