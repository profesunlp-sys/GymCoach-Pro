import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alumno } from '../../types';
import { Button } from '../../App';

interface BulkPaymentImportProps {
  isOpen: boolean;
  alumnos: Alumno[];
  onConfirm: (updates: { alumnoId: string, name: string, month: string, year: number }[]) => void;
  onClose: () => void;
}

type ParseMode = 'list' | 'csv';

interface ParsedResult {
  alumnoId: string;
  name: string;
  rawName: string;
  month: string;
  year: number;
  status: 'found' | 'not_found' | 'ambiguous';
  matches?: Alumno[];
}

// Normalize accented characters and punctuation for fuzzy matching
const normalize = (str: string): string =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

const monthMap: Record<string, string> = {
  'ENERO': 'Enero', 'FEBRERO': 'Febrero', 'MARZO': 'Marzo', 'ABRIL': 'Abril',
  'MAYO': 'Mayo', 'JUNIO': 'Junio', 'JULIO': 'Julio', 'AGOSTO': 'Agosto',
  'SEPTIEMBRE': 'Septiembre', 'OCTUBRE': 'Octubre', 'NOVIEMBRE': 'Noviembre', 'DICIEMBRE': 'Diciembre',
  'JANUARY': 'Enero', 'FEBRUARY': 'Febrero', 'MARCH': 'Marzo', 'APRIL': 'Abril',
  'MAY': 'Mayo', 'JUNE': 'Junio', 'JULY': 'Julio', 'AUGUST': 'Agosto',
  'SEPTEMBER': 'Septiembre', 'OCTOBER': 'Octubre', 'NOVEMBER': 'Noviembre', 'DECEMBER': 'Diciembre',
};

const matchStudent = (rawName: string, alumnos: Alumno[]): ParsedResult => {
  const searchNorm = normalize(rawName);
  const matches = alumnos.filter(a => {
    const studentNorm = normalize(a.nombre);
    return studentNorm.includes(searchNorm) || searchNorm.includes(studentNorm);
  });

  if (matches.length === 1) {
    return { alumnoId: matches[0].id!, name: matches[0].nombre, rawName, month: '', year: 0, status: 'found' };
  } else if (matches.length > 1) {
    return { alumnoId: '', name: '', rawName, month: '', year: 0, status: 'ambiguous', matches };
  }
  return { alumnoId: '', name: '', rawName, month: '', year: 0, status: 'not_found' };
};

const parseListFormat = (text: string, alumnos: Alumno[]): ParsedResult[] => {
  const lines = text.split('\n');
  let currentMonth = '';
  let currentYear = 0;
  const results: ParsedResult[] = [];

  lines.forEach(line => {
    const upperLine = line.toUpperCase().trim();
    const monthMatch = upperLine.match(
      /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})/
    );
    if (monthMatch) {
      currentMonth = monthMap[monthMatch[1]];
      currentYear = parseInt(monthMatch[2]);
      return;
    }

    if (currentMonth && currentYear && line.trim()) {
      const name = line.trim();
      // Skip obvious non-name lines
      if (name.length < 3 || /^[\d\s\W]+$/.test(name) || name.includes('📋') || name.toUpperCase().includes('PAGOS')) return;
      const match = matchStudent(name, alumnos);
      results.push({ ...match, month: currentMonth, year: currentYear });
    }
  });

  return results;
};

const parseCsvFormat = (text: string, alumnos: Alumno[]): ParsedResult[] => {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header row to find relevant columns
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  const nameIdx = headers.findIndex(h =>
    h.includes('nombre') || h.includes('name') || h.includes('alumno') || h.includes('apellido')
  );
  const monthIdx = headers.findIndex(h =>
    h.includes('mes') || h.includes('month') || h.includes('periodo') || h.includes('pago')
  );

  if (nameIdx === -1) return [];

  const results: ParsedResult[] = [];
  const now = new Date();
  const defaultMonth = Object.values(monthMap)[now.getMonth()];
  const defaultYear = now.getFullYear();

  lines.slice(1).forEach(line => {
    // Proper CSV parsing respecting quoted fields
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
      else { current += char; }
    }
    cols.push(current.trim());

    const rawName = (cols[nameIdx] || '').replace(/"/g, '').trim();
    if (!rawName || rawName.length < 2) return;

    let month = defaultMonth;
    let year = defaultYear;
    if (monthIdx !== -1) {
      const rawMonth = (cols[monthIdx] || '').toUpperCase().replace(/"/g, '').trim();
      const mMatch = rawMonth.match(
        /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)/
      );
      if (mMatch) month = monthMap[mMatch[1]];
      const yMatch = rawMonth.match(/(\d{4})/);
      if (yMatch) year = parseInt(yMatch[1]);
    }

    const match = matchStudent(rawName, alumnos);
    results.push({ ...match, month, year });
  });

  return results;
};

const detectMode = (text: string): ParseMode => {
  const firstLine = text.split('\n')[0] || '';
  // CSV files typically have comma-separated headers
  if ((firstLine.match(/,/g) || []).length >= 2) return 'csv';
  return 'list';
};

export const BulkPaymentImport: React.FC<BulkPaymentImportProps> = ({
  isOpen,
  alumnos,
  onConfirm,
  onClose
}) => {
  const [text, setText] = useState('');
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [parsedResults, setParsedResults] = useState<ParsedResult[]>([]);
  const [detectedMode, setDetectedMode] = useState<ParseMode>('list');

  const handleParse = () => {
    if (!text.trim()) return;
    const mode = detectMode(text);
    setDetectedMode(mode);
    const results = mode === 'csv'
      ? parseCsvFormat(text, alumnos)
      : parseListFormat(text, alumnos);
    setParsedResults(results);
    setStep('review');
  };

  const totals = {
    found: parsedResults.filter(r => r.status === 'found').length,
    missing: parsedResults.filter(r => r.status !== 'found').length
  };

  const handleClose = () => {
    setText('');
    setStep('input');
    setParsedResults([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-antigravity-black/80 backdrop-blur-md"
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
              <button onClick={handleClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-all">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {step === 'input' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">
                      Pega la lista o CSV de pagos
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={"PAGOS ABRIL 2026\nJuan Perez\nMaria Lopez...\n\n— O pegá un CSV exportado de Google Forms —"}
                      className="w-full h-80 bg-black/40 border border-white/10 rounded-3xl p-6 text-sm text-white font-mono outline-none focus:border-primary/40 transition-all resize-none placeholder:opacity-20"
                    />
                  </div>

                  {/* Format guide */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-primary text-sm">list</span>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Formato Lista</p>
                      </div>
                      <p className="text-[10px] text-white/50 leading-relaxed font-mono">PAGOS ABRIL 2026<br/>Juan Perez<br/>Maria Lopez</p>
                    </div>
                    <div className="bg-accent-purple/5 border border-accent-purple/15 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-accent-purple text-sm">table_chart</span>
                        <p className="text-[10px] font-black text-accent-purple uppercase tracking-widest">Google Forms CSV</p>
                      </div>
                      <p className="text-[10px] text-white/50 leading-relaxed font-mono">Marca de tiempo,Nombre,...<br/>2026-04-01,Juan Perez</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Mode badge */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${detectedMode === 'csv' ? 'bg-accent-purple/10 text-accent-purple border border-accent-purple/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                      <span className="material-icons-outlined text-[11px] mr-1 align-middle">{detectedMode === 'csv' ? 'table_chart' : 'list'}</span>
                      {detectedMode === 'csv' ? 'Modo CSV (Google Forms)' : 'Modo Lista de Texto'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card rounded-[1.5rem] p-4 border-emerald-500/20 bg-emerald-500/5">
                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Vinculados</p>
                      <p className="text-2xl font-black text-white">{totals.found}</p>
                    </div>
                    <div className="glass-card rounded-[1.5rem] p-4 border-rose-500/20 bg-rose-500/5">
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Sin Coincidencia</p>
                      <p className="text-2xl font-black text-white">{totals.missing}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Revisión de Importación</h3>
                    {parsedResults.length === 0 ? (
                      <div className="py-10 text-center text-white/30 italic text-sm">No se encontraron entradas válidas.</div>
                    ) : (
                      <div className="space-y-2">
                        {parsedResults.map((res, i) => (
                          <div key={i} className={`p-3 rounded-2xl border flex items-center justify-between ${res.status === 'found' ? 'bg-emerald-500/5 border-emerald-500/20' : res.status === 'ambiguous' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-white uppercase tracking-tight">
                                {res.status === 'found' ? res.name : res.rawName}
                              </span>
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
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-white/5 bg-white/5 flex gap-4">
              {step === 'input' ? (
                <>
                  <Button onClick={handleClose} variant="secondary" className="flex-1 py-4 rounded-2xl">Cancelar</Button>
                  <Button onClick={handleParse} disabled={!text.trim()} className="flex-2 py-4 rounded-2xl shadow-neon-cyan">Analizar Lista</Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setStep('input')} variant="secondary" className="flex-1 py-4 rounded-2xl">Editar</Button>
                  <Button
                    onClick={() => {
                      onConfirm(parsedResults.filter(r => r.status === 'found') as any);
                      handleClose();
                    }}
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
      )}
    </AnimatePresence>
  );
};
