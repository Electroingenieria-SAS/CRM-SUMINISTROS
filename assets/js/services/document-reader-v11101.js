import {ensurePdfReader} from "./pdf-order-reader.js";

const OCR_SRC="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
let ocrPromise=null;

export function documentKind(file){
  const name=String(file?.name||"").toLowerCase();
  const type=String(file?.type||"").toLowerCase();
  if(type==="application/pdf"||name.endsWith(".pdf"))return "pdf";
  if(type.startsWith("image/")||/\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(name))return "image";
  if(type.includes("csv")||name.endsWith(".csv"))return "csv";
  return "unknown";
}

export async function readDocumentText(file,{onProgress}={}){
  const kind=documentKind(file);
  if(kind==="pdf")return {kind,text:await readPdf(file,onProgress)};
  if(kind==="csv")return {kind,text:await readCsv(file,onProgress)};
  if(kind==="image")return {kind,text:await readImage(file,onProgress)};
  throw new Error("Formato no compatible. Usa PDF, imagen o CSV.");
}

async function readPdf(file,onProgress){
  onProgress?.({phase:"reader",progress:.08,label:"Abriendo PDF…"});
  const pdfjs=await ensurePdfReader();
  const buffer=await file.arrayBuffer();
  const pdf=await pdfjs.getDocument({data:buffer}).promise;
  const pages=[];
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
    onProgress?.({phase:"reader",progress:.12+.75*(pageNumber-1)/Math.max(1,pdf.numPages),label:`Leyendo página ${pageNumber} de ${pdf.numPages}…`});
    const page=await pdf.getPage(pageNumber);
    const content=await page.getTextContent();
    pages.push(extractPageText(content.items||[]));
  }
  onProgress?.({phase:"reader",progress:.92,label:"Interpretando datos…"});
  return pages.join("\n");
}

async function readCsv(file,onProgress){
  onProgress?.({phase:"reader",progress:.2,label:"Leyendo CSV…"});
  const text=await file.text();
  if(!text.trim())throw new Error("El CSV está vacío.");
  onProgress?.({phase:"reader",progress:.9,label:"Interpretando columnas…"});
  return csvToReadableText(text);
}

async function readImage(file,onProgress){
  onProgress?.({phase:"ocr",progress:.05,label:"Preparando lector de imagen…"});
  const Tesseract=await ensureOcr();
  const result=await Tesseract.recognize(file,"spa",{
    logger(message){
      const p=Number(message?.progress||0);
      const status=String(message?.status||"");
      onProgress?.({phase:"ocr",progress:.08+.82*p,label:ocrLabel(status,p)});
    }
  });
  const text=String(result?.data?.text||"").trim();
  if(!text)throw new Error("No se pudo reconocer texto en la imagen. Puedes completar los campos manualmente.");
  onProgress?.({phase:"ocr",progress:.94,label:"Interpretando datos…"});
  return text;
}

function ensureOcr(){
  if(window.Tesseract?.recognize)return Promise.resolve(window.Tesseract);
  if(ocrPromise)return ocrPromise;
  ocrPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-erp-ocr="tesseract"]');
    if(existing){
      existing.addEventListener("load",()=>window.Tesseract?.recognize?resolve(window.Tesseract):reject(new Error("No fue posible iniciar OCR.")),{once:true});
      existing.addEventListener("error",()=>reject(new Error("No fue posible cargar el lector de imágenes.")),{once:true});
      return;
    }
    const script=document.createElement("script");
    script.src=OCR_SRC;
    script.async=true;
    script.dataset.erpOcr="tesseract";
    script.onload=()=>window.Tesseract?.recognize?resolve(window.Tesseract):reject(new Error("No fue posible iniciar OCR."));
    script.onerror=()=>reject(new Error("No fue posible cargar el lector de imágenes."));
    document.head.append(script);
  }).catch(error=>{ocrPromise=null;throw error});
  return ocrPromise;
}

function ocrLabel(status,progress){
  if(/recognizing/i.test(status))return `Leyendo imagen… ${Math.round(progress*100)}%`;
  if(/loading language/i.test(status))return "Cargando lector en español…";
  if(/initializing/i.test(status))return "Iniciando lector de imagen…";
  return "Analizando imagen…";
}

function extractPageText(items){
  const rows=new Map();
  for(const item of items){
    const text=clean(item.str);if(!text)continue;
    const y=Math.round(Number(item.transform?.[5]||0)*2)/2;
    const x=Number(item.transform?.[4]||0);
    if(!rows.has(y))rows.set(y,[]);
    rows.get(y).push({x,text});
  }
  return [...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,parts])=>parts.sort((a,b)=>a.x-b.x).map(part=>part.text).join(" ").replace(/\s+/g," ").trim()).filter(Boolean).join("\n");
}

function csvToReadableText(text){
  const rows=parseCsv(text);
  if(!rows.length)return text;
  const headers=rows[0].map(clean);
  const lines=[];
  for(let i=1;i<rows.length;i++){
    const row=rows[i];
    for(let j=0;j<Math.max(headers.length,row.length);j++){
      const key=headers[j]||`Columna ${j+1}`;
      const value=clean(row[j]);
      if(value)lines.push(`${key}: ${value}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim()||text;
}

function parseCsv(text){
  const source=String(text||"").replace(/^\uFEFF/,"");
  const first=source.split(/\r?\n/,1)[0]||"";
  const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?";":",";
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(ch==='"'){
      if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
      continue;
    }
    if(ch===delimiter&&!quoted){row.push(cell);cell="";continue}
    if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&source[i+1]==='\n')i++;
      row.push(cell);rows.push(row);row=[];cell="";continue;
    }
    cell+=ch;
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows.filter(r=>r.some(value=>String(value||"").trim()));
}

function clean(value){return String(value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}
