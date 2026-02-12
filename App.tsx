import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// --- CONSTANTES Y TIPOS CONSOLIDADOS PARA EVITAR ERRORES DE RUTA EN GAS ---
const SPREADSHEET_ID = '1HC8Lrdqu5UZDMNpjMNZZdL44ZgOzSOOHWL3dUrk1czE';
const SHEET_NAME = 'Registro de Clases de Gimnasia';

type AgeGroup = '3 a 5 años' | '6 a 9 años' | '10 a 15 años';
type Apparatus = 'Viga de equilibrio' | 'Paralelas asimétricas' | 'Suelo' | 'Salto';
type ViewMode = 'Registro' | 'Estadisticas';

enum Step {
  GroupInfo = 0, AgeGroup = 1, Attendance = 2, Warmup = 3, 
  ApparatusSelection = 4, ApparatusDetails = 5, Summary = 6, Success = 7
}

interface HistoryEntry {
  date: string; group: string; ageGroups: string[]; presentCount: number;
  warmup: string[]; apparatus: string[]; details: Record<string, string[]>;
}

interface ClassRecord {
  date: string; day: string; month: string; groupName: string; schedule: string;
  daysOfWeek: string[]; ageGroups: AgeGroup[];
  attendance: { name: string; present: boolean }[];
  warmupSkills: string[]; apparatus: Apparatus[];
  apparatusDetails: Record<Apparatus, string[]>;
}

const AGE_GROUPS: AgeGroup[] = ['3 a 5 años', '6 a 9 años', '10 a 15 años'];
const APPARATUS_OPTIONS: Apparatus[] = ['Viga de equilibrio', 'Paralelas asimétricas', 'Suelo', 'Salto'];
const DEFAULT_WARMUP_SKILLS = ['Elongación', 'Postura', 'Saltabilidad', 'Equilibrio', 'Articulaciones', 'Fuerza Core'];
const SUGGESTED_SKILLS: Record<Apparatus, string[]> = {
  'Viga de equilibrio': ['Caminata', 'Giro', 'Salto de gato', 'Arabeque'],
  'Paralelas asimétricas': ['Suspensión', 'Salida', 'Dominada', 'Vuelo'],
  'Suelo': ['Rol adelante', 'Rueda', 'Vertical', 'Mortero'],
  'Salto': ['Mortero', 'Rondo', 'Media Luna', 'Pasaje']
};

// --- SERVICIO GEMINI ---
const ai = new GoogleGenAI({ apiKey: (window as any).process?.env?.API_KEY || "" });

async function getPlanningAnalysis(history: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza este progreso de gimnasia: ${history}. Genera un reporte profesional en español con fuentes grandes (USA MAYÚSCULAS PARA TÍTULOS).`,
    });
    return response.text || "No se pudo generar el análisis.";
  } catch (error) {
    return "Error al conectar con la IA.";
  }
}

// --- COMPONENTE PRINCIPAL ---
const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('Registro');
  const [currentStep, setCurrentStep] = useState<Step>(Step.GroupInfo);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [record, setRecord] = useState<ClassRecord>({
    date: new Date().toISOString().split('T')[0],
    day: new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date()),
    month: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date()),
    groupName: '', schedule: '', daysOfWeek: [], ageGroups: [],
    attendance: [
      { name: 'Ana García', present: false }, { name: 'Beto López', present: false },
      { name: 'Carla Ruiz', present: false }, { name: 'Diego Sosa', present: false },
      { name: 'Elena Paz', present: false }
    ],
    warmupSkills: [], apparatus: [],
    apparatusDetails: { 'Viga de equilibrio': [], 'Paralelas asimétricas': [], 'Suelo': [], 'Salto': [] }
  });

  useEffect(() => {
    if ((window as any).google?.script?.run) {
      (window as any).google.script.run
        .withSuccessHandler((data: string) => {
          if (data) setHistory(JSON.parse(data));
        })
        .getHistoryData();
    } else {
      setHistory([
        { date: '2024-05-01', group: 'Avanzado', ageGroups: ['10 a 15 años'], presentCount: 5, warmup: ['Elongación'], apparatus: ['Suelo'], details: { 'Suelo': ['Rueda'] } }
      ]);
    }
  }, []);

  const stats = useMemo(() => {
    const apparatusCounts: Record<string, number> = {};
    let topSkill = '---';
    const skillCounts: Record<string, number> = {};
    history.forEach(entry => {
      entry.apparatus?.forEach(ap => {
        apparatusCounts[ap] = (apparatusCounts[ap] || 0) + 1;
        entry.details?.[ap]?.forEach(sk => skillCounts[sk] = (skillCounts[sk] || 0) + 1);
      });
    });
    const sorted = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) topSkill = sorted[0][0];
    return { apparatusCounts, topSkill, totalClasses: history.length };
  }, [history]);

  const handleSave = async () => {
    setIsSaving(true);
    if ((window as any).google?.script?.run) {
      (window as any).google.script.run
        .withSuccessHandler(() => { setIsSaving(false); setCurrentStep(Step.Success); })
        .saveClassData(JSON.stringify(record));
    } else {
      setTimeout(() => { setIsSaving(false); setCurrentStep(Step.Success); }, 1000);
    }
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await getPlanningAnalysis(JSON.stringify(stats));
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const formatAnalysisText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return <p key={i} className="ml-4 mb-4 text-[19px] text-white/90">• {trimmed.substring(1)}</p>;
      }
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 5) {
        return <h4 key={i} className="mt-8 mb-4 text-yellow-400 font-black text-xl border-l-4 border-yellow-400 pl-3">{trimmed}</h4>;
      }
      return <p key={i} className="mb-5 text-[18px] leading-relaxed text-white/95">{trimmed}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4">
      <nav className="w-full max-w-md flex bg-white rounded-3xl p-1 shadow-md mb-6 sticky top-4 z-50">
        <button onClick={() => setViewMode('Registro')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black transition-all ${viewMode === 'Registro' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>REGISTRO</button>
        <button onClick={() => setViewMode('Estadisticas')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black transition-all ${viewMode === 'Estadisticas' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>ANÁLISIS IA</button>
      </nav>

      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white">
        <header className="bg-indigo-800 p-8 text-white text-center">
          <h1 className="text-2xl font-black uppercase">GymCoach Pro</h1>
          <div className="mt-3 inline-block bg-black/20 px-4 py-1.5 rounded-full text-[9px] font-mono">{SPREADSHEET_ID}</div>
        </header>

        <main className="p-8 min-h-[500px]">
          {viewMode === 'Registro' ? (
            <div className="space-y-6">
              {currentStep === Step.GroupInfo && (
                <div className="space-y-6 animate-fadeIn">
                  <h2 className="text-xl font-black text-slate-800 uppercase">Datos del Grupo</h2>
                  <input type="text" placeholder="Nombre del Grupo" className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-100 font-bold" value={record.groupName} onChange={e => setRecord({...record, groupName: e.target.value})} />
                  <input type="text" placeholder="Horario" className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-100 font-bold" value={record.schedule} onChange={e => setRecord({...record, schedule: e.target.value})} />
                  <button onClick={() => setCurrentStep(Step.AgeGroup)} className="w-full py-5 bg-indigo-600 text-white rounded-full font-black uppercase text-xs">Siguiente</button>
                </div>
              )}
              {currentStep === Step.Success && (
                <div className="text-center py-10 space-y-6 animate-fadeIn">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto"><i className="fas fa-check"></i></div>
                  <h2 className="text-2xl font-black uppercase">¡Clase Guardada!</h2>
                  <button onClick={() => { setViewMode('Estadisticas'); setCurrentStep(Step.GroupInfo); }} className="w-full py-5 bg-indigo-600 text-white rounded-full font-black uppercase text-xs">Ir al Dashboard</button>
                </div>
              )}
              {currentStep !== Step.GroupInfo && currentStep !== Step.Success && (
                <div className="text-center py-10">
                  <p className="text-slate-400 font-bold uppercase text-[10px] mb-4">Paso {currentStep + 1} de 7</p>
                  <button onClick={() => setCurrentStep(currentStep + 1)} className="w-full py-5 bg-indigo-600 text-white rounded-full font-black uppercase text-xs">Continuar Proceso</button>
                  {currentStep === Step.Summary && <button onClick={handleSave} className="w-full mt-4 py-5 bg-green-600 text-white rounded-full font-black uppercase text-xs">{isSaving ? 'Guardando...' : 'Finalizar'}</button>}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 p-6 rounded-[2rem] text-center">
                  <span className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Clases</span>
                  <p className="text-3xl font-black text-indigo-900">{stats.totalClasses}</p>
                </div>
                <div className="bg-green-50 p-6 rounded-[2rem] text-center">
                  <span className="text-[9px] font-black text-green-400 uppercase block mb-1">Top Skill</span>
                  <p className="text-[10px] font-black text-green-900 uppercase truncate">{stats.topSkill}</p>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6">
                <div className="flex items-center gap-4">
                  <i className="fas fa-brain text-yellow-400 text-2xl"></i>
                  <h3 className="font-black uppercase tracking-widest text-sm">Coach Inteligente</h3>
                </div>
                
                {aiAnalysis && (
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {formatAnalysisText(aiAnalysis)}
                  </div>
                )}

                <button onClick={runAnalysis} disabled={isAnalyzing} className="w-full py-5 bg-white text-indigo-900 rounded-full font-black uppercase text-xs flex items-center justify-center gap-3">
                  {isAnalyzing ? <i className="fas fa-sync animate-spin"></i> : <i className="fas fa-magic"></i>}
                  {isAnalyzing ? 'Analizando...' : 'Generar Reporte IA'}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
      <footer className="mt-8 text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] opacity-40">Connected to Google Sheets V3</footer>
    </div>
  );
};

export default App;