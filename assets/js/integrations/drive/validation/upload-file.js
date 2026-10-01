import { CONFIG } from "../../../config.js";

export const MAX_FILE_BYTES = Number(CONFIG.drive.maxFileBytes || 15 * 1024 * 1024);

export const BLOCKED_FILE_EXTENSIONS = new Set(["html","htm","svg","js","mjs","cjs","exe","dll","msi","bat","cmd","com","scr","ps1","sh","jar","apk","app","dmg","iso"]);

export const ALLOWED_FILE_EXTENSIONS = new Set(["jpg","jpeg","png","webp","heic","heif","pdf","txt","csv","xls","xlsx","doc","docx","ppt","pptx"]);

export const ALLOWED_MIME_PREFIXES = ["image/jpeg","image/png","image/webp","image/heic","image/heif","application/pdf","text/plain","text/csv","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument","application/msword","application/vnd.ms-powerpoint"];

export function validateUploadFile(file) {
  if (!(file instanceof File)) throw new Error("Seleccione un archivo válido.");
  if (file.size <= 0) throw new Error("El archivo está vacío.");
  if (file.size > MAX_FILE_BYTES) throw new Error(`El archivo supera el máximo permitido de ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  const mime = String(file.type || "").toLowerCase();
  if (!ext || BLOCKED_FILE_EXTENSIONS.has(ext) || !ALLOWED_FILE_EXTENSIONS.has(ext)) throw new Error("Ese tipo de archivo no está permitido en el ERP.");
  if (mime && !ALLOWED_MIME_PREFIXES.some((allowed) => mime === allowed || mime.startsWith(`${allowed}.`))) throw new Error("El tipo MIME del archivo no está permitido.");
}
