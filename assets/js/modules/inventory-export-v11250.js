const clean=v=>v==null?"":String(v);
const csvCell=v=>`"${clean(v).replaceAll('"','""')}"`;

export function downloadCsv(filename,rows=[]){
  if(!rows.length)throw new Error("No hay información para exportar.");
  const headers=[...new Set(rows.flatMap(row=>Object.keys(row||{})))];
  const body=[headers.map(csvCell).join(","),...rows.map(row=>headers.map(key=>csvCell(row?.[key])).join(","))].join("\r\n");
  const blob=new Blob(["\ufeff",body],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;a.style.display="none";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function dateStamp(){
  const d=new Date(),p=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
