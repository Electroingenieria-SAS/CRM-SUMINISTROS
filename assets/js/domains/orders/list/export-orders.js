import { toast } from "../../../core/ui.js";
import { currentList } from "../orders-state.js";

export function exportCurrent(){
  const rows=currentList.data?.items||[];
  if(!rows.length)return toast("No hay registros para exportar.","error");
  const headers=Object.keys(rows[0]);
  const csv=[headers.join(","),...rows.map(row=>headers.map(header=>`"${String(row[header]??"").replaceAll('"','""')}"`).join(","))].join("\n");
  const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));link.download=`pedidos_${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(link.href);
}
