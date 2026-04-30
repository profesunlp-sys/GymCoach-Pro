
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alumno, ViewMode } from '../../types';
import { BackButton, Button } from './ui/CommonUI';
import { db, COLLECTIONS, addDocument, updateDocument, deleteDocument } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';

interface HabilidadesProps {
  alumnos?: Alumno[];
  setVista?: (val: ViewMode) => void;
  handleNavigation?: (val: ViewMode) => void;
}

interface HabilidadGlobal {
  id?: string;
  nombre: string;
  aparato: string;
  nivel: string;
  descripcion: string;
  createdAt?: any;
  updatedAt?: any;
}

export const Habilidades: React.FC<HabilidadesProps> = ({
  alumnos = [],
  setVista,
  handleNavigation
}) => {
  const [habilidades, setHabilidades] = useState<HabilidadGlobal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    aparato: 'Suelo',
    nivel: 'Básico',
    descripcion: ''
  });

  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.HABILIDADES), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const habs: HabilidadGlobal[] = [];
      snapshot.forEach(doc => {
        habs.push({ id: doc.id, ...doc.data() } as HabilidadGlobal);
      });
      setHabilidades(habs);
      setLoading(false);
      setError(false);
    }, (err) => {
      console.error("Error fetching habilidades:", err);
      // Fallback por si la colección no existe o necesita índice
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (hab?: HabilidadGlobal) => {
    if (hab) {
      setEditingId(hab.id!);
      setFormData({
        nombre: hab.nombre,
        aparato: hab.aparato || 'Suelo',
        nivel: hab.nivel || 'Básico',
        descripcion: hab.descripcion || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        nombre: '',
        aparato: 'Suelo',
        nivel: 'Básico',
        descripcion: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) return;

    try {
      if (editingId) {
        await updateDocument(COLLECTIONS.HABILIDADES, editingId, {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDocument(COLLECTIONS.HABILIDADES, {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      handleCloseModal();
    } catch (err) {
      console.error("Error saving habilidad:", err);
      alert("Error al guardar la habilidad.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar esta habilidad?")) {
      try {
        await deleteDocument(COLLECTIONS.HABILIDADES, id);
      } catch (err) {
        console.error("Error deleting:", err);
        alert("Error al eliminar la habilidad.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ios-gray px-6 py-8">
        {handleNavigation && <BackButton onClick={() => handleNavigation('Dashboard')} />}
        <div className="mt-20 text-center text-secondary">
          Cargando habilidades...
        </div>
      </div>
    );
  }

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
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-black tracking-tight leading-none mb-2">Habilidades</h1>
          <p className="text-secondary text-sm font-medium">Control global de habilidades y logros de tus gimnastas.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-ios-blue text-white px-4 py-2 rounded-full font-bold text-sm"
        >
          Agregar Habilidad
        </button>
      </div>

      {habilidades.length === 0 ? (
        <div className="py-20 text-center text-secondary font-medium bg-white rounded-3xl border border-black/5">
          No hay habilidades registradas. Crea la primera.
        </div>
      ) : (
        <div className="space-y-4">
          {habilidades.map(hab => (
            <motion.div 
              key={hab.id}
              className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm flex flex-col justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-black text-lg">{hab.nombre}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-3 py-1 bg-black/5 text-black rounded-full text-[10px] font-bold tracking-widest uppercase">
                      {hab.aparato}
                    </span>
                    <span className="px-3 py-1 bg-ios-blue/10 text-ios-blue rounded-full text-[10px] font-bold tracking-widest uppercase">
                      {hab.nivel}
                    </span>
                  </div>
                  {hab.descripcion && (
                     <p className="text-sm text-secondary mt-3">{hab.descripcion}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleOpenModal(hab)} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 text-secondary hover:text-black transition-colors">
                    <span className="material-icons-outlined text-sm">edit</span>
                  </button>
                  <button onClick={() => handleDelete(hab.id!)} className="w-8 h-8 flex items-center justify-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
                    <span className="material-icons-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal / Formulario */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
             <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={handleCloseModal}
             />
             <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-[500px] bg-ios-gray sm:rounded-[2.5rem] rounded-t-[2.5rem] p-6 shadow-2xl border border-black/5 z-10 max-h-[85vh] overflow-y-auto mb-20"
             >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-black tracking-tight">{editingId ? 'Editar Habilidad' : 'Nueva Habilidad'}</h3>
                  <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 text-secondary hover:text-black">
                    <span className="material-icons-outlined text-sm">close</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Nombre de la habilidad</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Doble giro"
                      className="w-full bg-white border-none rounded-xl p-3 text-sm text-black outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all font-bold"
                      value={formData.nombre}
                      onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Aparato</label>
                      <select 
                        className="w-full bg-white border-none rounded-xl p-3 text-sm text-black outline-none font-bold appearance-none"
                        value={formData.aparato}
                        onChange={(e) => setFormData({...formData, aparato: e.target.value})}
                      >
                        <option value="Suelo">Suelo</option>
                        <option value="Salto">Salto</option>
                        <option value="Viga">Viga</option>
                        <option value="Paralelas Asimétricas">Paralelas Asimétricas</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Nivel</label>
                      <select 
                        className="w-full bg-white border-none rounded-xl p-3 text-sm text-black outline-none font-bold appearance-none"
                        value={formData.nivel}
                        onChange={(e) => setFormData({...formData, nivel: e.target.value})}
                      >
                        <option value="Básico">Básico</option>
                        <option value="Intermedio">Intermedio</option>
                        <option value="Avanzado">Avanzado</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest">Descripción (Opcional)</label>
                    <textarea 
                      placeholder="Agrega una descripción..."
                      className="w-full bg-white border-none rounded-xl p-3 text-sm text-black outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all text-sm resize-none h-20"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    ></textarea>
                  </div>

                  <Button onClick={handleSave} className="w-full !py-3 !text-sm !rounded-full" disabled={!formData.nombre.trim()}>
                    Guardar Habilidad
                  </Button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

