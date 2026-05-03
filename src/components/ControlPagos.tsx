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
  const years = [2024, 2025, 2026, 2027];
  const meses = [
    { n: 3, name: 'Mar', label: 'Marzo' },
    { n: 4, name: 'Abr', label: 'Abril' }, { n: 5, name: 'May', label: 'Mayo' }, { n: 6, name: 'Jun', label: 'Junio' },
    { n: 7, name: 'Jul', label: 'Julio' }, { n: 8, name: 'Ago', label: 'Agosto' }, { n: 9, name: 'Sep', label: 'Septiembre' },
    { n: 10, name: 'Oct', label: 'Octubre' }, { n: 11, name: 'Nov', label: 'Noviembre' }
  ];

  useEffect(() => {
    // Escuchar alumnos y sus pagos de forma centralizada
    const unsubscribeAlumnos = onSnapshot(collection(db, 'alumnos'), (snapshot) => {
      setAlumnos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Alumno));
    });

    // Escuchar configuración de grupos para obtener horarios
    const unsubscribeGrupos = onSnapshot(collection(db, 'grupos'), (snapshot) => {
      setGrupos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeAlumnos();
      unsubscribeGrupos();
    };
  }, []);

  const togglePago = async (alumno: Alumno, mesN: number) => {
    if (!alumno.id) return;
    
    const mesLabel = meses.find(m => m.n === mesN)?.label || 'Enero';
    const yaPagado = alumno.pagosMensuales?.some(p => p.mes === mesLabel && p.anio === selectedYear);
    const alumnoRef = doc(db, 'alumnos', alumno.id);

    try {
      if (yaPagado) {
        // Encontrar el registro exacto para removerlo
        const pagoARemover = alumno.pagosMensuales?.find(p => p.mes === mesLabel && p.anio === selectedYear);
        if (pagoARemover) {
          await updateDoc(alumnoRef, {
            pagosMensuales: arrayRemove(pagoARemover)
          });
        }
      } else {
        await updateDoc(alumnoRef, {
          pagosMensuales: arrayUnion({
            mes: mesLabel,
            anio: selectedYear,
            fechaPago: new Date().toISOString()
          })
        });
      }
    } catch (error) {
      console.error("Error toggling payment:", error);
    }
  };

  const isPaid = (alumno: Alumno, mesN: number) => {
    const mesLabel = meses.find(m => m.n === mesN)?.label || '';
    return alumno.pagosMensuales?.some(p => 
      p.mes?.toLowerCase() === mesLabel.toLowerCase() && p.anio === selectedYear
    ) || false;
  };

  const getGrupoDetalle = (alumno: Alumno) => {
    if (!alumno.grupo || alumno.grupo === 'SIN GRUPO') return 'SIN GRUPO';
    
    const config = grupos.find(g => g.nombre === alumno.grupo);
    if (!config) return alumno.grupo;

    const dias = Array.isArray(config.dias) ? config.dias.join(' Y ') : config.dias;
    return `${dias} ${config.horario || ''}`.trim().toUpperCase();
  };

  return (
    <div className="min-h-screen bg-ios-gray pb-32">
      <header className="bg-white px-6 pt-12 pb-6 shadow-sm border-b border-black/5 sticky top-0 z-40">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-primary font-medium flex items-center gap-1">
            <span className="material-icons-outlined text-lg">arrow_back_ios</span>
            <span>Atrás</span>
          </button>
          
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
        <p className="text-secondary text-sm mt-1">Resumen anual de cuotas por gimnasta</p>
        
        <div className="mt-8 bg-ios-blue/5 border border-ios-blue/10 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-ios-blue/5 rounded-full blur-2xl group-hover:bg-ios-blue/10 transition-colors"></div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-ios-blue text-white rounded-2xl flex items-center justify-center shadow-lg shadow-ios-blue/20">
              <span className="material-icons-outlined text-2xl">auto_fix_high</span>
            </div>
            
            <div className="flex-1 text-center sm:text-left">
              <h4 className="text-sm font-bold text-black">Sincronización Inteligente</h4>
              <p className="text-[10px] text-secondary font-medium leading-relaxed">
                Carga tu Excel de pagos y la app marcará automáticamente los meses para cada gimnasta.
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

      <div className="p-4">
        <div className="bg-white rounded-[2rem] shadow-ios overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black/5">
                <th className="p-4 text-left text-[10px] font-bold text-secondary uppercase tracking-widest sticky left-0 bg-white z-10 w-48">Gimnasta</th>
                {meses.map(m => (
                  <th key={m.n} className="p-4 text-center text-[10px] font-bold text-secondary uppercase tracking-widest min-w-[60px]">{m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {alumnos.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(alumno => (
                <tr key={alumno.id} className="hover:bg-ios-gray/30 transition-colors">
                  <td className="p-4 sticky left-0 bg-white z-10 border-r border-black/5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-black line-clamp-1">{alumno.nombre}</span>
                      <span className="text-[9px] font-bold text-secondary uppercase tracking-tighter leading-tight">
                        {getGrupoDetalle(alumno)}
                      </span>
                    </div>
                  </td>
                  {meses.map(m => (
                    <td key={m.n} className="p-4 text-center">
                      <button 
                        onClick={() => togglePago(alumno, m.n)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isPaid(alumno, m.n) 
                            ? 'bg-ios-green text-white shadow-sm' 
                            : 'bg-ios-gray text-transparent border border-black/5 hover:border-black/20'
                        }`}
                      >
                        <span className="material-icons-outlined text-[16px]">check</span>
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
