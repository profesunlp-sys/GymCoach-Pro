import React, { useState, useRef, useEffect } from 'react';
import { LiveServerMessage, Modality } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { getSearchGroundedAnswer } from '../../services/geminiService.ts';
import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  // 1. Intentar obtener de Vercel (import.meta.env)
  const vercelKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  // 2. Intentar obtener de AI Studio (inyectado en window.process)
  const studioKey = (window as any).process?.env?.GEMINI_API_KEY || (window as any).process?.env?.API_KEY;
  
  // 3. Fallback directo (clave proporcionada) para asegurar que funcione en Vercel
  const fallbackKey = "AIzaSyARdk49hhQgyaspzs9ICK-gVvtBb67rRyE";
  
  const apiKey = vercelKey || studioKey || fallbackKey;
    
  if (!apiKey || apiKey === "") {
    throw new Error("Falta la API Key en Vercel. Debes crear una variable llamada exactamente VITE_GEMINI_API_KEY en la configuración de Vercel y volver a desplegar.");
  }
  
  return new GoogleGenAI({ apiKey: apiKey as string });
};

export const CoachAI = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string, sources?: any[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    const userMsg = query;
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);
    
    try {
      const { text, sources } = await getSearchGroundedAnswer(userMsg);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: text,
        sources
      }]);
    } catch (error: any) {
      console.error("Error en búsqueda:", error);
      setMessages(prev => [...prev, { role: 'assistant', text: `Error al realizar la búsqueda: ${error.message || error}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-antigravity-black page-transition">
      <header className="px-6 py-8 pb-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Asistente Coach</h2>
        <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Búsqueda de Metodologías</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-32">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-antigravity-black rounded-tr-sm' : 'bg-antigravity-charcoal border border-white/10 text-white rounded-tl-sm'}`}>
              {msg.role === 'user' ? (
                <p className="text-sm font-medium">{msg.text}</p>
              ) : (
                <div className="text-sm prose prose-invert max-w-none prose-p:leading-relaxed prose-a:text-primary">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              )}
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.sources.map((src, i) => (
                  <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-white/5 border border-white/10 text-primary px-2 py-1 rounded-md flex items-center gap-1 hover:bg-white/10 transition-colors">
                    <span className="material-icons-outlined text-[10px]">link</span>
                    {src.title || 'Fuente'}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-antigravity-charcoal border border-white/10 text-white rounded-2xl rounded-tl-sm p-4">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 z-40">
        <div className="glass-card rounded-3xl p-2 flex items-center gap-2 border border-white/10 shadow-2xl">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar metodologías..."
            className="flex-1 bg-white/10 border border-white/20 focus:bg-white/20 focus:border-primary/50 placeholder:text-white/50 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none transition-all"
            disabled={isLoading}
          />
          
          <button 
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${query.trim() ? 'bg-primary text-antigravity-black' : 'bg-antigravity-charcoal text-white/30 border border-white/10'}`}
          >
            <span className="material-icons-outlined text-lg">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
