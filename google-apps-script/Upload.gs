// Shared Apps Script namespace; external entry points retain their names.
function saveFile_(request, session) {
  const content = createUploadContent_(request);
  const context = resolveUploadContext_(request);
  const categoryFolder = resolveUploadFolder_(request, context);
  const file = categoryFolder.createFile(content.blob);
  describeUploadedFile_(file, request, session, context);
  return uploadedFileRecord_(file, categoryFolder, content, session);
}

function createUploadContent_(request) {
  const bytes = Utilities.base64Decode(request.dataBase64);
  if (bytes.length > SETTINGS.MAX_FILE_BYTES) throw new Error('El archivo supera el tamaño permitido.');
  const safeFileName = safeName_(request.fileName, 'archivo');
  const mimeType = String(request.mimeType || 'application/octet-stream').slice(0, 150);
  return {blob: Utilities.newBlob(bytes, mimeType, safeFileName), mimeType: mimeType, sizeBytes: bytes.length};
}

function describeUploadedFile_(file, request, session, context) {
  file.setDescription([
    'ERP EI',
    (context.type === 'ACTIVITY' ? 'Actividad: ' : 'Pedido: ') + String(context.label),
    'Contexto: ' + String(context.id),
    'Categoría: ' + String(request.category || 'EVIDENCE'),
    'Usuario ERP: ' + String(session.profile.name || session.profile.email || session.profile.id),
    'Perfil ERP: ' + String(session.profile.id),
    'Fecha: ' + new Date().toISOString()
  ].join(' · '));
  if (SETTINGS.SHARING_MODE === 'ANYONE_WITH_LINK') {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
}

function uploadedFileRecord_(file, folder, content, session) {
  return {
    id: file.getId(), name: file.getName(), mimeType: content.mimeType, size: content.sizeBytes,
    webViewLink: file.getUrl(),
    webContentLink: 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(file.getId()),
    parentId: folder.getId(), ownerMode: 'INSTITUTIONAL_APPS_SCRIPT',
    uploadedByProfileId: session.profile.id, uploadedByEmail: session.profile.email || null
  };
}
