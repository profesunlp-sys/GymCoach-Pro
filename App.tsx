
import React, { useState, useCallback } from 'react';
import { Step, ClassRecord, AgeGroup, Apparatus } from './types';
import { AGE_GROUPS, DEFAULT_WARMUP_SKILLS, APPARATUS_OPTIONS, SUGGESTED_SKILLS } from './constants';
import { getSkillSuggestions } from './services/geminiService';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>(Step.AgeGroup);
  const [record, setRecord] = useState<ClassRecord>({
    date: new Date().toLocaleDateString('es-ES'),
    ageGroups: [],
    warmupSkills: [],
    apparatus: [],
    apparatusDetails: {
      'Viga de equilibrio': [],
      'Paralelas asimétricas': [],
      'Suelo': [],
      'Salto': []
    }
  });

  const [customInput, setCustomInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string[]>>({});

  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => Math.max(1, prev - 1));

  const toggleSelection = <T,>(list: T[], item: T): T[] => {
    return list.includes(item) ? list.filter(i => i !== item) : [...list, item];
  };

  const handleAgeToggle = (age: AgeGroup) => {
    setRecord(prev => ({ ...prev, ageGroups: toggleSelection(prev.ageGroups, age) }));
  };

  const handleWarmupToggle = (skill: string) => {
    setRecord(prev => ({ ...prev, warmupSkills: toggleSelection(prev.warmupSkills, skill) }));
  };

  const handleApparatusToggle = (ap: Apparatus) => {
    setRecord(prev => ({ ...prev, apparatus: toggleSelection(prev.apparatus, ap) }));
  };

  const handleDetailToggle = (ap: Apparatus, skill: string) => {
    setRecord(prev => ({
      ...prev,
      apparatusDetails: {
        ...prev.apparatusDetails,
        [ap]: toggleSelection(prev.apparatusDetails[ap], skill)
      }
    }));
  };

  const addCustomSkill = (target: 'warmup' | Apparatus) => {
    if (!customInput.trim()) return;
    if (target === 'warmup') {
      if (!record.warmupSkills.includes(customInput)) {
        setRecord(prev => ({ ...prev, warmupSkills: [...prev.warmupSkills, customInput] }));
      }
    } else {
      if (!record.apparatusDetails[target].includes(customInput)) {
        setRecord(prev => ({
          ...prev,
          apparatusDetails: {
            ...prev.apparatusDetails,
            [target]: [...prev.apparatusDetails[target], customInput]
          }
        }));
      }
    }
    setCustomInput('');
  };

  const fetchAiSuggestions = async (ap: Apparatus) => {
    const ageLabel = record.ageGroups[0] || '6 a 9 años';
    const suggestions = await getSkillSuggestions(ap, ageLabel);
    setAiSuggestions(prev => ({ ...prev, [ap]: suggestions }));
  };

  const saveToSheet = async () => {
    setIsSaving(true);
    // Simulating Google Apps Script execution
    // In a real scenario, you'd use google.script.run.saveClassData(record)
    console.log('Saving Data to Google Sheet ID: 1HC8Lrdqu5UZDMNpjMNZZdL44ZgOzSOOHWL3dUrk1czE');
    console.log('Record:', record);
    
    await new Promise(res => setTimeout(res, 2000));
    setIsSaving(false);
    setCurrentStep(Step.Success);
  };

  const reset = () => {
    setRecord({
      date: new Date().toLocaleDateString('es-ES'),
      ageGroups: [],
      warmupSkills: [],
      apparatus: [],
      apparatusDetails: {
        'Viga de equilibrio': [],
        'Paralelas asimétricas': [],
        'Suelo': [],
        'Salto': []
      }
    });
    setCurrentStep(Step.AgeGroup);
  };

  const renderProgress = () => {
    if (currentStep > Step.Summary) return null;
    const steps = [1, 2, 3, 4, 5];
    return (
      <div className="flex justify-between mb-8">
        {steps.map(s => (
          <div key={s} className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {s}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white text-center">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <i className="fas fa-dumbbell"></i> GymCoach Pro
          </h1>
          <p className="opacity-80 text-sm mt-1">Registro de Actividad Diaria</p>
        </div>

        <div className="p-6 md:p-8">
          {renderProgress()}

          {/* STEP 1: AGE GROUP */}
          {currentStep === Step.AgeGroup && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-xl font-semibold text-gray-800">1. ¿A qué grupo de edad pertenece la clase?</h2>
              <div className="grid grid-cols-1 gap-3">
                {AGE_GROUPS.map(age => (
                  <button
                    key={age}
                    onClick={() => handleAgeToggle(age)}
                    className={`p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                      record.ageGroups.includes(age) 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-100 hover:border-indigo-200 text-gray-600'
                    }`}
                  >
                    <span className="font-medium">{age}</span>
                    {record.ageGroups.includes(age) && <i className="fas fa-check-circle"></i>}
                  </button>
                ))}
              </div>
              <button
                disabled={record.ageGroups.length === 0}
                onClick={nextStep}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
              >
                Siguiente <i className="fas fa-arrow-right ml-2"></i>
              </button>
            </div>
          )}

          {/* STEP 2: WARMUP */}
          {currentStep === Step.Warmup && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-xl font-semibold text-gray-800">2. ¿Qué habilidades trabajaste en el calentamiento?</h2>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_WARMUP_SKILLS.map(skill => (
                  <button
                    key={skill}
                    onClick={() => handleWarmupToggle(skill)}
                    className={`px-4 py-2 rounded-full border-2 transition-all ${
                      record.warmupSkills.includes(skill)
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Agregar otra habilidad..."
                  className="flex-1 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                />
                <button
                  onClick={() => addCustomSkill('warmup')}
                  className="bg-indigo-100 text-indigo-700 p-3 rounded-xl hover:bg-indigo-200 transition-colors"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={prevStep} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">Atrás</button>
                <button
                  disabled={record.warmupSkills.length === 0}
                  onClick={nextStep}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-200"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: APPARATUS SELECTION */}
          {currentStep === Step.ApparatusSelection && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-xl font-semibold text-gray-800">3. ¿En qué aparato(s) trabajaron hoy?</h2>
              <div className="grid grid-cols-2 gap-4">
                {APPARATUS_OPTIONS.map(ap => (
                  <button
                    key={ap}
                    onClick={() => handleApparatusToggle(ap)}
                    className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                      record.apparatus.includes(ap)
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-100 hover:border-indigo-200 text-gray-500'
                    }`}
                  >
                    <i className={`fas ${ap === 'Viga de equilibrio' ? 'fa-minus' : ap === 'Paralelas asimétricas' ? 'fa-bars' : ap === 'Suelo' ? 'fa-square' : 'fa-vault'} text-2xl`}></i>
                    <span className="text-sm font-bold text-center">{ap}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={prevStep} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">Atrás</button>
                <button
                  disabled={record.apparatus.length === 0}
                  onClick={nextStep}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-200"
                >
                  Detallar Habilidades
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: APPARATUS DETAILS */}
          {currentStep === Step.ApparatusDetails && (
            <div className="space-y-8 animate-fadeIn">
              <h2 className="text-xl font-semibold text-gray-800">4. Detalles por aparato</h2>
              {record.apparatus.map(ap => (
                <div key={ap} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-indigo-900 uppercase tracking-wider text-sm">{ap}</h3>
                    <button 
                        onClick={() => fetchAiSuggestions(ap)}
                        className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition-colors flex items-center gap-1"
                    >
                        <i className="fas fa-magic"></i> Sugerencias AI
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {/* Combine hardcoded suggestions and AI suggestions */}
                    {[...SUGGESTED_SKILLS[ap], ...(aiSuggestions[ap] || [])].map((skill, idx) => (
                      <button
                        key={`${skill}-${idx}`}
                        onClick={() => handleDetailToggle(ap, skill)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                          record.apparatusDetails[ap].includes(skill)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nueva habilidad..."
                      className="flex-1 p-2 text-sm border border-gray-200 rounded-lg"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                    />
                    <button
                      onClick={() => addCustomSkill(ap)}
                      className="bg-indigo-500 text-white px-3 rounded-lg hover:bg-indigo-600"
                    >
                      <i className="fas fa-plus"></i>
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex gap-4 pt-4">
                <button onClick={prevStep} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">Atrás</button>
                <button
                  disabled={record.apparatus.some(ap => record.apparatusDetails[ap].length === 0)}
                  onClick={nextStep}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-200"
                >
                  Ver Resumen
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: SUMMARY */}
          {currentStep === Step.Summary && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-xl font-semibold text-gray-800">5. Resumen de la Clase</h2>
              
              <div className="space-y-4 text-sm bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                <div className="flex justify-between border-b border-indigo-200 pb-2">
                  <span className="font-bold text-indigo-900">Fecha</span>
                  <span>{record.date}</span>
                </div>
                <div>
                  <span className="font-bold text-indigo-900 block mb-1">Grupos:</span>
                  <div className="flex flex-wrap gap-1">
                    {record.ageGroups.map(g => <span key={g} className="bg-white px-2 py-1 rounded text-xs border border-indigo-200">{g}</span>)}
                  </div>
                </div>
                <div>
                  <span className="font-bold text-indigo-900 block mb-1">Calentamiento:</span>
                  <p className="text-gray-700">{record.warmupSkills.join(', ')}</p>
                </div>
                <div>
                  <span className="font-bold text-indigo-900 block mb-1">Aparatos y Habilidades:</span>
                  <ul className="space-y-2">
                    {record.apparatus.map(ap => (
                      <li key={ap} className="pl-3 border-l-2 border-indigo-300">
                        <strong className="text-indigo-800 text-xs uppercase">{ap}:</strong>
                        <p className="text-gray-700">{record.apparatusDetails[ap].join(', ')}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={prevStep} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">Atrás</button>
                <button
                  onClick={saveToSheet}
                  className="flex-[2] py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-100 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <><i className="fas fa-circle-notch animate-spin"></i> Guardando...</>
                  ) : (
                    <><i className="fas fa-save"></i> Guardar Clase</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: SUCCESS */}
          {currentStep === Step.Success && (
            <div className="text-center space-y-8 py-8 animate-bounceIn">
              <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl mx-auto shadow-inner">
                <i className="fas fa-check"></i>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-gray-800">¡Guardado con éxito!</h2>
                <p className="text-gray-500">Los datos han sido enviados a tu Google Sheet.</p>
              </div>
              <button
                onClick={reset}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
              >
                Registrar otra clase
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-gray-400 text-xs">
        <p>Sheet ID: 1HC8Lrdqu5UZDMNpjMNZZdL44ZgOzSOOHWL3dUrk1czE</p>
        <p className="mt-1">GymCoach Pro &copy; 2024</p>
      </div>

      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
        .animate-bounceIn {
          animation: bounceIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default App;
