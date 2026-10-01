// Shared Apps Script namespace; external entry points retain their names.
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
