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

// callGeminiAI now returns { data: ..., error: ... } instead of just data or null
function callGeminiAI(prompt, fileData) {
  if (!CONFIG.USE_REAL_API || CONFIG.GEMINI_API_KEY === 'TU_GEMINI_API_KEY_AQUI') {
    return { data: null, error: 'IA no activada. USE_REAL_API=' + CONFIG.USE_REAL_API + '. Configura tu API Key en la pestaña Configuración.' };
  }
  try {
    // Try multiple model names in case one isn't available
    var models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    var lastError = '';

    for (var m = 0; m < models.length; m++) {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + models[m] + ':generateContent?key=' + CONFIG.GEMINI_API_KEY;

      var parts = [{ text: prompt }];

      // If file data is provided (base64), add as inline data
      if (fileData && fileData.base64 && fileData.mimeType) {
        var supportedTypes = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
        if (supportedTypes.indexOf(fileData.mimeType) !== -1) {
          parts.unshift({
            inlineData: { mimeType: fileData.mimeType, data: fileData.base64 }
          });
        } else {
          // For unsupported types (doc, docx, txt), decode text into prompt
          try {
            var decoded = Utilities.newBlob(Utilities.base64Decode(fileData.base64)).getDataAsString();
            if (decoded && decoded.length > 10) {
              parts[0].text = prompt + '\n\n--- CONTENIDO DEL DOCUMENTO ---\n' + decoded.substring(0, 15000);
            }
          } catch(decErr) { /* ignore decode errors */ }
        }
      }

      var payload = {
        contents: [{ parts: parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: "application/json"
        }
      };

      var options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch(url, options);
      var httpCode = response.getResponseCode();
      var responseText = response.getContentText();
      Logger.log('GEMINI HTTP ' + httpCode + ' (' + models[m] + '): ' + responseText.substring(0, 300));

      if (httpCode === 404) {
        lastError = 'Modelo ' + models[m] + ' no disponible.';
        continue; // Try next model
      }

      if (httpCode !== 200) {
        // Parse error detail from Gemini
        var errDetail = '';
        try {
          var errJson = JSON.parse(responseText);
          errDetail = errJson.error ? errJson.error.message : responseText.substring(0, 200);
        } catch(e) { errDetail = responseText.substring(0, 200); }
        return { data: null, error: 'Gemini HTTP ' + httpCode + ' (' + models[m] + '): ' + errDetail };
      }

      // Success - parse response
      var result = JSON.parse(responseText);

      if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        var text = result.candidates[0].content.parts[0].text;
        Logger.log('RESPUESTA CRUDA DE GEMINI (' + models[m] + '): ' + text.substring(0, 500));

        // LIMPIEZA DE MARKDOWN: Elimina bloques ```json y ```
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        try {
          return { data: JSON.parse(text), error: null };
        } catch(e) {
          // Si falla, intenta extraer lo que esté entre llaves { }
          var match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try { return { data: JSON.parse(match[0]), error: null }; } catch(e2) {}
          }
          return { data: null, error: 'Error parseando JSON: ' + e.message + '. Respuesta: ' + text.substring(0, 300) };
        }
      }

      // Check for blocked content
      if (result.candidates && result.candidates[0] && result.candidates[0].finishReason === 'SAFETY') {
        return { data: null, error: 'Gemini bloqueó el contenido por filtros de seguridad. Intenta con otro archivo.' };
      }

      return { data: null, error: 'Gemini no generó respuesta. Respuesta: ' + responseText.substring(0, 200) };
    }

    return { data: null, error: lastError || 'Ningún modelo de Gemini disponible.' };
  } catch(err) {
    return { data: null, error: 'Error de conexión con Gemini: ' + err.message };
  }
}

// Simple test function - called from Admin UI
function testGeminiConnection() {
  var result = callGeminiAI('Responde solo con este JSON exacto: {"ok":true,"message":"Conexión exitosa"}', null);
  if (result.data && result.data.ok) {
    return { success: true, message: 'Gemini AI funcionando correctamente.' };
  }
  return { success: false, message: result.error || 'Sin respuesta de Gemini.' };
}

// ===== UPLOAD CHUNKED PARA ARCHIVOS GRANDES =====
function uploadFileChunk(uploadId, chunkIndex, chunkData) {
  var cache = CacheService.getScriptCache();
  cache.put('upload_' + uploadId + '_chunk_' + chunkIndex, chunkData, 600); // 10 min expiry
  return { success: true, chunkIndex: chunkIndex };
}

function processChunkedFile(uploadId, totalChunks, fileName, mimeType, gameType) {
  var cache = CacheService.getScriptCache();
  var fullBase64 = '';

  // Retrieve all chunks in batches (getAll supports up to 100 keys)
  var keys = [];
  for (var i = 0; i < totalChunks; i++) {
    keys.push('upload_' + uploadId + '_chunk_' + i);
  }

  var allChunks = cache.getAll(keys);

  for (var i = 0; i < totalChunks; i++) {
    var key = 'upload_' + uploadId + '_chunk_' + i;
    var chunk = allChunks[key];
    if (!chunk) {
      return { success: false, error: 'Fragmento ' + i + ' de ' + totalChunks + ' se perdió. Intenta subir el archivo de nuevo.' };
    }
    fullBase64 += chunk;
  }

  // Clean up cache
  cache.removeAll(keys);

  // Process the reassembled file
  return processUploadedFile(fullBase64, fileName, mimeType, gameType);
}

// ===== PROCESAR ARCHIVO SUBIDO =====
function processUploadedFile(fileBase64, fileName, mimeType, gameType) {
  // Validate inputs
  if (!fileBase64) {
    return { success: false, error: 'No se recibió el archivo. Intenta subirlo de nuevo.' };
  }
  if (!gameType) {
    return { success: false, error: 'No se seleccionó tipo de juego.' };
  }

  // Fix mimeType for common extensions if missing
  if (!mimeType || mimeType === 'application/octet-stream') {
    var ext = (fileName || '').split('.').pop().toLowerCase();
    var mimeMap = { pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', txt:'text/plain' };
    mimeType = mimeMap[ext] || 'application/octet-stream';
  }

  var prompt = buildFilePrompt(gameType, fileName);

  // Try Gemini AI
  var aiResult = callGeminiAI(prompt, { base64: fileBase64, mimeType: mimeType });

  // If Gemini returned data, validate it
  if (aiResult.data) {
    var geminiResult = aiResult.data;
    var isValid = false;
    if (gameType === 'quiz' && geminiResult.questions && geminiResult.questions.length > 0) isValid = true;
    if ((gameType === 'mahjong' || gameType === 'memoria') && geminiResult.pairs && geminiResult.pairs.length > 0) isValid = true;
    if (gameType === 'dragdrop' && geminiResult.categories && geminiResult.items) isValid = true;
    if (gameType === 'simulacion' && geminiResult.scenario && geminiResult.hazards) isValid = true;

    if (isValid) {
      saveGeneratedContent(gameType, geminiResult, fileName);
      return { success: true, data: geminiResult, source: 'gemini' };
    }
    // Gemini returned data but wrong format
    return {
      success: true,
      data: simulateAIResponse(gameType, {}),
      source: 'simulado',
      geminiError: 'Gemini respondió pero en formato incorrecto para ' + gameType + '. Datos recibidos: ' + JSON.stringify(geminiResult).substring(0, 300)
    };
  }

  // Gemini failed - return error details along with fallback
  var simulated = simulateAIResponse(gameType, {});
  return {
    success: true,
    data: simulated,
    source: 'simulado',
    geminiError: aiResult.error || 'Error desconocido al conectar con Gemini'
  };
}

function buildFilePrompt(gameType, fileName) {
  const baseInstructions = "INSTRUCCIONES CRÍTICAS: Responde ÚNICAMENTE con un objeto JSON válido. NO incluyas texto introductorio, conclusiones, explicaciones ni bloques de código Markdown. Tu respuesta debe empezar con { y terminar con }. Analiza el contenido del documento/imagen adjunto sobre Seguridad y Salud en el Trabajo (SST) y genera contenido educativo basado ESPECÍFICAMENTE en lo que dice el documento.";

  const prompts = {
    'mahjong': `${baseInstructions}

Genera exactamente 12 pares de conceptos para un juego de Mahjong educativo.
Cada par debe relacionar un concepto de SST del documento con su definición.

Estructura JSON requerida:
{"pairs":[{"id":1,"concept":"🔥 Concepto corto","match":"Definición breve y clara"}]}

Reglas:
- Exactamente 12 objetos en el array "pairs"
- "concept" debe incluir un emoji relevante y máximo 4 palabras
- "match" debe ser la definición en máximo 8 palabras
- Todo el contenido debe provenir del documento adjunto`,

    'memoria': `${baseInstructions}

Genera exactamente 8 pares para un juego de memoria educativo sobre SST.

Estructura JSON requerida:
{"pairs":[{"id":1,"front":"🔥","back":"CONCEPTO EN MAYÚSCULAS","explanation":"Explicación educativa de 1-2 oraciones basada en el documento"}]}

Reglas:
- Exactamente 8 objetos en el array "pairs"
- "front" es un solo emoji representativo
- "back" es el concepto en MAYÚSCULAS (máximo 3 palabras)
- "explanation" explica el concepto según el documento`,

    'dragdrop': `${baseInstructions}

Genera 3 categorías y 9 elementos (3 por categoría) para un juego de arrastrar y soltar sobre SST.

Estructura JSON requerida:
{"categories":[{"name":"Nombre Categoría","color":"#hexcolor"}],"items":[{"id":1,"text":"Elemento a clasificar","category":"Nombre Categoría exacto","explanation":"Por qué pertenece a esta categoría"}]}

Reglas:
- Exactamente 3 objetos en "categories" con colores hex diferentes
- Exactamente 9 objetos en "items" (3 por categoría)
- El campo "category" de cada item DEBE coincidir exactamente con un "name" de categories
- Contenido basado en el documento adjunto`,

    'quiz': `${baseInstructions}

Genera exactamente 10 preguntas de quiz con 4 opciones cada una.

Estructura JSON requerida:
{"questions":[{"id":1,"question":"¿Pregunta sobre SST basada en el documento?","options":["Opción A","Opción B","Opción C","Opción D"],"correct":0,"explanation":"Explicación de por qué esta es la respuesta correcta según el documento"}]}

Reglas:
- Exactamente 10 objetos en el array "questions"
- "options" siempre tiene exactamente 4 strings
- "correct" es el índice (0-3) de la respuesta correcta
- Las preguntas deben basarse en el contenido específico del documento`,

    'simulacion': `${baseInstructions}

Genera un escenario de inspección de riesgos laborales basado en el contenido del documento.

Estructura JSON requerida:
{"scenario":{"title":"Título del escenario","description":"Descripción de la situación laboral","environment":"tipo de ambiente"},"hazards":[{"id":1,"name":"Nombre del peligro","description":"Descripción detallada del riesgo","severity":"alta","x":20,"y":30,"width":15,"height":15,"solution":"Medida de control o mitigación"}]}

Reglas:
- Un solo objeto "scenario" con title, description y environment
- Entre 4 y 8 objetos en "hazards"
- "severity" puede ser: "baja", "media", "alta" o "critica"
- x, y, width, height son porcentajes (0-100) para posicionar en pantalla
- Los peligros deben basarse en el contenido del documento`
  };

  var prompt = prompts[gameType] || prompts['quiz'];
  if (fileName) {
    prompt += '\n\nArchivo analizado: ' + fileName;
  }
  return prompt;
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
      var aiResult = callGeminiAI(prompt, null);
      if (aiResult.data) return aiResult.data;
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
  const aiResult = callGeminiAI(prompt, null);
  if (aiResult.data && aiResult.data.explanation) return aiResult.data;
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
