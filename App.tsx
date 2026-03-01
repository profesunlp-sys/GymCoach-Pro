import React, { useState, useEffect, useRef } from 'react';
import { Alumno, Clase, ViewMode, GrupoConfig, AsistenciaRecord, UserRole, Feedback, Skill, SkillStatus, Apparatus } from './types.ts';
import { processClassAudio, refineClassAnalysis } from './services/geminiService.ts';
import { db as firestore, auth, googleProvider, COLLECTIONS, getCollectionData, addDocument, updateDocument } from './services/firebase.ts';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('Coach');
  const [vista, setVista] = useState<ViewMode>('Dashboard');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [grupos, setGrupos] = useState<GrupoConfig[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<Record<string, boolean>>({});
  const [selectedClase, setSelectedClase] = useState<Clase | null>(null);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [selectedProfesor, setSelectedProfesor] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [newFeedback, setNewFeedback] = useState("");
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Group Form State
  const [newGroupName, setNewGroupName] = useState("");
  const [newCoachName, setNewCoachName] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:00");

  // Class Form State
  const [claseGrupo, setClaseGrupo] = useState("");
  const [faseInicial, setFaseInicial] = useState<string[]>([]);
  const [fasePrincipal, setFasePrincipal] = useState<string[]>([]);
  const [faseFinal, setFaseFinal] = useState<string[]>([]);
  const [customInicial, setCustomInicial] = useState("");
  const [customPrincipal, setCustomPrincipal] = useState("");
  const [customFinal, setCustomFinal] = useState("");

  // Selected Group Context
  const [activeGroup, setActiveGroup] = useState<GrupoConfig | null>(null);

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
  const [newSkill, setNewSkill] = useState<Partial<Skill>>({ name: '', status: 'No Iniciado', apparatus: 'Suelo', level: 1 });

  
  // IA Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<any>(null);
  const [clarificationText, setClarificationText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // UI States
  const [notificacion, setNotificacion] = useState<{t: string, d: string} | null>(null);

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
      setVista('Dashboard');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const [asistenciasGlobales, setAsistenciasGlobales] = useState<Record<string, { presentes: number, total: number }>>({});

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
    const a = await getCollectionData(COLLECTIONS.ALUMNOS) as Alumno[];
    const c = await getCollectionData(COLLECTIONS.CLASES) as Clase[];
    const g = await getCollectionData(COLLECTIONS.GRUPOS) as GrupoConfig[];
    setAlumnos(a);
    setClases(c.sort((x, y) => new Date(y.fecha).getTime() - new Date(x.fecha).getTime()));
    setGrupos(g);
    
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
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
      // Real-time updates for classes (important for coordinator)
      const unsub = onSnapshot(collection(firestore, COLLECTIONS.CLASES), (snapshot) => {
        const c = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Clase[];
        setClases(c.sort((x, y) => new Date(y.fecha).getTime() - new Date(x.fecha).getTime()));
      });
      return () => unsub();
    }
  }, [isLoggedIn, activeGroup]);

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
    
    await addDocument(COLLECTIONS.GRUPOS, {
      nombre: newGroupName,
      entrenador: newCoachName,
      dias: selectedDays,
      horario: `${startTime} - ${endTime}`
    });
    setNewGroupName("");
    setNewCoachName("");
    setSelectedDays([]);
    loadData();
    setNotificacion({ t: "Éxito", d: `Grupo ${newGroupName} configurado.` });
    setTimeout(() => setNotificacion(null), 3000);
  };

  const handleSaveStudent = async () => {
    if (userRole === 'Coordinator') return;
    if (!studentForm.nombre || !studentForm.dni) {
      setNotificacion({ t: "Error", d: "Nombre y DNI son obligatorios." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }

    const newStudent: Omit<Alumno, 'id'> = {
      ...studentForm as Alumno,
      grupo: activeGroup?.nombre || 'Sin Grupo',
      fechaIngreso: new Date().toISOString(),
      estadoPago: 'Al día',
      habilidades: [],
      biometria: { fuerza: 50, flexibilidad: 50, tecnica: 50, resistencia: 50, coordinacion: 50 },
      qrCode: `QR_${studentForm.dni}`,
      asistenciasHistoricas: 0
    };

    await addDocument(COLLECTIONS.ALUMNOS, newStudent);
    loadData();
    setNotificacion({ t: "Atleta Registrado", d: `${newStudent.nombre} añadido.` });
    setVista('AsistenciaLista');
    setStudentForm({
      nombre: '', dni: '', disciplina: 'GAF', nivel: 'Escuela',
      fechaNacimiento: '', fechaPrimeraClase: new Date().toISOString().split('T')[0],
      alertas: [], contacto: { padreNombre: '', padreTelefono: '', madreNombre: '', madreTelefono: '', emergenciaNombre: '', emergenciaTelefono: '' }
    });
    setTimeout(() => setNotificacion(null), 3000);
  };

  const toggleAttendance = async (alumnoId: string) => {
    if (userRole === 'Coordinator') return;
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
  };

  const handleAddFeedback = async () => {
    if (!newFeedback.trim() || !selectedClase?.id) return;
    await addDocument(COLLECTIONS.FEEDBACK, {
      claseId: selectedClase.id,
      author: userRole === 'Coordinator' ? 'Coordinador' : 'Profesor',
      text: newFeedback,
      timestamp: new Date().toISOString()
    });
    setNewFeedback("");
  };

  const handleAddSkill = async () => {
    if (!selectedAlumno || !selectedAlumno.id || !newSkill.name) return;
    
    const skillToAdd: Skill = {
      id: Date.now().toString(),
      name: newSkill.name!,
      status: newSkill.status as SkillStatus,
      apparatus: newSkill.apparatus as Apparatus,
      level: newSkill.level || 1
    };

    const updatedHabilidades = [...(selectedAlumno.habilidades || []), skillToAdd];
    
    await updateDocument(COLLECTIONS.ALUMNOS, selectedAlumno.id, {
      habilidades: updatedHabilidades
    });
    
    setSelectedAlumno({ ...selectedAlumno, habilidades: updatedHabilidades });
    setIsAddingSkill(false);
    setNewSkill({ name: '', status: 'No Iniciado', apparatus: 'Suelo', level: 1 });
    loadData();
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
  };

  const handleSaveManualClass = async () => {
    if (!claseGrupo) {
      setNotificacion({ t: "Error", d: "Debes seleccionar un grupo." });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }
    const newClase: Omit<Clase, 'id'> = {
      fecha: new Date().toISOString(),
      grupo: claseGrupo,
      horario: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      entrenador: user?.displayName || 'Coach Pro',
      faseInicial: faseInicial,
      fasePrincipal: fasePrincipal,
      faseFinal: faseFinal
    };
    await addDocument(COLLECTIONS.CLASES, newClase);
    loadData();
    setNotificacion({ t: "Éxito", d: `Clase registrada correctamente.` });
    setClaseGrupo("");
    setFaseInicial([]);
    setFasePrincipal([]);
    setFaseFinal([]);
    setVista('Dashboard');
  };

  const timeIntervals = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"];
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
        <p className="text-white/40 text-[10px] font-bold italic uppercase tracking-[0.4em] mb-12 whitespace-nowrap">
          ELITE GYMNASTICS MANAGEMENT
        </p>

        <div className="w-full max-w-[280px] space-y-4">
          <button onClick={handleLogin} className="w-full py-4.5 bg-white text-[#1e1b4b] rounded-full font-bold uppercase text-[10px] tracking-[0.18em] shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-95 transition-all hover:bg-slate-50 flex items-center justify-center gap-3">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
            INICIAR CON GOOGLE
          </button>
          
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

          <p className="text-[9px] text-white/30 uppercase tracking-widest mt-4">
            Acceso restringido para personal autorizado
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-antigravity-black shadow-2xl relative overflow-hidden flex flex-col font-display pb-32">
      
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
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-primary/50 transition-all min-h-[100px]"
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
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight leading-tight">¡Hola {userRole === 'Coordinator' ? 'Coordinador' : 'José María'}!</h2>
                <p className="text-indigo-100 text-sm mb-7 font-medium">
                  {userRole === 'Coordinator' ? 'Supervisa el progreso de tus colegas.' : 'Configura tu semana para empezar.'}
                </p>
                {userRole === 'Coach' && (
                  <button onClick={() => setVista('NuevaClase')} className="bg-white text-indigo-800 font-black px-7 py-3.5 rounded-[1.25rem] flex items-center gap-2 shadow-xl text-[11px] uppercase tracking-widest active:scale-95 transition-all">
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
                  {alertasGlobales.map(atleta => (
                    <div key={atleta.id} className="min-w-[200px] bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 space-y-2">
                      <p className="text-white font-bold text-xs truncate">{atleta.nombre}</p>
                      <p className="text-[10px] text-rose-200/60 italic line-clamp-2">"{atleta.alertas[0]}"</p>
                      <p className="text-[8px] font-black uppercase text-rose-500 tracking-widest">{atleta.grupo}</p>
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
                            {stats.presentes}<span className="text-[10px] text-white/20 mx-1">/</span>{stats.total}
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

            <section className="space-y-4">
              <div className="flex justify-between px-1"><h3 className="text-white font-bold text-lg">Actividad Reciente</h3></div>
              <div className="space-y-3">
                {clases.slice(0, 5).map((clase) => (
                  <div 
                    key={clase.id} 
                    onClick={() => { setSelectedClase(clase); setVista('ClaseDetalle'); }}
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
          </div>
        )}

        {vista === 'Horario' && (
          <div className="px-6 py-8 space-y-8 page-transition">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Horarios y Grupos</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Gestión de Clases</p>
            </header>

            <section className="space-y-4">
              <h3 className="text-accent-purple font-bold text-lg active-glow">Configuración de Horario</h3>
              <div className="glass-card rounded-[2.5rem] p-6 space-y-6">
                <div className="flex justify-between items-center px-1">
                  {['L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => {
                    const id = `${day}-${idx}`;
                    const isSelected = selectedDays.includes(id);
                    return (
                      <button key={id} onClick={() => setSelectedDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])}
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm transition-all ${isSelected ? 'border-2 border-primary shadow-neon-cyan text-primary bg-primary/5' : 'bg-antigravity-charcoal text-slate-500'}`}>
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  <input className="w-full bg-antigravity-charcoal border border-white/5 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-slate-600 focus:ring-1 ring-primary/30"
                    placeholder="Nombre del Grupo (Ej. Avanzados)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                  
                  <input className="w-full bg-antigravity-charcoal border border-white/5 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-slate-600 focus:ring-1 ring-primary/30"
                    placeholder="Nombre y Apellido del Profesor" value={newCoachName} onChange={(e) => setNewCoachName(e.target.value)} />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Desde</label>
                      <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-antigravity-charcoal border-none rounded-2xl px-4 py-3 text-sm text-white appearance-none">
                        {timeIntervals.map(t => <option key={t} value={t} className="bg-antigravity-charcoal">{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Hasta</label>
                      <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-antigravity-charcoal border-none rounded-2xl px-4 py-3 text-sm text-white appearance-none">
                        {timeIntervals.map(t => <option key={t} value={t} className="bg-antigravity-charcoal">{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <button onClick={handleSaveGroup} className="w-full py-4.5 rounded-2xl border border-accent-purple text-accent-purple font-black bg-accent-purple/5 shadow-neon-purple active:scale-[0.98] transition-all uppercase text-[10px] tracking-[0.2em]">
                  <span>Guardar Configuración</span>
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
                      <p className="text-xs text-slate-400 mt-2 font-medium italic">{g.horario}</p>
                      {g.entrenador && <p className="text-[10px] text-primary mt-1 font-bold uppercase tracking-wider">Prof: {g.entrenador}</p>}
                    </div>
                    <div className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1.5 rounded-lg border border-primary/20 tracking-wider shadow-neon-cyan uppercase">Active</div>
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
                <button onClick={() => setVista('Dashboard')} className="w-10 h-10 flex items-center justify-center rounded-full bg-antigravity-charcoal border border-white/10 text-white">
                  <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
                </button>
                <h1 className="text-sm font-bold tracking-widest uppercase text-white/60">Asistencia</h1>
                <div className="w-10"></div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight leading-none">{activeGroup.nombre}</h2>
                  <p className="text-neon-cyan font-medium flex items-center gap-2 mt-2 opacity-90 text-sm">
                    <span className="material-symbols-outlined text-[18px]">schedule</span> {activeGroup.horario}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Presentes</span>
                  <div className="text-2xl font-bold text-neon-cyan neon-glow-cyan">
                    {presentCount}<span className="text-white/20 mx-1">/</span>{filteredAlumnos.length}
                  </div>
                </div>
              </div>
            </header>

            <div className="px-6 pt-2 pb-4">
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xl group-focus-within:text-neon-cyan transition-colors">search</span>
                <input 
                  className="w-full bg-antigravity-charcoal border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-1 focus:ring-neon-cyan/50 focus:border-neon-cyan/50 placeholder:text-white/20 text-white neon-border-cyan transition-all" 
                  placeholder="Buscar alumno..." 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <main className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
              {filteredAlumnos.length > 0 ? filteredAlumnos.map(alumno => (
                <div key={alumno.id} className={`flex items-center justify-between p-4 rounded-2xl glass-card transition-all duration-300 ${!asistenciasHoy[alumno.id!] ? 'opacity-60' : 'border-neon-cyan/20'}`}>
                  <div className="flex items-center gap-4">
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
                      <h4 className={`text-sm font-semibold ${asistenciasHoy[alumno.id!] ? 'text-white' : 'text-white/70'} leading-none`}>{alumno.nombre}</h4>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${asistenciasHoy[alumno.id!] ? 'text-white/40' : 'text-white/30'}`}>{alumno.nivel}</p>
                    </div>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only ios-toggle peer" 
                      checked={asistenciasHoy[alumno.id!] || false}
                      onChange={() => toggleAttendance(alumno.id!)}
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full ios-toggle-label after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/60 after:rounded-full after:h-5 after:w-5 after:transition-all shadow-sm"></div>
                  </label>
                </div>
              )) : (
                <div className="py-24 text-center flex flex-col items-center space-y-6 opacity-30">
                  <span className="material-symbols-outlined text-[80px] font-light">person_off</span>
                  <p className="text-sm font-medium italic tracking-wide">Inicia agregando tu primer alumno<br/>usando el botón azul inferior.</p>
                </div>
              )}
            </main>

            {/* FAB button matches user snippet */}
            <button 
              onClick={() => setVista('RegistroAlumno')}
              className="absolute bottom-28 right-6 w-16 h-16 bg-neon-blue text-white rounded-2xl flex items-center justify-center neon-fab-blue active:scale-95 transition-all z-30"
            >
              <span className="material-symbols-outlined text-[32px] font-light">person_add</span>
            </button>
          </div>
        )}

        {vista === 'Alumnos' && (
          <div className="px-6 py-8 space-y-8 page-transition">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Atletas</h2>
                <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Base de Datos {userRole === 'Coordinator' ? 'Global' : 'del Grupo'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Total</p>
                <p className="text-2xl font-black text-white">{alumnos.length}</p>
              </div>
            </header>

            <div className="relative">
              <span className="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20">search</span>
              <input 
                className="w-full bg-antigravity-charcoal border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-white/20"
                placeholder="Buscar por nombre o DNI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {alumnos
                .filter(a => a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || a.dni.includes(searchQuery))
                .map(alumno => (
                <div 
                  key={alumno.id} 
                  onClick={() => { setSelectedAlumno(alumno); setVista('AlumnoDetalle'); }}
                  className="glass-card rounded-2xl p-4 border border-white/5 flex items-center justify-between cursor-pointer active:scale-95 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(alumno.nombre)}&background=random`} alt="" className="w-full h-full object-cover opacity-80" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{alumno.nombre}</h4>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{alumno.grupo} • {alumno.nivel}</p>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                    <span className="material-icons-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              ))}
              {alumnos.length === 0 && (
                <div className="py-20 text-center opacity-20 italic text-sm">No hay atletas registrados.</div>
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
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{selectedAlumno.nombre}</h2>
                <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">{selectedAlumno.grupo} • {selectedAlumno.nivel}</p>
              </div>
            </header>

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
                  <input 
                    type="text" 
                    placeholder="Nombre de la habilidad (ej. Mortal Atrás)"
                    className="w-full bg-antigravity-charcoal border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-primary/50 transition-all"
                    value={newSkill.name}
                    onChange={(e) => setNewSkill({...newSkill, name: e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select 
                      className="bg-antigravity-charcoal border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-primary/50 transition-all"
                      value={newSkill.apparatus}
                      onChange={(e) => setNewSkill({...newSkill, apparatus: e.target.value as Apparatus})}
                    >
                      <option value="Suelo">Suelo</option>
                      <option value="Viga">Viga</option>
                      <option value="Paralelas">Paralelas</option>
                      <option value="Salto">Salto</option>
                      <option value="Anillas">Anillas</option>
                      <option value="Arzones">Arzones</option>
                      <option value="Barra Fija">Barra Fija</option>
                    </select>
                    <select 
                      className="bg-antigravity-charcoal border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-primary/50 transition-all"
                      value={newSkill.status}
                      onChange={(e) => setNewSkill({...newSkill, status: e.target.value as SkillStatus})}
                    >
                      <option value="No Iniciado">No Iniciado</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Dominado">Dominado</option>
                      <option value="Elite">Elite</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-white/60 font-medium">Nivel:</label>
                    <input 
                      type="number" 
                      min="1" max="10"
                      className="w-20 bg-antigravity-charcoal border border-white/10 rounded-xl py-2 px-3 text-sm text-white text-center focus:border-primary/50 transition-all"
                      value={newSkill.level}
                      onChange={(e) => setNewSkill({...newSkill, level: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <button 
                    onClick={handleAddSkill}
                    disabled={!newSkill.name}
                    className="w-full py-3 rounded-xl bg-primary text-antigravity-black font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all disabled:opacity-50"
                  >
                    Guardar Habilidad
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {selectedAlumno.habilidades && selectedAlumno.habilidades.length > 0 ? (
                  selectedAlumno.habilidades.map(skill => (
                    <div key={skill.id} className="glass-card rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{skill.name}</h4>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">{skill.apparatus} • Nivel {skill.level}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
                        skill.status === 'Dominado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        skill.status === 'En Proceso' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        skill.status === 'Elite' ? 'bg-accent-purple/10 text-accent-purple border-accent-purple/20' :
                        'bg-white/5 text-white/40 border-white/10'
                      }`}>
                        {skill.status}
                      </div>
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
          <div className="px-6 py-8 space-y-8 page-transition">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Planes de Trabajo</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Historial Técnico de Clases</p>
            </header>

            <div className="space-y-4">
              {clases.map((clase) => (
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
                      <span className="material-icons-outlined text-white/40 text-sm">description</span>
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
              {clases.length === 0 && (
                <div className="py-20 text-center opacity-20 italic text-sm">No hay planes registrados.</div>
              )}
            </div>
          </div>
        )}

        {vista === 'Ajustes' && (
          <div className="px-6 py-8 space-y-8 page-transition">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Ajustes</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Configuración del Sistema</p>
            </header>

            <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                    <span className="material-icons-outlined text-primary">person</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-wider">{userRole === 'Coordinator' ? 'Coordinador General' : 'Entrenador Pro'}</p>
                    <p className="text-[10px] text-slate-500">Sesión Activa</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <button 
                  onClick={handleLogout}
                  className="w-full py-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <span className="material-icons-outlined text-sm">logout</span>
                  Cerrar Sesión
                </button>
              </div>
            </div>

            <div className="p-6 text-center opacity-20">
              <p className="text-[8px] font-black uppercase tracking-[0.5em] text-white">GymCoach Pro v2.0 Cloud</p>
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
                  <input className="w-full bg-antigravity-charcoal border border-white/10 rounded-2xl px-5 py-4 text-sm text-white" placeholder="Nombre completo del atleta" value={studentForm.nombre} onChange={(e) => setStudentForm({...studentForm, nombre: e.target.value})}/>
                  <div className="grid grid-cols-2 gap-4">
                    <input className="w-full bg-antigravity-charcoal border border-white/10 rounded-2xl px-5 py-4 text-sm text-white" placeholder="DNI" value={studentForm.dni} onChange={(e) => setStudentForm({...studentForm, dni: e.target.value})}/>
                    <input type="date" className="w-full bg-antigravity-charcoal border border-white/10 rounded-2xl px-4 py-4 text-sm text-white" value={studentForm.fechaNacimiento} onChange={(e) => setStudentForm({...studentForm, fechaNacimiento: e.target.value})}/>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-white font-black text-[10px] border-b border-white/5 pb-2 uppercase tracking-[0.3em] opacity-30 italic">Seguimiento Médico</h4>
                <textarea className="w-full bg-antigravity-charcoal border border-white/10 rounded-2xl px-5 py-4 text-sm text-white h-24" placeholder="Afecciones, alergias o impedimentos médicos..." onChange={(e) => setStudentForm({...studentForm, alertas: [e.target.value]})}/>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Fecha de Inicio de Actividades</label>
                  <input type="date" className="w-full bg-antigravity-charcoal border border-white/10 rounded-2xl px-5 py-4 text-sm text-white" value={studentForm.fechaPrimeraClase} onChange={(e) => setStudentForm({...studentForm, fechaPrimeraClase: e.target.value})}/>
                </div>
              </div>
              <button onClick={handleSaveStudent} className="w-full py-5 rounded-3xl bg-accent-purple text-white font-black uppercase tracking-[0.3em] text-[10px] shadow-neon-purple active:scale-95 transition-all">
                Finalizar Alta de Atleta
              </button>
            </div>
          </div>
        )}

        {vista === 'ReportePDF' && activeGroup && (
          <div className="page-transition p-8 bg-white text-black min-h-screen">
            <button onClick={() => setVista('AsistenciaLista')} className="mb-8 text-blue-600 font-bold print:hidden flex items-center gap-2">
              <span className="material-icons-outlined">arrow_back</span> Volver a la Lista
            </button>
            <div className="border-[6px] border-black p-10 max-w-5xl mx-auto space-y-12">
              <header className="flex justify-between items-start border-b-4 border-black pb-8">
                <div className="space-y-2">
                  <h1 className="text-6xl font-black uppercase tracking-tighter leading-none">GymCoach Pro</h1>
                  <h2 className="text-2xl font-black text-slate-500 uppercase tracking-widest">Planilla Mensual</h2>
                </div>
                <div className="text-right space-y-1 font-black uppercase text-sm">
                  <p>Grupo: <span className="bg-black text-white px-2 py-0.5">{activeGroup.nombre}</span></p>
                  <p>Mes: <span className="bg-black text-white px-2 py-0.5">SEPTIEMBRE 2024</span></p>
                </div>
              </header>
              <table className="w-full border-collapse border-4 border-black">
                <thead>
                  <tr className="bg-slate-100 uppercase text-[12px] font-black border-b-4 border-black">
                    <th className="p-5 text-left border-r-4 border-black">Atleta</th>
                    <th className="p-5 text-center border-r-4 border-black">DNI</th>
                    <th className="p-5 text-center border-r-4 border-black">Asistencias</th>
                    <th className="p-5 text-right">Firma Tutor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlumnos.map(a => (
                    <tr key={a.id} className="border-b-4 border-black font-bold">
                      <td className="p-5 border-r-4 border-black uppercase">{a.nombre}</td>
                      <td className="p-5 text-center border-r-4 border-black font-mono">{a.dni}</td>
                      <td className="p-5 text-center border-r-4 border-black font-black">12/12</td>
                      <td className="p-5 text-right w-48"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => window.print()} className="w-full py-6 mt-12 bg-black text-white font-black uppercase tracking-[0.4em] rounded-2xl print:hidden shadow-2xl">
                Imprimir Documento
              </button>
            </div>
          </div>
        )}

        {vista === 'ClaseDetalle' && selectedClase && (
          <div className="page-transition flex flex-col min-h-screen bg-antigravity-black">
            <header className="px-6 py-6 flex items-center gap-4 sticky top-12 bg-antigravity-black z-40">
              <button onClick={() => setVista('Dashboard')} className="w-10 h-10 flex items-center justify-center rounded-full bg-antigravity-charcoal border border-white/10 text-white">
                <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
              </button>
              <div>
                <h2 className="text-xl font-bold text-white leading-none">{selectedClase.grupo}</h2>
                <p className="text-xs text-primary mt-1 font-medium">{new Date(selectedClase.fecha).toLocaleDateString()} • {selectedClase.horario}</p>
              </div>
            </header>

            <main className="flex-1 px-6 space-y-8 pb-12">
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 italic">Contenido de la Clase</h3>
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
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 italic">Feedback del Coordinador</h3>
                <div className="space-y-4">
                  {feedbacks.map((fb) => (
                    <div key={fb.id} className={`p-4 rounded-2xl border ${fb.author === 'Coordinador' ? 'bg-primary/5 border-primary/20 ml-4' : 'bg-white/5 border-white/10 mr-4'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${fb.author === 'Coordinador' ? 'text-primary' : 'text-white/40'}`}>{fb.author}</span>
                        <span className="text-[8px] text-white/20">{new Date(fb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed italic">"{fb.text}"</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6">
                  <input 
                    className="flex-1 bg-antigravity-charcoal border border-white/10 rounded-2xl px-5 py-3.5 text-xs text-white placeholder:text-white/20"
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
              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Grupo</label>
                <select 
                  value={claseGrupo} 
                  onChange={(e) => setClaseGrupo(e.target.value)} 
                  className="w-full bg-antigravity-charcoal border border-white/10 rounded-2xl px-5 py-4 text-sm text-white appearance-none focus:ring-1 ring-primary/30"
                >
                  <option value="" disabled>Seleccionar Grupo</option>
                  {grupos.map(g => <option key={g.id} value={g.nombre}>{g.nombre}</option>)}
                </select>
              </div>

              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Fase Inicial (Entrada en calor)</label>
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
                    className="flex-1 bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-2 text-xs text-white"
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
                <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Fase Principal (Aparatos)</label>
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
                    className="flex-1 bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-2 text-xs text-white"
                  />
                  <button 
                    onClick={() => { if(customPrincipal) { setFasePrincipal(prev => [...prev, customPrincipal]); setCustomPrincipal(""); } }}
                    className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
                <label className="text-[10px] uppercase font-bold text-primary ml-1 tracking-widest">Fase Final</label>
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
                    className="flex-1 bg-antigravity-charcoal border border-white/10 rounded-xl px-4 py-2 text-xs text-white"
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
          <div className="px-6 py-8 space-y-8 page-transition pb-24">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Profesores</h2>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Staff de Entrenamiento</p>
            </header>
            
            <div className="space-y-4">
              {Array.from(new Set([...grupos.map(g => g.entrenador), ...clases.map(c => c.entrenador)])).filter(Boolean).map((profesor, idx) => {
                const profClases = clases.filter(c => c.entrenador === profesor);
                const profGrupos = grupos.filter(g => g.entrenador === profesor);
                return (
                  <div 
                    key={idx} 
                    onClick={() => { setSelectedProfesor(profesor as string); setVista('ProfesorDetalle'); }}
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
          </div>
        )}

        {vista === 'ProfesorDetalle' && selectedProfesor && (
          <div className="px-6 py-8 space-y-8 page-transition pb-24">
            <header className="flex items-center gap-4 mb-8">
              <button onClick={() => setVista('Profesores')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
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
                {grupos.filter(g => g.entrenador === selectedProfesor).map(g => (
                  <div key={g.id} className="glass-card rounded-2xl p-4 border border-white/5">
                    <h4 className="font-bold text-white text-sm">{g.nombre}</h4>
                    <p className="text-[10px] text-slate-400 mt-1">{g.horario}</p>
                  </div>
                ))}
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
            { v: 'Dashboard', i: 'grid_view' },
            { v: 'Alumnos', i: 'group' },
            { v: userRole === 'Coordinator' ? 'Profesores' : 'Horario', i: userRole === 'Coordinator' ? 'badge' : 'calendar_today' },
            { v: 'Ajustes', i: 'app_settings_alt' }
          ].map(item => (
            <button 
              key={item.v} 
              onClick={() => setVista(item.v as ViewMode)} 
              className={`flex flex-col items-center gap-1.5 transition-all flex-1 ${vista === item.v || (vista === 'AsistenciaLista' && item.v === 'Horario') ? 'text-neon-cyan active-glow' : 'text-white/30 hover:text-white'}`}
            >
              <span className={`material-symbols-outlined text-[26px] font-light ${vista === item.v || (vista === 'AsistenciaLista' && item.v === 'Horario') ? 'neon-glow-cyan' : ''}`}>{item.i}</span>
              <span className={`text-[9px] uppercase tracking-wide ${vista === item.v || (vista === 'AsistenciaLista' && item.v === 'Horario') ? 'font-bold' : 'font-medium'}`}>
                {item.v === 'Horario' ? (activeGroup ? 'Horario' : 'Horario') : item.v}
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

      {/* Notificaciones */}
      {notificacion && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[380px] bg-antigravity-charcoal/90 backdrop-blur-2xl text-white p-6 rounded-[2rem] shadow-neon-cyan-strong border border-white/10 flex items-center gap-5 animate-in slide-in-from-top-12 duration-500">
          <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 active-glow">
            <span className="material-icons-outlined text-primary text-3xl">verified</span>
          </div>
          <div><p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{notificacion.t}</p><p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed italic">"{notificacion.d}"</p></div>
        </div>
      )}
    </div>
  );
};

export default App;