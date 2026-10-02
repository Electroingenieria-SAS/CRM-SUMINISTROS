

export function previewBytes(preview){
  const declared=Number(preview?.sizeBytes||0);
  if(Number.isFinite(declared)&&declared>0)return declared;

  const data=String(preview?.dataUrl||"");
  const comma=data.indexOf(",");
  const base64=comma>=0?data.slice(comma+1):data;
  return Math.max(0,Math.floor(base64.length*0.75));
}

export async function decodePreview(dataUrl){
  if(typeof Image==="undefined")return;
  const image=new Image();
  image.decoding="async";
  image.src=dataUrl;

  try{
    if(typeof image.decode==="function")await image.decode();
    else await new Promise((resolve,reject)=>{
      image.onload=()=>resolve();
      image.onerror=()=>reject(new Error("No fue posible decodificar la evidencia."));
    });
  }catch{
    // La tarjeta vuelve a validar/decodificar al pintar. La precarga no debe
    // bloquear el cronograma por una decodificación anticipada fallida.
  }
}
