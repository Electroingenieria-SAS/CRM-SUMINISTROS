import { CONFIG } from "../../../config.js";
import { operationProgress } from "../../../core/progress.js";
import { api } from "../../../services/api.js";
import { validateUploadFile } from "../validation/upload-file.js";
import { safeName } from "../formatting/file-name.js";
import { currentSession } from "../auth/crm-session.js";
import { fileToBase64 } from "../encoding/file-base64.js";
import { submitToBridge } from "../bridge/post-message-request.js";

export async function uploadWorkEvidence(
  executionId,
  file,
  evidenceType = "FILE",
  title = null
) {
  const id = String(executionId || "").trim();
  if (!id) throw new Error("No se recibió la actividad asociada a la evidencia.");
  validateUploadFile(file);

  const type = String(evidenceType || "FILE").trim().toUpperCase();
  const allowed = new Set(["BEFORE_PHOTO", "AFTER_PHOTO", "FINAL_PHOTO", "FILE"]);
  if (!allowed.has(type)) throw new Error("Tipo de evidencia de actividad inválido.");

  const requestId = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `work_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const workTitle = safeName(title || "Actividad", "Actividad");
  const progress=operationProgress({id:requestId,title:"Subiendo evidencia de actividad",message:"Preparando la evidencia…",fileName:file.name,fileSize:file.size,kind:"upload"});

  try{
    progress.update({progress:11,phase:"SESSION",message:"Validando tu sesión del CRM…"});
    const session = await currentSession();
    if (!session?.access_token) throw new Error("Tu sesión venció. Ingresa nuevamente al ERP.");

    progress.update({progress:24,phase:"ENCODE",message:"Preparando el archivo antes de enviarlo…"});
    const dataBase64=await fileToBase64(file);

    progress.update({progress:42,phase:"UPLOAD",message:"Enviando la evidencia a Google Drive…"});
    const uploaded = await submitToBridge({
      action: "UPLOAD",
      requestId,
      uploadId: requestId,
      origin: window.location.origin,
      accessToken: session.access_token,
      orderId: id,
      orderNumber: workTitle,
      workExecutionId: id,
      workTitle,
      evidenceType: type,
      category: `WORK_EVIDENCE_${type}`,
      fileName: safeName(file.name, "evidencia"),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      dataBase64,
      clientVersion: CONFIG.version || "ERP_EI"
    });

    if (!uploaded?.id) throw new Error("Google Drive no devolvió el identificador de la evidencia.");
    progress.update({progress:80,phase:"REGISTER",message:"Drive confirmó la evidencia. Registrándola en la actividad…"});

    await api.workRegisterEvidence(id, {
      evidenceType: type,
      driveFileId: uploaded.id,
      fileName: uploaded.name || file.name,
      mimeType: uploaded.mimeType || file.type || "application/octet-stream",
      sizeBytes: Number(uploaded.size || file.size),
      webViewLink: uploaded.webViewLink || null,
      metadata: {
        workTitle,
        driveParentId: uploaded.parentId || null,
        uploadMode: "INSTITUTIONAL_APPS_SCRIPT",
        uploadedByProfileId: uploaded.uploadedByProfileId || null,
        uploadedByEmail: uploaded.uploadedByEmail || null,
        clientVersion: CONFIG.version || "ERP_EI"
      }
    });

    progress.done("Evidencia guardada y vinculada a la actividad.");
    return uploaded;
  }catch(error){
    progress.error(error);
    throw error;
  }
}
