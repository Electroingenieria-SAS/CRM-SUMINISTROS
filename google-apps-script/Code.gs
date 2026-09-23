/**
 * ERP EI · Puente institucional de carga a Google Drive
 *
 * DESPLIEGUE OBLIGATORIO:
 * - Ejecutar como: Yo
 * - Quién tiene acceso: Cualquier persona
 *
 * Los trabajadores no autorizan Google Drive. El script valida la sesión
 * activa de Supabase y carga usando la cuenta institucional propietaria.
 */

const SETTINGS = Object.freeze({
  VERSION: '3.5.0',

  SUPABASE_URL: 'https://hezjxcxxcjlpmyalftam.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_yxgyHILzQVDHrS2MYYkBkA_UfN77JtT',

  // Carpeta institucional suministrada.
  ROOT_FOLDER_ID: '1B9IsvURgsDWxLP84Z7uD3wsDNhh43n_x',

  // Orígenes autorizados para utilizar el puente institucional.
  // IMPORTANTE: aquí van ORIGINS (protocolo + host), nunca rutas.
  // Ejemplo GitHub Pages:
  // URL pública: https://electroingenieria-sas.github.io/CRM-SUMINISTROS/
  // Origin real: https://electroingenieria-sas.github.io
  ALLOWED_ORIGINS: [
    'https://electroingenieria-sas.github.io',
    'https://crm-suministros-amber.vercel.app',
    'https://crm-suministros-jeptacs-projects.vercel.app',
    'https://crm-suministros-git-main-jeptacs-projects.vercel.app',
    'https://ei-erp-google-auth.vercel.app',
    'https://borrador-erp-ei.vercel.app'
  ],

  // Máximo por archivo. Apps Script no es adecuado para archivos gigantes.
  MAX_FILE_BYTES: 15 * 1024 * 1024,

  // La vista previa se solicita solo al abrir la tarjeta del cronograma.
  // Mantener este límite bajo evita respuestas HTML innecesariamente grandes.
  MAX_PREVIEW_BYTES: 5 * 1024 * 1024,

  // PRIVATE mantiene los documentos privados en el Drive institucional.
  SHARING_MODE: 'PRIVATE',

  ALLOWED_EXTENSIONS: ['jpg','jpeg','png','webp','heic','heif','pdf','txt','csv','xls','xlsx','doc','docx','ppt','pptx'],
  BLOCKED_EXTENSIONS: ['html','htm','svg','js','mjs','cjs','exe','dll','msi','bat','cmd','com','scr','ps1','sh','jar','apk','app','dmg','iso']
});

/**
 * Abre la URL /exec para comprobar que el puente esté activo.
 */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>ERP EI · Drive</title></head>' +
    '<body style="font-family:Arial,sans-serif;padding:32px;color:#12345b">' +
    '<h1>ERP EI</h1>' +
    '<p>Puente institucional de Google Drive activo.</p>' +
    '<p>Versión: <strong>' + escapeHtml_(SETTINGS.VERSION) + '</strong></p>' +
    '<p>Carpeta configurada: <strong>' + escapeHtml_(SETTINGS.ROOT_FOLDER_ID) + '</strong></p>' +
    '<p>Orígenes autorizados:</p><ul>' + SETTINGS.ALLOWED_ORIGINS.map(function(origin){ return '<li>' + escapeHtml_(origin) + '</li>'; }).join('') + '</ul>' +
    '</body></html>'
  ).setTitle('ERP EI · Drive');
}

/**
 * Ejecuta manualmente esta función una vez desde el editor.
 * Autoriza Drive y confirma que la carpeta institucional existe.
 */
function probarConfiguracion() {
  const folder = DriveApp.getFolderById(SETTINGS.ROOT_FOLDER_ID);
  const result = {
    ok: true,
    version: SETTINGS.VERSION,
    folderId: folder.getId(),
    folderName: folder.getName(),
    folderUrl: folder.getUrl(),
    sharingMode: SETTINGS.SHARING_MODE,
    allowedOrigins: SETTINGS.ALLOWED_ORIGINS
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Recibe el archivo enviado por el ERP mediante un formulario oculto.
 */
function doPost(e) {
  let request = {};
  try {
    if (!e || !e.parameter || !e.parameter.payload) {
      throw new Error('Solicitud incompleta.');
    }

    request = JSON.parse(e.parameter.payload);
    validateEnvelope_(request);

    const session = validateErpSession_(request.accessToken);
    const action = String(request.action || 'UPLOAD').trim().toUpperCase();

    if (action === 'PREVIEW_WORK_EVIDENCE') {
      const permission = validateWorkEvidencePreview_(request, session);
      const preview = readWorkEvidencePreview_(request.driveFileId, permission);
      return callbackPage_(request, {
        ok: true,
        preview: preview
      });
    }

    if (action !== 'UPLOAD') {
      throw new Error('Operación de Drive no reconocida.');
    }

    validateUploadRequest_(request);
    const result = saveFile_(request, session);

    return callbackPage_(request, {
      ok: true,
      file: result
    });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return callbackPage_(request, {
      ok: false,
      error: safeError_(error)
    });
  }
}

function validateEnvelope_(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Solicitud inválida.');
  }
  if (!request.uploadId && !request.requestId) {
    throw new Error('No se recibió el identificador de la operación.');
  }

  const rawOrigin = String(request.origin || '').trim();
  const normalizedOrigin = normalizeOrigin_(rawOrigin);

  // El origin es trazabilidad/destino de postMessage, no autenticación.
  // La autorización efectiva siempre depende del JWT de Supabase.
  request.origin = normalizedOrigin || rawOrigin || '';

  if (normalizedOrigin && !isAllowedOrigin_(normalizedOrigin)) {
    console.warn('Origen no listado; se validará exclusivamente mediante JWT: ' + normalizedOrigin);
  }

  if (!request.accessToken) {
    throw new Error('La sesión del ERP no fue recibida.');
  }
}

function validateUploadRequest_(request) {
  if (!request.orderId && !request.contextId && !request.workExecutionId) {
    throw new Error('No se recibió el contexto del archivo.');
  }
  if (!request.fileName || !request.dataBase64) {
    throw new Error('No se recibió el archivo.');
  }

  const fileName = String(request.fileName || '');
  const ext = fileName.indexOf('.') >= 0 ? fileName.split('.').pop().toLowerCase() : '';
  const mime = String(request.mimeType || '').toLowerCase();

  if (!ext || SETTINGS.BLOCKED_EXTENSIONS.indexOf(ext) !== -1 || SETTINGS.ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
    throw new Error('Ese tipo de archivo no está permitido.');
  }
  if (mime === 'text/html' || mime === 'image/svg+xml' || /javascript|x-msdownload|x-sh|x-executable/.test(mime)) {
    throw new Error('El tipo de contenido del archivo no está permitido.');
  }

  const size = Number(request.sizeBytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('El archivo está vacío.');
  }
  if (size > SETTINGS.MAX_FILE_BYTES) {
    throw new Error(
      'El archivo supera el máximo permitido de ' +
      Math.floor(SETTINGS.MAX_FILE_BYTES / 1024 / 1024) +
      ' MB.'
    );
  }

  const estimatedBytes = Math.floor(String(request.dataBase64).length * 0.75);
  if (estimatedBytes > SETTINGS.MAX_FILE_BYTES + 2048) {
    throw new Error('El contenido recibido supera el tamaño permitido.');
  }
}

/**
 * Convierte una URL completa o un origin al origin canónico.
 */
function normalizeOrigin_(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  const match = input.match(/^(https?:\/\/[^\/?#]+)/i);
  return match
    ? match[1].toLowerCase().replace(/\/$/, '')
    : '';
}

/**
 * Comprueba el origin normalizado contra la lista autorizada.
 */
function isAllowedOrigin_(origin) {
  const normalized = normalizeOrigin_(origin);
  return SETTINGS.ALLOWED_ORIGINS.some(function(allowedOrigin) {
    return normalizeOrigin_(allowedOrigin) === normalized;
  });
}

/**
 * Valida el JWT de Supabase contra el RPC del ERP y confirma que el usuario
 * tenga un perfil operativo activo.
 */
function validateErpSession_(accessToken) {
  const url =
    SETTINGS.SUPABASE_URL.replace(/\/$/, '') +
    '/rest/v1/rpc/erp_x_session';

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: '{}',
    muteHttpExceptions: true,
    headers: {
      apikey: SETTINGS.SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + accessToken
    }
  });

  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      status === 401 || status === 403
        ? 'La sesión del ERP venció o el usuario no está autorizado.'
        : 'No fue posible validar la sesión del ERP.'
    );
  }

  let session;
  try {
    session = JSON.parse(body || '{}');
  } catch (error) {
    throw new Error('Supabase devolvió una sesión inválida.');
  }

  if (!session.profile || !session.profile.id) {
    throw new Error('El usuario no tiene un perfil operativo activo.');
  }

  return session;
}

function validateWorkEvidencePreview_(request, session) {
  const fileId = String(request.driveFileId || '').trim();
  if (!fileId) {
    throw new Error('No se recibió la evidencia que se desea visualizar.');
  }

  const url =
    SETTINGS.SUPABASE_URL.replace(/\/$/, '') +
    '/rest/v1/rpc/erp_x_work_evidence_preview_allowed';

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({p_drive_file_id: fileId}),
    muteHttpExceptions: true,
    headers: {
      apikey: SETTINGS.SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + request.accessToken
    }
  });

  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status < 200 || status >= 300) {
    console.error('Preview permission HTTP ' + status + ': ' + body);
    throw new Error('No fue posible validar el acceso a la evidencia.');
  }

  let permission;
  try {
    permission = JSON.parse(body || '{}');
  } catch (error) {
    throw new Error('Supabase devolvió una autorización inválida.');
  }

  if (!permission || permission.allowed !== true) {
    throw new Error('No tienes permiso para visualizar esta evidencia.');
  }

  return permission;
}

function readWorkEvidencePreview_(driveFileId, permission) {
  const fileId = String(driveFileId || '').trim();
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  const mimeType = String(blob.getContentType() || permission.mimeType || '').toLowerCase();
  const bytes = blob.getBytes();

  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(mimeType)) {
    throw new Error('La evidencia seleccionada no es una imagen compatible.');
  }

  if (bytes.length <= 0 || bytes.length > SETTINGS.MAX_PREVIEW_BYTES) {
    throw new Error(
      'La fotografía es demasiado grande para la vista previa. ' +
      'Puedes abrir el archivo original desde Drive.'
    );
  }

  return {
    fileName: permission.fileName || file.getName(),
    mimeType: mimeType,
    sizeBytes: bytes.length,
    dataUrl:
      'data:' +
      mimeType +
      ';base64,' +
      Utilities.base64Encode(bytes)
  };
}

function saveFile_(request, session) {
  const bytes = Utilities.base64Decode(request.dataBase64);
  if (bytes.length > SETTINGS.MAX_FILE_BYTES) {
    throw new Error('El archivo supera el tamaño permitido.');
  }

  const safeFileName = safeName_(request.fileName, 'archivo');
  const mimeType = String(
    request.mimeType || 'application/octet-stream'
  ).slice(0, 150);
  const blob = Utilities.newBlob(bytes, mimeType, safeFileName);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  let categoryFolder;
  try {
    const root = DriveApp.getFolderById(SETTINGS.ROOT_FOLDER_ID);
    const yearFolder = findOrCreateFolder_(
      root,
      String(new Date().getFullYear())
    );
    const inferredContextType = request.contextType
      ? String(request.contextType)
      : (request.workExecutionId ? 'ACTIVITY' : 'ORDER');
    const contextType = String(inferredContextType).toUpperCase();
    const contextId = request.contextId || request.workExecutionId || request.orderId;
    const contextLabel = request.contextLabel || request.workTitle || request.orderNumber || contextId;
    const contextPrefix = contextType === 'ACTIVITY' ? 'ACTIVIDAD_' : 'PEDIDO_';
    const contextFolder = findOrCreateFolder_(
      yearFolder,
      contextPrefix + safeName_(contextLabel, 'SIN_REFERENCIA')
    );
    categoryFolder = findOrCreateFolder_(
      contextFolder,
      safeName_(request.category || 'EVIDENCE', 'EVIDENCE')
    );
  } finally {
    lock.releaseLock();
  }

  const file = categoryFolder.createFile(blob);
  const inferredContextType = request.contextType
      ? String(request.contextType)
      : (request.workExecutionId ? 'ACTIVITY' : 'ORDER');
  const contextType = String(inferredContextType).toUpperCase();
  const contextId = request.contextId || request.workExecutionId || request.orderId;
  const contextLabel = request.contextLabel || request.workTitle || request.orderNumber || contextId;
  file.setDescription([
    'ERP EI',
    (contextType === 'ACTIVITY' ? 'Actividad: ' : 'Pedido: ') + String(contextLabel),
    'Contexto: ' + String(contextId),
    'Categoría: ' + String(request.category || 'EVIDENCE'),
    'Usuario ERP: ' + String(
      session.profile.name ||
      session.profile.email ||
      session.profile.id
    ),
    'Perfil ERP: ' + String(session.profile.id),
    'Fecha: ' + new Date().toISOString()
  ].join(' · '));

  if (SETTINGS.SHARING_MODE === 'ANYONE_WITH_LINK') {
    file.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );
  }

  return {
    id: file.getId(),
    name: file.getName(),
    mimeType: mimeType,
    size: bytes.length,
    webViewLink: file.getUrl(),
    webContentLink:
      'https://drive.google.com/uc?export=download&id=' +
      encodeURIComponent(file.getId()),
    parentId: categoryFolder.getId(),
    ownerMode: 'INSTITUTIONAL_APPS_SCRIPT',
    uploadedByProfileId: session.profile.id,
    uploadedByEmail: session.profile.email || null
  };
}

function findOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function safeName_(value, fallback) {
  const cleaned = String(value || fallback || 'SIN_REFERENCIA')
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);

  return cleaned || fallback || 'SIN_REFERENCIA';
}

/**
 * Devuelve el resultado al iframe oculto que inició la carga en el ERP.
 */
function callbackPage_(request, data) {
  const requestedOrigin = normalizeOrigin_(
    request && request.origin ? request.origin : ''
  );

  // postMessage usa el origin informado por la propia página si es válido.
  // Si no pudo normalizarse, se usa "*" únicamente para entregar el error
  // al iframe llamante. La autorización de la carga ya fue resuelta por JWT.
  const targetOrigin = requestedOrigin || '*';

  const json = JSON.stringify({
    source: 'ERP_EI_DRIVE_BRIDGE',
    version: SETTINGS.VERSION,
    requestId: request && (request.requestId || request.uploadId) ? (request.requestId || request.uploadId) : null,
    uploadId: request && (request.uploadId || request.requestId) ? (request.uploadId || request.requestId) : null,
    ...data
  })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  const scriptBody =
    'window.parent.postMessage(' +
    json +
    ',' +
    JSON.stringify(targetOrigin) +
    ');';

  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>' + scriptBody + '</scr' + 'ipt>' +
    '</body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function safeError_(error) {
  const message = String(
    error && error.message
      ? error.message
      : error || 'No fue posible cargar el archivo.'
  );

  if (/Exception|DriveApp|UrlFetch|Utilities|ScriptError/i.test(message)) {
    return 'No fue posible completar la carga institucional. Revisa la configuración del puente de Drive.';
  }

  return message.slice(0, 240);
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
