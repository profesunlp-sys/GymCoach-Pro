import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Alumno } from '../../types';
import { motion } from 'motion/react';

interface ControlPagosProps {
  onBack: () => void;
  onImportPayments: () => void;
}

export const ControlPagos: React.FC<ControlPagosProps> = ({ onBack, onImportPayments }) => {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [debugAlumnoId, setDebugAlumnoId] = useState<string | null>(null);

  const years = [2024, 2025, 2026, 2027];
  // Temporada activa: Marzo → Noviembre (9 meses)
  const meses = [
    { n: 3,  name: 'Mar', label: 'Marzo' },
    { n: 4,  name: 'Abr', label: 'Abril' },
    { n: 5,  name: 'May', label: 'Mayo' },
    { n: 6,  name: 'Jun', label: 'Junio' },
    { n: 7,  name: 'Jul', label: 'Julio' },
    { n: 8,  name: 'Ago', label: 'Agosto' },
    { n: 9,  name: 'Sep', label: 'Septiembre' },
    { n: 10, name: 'Oct', label: 'Octubre' },
    { n: 11, name: 'Nov', label: 'Noviembre' },
  ];

  useEffect(() => {
    const unsubAlumnos = onSnapshot(collection(db, 'alumnos'), (snapshot) => {
      setAlumnos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Alumno));
    });
    const unsubGrupos = onSnapshot(collection(db, 'grupos'), (snapshot) => {
      setGrupos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubAlumnos(); unsubGrupos(); };
  }, []);

  // Quita tildes y pasa a minúsculas para comparación
  const norm = (s: unknown): string =>
    String(s ?? '').toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // ─── isPaid: tolerante a todos los formatos posibles de Firebase ─────────────
  const isPaid = (alumno: Alumno, mesN: number): boolean => {
    if (!Array.isArray(alumno.pagosMensuales)) return false;
    const mesObj = meses.find(m => m.n === mesN);
    if (!mesObj) return false;

    const labelNorm  = norm(mesObj.label);   // "enero"
    const abrevNorm  = norm(mesObj.name);    // "ene"
    const prefijo    = labelNorm.slice(0, 3); // "ene"
    const numStr     = String(mesN);          // "1"

    return alumno.pagosMensuales.some(p => {
      if (!p) return false;

      // Año: tolera string "2026" y number 2026
      const pAnio = parseInt(String(p.anio ?? '0'), 10);
      if (isNaN(pAnio) || pAnio !== selectedYear) return false;

      // Mes: tolera nombre completo, abreviatura, prefijo de 3 letras, número como string
      const pMes = norm(p.mes);
      return (
        pMes === labelNorm  ||   // "enero"
        pMes === abrevNorm  ||   // "ene"
        pMes.startsWith(prefijo) ||  // "enero".startsWith("ene")
        pMes === numStr          // "1"
      );
    });
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const TOTAL_MESES = 9; // Temporada Marzo–Noviembre
  const getPagosDelAnio = (alumno: Alumno) =>
    meses.filter(m => isPaid(alumno, m.n)).length;

  const togglePago = async (alumno: Alumno, mesN: number) => {
    if (!alumno.id) return;
    const mesLabel = meses.find(m => m.n === mesN)?.label ?? 'Enero';
    const yaPagado = isPaid(alumno, mesN);
    const alumnoRef = doc(db, 'alumnos', alumno.id);

    try {
      if (yaPagado) {
        // Buscar el objeto exacto guardado (puede tener formato distinto) para poder removerlo
        const pagoARemover = (alumno.pagosMensuales ?? []).find(p => {
          const pAnio = parseInt(String(p.anio ?? '0'), 10);
          const pMes  = norm(p.mes);
          const lbl   = norm(mesLabel);
          return pAnio === selectedYear && (
            pMes === lbl ||
            pMes === norm(meses.find(m => m.n === mesN)?.name) ||
            pMes.startsWith(lbl.slice(0, 3)) ||
            pMes === String(mesN)
          );
        });
        if (pagoARemover) {
          await updateDoc(alumnoRef, { pagosMensuales: arrayRemove(pagoARemover) });
        }
      } else {
        await updateDoc(alumnoRef, {
          pagosMensuales: arrayUnion({
            mes: mesLabel,      // siempre guardamos nombre completo
            anio: selectedYear, // siempre guardamos como number
            fechaPago: new Date().toISOString(),
          }),
        });
      }
    } catch (err) {
      console.error('Error al cambiar pago:', err);
    }
  };

  const getGrupoDetalle = (alumno: Alumno) => {
    if (!alumno.grupo || alumno.grupo === 'SIN GRUPO') return 'SIN GRUPO';
    const config = grupos.find(g => g.nombre === alumno.grupo);
    if (!config) return alumno.grupo;
    const dias = Array.isArray(config.dias) ? config.dias.join(' Y ') : config.dias;
    return `${dias} ${config.horario ?? ''}`.trim().toUpperCase();
  };

  const alumnosOrdenados = [...alumnos].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div className="min-h-screen bg-ios-gray pb-32">

      {/* ── HEADER ── */}
      <header className="bg-white px-6 pt-12 pb-6 shadow-sm border-b border-black/5 sticky top-0 z-40">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-primary font-medium flex items-center gap-1">
            <span className="material-icons-outlined text-lg">arrow_back_ios</span>
            <span>Atrás</span>
          </button>

          {/* Selector de año */}
          <div className="flex bg-ios-gray p-1 rounded-xl gap-1">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  selectedYear === y
                    ? 'bg-white text-ios-blue shadow-sm'
                    : 'text-secondary hover:text-black'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <h1 className="text-3xl font-bold text-black tracking-tight">Control de Pagos</h1>
        <p className="text-secondary text-sm mt-1">Temporada Marzo–Noviembre · {selectedYear}</p>

        {/* Banner importar */}
        <div className="mt-6 bg-ios-blue/5 border border-ios-blue/10 rounded-3xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-ios-blue/5 rounded-full blur-2xl group-hover:bg-ios-blue/10 transition-colors" />
          <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-ios-blue text-white rounded-2xl flex items-center justify-center shadow-lg shadow-ios-blue/20">
              <span className="material-icons-outlined text-2xl">auto_fix_high</span>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h4 className="text-sm font-bold text-black">Sincronización Inteligente</h4>
              <p className="text-[10px] text-secondary font-medium leading-relaxed">
                Cargá tu Excel de pagos y la app marcará automáticamente los meses de cada gimnasta.
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onImportPayments}
              className="px-6 py-3 bg-white border border-ios-blue/20 rounded-2xl text-ios-blue text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <span className="material-icons-outlined text-base">upload_file</span>
              Importar Pagos
            </motion.button>
          </div>
        </div>
      </header>

      {/* ── TABLA ── */}
      <div className="p-4">
        <div className="bg-white rounded-[2rem] shadow-ios overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black/5">
                <th className="p-4 text-left text-[10px] font-bold text-secondary uppercase tracking-widest sticky left-0 bg-white z-10 w-52">
                  Gimnasta
                </th>
                {meses.map(m => (
                  <th key={m.n} className="p-4 text-center text-[10px] font-bold text-secondary uppercase tracking-widest min-w-[52px]">
                    {m.name}
                  </th>
                ))}
                <th className="p-4 text-center text-[10px] font-bold text-secondary uppercase tracking-widest min-w-[48px]">
                  /9
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/5">
              {alumnosOrdenados.map(alumno => {
                const pagosAnio = getPagosDelAnio(alumno);
                const isDebug   = debugAlumnoId === alumno.id;

                return (
                  <React.Fragment key={alumno.id}>
                    <tr className="hover:bg-ios-gray/30 transition-colors">
                      {/* Nombre + grupo (toca para debug) */}
                      <td className="p-4 sticky left-0 bg-white z-10 border-r border-black/5">
                        <div
                          className="flex flex-col cursor-pointer select-none"
                          onClick={() => setDebugAlumnoId(isDebug ? null : (alumno.id ?? null))}
                        >
                          <span className="text-sm font-bold text-black line-clamp-1">{alumno.nombre}</span>
                          <span className="text-[9px] font-bold text-secondary uppercase tracking-tighter leading-tight">
                            {getGrupoDetalle(alumno)}
                          </span>
                        </div>
                      </td>

                      {/* Celdas de mes */}
                      {meses.map(m => {
                        const paid = isPaid(alumno, m.n);
                        return (
                          <td key={m.n} className="p-3 text-center">
                            <motion.button
                              whileTap={{ scale: 0.82 }}
                              onClick={() => togglePago(alumno, m.n)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all ${
                                paid
                                  ? 'bg-ios-green text-white shadow-sm shadow-ios-green/30'
                                  : 'bg-ios-gray text-transparent border border-black/5 hover:border-black/20'
                              }`}
                            >
                              <span className="material-icons-outlined text-[16px]">check</span>
                            </motion.button>
                          </td>
                        );
                      })}

                      {/* Contador total del año */}
                      <td className="p-3 text-center">
                        <span className={`text-[11px] font-black tabular-nums ${
                          pagosAnio === TOTAL_MESES ? 'text-ios-green' :
                          pagosAnio >= 5             ? 'text-ios-blue' :
                          pagosAnio > 0              ? 'text-amber-500' :
                                                       'text-black/20'
                        }`}>
                          {pagosAnio}/{TOTAL_MESES}
                        </span>
                      </td>
                    </tr>

                    {/* ── PANEL DEBUG (se abre al tocar el nombre) ── */}
                    {isDebug && (
                      <tr>
                        <td colSpan={11} className="px-6 pb-4 pt-2 bg-amber-50 border-b border-amber-100">
                          <p className="text-[9px] font-black uppercase text-amber-700 mb-2">
                            🔍 Datos brutos · pagosMensuales · {alumno.nombre}
                          </p>
                          {(!alumno.pagosMensuales || alumno.pagosMensuales.length === 0) ? (
                            <p className="text-[10px] text-red-500 font-bold">
                              ⚠️ No hay registros de pagosMensuales en Firestore para este alumno.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {alumno.pagosMensuales.map((p, i) => (
                                <span
                                  key={i}
                                  className="bg-white border border-amber-200 rounded-lg px-2 py-1 text-[9px] font-mono text-black"
                                >
                                  mes: <b>{String(p.mes)}</b> | anio: <b>{String(p.anio)}</b>{' '}
                                  <span className="text-amber-500">({typeof p.anio})</span>
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-[9px] text-amber-600 mt-2 italic">
                            Tocá el nombre nuevamente para cerrar · Año activo: {selectedYear}
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-center text-[9px] text-secondary/60 mt-3 font-medium">
          Tocá el nombre de una gimnasta para inspeccionar sus datos · los círculos verdes son pagos confirmados
        </p>
      </div>
    </div>
  );
};
