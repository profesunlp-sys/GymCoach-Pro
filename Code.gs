/**
 * ARCHIVO: Code.gs
 * Versión optimizada para seguimiento individual de alumnos.
 */

const SPREADSHEET_ID = '1HC8Lrdqu5UZDMNpjMNZZdL44ZgOzSOOHWL3dUrk1czE';
const SHEET_NAME = 'Registro de Clases de Gimnasia';

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('GymCoach Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getTargetSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Añadimos la columna "Presentes (Nombres)" en la posición 6
    sheet.appendRow(['Fecha', 'Grupo', 'Horario', 'Días', 'Edades', 'Presentes (Cant)', 'Presentes (Nombres)', 'Calentamiento', 'Aparatos', 'Detalle Habilidades']);
  }
  return sheet;
}

function saveClassData(jsonData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getTargetSheet(ss);
    const record = JSON.parse(jsonData);
    
    const presentNames = (record.attendance || [])
      .filter(a => a.present)
      .map(a => a.name)
      .join(', ');

    sheet.appendRow([
      record.date,
      record.groupName,
      record.schedule,
      (record.selectedDays || []).join(', '),
      (record.ageGroups || []).join(', '),
      (record.attendance || []).filter(a => a.present).length,
      presentNames, // Nueva columna de nombres
      (record.warmupSkills || []).join(', '),
      (record.apparatus || []).join(', '),
      JSON.stringify(record.apparatusDetails || {})
    ]);
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getHistoryData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getTargetSheet(ss);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return JSON.stringify([]);
    
    const history = data.slice(1).map(row => ({
      date: row[0],
      group: row[1],
      schedule: row[2],
      days: row[3],
      ageGroups: row[4] ? row[4].toString().split(', ') : [],
      presentCount: row[5],
      presentStudents: row[6] ? row[6].toString().split(', ') : [],
      warmup: row[7] ? row[7].toString().split(', ') : [],
      apparatus: row[8] ? row[8].toString().split(', ') : [],
      details: row[9] ? JSON.parse(row[9]) : {}
    }));
    
    return JSON.stringify(history);
  } catch (e) {
    return JSON.stringify([]);
  }
}