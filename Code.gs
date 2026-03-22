// ============================================================
// 🛡️ SST GAMEHUB v2.0 - BACKEND CON GEMINI AI
// ============================================================

// Default config (overridden by Script Properties when available)
const CONFIG = {
  SPREADSHEET_ID: '1IUsFpuV5PPqQ-Ym62Vdy7nWfueumpxSc7fCasM-Ojes',
  SHEET_PERSONAL: 'PERSONAL',
  SHEET_RESULTADOS: 'RESULTADOS',
  SHEET_CONTENIDO: 'CONTENIDO_IA',
  GEMINI_API_KEY: 'AIzaSyALlrf-0Gys2i6S9yrV3CdWoVAHWoA7dkg',
  USE_REAL_API: true
};

// Load dynamic config from Script Properties (saved via Admin UI)
function loadConfig_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const savedKey = props.getProperty('GEMINI_API_KEY');
    const savedSheet = props.getProperty('SPREADSHEET_ID');
    if (savedKey && savedKey !== 'TU_GEMINI_API_KEY_AQUI') {
      CONFIG.GEMINI_API_KEY = savedKey;
      CONFIG.USE_REAL_API = true;
    }
    if (savedSheet && savedSheet !== 'TU_SPREADSHEET_ID_AQUI') {
      CONFIG.SPREADSHEET_ID = savedSheet;
    }
  } catch(e) { Logger.log('loadConfig error: ' + e.message); }
}

// Auto-load config on every execution
loadConfig_();

// ===== SERVIR PÁGINAS =====
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'Portal';
  const valid = ['Portal','Admin','Mahjong','Memoria','DragDrop','Quiz','Simulacion'];
  if (valid.indexOf(page) === -1) return HtmlService.createHtmlOutput('<h1>Página no encontrada</h1>');
  
  return HtmlService.createHtmlOutputFromFile(page)
    .setTitle('SST GameHub - ' + page)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ===== LOGIN =====
function validateLogin(dni) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_PERSONAL);
    if (!sheet) return { success: false, error: 'Pestaña PERSONAL no encontrada' };
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(dni).trim()) {
        return {
          success: true,
          user: { dni: String(data[i][0]).trim(), nombre: String(data[i][1]).trim(), apellido: String(data[i][2]).trim() }
        };
      }
    }
    return { success: false, error: 'DNI no registrado en el sistema' };
  } catch(err) {
    return { success: false, error: 'Error: ' + err.message };
  }
}

// ===== GUARDAR RESULTADOS =====
function saveScore(d) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sh = ss.getSheetByName(CONFIG.SHEET_RESULTADOS);
    if (!sh) {
      sh = ss.insertSheet(CONFIG.SHEET_RESULTADOS);
      sh.appendRow(['FECHA','DNI','NOMBRE','JUEGO','PUNTAJE','TIEMPO','DETALLES']);
      sh.getRange(1,1,1,7).setFontWeight('bold').setBackground('#ff6b35').setFontColor('#fff');
    }
    const fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    sh.appendRow([fecha, d.dni, d.nombre, d.juego, d.puntaje, d.tiempo||'', d.detalles||'']);
    return { success: true };
  } catch(err) { return { success: false, error: err.message }; }
}

function getScoreHistory(dni) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sh = ss.getSheetByName(CONFIG.SHEET_RESULTADOS);
    if (!sh) return { success: true, scores: [] };
    const data = sh.getDataRange().getValues();
    const scores = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(dni).trim()) {
        scores.push({ fecha: data[i][0], juego: data[i][3], puntaje: data[i][4], tiempo: data[i][5] });
      }
    }
    return { success: true, scores };
  } catch(err) { return { success: false, scores: [] }; }
}

function getWebAppUrl() { return ScriptApp.getService().getUrl(); }

// ===== CONFIGURACIÓN DINÁMICA =====
function saveConfigFromAdmin(apiKey, sheetId) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (apiKey) props.setProperty('GEMINI_API_KEY', apiKey);
    if (sheetId) props.setProperty('SPREADSHEET_ID', sheetId);
    // Reload config immediately
    if (apiKey && apiKey !== 'TU_GEMINI_API_KEY_AQUI') {
      CONFIG.GEMINI_API_KEY = apiKey;
      CONFIG.USE_REAL_API = true;
    }
    if (sheetId && sheetId !== 'TU_SPREADSHEET_ID_AQUI') {
      CONFIG.SPREADSHEET_ID = sheetId;
    }
    // Test connection
    var status = { success: true, apiConnected: false, sheetConnected: false };
    // Test Sheet
    try {
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      ss.getName();
      status.sheetConnected = true;
    } catch(e) { status.sheetError = e.message; }
    // Test Gemini
    if (CONFIG.USE_REAL_API) {
      try {
        var testUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + CONFIG.GEMINI_API_KEY;
        var testPayload = { contents: [{ parts: [{ text: 'Responde solo: {"ok":true}' }] }], generationConfig: { maxOutputTokens: 20 } };
        var resp = UrlFetchApp.fetch(testUrl, { method: 'post', contentType: 'application/json', payload: JSON.stringify(testPayload), muteHttpExceptions: true });
        var code = resp.getResponseCode();
        status.apiConnected = (code === 200);
        if (code !== 200) status.apiError = 'HTTP ' + code + ': ' + resp.getContentText().substring(0, 200);
      } catch(e) { status.apiError = e.message; }
    }
    return status;
  } catch(e) { return { success: false, error: e.message }; }
}

function getConfigStatus() {
  try {
    var props = PropertiesService.getScriptProperties();
    var apiKey = props.getProperty('GEMINI_API_KEY') || CONFIG.GEMINI_API_KEY;
    var sheetId = props.getProperty('SPREADSHEET_ID') || CONFIG.SPREADSHEET_ID;
    var hasKey = apiKey && apiKey !== 'TU_GEMINI_API_KEY_AQUI';
    var hasSheet = sheetId && sheetId !== 'TU_SPREADSHEET_ID_AQUI';
    return {
      hasApiKey: hasKey,
      apiKeyPreview: hasKey ? apiKey.substring(0, 8) + '...' : '',
      hasSheetId: hasSheet,
      sheetIdPreview: hasSheet ? sheetId.substring(0, 12) + '...' : '',
      useRealApi: hasKey
    };
  } catch(e) { return { hasApiKey: false, hasSheetId: false, useRealApi: false }; }
}

// ============================================================
// 🤖 GEMINI AI ENGINE
// ============================================================

function callGeminiAI(prompt, fileData) {
  if (!CONFIG.USE_REAL_API || CONFIG.GEMINI_API_KEY === 'TU_GEMINI_API_KEY_AQUI') {
    return null; // Will use fallback
  }
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + CONFIG.GEMINI_API_KEY;
    
    const parts = [{ text: prompt }];
    
    // If file data is provided (base64), add as inline data
    if (fileData && fileData.base64 && fileData.mimeType) {
      parts.unshift({
        inlineData: { mimeType: fileData.mimeType, data: fileData.base64 }
      });
    }
    
    const payload = {
      contents: [{ parts: parts }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: "application/json"
      }
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      const text = result.candidates[0].content.parts[0].text;
      try { return JSON.parse(text); } catch(e) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return { text: text };
      }
    }
    return null;
  } catch(err) {
    Logger.log('Gemini error: ' + err.message);
    return null;
  }
}

// ===== PROCESAR ARCHIVO SUBIDO =====
function processUploadedFile(fileBase64, fileName, mimeType, gameType) {
  const prompt = buildFilePrompt(gameType, fileName);
  const geminiResult = callGeminiAI(prompt, { base64: fileBase64, mimeType: mimeType });
  
  if (geminiResult && (geminiResult.pairs || geminiResult.questions || geminiResult.categories || geminiResult.scenario)) {
    // Save to CONTENIDO sheet
    saveGeneratedContent(gameType, geminiResult, fileName);
    return { success: true, data: geminiResult, source: 'gemini' };
  }
  
  // Fallback to simulation
  const simulated = simulateAIResponse(gameType, {});
  saveGeneratedContent(gameType, simulated, 'Simulado - ' + fileName);
  return { success: true, data: simulated, source: 'simulado' };
}

function buildFilePrompt(gameType, fileName) {
  const prompts = {
    'mahjong': `Analiza este documento/imagen sobre seguridad y salud en el trabajo. 
Genera exactamente 12 pares de conceptos para un juego de Mahjong educativo.
Responde SOLO con JSON válido con esta estructura:
{"pairs":[{"id":1,"concept":"concepto corto con emoji","match":"definición corta"}]}
Los conceptos deben ser específicos del contenido del documento.`,

    'memoria': `Analiza este documento/imagen sobre SST.
Genera exactamente 8 pares para un juego de memoria educativo.
Responde SOLO con JSON:
{"pairs":[{"id":1,"front":"emoji","back":"CONCEPTO","explanation":"explicación educativa de 1-2 oraciones"}]}`,

    'dragdrop': `Analiza este documento/imagen sobre SST.
Genera 3 categorías y 9 elementos para clasificar en un juego de arrastrar y soltar.
Responde SOLO con JSON:
{"categories":[{"name":"Categoría","color":"#hexcolor"}],"items":[{"id":1,"text":"elemento","category":"nombre categoría exacto","explanation":"por qué pertenece aquí"}]}`,

    'quiz': `Analiza este documento/imagen sobre SST.
Genera exactamente 10 preguntas de quiz con 4 opciones cada una.
Responde SOLO con JSON:
{"questions":[{"id":1,"question":"pregunta","options":["A","B","C","D"],"correct":0,"explanation":"explicación educativa"}]}`,

    'simulacion': `Analiza este documento/imagen sobre SST.
Genera un escenario de inspección de riesgos basado en el contenido.
Responde SOLO con JSON:
{"scenario":{"title":"título","description":"descripción","environment":"construccion"},
"hazards":[{"id":1,"name":"peligro","description":"detalle","severity":"alta","x":20,"y":30,"width":15,"height":15,"solution":"cómo mitigar"}]}`
  };
  return prompts[gameType] || prompts['quiz'];
}

function saveGeneratedContent(gameType, data, source) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sh = ss.getSheetByName(CONFIG.SHEET_CONTENIDO);
    if (!sh) {
      sh = ss.insertSheet(CONFIG.SHEET_CONTENIDO);
      sh.appendRow(['FECHA','JUEGO','FUENTE','CONTENIDO_JSON']);
      sh.getRange(1,1,1,4).setFontWeight('bold').setBackground('#ff6b35').setFontColor('#fff');
    }
    const fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    sh.appendRow([fecha, gameType, source, JSON.stringify(data)]);
  } catch(e) { Logger.log('Save content error: ' + e.message); }
}

// ===== GET CONTENT (tries saved first, then generates) =====
function getAIContent(gameType, params) {
  // SAFETY: This function must NEVER return null
  try {
    // 1) Try saved content from sheet
    try {
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      var sh = ss.getSheetByName(CONFIG.SHEET_CONTENIDO);
      if (sh && sh.getLastRow() > 1) {
        var data = sh.getDataRange().getValues();
        var matching = [];
        for (var i = data.length - 1; i >= 1; i--) {
          if (String(data[i][1]).trim().toLowerCase() === String(gameType).toLowerCase()) {
            matching.push(data[i][3]);
          }
        }
        if (matching.length > 0) {
          var picked = matching[Math.floor(Math.random() * matching.length)];
          var parsed = JSON.parse(picked);
          if (parsed) return parsed;
        }
      }
    } catch(e) { Logger.log('Saved content error: ' + e.message); }
    
    // 2) Try Gemini API
    try {
      var prompt = buildGenerationPrompt(gameType, params);
      var geminiResult = callGeminiAI(prompt, null);
      if (geminiResult) return geminiResult;
    } catch(e) { Logger.log('Gemini error: ' + e.message); }
    
    // 3) Fallback: ALWAYS return simulated data
    return simulateAIResponse(gameType, params || {});
    
  } catch(finalErr) {
    // 4) Ultimate safety net - return hardcoded minimal data
    Logger.log('CRITICAL fallback: ' + finalErr.message);
    return simulateAIResponse(gameType, {});
  }
}

function buildGenerationPrompt(gameType, params) {
  return buildFilePrompt(gameType, '');
}

function getExplanationFromAI(context) {
  const prompt = `Explica en máximo 2 oraciones por qué "${context.correct}" es correcto en SST. El usuario eligió "${context.userAnswer}". Responde SOLO JSON: {"explanation":"tu explicación"}`;
  const result = callGeminiAI(prompt, null);
  if (result && result.explanation) return result;
  return { explanation: `Recuerda: "${context.correct}" es fundamental en SST para la prevención de accidentes laborales.` };
}

// ===== GET SAVED CONTENT LIST (for Admin panel) =====
function getSavedContentList() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sh = ss.getSheetByName(CONFIG.SHEET_CONTENIDO);
    if (!sh) return [];
    const data = sh.getDataRange().getValues();
    const list = [];
    for (let i = 1; i < data.length; i++) {
      list.push({ fecha: data[i][0], juego: data[i][1], fuente: data[i][2], row: i + 1 });
    }
    return list;
  } catch(e) { return []; }
}

function deleteContent(row) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sh = ss.getSheetByName(CONFIG.SHEET_CONTENIDO);
    if (sh) sh.deleteRow(row);
    return { success: true };
  } catch(e) { return { success: false }; }
}

// ============================================================
// 📦 SIMULADOR DE IA (Banco de datos SST)
// ============================================================
function simulateAIResponse(gameType, params) {
  switch(gameType) {
    case 'mahjong': return genMahjong();
    case 'memoria': return genMemoria();
    case 'dragdrop': return genDragDrop();
    case 'quiz': return genQuiz();
    case 'simulacion': return genSimulacion();
    default: return genQuiz();
  }
}

function genMahjong() {
  const all = [
    {concept:"🪖 Casco", match:"Protección craneal contra impactos"},
    {concept:"🥽 Gafas", match:"Protección ocular ante partículas"},
    {concept:"🧤 Guantes", match:"Protección de manos contra químicos"},
    {concept:"👂 Tapones", match:"Reducción de ruido mayor a 85dB"},
    {concept:"🦺 Chaleco", match:"Visibilidad en zonas de tránsito"},
    {concept:"😷 Respirador", match:"Filtración de partículas 95%"},
    {concept:"👢 Botas", match:"Contra aplastamiento en pies"},
    {concept:"🔗 Arnés", match:"Prevención caídas sobre 1.80m"},
    {concept:"🔴 Prohibición", match:"Señal que indica acción NO permitida"},
    {concept:"🟡 Advertencia", match:"Señal que alerta sobre peligro"},
    {concept:"🔵 Obligación", match:"Señal de acción obligatoria"},
    {concept:"🟢 Evacuación", match:"Señal de ruta de escape"},
    {concept:"⚡ Eléctrico", match:"Peligro por contacto con corriente"},
    {concept:"🔥 Incendio", match:"Peligro por material inflamable"},
    {concept:"📋 IPERC", match:"Identificar Peligros y Evaluar Riesgos"},
    {concept:"🔒 LOTO", match:"Bloqueo y etiquetado de energía"},
    {concept:"📝 ATS", match:"Análisis de Trabajo Seguro"},
    {concept:"🚨 Emergencia", match:"Protocolo ante situación crítica"},
  ];
  const shuffled = all.sort(() => Math.random() - 0.5).slice(0, 12);
  return { pairs: shuffled.map((p,i) => ({id:i+1, concept:p.concept, match:p.match})) };
}

function genMemoria() {
  const pool = [
    {front:"🪖",back:"CASCO",explanation:"El casco protege la cabeza contra impactos. Obligatorio en zonas con riesgo de caída de objetos."},
    {front:"🥽",back:"GAFAS",explanation:"Protegen los ojos contra partículas, salpicaduras y radiación UV."},
    {front:"🧤",back:"GUANTES",explanation:"Protegen manos contra cortes, quemaduras y productos químicos."},
    {front:"👂",back:"PROTECCIÓN AUDITIVA",explanation:"Obligatoria cuando el ruido supera 85 dB durante 8 horas."},
    {front:"🦺",back:"CHALECO",explanation:"Aumenta la visibilidad del trabajador en zonas con tránsito."},
    {front:"😷",back:"RESPIRADOR",explanation:"Filtra partículas y gases. El N95 filtra el 95% de partículas."},
    {front:"👢",back:"BOTAS",explanation:"Punta de acero protege contra aplastamiento y perforación."},
    {front:"🔗",back:"ARNÉS",explanation:"Obligatorio sobre 1.80m. Inspeccionar antes de cada uso."},
    {front:"🔥",back:"EXTINTOR",explanation:"Conocer ubicación y uso del extintor más cercano es obligatorio."},
    {front:"🚑",back:"PRIMEROS AUXILIOS",explanation:"Botiquín accesible y personal capacitado es obligatorio."},
    {front:"📋",back:"IPERC",explanation:"Base de la gestión SST: Identificar Peligros, Evaluar Riesgos."},
    {front:"🔒",back:"LOTO",explanation:"Bloqueo y Etiquetado: aislar energías peligrosas en mantenimiento."},
  ];
  return { pairs: pool.sort(() => Math.random()-0.5).slice(0,8).map((p,i) => ({id:i+1,...p})) };
}

function genDragDrop() {
  const sets = [
    {
      categories:[{name:"EPP Obligatorio",color:"#e74c3c"},{name:"Señalización",color:"#f39c12"},{name:"Procedimiento",color:"#3498db"}],
      items:[
        {text:"Casco de seguridad",category:"EPP Obligatorio",explanation:"EPP de protección craneal obligatorio en obra."},
        {text:"Señal prohibido fumar",category:"Señalización",explanation:"Señal roja que prohíbe fumar en el área."},
        {text:"Permiso trabajo caliente",category:"Procedimiento",explanation:"Documento requerido antes de soldadura o fuego."},
        {text:"Arnés anticaídas",category:"EPP Obligatorio",explanation:"EPP obligatorio sobre 1.80m de altura."},
        {text:"Triángulo amarillo peligro",category:"Señalización",explanation:"Señal de advertencia sobre peligro existente."},
        {text:"Análisis Trabajo Seguro",category:"Procedimiento",explanation:"Documento con pasos, peligros y controles."},
        {text:"Guantes dieléctricos",category:"EPP Obligatorio",explanation:"EPP contra descargas eléctricas."},
        {text:"Flecha verde evacuación",category:"Señalización",explanation:"Indica dirección de escape en emergencia."},
        {text:"Bloqueo LOTO",category:"Procedimiento",explanation:"Aislamiento de energías en mantenimiento."},
      ]
    },
    {
      categories:[{name:"Riesgo Físico",color:"#e74c3c"},{name:"Riesgo Químico",color:"#9b59b6"},{name:"Riesgo Ergonómico",color:"#27ae60"}],
      items:[
        {text:"Ruido mayor a 85 dB",category:"Riesgo Físico",explanation:"Causa daño auditivo irreversible."},
        {text:"Vapores de solventes",category:"Riesgo Químico",explanation:"Afectan vías respiratorias y sistema nervioso."},
        {text:"Posturas forzadas",category:"Riesgo Ergonómico",explanation:"Causan trastornos musculoesqueléticos."},
        {text:"Vibraciones maquinaria",category:"Riesgo Físico",explanation:"Causan daño vascular y neurológico."},
        {text:"Ácido sulfúrico",category:"Riesgo Químico",explanation:"Corrosivo, quemaduras graves en piel."},
        {text:"Carga manual > 25 kg",category:"Riesgo Ergonómico",explanation:"Riesgo de lesión lumbar."},
        {text:"Radiación UV solar",category:"Riesgo Físico",explanation:"Quemaduras y riesgo de cáncer de piel."},
        {text:"Polvo de sílice",category:"Riesgo Químico",explanation:"Causa silicosis, enfermedad irreversible."},
        {text:"Movimientos repetitivos",category:"Riesgo Ergonómico",explanation:"Causan túnel carpiano y tendinitis."},
      ]
    }
  ];
  const s = sets[Math.floor(Math.random()*sets.length)];
  return { categories: s.categories, items: s.items.sort(() => Math.random()-0.5).map((it,i) => ({id:i+1,...it})) };
}

function genQuiz() {
  const pool = [
    {question:"¿Altura mínima para 'trabajo en altura'?",options:["1.00 m","1.50 m","1.80 m","2.50 m"],correct:2,explanation:"Se considera trabajo en altura desde 1.80m sobre el nivel del piso."},
    {question:"¿Qué indica una señal triangular amarilla?",options:["Prohibición","Advertencia","Obligación","Emergencia"],correct:1,explanation:"Triángulo amarillo = ADVERTENCIA. Alerta sobre peligros."},
    {question:"¿Extintor ideal para fuegos eléctricos?",options:["Agua","Espuma","CO2","Tipo K"],correct:2,explanation:"CO2 no conduce electricidad ni deja residuos."},
    {question:"¿Qué significa IPERC?",options:["Inspección Eléctrica","Identificación de Peligros y Evaluación de Riesgos","Informe de Prevención","Indicador de Peligrosidad"],correct:1,explanation:"IPERC: Identificar Peligros, Evaluar Riesgos y Controles."},
    {question:"¿Tiempo máximo a 85 dB sin protección?",options:["2 horas","4 horas","8 horas","12 horas"],correct:2,explanation:"Límite: 85 dB por 8 horas. +3 dB = mitad de tiempo."},
    {question:"¿Qué es LOTO?",options:["Limpieza y Orden","Bloqueo y Etiquetado","Lista de Observaciones","Logística Operativa"],correct:1,explanation:"LOTO aísla fuentes de energía durante mantenimiento."},
    {question:"¿Peso máximo para levantamiento manual?",options:["15 kg","20 kg","25 kg","30 kg"],correct:2,explanation:"Máximo 25 kg. Más requiere ayuda mecánica."},
    {question:"¿Cuándo inspeccionar un arnés?",options:["Cada semana","Antes de cada uso","Cada mes","Cada 6 meses"],correct:1,explanation:"SIEMPRE antes de cada uso: costuras, hebillas, cintas."},
    {question:"¿Primero ante un accidente?",options:["Llamar al jefe","Asegurar la escena","Mover al herido","Buscar culpables"],correct:1,explanation:"Primero ASEGURAR LA ESCENA para evitar más víctimas."},
    {question:"¿Color de señales de obligación?",options:["Rojo","Amarillo","Azul","Verde"],correct:2,explanation:"AZUL = Obligación. Indica acciones que se DEBEN cumplir."},
    {question:"¿Qué es ATS?",options:["Área de Trabajo","Análisis de Trabajo Seguro","Auditoría Técnica","Acta de Trabajo"],correct:1,explanation:"ATS documenta pasos, peligros y controles de una tarea."},
    {question:"¿Fuego de metales combustibles?",options:["Clase A","Clase B","Clase C","Clase D"],correct:3,explanation:"Clase D: metales como magnesio, titanio, sodio."},
    {question:"¿Vías evacuación mínimas para +50 personas?",options:["1","2","3","4"],correct:1,explanation:"Mínimo 2 vías independientes y señalizadas."},
    {question:"¿Polvo de sílice es riesgo...?",options:["Físico","Químico","Biológico","Ergonómico"],correct:1,explanation:"QUÍMICO: causa silicosis, enfermedad pulmonar irreversible."},
    {question:"¿Qué contiene la Hoja MSDS?",options:["Manual seguridad","Datos seguridad sustancias","Mapa señalización","Método supervisión"],correct:1,explanation:"MSDS: propiedades, peligros, manejo de sustancias químicas."},
  ];
  return { questions: pool.sort(() => Math.random()-0.5).slice(0,10).map((q,i) => ({id:i+1,...q})) };
}

function genSimulacion() {
  const scenes = [
    {
      scenario:{title:"🏗️ Obra de Construcción",description:"Inspecciona esta obra. Haz clic en las zonas donde detectes peligros o condiciones inseguras.",environment:"construccion"},
      hazards:[
        {id:1,name:"Trabajador sin casco",description:"Obrero sin protección craneal",severity:"alta",x:15,y:25,width:14,height:18,solution:"Detener actividad. Casco es EPP obligatorio."},
        {id:2,name:"Andamio sin barandas",description:"Plataforma sin protección perimetral",severity:"alta",x:50,y:12,width:22,height:14,solution:"Instalar barandas a 1.05m con rodapié."},
        {id:3,name:"Cables expuestos",description:"Cableado sin protección en zona húmeda",severity:"alta",x:72,y:55,width:12,height:20,solution:"Canaletas + conexiones GFCI."},
        {id:4,name:"Herramientas al borde",description:"Objetos sin asegurar en filo",severity:"media",x:35,y:8,width:16,height:12,solution:"Rodapié + cinturones portaherramientas."},
        {id:5,name:"Escalera mal apoyada",description:"Sin amarre y ángulo incorrecto",severity:"media",x:5,y:50,width:12,height:25,solution:"Ángulo 75°, amarrar arriba, sobresalir 1m."},
        {id:6,name:"Excavación sin señalizar",description:"Zanja sin barreras ni señales",severity:"alta",x:55,y:72,width:20,height:14,solution:"Barreras rígidas + señales de advertencia."},
      ]
    },
    {
      scenario:{title:"🔧 Taller de Soldadura",description:"Inspecciona este taller. Encuentra todas las condiciones inseguras.",environment:"taller"},
      hazards:[
        {id:1,name:"Soldador sin careta",description:"Sin protección facial",severity:"alta",x:20,y:30,width:14,height:18,solution:"Careta con filtro adecuado obligatoria."},
        {id:2,name:"Cilindros sin asegurar",description:"Gas comprimido sin cadena",severity:"alta",x:65,y:20,width:12,height:22,solution:"Cadenas + posición vertical + capuchón."},
        {id:3,name:"Material inflamable",description:"Trapos con aceite cerca de soldadura",severity:"alta",x:40,y:62,width:18,height:14,solution:"Retirar a +10m. Mantas ignífugas."},
        {id:4,name:"Sin ventilación",description:"Sin extractor de humos",severity:"media",x:10,y:10,width:22,height:12,solution:"Extractores localizados por estación."},
        {id:5,name:"Cable dañado",description:"Aislamiento roto, cobre expuesto",severity:"alta",x:45,y:38,width:14,height:12,solution:"Reemplazar inmediatamente."},
        {id:6,name:"Sin permiso de trabajo",description:"Falta permiso trabajo en caliente",severity:"media",x:80,y:65,width:12,height:18,solution:"Permiso firmado y vigente obligatorio."},
      ]
    },
    {
      scenario:{title:"☢️ Almacén Químico",description:"Inspecciona el almacén. Identifica violaciones a normas de almacenamiento.",environment:"almacen"},
      hazards:[
        {id:1,name:"Químicos incompatibles",description:"Ácidos junto a bases",severity:"alta",x:15,y:28,width:20,height:16,solution:"Separar según matriz compatibilidad. Mín 3m."},
        {id:2,name:"Sin ducha emergencia",description:"Sin ducha ni lavaojos",severity:"alta",x:78,y:15,width:14,height:20,solution:"Ducha y lavaojos a menos de 10 seg."},
        {id:3,name:"Envases sin etiqueta",description:"Sin identificación SGA",severity:"alta",x:42,y:45,width:18,height:14,solution:"Etiqueta SGA con pictogramas obligatoria."},
        {id:4,name:"Derrames en piso",description:"Líquido sin contención",severity:"media",x:30,y:72,width:20,height:12,solution:"Kit antiderrames + diques de contención."},
        {id:5,name:"Ventilación deficiente",description:"Sin extracción de vapores",severity:"media",x:55,y:8,width:22,height:12,solution:"Ventilación forzada, 6 renovaciones/hora."},
        {id:6,name:"MSDS incompletas",description:"Hojas de Seguridad faltantes",severity:"media",x:5,y:55,width:12,height:18,solution:"MSDS actualizadas para toda sustancia."},
      ]
    }
  ];
  return scenes[Math.floor(Math.random()*scenes.length)];
}
