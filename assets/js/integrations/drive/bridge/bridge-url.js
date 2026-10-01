import { CONFIG } from "../../../config.js";

export function bridgeUrl() {
  const url = String(CONFIG.drive.bridgeUrl || "").trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/i.test(url)) {
    throw new Error("El administrador todavía no configuró el puente institucional de Google Drive.");
  }
  return url;
}
