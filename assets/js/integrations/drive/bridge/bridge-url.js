import { CONFIG } from "../../../config.js";

export function bridgeUrl() {
  const url = String(CONFIG.drive.bridgeUrl || "").trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/i.test(url)) {
    throw new Error("El administrador todavía no configuró el puente institucional de Google Drive.");
  }
  return url;
}

export function isBridgeOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (
      url.hostname === "script.google.com" ||
      url.hostname === "script.googleusercontent.com" ||
      url.hostname.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}
