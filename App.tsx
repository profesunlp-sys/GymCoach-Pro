import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import Markdown from 'react-markdown';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend, PieChart, Pie
} from 'recharts';
import { Alumno, Clase, ViewMode, GrupoConfig, AsistenciaRecord, UserRole, Feedback, Skill, SkillStatus, Apparatus, Source } from './types';
import { processClassAudio, refineClassAnalysis, analyzeAttendanceStats, queryKnowledgeBase } from './services/geminiService';
import { SKILL_TREE, DISCIPLINAS, NIVELES as DEFAULT_NIVELES } from './constants';
import { db as firestore, auth, googleProvider, COLLECTIONS, getCollectionData, addDocument, updateDocument, deleteDocument, getAttendanceByStudent } from './services/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, orderBy, setDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { CoachAI } from './src/components/CoachAI';

const EditableDropdown = ({ 
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
      <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">{label}</label>
      <div className="relative group">
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-antigravity-charcoal border rounded-xl px-4 py-3 text-sm text-white appearance-none border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none transition-all"
        >
          <option value="">{placeholder}</option>
          {options.map((opt, idx) => (
            <option key={opt.id || idx} value={opt.nombre}>
              {opt.nombre} {opt.entrenador ? `— ${opt.entrenador}` : ''}
            </option>
          ))}
        </select>
        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-antigravity-charcoal px-1">
           {value && (
             <>
               <button 
                 type="button"
                 onClick={() => {
                   const opt = options.find(o => o.nombre === value);
                   if (opt?.id) {
                     const newName = window.prompt(`Editar ${label.toLowerCase()}:`, opt.nombre);
                     if (newName && newName !== opt.nombre) onEdit(opt.id, newName);
                   }
                 }}
                 className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
               >
                 <span className="material-icons-outlined text-xs">edit</span>
               </button>
               <button 
                 type="button"
                 onClick={() => {
                   const opt = options.find(o => o.nombre === value);
                   if (opt?.id) onDelete(opt.id);
                 }}
                 className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
               >
                 <span className="material-icons-outlined text-xs">delete</span>
               </button>
             </>
           )}
        </div>
        <button 
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:scale-110 transition-transform"
        >
          <span className="material-icons-outlined text-sm">{isAdding ? 'close' : 'add'}</span>
        </button>
      </div>
      {isAdding && (
        <div className="flex gap-2 mt-2 animate-in slide-in-from-top-1 duration-200">
          <input 
            type="text" 
            value={newItem} 
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={`Nuevo ${label.toLowerCase()}...`}
            className="flex-1 bg-antigravity-charcoal border border-neon-blue rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-neon-blue/50 transition-all"
          />
          <button 
            type="button"
            onClick={() => {
              if (newItem.trim()) {
                onAdd(newItem.trim());
                setNewItem('');
                setIsAdding(false);
              }
            }}
            className="px-3 py-2 bg-primary text-antigravity-black rounded-lg text-xs font-bold active:scale-95 transition-all"
          >
            Añadir
          </button>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('Coach');
  const [vista, setVista] = useState<ViewMode>('Dashboard');
  const [alumnosFilterMode, setAlumnosFilterMode] = useState<'all' | 'alerts'>('all');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [grupos, setGrupos] = useState<GrupoConfig[]>([]);
  const [niveles, setNiveles] = useState<{id?: string, nombre: string}[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<Record<string, boolean>>({});
  const [selectedClase, setSelectedClase] = useState<Clase | null>(null);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [alumnoAsistencias, setAlumnoAsistencias] = useState<AsistenciaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAsistencias, setIsLoadingAsistencias] = useState(false);
  const [selectedProfesor, setSelectedProfesor] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [newFeedback, setNewFeedback] = useState("");
  
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('Todas');
  const [asistenciasClase, setAsistenciasClase] = useState<AsistenciaRecord[]>([]);
  const [isLoadingAsistenciasClase, setIsLoadingAsistenciasClase] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAlumnoId, setExpandedAlumnoId] = useState<string | null>(null);
  const [planesFilterDate, setPlanesFilterDate] = useState("");
  const [planesFilterCoach, setPlanesFilterCoach] = useState("");

  // Add Gymnast/Teacher State
  const [isAddingAlumno, setIsAddingAlumno] = useState(false);
  const [newAlumnoForm, setNewAlumnoForm] = useState({ nombre: '', dni: '', grupo: '', nivel: '' });
  const [isAddingProfesor, setIsAddingProfesor] = useState(false);
  const [isSavingProfesor, setIsSavingProfesor] = useState(false);
  const [newProfesorName, setNewProfesorName] = useState('');
  const [profesoresList, setProfesoresList] = useState<{id?: string, nombre: string}[]>([]);

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

  // Knowledge Base State
  const [sources, setSources] = useState<Source[]>([]);
  const [kbMessages, setKbMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [isKbLoading, setIsKbLoading] = useState(false);
  const [kbInput, setKbInput] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result?.toString().split(',')[1];
      if (base64) {
        const newSource: Source = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: 'pdf',
          content: base64,
          uploadDate: new Date().toISOString()
        };
        setSources(prev => [...prev, newSource]);
        setNotificacion({ t: 'Éxito', d: `Documento "${file.name}" cargado correctamente.` });
      }
    };
    reader.readAsDataURL(file);
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
      return claseGrupo !== '' || faseInicial.length > 0 || fasePrincipal.length > 0 || faseFinal.length > 0;
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
      setLoginError(error.message);
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
      setLoginError(error.message);
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
      let msg = `Error (${error.code || 'unknown'}): ${error.message || 'Error desconocido'}`;
      
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      handleNavigation('Dashboard');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const [asistenciasGlobales, setAsistenciasGlobales] = useState<Record<string, { presentes: number, total: number }>>({});
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
      const p = await getCollectionData(COLLECTIONS.PROFESORES) as {id?: string, nombre: string}[];
      const n = await getCollectionData(COLLECTIONS.NIVELES) as {id?: string, nombre: string}[];
      setAlumnos(a);
      setClases(c.sort((x, y) => new Date(y.fecha).getTime() - new Date(x.fecha).getTime()));
      setGrupos(g);
      setProfesoresList(p || []);
      setNiveles(n.length > 0 ? n : [
        { nombre: 'Escuela' },
        { nombre: 'Pre-Equipo' },
        { nombre: 'Equipo' }
      ]);
      
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
        querySnapshot.forEach(doc => {
          const data = doc.data() as AsistenciaRecord;
          attMap[data.alumnoId] = data.presente;
        });
        setAsistenciasHoy(attMap);
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
    if (userRole === 'Coordinator') return;
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
    if (userRole === 'Coordinator') return;
    if (!grupo.id) return;
    
    if (window.confirm(`¿Estás seguro de que deseas eliminar el grupo "${grupo.nombre}"? Esta acción no se puede deshacer y podrías perder el acceso a los datos asociados a este grupo.`)) {
      try {
        await deleteDocument(COLLECTIONS.GRUPOS, grupo.id);
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

  const handleUpdateLevel = async (id: string, nombre: string) => {
    try {
      await updateDocument(COLLECTIONS.NIVELES, id, { nombre });
      setNotificacion({ t: "Éxito", d: "Nivel actualizado." });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
  };

  const handleDeleteLevel = async (id: string) => {
    if (!window.confirm("¿Eliminar este nivel?")) return;
    try {
      await deleteDocument(COLLECTIONS.NIVELES, id);
      setNotificacion({ t: "Éxito", d: "Nivel eliminado." });
      loadData();
    } catch (error: any) {
      setNotificacion({ t: "Error", d: error.message });
    }
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

  const handleAddProfesor = async () => {
    if (!newProfesorName.trim()) return;
    setIsSavingProfesor(true);
    try {
      await addDocument(COLLECTIONS.PROFESORES, { nombre: newProfesorName });
      await loadData();
      setIsAddingProfesor(false);
      setNewProfesorName('');
      setNotificacion({ t: "Profesor Añadido", d: `${newProfesorName} registrado correctamente.` });
    } catch (error) {
      console.error("Error adding professor:", error);
      setNotificacion({ t: "Error", d: "No se pudo añadir al profesor." });
    } finally {
      setIsSavingProfesor(false);
    }
  };

  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn) return;

    const unsubAlumnos = onSnapshot(collection(firestore, COLLECTIONS.ALUMNOS), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !snapshot.metadata.hasPendingWrites) {
          const data = change.doc.data() as Alumno;
          setNotificacion({ t: "Nuevo Alumno", d: `${data.nombre} se ha unido al gimnasio.` });
        }
      });
    });

    const unsubClases = onSnapshot(collection(firestore, COLLECTIONS.CLASES), (snapshot) => {
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

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<any>) => {
        const text = results.data.map((row: any) => row.join(',')).join('\n');
        setBulkImportText(text);
      }
    });
  };

  const handleBulkImport = async () => {
    const lines = bulkImportText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return;

    setIsLoading(true);
    let importedCount = 0;
    let errors: string[] = [];
    
    for (const line of lines) {
      // Split by comma, semicolon or tab
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      if (parts.length < 1 || !parts[0]) {
        errors.push(`Línea vacía o sin nombre: "${line}"`);
        continue;
      }

      const nombre = parts[0];
      const dni = parts[1] || '';
      const grupo = parts[2] || 'Sin Grupo';
      const nivel = parts[3] || 'Escuela';
      const telefono = parts[4] || '';

      // Validación básica
      if (nombre.length < 3) {
        errors.push(`Nombre demasiado corto: "${nombre}"`);
        continue;
      }
      if (dni && !/^\d+$/.test(dni)) {
        errors.push(`DNI inválido (solo números): "${dni}" para ${nombre}`);
        continue;
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
        await addDocument(COLLECTIONS.ALUMNOS, newStudent);
        importedCount++;
      } catch (e) {
        errors.push(`Error al guardar a ${nombre}: ${e}`);
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

  const handleSaveStudent = async () => {
    if (!studentForm.nombre || !studentForm.fechaNacimiento) {
      setNotificacion({ t: "Error", d: "Nombre y Fecha de Nacimiento son obligatorios." });
      return;
    }

    setIsSavingStudent(true);
    try {
      // Calcular edad al 31 de diciembre del año corriente
      const currentYear = new Date().getFullYear();
      const birthDate = new Date(studentForm.fechaNacimiento);
      const ageAtEndOfYear = currentYear - (birthDate.getFullYear() || currentYear);

      const newStudent: Omit<Alumno, 'id'> = {
        ...studentForm as Alumno,
        edad: isNaN(ageAtEndOfYear) ? 0 : ageAtEndOfYear,
        dni: studentForm.dni || 'No especificado',
        grupo: activeGroup?.nombre || 'Sin Grupo',
        fechaIngreso: new Date().toISOString(),
        estadoPago: 'Al día',
        habilidades: [],
        biometria: { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 },
        qrCode: `QR_${studentForm.dni || new Date().getTime()}`,
        asistenciasHistoricas: 0
      };

      // Remove undefined values just in case
      Object.keys(newStudent).forEach(key => {
        if ((newStudent as any)[key] === undefined) {
          delete (newStudent as any)[key];
        }
      });

      await addDocument(COLLECTIONS.ALUMNOS, newStudent);
      await loadData();
      setNotificacion({ t: "Gimnasta Registrado", d: `${newStudent.nombre} añadido.` });
      handleNavigation('AsistenciaLista');
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
          presente: isPresent
        });
      }
    } catch (error: any) {
      console.error("Error toggling attendance:", error);
      setNotificacion({ t: "Error", d: error.message || "No se pudo actualizar la asistencia." });
      setTimeout(() => setNotificacion(null), 5000);
      // Revert optimistic update
      setAsistenciasHoy(prev => ({ ...prev, [alumnoId]: !prev[alumnoId] }));
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
        lastUpdateDate: now
      };

      const updatedHabilidades = [...(selectedAlumno.habilidades || []), skillToAdd];
      
      await updateDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id, {
        habilidades: updatedHabilidades
      });
      
      setSelectedAlumno({ ...selectedAlumno, habilidades: updatedHabilidades });
      setIsAddingSkill(false);
      setNewSkill({ name: '', status: 'No Iniciado', apparatus: 'Suelo', level: '1' });
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
    } catch (error) {
      console.error("Error updating skill:", error);
      setNotificacion({ t: "Error", d: "No se pudo actualizar la habilidad." });
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (!selectedAlumno || !selectedAlumno.id) return;
    if (!confirm("¿Eliminar esta habilidad?")) return;
    try {
      const updatedHabilidades = (selectedAlumno.habilidades || []).filter(skill => skill.id !== skillId);
      await updateDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id, { habilidades: updatedHabilidades });
      setSelectedAlumno({ ...selectedAlumno, habilidades: updatedHabilidades });
      loadData();
    } catch (error) {
      console.error("Error deleting skill:", error);
      setNotificacion({ t: "Error", d: "No se pudo eliminar la habilidad." });
    }
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

  const handleDeleteAlumno = async () => {
    if (!selectedAlumno || !selectedAlumno.id) return;
    if (!confirm(`¿Estás seguro de eliminar a ${selectedAlumno.nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id);
      handleNavigation('Alumnos');
      setSelectedAlumno(null);
      loadData();
      setNotificacion({ t: "Gimnasta Eliminado", d: "El registro ha sido borrado." });
    } catch (error) {
      console.error("Error deleting student:", error);
      setNotificacion({ t: "Error", d: "No se pudo eliminar al gimnasta." });
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

  const handleSaveManualClass = async () => {
    if (!claseGrupo) {
      setNotificacion({ t: "Error", d: "Debes seleccionar un grupo." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }

    let finalGroupName = claseGrupo;
    let finalCoachName = user?.displayName || 'Coach Pro';

    try {
      // Find existing group to get its coach
      const existingGroup = grupos.find(g => g.nombre === claseGrupo);
      if (existingGroup && existingGroup.entrenador) {
        finalCoachName = existingGroup.entrenador;
      }

      const newClase: Omit<Clase, 'id'> = {
        fecha: new Date().toISOString(),
        grupo: finalGroupName,
        horario: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        entrenador: finalCoachName,
        faseInicial: faseInicial,
        fasePrincipal: fasePrincipal,
        faseFinal: faseFinal,
        faseInicialDuration: faseInicialDuration,
        fasePrincipalDuration: fasePrincipalDuration,
        faseFinalDuration: faseFinalDuration,
        habilidadesPorAparato: habilidadesPorAparato
      };
      await addDocument(COLLECTIONS.CLASES, newClase);
      loadData();
      setNotificacion({ t: "Éxito", d: `Clase registrada correctamente.` });
      setTimeout(() => setNotificacion(null), 3000);
      setClaseGrupo("");
      setNewClaseGroupName("");
      setNewClaseCoachName("");
      setFaseInicial([]);
      setFasePrincipal([]);
      setFaseFinal([]);
      setHabilidadesPorAparato({});
      setVista('Dashboard');
    } catch (error: any) {
      console.error("Error saving manual class:", error);
      setNotificacion({ t: "Error", d: error.message || "No se pudo guardar la clase manual." });
      setTimeout(() => setNotificacion(null), 5000);
    }
  };

  const timeIntervals = Array.from({ length: 31 }, (_, i) => {
    const hour = Math.floor(i / 2) + 7;
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });
  const filteredAlumnos = alumnos.filter(a => 
    a.grupo === activeGroup?.nombre && 
    (a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || a.dni.includes(searchQuery))
  );
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
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-[0.3em]"><span className="bg-antigravity-black px-4 text-white/50 italic">O</span></div>
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
              <p className="text-sm text-slate-400 leading-relaxed">
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
        
        {vista === 'Dashboard' && (
          <div className="px-6 space-y-8 page-transition pt-4">
            <header className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent-purple/20 rounded-xl flex items-center justify-center border border-accent-purple/30 shadow-neon-purple">
                  <span className="material-icons-outlined text-accent-purple">fitness_center</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white leading-none">GymCoach <span className="text-primary">Pro</span></h1>
                  <span className="text-[8px] uppercase tracking-[0.2em] text-primary/60 font-bold">{userRole === 'Coordinator' ? 'Modo Coordinación' : 'Modo Entrenador'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user?.email === COORDINATOR_EMAIL && (
                  <button 
                    onClick={() => setUserRole(prev => prev === 'Coordinator' ? 'Coach' : 'Coordinator')}
                    className="w-10 h-10 rounded-full glass-card flex items-center justify-center border border-primary/30 text-primary active:scale-90 transition-all"
                    title="Alternar Vista"
                  >
                    <span className="material-icons-outlined text-sm">swap_horiz</span>
                  </button>
                )}
                <button 
                  onClick={handleLogout}
                  className="w-10 h-10 rounded-full glass-card flex items-center justify-center border border-rose-500/30 text-rose-500 active:scale-90 transition-all"
                  title="Cerrar Sesión"
                >
                  <span className="material-icons-outlined text-sm">logout</span>
                </button>
              </div>
            </header>

            <section className="gradient-header rounded-[2.5rem] p-7 relative overflow-hidden shadow-2xl border border-white/10">
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight leading-tight">¡Hola {userRole === 'Coordinator' ? 'Coordinador' : (user?.displayName?.split(' ')[0] || 'Entrenador')}!</h2>
                <p className="text-indigo-100 text-sm mb-7 font-medium">
                  {userRole === 'Coordinator' ? 'Supervisa el progreso de tus colegas.' : 'Configura tu semana para empezar.'}
                </p>
                {userRole === 'Coach' && (
                  <button onClick={() => handleNavigation('NuevaClase')} className="bg-white text-indigo-800 font-black px-7 py-3.5 rounded-[1.25rem] flex items-center gap-2 shadow-xl text-[11px] uppercase tracking-widest active:scale-95 transition-all">
                    <span className="material-icons-outlined text-sm">add_circle</span> Registrar Clase
                  </button>
                )}
              </div>
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            </section>

            {userRole === 'Coordinator' && alertasGlobales.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <span className="material-icons-outlined text-rose-500 animate-pulse">warning</span>
                  <h3 className="text-rose-500 font-bold text-lg">Alertas Médicas Críticas</h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {alertasGlobales.map(gimnasta => (
                    <div key={gimnasta.id} className="min-w-[200px] bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 space-y-2">
                      <p className="text-white font-bold text-xs truncate">{gimnasta.nombre}</p>
                      <p className="text-[10px] text-rose-200/60 italic line-clamp-2">"{gimnasta.alertas[0]}"</p>
                      <p className="text-[8px] font-black uppercase text-rose-500 tracking-widest">{gimnasta.grupo}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {userRole === 'Coordinator' && (
              <section className="space-y-4">
                <h3 className="text-primary font-bold text-lg active-glow">Estado de Asistencia Hoy</h3>
                <div className="grid grid-cols-2 gap-4">
                  {grupos.map((g) => {
                    const stats = asistenciasGlobales[g.nombre] || { presentes: 0, total: 0 };
                    const isTaken = stats.total > 0 && stats.presentes > 0;
                    return (
                      <div 
                        key={g.id} 
                        onClick={() => { setActiveGroup(g); setVista('AsistenciaLista'); }}
                        className="glass-card rounded-3xl p-5 border border-white/5 space-y-3 active:scale-95 transition-all cursor-pointer"
                      >
                        <h4 className="text-xs font-bold text-white truncate">{g.nombre}</h4>
                        <div className="flex items-end justify-between">
                          <span className={`text-xl font-black ${isTaken ? 'text-primary' : 'text-rose-500'}`}>
                            {stats.presentes}<span className="text-[10px] text-white/50 mx-1">/</span>{stats.total}
                          </span>
                          <span className={`text-[8px] font-black uppercase tracking-widest ${isTaken ? 'text-primary/60' : 'text-rose-500/60'}`}>
                            {isTaken ? 'Enviada' : 'Pendiente'}
                          </span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${isTaken ? 'bg-primary shadow-neon-cyan' : 'bg-rose-500'}`} 
                            style={{ width: `${stats.total > 0 ? (stats.presentes / stats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {userRole === 'Coordinator' && (
              <section className="space-y-4">
                <div className="flex justify-between px-1"><h3 className="text-white font-bold text-lg">Actividad Reciente</h3></div>
                <div className="space-y-3">
                  {clases.slice(0, 5).map((clase) => (
                    <div 
                      key={clase.id} 
                      onClick={() => { setSelectedClase(clase); handleNavigation('ClaseDetalle'); }}
                      className="glass-card rounded-2xl p-4 border border-white/5 flex items-center justify-between active:scale-95 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                          <span className="material-icons-outlined text-primary text-xl">history_edu</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{clase.grupo}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">{new Date(clase.fecha).toLocaleDateString()} • {clase.entrenador}</p>
                        </div>
                      </div>
                      <span className="material-icons-outlined text-slate-600 text-sm">chevron_right</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {userRole === 'Coach' && (
              <section className="space-y-4">
                <div className="flex justify-between px-1"><h3 className="text-white font-bold text-lg">Accesos Rápidos</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => { handleNavigation('Horario'); }}
                    className="glass-card rounded-3xl p-5 border border-white/5 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    <div className="w-12 h-12 bg-neon-cyan/10 rounded-2xl flex items-center justify-center border border-neon-cyan/20 shadow-neon-cyan">
                      <span className="material-icons-outlined text-neon-cyan text-2xl">fact_check</span>
                    </div>
                    <span className="text-xs font-bold text-white text-center">Lista de Asistencia</span>
                  </button>
                  
                  <button 
                    onClick={() => { setAlumnosFilterMode('all'); handleNavigation('Alumnos'); }}
                    className="glass-card rounded-3xl p-5 border border-white/5 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    <div className="w-12 h-12 bg-accent-purple/10 rounded-2xl flex items-center justify-center border border-accent-purple/20 shadow-neon-purple">
                      <span className="material-icons-outlined text-accent-purple text-2xl">group</span>
                    </div>
                    <span className="text-xs font-bold text-white text-center">Datos de Alumnos</span>
                  </button>

                  <button 
                    onClick={() => { setAlumnosFilterMode('alerts'); handleNavigation('Alumnos'); }}
                    className="glass-card rounded-3xl p-5 border border-white/5 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20 shadow-neon-rose">
                      <span className="material-icons-outlined text-rose-500 text-2xl">medical_services</span>
                    </div>
                    <span className="text-xs font-bold text-white text-center">Obs. de Salud</span>
                  </button>

                  <button 
                    onClick={() => { handleNavigation('AsistenciaStats'); }}
                    className="glass-card rounded-3xl p-5 border border-white/5 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-neon-cyan">
                      <span className="material-icons-outlined text-primary text-2xl">analytics</span>
                    </div>
                    <span className="text-xs font-bold text-white text-center">Estadísticas</span>
                  </button>

                  <button 
                    onClick={() => { handleNavigation('Emergencias'); }}
                    className="glass-card rounded-3xl p-5 border border-white/5 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-neon-amber">
                      <span className="material-icons-outlined text-amber-500 text-2xl">emergency</span>
                    </div>
                    <span className="text-xs font-bold text-white text-center">Emergencias</span>
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {vista === 'Horario' && (
          <div className="px-6 py-8 space-y-8 page-transition">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Horarios y Grupos</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Gestión de Clases</p>
            </header>

            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-accent-purple font-bold text-lg active-glow">
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
                    className="text-[10px] text-slate-400 uppercase font-bold hover:text-white transition-colors"
                  >
                    Cancelar Edición
                  </button>
                )}
              </div>
              <div className="glass-card rounded-[2.5rem] p-6 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <span className="material-icons-outlined text-primary text-sm">calendar_month</span>
                    <h4 className="text-[10px] uppercase font-black text-white/50 tracking-[0.2em]">Días de Entrenamiento</h4>
                  </div>
                  <div className="flex justify-between items-center px-1">
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
                        <div key={day.id} className="flex flex-col items-center gap-2">
                          <button 
                            onClick={() => setSelectedDays(prev => prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id])}
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-300 ${
                              isSelected 
                                ? 'bg-primary text-antigravity-black shadow-neon-cyan scale-110' 
                                : 'bg-white/5 text-white/30 border border-white/5 hover:bg-white/10 hover:text-white/60'
                            }`}
                          >
                            {day.id.split('-')[0]}
                          </button>
                          <span className={`text-[8px] font-black uppercase tracking-[0.15em] transition-colors duration-300 ${isSelected ? 'text-primary' : 'text-white/20'}`}>
                            {day.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <span className="material-icons-outlined text-primary text-sm">badge</span>
                      <h4 className="text-[10px] uppercase font-black text-white/50 tracking-[0.2em]">Información del Grupo</h4>
                    </div>
                    <div className="space-y-4">
                      <input className="w-full crafted-input"
                        placeholder="Nombre del Grupo (Ej. Avanzados)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                      
                      <input className="w-full crafted-input"
                        placeholder="Nombre y Apellido del Profesor" value={newCoachName} onChange={(e) => setNewCoachName(e.target.value)} />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <span className="material-icons-outlined text-primary text-sm">schedule</span>
                      <h4 className="text-[10px] uppercase font-black text-white/50 tracking-[0.2em]">Franja Horaria</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] uppercase font-bold text-slate-400 ml-1 tracking-widest">Hora Inicio</label>
                        <div className="relative">
                          <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-antigravity-charcoal rounded-2xl px-4 py-3.5 text-sm text-white appearance-none border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all">
                            {timeIntervals.map(t => <option key={t} value={t} className="bg-antigravity-charcoal">{t}</option>)}
                          </select>
                          <span className="material-icons-outlined absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none text-sm">expand_more</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] uppercase font-bold text-slate-400 ml-1 tracking-widest">Hora Fin</label>
                        <div className="relative">
                          <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-antigravity-charcoal rounded-2xl px-4 py-3.5 text-sm text-white appearance-none border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all">
                            {timeIntervals.map(t => <option key={t} value={t} className="bg-antigravity-charcoal">{t}</option>)}
                          </select>
                          <span className="material-icons-outlined absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none text-sm">expand_more</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={handleSaveGroup} className="w-full py-4.5 rounded-2xl border border-primary text-primary font-black bg-primary/5 shadow-neon-cyan active:scale-[0.98] transition-all uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2">
                  <span className="material-icons-outlined text-sm">{editingGroup ? 'save' : 'add_circle'}</span>
                  <span>{editingGroup ? 'Actualizar Configuración' : 'Crear Nuevo Grupo'}</span>
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex justify-between px-1"><h3 className="text-white font-bold text-lg">Mis Grupos</h3></div>
              {grupos.length > 0 ? grupos.map((g, idx) => (
                <div key={idx} className="glass-card rounded-[1.5rem] p-6 space-y-5 border border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-lg tracking-tight leading-none">{g.nombre}</h4>
                      <p className="text-xs text-slate-200 mt-2 font-medium italic">{g.horario}</p>
                      {g.entrenador && <p className="text-[10px] text-primary mt-1 font-bold uppercase tracking-wider">Prof: {g.entrenador}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1.5 rounded-lg border border-primary/20 tracking-wider shadow-neon-cyan uppercase">Active</div>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
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
                          className="text-primary bg-primary/10 p-2 rounded-lg border border-primary/20 hover:bg-primary/20 transition-all flex items-center justify-center"
                          title="Editar grupo"
                        >
                          <span className="material-icons-outlined text-[16px]">edit</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }}
                          className="text-rose-500 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center justify-center"
                          title="Eliminar grupo"
                        >
                          <span className="material-icons-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setActiveGroup(g); setVista('AsistenciaLista'); }} className="w-full py-3.5 rounded-2xl border border-primary text-primary font-bold text-[11px] uppercase tracking-widest shadow-neon-cyan flex items-center justify-center gap-2.5 bg-primary/5 active:scale-95 transition-all">
                    <span className="material-icons-outlined text-[18px]">fact_check</span> Listas de Asistencia
                  </button>
                </div>
              )) : (
                <div className="p-10 text-center glass-card rounded-[2rem] border-dashed border-slate-700/50 italic text-slate-500 text-xs font-medium">No hay grupos configurados aún.</div>
              )}
            </section>
          </div>
        )}

        {/* VISTA: ASISTENCIA LISTA (EXACT MATCH) */}
        {vista === 'AsistenciaLista' && activeGroup && (
          <div className="page-transition flex flex-col min-h-screen relative bg-antigravity-black">
            <header className="px-6 py-4 flex flex-col gap-4 bg-antigravity-black sticky top-12 z-40">
              <div className="flex items-center justify-between">
                <button onClick={() => setVista('Dashboard')} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 border border-white/20 bg-white/20 border-primary/50 placeholder:text-white/50 text-white">
                  <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
                </button>
                <h1 className="text-sm font-bold tracking-widest uppercase text-white/80">Asistencia</h1>
                <button 
                  onClick={() => {
                    loadMonthlyReport(activeGroup.nombre, reportMonth, reportYear);
                    setVista('ReportePDF');
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary"
                  title="Reporte Mensual"
                >
                  <span className="material-icons-outlined text-[20px]">assessment</span>
                </button>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-3xl font-bold text-white tracking-tight leading-none">{activeGroup.nombre}</h2>
                    <button 
                      onClick={() => {
                        setEditingGroup(activeGroup);
                        setNewGroupName(activeGroup.nombre);
                        setNewCoachName(activeGroup.entrenador || "");
                        setSelectedDays(activeGroup.dias || []);
                        const times = activeGroup.horario.split(' - ');
                        if (times.length === 2) {
                          setStartTime(times[0]);
                          setEndTime(times[1]);
                        }
                        setVista('Horario');
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-primary transition-all"
                      title="Editar Grupo"
                    >
                      <span className="material-icons-outlined text-[16px]">edit</span>
                    </button>
                  </div>
                  <p className="text-neon-cyan font-medium flex items-center gap-2 mt-2 opacity-90 text-sm">
                    <span className="material-symbols-outlined text-[18px]">schedule</span> {activeGroup.horario}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-[0.2em]">Presentes</span>
                  <div className="text-2xl font-bold text-neon-cyan neon-glow-cyan">
                    {presentCount}<span className="text-white/20 mx-1">/</span>{filteredAlumnos.length}
                  </div>
                </div>
              </div>
            </header>

            <div className="px-6 py-2 flex gap-3 overflow-x-auto scrollbar-hide">
              <button 
                onClick={() => handleNavigation('RegistroAlumno')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest whitespace-nowrap active:scale-95 transition-all"
              >
                <span className="material-icons-outlined text-sm">person_add</span>
                Agregar Gimnasta
              </button>
              <button 
                onClick={handleAIAnalysis}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-purple/10 border border-accent-purple/20 text-accent-purple text-[10px] font-black uppercase tracking-widest whitespace-nowrap active:scale-95 transition-all"
              >
                <span className="material-icons-outlined text-sm">psychology</span>
                Asistente IA
              </button>
              <button 
                onClick={() => {
                  const element = document.getElementById('recent-classes-section');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest whitespace-nowrap active:scale-95 transition-all"
              >
                <span className="material-icons-outlined text-sm">history</span>
                Clases Recientes
              </button>
            </div>

            <div className="px-6 pt-2 pb-4">
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-xl group-focus-within:text-neon-cyan transition-colors">search</span>
                <input 
                  className="w-full crafted-input pl-12 !py-3.5 !border-neon-cyan/50 !ring-neon-cyan/50" 
                  placeholder="Buscar alumno..." 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <main className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
              {filteredAlumnos.length > 0 ? filteredAlumnos.map(alumno => {
                const hasAlerts = alumno.alertas && alumno.alertas.length > 0 && alumno.alertas[0] !== '';
                const isExpanded = expandedAlumnoId === alumno.id;

                return (
                  <div key={alumno.id} className={`flex flex-col p-4 rounded-2xl glass-card transition-all duration-300 ${!asistenciasHoy[alumno.id!] ? 'opacity-70 border-red-500/30 bg-red-900/10' : 'border-neon-cyan/20'}`}>
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-4 cursor-pointer flex-1"
                        onClick={() => setExpandedAlumnoId(isExpanded ? null : alumno.id!)}
                      >
                        <div className="relative">
                          <div className="w-12 h-12 rounded-xl bg-antigravity-charcoal flex items-center justify-center overflow-hidden border border-white/10">
                            <img 
                              alt="Avatar" 
                              className={`w-full h-full object-cover ${!asistenciasHoy[alumno.id!] ? 'grayscale' : 'grayscale-[0.3]'}`} 
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(alumno.nombre)}&background=121214&color=fff&size=128`}
                            />
                          </div>
                          {asistenciasHoy[alumno.id!] && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-neon-cyan rounded-full border-2 border-antigravity-black"></div>}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-semibold ${asistenciasHoy[alumno.id!] ? 'text-white' : 'text-white/70'} leading-none`}>{alumno.nombre}</h4>
                            {hasAlerts && (
                              <span className="material-icons-outlined text-amber-500 text-[16px] animate-pulse" title="Alerta Médica">warning</span>
                            )}
                          </div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${asistenciasHoy[alumno.id!] ? 'text-white/70' : 'text-white/60'}`}>{alumno.nivel}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setExpandedAlumnoId(isExpanded ? null : alumno.id!)}
                          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                        >
                          <span className="material-icons-outlined text-[18px]">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                        </button>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only ios-toggle peer border border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none" 
                            checked={asistenciasHoy[alumno.id!] || false}
                            onChange={() => toggleAttendance(alumno.id!)}
                          />
                          <div className="w-11 h-6 bg-white/10 peer-outline-none rounded-full ios-toggle-label after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/60 after:rounded-full after:h-5 after:w-5 after:transition-all shadow-sm"></div>
                        </label>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        {/* Health Alerts */}
                        {hasAlerts && (
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                            <h5 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                              <span className="material-icons-outlined text-[14px]">medical_services</span>
                              Observaciones de Salud
                            </h5>
                            <ul className="space-y-1">
                              {alumno.alertas.map((alerta, idx) => (
                                <li key={idx} className="text-xs text-amber-200/80 flex items-start gap-2">
                                  <span className="text-amber-500 mt-0.5">•</span>
                                  {alerta}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Emergency Contacts */}
                        {alumno.contacto && (
                          <div className="bg-white/5 rounded-xl p-3 space-y-3">
                            <h5 className="text-[10px] font-bold text-white/70 uppercase tracking-widest flex items-center gap-1">
                              <span className="material-icons-outlined text-[14px]">contact_phone</span>
                              Contactos de Emergencia
                            </h5>
                            
                            <div className="grid grid-cols-1 gap-2">
                              {alumno.contacto.emergenciaNombre && alumno.contacto.emergenciaTelefono && (
                                <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                                  <div>
                                    <p className="text-[10px] text-white/70 uppercase">Emergencia</p>
                                    <p className="text-xs text-white font-medium">{alumno.contacto.emergenciaNombre}</p>
                                  </div>
                                  <a href={`tel:${alumno.contacto.emergenciaTelefono}`} className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center">
                                    <span className="material-icons-outlined text-[16px]">call</span>
                                  </a>
                                </div>
                              )}
                              
                              {alumno.contacto.padreNombre && alumno.contacto.padreTelefono && (
                                <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                                  <div>
                                    <p className="text-[10px] text-white/70 uppercase">Padre</p>
                                    <p className="text-xs text-white font-medium">{alumno.contacto.padreNombre}</p>
                                  </div>
                                  <a href={`tel:${alumno.contacto.padreTelefono}`} className="w-8 h-8 rounded-full bg-neon-cyan/20 text-neon-cyan flex items-center justify-center">
                                    <span className="material-icons-outlined text-[16px]">call</span>
                                  </a>
                                </div>
                              )}

                              {alumno.contacto.madreNombre && alumno.contacto.madreTelefono && (
                                <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                                  <div>
                                    <p className="text-[10px] text-white/70 uppercase">Madre</p>
                                    <p className="text-xs text-white font-medium">{alumno.contacto.madreNombre}</p>
                                  </div>
                                  <a href={`tel:${alumno.contacto.madreTelefono}`} className="w-8 h-8 rounded-full bg-neon-cyan/20 text-neon-cyan flex items-center justify-center">
                                    <span className="material-icons-outlined text-[16px]">call</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {(!alumno.contacto || (!alumno.contacto.emergenciaTelefono && !alumno.contacto.padreTelefono && !alumno.contacto.madreTelefono)) && (
                          <p className="text-[10px] text-white/60 italic text-center">No hay contactos registrados</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="py-24 text-center flex flex-col items-center space-y-6 opacity-30">
                  <span className="material-symbols-outlined text-[80px] font-light">person_off</span>
                  <p className="text-sm font-medium italic tracking-wide">Inicia agregando tu primer alumno<br/>usando el botón azul inferior.</p>
                </div>
              )}

              {/* Recent Classes Section for this group */}
              <section id="recent-classes-section" className="pt-8 pb-12 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-sm uppercase tracking-widest opacity-50">Clases Recientes</h3>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{activeGroup.nombre}</span>
                </div>
                <div className="space-y-3">
                  {clases
                    .filter(c => c.grupo === activeGroup.nombre)
                    .slice(0, 3)
                    .map((clase) => (
                      <div 
                        key={clase.id} 
                        onClick={() => { setSelectedClase(clase); handleNavigation('ClaseDetalle'); }}
                        className="glass-card rounded-2xl p-4 border border-white/5 flex items-center justify-between active:scale-95 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                            <span className="material-icons-outlined text-primary text-xl">history_edu</span>
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">{new Date(clase.fecha).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</h4>
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{clase.entrenador}</p>
                          </div>
                        </div>
                        <span className="material-icons-outlined text-slate-600 text-sm">chevron_right</span>
                      </div>
                    ))}
                  {clases.filter(c => c.grupo === activeGroup.nombre).length === 0 && (
                    <div className="py-8 text-center border border-dashed border-white/5 rounded-2xl opacity-20 italic text-xs">
                      No hay clases registradas para este grupo.
                    </div>
                  )}
                </div>
              </section>
            </main>

            {/* FAB button matches user snippet */}
            <button 
              onClick={() => handleNavigation('RegistroAlumno')}
              className="absolute bottom-28 right-6 w-16 h-16 bg-neon-blue text-white rounded-2xl flex items-center justify-center neon-fab-blue active:scale-95 transition-all z-30"
            >
              <span className="material-symbols-outlined text-[32px] font-light">person_add</span>
            </button>
          </div>
        )}

      {/* VISTA: ALUMNOS */}
      {vista === 'Alumnos' && (
        <div className="px-6 py-8 space-y-8 page-transition pb-24">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                {alumnosFilterMode === 'alerts' ? 'Obs. de Salud' : 'Gimnastas'}
              </h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">
                {alumnosFilterMode === 'alerts' ? 'Gimnastas con Alertas Médicas' : `Base de Datos ${userRole === 'Coordinator' ? 'Global' : 'del Grupo'}`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Total</p>
                <p className="text-2xl font-black text-white">
                  {alumnos
                    .filter(a => alumnosFilterMode === 'alerts' ? (a.alertas && a.alertas.length > 0 && a.alertas[0] !== '') : true)
                    .filter(a => a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || a.dni.includes(searchQuery))
                    .length}
                </p>
              </div>
              {alumnosFilterMode === 'all' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsBulkImporting(true)}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 border border-white/10 active:scale-90 transition-all"
                    title="Importación Masiva"
                  >
                    <span className="material-icons-outlined text-sm">upload_file</span>
                  </button>
                  <button 
                    onClick={() => setIsAddingAlumno(!isAddingAlumno)}
                    className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 active:scale-90 transition-all"
                  >
                    <span className="material-icons-outlined text-sm">{isAddingAlumno ? 'close' : 'person_add'}</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="space-y-4">
            <div className="relative">
              <span className="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/50">search</span>
              <input 
                className="w-full crafted-input pl-12"
                placeholder="Buscar por nombre o DNI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

            {isAddingAlumno && (
              <div className="glass-card rounded-2xl p-5 border border-primary/30 space-y-4 shadow-neon-cyan">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Nuevo Gimnasta</h3>
                <input 
                  type="text" 
                  placeholder="Nombre completo" 
                  className="w-full bg-antigravity-charcoal border rounded-xl px-4 py-3 text-sm text-white border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                  value={newAlumnoForm.nombre}
                  onChange={e => setNewAlumnoForm({...newAlumnoForm, nombre: e.target.value})}
                />
                <input 
                  type="text" 
                  placeholder="DNI (Opcional)" 
                  className="w-full bg-antigravity-charcoal border rounded-xl px-4 py-3 text-sm text-white border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                  value={newAlumnoForm.dni}
                  onChange={e => setNewAlumnoForm({...newAlumnoForm, dni: e.target.value})}
                />
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-black text-white/50 ml-2 tracking-[0.2em]">Grupo</label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {grupos.filter(g => userRole === 'Coordinator' || !user?.displayName || g.entrenador === user.displayName).map(g => (
                      <button 
                        key={g.id}
                        onClick={() => setNewAlumnoForm({...newAlumnoForm, grupo: g.nombre})}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                          newAlumnoForm.grupo === g.nombre 
                            ? 'bg-primary text-antigravity-black border-primary shadow-neon-cyan' 
                            : 'bg-white/5 text-white/70 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {g.nombre}
                      </button>
                    ))}
                    <button 
                      onClick={() => setVista('Horario')}
                      className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap bg-white/5 text-white/30 border border-dashed border-white/10"
                    >
                      + Nuevo
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <EditableDropdown 
                    label="Nivel"
                    placeholder="Nivel..."
                    value={newAlumnoForm.nivel}
                    onChange={val => setNewAlumnoForm({...newAlumnoForm, nivel: val})}
                    options={niveles}
                    onAdd={handleSaveLevel}
                    onEdit={handleUpdateLevel}
                    onDelete={handleDeleteLevel}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setIsAddingAlumno(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-white font-bold text-xs uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleAddAlumno}
                    disabled={!newAlumnoForm.nombre.trim()}
                    className="flex-1 py-3 rounded-xl bg-primary text-antigravity-black font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {alumnos
                .filter(a => alumnosFilterMode === 'alerts' ? (a.alertas && a.alertas.length > 0 && a.alertas[0] !== '') : true)
                .filter(a => a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || a.dni.includes(searchQuery))
                .map(alumno => {
                  const hasAlerts = alumno.alertas && alumno.alertas.length > 0 && alumno.alertas[0] !== '';
                  return (
                    <div 
                      key={alumno.id} 
                      onClick={async () => { 
                        setSelectedAlumno(alumno); 
                        handleNavigation('AlumnoDetalle'); 
                        if (alumno.id) {
                          setIsLoadingAsistencias(true);
                          const history = (await getAttendanceByStudent(alumno.id)) as AsistenciaRecord[];
                          setAlumnoAsistencias(history.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
                          setIsLoadingAsistencias(false);
                        }
                      }}
                      className={`glass-card rounded-2xl p-4 border flex items-center justify-between cursor-pointer active:scale-95 transition-all ${hasAlerts && alumnosFilterMode === 'alerts' ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden relative">
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(alumno.nombre)}&background=random`} alt="" className="w-full h-full object-cover opacity-80" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{alumno.nombre}</h4>
                            {hasAlerts && (
                              <span className="material-icons-outlined text-amber-500 text-[16px] animate-pulse" title="Alerta Médica">warning</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">{alumno.grupo} • {alumno.nivel}</p>
                        </div>
                      </div>
                      <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/70">
                        <span className="material-icons-outlined text-sm">chevron_right</span>
                      </button>
                    </div>
                  );
                })}
              {alumnos.filter(a => alumnosFilterMode === 'alerts' ? (a.alertas && a.alertas.length > 0 && a.alertas[0] !== '') : true).length === 0 && (
                <div className="py-20 text-center opacity-20 italic text-sm">
                  {alumnosFilterMode === 'alerts' ? 'No hay gimnastas con alertas médicas.' : 'No hay gimnastas registrados.'}
                </div>
              )}
            </div>
          </div>
        )}

        {vista === 'AlumnoDetalle' && selectedAlumno && (
          <div className="px-6 py-8 space-y-8 page-transition">
            <header className="flex items-center gap-4">
              <button onClick={() => setVista('Alumnos')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
                <span className="material-icons-outlined">arrow_back</span>
              </button>
              <div className="flex-1">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{selectedAlumno.nombre}</h2>
                <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">{selectedAlumno.grupo} • {selectedAlumno.nivel}</p>
              </div>
              <button 
                onClick={() => {
                  setEditingAlumnoData(selectedAlumno);
                  setIsEditingAlumno(!isEditingAlumno);
                }}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 border border-white/10 active:scale-90 transition-all"
              >
                <span className="material-icons-outlined text-sm">{isEditingAlumno ? 'close' : 'edit'}</span>
              </button>
            </header>

            {isEditingAlumno && (
              <div className="glass-card rounded-2xl p-5 border border-primary/30 space-y-4 shadow-neon-cyan">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Editar Gimnasta</h3>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest ml-1">Información Básica</label>
                    <input 
                      type="text" 
                      placeholder="Nombre completo" 
                      className="w-full crafted-input"
                      value={editingAlumnoData.nombre || ''}
                      onChange={e => setEditingAlumnoData({...editingAlumnoData, nombre: e.target.value})}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">DNI (Opcional)</label>
                        <input 
                          type="text" 
                          placeholder="Número..." 
                          className="w-full crafted-input"
                          value={editingAlumnoData.dni || ''}
                          onChange={e => setEditingAlumnoData({...editingAlumnoData, dni: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Fecha Nacimiento</label>
                        <input 
                          type="date" 
                          className="w-full crafted-input"
                          value={editingAlumnoData.fechaNacimiento || ''}
                          onChange={e => setEditingAlumnoData({...editingAlumnoData, fechaNacimiento: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] uppercase font-black text-white/50 ml-2 tracking-[0.2em]">Grupo</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {grupos.filter(g => userRole === 'Coordinator' || !user?.displayName || g.entrenador === user.displayName).map(g => (
                        <button 
                          key={g.id}
                          onClick={() => setEditingAlumnoData({...editingAlumnoData, grupo: g.nombre})}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                            editingAlumnoData.grupo === g.nombre 
                              ? 'bg-primary text-antigravity-black border-primary shadow-neon-cyan' 
                              : 'bg-white/5 text-white/70 border-white/10 hover:border-white/20'
                          }`}
                        >
                          {g.nombre}
                        </button>
                      ))}
                      <button 
                        onClick={() => setVista('Horario')}
                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap bg-white/5 text-white/30 border border-dashed border-white/10"
                      >
                        + Nuevo
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <EditableDropdown 
                      label="Nivel"
                      placeholder="Nivel..."
                      value={editingAlumnoData.nivel || ''}
                      onChange={val => setEditingAlumnoData({...editingAlumnoData, nivel: val})}
                      options={niveles}
                      onAdd={handleSaveLevel}
                      onEdit={handleUpdateLevel}
                      onDelete={handleDeleteLevel}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest ml-1">Observaciones de Salud</label>
                    <textarea 
                      className="w-full crafted-input h-20"
                      placeholder="Alergias, lesiones, condiciones médicas..."
                      value={editingAlumnoData.alertas?.[0] || ''}
                      onChange={e => setEditingAlumnoData({...editingAlumnoData, alertas: [e.target.value]})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest ml-1">Contactos de Familia</label>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          type="text" 
                          placeholder="Nombre Padre" 
                          className="w-full crafted-input"
                          value={editingAlumnoData.contacto?.padreNombre || ''}
                          onChange={e => setEditingAlumnoData({...editingAlumnoData, contacto: {...(editingAlumnoData.contacto || {}), padreNombre: e.target.value}})}
                        />
                        <input 
                          type="tel" 
                          placeholder="Tel Padre" 
                          className="w-full crafted-input"
                          value={editingAlumnoData.contacto?.padreTelefono || ''}
                          onChange={e => setEditingAlumnoData({...editingAlumnoData, contacto: {...(editingAlumnoData.contacto || {}), padreTelefono: e.target.value}})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          type="text" 
                          placeholder="Nombre Madre" 
                          className="w-full crafted-input"
                          value={editingAlumnoData.contacto?.madreNombre || ''}
                          onChange={e => setEditingAlumnoData({...editingAlumnoData, contacto: {...(editingAlumnoData.contacto || {}), madreNombre: e.target.value}})}
                        />
                        <input 
                          type="tel" 
                          placeholder="Tel Madre" 
                          className="w-full crafted-input"
                          value={editingAlumnoData.contacto?.madreTelefono || ''}
                          onChange={e => setEditingAlumnoData({...editingAlumnoData, contacto: {...(editingAlumnoData.contacto || {}), madreTelefono: e.target.value}})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          type="text" 
                          placeholder="Emergencia Nombre" 
                          className="w-full crafted-input"
                          value={editingAlumnoData.contacto?.emergenciaNombre || ''}
                          onChange={e => setEditingAlumnoData({...editingAlumnoData, contacto: {...(editingAlumnoData.contacto || {}), emergenciaNombre: e.target.value}})}
                        />
                        <input 
                          type="tel" 
                          placeholder="Emergencia Tel" 
                          className="w-full crafted-input"
                          value={editingAlumnoData.contacto?.emergenciaTelefono || ''}
                          onChange={e => setEditingAlumnoData({...editingAlumnoData, contacto: {...(editingAlumnoData.contacto || {}), emergenciaTelefono: e.target.value}})}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={handleDeleteAlumno}
                    className="py-3 px-4 rounded-xl border border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-wider bg-red-500/10"
                  >
                    <span className="material-icons-outlined text-sm">delete</span>
                  </button>
                  <button 
                    onClick={handleUpdateAlumno}
                    disabled={!editingAlumnoData.nombre?.trim()}
                    className="flex-1 py-3 rounded-xl bg-primary text-antigravity-black font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            )}

            {/* Progress Summary */}
            <section className="space-y-4">
              <h3 className="text-white font-bold text-lg px-1">Resumen de Progreso</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Habilidades</p>
                  <p className="text-2xl font-black text-white">{selectedAlumno.habilidades?.length || 0}</p>
                  <p className="text-[9px] text-primary font-bold uppercase mt-1">Registradas</p>
                </div>
                <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Dominadas</p>
                  <p className="text-2xl font-black text-emerald-400">{selectedAlumno.habilidades?.filter(s => s.status === 'Dominado' || s.status === 'Elite').length || 0}</p>
                  <p className="text-[9px] text-emerald-500/60 font-bold uppercase mt-1">Logros</p>
                </div>
              </div>
              
              {/* Apparatus Progress */}
              <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Progreso por Aparato</p>
                <div className="space-y-3">
                  {Object.keys(SKILL_TREE).map(apparatus => {
                    const skills = selectedAlumno.habilidades?.filter(s => s.apparatus === apparatus) || [];
                    if (skills.length === 0) return null;
                    const mastered = skills.filter(s => s.status === 'Dominado' || s.status === 'Elite').length;
                    const percent = Math.round((mastered / skills.length) * 100);
                    
                    return (
                      <div key={apparatus} className="space-y-1.5">
                        <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider">
                          <span className="text-white/70">{apparatus}</span>
                          <span className="text-primary">{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary shadow-neon-cyan transition-all duration-1000" 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Attendance History */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-white font-bold text-lg">Historial de Asistencia</h3>
                <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  {alumnoAsistencias.filter(a => a.presente).length} Presentes
                </div>
              </div>
              
              <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
                {isLoadingAsistencias ? (
                  <div className="p-8 text-center">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : alumnoAsistencias.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {alumnoAsistencias.slice(0, 5).map((record, idx) => (
                      <div key={record.id || idx} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${record.presente ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}></div>
                          <div>
                            <p className="text-xs font-bold text-white">{new Date(record.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                            <p className="text-[9px] text-white/60 uppercase font-bold tracking-widest">{record.grupo}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${record.presente ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                          {record.presente ? 'Presente' : 'Ausente'}
                        </span>
                      </div>
                    ))}
                    {alumnoAsistencias.length > 5 && (
                      <button className="w-full py-3 text-[10px] font-bold text-primary uppercase tracking-widest hover:bg-white/5 transition-colors">
                        Ver historial completo
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center opacity-30 italic text-sm">No hay registros de asistencia.</div>
                )}
              </div>
            </section>

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

              {isAddingSkill && (
                <div className="glass-card rounded-2xl p-5 border border-primary/30 space-y-4 shadow-neon-cyan">
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
                        const selectedSkill = SKILL_TREE[newSkill.apparatus as Apparatus]?.find(s => s.name === e.target.value);
                        setNewSkill({
                          ...newSkill, 
                          name: e.target.value,
                          level: selectedSkill?.difficulty || '1'
                        });
                      }}
                    >
                      <option value="">Seleccionar habilidad...</option>
                      {SKILL_TREE[newSkill.apparatus as Apparatus]?.map(s => (
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
                  <button 
                    onClick={handleAddSkill}
                    disabled={!newSkill.name || newSkill.name === 'custom'}
                    className="w-full py-3 rounded-xl bg-primary text-antigravity-black font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all disabled:opacity-50 shadow-neon-cyan"
                  >
                    Guardar Habilidad
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {selectedAlumno.habilidades && selectedAlumno.habilidades.length > 0 ? (
                  selectedAlumno.habilidades.map(skill => (
                    <div key={skill.id} className="glass-card rounded-2xl p-4 border border-white/5">
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
                              <h4 className="text-sm font-bold text-white">{skill.name}</h4>
                              <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wider mt-1">{skill.apparatus} • Nivel {skill.level}</p>
                            </div>
                            <div className="flex items-center gap-3">
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
                                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/70 active:scale-90 transition-all"
                              >
                                <span className="material-icons-outlined text-sm">edit</span>
                              </button>
                            </div>
                          </div>
                          
                          {skill.history && skill.history.length > 0 && (
                            <div className="mt-1 pt-3 border-t border-white/5">
                              <p className="text-[9px] text-slate-300 uppercase tracking-widest mb-2 font-bold">
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
                                    <span className="text-slate-200 min-w-[70px]">{new Date(h.date).toLocaleDateString()}</span>
                                    <span className="text-white/80 font-medium">{h.status}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center opacity-20 italic text-sm">No hay habilidades registradas.</div>
                )}
              </div>
            </section>
          </div>
        )}

        {vista === 'Planes' && (
          <div className="px-6 py-8 space-y-8 page-transition pb-24">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Planes de Trabajo</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Historial Técnico de Clases</p>
            </header>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Fecha</label>
                  <input 
                    type="date" 
                    value={planesFilterDate} 
                    onChange={(e) => setPlanesFilterDate(e.target.value)} 
                    className="w-full bg-antigravity-charcoal border rounded-2xl px-4 py-3 text-sm text-white border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Profesor</label>
                  <select 
                    value={planesFilterCoach} 
                    onChange={(e) => setPlanesFilterCoach(e.target.value)} 
                    className="w-full bg-antigravity-charcoal border rounded-2xl px-4 py-3 text-sm text-white appearance-none border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none"
                  >
                    <option value="">Todos</option>
                    {Array.from(new Set(clases.map(c => c.entrenador))).filter(Boolean).map(prof => (
                      <option key={prof} value={prof}>{prof}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end">
                {(planesFilterDate || planesFilterCoach) && (
                  <button 
                    onClick={() => { setPlanesFilterDate(""); setPlanesFilterCoach(""); }}
                    className="text-[10px] text-primary font-bold uppercase tracking-widest"
                  >
                    Limpiar Filtros
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {clases
                .filter(clase => {
                  if (planesFilterDate && !clase.fecha.startsWith(planesFilterDate)) return false;
                  if (planesFilterCoach && clase.entrenador !== planesFilterCoach) return false;
                  return true;
                })
                .map((clase) => (
                <div 
                  key={clase.id} 
                  onClick={() => { setSelectedClase(clase); setVista('ClaseDetalle'); }}
                  className="glass-card rounded-3xl p-6 border border-white/5 space-y-4 active:scale-95 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-bold text-white leading-none">{clase.grupo}</h4>
                      <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-2">{new Date(clase.fecha).toLocaleDateString()} • {clase.entrenador}</p>
                    </div>
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                      <span className="material-icons-outlined text-white/70 text-sm">description</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {clase.apparatusUsed?.slice(0, 2).map((ap, i) => (
                      <span key={i} className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">{ap}</span>
                    ))}
                    {clase.skillsCovered && clase.skillsCovered.length > 0 && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-accent-purple/10 text-accent-purple rounded-md border border-accent-purple/20">+{clase.skillsCovered.length} Habilidades</span>
                    )}
                  </div>
                </div>
              ))}
              {clases.filter(clase => {
                  if (planesFilterDate && !clase.fecha.startsWith(planesFilterDate)) return false;
                  if (planesFilterCoach && clase.entrenador !== planesFilterCoach) return false;
                  return true;
                }).length === 0 && (
                <div className="py-20 text-center opacity-20 italic text-sm">No hay planes registrados que coincidan con los filtros.</div>
              )}
            </div>
          </div>
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
              <p className="text-[10px] text-slate-400">En caso de emergencia médica grave, contacte inmediatamente a los servicios de salud locales.</p>
            </div>
          </div>
        )}

        {vista === 'Asistente' && (
          <CoachAI />
        )}

        {vista === 'KnowledgeBase' && (
          <div className="px-6 py-8 space-y-8 page-transition pb-32">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Knowledge Hub</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Manuales y Reglamentos</p>
            </header>

            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Fuentes</h3>
                <label className="cursor-pointer bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                  <span className="flex items-center gap-2">
                    <span className="material-icons-outlined text-sm">add</span>
                    Cargar PDF
                  </span>
                  <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {sources.length > 0 ? sources.map(source => (
                  <div key={source.id} className="min-w-[160px] glass-card rounded-2xl p-4 border border-white/10 flex flex-col gap-2">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                      <span className="material-icons-outlined text-primary">description</span>
                    </div>
                    <p className="text-xs font-bold text-white truncate">{source.name}</p>
                    <p className="text-[8px] text-white/40 uppercase tracking-widest">{new Date(source.uploadDate).toLocaleDateString()}</p>
                    <button 
                      onClick={() => setSources(prev => prev.filter(s => s.id !== source.id))}
                      className="text-[8px] text-rose-500 font-black uppercase tracking-widest mt-2 hover:text-rose-400"
                    >
                      Eliminar
                    </button>
                  </div>
                )) : (
                  <div className="w-full py-8 text-center border border-dashed border-white/5 rounded-2xl opacity-30 italic text-xs">
                    Carga los manuales USAG o de la Federación para empezar.
                  </div>
                )}
              </div>
            </section>

            <section className="flex-1 flex flex-col gap-4">
              <h3 className="text-white font-bold text-sm uppercase tracking-wider px-1">Consultar Manuales</h3>
              <div className="glass-card rounded-3xl border border-white/5 flex flex-col h-[400px] overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                  {kbMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30 px-8">
                      <span className="material-icons-outlined text-4xl text-primary">psychology</span>
                      <p className="text-xs italic">Pregunta sobre reglamentos, puntajes o metodologías de los manuales cargados.</p>
                    </div>
                  )}
                  {kbMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-primary text-antigravity-black font-bold rounded-tr-none' : 'bg-white/5 text-slate-300 border border-white/10 rounded-tl-none'}`}>
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  ))}
                  {isKbLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/10 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-white/5 bg-black/20 flex gap-2">
                  <input 
                    type="text" 
                    value={kbInput}
                    onChange={(e) => setKbInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleKbQuery()}
                    placeholder="¿Cuál es el valor del Flic-Flac en Viga?"
                    className="flex-1 bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-primary/50 transition-all"
                  />
                  <button 
                    onClick={handleKbQuery}
                    disabled={!kbInput.trim() || isKbLoading}
                    className="w-10 h-10 bg-primary text-antigravity-black rounded-xl flex items-center justify-center shadow-neon-cyan active:scale-95 transition-all disabled:opacity-50"
                  >
                    <span className="material-icons-outlined">send</span>
                  </button>
                </div>
              </div>
            </section>
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
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email || 'usuario@gymcoach.pro'}</p>
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
                  <span className="material-icons-outlined text-white/30 text-sm">chevron_right</span>
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
              <p className="text-[10px] text-slate-400">Desarrollado para la excelencia gimnástica.</p>
            </div>
          </div>
        )}
        {vista === 'RegistroAlumno' && activeGroup && (
          <div className="space-y-8 page-transition pb-12 px-6 pt-4">
            <header className="flex items-center gap-4">
              <button onClick={() => setVista('AsistenciaLista')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
                <span className="material-icons-outlined">arrow_back</span>
              </button>
              <div><h2 className="text-white font-bold text-xl tracking-tighter uppercase leading-none">Nueva Inscripción</h2><p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Grupo: {activeGroup.nombre}</p></div>
            </header>
            <div className="glass-card rounded-[2.5rem] p-7 space-y-8 border border-white/5">
              <div className="space-y-4">
                <h4 className="text-white font-black text-[10px] border-b border-white/5 pb-2 uppercase tracking-[0.3em] opacity-30 italic">Identificación</h4>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Nombre y Apellido *</label>
                    <input className="w-full crafted-input" placeholder="Nombre completo..." value={studentForm.nombre} onChange={(e) => setStudentForm({...studentForm, nombre: e.target.value})}/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">DNI (Opcional)</label>
                      <input className="w-full crafted-input" placeholder="Número..." value={studentForm.dni} onChange={(e) => setStudentForm({...studentForm, dni: e.target.value})}/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Fecha Nacimiento *</label>
                      <input type="date" className="w-full crafted-input" value={studentForm.fechaNacimiento} onChange={(e) => setStudentForm({...studentForm, fechaNacimiento: e.target.value})}/>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-white font-black text-[10px] border-b border-white/5 pb-2 uppercase tracking-[0.3em] opacity-30 italic">Contactos de Familia</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Nombre del Padre</label>
                      <input className="w-full crafted-input" placeholder="Nombre..." value={studentForm.contacto?.padreNombre} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), padreNombre: e.target.value}})}/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Teléfono Padre</label>
                      <input type="tel" className="w-full crafted-input" placeholder="Número..." value={studentForm.contacto?.padreTelefono} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), padreTelefono: e.target.value}})}/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Nombre de la Madre</label>
                      <input className="w-full crafted-input" placeholder="Nombre..." value={studentForm.contacto?.madreNombre} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), madreNombre: e.target.value}})}/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Teléfono Madre</label>
                      <input type="tel" className="w-full crafted-input" placeholder="Número..." value={studentForm.contacto?.madreTelefono} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), madreTelefono: e.target.value}})}/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Contacto Emergencia</label>
                      <input className="w-full crafted-input" placeholder="Nombre..." value={studentForm.contacto?.emergenciaNombre} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), emergenciaNombre: e.target.value}})}/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Teléfono Emergencia</label>
                      <input type="tel" className="w-full crafted-input" placeholder="Número..." value={studentForm.contacto?.emergenciaTelefono} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), emergenciaTelefono: e.target.value}})}/>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-white font-black text-[10px] border-b border-white/5 pb-2 uppercase tracking-[0.3em] opacity-30 italic">Seguimiento Médico</h4>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Observaciones de Salud (Opcional)</label>
                  <textarea className="w-full crafted-input h-24" placeholder="Alergias, condiciones médicas..." onChange={(e) => setStudentForm({...studentForm, alertas: [e.target.value]})}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-300 ml-1">Fecha de Inicio de Actividades</label>
                  <input type="date" className="w-full crafted-input" value={studentForm.fechaPrimeraClase} onChange={(e) => setStudentForm({...studentForm, fechaPrimeraClase: e.target.value})}/>
                </div>
              </div>
                  <button 
                    onClick={handleSaveStudent} 
                    disabled={isSavingStudent}
                    className="w-full py-5 rounded-3xl bg-accent-purple text-white font-black uppercase tracking-[0.3em] text-[10px] shadow-neon-purple active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSavingStudent ? 'Guardando...' : 'Finalizar Alta de Gimnasta'}
                  </button>
            </div>
          </div>
        )}

        {vista === 'ReportePDF' && activeGroup && (
          <div className="page-transition p-8 bg-white text-black min-h-screen">
            <div className="flex items-center justify-between mb-8 print:hidden">
              <button onClick={() => setVista('AsistenciaLista')} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all">
                <span className="material-icons-outlined">arrow_back</span>
              </button>
              
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl border-2 border-black">
                  <select 
                    value={reportMonth} 
                    onChange={(e) => {
                      const m = parseInt(e.target.value);
                      setReportMonth(m);
                      loadMonthlyReport(activeGroup.nombre, m, reportYear);
                    }}
                    className="bg-transparent px-3 py-1.5 font-black text-xs uppercase outline-none"
                  >
                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                  <select 
                    value={reportYear} 
                    onChange={(e) => {
                      const y = parseInt(e.target.value);
                      setReportYear(y);
                      loadMonthlyReport(activeGroup.nombre, reportMonth, y);
                    }}
                    className="bg-transparent px-3 py-1.5 font-black text-xs uppercase outline-none border-l-2 border-black"
                  >
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={() => window.print()}
                  className="bg-black text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                >
                  <span className="material-icons-outlined text-sm">print</span> Imprimir
                </button>
              </div>
            </div>

            <div className="border-[6px] border-black p-10 max-w-5xl mx-auto space-y-12">
              <header className="flex justify-between items-start border-b-4 border-black pb-8">
                <div className="space-y-2">
                  <h1 className="text-6xl font-black uppercase tracking-tighter leading-none">GymCoach Pro</h1>
                  <h2 className="text-2xl font-black text-slate-300 uppercase tracking-widest">Planilla Mensual</h2>
                </div>
                <div className="text-right space-y-1 font-black uppercase text-sm">
                  <p>Grupo: <span className="bg-black text-white px-2 py-0.5">{activeGroup.nombre}</span></p>
                  <p>Mes: <span className="bg-black text-white px-2 py-0.5">{['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][reportMonth]} {reportYear}</span></p>
                </div>
              </header>

              {isLoadingMonthly ? (
                <div className="py-20 text-center">
                  <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-4 font-black uppercase tracking-widest">Calculando Asistencias...</p>
                </div>
              ) : (
                <table className="w-full border-collapse border-4 border-black">
                  <thead>
                    <tr className="bg-slate-100 uppercase text-[12px] font-black border-b-4 border-black">
                      <th className="p-5 text-left border-r-4 border-black">Gimnasta</th>
                      <th className="p-5 text-center border-r-4 border-black">DNI</th>
                      <th className="p-5 text-center border-r-4 border-black">Asistencias</th>
                      <th className="p-5 text-center border-r-4 border-black">%</th>
                      <th className="p-5 text-right">Firma Tutor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnos.filter(a => a.grupo === activeGroup.nombre).map(a => {
                      const stats = monthlyStats[a.id!] || { attended: 0, expected: 0 };
                      const percentage = stats.expected > 0 ? Math.round((stats.attended / stats.expected) * 100) : 0;
                      return (
                        <tr key={a.id} className="border-b-4 border-black font-bold">
                          <td className="p-5 border-r-4 border-black uppercase">{a.nombre}</td>
                          <td className="p-5 text-center border-r-4 border-black font-mono">{a.dni || '---'}</td>
                          <td className="p-5 text-center border-r-4 border-black font-black">
                            {stats.attended} / {stats.expected}
                          </td>
                          <td className="p-5 text-center border-r-4 border-black font-black">
                            {percentage}%
                          </td>
                          <td className="p-5 text-right w-48"></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div className="grid grid-cols-2 gap-8 pt-12">
                <div className="border-t-4 border-black pt-4">
                  <p className="text-xs font-black uppercase tracking-widest">Firma del Profesor</p>
                  <p className="mt-2 font-bold">{activeGroup.entrenador || '____________________'}</p>
                </div>
                <div className="border-t-4 border-black pt-4 text-right">
                  <p className="text-xs font-black uppercase tracking-widest">Fecha de Emisión</p>
                  <p className="mt-2 font-bold">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <button onClick={() => window.print()} className="w-full py-6 mt-12 bg-black text-white font-black uppercase tracking-[0.4em] rounded-2xl print:hidden shadow-2xl">
                Imprimir Documento
              </button>
            </div>
          </div>
        )}

        {vista === 'ClaseDetalle' && selectedClase && (
          <div className="page-transition flex flex-col min-h-screen bg-antigravity-black pb-24">
            <header className="px-6 py-6 flex items-center gap-4 sticky top-12 bg-antigravity-black z-40">
              <button onClick={() => setVista('Planes')} className="w-10 h-10 flex items-center justify-center rounded-full bg-antigravity-charcoal border border-white/10 text-white">
                <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
              </button>
              <div>
                <h2 className="text-xl font-bold text-white leading-none">{selectedClase.grupo}</h2>
                <p className="text-xs text-primary mt-1 font-medium">{new Date(selectedClase.fecha).toLocaleDateString()} • {selectedClase.horario}</p>
              </div>
            </header>

            <main className="flex-1 px-6 space-y-8 pb-12">
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 italic">Asistencia de la Clase</h3>
                  <button 
                    onClick={async () => {
                      setIsLoadingAsistenciasClase(true);
                      const q = query(
                        collection(firestore, COLLECTIONS.ASISTENCIAS),
                        where('fecha', '==', selectedClase.fecha.split('T')[0]),
                        where('grupo', '==', selectedClase.grupo)
                      );
                      const snap = await getDocs(q);
                      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AsistenciaRecord));
                      setAsistenciasClase(records);
                      setIsLoadingAsistenciasClase(false);
                    }}
                    className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1"
                  >
                    <span className="material-icons-outlined text-sm">refresh</span> Actualizar
                  </button>
                </div>
                
                <div className="glass-card rounded-3xl p-6 border border-white/5">
                  {isLoadingAsistenciasClase ? (
                    <div className="py-8 text-center">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                  ) : asistenciasClase.length > 0 ? (
                    <div className="space-y-3">
                      {asistenciasClase.map(record => {
                        const alumno = alumnos.find(a => a.id === record.alumnoId);
                        return (
                          <div key={record.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(alumno?.nombre || 'Alumno')}&background=random`} alt="" className="w-full h-full object-cover opacity-60" />
                              </div>
                              <span className="text-sm text-white font-medium">{alumno?.nombre || 'Alumno Desconocido'}</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${record.presente ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                              {record.presente ? 'Presente' : 'Ausente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-xs text-white/60 italic">No hay registros de asistencia para esta clase.</p>
                      <button 
                        onClick={async () => {
                          setIsLoadingAsistenciasClase(true);
                          const q = query(
                            collection(firestore, COLLECTIONS.ASISTENCIAS),
                            where('fecha', '==', selectedClase.fecha.split('T')[0]),
                            where('grupo', '==', selectedClase.grupo)
                          );
                          const snap = await getDocs(q);
                          const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AsistenciaRecord));
                          setAsistenciasClase(records);
                          setIsLoadingAsistenciasClase(false);
                        }}
                        className="mt-4 px-4 py-2 rounded-xl bg-white/5 text-white text-[10px] font-bold uppercase tracking-widest border border-white/10"
                      >
                        Cargar Asistencia
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 italic">Contenido de la Clase</h3>
                <div className="glass-card rounded-3xl p-6 space-y-6">
                  {(selectedClase.faseInicial?.length || selectedClase.warmup?.length) ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Fase Inicial (Entrada en calor)</p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedClase.faseInicial || selectedClase.warmup || []).map((item, i) => (
                          <span key={i} className="bg-white/5 text-white/80 text-[10px] px-3 py-1.5 rounded-lg border border-white/10">{item}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  
                  {(selectedClase.fasePrincipal?.length || selectedClase.apparatusUsed?.length || selectedClase.skillsCovered?.length) ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Fase Principal</p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedClase.fasePrincipal || [...(selectedClase.apparatusUsed || []), ...(selectedClase.skillsCovered || [])]).map((item, i) => (
                          <span key={i} className="bg-primary/10 text-primary text-[10px] px-3 py-1.5 rounded-lg border border-primary/20">{item}</span>
                        ))}
                      </div>
                      
                      {selectedClase.habilidadesPorAparato && Object.keys(selectedClase.habilidadesPorAparato).length > 0 && (
                        <div className="mt-4 space-y-3">
                          {Object.entries(selectedClase.habilidadesPorAparato).map(([aparato, habilidades]) => (
                            habilidades.length > 0 && (
                              <div key={aparato} className="bg-white/5 p-3 rounded-xl border border-white/10">
                                <p className="text-[10px] font-bold text-white/80 mb-2">{aparato}</p>
                                <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
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
                  ) : null}

                  {selectedClase.faseFinal && selectedClase.faseFinal.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Fase Final</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedClase.faseFinal.map((item, i) => (
                          <span key={i} className="bg-accent-purple/10 text-accent-purple text-[10px] px-3 py-1.5 rounded-lg border border-accent-purple/20">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 italic">Feedback del Coordinador</h3>
                <div className="space-y-4">
                  {feedbacks.map((fb) => (
                    <div key={fb.id} className={`p-4 rounded-2xl border ${fb.author === 'Coordinador' ? 'bg-primary/5 border-primary/20 ml-4' : 'bg-white/5 border-white/10 mr-4'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${fb.author === 'Coordinador' ? 'text-primary' : 'text-white/70'}`}>{fb.author}</span>
                        <span className="text-[8px] text-white/50">{new Date(fb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed italic">"{fb.text}"</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6">
                  <input 
                    className="flex-1 crafted-input !py-3.5 !text-xs"
                    placeholder="Escribir feedback..."
                    value={newFeedback}
                    onChange={(e) => setNewFeedback(e.target.value)}
                  />
                  <button onClick={handleAddFeedback} className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-antigravity-black shadow-neon-cyan active:scale-95 transition-all">
                    <span className="material-icons-outlined">send</span>
                  </button>
                </div>
              </section>
            </main>
          </div>
        )}

        {vista === 'NuevaClase' && (
          <div className="space-y-8 page-transition pt-8 px-6 pb-24">
            <header className="flex items-center gap-4 mb-8">
              <button onClick={() => setVista('Dashboard')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
                <span className="material-icons-outlined">arrow_back</span>
              </button>
              <h2 className="text-white font-black text-2xl uppercase tracking-tighter">Reporte de Clase</h2>
            </header>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] uppercase font-black text-white/50 tracking-[0.2em]">Seleccionar Grupo</label>
                  <div className="relative">
                    <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">search</span>
                    <input 
                      type="text" 
                      placeholder="Filtrar..."
                      className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-8 pr-4 text-[10px] text-white outline-none focus:border-primary/50 transition-all w-32"
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {grupos
                    .filter(g => userRole === 'Coordinator' || !user?.displayName || g.entrenador === user.displayName)
                    .filter(g => g.nombre.toLowerCase().includes(groupSearch.toLowerCase()))
                    .map(g => (
                    <button 
                      key={g.id}
                      onClick={() => setClaseGrupo(g.nombre)}
                      className={`glass-card p-4 rounded-2xl border transition-all text-left flex flex-col gap-1 ${
                        claseGrupo === g.nombre 
                          ? 'border-primary bg-primary/10 shadow-neon-cyan scale-[1.02]' 
                          : 'border-white/5 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <span className={`text-xs font-black uppercase tracking-wider ${claseGrupo === g.nombre ? 'text-primary' : 'text-white/70'}`}>
                        {g.nombre}
                      </span>
                      <span className="text-[8px] text-white/30 font-bold uppercase tracking-widest">
                        {g.horario}
                      </span>
                    </button>
                  ))}
                  <button 
                    onClick={() => setVista('Horario')}
                    className="glass-card p-4 rounded-2xl border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-1 hover:bg-white/10 transition-all"
                  >
                    <span className="material-icons-outlined text-white/30 text-lg">add_circle</span>
                    <span className="text-[8px] text-white/30 font-black uppercase tracking-widest">Nuevo Grupo</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Fase Inicial (Entrada en calor)</label>
                  <div className="flex items-center gap-2 bg-antigravity-charcoal px-3 py-1 rounded-full border border-white/5">
                    <span className="material-icons-outlined text-[14px] text-white/70">schedule</span>
                    <input 
                      type="number" 
                      value={faseInicialDuration} 
                      onChange={(e) => setFaseInicialDuration(e.target.value)}
                      className="w-8 bg-transparent text-[10px] text-white font-bold outline-none text-center" 
                    />
                    <span className="text-[8px] text-white/50 uppercase font-black">min</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Movilidad articular', 'Trote', 'Juegos', 'Estiramiento dinámico'].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => setFaseInicial(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt])}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${faseInicial.includes(opt) ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-antigravity-charcoal text-slate-400 border border-white/5'}`}
                    >
                      {opt}
                    </button>
                  ))}
                  {faseInicial.filter(opt => !['Movilidad articular', 'Trote', 'Juegos', 'Estiramiento dinámico'].includes(opt)).map(opt => (
                    <button 
                      key={opt}
                      onClick={() => setFaseInicial(prev => prev.filter(o => o !== opt))}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-antigravity-black shadow-neon-cyan transition-all flex items-center gap-1"
                    >
                      {opt} <span className="material-icons-outlined text-[14px]">close</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input 
                    type="text" 
                    value={customInicial} 
                    onChange={(e) => setCustomInicial(e.target.value)} 
                    placeholder="Agregar otra opción..." 
                    className="flex-1 crafted-input !py-2"
                  />
                  <button 
                    onClick={() => { if(customInicial) { setFaseInicial(prev => [...prev, customInicial]); setCustomInicial(""); } }}
                    className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Fase Principal (Aparatos)</label>
                  <div className="flex items-center gap-2 bg-antigravity-charcoal px-3 py-1 rounded-full border border-white/5">
                    <span className="material-icons-outlined text-[14px] text-white/70">schedule</span>
                    <input 
                      type="number" 
                      value={fasePrincipalDuration} 
                      onChange={(e) => setFasePrincipalDuration(e.target.value)}
                      className="w-8 bg-transparent text-[10px] text-white font-bold outline-none text-center" 
                    />
                    <span className="text-[8px] text-white/50 uppercase font-black">min</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Viga de equilibrio', 'Paralelas asimétricas', 'Suelo', 'Salto', 'Anillas', 'Arzones', 'Barra Fija', 'Trampolín'].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => setFasePrincipal(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt])}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${fasePrincipal.includes(opt) ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-antigravity-charcoal text-slate-400 border border-white/5'}`}
                    >
                      {opt}
                    </button>
                  ))}
                  {fasePrincipal.filter(opt => !['Viga de equilibrio', 'Paralelas asimétricas', 'Suelo', 'Salto', 'Anillas', 'Arzones', 'Barra Fija', 'Trampolín'].includes(opt)).map(opt => (
                    <button 
                      key={opt}
                      onClick={() => setFasePrincipal(prev => prev.filter(o => o !== opt))}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-antigravity-black shadow-neon-cyan transition-all flex items-center gap-1"
                    >
                      {opt} <span className="material-icons-outlined text-[14px]">close</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input 
                    type="text" 
                    value={customPrincipal} 
                    onChange={(e) => setCustomPrincipal(e.target.value)} 
                    placeholder="Ej. Tela acrobática..." 
                    className="flex-1 crafted-input !py-2"
                  />
                  <button 
                    onClick={() => { if(customPrincipal) { setFasePrincipal(prev => [...prev, customPrincipal]); setCustomPrincipal(""); } }}
                    className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Agregar
                  </button>
                </div>

                {fasePrincipal.length > 0 && (
                  <div className="mt-6 space-y-4 border-t border-white/10 pt-4">
                    <label className="text-[10px] uppercase font-bold text-slate-200 ml-1 tracking-widest">Habilidades por Aparato</label>
                    {fasePrincipal.map(aparato => (
                      <div key={aparato} className="space-y-2 bg-antigravity-charcoal/50 p-4 rounded-2xl border border-white/5">
                        <p className="text-xs font-bold text-white">{aparato}</p>
                        <div className="flex flex-wrap gap-2">
                          {(habilidadesPorAparato[aparato] || []).map((hab, idx) => (
                            <span key={idx} className="bg-primary/10 text-primary text-[10px] px-3 py-1.5 rounded-lg border border-primary/20 flex items-center gap-1">
                              {hab}
                              <button onClick={() => setHabilidadesPorAparato(prev => ({...prev, [aparato]: prev[aparato].filter((_, i) => i !== idx)}))}>
                                <span className="material-icons-outlined text-[12px]">close</span>
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <input 
                            type="text" 
                            value={customHabilidad[aparato] || ""} 
                            onChange={(e) => setCustomHabilidad(prev => ({...prev, [aparato]: e.target.value}))} 
                            placeholder={`Ej. Rol adelante en ${aparato}...`} 
                            className="flex-1 crafted-input !py-2"
                          />
                          <button 
                            onClick={() => { 
                              const hab = customHabilidad[aparato];
                              if(hab) { 
                                setHabilidadesPorAparato(prev => ({...prev, [aparato]: [...(prev[aparato] || []), hab]})); 
                                setCustomHabilidad(prev => ({...prev, [aparato]: ""})); 
                              } 
                            }}
                            className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold"
                          >
                            Añadir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Fase Final</label>
                  <div className="flex items-center gap-2 bg-antigravity-charcoal px-3 py-1 rounded-full border border-white/5">
                    <span className="material-icons-outlined text-[14px] text-white/70">schedule</span>
                    <input 
                      type="number" 
                      value={faseFinalDuration} 
                      onChange={(e) => setFaseFinalDuration(e.target.value)}
                      className="w-8 bg-transparent text-[10px] text-white font-bold outline-none text-center" 
                    />
                    <span className="text-[8px] text-white/50 uppercase font-black">min</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Elongación', 'Relajación', 'Feedback'].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => setFaseFinal(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt])}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${faseFinal.includes(opt) ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-antigravity-charcoal text-slate-400 border border-white/5'}`}
                    >
                      {opt}
                    </button>
                  ))}
                  {faseFinal.filter(opt => !['Elongación', 'Relajación', 'Feedback'].includes(opt)).map(opt => (
                    <button 
                      key={opt}
                      onClick={() => setFaseFinal(prev => prev.filter(o => o !== opt))}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-antigravity-black shadow-neon-cyan transition-all flex items-center gap-1"
                    >
                      {opt} <span className="material-icons-outlined text-[14px]">close</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input 
                    type="text" 
                    value={customFinal} 
                    onChange={(e) => setCustomFinal(e.target.value)} 
                    placeholder="Agregar otra opción..." 
                    className="flex-1 crafted-input !py-2"
                  />
                  <button 
                    onClick={() => { if(customFinal) { setFaseFinal(prev => [...prev, customFinal]); setCustomFinal(""); } }}
                    className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              <button 
                onClick={handleSaveManualClass} 
                className="w-full py-5 rounded-3xl bg-primary text-antigravity-black font-black uppercase tracking-[0.3em] text-[10px] shadow-neon-cyan active:scale-95 transition-all"
              >
                Guardar Reporte
              </button>
            </div>
          </div>
        )}
        {vista === 'Profesores' && userRole === 'Coordinator' && (
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
              {Array.from(new Set([...grupos.map(g => g.entrenador), ...clases.map(c => c.entrenador), ...profesoresList.map(p => p.nombre)])).filter(Boolean).map((profesor, idx) => {
                const profClases = clases.filter(c => c.entrenador === profesor);
                const profGrupos = grupos.filter(g => g.entrenador === profesor);
                return (
                  <div 
                    key={idx} 
                    onClick={() => { setSelectedProfesor(profesor as string); handleNavigation('ProfesorDetalle'); }}
                    className="glass-card rounded-3xl p-6 border border-white/5 active:scale-95 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                        <span className="material-icons-outlined text-primary text-2xl">badge</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">{profesor}</h4>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{profGrupos.length} Grupos • {profClases.length} Clases</p>
                      </div>
                    </div>
                    <span className="material-icons-outlined text-slate-600">chevron_right</span>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={() => setIsAddingProfesor(true)}
              className="absolute bottom-28 right-6 w-16 h-16 bg-neon-blue text-white rounded-2xl flex items-center justify-center neon-fab-blue active:scale-95 transition-all z-30"
            >
              <span className="material-symbols-outlined text-[32px] font-light">person_add</span>
            </button>
          </div>
        )}

        {vista === 'ProfesorDetalle' && selectedProfesor && (
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
                        <p className="text-[10px] text-slate-200 mt-1">{g.horario}</p>
                      </div>
                    ));
                  } else if (profGruposHistoricos.length > 0) {
                    return profGruposHistoricos.map((nombre, idx) => (
                      <div key={idx} className="glass-card rounded-2xl p-4 border border-white/5 opacity-70">
                        <h4 className="font-bold text-white text-sm">{nombre}</h4>
                        <p className="text-[10px] text-slate-400 mt-1">Histórico</p>
                      </div>
                    ));
                  } else {
                    return <p className="text-sm text-slate-400 col-span-2 px-1">No tiene grupos registrados.</p>;
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
                        <p className="text-[10px] text-slate-400">{new Date(clase.fecha).toLocaleDateString()} • {clase.horario}</p>
                      </div>
                    </div>
                    
                    {clase.faseInicial && clase.faseInicial.length > 0 && (
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-primary font-bold mb-1">Entrada en calor</p>
                        <div className="flex flex-wrap gap-1">
                          {clase.faseInicial.map((item, i) => <span key={i} className="text-[10px] bg-white/5 text-slate-300 px-2 py-1 rounded-md">{item}</span>)}
                        </div>
                      </div>
                    )}
                    
                    {clase.fasePrincipal && clase.fasePrincipal.length > 0 && (
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-primary font-bold mb-1">Fase Principal</p>
                        <div className="flex flex-wrap gap-1">
                          {clase.fasePrincipal.map((item, i) => <span key={i} className="text-[10px] bg-white/5 text-slate-300 px-2 py-1 rounded-md">{item}</span>)}
                        </div>
                        
                        {clase.habilidadesPorAparato && Object.keys(clase.habilidadesPorAparato).length > 0 && (
                          <div className="mt-3 space-y-2">
                            {Object.entries(clase.habilidadesPorAparato).map(([aparato, habilidades]) => (
                              habilidades.length > 0 && (
                                <div key={aparato} className="bg-white/5 p-2 rounded-lg border border-white/10">
                                  <p className="text-[9px] font-bold text-white mb-1">{aparato}</p>
                                  <ul className="list-disc list-inside text-[10px] text-slate-300 space-y-0.5">
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
                          {clase.faseFinal.map((item, i) => <span key={i} className="text-[10px] bg-white/5 text-slate-300 px-2 py-1 rounded-md">{item}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Navegación Inferior (Refined for Antigravity) */}
      {vista !== 'ReportePDF' && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-antigravity-charcoal/80 backdrop-blur-md border-t border-white/5 px-6 pt-4 pb-2 flex justify-between items-center z-50">
          {[
            { v: 'Dashboard', i: 'grid_view', l: 'Inicio' },
            { v: 'Alumnos', i: 'group', l: 'Gimnastas' },
            { v: userRole === 'Coordinator' ? 'Profesores' : 'Horario', i: userRole === 'Coordinator' ? 'badge' : 'calendar_today', l: userRole === 'Coordinator' ? 'Staff' : 'Horario' },
            { v: 'Asistente', i: 'smart_toy', l: 'IA' },
            { v: 'KnowledgeBase', i: 'book', l: 'Hub' },
            { v: 'Ajustes', i: 'app_settings_alt', l: 'Ajustes' }
          ].map(item => (
            <button 
              key={item.v} 
              onClick={() => {
                if (item.v === 'Alumnos') setAlumnosFilterMode('all');
                handleNavigation(item.v as ViewMode);
              }} 
              className={`flex flex-col items-center gap-1.5 transition-all flex-1 ${vista === item.v || (vista === 'AsistenciaLista' && item.v === 'Horario') ? 'text-neon-cyan active-glow' : 'text-white/60 hover:text-white'}`}
            >
              <span className={`material-symbols-outlined text-[26px] font-light ${vista === item.v || (vista === 'AsistenciaLista' && item.v === 'Horario') ? 'neon-glow-cyan' : ''}`}>{item.i}</span>
              <span className={`text-[9px] uppercase tracking-wide ${vista === item.v || (vista === 'AsistenciaLista' && item.v === 'Horario') ? 'font-bold' : 'font-medium'}`}>
                {item.v === 'Horario' ? (activeGroup ? 'Horario' : 'Horario') : item.l}
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

        {vista === 'AsistenciaStats' && (
          <div className="px-6 py-8 space-y-8 page-transition pb-24">
            <header className="flex items-center gap-4">
              <button onClick={() => setVista('Dashboard')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
                <span className="material-icons-outlined">arrow_back</span>
              </button>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Estadísticas</h2>
                <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Análisis de Asistencia</p>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* AI Analysis Button */}
              <div className="md:col-span-2">
                <button 
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing}
                  className="w-full glass-card rounded-[2rem] p-8 border border-primary/20 bg-primary/5 flex items-center justify-between group hover:bg-primary/10 transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 shadow-neon-cyan group-hover:scale-110 transition-transform">
                      <span className="material-icons-outlined text-primary text-3xl">{isAnalyzing ? 'sync' : 'psychology'}</span>
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">Análisis con IA</h3>
                      <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Obtener insights y sugerencias</p>
                    </div>
                  </div>
                  <span className="material-icons-outlined text-primary/50 group-hover:translate-x-2 transition-transform">arrow_forward</span>
                </button>
              </div>

              {/* Gráfico de Tendencia */}
              <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4">
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest px-2">Tendencia Mensual</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={alumnos.reduce((acc: any[], al) => {
                      const month = new Date(al.fechaIngreso).toLocaleString('default', { month: 'short' });
                      const existing = acc.find(i => i.name === month);
                      if (existing) existing.count++;
                      else acc.push({ name: month, count: 1 });
                      return acc;
                    }, []).slice(-6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                        itemStyle={{ color: '#00F0FF', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="count" stroke="#00F0FF" strokeWidth={3} dot={{ r: 4, fill: '#00F0FF' }} activeDot={{ r: 6, stroke: '#00F0FF', strokeWidth: 2, fill: '#151619' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Distribución por Grupo */}
              <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4">
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest px-2">Alumnos por Grupo</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grupos.map(g => ({
                      name: g.nombre,
                      alumnos: alumnos.filter(a => a.grupo === g.nombre).length
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                        cursor={{ fill: '#ffffff05' }}
                      />
                      <Bar dataKey="alumnos" fill="#A855F7" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Estado de Pagos */}
              <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4">
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest px-2">Estado de Matrículas</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Al día', value: alumnos.filter(a => a.estadoPago === 'Al día').length, color: '#10B981' },
                          { name: 'Pendiente', value: alumnos.filter(a => a.estadoPago === 'Pendiente').length, color: '#F59E0B' },
                          { name: 'Vencido', value: alumnos.filter(a => a.estadoPago === 'Vencido').length, color: '#EF4444' }
                        ]}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                      >
                        {[
                          { color: '#10B981' },
                          { color: '#F59E0B' },
                          { color: '#EF4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Resumen de Asistencia Hoy */}
              <div className="glass-card rounded-[2rem] p-6 border border-white/5 flex flex-col justify-center items-center text-center space-y-4">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 shadow-neon-cyan">
                  <span className="material-icons-outlined text-primary text-4xl">how_to_reg</span>
                </div>
                <div>
                  <h4 className="text-3xl font-black text-white">{presentCount}</h4>
                  <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Presentes Hoy</p>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary shadow-neon-cyan" style={{ width: `${(presentCount / (alumnos.length || 1)) * 100}%` }}></div>
                </div>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                  {Math.round((presentCount / (alumnos.length || 1)) * 100)}% de la matrícula total
                </p>
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
                <button onClick={() => setAiAnalysis(null)} className="text-white/40 hover:text-white">
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
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
                <button onClick={() => setIsBulkImporting(false)} className="text-white/40 hover:text-white">
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col gap-4">
                <p className="text-[10px] text-primary font-black uppercase tracking-widest leading-relaxed">
                  Pega los datos desde Excel o sube un archivo CSV. <br/>
                  Formato: <span className="text-white">Nombre, DNI, Grupo, Nivel, Teléfono</span>
                </p>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleCsvImport} 
                    ref={fileInputRef}
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                  >
                    <span className="material-icons-outlined text-sm">upload_file</span>
                    Seleccionar CSV
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
            </div>
          </div>
        )}

      {/* Notificaciones */}
      {notificacion && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-[380px] bg-antigravity-charcoal/95 backdrop-blur-2xl text-white p-5 rounded-[2rem] shadow-neon-cyan-strong border border-white/10 flex items-center gap-4 animate-in slide-in-from-top-12 duration-500">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 active-glow shrink-0">
            <span className="material-icons-outlined text-primary text-2xl">verified</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary truncate">{notificacion.t}</p>
            <p className="text-[11px] text-slate-300 font-medium mt-0.5 leading-tight italic line-clamp-2">"{notificacion.d}"</p>
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