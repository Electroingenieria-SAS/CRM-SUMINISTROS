

export function extractNumbers(text){
  const matches=String(text||"").match(/(?:\$|COP\s*)?\d[\d.,]*(?:\s*COP)?/gi)||[];
  return matches.map(localizedNumber).filter(number=>Number.isFinite(number));
}

export function localizedNumber(value){
  let text=String(value||"").replace(/COP|\$|\s/gi,"").replace(/[^\d,.-]/g,"");
  if(!text)return NaN;
  const comma=text.lastIndexOf(","),dot=text.lastIndexOf(".");
  if(comma>=0&&dot>=0){
    const decimal=comma>dot?",":".";const thousand=decimal===","?".":",";
    text=text.split(thousand).join("").replace(decimal,".");
  }else if(comma>=0){
    const decimals=text.length-comma-1;text=decimals>0&&decimals<=2?text.replace(/\./g,"").replace(",","."):text.replace(/,/g,"");
  }else if(dot>=0){
    const decimals=text.length-dot-1;text=decimals===3&&/^\d{1,3}(\.\d{3})+$/.test(text)?text.replace(/\./g,""):text;
  }
  return Number(text);
}

export function normalizeDate(value){
  const text=String(value||"").trim();if(!text)return "";
  if(/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(text)){const [y,m,d]=text.split(/[\/-]/);return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`}
  const match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);if(!match)return "";
  const year=match[3].length===2?`20${match[3]}`:match[3];return `${year}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;
}

export function positiveNumber(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:null}

export function trimNumber(value){return String(Number(value.toFixed?.(3)??value)).replace(/\.0+$/u,"")}

export function clean(value){return String(value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}

export function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]))}
