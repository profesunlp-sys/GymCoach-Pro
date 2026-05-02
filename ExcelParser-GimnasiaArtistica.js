// ============================================================
// PARSER DE EXCEL PARA GymCoach Pro
// Lee Control de Pagos y filtra solo Gimnasia Artística Infantil
// ============================================================

import * as XLSX from 'xlsx'; // npm install xlsx

/**
 * CONFIGURACIÓN DE FILTRADO
 * Solo se contabilizan alumnos de Gimnasia Artística Infantil
 */
const ACTIVIDADES_PERMITIDAS = [
  'Gimnasia Artística Infantil'
];

/**
 * FUNCIÓN 1: Leer archivo Excel
 */
async function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(workbook);
      } catch (error) {
        reject(new Error(`Error leyendo Excel: ${error.message}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * FUNCIÓN 2: Obtener hoja específica
 */
function getSheetData(workbook, sheetName = 'CONTROL GENERAL') {
  console.log(`📋 Obteniendo hoja: ${sheetName}`);
  
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`❌ Hoja "${sheetName}" no encontrada`);
  }
  
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ Hoja cargada: ${data.length} registros`);
  return data;
}

/**
 * FUNCIÓN 3: Filtrar solo Gimnasia Artística Infantil
 */
function filterGimnasiaArtistica(rawData) {
  console.log('🎯 Filtrando Gimnasia Artística Infantil...');
  
  const filtered = rawData.filter(row => {
    const tramite = (row.TRAMITE || '').toString().toLowerCase();
    
    // Verificar si contiene "Gimnasia Artística Infantil"
    const isGimnasia = tramite.includes('gimnasia artística infantil');
    
    if (!isGimnasia) {
      console.log(`   ⏭️  Descartando: ${row['APELLIDO Y NOMBRE']} (${tramite.substring(0, 50)}...)`);
    }
    
    return isGimnasia;
  });
  
  console.log(`✅ Filtrado completado: ${filtered.length} alumnos de Gimnasia Artística Infantil`);
  return filtered;
}

/**
 * FUNCIÓN 4: Validar datos
 */
function validateData(data) {
  console.log('🔍 Validando datos...');
  
  const required = ['APELLIDO Y NOMBRE', 'DNI', 'MONTO'];
  const errors = [];
  
  data.forEach((row, idx) => {
    required.forEach(field => {
      if (!row[field]) {
        errors.push(`Fila ${idx + 1}: Falta campo ${field}`);
      }
    });
  });
  
  if (errors.length > 0) {
    console.warn('⚠️  Errores encontrados:');
    errors.forEach(err => console.warn(`   ${err}`));
  } else {
    console.log('✅ Validación exitosa');
  }
  
  return errors.length === 0;
}

/**
 * FUNCIÓN 5: Procesar datos para Firestore
 */
function processPaymentData(validatedData) {
  console.log('📊 Procesando datos para Firestore...');
  
  const processed = validatedData.map((row, idx) => {
    // Extraer nombre limpio
    const nombre = (row['APELLIDO Y NOMBRE'] || '').trim().toUpperCase();
    
    // Extraer DNI limpio
    const dni = (row['DNI'] || '').toString().trim();
    
    // Extraer monto
    const monto = parseFloat(row['MONTO']) || 0;
    
    // Extraer mes de la columna "Mes"
    const mesRaw = (row['Mes'] || '').toString().trim();
    const mes = extraerMes(mesRaw);
    
    // Extraer cuotas
    const cuotas = parseFloat(row['CUOTAS']) || 1;
    
    // Extraer observaciones
    const observaciones = (row['OBSERVACIONES'] || '').trim();
    
    // Extraer actividad (curso específico)
    const tramite = (row['TRAMITE'] || '').toString().trim();
    const actividad = extraerActividad(tramite);
    
    return {
      index: idx,
      nombre,
      dni,
      monto,
      mes,
      cuotas,
      observaciones,
      tramite,
      actividad,
      pagado: true,
      fuente: 'Excel - Control Pagos',
      importadoEn: new Date().toISOString()
    };
  });
  
  console.log(`✅ ${processed.length} registros procesados`);
  return processed;
}

/**
 * FUNCIÓN AUXILIAR: Extraer mes en formato corto
 */
function extraerMes(mesRaw) {
  const meses = {
    'enero': '01',
    'febrero': '02',
    'marzo': '03',
    'abril': '04',
    'mayo': '05',
    'junio': '06',
    'julio': '07',
    'agosto': '08',
    'septiembre': '09',
    'octubre': '10',
    'noviembre': '11',
    'diciembre': '12'
  };
  
  const mesLower = mesRaw.toLowerCase();
  
  // Buscar mes por nombre completo
  for (const [nombre, numero] of Object.entries(meses)) {
    if (mesLower.includes(nombre)) {
      return numero;
    }
  }
  
  // Si tiene formato "03 - marzo", extraer el número
  const match = mesRaw.match(/^(\d{2})/);
  if (match) {
    return match[1];
  }
  
  // Default: mes actual
  const mesActual = String(new Date().getMonth() + 1).padStart(2, '0');
  console.warn(`⚠️  No se pudo extraer mes de: "${mesRaw}", usando ${mesActual}`);
  return mesActual;
}

/**
 * FUNCIÓN AUXILIAR: Extraer actividad específica del trámite
 */
function extraerActividad(tramite) {
  // Extraer texto entre "Gimnasia Artística Infantil -" y "-" siguiente
  const match = tramite.match(/Gimnasia Artística Infantil\s*-\s*([^-]+)/i);
  
  if (match) {
    return match[1].trim(); // Ej: "De 6 a 9 años"
  }
  
  return 'Gimnasia Artística Infantil';
}

/**
 * FUNCIÓN 6: Importar pagos a Firestore
 */
async function importPaymentsToFirestore(db, processedData) {
  console.log('💾 Importando pagos a Firestore...');
  
  try {
    const batch = db.batch();
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    processedData.forEach((payment, idx) => {
      try {
        // Crear ID basado en DNI y mes para evitar duplicados
        const docId = `${payment.dni}_${payment.mes}_2026`.replace(/\s+/g, '_').toLowerCase();
        const docRef = db.collection('pagos').doc(docId);
        
        // Guardar documento con merge:true para no sobrescribir datos existentes
        batch.set(docRef, {
          nombre: payment.nombre,
          dni: payment.dni,
          monto: payment.monto,
          mes: payment.mes,
          cuotas: payment.cuotas,
          observaciones: payment.observaciones,
          actividad: payment.actividad,
          pagado: payment.pagado,
          ultimoPago: new Date(),
          importadoEn: new Date(),
          fuente: 'Excel - Control Pagos'
        }, { merge: true });
        
        successCount++;
        console.log(`✅ [${idx + 1}/${processedData.length}] ${payment.nombre} - ${payment.mes}/2026`);
        
      } catch (error) {
        errorCount++;
        errors.push(`Fila ${idx + 1}: ${error.message}`);
        console.error(`❌ Error en ${payment.nombre}:`, error);
      }
    });
    
    // Ejecutar batch write
    await batch.commit();
    
    console.log(`\n📊 RESULTADO DE IMPORTACIÓN:`);
    console.log(`   ✅ Exitosos: ${successCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📈 Total: ${processedData.length}`);
    
    return {
      success: true,
      successCount,
      errorCount,
      total: processedData.length,
      errors: errors.length > 0 ? errors : null,
      message: `✅ Importación completada: ${successCount} pagos registrados${errorCount > 0 ? `, ${errorCount} errores` : ''}`
    };
    
  } catch (error) {
    console.error('🔴 ERROR CRÍTICO al importar pagos:', error);
    throw new Error(`Error al guardar en Firestore: ${error.message}`);
  }
}

/**
 * FUNCIÓN PRINCIPAL: Orquestar todo el proceso
 */
async function handlePaymentImport(file, db) {
  console.log('🚀 INICIANDO IMPORTACIÓN DE PAGOS');
  console.log(`📁 Archivo: ${file.name}`);
  console.log(`⏰ Tiempo: ${new Date().toLocaleString()}`);
  
  try {
    // Paso 1: Leer Excel
    console.log('\n📖 Paso 1: Leyendo archivo Excel...');
    const workbook = await readExcelFile(file);
    
    // Paso 2: Obtener datos de "CONTROL GENERAL"
    console.log('\n📋 Paso 2: Obteniendo hoja CONTROL GENERAL...');
    const rawData = getSheetData(workbook, 'CONTROL GENERAL');
    
    // Paso 3: Filtrar solo Gimnasia Artística Infantil
    console.log('\n🎯 Paso 3: Filtrando Gimnasia Artística Infantil...');
    const filteredData = filterGimnasiaArtistica(rawData);
    
    if (filteredData.length === 0) {
      throw new Error('❌ No hay registros de Gimnasia Artística Infantil en el archivo');
    }
    
    // Paso 4: Validar datos
    console.log('\n✅ Paso 4: Validando datos...');
    const isValid = validateData(filteredData);
    
    if (!isValid) {
      console.warn('⚠️  Se encontraron errores en la validación');
    }
    
    // Paso 5: Procesar datos
    console.log('\n📊 Paso 5: Procesando datos...');
    const processedData = processPaymentData(filteredData);
    
    // Paso 6: Importar a Firestore
    console.log('\n💾 Paso 6: Importando a Firestore...');
    const result = await importPaymentsToFirestore(db, processedData);
    
    // Resultado final
    console.log('\n✅ IMPORTACIÓN EXITOSA');
    console.log(result.message);
    console.log(`\n🎉 ${result.successCount} alumnos de Gimnasia Artística Infantil registrados`);
    
    return result;
    
  } catch (error) {
    console.error('❌ ERROR EN IMPORTACIÓN:', error.message);
    throw error;
  }
}

// ============================================================
// CÓMO USAR ESTE PARSER EN BulkPaymentImport.tsx
// ============================================================
//
// En tu componente, reemplaza la función handleFileUpload():
//
// async function handleFileUpload(file) {
//   try {
//     const result = await handlePaymentImport(file, db);
//     console.log(result);
//     
//     // Mostrar éxito al usuario
//     showSuccessNotification(
//       `✅ ${result.successCount} alumnos importados de Gimnasia Artística Infantil`
//     );
//     
//     // Actualizar tabla de pagos
//     await refrescarTabla();
//     
//   } catch (error) {
//     console.error('Error:', error.message);
//     showErrorNotification(error.message);
//   }
// }
//
// ============================================================

// Exportar funciones
export {
  readExcelFile,
  getSheetData,
  filterGimnasiaArtistica,
  validateData,
  processPaymentData,
  importPaymentsToFirestore,
  handlePaymentImport
};
