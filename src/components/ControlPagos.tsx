
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
    <div className="min-h-screen bg-ios-gray px-6 py-8 space-y-8 page-transition pb-24 max-w-[1200px] mx-auto focus-mode-parent">
      <header className="flex items-center gap-4">
        <button onClick={() => setVista('Dashboard')} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-secondary shadow-sm border border-black/5 active:scale-95 transition-all">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight leading-none">Control de Pagos</h2>
          <p className="text-secondary text-[10px] font-bold uppercase tracking-widest mt-1">Gimnasia Artística Infantil</p>
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
              className="flex items-center gap-2 px-6 py-3 bg-ios-blue text-white rounded-full text-[10px] font-bold uppercase tracking-widest cursor-pointer shadow-lg active:scale-95 transition-all"
            >
              <span className="material-icons-outlined text-sm">upload_file</span>
              Importar Mensual
            </label>
          </div>
        )}
      </header>

      {/* Instrucciones de Uso */}
      <section className="bg-white rounded-[2rem] p-8 shadow-ios border border-black/5 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-ios-blue/10 rounded-2xl flex items-center justify-center text-ios-blue">
            <span className="material-icons-outlined text-2xl">info</span>
          </div>
          <h3 className="text-lg font-bold text-black tracking-tight">Guía de Uso</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-3xl bg-ios-gray space-y-2">
            <div className="text-ios-blue text-[10px] font-bold uppercase tracking-widest">1. SUBIR EXCEL</div>
            <p className="text-xs text-secondary leading-relaxed">Cargá el archivo mensual con los pagos de <span className="text-black font-bold">todos los deportes</span>.</p>
          </div>
          <div className="p-5 rounded-3xl bg-ios-gray space-y-2">
            <div className="text-ios-blue text-[10px] font-bold uppercase tracking-widest">2. FILTRADO AUTO</div>
            <p className="text-xs text-secondary leading-relaxed">La app detectará solo los registros de <span className="text-black font-bold">"Gimnasia Artística"</span>.</p>
          </div>
          <div className="p-5 rounded-3xl bg-ios-gray space-y-2">
            <div className="text-ios-blue text-[10px] font-bold uppercase tracking-widest">3. SINCRO AUTO</div>
            <p className="text-xs text-secondary leading-relaxed">Si el DNI coincide, la alumna se marcará como <span className="text-ios-green font-bold">"Al Día"</span>.</p>
          </div>
        </div>
      </section>

      {isImporting && (
        <div className="bg-white rounded-[2.5rem] p-12 flex flex-col items-center justify-center space-y-4 shadow-ios border border-black/5">
          <div className="w-12 h-12 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
          <p className="text-ios-blue text-[10px] font-bold uppercase tracking-widest animate-pulse">Procesando registros de Gimnasia...</p>
        </div>
      )}

      {importSummary && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-ios-green/5 rounded-[2.5rem] p-8 border border-ios-green/20 space-y-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-ios-green/20 rounded-2xl flex items-center justify-center text-ios-green">
                <span className="material-icons-outlined text-3xl">check_circle</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-black tracking-tight">Importación Exitosa</h3>
                <p className="text-ios-green text-[10px] font-bold uppercase tracking-widest">{importSummary.months}</p>
              </div>
            </div>
            <button onClick={() => setImportSummary(null)} className="text-secondary hover:text-black transition-all text-[10px] font-bold uppercase tracking-widest">Cerrar Resumen</button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mb-1">Gimnasia</p>
              <p className="text-3xl font-bold text-ios-green tracking-tight">{importSummary.found}</p>
              <p className="text-[8px] text-secondary/60 uppercase font-bold mt-1">Registros cargados</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mb-1">Otros</p>
              <p className="text-3xl font-bold text-black/40 tracking-tight">{importSummary.ignored}</p>
              <p className="text-[8px] text-secondary/60 uppercase font-bold mt-1">Registros ignorados</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mb-1">Recaudado</p>
              <p className="text-3xl font-bold text-ios-blue tracking-tight">${importSummary.totalAmount.toLocaleString()}</p>
              <p className="text-[8px] text-secondary/60 uppercase font-bold mt-1">Solo gimnasia</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mb-1">Sincronización</p>
              <p className="text-3xl font-bold text-black tracking-tight">Auto</p>
              <p className="text-[8px] text-secondary/60 uppercase font-bold mt-1">Base de Gimnasia</p>
            </div>
          </div>
        </motion.div>
      )}

      {!importSummary && !isImporting && pagos.length > 0 && (
        <div className="space-y-8">
          {/* Dashboard Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-ios space-y-4">
              <div className="w-11 h-11 bg-ios-blue/10 rounded-2xl flex items-center justify-center text-ios-blue">
                <span className="material-icons-outlined">payments</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Total Recaudado</p>
                <h3 className="text-3xl font-bold text-black tracking-tight">${totals.amount.toLocaleString()}</h3>
              </div>
              <p className="text-[10px] text-ios-blue font-bold uppercase">{totals.count} pagos registrados</p>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-ios space-y-4">
              <div className="w-11 h-11 bg-ios-green/10 rounded-2xl flex items-center justify-center text-ios-green">
                <span className="material-icons-outlined">assignment_turned_in</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Matrículas Pagas</p>
                <h3 className="text-3xl font-bold text-black tracking-tight">{totals.matriculaSi}</h3>
              </div>
              <div className="w-full h-1.5 bg-ios-gray rounded-full overflow-hidden">
                <div 
                  className="h-full bg-ios-green" 
                  style={{ width: `${(totals.matriculaSi / totals.count) * 100}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-secondary font-bold uppercase">{totals.matriculaNo} Pendientes</p>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-ios space-y-4">
              <div className="w-11 h-11 bg-ios-red/10 rounded-2xl flex items-center justify-center text-ios-red">
                <span className="material-icons-outlined">report_problem</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Alertas de Datos</p>
                <h3 className="text-3xl font-bold text-black tracking-tight">{totals.conObservacion}</h3>
              </div>
              <p className="text-[10px] text-ios-red font-bold uppercase">Datos no corresponden</p>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-ios space-y-4">
              <div className="w-11 h-11 bg-ios-orange/10 rounded-2xl flex items-center justify-center text-ios-orange">
                <span className="material-icons-outlined">sync_disabled</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Sin Coincidencia</p>
                <h3 className="text-3xl font-bold text-black tracking-tight">{totals.noVerificadas}</h3>
              </div>
              <p className="text-[10px] text-ios-orange font-bold uppercase">Requiere gestión manual</p>
            </div>
          </div>

          {/* Filtering Bar */}
          <section className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm flex flex-wrap gap-6 items-center">
            <div className="flex flex-col gap-2 flex-1 min-w-[160px]">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Mes</label>
              <select 
                value={filterMes}
                onChange={(e) => setFilterMes(e.target.value)}
                className="bg-ios-gray border-none rounded-xl px-4 py-3 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all cursor-pointer"
              >
                <option value="Todas">Todos los Meses</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 flex-1 min-w-[160px]">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Categoría</label>
              <select 
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="bg-ios-gray border-none rounded-xl px-4 py-3 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all cursor-pointer"
              >
                <option value="Todas">Todas</option>
                <option value="3 a 5 años">3 a 5 años</option>
                <option value="6 a 9 años">6 a 9 años</option>
                <option value="10 a 15 años">10 a 15 años</option>
                <option value="Sin Categoría">Sin Categoría</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 flex-1 min-w-[160px]">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Matrícula</label>
              <select 
                value={filterMatricula}
                onChange={(e) => setFilterMatricula(e.target.value)}
                className="bg-ios-gray border-none rounded-xl px-4 py-3 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all cursor-pointer"
              >
                <option value="Todas">Todas</option>
                <option value="Pagó matrícula">Pagó Matrícula</option>
                <option value="No pagó matrícula">No Pagó</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 flex-1 min-w-[160px]">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Alertas</label>
              <select 
                value={filterObservacion}
                onChange={(e) => setFilterObservacion(e.target.value)}
                className="bg-ios-gray border-none rounded-xl px-4 py-3 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all cursor-pointer"
              >
                <option value="Todas">Todas</option>
                <option value="Con observaciones">Con Observaciones</option>
                <option value="Sin observaciones">Sin Observaciones</option>
              </select>
            </div>

            <button 
              onClick={exportFilteredToExcel}
              className="mt-6 h-12 px-6 bg-ios-blue/10 text-ios-blue rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-ios-blue hover:text-white transition-all flex items-center gap-2 shadow-sm"
            >
              <span className="material-icons-outlined text-sm">download</span>
              Exportar
            </button>
          </section>

          {/* Desglose por Edad */}
          <section className="bg-white rounded-[2.5rem] border border-black/5 shadow-ios overflow-hidden">
            <div className="p-8 border-b border-black/5 bg-ios-gray/30 flex justify-between items-center">
               <h3 className="text-xs font-bold text-black uppercase tracking-widest px-2">Desglose por Categoría</h3>
               <div className="text-[10px] text-secondary font-bold uppercase tracking-widest">{filteredPagos.length} registros filtrados</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-ios-gray/50 text-[10px] font-bold uppercase tracking-widest text-secondary">
                  <tr>
                    <th className="px-8 py-5">Categoría</th>
                    <th className="px-8 py-5">Cantidad</th>
                    <th className="px-8 py-5">Total Recaudado</th>
                    <th className="px-8 py-5">Con Matrícula</th>
                    <th className="px-8 py-5">Sin Matrícula</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-secondary font-medium whitespace-nowrap">
                  {['3 a 5 años', '6 a 9 años', '10 a 15 años', 'Sin Categoría'].map(cat => {
                    const catPagos = filteredPagos.filter(p => p.categoriaEdad === cat);
                    if (catPagos.length === 0) return null;
                    return (
                      <tr key={cat} className="border-t border-black/5 hover:bg-ios-gray/20 transition-all">
                        <td className="px-8 py-6">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${cat === '3 a 5 años' ? 'bg-ios-blue/10 text-ios-blue' : cat === '6 a 9 años' ? 'bg-purple-500/10 text-purple-600' : cat === '10 a 15 años' ? 'bg-pink-500/10 text-pink-600' : 'bg-ios-gray text-secondary'}`}>
                            {cat}
                          </span>
                        </td>
                        <td className="px-8 py-6 font-bold text-black">{catPagos.length}</td>
                        <td className="px-8 py-6 text-ios-blue font-bold tracking-tight">${catPagos.reduce((sum, p) => sum + p.importe, 0).toLocaleString()}</td>
                        <td className="px-8 py-6 text-ios-green font-bold">{catPagos.filter(p => p.matricula === 'SI').length}</td>
                        <td className="px-8 py-6 text-ios-red font-bold">{catPagos.filter(p => p.matricula === 'NO').length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Table List of Payments */}
          <section className="bg-white rounded-[2.5rem] border border-black/5 shadow-ios overflow-hidden">
            <div className="p-8 border-b border-black/5 bg-ios-gray/30 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="material-icons-outlined text-ios-blue">groups</span>
                <h3 className="text-xs font-bold text-black uppercase tracking-widest">Listado de Pagos</h3>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-ios-gray/50 text-[10px] font-bold uppercase tracking-widest text-secondary">
                  <tr>
                    <th className="px-8 py-5">Alumno</th>
                    <th className="px-8 py-5">Identificación</th>
                    <th className="px-8 py-5">Fecha</th>
                    <th className="px-8 py-5">Importe</th>
                    <th className="px-8 py-5">Matrícula</th>
                    <th className="px-8 py-5">Estado</th>
                    <th className="px-8 py-5">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-secondary font-medium whitespace-nowrap">
                  {filteredPagos.map((pago, i) => (
                    <tr key={pago.id || i} className={`border-t border-black/5 hover:bg-ios-gray/20 transition-all ${pago.observacionBase.includes('no corresponden') ? 'bg-ios-red/5' : ''}`}>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <p className="font-bold text-black tracking-tight">{pago.nombre}</p>
                          <p className="text-[10px] text-secondary font-bold uppercase tracking-widest opacity-60">{pago.categoriaEdad}</p>
                        </div>
                      </td>
                      <td className="px-8 py-6 font-mono text-xs text-secondary/60">{pago.dni}</td>
                      <td className="px-8 py-6 text-xs text-secondary/60">{pago.fechaPago}</td>
                      <td className="px-8 py-6 font-bold text-black">${pago.importe.toLocaleString()}</td>
                      <td className="px-8 py-6">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest ${pago.matricula === 'SI' ? 'bg-ios-green/10 text-ios-green' : 'bg-ios-red/10 text-ios-red'}`}>
                          {pago.matricula === 'SI' ? 'Paga' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        {pago.verificado ? (
                          <div className="flex items-center gap-1.5 text-ios-green">
                            <span className="material-icons-outlined text-sm">verified</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Al día</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-ios-orange">
                            <span className="material-icons-outlined text-sm">help_outline</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Sin Registro</span>
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        {pago.observacionBase && (
                          <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${pago.observacionBase.includes('no corresponden') ? 'text-ios-red bg-ios-red/10' : 'text-secondary bg-ios-gray'}`}>
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

          {/* Pagos sin Alumna Registrada */}
          {totals.noVerificadas > 0 && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-ios-orange/5 rounded-[2.5rem] border border-ios-orange/20 overflow-hidden"
            >
              <div className="p-8 border-b border-ios-orange/20 bg-ios-orange/10 flex items-center gap-4">
                <span className="material-icons-outlined text-ios-orange text-3xl">warning</span>
                <div>
                   <h3 className="text-lg font-bold text-black tracking-tight">Pagos sin Alumna Registrada</h3>
                   <p className="text-[10px] text-ios-orange font-bold uppercase tracking-widest">Estos DNIs no coinciden con ninguna gimnasta del sistema</p>
                </div>
              </div>
              <div className="p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {filteredPagos.filter(p => !p.verificado).map((p, i) => (
                     <div key={i} className="p-6 rounded-3xl bg-white border border-black/5 hover:border-ios-blue/40 transition-all flex justify-between items-center group shadow-sm">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-black tracking-tight">{p.nombre}</p>
                          <p className="text-[10px] font-mono text-secondary">DNI: {p.dni}</p>
                        </div>
                        <Button 
                          onClick={() => setVista('Alumnos')}
                          className="w-10 h-10 !p-0 rounded-full bg-ios-gray text-secondary group-hover:bg-ios-blue group-hover:text-white transition-all shadow-sm"
                        >
                          <span className="material-icons-outlined text-lg">person_add</span>
                        </Button>
                     </div>
                   ))}
                </div>
              </div>
            </motion.section>
          )}

          {/* Alertas de Datos Incorrectos */}
          {totals.conObservacion > 0 && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-ios-red/5 rounded-[2.5rem] border border-ios-red/20 overflow-hidden"
            >
              <div className="p-8 border-b border-ios-red/20 bg-ios-red/10 flex items-center gap-4">
                <span className="material-icons-outlined text-ios-red text-3xl">dangerous</span>
                <div>
                  <h3 className="text-lg font-bold text-black tracking-tight">Registros con Errores</h3>
                  <p className="text-[10px] text-ios-red font-bold uppercase tracking-widest">Observación: "Los datos no corresponden al beneficiario"</p>
                </div>
              </div>
              <div className="p-10">
                <div className="space-y-4">
                  {filteredPagos.filter(p => p.observacionBase.includes('no corresponden')).map((p, i) => (
                    <div key={i} className="p-6 rounded-3xl bg-white border border-black/5 flex items-center justify-between shadow-sm">
                       <div className="flex items-center gap-5">
                         <div className="w-12 h-12 rounded-2xl bg-ios-red/10 flex items-center justify-center text-ios-red">
                           <span className="material-icons-outlined text-2xl">error_outline</span>
                         </div>
                         <div>
                            <p className="text-base font-bold text-black tracking-tight">{p.nombre}</p>
                            <p className="text-xs text-secondary">{p.categoriaEdad} • DNI: {p.dni} • Mes: {p.mes}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] font-bold text-ios-red uppercase tracking-widest">Revisión Urgente</p>
                         <p className="text-[10px] text-secondary font-bold">{p.fechaPago}</p>
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
        <div className="bg-white rounded-[3rem] p-24 text-center space-y-10 border border-black/5 shadow-ios">
          <div className="w-40 h-40 bg-ios-gray rounded-full flex items-center justify-center mx-auto shadow-inner">
            <span className="material-icons-outlined text-6xl text-secondary/30">payments</span>
          </div>
          <div className="space-y-3">
            <h3 className="text-3xl font-bold text-black tracking-tight">Sin registros de pago</h3>
            <p className="text-secondary text-sm max-w-sm mx-auto">Subí el archivo Excel mensual para comenzar a gestionar los pagos de las gimnastas.</p>
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
              className="flex items-center gap-4 px-10 py-5 bg-ios-blue text-white font-bold uppercase tracking-widest rounded-full cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all"
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
