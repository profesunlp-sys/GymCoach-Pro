import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alumno } from '../types';
import { Button } from '../App';

interface BulkPaymentImportProps {
  alumnos: Alumno[];
  onConfirm: (updates: { alumnoId: string, name: string, month: string, year: number }[]) => void;
  onClose: () => void;
}

export const BulkPaymentImport: React.FC<BulkPaymentImportProps> = ({ alumnos, onConfirm, onClose }) => {
  const [text, setText] = useState('');
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [parsedResults, setParsedResults] = useState<{ alumnoId: string, name: string, month: string, year: number, status: 'found' | 'not_found' | 'ambiguous' }[]>([]);

  const handleParse = () => {
    // Basic regex-based parsing
    // Looking for blocks like "PAGOS MARZO 2026" and then names below it
    const lines = text.split('\n');
    let currentMonth = '';
    let currentYear = 0;
    const results: any[] = [];

    const monthMap: Record<string, string> = {
      'ENERO': 'Enero', 'FEBRERO': 'Febrero', 'MARZO': 'Marzo', 'ABRIL': 'Abril',
      'MAYO': 'Mayo', 'JUNIO': 'Junio', 'JULIO': 'Julio', 'AGOSTO': 'Agosto',
      'SEPTIEMBRE': 'Septiembre', 'OCTUBRE': 'Octubre', 'NOVIEMBRE': 'Noviembre', 'DICIEMBRE': 'Diciembre'
    };

    lines.forEach(line => {
      const upperLine = line.toUpperCase().trim();
      
      // Look for Month and Year
      const monthMatch = upperLine.match(/(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(\d{4})/);
      if (monthMatch) {
        currentMonth = monthMap[monthMatch[1]];
        currentYear = parseInt(monthMatch[2]);
        return;
      }

      if (currentMonth && currentYear && line.trim()) {
        // Assume names are single lines
        const name = line.trim();
        if (name.length < 3 || name.includes('📋') || name.includes('Gimnasia')) return;

        // Try to find alumno
        const matches = alumnos.filter(a => {
          const studentName = a.nombre.toLowerCase();
          const searchName = name.toLowerCase();
          // Match logic: searchName in studentName or vice versa or split match
          return studentName.includes(searchName) || searchName.includes(studentName);
        });

        if (matches.length === 1) {
          results.push({ alumnoId: matches[0].id!, name: matches[0].nombre, rawName: name, month: currentMonth, year: currentYear, status: 'found' });
        } else if (matches.length > 1) {
          results.push({ alumnoId: '', name: '', rawName: name, month: currentMonth, year: currentYear, status: 'ambiguous', matches });
        } else {
          results.push({ alumnoId: '', name: '', rawName: name, month: currentMonth, year: currentYear, status: 'not_found' });
        }
      }
    });

    setParsedResults(results);
    setStep('review');
  };

  const totals = {
    found: parsedResults.filter(r => r.status === 'found').length,
    missing: parsedResults.filter(r => r.status !== 'found').length
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-antigravity-black/80 backdrop-blur-xl"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-2xl bg-antigravity-charcoal border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Importar Pagos</h2>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Procesamiento Masivo</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-all">
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {step === 'input' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Pega la lista de pagos</label>
                <textarea 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="PAGOS MARZO 2026&#10;Juan Perez&#10;Maria Lopez..."
                  className="w-full h-80 bg-black/40 border border-white/10 rounded-3xl p-6 text-sm text-white font-mono outline-none focus:border-primary/40 transition-all resize-none placeholder:opacity-20"
                />
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-start gap-4">
                <span className="material-icons-outlined text-primary">info</span>
                <p className="text-[11px] text-white/70 leading-relaxed italic">
                  Asegúrate de que la lista incluya el mes y año (ej: "PAGOS ABRIL 2026") seguido de los nombres de los alumnos. El sistema intentará vincular cada nombre automáticamente.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-[1.5rem] p-4 border-emerald-500/20 bg-emerald-500/5">
                   <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Vinculados</p>
                   <p className="text-2xl font-black text-white ">{totals.found}</p>
                </div>
                <div className="glass-card rounded-[1.5rem] p-4 border-rose-500/20 bg-rose-500/5">
                   <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Sin Coincidencia</p>
                   <p className="text-2xl font-black text-white">{totals.missing}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Revision De Importación</h3>
                <div className="space-y-2">
                  {parsedResults.map((res, i) => (
                    <div key={i} className={`p-3 rounded-2xl border flex items-center justify-between ${res.status === 'found' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-white uppercase tracking-tight">{res.status === 'found' ? res.name : res.rawName}</span>
                        <span className="text-[8px] text-white/40 uppercase font-black">{res.month} {res.year}</span>
                      </div>
                      <div>
                        {res.status === 'found' ? (
                          <span className="material-icons-outlined text-emerald-500 text-sm">check_circle</span>
                        ) : res.status === 'ambiguous' ? (
                          <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded">Ambiguo</span>
                        ) : (
                          <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded">No Encontrado</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-white/5 bg-white/5 flex gap-4">
          {step === 'input' ? (
            <>
              <Button onClick={onClose} variant="secondary" className="flex-1 py-4 rounded-2xl">Cancelar</Button>
              <Button onClick={handleParse} disabled={!text.trim()} className="flex-2 py-4 rounded-2xl shadow-neon-cyan">Analizar Lista</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setStep('input')} variant="secondary" className="flex-1 py-4 rounded-2xl">Editar</Button>
              <Button 
                onClick={() => onConfirm(parsedResults.filter(r => r.status === 'found') as any)} 
                disabled={totals.found === 0} 
                className="flex-2 py-4 rounded-2xl shadow-neon-cyan"
              >
                Confirmar {totals.found} Pagos
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
