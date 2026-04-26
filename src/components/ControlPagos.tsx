import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Alumno } from '../types';
import { motion } from 'motion/react';

interface ControlPagosProps {
  onBack: () => void;
}

export const ControlPagos: React.FC<ControlPagosProps> = ({ onBack }) => {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [pagos, setPagos] = useState<Record<string, Record<number, boolean>>>({}); // alumnoId -> month -> paid
  const [selectedYear] = useState(new Date().getFullYear());
  const meses = [
    { n: 1, name: 'Ene' }, { n: 2, name: 'Feb' }, { n: 3, name: 'Mar' },
    { n: 4, name: 'Abr' }, { n: 5, name: 'May' }, { n: 6, name: 'Jun' },
    { n: 7, name: 'Jul' }, { n: 8, name: 'Ago' }, { n: 9, name: 'Sep' },
    { n: 10, name: 'Oct' }, { n: 11, name: 'Nov' }, { n: 12, name: 'Dic' }
  ];

  useEffect(() => {
    // Escuchar alumnos
    const unsubscribeAlumnos = onSnapshot(collection(db, 'alumnos'), (snapshot) => {
      setAlumnos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Alumno));
    });

    // Escuchar todos los pagos del año
    const q = query(collection(db, 'pagos'), where('año', '==', selectedYear));
    const unsubscribePagos = onSnapshot(q, (snapshot) => {
      const data: Record<string, Record<number, boolean>> = {};
      snapshot.docs.forEach(doc => {
        const p = doc.data();
        if (!data[p.alumnoId]) data[p.alumnoId] = {};
        data[p.alumnoId][p.mes] = true;
      });
      setPagos(data);
    });

    return () => {
      unsubscribeAlumnos();
      unsubscribePagos();
    };
  }, [selectedYear]);

  const togglePago = async (alumnoId: string, mes: number) => {
    const isPaid = pagos[alumnoId]?.[mes];
    const pagoId = `${alumnoId}_${selectedYear}_${mes}`;
    const pagoRef = doc(db, 'pagos', pagoId);

    if (isPaid) {
      await deleteDoc(pagoRef);
    } else {
      await setDoc(pagoRef, {
        alumnoId,
        mes,
        año: selectedYear,
        fecha: new Date().toISOString(),
        metodo: 'Manual_Dashboard'
      });
    }
  };

  return (
    <div className="min-h-screen bg-ios-gray pb-32">
      <header className="bg-white px-6 pt-12 pb-6 shadow-sm border-b border-black/5 sticky top-0 z-40">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-primary font-medium flex items-center gap-1">
            <span className="material-icons-outlined text-lg">arrow_back_ios</span>
            <span>Atrás</span>
          </button>
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{selectedYear}</span>
        </div>
        <h1 className="text-3xl font-bold text-black tracking-tight">Control de Pagos</h1>
        <p className="text-secondary text-sm mt-1">Resumen anual de cuotas por gimnasta</p>
      </header>

      <div className="p-4">
        <div className="bg-white rounded-[2rem] shadow-ios overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black/5">
                <th className="p-4 text-left text-[10px] font-bold text-secondary uppercase tracking-widest sticky left-0 bg-white z-10 w-40">Gimnasta</th>
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
                      <span className="text-[9px] font-bold text-secondary uppercase tracking-tighter">{alumno.grupo}</span>
                    </div>
                  </td>
                  {meses.map(m => (
                    <td key={m.n} className="p-4 text-center">
                      <button 
                        onClick={() => togglePago(alumno.id!, m.n)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          pagos[alumno.id!]?.[m.n] 
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
