// Feature-scoped vendors: optional tools must not be downloaded on the login screen.
const pending=new Map();
const urls=Object.freeze({
  pdf:"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  pdfTables:"https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js",
  barcode:"https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js",
  qr:"https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js",
  scanner:"https://unpkg.com/@zxing/browser@0.2.1"
});

export function loadVendor(key,ready){
  if(ready())return Promise.resolve();
  if(pending.has(key))return pending.get(key);
  const url=urls[key];
  if(!url)return Promise.reject(new Error('Biblioteca opcional desconocida.'));
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=url;script.async=true;script.dataset.crmOptionalVendor=key;
    script.onload=()=>ready()?resolve():reject(new Error('El componente no está disponible.'));
    script.onerror=()=>reject(new Error('No se pudo cargar el componente. Revisa tu conexión.'));
    document.head.append(script);
  }).catch(error=>{pending.delete(key);document.querySelector(`script[data-crm-optional-vendor="${key}"]`)?.remove();throw error});
  pending.set(key,promise);
  return promise;
}
export async function loadPdfExporter(){
  await loadVendor('pdf',()=>Boolean(window.jspdf?.jsPDF));
  await loadVendor('pdfTables',()=>Boolean(window.jspdf?.jsPDF?.API?.autoTable));
}
export async function loadInventoryLabels(){
  await Promise.all([
    loadVendor('barcode',()=>typeof window.JsBarcode==='function'),
    loadVendor('qr',()=>typeof window.qrcode==='function')
  ]);
}
export function loadScannerFallback(){
  return loadVendor('scanner',()=>Boolean(window.ZXingBrowser?.BrowserMultiFormatReader));
}
