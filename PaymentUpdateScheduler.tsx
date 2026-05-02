// ============================================================
// COMPONENTE: PaymentUpdateScheduler.tsx
// Gestiona consultas periódicas de Excel cada 7-15 días
// ============================================================

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { Timestamp, collection, addDoc, orderBy, query, limit, getDocs } from 'firebase/firestore';

interface ImportRecord {
  id: string;
  fecha: Timestamp;
  archivo: string;
  alumnosImportados: number;
  alumnosNuevos: number;
  alumnosActualizados: number;
  periodoControl: {
    desde: Date;
    hasta: Date;
  };
  exito: boolean;
  errores: string[];
}

interface ScheduleState {
  ultimaImportacion: ImportRecord | null;
  diasTranscurridos: number;
  estado: 'actualizado' | 'sugerido' | 'vencido' | 'nunca';
  proximaFecha: Date | null;
}

// ============================================================
// FUNCIÓN 1: Guardar importación en historial
// ============================================================
export async function guardarHistorialImportacion(
  archivo: string,
  resultado: any
): Promise<void> {
  try {
    const record = {
      fecha: Timestamp.now(),
      archivo: archivo,
      alumnosImportados: resultado.successCount || 0,
      alumnosNuevos: resultado.newCount || 0,
      alumnosActualizados: resultado.updateCount || 0,
      periodoControl: {
        desde: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        hasta: new Date()
      },
      exito: resultado.success === true,
      errores: resultado.errors || [],
      createdAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'import_history'), record);
    console.log('✅ Importación registrada:', docRef.id);

    // Notificar al usuario
    showNotification({
      tipo: 'success',
      titulo: '✅ Importación Registrada',
      mensaje: `${resultado.successCount} alumnos guardados en historial`,
      duracion: 3000
    });

  } catch (error) {
    console.error('❌ Error guardando historial:', error);
    showNotification({
      tipo: 'error',
      titulo: '❌ Error al Guardar',
      mensaje: 'No se pudo registrar la importación en el historial',
      duracion: 5000
    });
  }
}

// ============================================================
// FUNCIÓN 2: Obtener última importación
// ============================================================
export async function obtenerUltimaImportacion(): Promise<ImportRecord | null> {
  try {
    const q = query(
      collection(db, 'import_history'),
      orderBy('fecha', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();
    return {
      id: snapshot.docs[0].id,
      fecha: data.fecha,
      archivo: data.archivo,
      alumnosImportados: data.alumnosImportados,
      alumnosNuevos: data.alumnosNuevos || 0,
      alumnosActualizados: data.alumnosActualizados || 0,
      periodoControl: data.periodoControl,
      exito: data.exito,
      errores: data.errores || []
    } as ImportRecord;

  } catch (error) {
    console.error('❌ Error obteniendo última importación:', error);
    return null;
  }
}

// ============================================================
// FUNCIÓN 3: Calcular estado de actualización
// ============================================================
export async function calcularEstadoActualizacion(): Promise<ScheduleState> {
  const ultimaImportacion = await obtenerUltimaImportacion();

  if (!ultimaImportacion) {
    return {
      ultimaImportacion: null,
      diasTranscurridos: 0,
      estado: 'nunca',
      proximaFecha: null
    };
  }

  const ahora = new Date();
  const fechaUltima = ultimaImportacion.fecha.toDate();
  const diasTranscurridos = Math.floor(
    (ahora.getTime() - fechaUltima.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calcular próxima fecha sugerida
  const proximaFecha = new Date(fechaUltima);
  proximaFecha.setDate(proximaFecha.getDate() + 7);

  let estado: 'actualizado' | 'sugerido' | 'vencido' | 'nunca';

  if (diasTranscurridos < 7) {
    estado = 'actualizado';
  } else if (diasTranscurridos >= 7 && diasTranscurridos < 15) {
    estado = 'sugerido';
  } else {
    estado = 'vencido';
  }

  return {
    ultimaImportacion,
    diasTranscurridos,
    estado,
    proximaFecha
  };
}

// ============================================================
// FUNCIÓN 4: Mostrar alerta según estado
// ============================================================
export async function mostrarAlertaActualizacion(): Promise<void> {
  const schedule = await calcularEstadoActualizacion();

  if (schedule.estado === 'nunca') {
    showNotification({
      tipo: 'warning',
      titulo: '📊 Control de Pagos',
      mensaje: 'Aún no se ha importado el control de pagos. ¿Quieres hacerlo ahora?',
      boton: 'Importar',
      duracion: 0
    });
  } else if (schedule.estado === 'sugerido') {
    const mensaje = `Última actualización hace ${schedule.diasTranscurridos} días. Se sugiere actualizar cada 7 días.`;
    showNotification({
      tipo: 'info',
      titulo: '⏰ Actualización Sugerida',
      mensaje: mensaje,
      boton: 'Actualizar Ahora',
      duracion: 0
    });
  } else if (schedule.estado === 'vencido') {
    const mensaje = `⚠️ El control de pagos no se actualiza hace ${schedule.diasTranscurridos} días. ¡Importa urgentemente!`;
    showNotification({
      tipo: 'error',
      titulo: '🔴 ACTUALIZACIÓN URGENTE',
      mensaje: mensaje,
      boton: 'Importar Ahora',
      duracion: 0
    });
  }
}

// ============================================================
// COMPONENTE: PaymentUpdateAlert
// ============================================================
export function PaymentUpdateAlert() {
  const [schedule, setSchedule] = useState<ScheduleState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarEstado() {
      const estado = await calcularEstadoActualizacion();
      setSchedule(estado);
      setLoading(false);
    }

    cargarEstado();
    // Actualizar cada hora
    const interval = setInterval(cargarEstado, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !schedule) {
    return null;
  }

  // Si está actualizado, no mostrar nada
  if (schedule.estado === 'actualizado') {
    return null;
  }

  // Configurar colores y mensajes según estado
  const config = {
    sugerido: {
      bgColor: '#fff3cd', // Amarillo
      borderColor: '#ffc107',
      textColor: '#856404',
      icon: '⏰',
      titulo: 'Actualización Sugerida',
      mensaje: `Hace ${schedule.diasTranscurridos} días. Se sugiere cada 7 días.`
    },
    vencido: {
      bgColor: '#f8d7da', // Rojo
      borderColor: '#dc3545',
      textColor: '#721c24',
      icon: '🔴',
      titulo: 'ACTUALIZACIÓN URGENTE',
      mensaje: `Hace ${schedule.diasTranscurridos} días. ¡Actualizar ahora!`
    },
    nunca: {
      bgColor: '#e7d4f5', // Púrpura
      borderColor: '#9966ff',
      textColor: '#2d1b69',
      icon: '📊',
      titulo: 'Control de Pagos',
      mensaje: 'Aún no se ha importado. ¿Quieres empezar?'
    }
  };

  const estilo = config[schedule.estado as keyof typeof config];

  return (
    <div
      style={{
        backgroundColor: estilo.bgColor,
        borderLeft: `4px solid ${estilo.borderColor}`,
        color: estilo.textColor,
        padding: '16px',
        marginBottom: '16px',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div>
        <strong>{estilo.icon} {estilo.titulo}</strong>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          {estilo.mensaje}
        </p>
      </div>
      <button
        onClick={() => {
          // Navegar a PAGOS → IMPORTAR
          window.location.href = '/app/pagos?modal=importar';
        }}
        style={{
          backgroundColor: estilo.borderColor,
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        Actualizar
      </button>
    </div>
  );
}

// ============================================================
// COMPONENTE: ImportHistoryTable
// ============================================================
export function ImportHistoryTable() {
  const [historial, setHistorial] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarHistorial() {
      try {
        const q = query(
          collection(db, 'import_history'),
          orderBy('fecha', 'desc'),
          limit(20)
        );

        const snapshot = await getDocs(q);
        const registros = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ImportRecord));

        setHistorial(registros);
      } catch (error) {
        console.error('Error cargando historial:', error);
      } finally {
        setLoading(false);
      }
    }

    cargarHistorial();
  }, []);

  if (loading) {
    return <div>Cargando historial...</div>;
  }

  if (historial.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
        <p>📊 No hay importaciones registradas</p>
        <p style={{ fontSize: '14px' }}>
          Importa el primer Excel para comenzar a mantener un historial
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Fecha</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Archivo</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Importados</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Nuevos</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Actualizados</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {historial.map((record, idx) => (
            <tr
              key={record.id}
              style={{
                borderBottom: '1px solid #eee',
                backgroundColor: idx % 2 === 0 ? '#fafafa' : 'white'
              }}
            >
              <td style={{ padding: '12px' }}>
                {record.fecha.toDate().toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </td>
              <td style={{ padding: '12px' }}>
                {record.archivo.substring(0, 30)}...
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <strong>{record.alumnosImportados}</strong>
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                {record.alumnosNuevos || 0}
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                {record.alumnosActualizados || 0}
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                {record.exito ? (
                  <span style={{ color: 'green', fontWeight: 'bold' }}>✅</span>
                ) : (
                  <span style={{ color: 'red', fontWeight: 'bold' }}>❌</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// FUNCIÓN AUXILIAR: Mostrar notificación
// ============================================================
function showNotification(config: {
  tipo: 'success' | 'error' | 'warning' | 'info';
  titulo: string;
  mensaje: string;
  boton?: string;
  duracion?: number;
}): void {
  // Implementar según tu sistema de notificaciones
  // (toast, snackbar, modal, etc.)

  const background = {
    success: '#d4edda',
    error: '#f8d7da',
    warning: '#fff3cd',
    info: '#d1ecf1'
  }[config.tipo];

  const borderColor = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  }[config.tipo];

  console.log(`\n${config.tipo.toUpperCase()}: ${config.titulo}`);
  console.log(`${config.mensaje}`);

  // Si usas una librería como react-toastify:
  // toast[config.tipo](config.mensaje, { autoClose: config.duracion });
}

// ============================================================
// CÓMO USAR EN LA APP
// ============================================================

/*

1. En BulkPaymentImport.tsx:
   ──────────────────────────

   import { guardarHistorialImportacion } from './PaymentUpdateScheduler';

   async function handleFileUpload(file: File) {
     try {
       const result = await handlePaymentImport(file, db);
       
       // Guardar en historial
       await guardarHistorialImportacion(file.name, result);
       
       // Mostrar éxito
       showSuccess(result.message);
     } catch (error) {
       showError(error.message);
     }
   }


2. En Pagos.tsx (mostrar alerta):
   ────────────────────────────

   import { PaymentUpdateAlert } from './PaymentUpdateScheduler';

   export function PagosComponent() {
     return (
       <>
         <PaymentUpdateAlert />
         {/* resto del contenido */}
       </>
     );
   }


3. En Ajustes.tsx (mostrar historial):
   ──────────────────────────────────

   import { ImportHistoryTable } from './PaymentUpdateScheduler';

   export function AjustesComponent() {
     return (
       <div>
         <h3>📊 Historial de Importaciones</h3>
         <ImportHistoryTable />
       </div>
     );
   }


4. En Dashboard.tsx (verificar al cargar):
   ─────────────────────────────────────

   import { mostrarAlertaActualizacion } from './PaymentUpdateScheduler';

   useEffect(() => {
     // Mostrar alerta si es necesario actualizar
     mostrarAlertaActualizacion();
   }, []);

*/

export default PaymentUpdateAlert;
