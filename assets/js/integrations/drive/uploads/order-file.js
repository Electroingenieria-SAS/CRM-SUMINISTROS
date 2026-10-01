import { CONFIG } from "../../../config.js";
import { operationProgress } from "../../../core/progress.js";
import { api } from "../../../services/api.js";
import { validateUploadFile } from "../validation/upload-file.js";
import { uploadTitle, safeName } from "../formatting/file-name.js";
import { currentSession } from "../auth/crm-session.js";
import { fileToBase64 } from "../encoding/file-base64.js";
import { submitToBridge } from "../bridge/post-message-request.js";

export async function uploadOrderFile(
  orderId,
  file,
  category = "EVIDENCE",
  taskId = null,
  orderNumber = null
) {
  if (!orderId) throw new Error("No se recibió el identificador del pedido.");
  validateUploadFile(file);

  const uploadId = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const progress=operationProgress({id:uploadId,title:uploadTitle(category),message:"Preparando el archivo para una carga segura…",fileName:file.name,fileSize:file.size,kind:"upload"});

  try{
    progress.update({progress:11,phase:"SESSION",message:"Validando tu sesión del CRM…"});
    const session = await currentSession();
    if (!session?.access_token) throw new Error("Tu sesión venció. Ingresa nuevamente al ERP.");

    progress.update({progress:24,phase:"ENCODE",message:"Preparando el archivo antes de enviarlo…"});
    const dataBase64=await fileToBase64(file);

    progress.update({progress:42,phase:"UPLOAD",message:"Enviando a Google Drive. Esta fase puede tardar unos segundos…"});
    const uploaded = await submitToBridge({
      action: "UPLOAD",
      requestId: uploadId,
      uploadId,
      origin: window.location.origin,
      accessToken: session.access_token,
      orderId: String(orderId),
      taskId: taskId ? String(taskId) : null,
      orderNumber: orderNumber ? String(orderNumber) : null,
      category: String(category || "EVIDENCE"),
      fileName: safeName(file.name, "archivo"),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      dataBase64,
      clientVersion: CONFIG.version || "ERP_EI"
    });

    progress.update({progress:80,phase:"REGISTER",message:"Drive confirmó el archivo. Registrándolo en el CRM…"});
    const registered=await api.registerDriveFile({
      orderId,
      taskId,
      category,
      driveFileId: uploaded.id,
      fileName: uploaded.name,
      mimeType: uploaded.mimeType || file.type || "application/octet-stream",
      sizeBytes: Number(uploaded.size || file.size),
      webViewLink: uploaded.webViewLink,
      webContentLink: uploaded.webContentLink,
      metadata: {
        orderNumber: orderNumber || null,
        driveParentId: uploaded.parentId || null,
        uploadMode: "INSTITUTIONAL_APPS_SCRIPT",
        uploadedByProfileId: uploaded.uploadedByProfileId || null,
        uploadedByEmail: uploaded.uploadedByEmail || null
      }
    });
    progress.done("Archivo guardado en Drive y registrado correctamente.");
    return registered;
  }catch(error){
    progress.error(error);
    throw error;
  }
}
