import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLLECTIONS } from '../services/firebase';

export const CoordinatorDashboard: React.FC = () => {
  const [staffActivity, setStaffActivity] = useState<any[]>([]);
  const [dataActivity, setDataActivity] = useState<any[]>([]);

  useEffect(() => {
    // Escuchar cambios en staff
    const staffQuery = query(collection(db, COLLECTIONS.STAFF), orderBy('fechaRegistro', 'desc'));
    const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
      setStaffActivity(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Escuchar clases o logs de actividad (si existen)
    // Suponiendo que hay clases
    const clasesQuery = query(collection(db, COLLECTIONS.CLASES), orderBy('fecha', 'desc'));
    const unsubscribeClases = onSnapshot(clasesQuery, (snapshot) => {
      setDataActivity(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeStaff();
      unsubscribeClases();
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Panel del Coordinador</h2>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Profesores Conectados / Registrados</h3>
        <ul>
          {staffActivity.map(staff => (
            <li key={staff.id} className="p-2 border-b">{staff.nombre} - {staff.email}</li>
          ))}
        </ul>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Actividad Reciente (Clases)</h3>
        <ul>
          {dataActivity.slice(0, 5).map(clase => (
            <li key={clase.id} className="p-2 border-b">
              {clase.grupo} - {clase.fecha}
              <div className="text-xs text-secondary">
                Inicial: {clase.faseInicial?.join(', ')} | 
                Principal: {clase.fasePrincipal?.join(', ')} | 
                Final: {clase.faseFinal?.join(', ')}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
