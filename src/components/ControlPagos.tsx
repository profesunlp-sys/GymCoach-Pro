
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { db as firestore, auth } from '../../services/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { Alumno, ViewMode } from '../../types';
import { Button } from '../../App';

interface PagoGimnasia {
  id?: string;
  fechaPago: string;
  tramite: string;
  nombre: string;
  dni: string;
  importe: number;
  cuotas: number;
  observacionBase: string;
  deporte: string;
  matricula: string;
  mes: string;
  categoriaEdad: string;
  alumnaId?: string; // ID if matched
  verificado: boolean;
  timestamp: any;
}

interface ControlPagosProps {
  vista: ViewMode;
  setVista: (v: ViewMode) => void;
  alumnos: Alumno[];
}

export const ControlPagos: React.FC<ControlPagosProps> = ({ vista, setVista, alumnos }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [pagos, setPagos] = useState<PagoGimnasia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filters
  const [filterMes, setFilterMes] = useState('Todas');
  const [filterCategoria, setFilterCategoria] = useState('Todas');
  const [filterMatricula, setFilterMatricula] = useState('Todas');
  const [filterObservacion, setFilterObservacion] = useState('Todas');
  
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    fetchPagos();
  }, []);

  const fetchPagos = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(firestore, 'pagos_gimnasia'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PagoGimnasia));
      setPagos(data);
      
      const months = Array.from(new Set(data.map(p => p.mes))).sort();
      setAvailableMonths(months);
    } catch (error) {
      console.error("Error fetching pagos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeDeporte = (deporte: string) => {
    return (deporte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  };

  const isGimnasiaArtistica = (deporte: string) => {
    const normalized = normalizeDeporte(deporte);
    return normalized.includes('gimnasia artistica');
  };

  const detectCategory = (tramite: string) => {
    if (tramite.includes('3 a 5')) return '3 a 5 años';
    if (tramite.includes('6 a 9')) return '6 a 9 años';
    if (tramite.includes('10 a 15')) return '10 a 15 años';
    return 'Sin Categoría';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        // Process "PAGOS" sheet
        const ws = wb.Sheets['PAGOS'] || wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (data.length < 2) {
          alert("El archivo no tiene suficientes datos.");
          setIsImporting(false);
          return;
        }

        // Skip headers (Row 1)
        const rows = data.slice(1);
        let found = 0;
        let ignored = 0;
        let totalAmount = 0;
        const filteredPagos: PagoGimnasia[] = [];

        rows.forEach(row => {
          const deporteVal = String(row[7] || ''); // Col 8: Deporte
          
          if (isGimnasiaArtistica(deporteVal)) {
            const dni = String(row[3] || '').trim();
            const matchingAlumno = alumnos.find(a => a.dni === dni);
            
            const pago: PagoGimnasia = {
              fechaPago: String(row[0] || ''),
              tramite: String(row[1] || ''),
              nombre: String(row[2] || ''),
              dni: dni,
              importe: Number(row[4] || 0),
              cuotas: Number(row[5] || 0),
              observacionBase: String(row[6] || ''),
              deporte: deporteVal,
              matricula: String(row[8] || ''),
              mes: String(row[9] || ''),
              categoriaEdad: detectCategory(String(row[1] || '')),
              alumnaId: matchingAlumno?.id,
              verificado: !!matchingAlumno,
              timestamp: Timestamp.now()
            };
            
            filteredPagos.push(pago);
            totalAmount += pago.importe;
            found++;
          } else {
            ignored++;
          }
        });

        if (found === 0) {
          alert("No se encontraron pagos de Gimnasia Artística en este archivo.");
          setIsImporting(false);
          return;
        }

        // Check for existing data of the same month
        const monthsInFile = Array.from(new Set(filteredPagos.map(p => p.mes)));
        const q = query(collection(firestore, 'pagos_gimnasia'), where('mes', 'in', monthsInFile));
        const existingSnapshot = await getDocs(q);
        
        if (!existingSnapshot.empty) {
          const proceed = window.confirm(`Ya existen registros para el mes ${monthsInFile.join(', ')}. ¿Deseas sobreescribir los datos existentes?`);
          if (!proceed) {
            setIsImporting(false);
            return;
          }
          
          // Delete existing for these months if overwriting
          const deleteBatch = writeBatch(firestore);
          existingSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
          await deleteBatch.commit();
        }

        // Save to Firebase
        const batch = writeBatch(firestore);
        for (const pago of filteredPagos) {
          const newDocRef = doc(collection(firestore, 'pagos_gimnasia'));
          batch.set(newDocRef, pago);
          
          // If verified, update alumno status
          if (pago.alumnaId) {
            const alumnoRef = doc(firestore, 'alumnos', pago.alumnaId);
            batch.update(alumnoRef, { 
              estadoPago: 'Al día',
              observacionesPagos: `Pago verificado - ${pago.mes}` 
            });
          }
        }
        
        await batch.commit();
        
        setImportSummary({
          found,
          ignored,
          totalAmount,
          months: Array.from(new Set(filteredPagos.map(p => p.mes))).join(', ')
        });
        
        fetchPagos();
      } catch (error) {
        console.error("Error processing Excel:", error);
        alert("Ocurrió un error al procesar el archivo.");
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const filteredPagos = pagos.filter(p => {
    const matchMes = filterMes === 'Todas' || p.mes === filterMes;
    const matchCat = filterCategoria === 'Todas' || p.categoriaEdad === filterCategoria;
    const matchMat = filterMatricula === 'Todas' || 
                    (filterMatricula === 'Pagó matrícula' && p.matricula === 'SI') ||
                    (filterMatricula === 'No pagó matrícula' && p.matricula === 'NO');
    const matchObs = filterObservacion === 'Todas' ||
                    (filterObservacion === 'Con observaciones' && p.observacionBase && p.observacionBase !== '') ||
                    (filterObservacion === 'Sin observaciones' && (!p.observacionBase || p.observacionBase === ''));
    return matchMes && matchCat && matchMat && matchObs;
  });

  const totals = {
    amount: filteredPagos.reduce((sum, p) => sum + p.importe, 0),
    count: filteredPagos.length,
    matriculaSi: filteredPagos.filter(p => p.matricula === 'SI').length,
    matriculaNo: filteredPagos.filter(p => p.matricula === 'NO').length,
    conObservacion: filteredPagos.filter(p => p.observacionBase.includes('no corresponden')).length,
    verificadas: filteredPagos.filter(p => p.verificado).length,
    noVerificadas: filteredPagos.filter(p => !p.verificado).length
  };

  const exportFilteredToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredPagos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos Filtrados");
    XLSX.writeFile(wb, `Pagos_Gimnasia_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (vista !== 'ControlPagos') return null;

  return (
    <div className="px-6 py-8 space-y-8 page-transition pb-24 max-w-[1200px] mx-auto">
      <header className="flex items-center gap-4">
        <button onClick={() => setVista('Dashboard')} className="w-10 h-10 rounded-full bg-antigravity-charcoal flex items-center justify-center text-primary border border-white/5 active:scale-90 transition-all">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Control de Pagos</h2>
          <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Gimnasia Artística Infantil</p>
        </div>
        {!importSummary && (
          <div className="ml-auto relative">
            <input 
              type="file" 
              accept=".xlsx" 
              onChange={handleFileUpload} 
              id="excel-upload" 
              className="hidden"
            />
            <label 
              htmlFor="excel-upload"
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-xl text-primary text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-primary/20 transition-all shadow-neon-cyan"
            >
              <span className="material-icons-outlined text-sm">upload_file</span>
              Importar Mensual
            </label>
          </div>
        )}
      </header>

      {isImporting && (
        <div className="glass-card rounded-[2rem] p-12 flex flex-col items-center justify-center space-y-4 border border-primary/20 bg-primary/5">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-primary text-[10px] font-black uppercase tracking-widest animate-pulse">Procesando registros de Gimnasia...</p>
        </div>
      )}

      {importSummary && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[2rem] p-8 border border-emerald-500/30 bg-emerald-500/5 space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
                <span className="material-icons-outlined">check_circle</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Importación Exitosa</h3>
                <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">{importSummary.months}</p>
              </div>
            </div>
            <button onClick={() => setImportSummary(null)} className="text-white/30 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">Cerrar Resumen</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest mb-1">Gimnasia Artística</p>
              <p className="text-2xl font-black text-emerald-400">{importSummary.found}</p>
              <p className="text-[8px] text-white/20 uppercase font-medium mt-1">Registros cargados</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest mb-1">Otros Deportes</p>
              <p className="text-2xl font-black text-white/50">{importSummary.ignored}</p>
              <p className="text-[8px] text-white/20 uppercase font-medium mt-1">Registros ignorados</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest mb-1">Total Recaudado</p>
              <p className="text-2xl font-black text-primary">${importSummary.totalAmount.toLocaleString()}</p>
              <p className="text-[8px] text-white/20 uppercase font-medium mt-1">Solo gimnasia</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest mb-1">Vinculadas</p>
              <p className="text-2xl font-black text-white">{importSummary.found} / {importSummary.found}</p>
              <p className="text-[8px] text-white/20 uppercase font-medium mt-1">Sincronización autom.</p>
            </div>
          </div>
        </motion.div>
      )}

      {!importSummary && !isImporting && pagos.length > 0 && (
        <div className="space-y-8">
          {/* Dashboard Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-6 rounded-[2rem] border border-primary/20 bg-primary/5 space-y-2">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary mb-2">
                <span className="material-icons-outlined">payments</span>
              </div>
              <p className="text-[9px] font-black text-primary uppercase tracking-widest">Total Recaudado</p>
              <h3 className="text-3xl font-black text-white">${totals.amount.toLocaleString()}</h3>
              <p className="text-[9px] text-white/30 uppercase font-bold">{totals.count} pagos este mes</p>
            </div>

            <div className="glass-card p-6 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 space-y-2">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 mb-2">
                <span className="material-icons-outlined">assignment_turned_in</span>
              </div>
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Matrículas Pagas</p>
              <h3 className="text-3xl font-black text-white">{totals.matriculaSi}</h3>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 shadow-neon-cyan" 
                  style={{ width: `${(totals.matriculaSi / totals.count) * 100}%` }}
                ></div>
              </div>
              <p className="text-[9px] text-white/30 uppercase font-bold">{totals.matriculaNo} Pendientes</p>
            </div>

            <div className="glass-card p-6 rounded-[2rem] border border-rose-500/20 bg-rose-500/5 space-y-2">
              <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-500 mb-2">
                <span className="material-icons-outlined">report_problem</span>
              </div>
              <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Alertas de Datos</p>
              <h3 className="text-3xl font-black text-white">{totals.conObservacion}</h3>
              <p className="text-[9px] text-white/30 uppercase font-bold">Datos no corresponden</p>
            </div>

            <div className="glass-card p-6 rounded-[2rem] border border-amber-500/20 bg-amber-500/5 space-y-2">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 mb-2">
                <span className="material-icons-outlined">sync_disabled</span>
              </div>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Sin Coincidencia</p>
              <h3 className="text-3xl font-black text-white">{totals.noVerificadas}</h3>
              <p className="text-[9px] text-white/30 uppercase font-bold">Requiere gestión manual</p>
            </div>
          </div>

          {/* Filtering Bar */}
          <section className="glass-card p-4 rounded-3xl border border-white/5 bg-white/2 flex flex-wrap gap-4 items-center">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-[8px] font-black text-white/40 uppercase tracking-widest ml-1">Filtrar por Mes</label>
              <select 
                value={filterMes}
                onChange={(e) => setFilterMes(e.target.value)}
                className="bg-antigravity-black border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-primary/40 transition-all"
              >
                <option value="Todas">Todos los Meses</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-[8px] font-black text-white/40 uppercase tracking-widest ml-1">Categoría</label>
              <select 
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="bg-antigravity-black border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-primary/40 transition-all"
              >
                <option value="Todas">Todas</option>
                <option value="3 a 5 años">3 a 5 años</option>
                <option value="6 a 9 años">6 a 9 años</option>
                <option value="10 a 15 años">10 a 15 años</option>
                <option value="Sin Categoría">Sin Categoría</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-[8px] font-black text-white/40 uppercase tracking-widest ml-1">Matrícula</label>
              <select 
                value={filterMatricula}
                onChange={(e) => setFilterMatricula(e.target.value)}
                className="bg-antigravity-black border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-primary/40 transition-all"
              >
                <option value="Todas">Todas</option>
                <option value="Pagó matrícula">Pagó Matrícula</option>
                <option value="No pagó matrícula">No Pagó</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-[8px] font-black text-white/40 uppercase tracking-widest ml-1">Alertas</label>
              <select 
                value={filterObservacion}
                onChange={(e) => setFilterObservacion(e.target.value)}
                className="bg-antigravity-black border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-primary/40 transition-all"
              >
                <option value="Todas">Todas</option>
                <option value="Con observaciones">Con Observaciones</option>
                <option value="Sin observaciones">Sin Observaciones</option>
              </select>
            </div>

            <button 
              onClick={exportFilteredToExcel}
              className="mt-auto h-10 px-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-2"
            >
              <span className="material-icons-outlined text-sm">download</span>
              Exportar
            </button>
          </section>

          {/* Desglose por Edad */}
          <section className="glass-card rounded-[2rem] border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-white/2 flex justify-between items-center">
               <h3 className="text-xs font-black text-white uppercase tracking-widest px-2">Desglose por Categoría de Edad</h3>
               <div className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Resultados Filtrados</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white/2 text-[10px] font-black uppercase tracking-widest text-white/40">
                  <tr>
                    <th className="px-8 py-4">Categoría</th>
                    <th className="px-8 py-4">Cantidad</th>
                    <th className="px-8 py-4">Total Recaudado</th>
                    <th className="px-8 py-4">Con Matrícula</th>
                    <th className="px-8 py-4">Sin Matrícula</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] text-white/80 font-medium whitespace-nowrap">
                  {['3 a 5 años', '6 a 9 años', '10 a 15 años', 'Sin Categoría'].map(cat => {
                    const catPagos = filteredPagos.filter(p => p.categoriaEdad === cat);
                    if (catPagos.length === 0) return null;
                    return (
                      <tr key={cat} className="border-t border-white/5 hover:bg-white/5 transition-all">
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${cat === '3 a 5 años' ? 'bg-cyan-500/10 text-cyan-400' : cat === '6 a 9 años' ? 'bg-purple-500/10 text-purple-400' : cat === '10 a 15 años' ? 'bg-pink-500/10 text-pink-400' : 'bg-white/5 text-white/40'}`}>
                            {cat}
                          </span>
                        </td>
                        <td className="px-8 py-5 font-black text-white">{catPagos.length}</td>
                        <td className="px-8 py-5 text-primary font-black">${catPagos.reduce((sum, p) => sum + p.importe, 0).toLocaleString()}</td>
                        <td className="px-8 py-5 text-emerald-400 font-bold">{catPagos.filter(p => p.matricula === 'SI').length}</td>
                        <td className="px-8 py-5 text-rose-500 font-bold">{catPagos.filter(p => p.matricula === 'NO').length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Table List of Payments */}
          <section className="glass-card rounded-[2rem] border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-white/2 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="material-icons-outlined text-primary">groups</span>
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Listado de Alumnas Gimnasia Artística</h3>
              </div>
              <div className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Mostrando {filteredPagos.length} registros</div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white/2 text-[10px] font-black uppercase tracking-widest text-white/40">
                  <tr>
                    <th className="px-8 py-4">Apellido y Nombre</th>
                    <th className="px-8 py-4">DNI</th>
                    <th className="px-8 py-4">Fecha Pago</th>
                    <th className="px-8 py-4">Importe</th>
                    <th className="px-8 py-4">Matrícula</th>
                    <th className="px-8 py-4">Estado App</th>
                    <th className="px-8 py-4">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] text-white/80 font-medium whitespace-nowrap">
                  {filteredPagos.map((pago, i) => (
                    <tr key={pago.id || i} className={`border-t border-white/5 hover:bg-white/5 transition-all ${pago.observacionBase.includes('no corresponden') ? 'bg-rose-500/5' : ''}`}>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <p className="font-black text-white uppercase tracking-tight">{pago.nombre}</p>
                          <p className="text-[8px] text-white/30 uppercase font-black">{pago.categoriaEdad}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5 font-mono text-white/60">{pago.dni}</td>
                      <td className="px-8 py-5 text-white/40">{pago.fechaPago}</td>
                      <td className="px-8 py-5 font-black text-primary">${pago.importe.toLocaleString()}</td>
                      <td className="px-8 py-5">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${pago.matricula === 'SI' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {pago.matricula === 'SI' ? 'Pagada' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        {pago.verificado ? (
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <span className="material-icons-outlined text-[10px]">verified</span>
                            <span className="text-[9px] font-black uppercase tracking-widest">Al día</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <span className="material-icons-outlined text-[10px]">help_outline</span>
                            <span className="text-[9px] font-black uppercase tracking-widest">Sin Registro</span>
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-5">
                        {pago.observacionBase && (
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-bold ${pago.observacionBase.includes('no corresponden') ? 'text-rose-500 bg-rose-500/10' : 'text-white/40 bg-white/5'}`}>
                            {pago.observacionBase}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pagos sin Alumna Registrada (Sección Alertas DNI) */}
          {totals.noVerificadas > 0 && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-[2rem] border border-amber-500/30 bg-amber-500/2 overflow-hidden"
            >
              <div className="p-6 border-b border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
                <span className="material-icons-outlined text-amber-500">warning</span>
                <div>
                   <h3 className="text-xs font-black text-white uppercase tracking-widest">Pagos sin Alumna Registrada en la App</h3>
                   <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest">Estos DNIs no coinciden con ninguna gimnasta del sistema</p>
                </div>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {filteredPagos.filter(p => !p.verificado).map((p, i) => (
                     <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/40 transition-all flex justify-between items-center group">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-white uppercase">{p.nombre}</p>
                          <p className="text-[9px] font-mono text-white/40">DNI: {p.dni}</p>
                        </div>
                        <Button 
                          onClick={() => setVista('Alumnos')}
                          variant="ghost" 
                          className="w-8 h-8 !p-0 rounded-lg group-hover:text-primary transition-colors"
                        >
                          <span className="material-icons-outlined text-sm">person_add</span>
                        </Button>
                     </div>
                   ))}
                </div>
              </div>
            </motion.section>
          )}

          {/* Alertas de Datos Incorrectos (PII/Observaciones) */}
          {totals.conObservacion > 0 && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-[2rem] border border-rose-500/30 bg-rose-500/2 overflow-hidden"
            >
              <div className="p-6 border-b border-rose-500/20 bg-rose-500/5 flex items-center gap-3">
                <span className="material-icons-outlined text-rose-500">dangerous</span>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Registros Erróneos (Alerta de Oficina de Pagos)</h3>
                  <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest">Observación: "Los datos no corresponden al beneficiario"</p>
                </div>
              </div>
              <div className="p-8">
                <div className="space-y-3">
                  {filteredPagos.filter(p => p.observacionBase.includes('no corresponden')).map((p, i) => (
                    <div key={i} className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500">
                           <span className="material-icons-outlined text-sm">error_outline</span>
                         </div>
                         <div>
                            <p className="text-xs font-black text-white uppercase">{p.nombre}</p>
                            <p className="text-[10px] text-white/40">{p.categoriaEdad} • DNI: {p.dni} • Mes: {p.mes}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Revisión Urgente</p>
                         <p className="text-[9px] text-white/30">{p.fechaPago}</p>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}
        </div>
      )}

      {pagos.length === 0 && !isImporting && !importSummary && (
        <div className="glass-card rounded-[2.5rem] p-20 text-center space-y-8 border border-white/5">
          <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5 shadow-2xl">
            <span className="material-icons-outlined text-[64px] text-white/10">payments</span>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">No hay pagos importados</h3>
            <p className="text-white/40 text-sm max-w-sm mx-auto">Importá el archivo Excel mensual para gestionar los pagos de Gimnasia Artística.</p>
          </div>
          <div className="relative inline-block">
            <input 
              type="file" 
              accept=".xlsx" 
              onChange={handleFileUpload} 
              id="excel-upload-empty" 
              className="hidden"
            />
            <label 
              htmlFor="excel-upload-empty"
              className="flex items-center gap-3 px-8 py-5 bg-primary text-antigravity-black font-black uppercase tracking-[0.2em] rounded-[2rem] cursor-pointer shadow-neon-cyan hover:scale-105 active:scale-95 transition-all"
            >
              <span className="material-icons-outlined">upload_file</span>
              Subir Archivo Excel
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
