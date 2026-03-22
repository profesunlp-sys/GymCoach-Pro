import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { getSearchGroundedAnswer, queryKnowledgeBase } from '../../services/geminiService';
import { saveFiles, loadFiles, clearFiles } from '../services/storageService';

export const CoachAI = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string, sources?: any[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string, data: string, type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar archivos al montar el componente
  useEffect(() => {
    const init = async () => {
      try {
        const stored = await loadFiles();
        if (stored && stored.length > 0) {
          setAttachedFiles(stored);
        }
      } catch (err: any) {
        console.error("Error cargando archivos persistentes:", err);
      }
    };
    init();
  }, []);

  // Guardar archivos cuando cambian
  useEffect(() => {
    if (attachedFiles.length > 0) {
      saveFiles(attachedFiles).catch(err => console.error("Error guardando archivos:", err));
    }
  }, [attachedFiles]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        alert('Las imágenes dentro del documento no serán leídas por el asistente, solo el texto.');
      } else if (file.type !== 'application/pdf') {
        alert('El archivo es demasiado grande o no se pudo leer. Por favor probá con un PDF más pequeño.');
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => {
        alert('El archivo es demasiado grande o no se pudo leer. Por favor probá con un PDF más pequeño.');
      };
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setAttachedFiles(prev => [...prev, { name: file.name, data: base64, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    const newFiles = attachedFiles.filter((_, i) => i !== index);
    setAttachedFiles(newFiles);
    if (newFiles.length === 0) {
      clearFiles();
    }
  };

  const handleSearch = async () => {
    if (!query.trim() && attachedFiles.length === 0) return;
    
    const userMsg = query;
    setQuery('');
    // No borramos los archivos aquí para permitir múltiples consultas sobre los mismos documentos
    const currentFiles = [...attachedFiles];
    
    setMessages(prev => [...prev, { role: 'user', text: userMsg || `Analizando ${currentFiles.length} archivos...` }]);
    setIsLoading(true);
    
    try {
      if (currentFiles.length > 0) {
        // Mapeamos los archivos al formato que espera queryKnowledgeBase
        const sources = currentFiles.map(f => ({
          name: f.name,
          content: f.data,
          type: 'pdf'
        }));

        const answer = await queryKnowledgeBase(userMsg || "Resume estos documentos", sources);

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          text: answer
        }]);
      } else {
        const { text, sources } = await getSearchGroundedAnswer(userMsg);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          text: text,
          sources
        }]);
      }
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
          <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">
            {attachedFiles.length > 0 ? `Modo Base de Conocimientos (${attachedFiles.length} docs)` : 'Búsqueda de Metodologías'}
          </p>
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

      <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 z-40 space-y-3">
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 items-center">
            {attachedFiles.map((file, idx) => (
              <div key={idx} className="bg-primary/10 border border-primary/30 rounded-full px-3 py-1 flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                <span className="material-icons-outlined text-xs text-primary">picture_as_pdf</span>
                <span className="text-[10px] text-white/90 truncate max-w-[100px]">{file.name}</span>
                <button onClick={() => removeFile(idx)} className="text-white/80 hover:text-white">
                  <span className="material-icons-outlined text-[14px]">close</span>
                </button>
              </div>
            ))}
            <button 
              onClick={() => {
                setAttachedFiles([]);
                clearFiles();
              }}
              className="text-[10px] text-rose-500 font-bold uppercase tracking-widest hover:underline ml-2"
            >
              Limpiar Todo
            </button>
          </div>
        )}
        
        <div className="glass-card rounded-3xl p-2 flex items-center gap-2 border border-white/10 shadow-2xl">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf" 
            multiple 
            className="hidden" 
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 text-white/80 hover:text-primary hover:border-primary/30 transition-all"
            title="Adjuntar PDF"
          >
            <span className="material-icons-outlined text-lg">add</span>
          </button>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Preguntar al Coach o sobre PDFs..."
            className="flex-1 bg-antigravity-charcoal border border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none placeholder:text-white/50 rounded-2xl py-3 px-4 text-sm text-white transition-all"
            disabled={isLoading}
          />
          
          <button 
            onClick={handleSearch}
            disabled={(!query.trim() && attachedFiles.length === 0) || isLoading}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${(query.trim() || attachedFiles.length > 0) ? 'bg-primary text-antigravity-black shadow-neon-cyan' : 'bg-antigravity-charcoal text-white/60 border border-white/10'}`}
          >
            <span className="material-icons-outlined text-lg">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
