/**
 * ARCHIVO: Code.gs
 * Versión optimizada para servir un solo archivo index.html.
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
    sheet.appendRow(['Fecha', 'Grupo', 'Horario', 'Días', 'Edades', 'Asistencia', 'Calentamiento', 'Aparatos', 'Detalle Habilidades']);
  }
  return sheet;
}

function saveClassData(jsonData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getTargetSheet(ss);
    const record = JSON.parse(jsonData);
    
    sheet.appendRow([
      record.date,
      record.groupName,
      record.schedule,
      (record.daysOfWeek || []).join(', '),
      (record.ageGroups || []).join(', '),
      (record.attendance || []).filter(a => a.present).length,
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
      ageGroups: row[4] ? row[4].toString().split(', ') : [],
      presentCount: row[5],
      warmup: row[6] ? row[6].toString().split(', ') : [],
      apparatus: row[7] ? row[7].toString().split(', ') : [],
      details: row[8] ? JSON.parse(row[8]) : {}
    }));
    
    return JSON.stringify(history);
  } catch (e) {
    return JSON.stringify([]);
  }
}