// ============================================================
// 🛡️ SST GAMEHUB v2.0 - BACKEND CON GEMINI AI
// ============================================================

// ▶️ EJECUTAR ESTA FUNCIÓN PARA CREAR LAS HOJAS MANUALES
// En el editor: selecciona "SETUP_CrearHojasManuales" y dale al botón ▶️ Ejecutar
function SETUP_CrearHojasManuales() {
  var resultado = crearHojasManuales();
  if (resultado && resultado.success) {
    Logger.log('✅ ' + resultado.message);
    SpreadsheetApp.getUi().alert('✅ ¡Hojas creadas!\n\n' + resultado.message + '\n\nAbre tu Google Sheet y verás las nuevas pestañas:\n- Quiz_Manual\n- Mahjong_Manual\n- Memoria_Manual\n- DragDrop_Manual\n- Simulacion_Manual\n\nCada una tiene ejemplos. Solo llena las filas.');
  } else {
    var errorMsg = (resultado && resultado.error) ? resultado.error : 'crearHojasManuales() devolvió una respuesta nula o inválida';
    Logger.log('❌ Error: ' + errorMsg);
    SpreadsheetApp.getUi().alert('❌ Error:\n' + errorMsg);
  }
}

// Default config (overridden by Script Properties when available)
const CONFIG = {
  SPREADSHEET_ID: '1IUsFpuV5PPqQ-Ym62Vdy7nWfueumpxSc7fCasM-Ojes',
  SHEET_PERSONAL: 'PERSONAL',
  SHEET_RESULTADOS: 'RESULTADOS',
  SHEET_CONTENIDO: 'CONTENIDO_IA',
  GEMINI_API_KEY: 'TU_GEMINI_API_KEY_AQUI',
  OPENAI_API_KEY: '',
  AI_PROVIDER: 'auto', // 'auto' | 'gemini' | 'openai'
  USE_REAL_API: false
};

// Load dynamic config from Script Properties (saved via Admin UI)
function loadConfig_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const savedKey = props.getProperty('GEMINI_API_KEY');
    const savedSheet = props.getProperty('SPREADSHEET_ID');
    const savedOpenAI = props.getProperty('OPENAI_API_KEY');
    const savedProvider = props.getProperty('AI_PROVIDER');
    if (savedKey && savedKey !== 'TU_GEMINI_API_KEY_AQUI') {
      CONFIG.GEMINI_API_KEY = savedKey;
      CONFIG.USE_REAL_API = true;
    }
    if (savedOpenAI && savedOpenAI.startsWith('sk-')) {
      CONFIG.OPENAI_API_KEY = savedOpenAI;
      CONFIG.USE_REAL_API = true;
    }
    if (savedProvider) {
      CONFIG.AI_PROVIDER = savedProvider;
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
function saveConfigFromAdmin(apiKey, sheetId, openaiKey, aiProvider) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (apiKey) props.setProperty('GEMINI_API_KEY', apiKey);
    if (sheetId) props.setProperty('SPREADSHEET_ID', sheetId);
    if (openaiKey) props.setProperty('OPENAI_API_KEY', openaiKey);
    if (aiProvider) props.setProperty('AI_PROVIDER', aiProvider);

    // Reload config immediately
    if (apiKey && apiKey !== 'TU_GEMINI_API_KEY_AQUI') {
      CONFIG.GEMINI_API_KEY = apiKey;
      CONFIG.USE_REAL_API = true;
    }
    if (openaiKey && openaiKey.startsWith('sk-')) {
      CONFIG.OPENAI_API_KEY = openaiKey;
      CONFIG.USE_REAL_API = true;
    }
    if (aiProvider) {
      CONFIG.AI_PROVIDER = aiProvider;
    }
    if (sheetId && sheetId !== 'TU_SPREADSHEET_ID_AQUI') {
      CONFIG.SPREADSHEET_ID = sheetId;
    }

    // Test connections
    var status = { success: true, geminiConnected: false, openaiConnected: false, sheetConnected: false };

    // Test Sheet
    try {
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      ss.getName();
      status.sheetConnected = true;
    } catch(e) { status.sheetError = e.message; }

    // Test Gemini
    var hasGemini = CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY !== 'TU_GEMINI_API_KEY_AQUI';
    if (hasGemini) {
      try {
        var testUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + CONFIG.GEMINI_API_KEY;
        var testPayload = { contents: [{ parts: [{ text: 'Responde solo: {"ok":true}' }] }], generationConfig: { maxOutputTokens: 20 } };
        var resp = UrlFetchApp.fetch(testUrl, { method: 'post', contentType: 'application/json', payload: JSON.stringify(testPayload), muteHttpExceptions: true });
        var code = resp.getResponseCode();
        status.geminiConnected = (code === 200);
        if (code !== 200) status.geminiError = 'HTTP ' + code + ': ' + resp.getContentText().substring(0, 200);
      } catch(e) { status.geminiError = e.message; }
    }

    // Test OpenAI
    var hasOpenAI = CONFIG.OPENAI_API_KEY && CONFIG.OPENAI_API_KEY.startsWith('sk-');
    if (hasOpenAI) {
      try {
        var resp = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
          method: 'post',
          contentType: 'application/json',
          headers: { 'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY },
          payload: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Responde solo: {"ok":true}' }],
            max_tokens: 20,
            response_format: { type: 'json_object' }
          }),
          muteHttpExceptions: true
        });
        var code = resp.getResponseCode();
        status.openaiConnected = (code === 200);
        if (code !== 200) status.openaiError = 'HTTP ' + code + ': ' + resp.getContentText().substring(0, 200);
      } catch(e) { status.openaiError = e.message; }
    }

    // Backward compatibility
    status.apiConnected = status.geminiConnected || status.openaiConnected;
    if (!status.apiConnected) {
      status.apiError = [status.geminiError, status.openaiError].filter(Boolean).join(' | ') || 'Sin API Keys configuradas';
    }

    return status;
  } catch(e) { return { success: false, error: e.message }; }
}

function getConfigStatus() {
  try {
    var props = PropertiesService.getScriptProperties();
    var apiKey = props.getProperty('GEMINI_API_KEY') || CONFIG.GEMINI_API_KEY;
    var openaiKey = props.getProperty('OPENAI_API_KEY') || CONFIG.OPENAI_API_KEY;
    var sheetId = props.getProperty('SPREADSHEET_ID') || CONFIG.SPREADSHEET_ID;
    var aiProvider = props.getProperty('AI_PROVIDER') || CONFIG.AI_PROVIDER;
    var hasGemini = apiKey && apiKey !== 'TU_GEMINI_API_KEY_AQUI';
    var hasOpenAI = openaiKey && openaiKey.startsWith('sk-');
    var hasSheet = sheetId && sheetId !== 'TU_SPREADSHEET_ID_AQUI';
    return {
      hasApiKey: hasGemini || hasOpenAI,
      hasGeminiKey: hasGemini,
      hasOpenAIKey: hasOpenAI,
      apiKeyPreview: hasGemini ? apiKey.substring(0, 8) + '...' : '',
      openaiKeyPreview: hasOpenAI ? openaiKey.substring(0, 7) + '...' : '',
      hasSheetId: hasSheet,
      sheetIdPreview: hasSheet ? sheetId.substring(0, 12) + '...' : '',
      aiProvider: aiProvider,
      useRealApi: hasGemini || hasOpenAI
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

// ============================================================
// 🤖 OPENAI (ChatGPT) ENGINE
// ============================================================

function callOpenAI(prompt, fileData) {
  if (!CONFIG.OPENAI_API_KEY || !CONFIG.OPENAI_API_KEY.startsWith('sk-')) {
    return { data: null, error: 'OpenAI API Key no configurada.' };
  }
  try {
    var messages = [];

    // System message
    messages.push({
      role: 'system',
      content: 'Eres un experto en Seguridad y Salud en el Trabajo (SST). Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques Markdown.'
    });

    // User message with optional file
    var userContent = [];

    // If there's an image, add it (OpenAI supports base64 images via vision)
    if (fileData && fileData.base64 && fileData.mimeType) {
      var imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (imageTypes.indexOf(fileData.mimeType) !== -1) {
        userContent.push({
          type: 'image_url',
          image_url: { url: 'data:' + fileData.mimeType + ';base64,' + fileData.base64 }
        });
        userContent.push({ type: 'text', text: prompt });
      } else {
        // For non-image files, decode text and append to prompt
        try {
          var decoded = Utilities.newBlob(Utilities.base64Decode(fileData.base64)).getDataAsString();
          if (decoded && decoded.length > 10) {
            userContent.push({ type: 'text', text: prompt + '\n\n--- CONTENIDO DEL DOCUMENTO ---\n' + decoded.substring(0, 15000) });
          } else {
            userContent.push({ type: 'text', text: prompt });
          }
        } catch(decErr) {
          userContent.push({ type: 'text', text: prompt });
        }
      }
    } else {
      userContent.push({ type: 'text', text: prompt });
    }

    messages.push({ role: 'user', content: userContent });

    var models = ['gpt-4o-mini', 'gpt-3.5-turbo'];

    for (var m = 0; m < models.length; m++) {
      var payload = {
        model: models[m],
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      };

      // gpt-3.5-turbo doesn't support image_url, simplify content
      if (models[m] === 'gpt-3.5-turbo') {
        var simplifiedMessages = JSON.parse(JSON.stringify(messages));
        for (var i = 0; i < simplifiedMessages.length; i++) {
          if (Array.isArray(simplifiedMessages[i].content)) {
            var textParts = simplifiedMessages[i].content.filter(function(p) { return p.type === 'text'; });
            simplifiedMessages[i].content = textParts.map(function(p) { return p.text; }).join('\n');
          }
        }
        payload.messages = simplifiedMessages;
        delete payload.response_format; // gpt-3.5-turbo may not support json_object
      }

      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
      var httpCode = response.getResponseCode();
      var responseText = response.getContentText();
      Logger.log('OPENAI HTTP ' + httpCode + ' (' + models[m] + '): ' + responseText.substring(0, 300));

      if (httpCode === 404) continue; // Model not available, try next

      if (httpCode !== 200) {
        var errDetail = '';
        try {
          var errJson = JSON.parse(responseText);
          errDetail = errJson.error ? errJson.error.message : responseText.substring(0, 200);
        } catch(e) { errDetail = responseText.substring(0, 200); }

        // If rate limited or server error on first model, try next
        if ((httpCode === 429 || httpCode >= 500) && m < models.length - 1) {
          continue;
        }
        return { data: null, error: 'OpenAI HTTP ' + httpCode + ' (' + models[m] + '): ' + errDetail };
      }

      // Parse response
      var result = JSON.parse(responseText);
      if (result.choices && result.choices[0] && result.choices[0].message) {
        var text = result.choices[0].message.content;
        Logger.log('RESPUESTA CRUDA DE OPENAI (' + models[m] + '): ' + text.substring(0, 500));

        // Limpieza de Markdown
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        try {
          return { data: JSON.parse(text), error: null };
        } catch(e) {
          var match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try { return { data: JSON.parse(match[0]), error: null }; } catch(e2) {}
          }
          return { data: null, error: 'Error parseando JSON de OpenAI: ' + e.message + '. Respuesta: ' + text.substring(0, 300) };
        }
      }

      return { data: null, error: 'OpenAI no generó respuesta.' };
    }

    return { data: null, error: 'Ningún modelo de OpenAI disponible.' };
  } catch(err) {
    return { data: null, error: 'Error de conexión con OpenAI: ' + err.message };
  }
}

// ============================================================
// 🔄 MOTOR IA UNIFICADO - Intenta Gemini, luego OpenAI
// ============================================================

function callAI(prompt, fileData) {
  loadConfig_();

  var hasGemini = CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY !== 'TU_GEMINI_API_KEY_AQUI';
  var hasOpenAI = CONFIG.OPENAI_API_KEY && CONFIG.OPENAI_API_KEY.startsWith('sk-');

  // Si el usuario eligió un proveedor específico
  if (CONFIG.AI_PROVIDER === 'openai' && hasOpenAI) {
    var result = callOpenAI(prompt, fileData);
    if (result.data) return result;
    // Si falla OpenAI y hay Gemini, intenta como fallback
    if (hasGemini) {
      Logger.log('OpenAI falló, intentando Gemini como fallback...');
      return callGeminiAI(prompt, fileData);
    }
    return result;
  }

  if (CONFIG.AI_PROVIDER === 'gemini' && hasGemini) {
    var result = callGeminiAI(prompt, fileData);
    if (result.data) return result;
    // Si falla Gemini y hay OpenAI, intenta como fallback
    if (hasOpenAI) {
      Logger.log('Gemini falló, intentando OpenAI como fallback...');
      return callOpenAI(prompt, fileData);
    }
    return result;
  }

  // Modo 'auto': intenta Gemini primero, luego OpenAI
  if (hasGemini) {
    var geminiResult = callGeminiAI(prompt, fileData);
    if (geminiResult.data) return geminiResult;
    Logger.log('Gemini falló en modo auto: ' + geminiResult.error);

    if (hasOpenAI) {
      Logger.log('Intentando OpenAI como fallback...');
      return callOpenAI(prompt, fileData);
    }
    return geminiResult;
  }

  if (hasOpenAI) {
    return callOpenAI(prompt, fileData);
  }

  return { data: null, error: 'No hay API Key configurada. Configura Gemini y/o OpenAI en la pestaña Configuración.' };
}

// Simple test function - called from Admin UI
function testAIConnection() {
  loadConfig_();
  var results = [];

  // Test Gemini
  var hasGemini = CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY !== 'TU_GEMINI_API_KEY_AQUI';
  if (hasGemini) {
    var gResult = callGeminiAI('Responde solo con este JSON exacto: {"ok":true,"message":"Conexión exitosa"}', null);
    results.push({
      provider: 'Gemini',
      success: !!(gResult.data && gResult.data.ok),
      message: gResult.data ? 'Conectado y funcionando' : (gResult.error || 'Sin respuesta')
    });
  }

  // Test OpenAI
  var hasOpenAI = CONFIG.OPENAI_API_KEY && CONFIG.OPENAI_API_KEY.startsWith('sk-');
  if (hasOpenAI) {
    var oResult = callOpenAI('Responde solo con este JSON exacto: {"ok":true,"message":"Conexión exitosa"}', null);
    results.push({
      provider: 'OpenAI',
      success: !!(oResult.data && oResult.data.ok),
      message: oResult.data ? 'Conectado y funcionando' : (oResult.error || 'Sin respuesta')
    });
  }

  if (results.length === 0) {
    return { success: false, message: 'No hay API Keys configuradas.' };
  }

  var anySuccess = results.some(function(r) { return r.success; });
  var msgs = results.map(function(r) { return (r.success ? '✅' : '❌') + ' ' + r.provider + ': ' + r.message; });
  return { success: anySuccess, message: msgs.join(' | '), details: results };
}

// Keep backward compatibility
function testGeminiConnection() {
  return testAIConnection();
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

function reassembleChunkedUpload_(uploadId, totalChunks) {
  var cache = CacheService.getScriptCache();
  var keys = [];
  for (var i = 0; i < totalChunks; i++) {
    keys.push('upload_' + uploadId + '_chunk_' + i);
  }

  var allChunks = cache.getAll(keys);
  var fullBase64 = '';
  for (var j = 0; j < totalChunks; j++) {
    var key = 'upload_' + uploadId + '_chunk_' + j;
    var chunk = allChunks[key];
    if (!chunk) {
      return { success: false, error: 'Fragmento ' + j + ' de ' + totalChunks + ' se perdió. Intenta subir el archivo de nuevo.' };
    }
    fullBase64 += chunk;
  }
  cache.removeAll(keys);
  return { success: true, base64: fullBase64 };
}

function buildManualQuizPrompt_(questionCount, textBase, fileName) {
  var count = parseInt(questionCount, 10);
  if (!count || count < 1) count = 5;
  if (count > 20) count = 20;

  var prompt = 'INSTRUCCIONES CRITICAS: Responde UNICAMENTE con JSON valido. No uses markdown ni texto adicional. ' +
    'Genera exactamente ' + count + ' preguntas de SST para un quiz educativo basadas en el contenido recibido.' +
    '\n\nEstructura requerida:' +
    '\n{"questions":[{"question":"Texto de la pregunta","options":["Opcion A","Opcion B","Opcion C","Opcion D"],"correct":0,"explanation":"Breve explicacion"}]}' +
    '\n\nReglas:' +
    '\n- Exactamente ' + count + ' preguntas.' +
    '\n- Cada pregunta debe tener exactamente 4 opciones.' +
    '\n- "correct" debe ser un indice entre 0 y 3.' +
    '\n- Las preguntas deben salir del contenido real del documento o texto base.' +
    '\n- Evita preguntas ambiguas o repetidas.' +
    '\n- Usa español claro y profesional.';

  if (textBase) {
    prompt += '\n\nTEXTO BASE:\n' + textBase.substring(0, 15000);
  }
  if (fileName) {
    prompt += '\n\nArchivo analizado: ' + fileName;
  }
  return prompt;
}

function normalizeQuizQuestions_(questions) {
  var result = [];
  for (var i = 0; i < (questions || []).length; i++) {
    var q = questions[i] || {};
    var options = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
    while (options.length < 4) options.push('');
    var correct = parseInt(q.correct, 10);
    if (isNaN(correct) || correct < 0 || correct > 3) correct = 0;
    var question = String(q.question || q.pregunta || '').trim();
    if (!question) continue;

    result.push({
      question: question,
      options: options.map(function(opt) { return String(opt || '').trim(); }),
      correct: correct,
      explanation: String(q.explanation || q.explicacion || '').trim()
    });
  }
  return result;
}

function saveQuizQuestionsToManualSheet_(questions, replaceExisting) {
  crearHojasManuales();

  var ss = openSpreadsheet_();
  var sh = ss.getSheetByName('Quiz_Manual');
  if (!sh) return { success: false, error: 'No se encontró la hoja Quiz_Manual.' };

  if (replaceExisting && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
  }

  var rows = questions.map(function(q) {
    return [
      q.question,
      q.options[0],
      q.options[1],
      q.options[2],
      q.options[3],
      q.correct + 1,
      q.explanation
    ];
  });

  if (!rows.length) return { success: false, error: 'La IA no devolvió preguntas válidas.' };

  var startRow = sh.getLastRow() + 1;
  sh.getRange(startRow, 1, rows.length, 7).setValues(rows);
  return { success: true, added: rows.length, message: rows.length + ' pregunta(s) guardadas en Quiz_Manual.' };
}

function generateManualQuizWithAI(questionCount, textBase, fileBase64, fileName, mimeType, replaceExisting) {
  try {
    var count = parseInt(questionCount, 10);
    if (!count || count < 1) return { success: false, error: 'Indica cuántas preguntas quieres generar.' };
    if (!textBase && !fileBase64) return { success: false, error: 'Debes escribir un texto o subir un archivo.' };

    var prompt = buildManualQuizPrompt_(count, textBase, fileName);
    var fileData = fileBase64 ? { base64: fileBase64, mimeType: mimeType || 'application/octet-stream' } : null;
    var aiResult = callAI(prompt, fileData);
    if (!aiResult.data || !aiResult.data.questions) {
      return { success: false, error: aiResult.error || 'La IA no devolvió preguntas.' };
    }

    var questions = normalizeQuizQuestions_(aiResult.data.questions);
    if (!questions.length) {
      return { success: false, error: 'La IA respondió, pero no con preguntas utilizables.' };
    }

    var saveResult = saveQuizQuestionsToManualSheet_(questions, !!replaceExisting);
    if (!saveResult.success) return saveResult;

    return {
      success: true,
      questions: questions,
      saved: saveResult.added,
      message: saveResult.message
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function generateManualQuizWithAIChunked(uploadId, totalChunks, fileName, mimeType, questionCount, textBase, replaceExisting) {
  var assembled = reassembleChunkedUpload_(uploadId, totalChunks);
  if (!assembled.success) return assembled;
  return generateManualQuizWithAI(questionCount, textBase, assembled.base64, fileName, mimeType, replaceExisting);
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

  // Try AI (Gemini → OpenAI fallback)
  var aiResult = callAI(prompt, { base64: fileBase64, mimeType: mimeType });

  // If AI returned data, validate it
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
    // 1) PRIMERO: Intentar hojas manuales (datos ingresados por humano)
    try {
      var manualData = leerDatosManual(gameType);
      if (manualData) {
        Logger.log('Usando datos MANUALES para: ' + gameType);
        return manualData;
      }
    } catch(e) { Logger.log('Manual data error: ' + e.message); }

    // 2) Intentar contenido guardado por IA en hoja CONTENIDO_IA
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

    // 3) Intentar Gemini/OpenAI API
    try {
      var prompt = buildGenerationPrompt(gameType, params);
      var aiResult = callAI(prompt, null);
      if (aiResult.data) return aiResult.data;
    } catch(e) { Logger.log('AI error: ' + e.message); }

    // 4) Fallback: datos predeterminados
    return simulateAIResponse(gameType, params || {});

  } catch(finalErr) {
    Logger.log('CRITICAL fallback: ' + finalErr.message);
    return simulateAIResponse(gameType, {});
  }
}

function buildGenerationPrompt(gameType, params) {
  return buildFilePrompt(gameType, '');
}

function getExplanationFromAI(context) {
  const prompt = `Explica en máximo 2 oraciones por qué "${context.correct}" es correcto en SST. El usuario eligió "${context.userAnswer}". Responde SOLO JSON: {"explanation":"tu explicación"}`;
  const aiResult = callAI(prompt, null);
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
// 📦 RESPALDO VACÍO — Solo se usa si NO hay datos en hojas manuales
// ============================================================
function simulateAIResponse(gameType, params) {
  // Retorna estructura mínima indicando que se deben llenar las hojas manuales
  switch(gameType) {
    case 'mahjong': return { pairs: [{id:1, concept:"📊 Sin datos", match:"Llena la hoja Mahjong_Manual"}] };
    case 'memoria': return { pairs: [{id:1, front:"📊", back:"SIN DATOS", explanation:"Llena la hoja Memoria_Manual en tu Google Sheet."}] };
    case 'dragdrop': return { categories: [{name:"Sin datos",color:"#999"}], items: [{id:1, text:"Llena la hoja DragDrop_Manual", category:"Sin datos", explanation:"Abre tu Google Sheet y completa la hoja DragDrop_Manual."}] };
    case 'quiz': return { questions: [{id:1, question:"No hay preguntas configuradas. Llena la hoja Quiz_Manual.", options:["Ir al Admin","Abrir Google Sheet","Agregar preguntas","Todas las anteriores"], correct:3, explanation:"Ve a tu Google Sheet y llena la hoja Quiz_Manual con tus propias preguntas."}] };
    case 'simulacion': return { scenario: {title:"Sin escenario", description:"Llena la hoja Simulacion_Manual en tu Google Sheet.", environment:"vacio"}, hazards: [{id:1, name:"Sin datos", description:"Configura tus escenarios", severity:"baja", x:50, y:50, width:20, height:20, solution:"Abre Simulacion_Manual y agrega filas."}] };
    default: return { questions: [{id:1, question:"Sin datos. Configura las hojas manuales.", options:["Opción A","Opción B","Opción C","Opción D"], correct:0, explanation:"Usa el panel Admin para crear las hojas manuales."}] };
  }
}

// ============================================================
// 📊 HOJAS MANUALES - Crear y leer contenido manual por juego
// ============================================================

const MANUAL_SHEETS = {
  quiz: {
    sheetName: 'Quiz_Manual',
    columns: [
      { key: 'pregunta', label: 'Pregunta', required: true },
      { key: 'opcion_a', label: 'Opción A', required: true },
      { key: 'opcion_b', label: 'Opción B', required: true },
      { key: 'opcion_c', label: 'Opción C', required: true },
      { key: 'opcion_d', label: 'Opción D', required: true },
      { key: 'correcta', label: 'Correcta (1-4)', required: true },
      { key: 'explicacion', label: 'Explicación', required: false }
    ]
  },
  mahjong: {
    sheetName: 'Mahjong_Manual',
    columns: [
      { key: 'concepto', label: 'Concepto', required: true },
      { key: 'definicion', label: 'Definición', required: true }
    ]
  },
  memoria: {
    sheetName: 'Memoria_Manual',
    columns: [
      { key: 'emoji', label: 'Emoji', required: true },
      { key: 'concepto', label: 'Concepto', required: true },
      { key: 'explicacion', label: 'Explicación', required: false }
    ]
  },
  dragdrop: {
    sheetName: 'DragDrop_Manual',
    columns: [
      { key: 'categoria', label: 'Categoría', required: true },
      { key: 'color_hex', label: 'Color Hex', required: false },
      { key: 'elemento', label: 'Elemento', required: true },
      { key: 'explicacion', label: 'Explicación', required: false }
    ]
  },
  simulacion: {
    sheetName: 'Simulacion_Manual',
    columns: [
      { key: 'escenario_id', label: 'Escenario ID', required: true },
      { key: 'titulo', label: 'Título', required: true },
      { key: 'descripcion_escenario', label: 'Descripción', required: false },
      { key: 'ambiente', label: 'Ambiente', required: false },
      { key: 'nombre_peligro', label: 'Nombre peligro', required: true },
      { key: 'desc_peligro', label: 'Descripción peligro', required: false },
      { key: 'severidad', label: 'Severidad', required: false },
      { key: 'x', label: 'X', required: false },
      { key: 'y', label: 'Y', required: false },
      { key: 'ancho', label: 'Ancho', required: false },
      { key: 'alto', label: 'Alto', required: false },
      { key: 'solucion', label: 'Solución', required: false }
    ]
  }
};

function getManualSheetDefinition_(gameType) {
  return MANUAL_SHEETS[String(gameType || '').toLowerCase()] || null;
}

function openSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getManualSheetSchemas() {
  return MANUAL_SHEETS;
}

function getManualSheetRecords(gameType) {
  try {
    var def = getManualSheetDefinition_(gameType);
    if (!def) return { success: false, error: 'Juego manual no soportado.' };

    var ss = openSpreadsheet_();
    var sh = ss.getSheetByName(def.sheetName);
    if (!sh) {
      return { success: true, sheetName: def.sheetName, columns: def.columns, records: [] };
    }

    var lastRow = sh.getLastRow();
    if (lastRow < 2) {
      return { success: true, sheetName: def.sheetName, columns: def.columns, records: [] };
    }

    var data = sh.getRange(2, 1, lastRow - 1, def.columns.length).getValues();
    var records = [];
    for (var i = 0; i < data.length; i++) {
      var rowValues = data[i];
      var record = { row: i + 2 };
      var hasContent = false;
      for (var j = 0; j < def.columns.length; j++) {
        var rawValue = rowValues[j];
        var value = rawValue === null || rawValue === undefined ? '' : String(rawValue);
        record[def.columns[j].key] = value;
        if (value.trim() !== '') hasContent = true;
      }
      if (hasContent) records.push(record);
    }

    return { success: true, sheetName: def.sheetName, columns: def.columns, records: records };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function saveManualSheetRecord(gameType, payload) {
  try {
    var def = getManualSheetDefinition_(gameType);
    if (!def) return { success: false, error: 'Juego manual no soportado.' };

    crearHojasManuales();

    var ss = openSpreadsheet_();
    var sh = ss.getSheetByName(def.sheetName);
    if (!sh) return { success: false, error: 'No se encontró la hoja manual ' + def.sheetName };

    payload = payload || {};
    var values = [];
    var hasRequired = false;

    for (var i = 0; i < def.columns.length; i++) {
      var col = def.columns[i];
      var value = payload[col.key];
      value = value === null || value === undefined ? '' : String(value).trim();
      if (col.required && value !== '') hasRequired = true;
      values.push(value);
    }

    if (!hasRequired) {
      return { success: false, error: 'Debes completar al menos los campos principales del registro.' };
    }

    var row = parseInt(payload.row, 10);
    if (row && row >= 2) {
      sh.getRange(row, 1, 1, values.length).setValues([values]);
      return { success: true, message: 'Registro actualizado correctamente.', row: row };
    }

    sh.appendRow(values);
    return { success: true, message: 'Registro agregado correctamente.', row: sh.getLastRow() };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function deleteManualSheetRecord(gameType, row) {
  try {
    var def = getManualSheetDefinition_(gameType);
    if (!def) return { success: false, error: 'Juego manual no soportado.' };

    var ss = openSpreadsheet_();
    var sh = ss.getSheetByName(def.sheetName);
    if (!sh) return { success: false, error: 'No se encontró la hoja manual.' };

    row = parseInt(row, 10);
    if (!row || row < 2 || row > sh.getLastRow()) {
      return { success: false, error: 'La fila indicada no es válida.' };
    }

    sh.deleteRow(row);
    return { success: true, message: 'Registro eliminado correctamente.' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function crearHojasManuales() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var creadas = [];

    // --- QUIZ ---
    if (!ss.getSheetByName('Quiz_Manual')) {
      var sh = ss.insertSheet('Quiz_Manual');
      sh.appendRow(['PREGUNTA','OPCION_A','OPCION_B','OPCION_C','OPCION_D','CORRECTA (1-4)','EXPLICACION']);
      sh.getRange(1,1,1,7).setFontWeight('bold').setBackground('#7c4dff').setFontColor('#fff');
      sh.setColumnWidth(1, 300); sh.setColumnWidth(7, 300);
      for (var c = 2; c <= 5; c++) sh.setColumnWidth(c, 180);
      sh.setColumnWidth(6, 120);
      // Ejemplo
      sh.appendRow(['¿Altura mínima para trabajo en altura?','1.00 m','1.50 m','1.80 m','2.50 m','3','Desde 1.80m sobre el nivel del piso.']);
      sh.appendRow(['¿Qué indica señal triangular amarilla?','Prohibición','Advertencia','Obligación','Emergencia','2','Triángulo amarillo = ADVERTENCIA.']);
      // Validación columna CORRECTA
      var rule = SpreadsheetApp.newDataValidation().requireNumberBetween(1,4).setHelpText('Ingresa 1, 2, 3 o 4').build();
      sh.getRange(2, 6, 100, 1).setDataValidation(rule);
      creadas.push('Quiz_Manual');
    }

    // --- MAHJONG ---
    if (!ss.getSheetByName('Mahjong_Manual')) {
      var sh = ss.insertSheet('Mahjong_Manual');
      sh.appendRow(['CONCEPTO (con emoji)','DEFINICION (máx 8 palabras)']);
      sh.getRange(1,1,1,2).setFontWeight('bold').setBackground('#e74c3c').setFontColor('#fff');
      sh.setColumnWidth(1, 250); sh.setColumnWidth(2, 350);
      sh.appendRow(['🪖 Casco','Protección craneal contra impactos']);
      sh.appendRow(['🥽 Gafas','Protección ocular ante partículas']);
      sh.appendRow(['🧤 Guantes','Protección de manos contra químicos']);
      sh.appendRow(['👂 Tapones','Reducción de ruido mayor a 85dB']);
      creadas.push('Mahjong_Manual');
    }

    // --- MEMORIA ---
    if (!ss.getSheetByName('Memoria_Manual')) {
      var sh = ss.insertSheet('Memoria_Manual');
      sh.appendRow(['EMOJI','CONCEPTO (MAYÚSCULAS)','EXPLICACION']);
      sh.getRange(1,1,1,3).setFontWeight('bold').setBackground('#1e88e5').setFontColor('#fff');
      sh.setColumnWidth(1, 80); sh.setColumnWidth(2, 220); sh.setColumnWidth(3, 400);
      sh.appendRow(['🪖','CASCO','El casco protege la cabeza contra impactos. Obligatorio en obra.']);
      sh.appendRow(['🥽','GAFAS','Protegen los ojos contra partículas y salpicaduras.']);
      sh.appendRow(['🧤','GUANTES','Protegen manos contra cortes y productos químicos.']);
      creadas.push('Memoria_Manual');
    }

    // --- DRAG & DROP ---
    if (!ss.getSheetByName('DragDrop_Manual')) {
      var sh = ss.insertSheet('DragDrop_Manual');
      sh.appendRow(['CATEGORIA','COLOR_HEX','ELEMENTO','EXPLICACION']);
      sh.getRange(1,1,1,4).setFontWeight('bold').setBackground('#f39c12').setFontColor('#fff');
      sh.setColumnWidth(1, 200); sh.setColumnWidth(2, 100); sh.setColumnWidth(3, 250); sh.setColumnWidth(4, 350);
      sh.appendRow(['EPP Obligatorio','#e74c3c','Casco de seguridad','EPP de protección craneal obligatorio en obra.']);
      sh.appendRow(['EPP Obligatorio','#e74c3c','Arnés anticaídas','EPP obligatorio sobre 1.80m de altura.']);
      sh.appendRow(['EPP Obligatorio','#e74c3c','Guantes dieléctricos','EPP contra descargas eléctricas.']);
      sh.appendRow(['Señalización','#f39c12','Señal prohibido fumar','Señal roja que prohíbe fumar en el área.']);
      sh.appendRow(['Señalización','#f39c12','Triángulo amarillo','Señal de advertencia sobre peligro.']);
      sh.appendRow(['Señalización','#f39c12','Flecha verde evacuación','Indica dirección de escape.']);
      sh.appendRow(['Procedimiento','#3498db','Permiso trabajo caliente','Documento requerido antes de soldadura.']);
      sh.appendRow(['Procedimiento','#3498db','Análisis Trabajo Seguro','Documento con pasos, peligros y controles.']);
      sh.appendRow(['Procedimiento','#3498db','Bloqueo LOTO','Aislamiento de energías en mantenimiento.']);
      // Nota en celda F1
      sh.getRange('F1').setValue('INSTRUCCIONES: Usa la misma CATEGORIA para agrupar. 3 categorías, 3 elementos c/u = 9 filas mínimo.');
      sh.getRange('F1').setFontWeight('bold').setFontColor('#e74c3c');
      creadas.push('DragDrop_Manual');
    }

    // --- SIMULACION ---
    if (!ss.getSheetByName('Simulacion_Manual')) {
      var sh = ss.insertSheet('Simulacion_Manual');
      sh.appendRow(['ESCENARIO_ID','TITULO','DESCRIPCION_ESCENARIO','AMBIENTE','NOMBRE_PELIGRO','DESC_PELIGRO','SEVERIDAD','X','Y','ANCHO','ALTO','SOLUCION']);
      sh.getRange(1,1,1,12).setFontWeight('bold').setBackground('#27ae60').setFontColor('#fff');
      sh.setColumnWidth(1, 100); sh.setColumnWidth(2, 200); sh.setColumnWidth(3, 300); sh.setColumnWidth(4, 120);
      sh.setColumnWidth(5, 200); sh.setColumnWidth(6, 250); sh.setColumnWidth(7, 100);
      sh.setColumnWidth(12, 300);
      // Validación severidad
      var sevRule = SpreadsheetApp.newDataValidation().requireValueInList(['baja','media','alta','critica']).build();
      sh.getRange(2, 7, 100, 1).setDataValidation(sevRule);
      // Ejemplo: un escenario con 3 peligros
      sh.appendRow(['ESC1','Obra de Construcción','Inspecciona esta obra. Busca condiciones inseguras.','construccion','Trabajador sin casco','Obrero sin protección craneal','alta','15','25','14','18','Detener actividad. Casco es EPP obligatorio.']);
      sh.appendRow(['ESC1','Obra de Construcción','','construccion','Andamio sin barandas','Plataforma sin protección','alta','50','12','22','14','Instalar barandas a 1.05m.']);
      sh.appendRow(['ESC1','Obra de Construcción','','construccion','Cables expuestos','Cableado sin protección','alta','72','55','12','20','Canaletas + conexiones GFCI.']);
      // Nota
      sh.getRange('N1').setValue('INSTRUCCIONES: Peligros del mismo escenario comparten ESCENARIO_ID. X,Y,ANCHO,ALTO son % (0-100).');
      sh.getRange('N1').setFontWeight('bold').setFontColor('#e74c3c');
      creadas.push('Simulacion_Manual');
    }

    if (creadas.length === 0) {
      return { success: true, message: 'Las hojas ya existían. No se crearon nuevas.' };
    }
    return { success: true, message: 'Hojas creadas: ' + creadas.join(', '), hojas: creadas };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ===== LEER DATOS MANUALES POR JUEGO =====

function leerDatosManualQuiz() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName('Quiz_Manual');
    if (!sh || sh.getLastRow() < 2) return null;
    var data = sh.getDataRange().getValues();
    var questions = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0] || String(data[i][0]).trim() === '') continue;
      var correcta = parseInt(data[i][5]);
      if (isNaN(correcta) || correcta < 1 || correcta > 4) correcta = 1;
      questions.push({
        id: questions.length + 1,
        question: String(data[i][0]).trim(),
        options: [String(data[i][1]).trim(), String(data[i][2]).trim(), String(data[i][3]).trim(), String(data[i][4]).trim()],
        correct: correcta - 1, // Convertir 1-4 a índice 0-3
        explanation: String(data[i][6] || '').trim()
      });
    }
    if (questions.length === 0) return null;
    // Barajar y tomar hasta 10
    questions.sort(function() { return Math.random() - 0.5; });
    return { questions: questions.slice(0, 10) };
  } catch(e) { Logger.log('Manual quiz error: ' + e.message); return null; }
}

function leerDatosManualMahjong() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName('Mahjong_Manual');
    if (!sh || sh.getLastRow() < 2) return null;
    var data = sh.getDataRange().getValues();
    var pairs = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0] || String(data[i][0]).trim() === '') continue;
      pairs.push({
        id: pairs.length + 1,
        concept: String(data[i][0]).trim(),
        match: String(data[i][1]).trim()
      });
    }
    if (pairs.length === 0) return null;
    pairs.sort(function() { return Math.random() - 0.5; });
    return { pairs: pairs.slice(0, 12) };
  } catch(e) { Logger.log('Manual mahjong error: ' + e.message); return null; }
}

function leerDatosManualMemoria() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName('Memoria_Manual');
    if (!sh || sh.getLastRow() < 2) return null;
    var data = sh.getDataRange().getValues();
    var pairs = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0] || String(data[i][0]).trim() === '') continue;
      pairs.push({
        id: pairs.length + 1,
        front: String(data[i][0]).trim(),
        back: String(data[i][1]).trim(),
        explanation: String(data[i][2] || '').trim()
      });
    }
    if (pairs.length === 0) return null;
    pairs.sort(function() { return Math.random() - 0.5; });
    return { pairs: pairs.slice(0, 8) };
  } catch(e) { Logger.log('Manual memoria error: ' + e.message); return null; }
}

function leerDatosManualDragDrop() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName('DragDrop_Manual');
    if (!sh || sh.getLastRow() < 2) return null;
    var data = sh.getDataRange().getValues();
    var catMap = {}; // {nombre: color}
    var items = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0] || String(data[i][0]).trim() === '') continue;
      var catName = String(data[i][0]).trim();
      var color = String(data[i][1] || '#3498db').trim();
      if (!catMap[catName]) catMap[catName] = color;
      items.push({
        id: items.length + 1,
        text: String(data[i][2]).trim(),
        category: catName,
        explanation: String(data[i][3] || '').trim()
      });
    }
    var categories = [];
    for (var name in catMap) {
      categories.push({ name: name, color: catMap[name] });
    }
    if (categories.length === 0 || items.length === 0) return null;
    items.sort(function() { return Math.random() - 0.5; });
    return { categories: categories, items: items };
  } catch(e) { Logger.log('Manual dragdrop error: ' + e.message); return null; }
}

function leerDatosManualSimulacion() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sh = ss.getSheetByName('Simulacion_Manual');
    if (!sh || sh.getLastRow() < 2) return null;
    var data = sh.getDataRange().getValues();
    var escenarios = {}; // {escId: {scenario:{}, hazards:[]}}
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0] || String(data[i][0]).trim() === '') continue;
      var escId = String(data[i][0]).trim();
      if (!escenarios[escId]) {
        escenarios[escId] = {
          scenario: {
            title: String(data[i][1]).trim(),
            description: String(data[i][2]).trim(),
            environment: String(data[i][3]).trim()
          },
          hazards: []
        };
      }
      escenarios[escId].hazards.push({
        id: escenarios[escId].hazards.length + 1,
        name: String(data[i][4]).trim(),
        description: String(data[i][5] || '').trim(),
        severity: String(data[i][6] || 'media').trim(),
        x: parseInt(data[i][7]) || 20,
        y: parseInt(data[i][8]) || 20,
        width: parseInt(data[i][9]) || 15,
        height: parseInt(data[i][10]) || 15,
        solution: String(data[i][11] || '').trim()
      });
    }
    var keys = Object.keys(escenarios);
    if (keys.length === 0) return null;
    // Elegir uno al azar
    var picked = escenarios[keys[Math.floor(Math.random() * keys.length)]];
    return picked;
  } catch(e) { Logger.log('Manual simulacion error: ' + e.message); return null; }
}

// ===== Función unificada: leer manual por tipo =====
function leerDatosManual(gameType) {
  switch(gameType) {
    case 'quiz': return leerDatosManualQuiz();
    case 'mahjong': return leerDatosManualMahjong();
    case 'memoria': return leerDatosManualMemoria();
    case 'dragdrop': return leerDatosManualDragDrop();
    case 'simulacion': return leerDatosManualSimulacion();
    default: return null;
  }
}

// genSimulacion eliminado — los datos ahora vienen de Simulacion_Manual
