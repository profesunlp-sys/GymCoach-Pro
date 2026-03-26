
import React from 'react';
import { ViewMode, Source } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface ManualesProps {
  vista: ViewMode;
  setVista: (vista: ViewMode) => void;
  DISCIPLINAS: string[];
  NIVELES: string[];
  selectedDisciplina: string;
  setSelectedDisciplina: (val: string) => void;
  selectedNivel: string;
  setSelectedNivel: (val: string) => void;
  SKILL_TREE: any;
  sources: Source[];
  kbMessages: {role: 'user' | 'model', text: string}[];
  isKbLoading: boolean;
  kbInput: string;
  setKbInput: (val: string) => void;
  handleKbQuery: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteSource: (id: string, name: string) => void;
}

export const Manuales: React.FC<ManualesProps> = ({
  vista,
  setVista,
  DISCIPLINAS,
  NIVELES,
  selectedDisciplina,
  setSelectedDisciplina,
  selectedNivel,
  setSelectedNivel,
  SKILL_TREE,
  sources,
  kbMessages,
  isKbLoading,
  kbInput,
  setKbInput,
  handleKbQuery,
  handleFileUpload,
  handleDeleteSource
}) => {
  if (vista !== 'Planes') return null;

  return (
    <div className="px-6 py-8 space-y-8 page-transition pb-24">
      <header className="flex items-center gap-4">
        <button onClick={() => setVista('Dashboard')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Centro Técnico</h2>
          <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Manuales y Progresiones</p>
        </div>
      </header>

      {/* AI Assistant Section */}
      <section className="glass-card rounded-3xl p-6 border border-primary/20 bg-primary/5 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30 shadow-neon-cyan">
              <span className="material-icons-outlined text-primary text-xl">psychology</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Asistente Técnico AI</h3>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest">Consulta tus manuales</p>
            </div>
          </div>
          
          <label className="cursor-pointer group">
            <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt" />
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl group-hover:bg-primary/10 group-hover:border-primary/30 transition-all">
              <span className="material-icons-outlined text-primary text-sm">upload_file</span>
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Subir Manual</span>
            </div>
          </label>
        </div>

        {/* Sources List */}
        {sources.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {sources.map(source => (
              <div key={source.id} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg whitespace-nowrap">
                <span className="material-icons-outlined text-primary text-xs">description</span>
                <span className="text-[10px] text-white/80 font-medium">{source.name}</span>
                <button onClick={() => handleDeleteSource(source.id!, source.name)} className="text-rose-500 hover:text-rose-400 p-0.5">
                  <span className="material-icons-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Chat Interface */}
        <div className="space-y-4">
          <div className="bg-antigravity-black/40 rounded-2xl border border-white/5 p-4 h-64 overflow-y-auto space-y-4 no-scrollbar">
            {sources.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
                <span className="material-icons-outlined text-white/20 text-4xl">cloud_off</span>
                <p className="text-xs text-white/40 italic">
                  No hay documentos cargados. Por favor, sube manuales o planes de entrenamiento para comenzar.
                </p>
              </div>
            ) : kbMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
                <span className="material-icons-outlined text-primary/20 text-4xl">chat_bubble_outline</span>
                <p className="text-xs text-white/40 italic">
                  ¡Hola! Soy tu asistente técnico. Pregúntame cualquier cosa sobre los manuales cargados.
                </p>
              </div>
            ) : (
              kbMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-xs ${msg.role === 'user' ? 'bg-primary text-antigravity-black font-bold' : 'bg-white/5 text-white/90 border border-white/10'}`}>
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
              ))
            )}
            {isKbLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/10 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              value={kbInput}
              onChange={(e) => setKbInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleKbQuery()}
              placeholder={sources.length === 0 ? "Sube un manual para chatear..." : "Pregunta sobre los manuales..."}
              disabled={sources.length === 0 || isKbLoading}
              className="flex-1 bg-antigravity-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all disabled:opacity-50"
            />
            <button 
              onClick={handleKbQuery}
              disabled={sources.length === 0 || isKbLoading || !kbInput.trim()}
              className="w-12 h-12 bg-primary text-antigravity-black rounded-xl flex items-center justify-center shadow-neon-cyan disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all"
            >
              <span className="material-icons-outlined">send</span>
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {DISCIPLINAS.map(d => (
            <button 
              key={d}
              onClick={() => setSelectedDisciplina(d)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedDisciplina === d ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-white/5 text-white/60 border border-white/5'}`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {NIVELES.map(n => (
            <button 
              key={n}
              onClick={() => setSelectedNivel(n)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedNivel === n ? 'bg-white text-antigravity-black' : 'bg-white/5 text-white/40 border border-white/5'}`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {Object.entries(SKILL_TREE[selectedDisciplina as keyof typeof SKILL_TREE] || {}).map(([aparato, categorias]: [string, any]) => (
            <div key={aparato} className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                  <span className="material-icons-outlined text-primary text-xl">fitness_center</span>
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">{aparato}</h3>
              </div>
              
              <div className="space-y-4">
                {Object.entries(categorias).map(([cat, skills]: [string, any]) => (
                  <div key={cat} className="space-y-2">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest px-1">{cat}</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {skills.map((skill: string, idx: number) => (
                        <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all">
                          <span className="text-xs text-white/90">{skill}</span>
                          <span className="material-icons-outlined text-white/20 group-hover:text-primary transition-colors text-sm">info</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
