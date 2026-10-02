import { operationProgress } from "../../../core/progress.js";
import { downloadToken } from "../auth/google-download-token.js";

export async function downloadDriveFile(fileId) {
  const id = String(fileId || "").trim();
  if (!id) throw new Error("No se recibió el identificador del archivo.");
  const progress=operationProgress({title:"Abriendo archivo de Google Drive",message:"Solicitando acceso al documento…",kind:"download"});

  try{
    progress.update({progress:18,phase:"SESSION",message:"Validando acceso al archivo…"});
    const token = await downloadToken();
    progress.update({progress:46,phase:"UPLOAD",message:"Descargando el archivo desde Google Drive…"});
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
      {headers: {Authorization: `Bearer ${token}`}}
    );

    if (!response.ok) {
      await response.text().catch(() => "");
      if (response.status === 403 || response.status === 404) {
        throw new Error("No fue posible abrir el PDF cargado por el asesor. Verifica que esté compartido con tu cuenta o selecciónalo manualmente.");
      }
      throw new Error(`No fue posible descargar el PDF (código ${response.status}).`);
    }
    progress.update({progress:88,phase:"REGISTER",message:"Archivo recibido. Preparándolo para lectura…"});
    const blob=await response.blob();
    progress.done("Archivo listo para usar.");
    return blob;
  }catch(error){
    progress.error(error);
    throw error;
  }
}
