// Shared Apps Script namespace; external entry points retain their names.
function validateWorkEvidencePreview_(request, session) {
  const evidenceId = String(request.evidenceId || '').trim();
  const fileId = String(request.driveFileId || '').trim();
  if (!evidenceId || !fileId) {
    throw new Error('No se recibió la evidencia que se desea visualizar.');
  }

  const url =
    SETTINGS.SUPABASE_URL.replace(/\/$/, '') +
    '/rest/v1/rpc/erp_x_work_evidence_preview_allowed';

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({p_evidence_id: evidenceId, p_drive_file_id: fileId}),
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
