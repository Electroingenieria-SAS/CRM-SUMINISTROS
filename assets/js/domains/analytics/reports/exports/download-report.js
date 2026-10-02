import { toast } from "../../../../core/ui.js";

export function downloadXlsx(sheets,name){
  if(!window.XLSX){toast("El motor Excel aún no está disponible.","error");return}
  const workbook=window.XLSX.utils.book_new();
  Object.entries(sheets).forEach(([sheetName,rows])=>window.XLSX.utils.book_append_sheet(workbook,window.XLSX.utils.json_to_sheet(rows||[]),sheetName.slice(0,31)));
  window.XLSX.writeFile(workbook,name,{compression:true});
}

export function downloadCsv(rows,name){
  const headers=[...new Set(rows.flatMap(row=>Object.keys(row||{})))];
  const csv=[headers,...rows.map(row=>headers.map(header=>row?.[header]))]
    .map(row=>row.map(value=>`"${String(typeof value==="object"&&value!==null?JSON.stringify(value):value??"").replaceAll('"','""')}"`).join(","))
    .join("\n");
  downloadBlob(csv,"text/csv;charset=utf-8",name);
}

export function downloadBlob(content,type,name){
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([content],{type}));
  link.download=name;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),0);
}
