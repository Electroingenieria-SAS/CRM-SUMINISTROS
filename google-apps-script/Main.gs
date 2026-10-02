// Shared Apps Script namespace; external entry points retain their names.
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
