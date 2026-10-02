import { toast } from "../../../core/ui.js";
import { fmt } from "../../../core/format.js";
import { rpc } from "../data/history-rpc.js";
import { filtersPayload } from "../history-state.js";

export async function exportHistory(format){
  try{
    toast("Preparando exportación histórica…","info",3000);
    const data=await rpc("erp_x_history_export",{p_payload:filtersPayload({limit:5000})});
    const rows=data?.rows||[];if(!rows.length){toast("No hay registros para exportar.","error");return}
    if(format==="xlsx"){
      if(!window.XLSX){toast("El motor Excel no está disponible.","error");return}
      const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.json_to_sheet(rows),"Historico");window.XLSX.writeFile(wb,`CRM_Historico_${new Date().toISOString().slice(0,10)}.xlsx`,{compression:true});
    }else downloadCsv(rows,`CRM_Historico_${new Date().toISOString().slice(0,10)}.csv`);
    toast(`${fmt.number(rows.length)} registro(s) exportados.`);
  }catch(error){toast(error.message,"error",7000)}
}

export function downloadCsv(rows,name){
  const headers=[...new Set(rows.flatMap(row=>Object.keys(row||{})))];
  const csv=[headers,...rows.map(row=>headers.map(h=>row?.[h]))].map(row=>row.map(v=>`"${String(typeof v==="object"&&v!==null?JSON.stringify(v):v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);
}
