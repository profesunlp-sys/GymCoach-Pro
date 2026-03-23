import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { queryUnifiedAssistant } from '../../services/geminiService';

interface CoachAIProps {
  sources: any[];
}

export const CoachAI = ({ sources: internalSources }: CoachAIProps) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string, sources?: any[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    const userMsg = query;
    setQuery('');
    
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);
    
    try {
      // Usamos el consultor técnico limitado a la biblioteca
      const { text, sources } = await queryUnifiedAssistant(userMsg, internalSources);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: text,
        sources
      }]);
    } catch (error: any) {
      console.error("Error en consulta técnica:", error);
      setMessages(prev => [...prev, { role: 'assistant', text: 'El consultor técnico no está disponible en este momento. Por favor intentá de nuevo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-antigravity-black page-transition">
      <header className="px-6 py-8 pb-4 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Consultor Biblioteca</h2>
          <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Análisis de Manuales Internos</p>
        </div>
        <button 
          onClick={() => setMessages([])}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-rose-500 transition-all"
          title="Limpiar Consultas"
        >
          <span className="material-icons-outlined text-lg">delete_sweep</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-40 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-10 space-y-4 py-20">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <span className="material-icons-outlined text-3xl text-primary">local_library</span>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white">Consultor Estricto de Manuales</p>
              <p className="text-[10px] mt-2 leading-relaxed">Solo respondo basándome en los PDFs subidos en tu Biblioteca. Si un dato no está en tus archivos, no lo inventaré.</p>
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[90%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-antigravity-black rounded-tr-sm shadow-neon-cyan/20' : 'bg-antigravity-charcoal border border-white/15 text-white rounded-tl-sm'}`}>
              <div className="text-sm prose prose-invert max-w-none prose-p:leading-relaxed prose-a:text-primary prose-p:text-white/90">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/40">Evidencia en Biblioteca:</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map((s, i) => (
                      <div 
                        key={i} 
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10"
                      >
                        <span className="material-icons-outlined text-[10px] text-primary">description</span>
                        <span className="text-[9px] font-bold text-white/70 truncate max-w-[120px]">{s.title || 'Manual Interno'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-antigravity-charcoal border border-white/10 text-white rounded-2xl rounded-tl-sm p-4 ring-1 ring-primary/20">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 z-40">
        <div className="glass-card rounded-[2rem] p-2 flex items-center gap-2 border border-white/15 shadow-2xl backdrop-blur-xl">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Consultar Centro Técnico..."
            className="flex-1 bg-white/5 border-none focus:ring-0 outline-none placeholder:text-white/30 rounded-2xl py-3 px-4 text-sm text-white transition-all font-medium"
            disabled={isLoading}
          />
          
          <button 
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${query.trim() ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-white/5 text-white/20'}`}
          >
            <span className="material-icons-outlined text-lg">auto_awesome</span>
          </button>
        </div>
      </div>
    </div>
  );
};

