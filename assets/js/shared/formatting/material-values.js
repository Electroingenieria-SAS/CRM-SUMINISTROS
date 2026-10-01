

export function safeText(value){return String(value??"").trim()}

export function numberValue(value){
  if(value===null||value===undefined||value==="")return null;
  const n=Number(String(value).replace(",","."));
  return Number.isFinite(n)?n:null;
}

export function normalizeUnit(value){
  const unit=safeText(value).toUpperCase();
  return unit||"UND";
}

export function normalize(value){return safeText(value).replace(/\s+/g," ").toUpperCase()}
