import React, { useState, useRef, useEffect } from 'react';
import { LiveServerMessage, Modality } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { getSearchGroundedAnswer } from '../../services/geminiService.ts';
import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

export const CoachAI = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string, sources?: any[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

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

  const startLiveSession = async () => {
    try {
      setLiveStatus('Solicitando micrófono...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      setLiveStatus('Conectando...');
      const ai = getAI();
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            setLiveStatus('Escuchando...');
            setIsLive(true);
            
            try {
              const source = audioContextRef.current!.createMediaStreamSource(stream);
              sourceRef.current = source;
              
              const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                }
                
                const buffer = new ArrayBuffer(pcmData.length * 2);
                const view = new DataView(buffer);
                for (let i = 0; i < pcmData.length; i++) {
                  view.setInt16(i * 2, pcmData[i], true);
                }
                
                const base64Data = btoa(String.fromCharCode.apply(null, new Uint8Array(buffer) as any));
                
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({
                    media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                  });
                });
              };
              
              source.connect(processor);
              processor.connect(audioContextRef.current!.destination);
            } catch (err) {
              console.error("Error setting up audio processing:", err);
              setLiveStatus('Error de micrófono');
              stopLiveSession();
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              const pcmData = new Int16Array(bytes.buffer);
              const floatData = new Float32Array(pcmData.length);
              for (let i = 0; i < pcmData.length; i++) {
                floatData[i] = pcmData[i] / 32768.0;
              }
              
              const audioBuffer = audioContextRef.current!.createBuffer(1, floatData.length, 24000);
              audioBuffer.getChannelData(0).set(floatData);
              
              const source = audioContextRef.current!.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current!.destination);
              source.start();
            }
            
            if (message.serverContent?.interrupted) {
              // Handle interruption
            }
          },
          onclose: () => {
            stopLiveSession();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            stopLiveSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "Eres un experto entrenador de gimnasia artística. Ayudas a otros entrenadores con metodologías, ejercicios y consejos técnicos de forma conversacional y amigable.",
        },
      });
      
      sessionRef.current = sessionPromise;
      
    } catch (error) {
      console.error("Error starting live session:", error);
      setLiveStatus('Error de conexión o micrófono denegado');
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    setIsLive(false);
    setLiveStatus('');
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close()).catch(console.error);
      sessionRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-antigravity-black page-transition">
      <header className="px-6 py-8 pb-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Asistente Coach</h2>
        <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Búsqueda y Conversación en Vivo</p>
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
            className="flex-1 bg-transparent border-none text-white text-sm px-4 focus:outline-none placeholder:text-white/30"
            disabled={isLive || isLoading}
          />
          
          {query.trim() ? (
            <button 
              onClick={handleSearch}
              disabled={isLoading}
              className="w-10 h-10 bg-primary text-antigravity-black rounded-2xl flex items-center justify-center active:scale-95 transition-all"
            >
              <span className="material-icons-outlined text-lg">send</span>
            </button>
          ) : (
            <button 
              onClick={isLive ? stopLiveSession : startLiveSession}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${isLive ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-antigravity-charcoal text-primary border border-white/10'}`}
            >
              <span className="material-icons-outlined text-lg">{isLive ? 'stop' : 'mic'}</span>
            </button>
          )}
        </div>
        {isLive && (
          <p className="text-center text-[10px] text-primary mt-2 font-bold uppercase tracking-widest animate-pulse">
            {liveStatus}
          </p>
        )}
      </div>
    </div>
  );
};
