
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Alumno, ViewMode } from '../../types';
import { BackButton } from '../../App';

interface HabilidadesProps {
  alumnos?: Alumno[];
  setVista?: (val: ViewMode) => void;
  handleNavigation?: (val: ViewMode) => void;
}

export const Habilidades: React.FC<HabilidadesProps> = ({
  alumnos = [],
  setVista,
  handleNavigation
}) => {
  const [error, setError] = useState(false);

  if (!alumnos) {
    return (
      <div className="min-h-screen bg-ios-gray px-6 py-8">
        {handleNavigation && <BackButton onClick={() => handleNavigation('Dashboard')} />}
        <div className="mt-20 text-center text-secondary">
          Las habilidades se cargan aquí
        </div>
      </div>
    );
  }

  const hasSkills = alumnos.some(a => a.habilidades && a.habilidades.length > 0);

  if (error) {
    return (
       <div className="min-h-screen bg-ios-gray px-6 py-8">
         {handleNavigation && <BackButton onClick={() => handleNavigation('Dashboard')} />}
         <div className="mt-20 text-center">
           <p className="text-ios-red">No se pudieron cargar las habilidades. Reintentar</p>
           <button onClick={() => setError(false)} className="mt-4 text-ios-blue underline">Reintentar</button>
         </div>
       </div>
    );
  }

  return (
    <div className="min-h-screen bg-ios-gray px-6 py-8 space-y-8 page-transition pb-24 relative max-w-[600px] mx-auto">
      {handleNavigation && <BackButton onClick={() => handleNavigation('Dashboard')} />}
      
      <div>
        <h1 className="text-3xl font-bold text-black tracking-tight leading-none mb-2">Habilidades</h1>
        <p className="text-secondary text-sm font-medium">Control global de habilidades y logros de todas tus gimnastas.</p>
      </div>

      {!hasSkills ? (
        <div className="py-20 text-center text-secondary font-medium">
          Las habilidades se cargan aquí
        </div>
      ) : (
        <div className="space-y-4">
          {alumnos.filter(a => a.habilidades && a.habilidades.length > 0).map(alumno => (
            <motion.div 
              key={alumno.id}
              className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="font-bold text-black mb-3">{alumno.nombre}</h3>
              <div className="space-y-2">
                {alumno.habilidades?.map(skill => (
                  <div key={skill.id} className="flex justify-between items-center text-sm p-3 bg-ios-gray rounded-xl border border-black/5">
                    <div>
                      <p className="font-bold text-black">{skill.name} {skill.favorite && '⭐'}</p>
                      <p className="text-xs text-secondary mt-0.5">{skill.apparatus} • Nivel {skill.level}</p>
                    </div>
                    <span className="px-3 py-1 bg-ios-blue/10 text-ios-blue rounded-full text-xs font-bold whitespace-nowrap">
                      {skill.status}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
