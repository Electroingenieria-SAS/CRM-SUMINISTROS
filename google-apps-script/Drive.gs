// Shared Apps Script namespace; external entry points retain their names.
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

function resolveUploadFolder_(request, context) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const root = DriveApp.getFolderById(SETTINGS.ROOT_FOLDER_ID);
    const yearFolder = findOrCreateFolder_(root, String(new Date().getFullYear()));
    const contextFolder = findOrCreateFolder_(yearFolder, context.prefix + safeName_(context.label, 'SIN_REFERENCIA'));
    return findOrCreateFolder_(contextFolder, safeName_(request.category || 'EVIDENCE', 'EVIDENCE'));
  } finally {
    lock.releaseLock();
  }
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
