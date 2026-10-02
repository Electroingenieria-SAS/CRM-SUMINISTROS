import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { DATASETS } from "../catalog/datasets.js";
import { state } from "../reports-state.js";
import { rpc } from "../data/report-rpc.js";
import { downloadXlsx, downloadCsv, downloadBlob } from "./download-report.js";

export async function exportDetail(format){
  const explorer=state.explorer;
  try{
    toast("Preparando exportación detallada…","info",3000);
    const data=await rpc("erp_x_reports_export",{p_payload:{dataset:explorer.dataset,from:state.from,to:state.to,limit:5000}});
    const rows=data?.rows||[];
    if(!rows.length){toast("No hay filas para exportar.","error");return}
    if(format==="xlsx")downloadXlsx({[DATASETS[explorer.dataset].label]:rows},`CRM_${explorer.dataset}_${state.from}_${state.to}.xlsx`);
    else downloadCsv(rows,`CRM_${explorer.dataset}_${state.from}_${state.to}.csv`);
    toast(`${fmt.number(rows.length)} fila(s) exportadas.`);
  }catch(error){toast(error.message,"error",7000)}
}

export function exportWorkbook(){
  if(!state.data)return;
  const data=state.data,summary=data.summary||{};
  const sheets={
    Resumen:Object.entries(summary).map(([Indicador,Valor])=>({Indicador,Valor})),
    Tendencia:data.trend||[],
    Etapas:data.stages||[],
    Logistica:data.logistics||[],
    Inventario:data.inventory||[],
    Personas:data.people||[],
    Calidad:[data.quality||{}],
    Estados:data.dimensions?.status||[],
    Rutas:data.dimensions?.routes||[],
    Ciudades:data.dimensions?.cities||[],
    Asesores:data.dimensions?.sellers||[],
    Clientes:data.dimensions?.clients||[]
  };
  downloadXlsx(sheets,`CRM_Analitica_${state.from}_${state.to}.xlsx`);
}

export function exportJson(){
  downloadBlob(JSON.stringify({generatedAt:new Date().toISOString(),range:{from:state.from,to:state.to},dashboard:state.data,explorer:state.explorer.result},null,2),"application/json",`CRM_Analitica_${state.from}_${state.to}.json`);
}
