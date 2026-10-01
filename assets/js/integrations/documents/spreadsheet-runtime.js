

export const SHEETJS_URL="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

export let sheetPromise=null;

export async function loadSheetJs(){
  if(window.XLSX)return window.XLSX;
  if(sheetPromise)return sheetPromise;
  sheetPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=SHEETJS_URL;
    script.async=true;
    script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error("El lector de Excel no quedó disponible."));
    script.onerror=()=>reject(new Error("No fue posible cargar el lector de Excel. Revisa la conexión e inténtalo nuevamente."));
    document.head.append(script);
  });
  return sheetPromise;
}
