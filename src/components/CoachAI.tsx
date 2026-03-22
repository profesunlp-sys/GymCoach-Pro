import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { getSearchGroundedAnswer, queryKnowledgeBase } from '../../services/geminiService';

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
      setMessages(prev => [...prev, { role: 'assistant', text: 'El asistente no está disponible en este momento. Por favor intentá de nuevo en unos minutos.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-antigravity-black page-transition">
      <header className="px-6 py-8 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Asistente Coach</h2>
          <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Búsqueda de Metodologías</p>
        </div>
        <button 
          onClick={() => setMessages([])}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-rose-500 transition-all"
          title="Limpiar Chat"
        >
          <span className="material-icons-outlined text-lg">delete_sweep</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-32">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-antigravity-black rounded-tr-sm' : 'bg-antigravity-charcoal border border-white/20 text-white rounded-tl-sm'}`}>
              {msg.role === 'user' ? (
                <p className="text-sm font-medium">{msg.text}</p>
              ) : (
                <div className="text-sm prose prose-invert max-w-none prose-p:leading-relaxed prose-a:text-primary prose-p:text-white/90">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              )}
            </div>
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

      <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 z-40 space-y-3">
        <div className="glass-card rounded-3xl p-2 flex items-center gap-2 border border-white/10 shadow-2xl">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Preguntar al Coach..."
            className="flex-1 bg-antigravity-charcoal border border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none placeholder:text-white/50 rounded-2xl py-3 px-4 text-sm text-white transition-all"
            disabled={isLoading}
          />
          
          <button 
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${query.trim() ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-antigravity-charcoal text-white/60 border border-white/10'}`}
          >
            <span className="material-icons-outlined text-lg">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
