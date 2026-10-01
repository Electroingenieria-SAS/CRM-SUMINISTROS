import { CONFIG } from "../../../config.js";
import { currentSession } from "../auth/crm-session.js";
import { postToBridge } from "../bridge/post-message-request.js";

export const PREVIEW_TIMEOUT_MS = 30000;

export async function loadWorkEvidencePreview(evidenceId,fileId){
  const evidence=String(evidenceId||"").trim();
  const id=String(fileId||"").trim();
  if(!evidence||!id)throw new Error("La evidencia no tiene un archivo de Drive asociado.");

  const session=await currentSession();
  if(!session?.access_token)throw new Error("Tu sesión venció. Ingresa nuevamente al ERP.");

  const response=await postToBridge({
    action:"PREVIEW_WORK_EVIDENCE",
    origin:window.location.origin,
    accessToken:session.access_token,
    evidenceId:evidence,
    driveFileId:id,
    clientVersion:CONFIG.version||"ERP_EI"
  },{timeoutMs:PREVIEW_TIMEOUT_MS});

  const preview=response?.preview;
  if(!preview?.dataUrl||!/^data:image\//i.test(String(preview.dataUrl))){
    throw new Error("No fue posible preparar la vista previa de la evidencia.");
  }

  return preview;
}
