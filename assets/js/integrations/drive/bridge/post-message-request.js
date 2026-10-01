import { bridgeUrl } from "./bridge-url.js";

export const BRIDGE_TIMEOUT_MS = 180000;

function belongsToBridgeFrame(source, bridgeWindow) {
  if (!bridgeWindow) return false;
  for (let depth = 0; source && depth < 8; depth++) {
    if (source === bridgeWindow) return true;
    try {
      const parent = source.parent;
      if (parent === source) break;
      source = parent;
    } catch { return false; }
  }
  return false;
}

export function postToBridge(payload, options = {}) {
  return new Promise((resolve, reject) => {
    const requestId = String(payload.requestId || payload.uploadId || (typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `drive_${Date.now()}_${Math.random().toString(36).slice(2)}`));
    payload.requestId = requestId;
    payload.uploadId = requestId;
    const frameName = `erp_drive_${requestId.replace(/[^a-z0-9_-]/gi, "")}`;
    const iframe = document.createElement("iframe");
    iframe.name = frameName;
    iframe.hidden = true;
    iframe.setAttribute("aria-hidden", "true");

    const form = document.createElement("form");
    form.method = "POST";
    form.action = bridgeUrl();
    form.target = frameName;
    form.enctype = "application/x-www-form-urlencoded";
    form.hidden = true;

    const field = document.createElement("textarea");
    field.name = "payload";
    field.value = JSON.stringify(payload);
    form.appendChild(field);

    let settled = false;
    let timer;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (timer) clearTimeout(timer);
      form.remove();
      iframe.remove();
    };

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };

    const onMessage = event => {
      // Exact sandbox origin observed on the configured deployment, 2026-10-01.
      if (event.origin !== "https://script.google.com"
        && event.origin !== "https://n-bxf2muk7rmihub4iuwdqznurqcm6ax6w26p5jdy-0lu-script.googleusercontent.com") return;
      // HtmlService posts from a nested frame, not the outer form target.
      if (!belongsToBridgeFrame(event.source, iframe.contentWindow)) return;
      const data = event.data;
      if (
        data?.source !== "ERP_EI_DRIVE_BRIDGE" ||
        ![data?.requestId, data?.uploadId].filter(Boolean).includes(requestId)
      ) return;

      if (data.ok) finish(resolve, data);
      else finish(reject, new Error(data.error || "No fue posible completar la operación con Google Drive."));
    };

    const timeoutMs = Math.max(5000, Number(options.timeoutMs || BRIDGE_TIMEOUT_MS));
    timer = setTimeout(() => {
      finish(reject, new Error(payload.action === "PREVIEW_WORK_EVIDENCE"
        ? "La vista previa no respondió. Verifica que Apps Script esté desplegado en versión 3.5.0 o superior."
        : "La operación institucional tardó demasiado. Revisa que el Apps Script siga desplegado e inténtalo nuevamente."));
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  });
}

export async function submitToBridge(payload) {
  const response = await postToBridge(payload);
  if (!response?.file) throw new Error("Google Drive no devolvió el archivo esperado.");
  return response.file;
}
