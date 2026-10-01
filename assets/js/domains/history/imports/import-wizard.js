import { api } from "../../../services/api.js";
import { parseCsv, normalizeHistoryRow, chunk } from "../../../services/csv.js";
import { toast, wizard, empty } from "../../../core/ui.js";
import { operationProgress } from "../../../core/progress.js";
import { fmt } from "../../../core/format.js";
import { summaryItem } from "../../../core/guided.js";
import { safe, label } from "../shared/history-values.js";
import { loadHistory, loadBatches } from "../data/history-rpc.js";

export function startImportWizard(){
  let rows=[],errors=[];
  wizard({
    title:"Importar pedidos históricos",subtitle:"Incorpora únicamente pedidos cerrados o cancelados que no deban iniciar flujo operativo.",finishLabel:"Importar historial",
    steps:[
      {title:"Seleccionar archivo",description:"Usa la plantilla oficial CSV.",content:`<div class="field"><label>Archivo CSV *</label><input class="control" name="file" type="file" accept=".csv,text/csv" required></div><label class="filter-pill"><input name="confirmedHistory" type="checkbox" required> Confirmo que estos registros pertenecen al histórico y no deben iniciar tareas operativas.</label><div class="history-wizard-warning-v11150">Si un número de pedido ya existe como pedido operativo, esa fila será rechazada para proteger la integridad del CRM.</div>`},
      {title:"Validar archivo",description:"Se revisan encabezados y campos obligatorios antes de tocar la base.",content:`<div id="import-analysis">Analizando archivo…</div>`,onEnter:async({root,form})=>{const file=form.querySelector('[name="file"]').files[0];if(!file)throw new Error("Selecciona un archivo CSV.");rows=parseCsv(await file.text()).map(normalizeHistoryRow);errors=rows.filter(row=>!row.orderNumber||!row.clientName);root.querySelector("#import-analysis").innerHTML=`<div class="summary-grid"><div class="summary-box"><span class="muted">Filas</span><strong>${fmt.number(rows.length)}</strong></div><div class="summary-box"><span class="muted">Válidas</span><strong class="success">${fmt.number(rows.length-errors.length)}</strong></div><div class="summary-box"><span class="muted">Con error</span><strong class="danger">${fmt.number(errors.length)}</strong></div><div class="summary-box"><span class="muted">Lotes técnicos</span><strong>${fmt.number(Math.ceil(rows.length/200))}</strong></div></div>${errors.length?'<div class="wizard-tip">Corrige las filas sin pedido o cliente antes de continuar.</div>':""}`},validate:()=>{if(!rows.length)throw new Error("El archivo no contiene registros.");if(errors.length)throw new Error(`El archivo contiene ${errors.length} filas con errores.`);return true}},
      {title:"Vista previa",description:"Comprueba la información antes de incorporarla.",content:`<div id="import-preview"></div>`,onEnter:({root})=>{root.querySelector("#import-preview").innerHTML=rows.length?`<div class="table-wrap mobile-card-table"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Tipo</th><th>Ruta</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>${rows.slice(0,20).map(row=>`<tr><td>${safe(row.orderNumber)}</td><td>${safe(row.clientName)}</td><td>${safe(label(row.orderType))}</td><td>${safe(fmt.route?.(row.deliveryRoute)||label(row.deliveryRoute))}</td><td>${safe(label(row.status))}</td><td>${safe(row.createdAt||"")}</td></tr>`).join("")}</tbody></table></div>`:empty("Sin registros","")}},
      {title:"Confirmar",description:"La importación queda auditada como un lote histórico.",content:`<div class="wizard-summary">${summaryItem("Registros","")}<div class="wizard-summary-item"><label>Registros válidos</label><strong data-valid-rows></strong></div><div class="wizard-summary-item"><label>Modo</label><strong>Archivo histórico protegido</strong></div></div><div class="wizard-confirm-box"><strong>No se crearán tareas ni movimientos operativos</strong><p>Los pedidos serán consultables en Histórico y Analítica. Los conflictos con pedidos nativos se rechazarán.</p></div>`,onEnter:({root})=>{root.querySelector("[data-valid-rows]").textContent=String(rows.length)}}
    ],
    onFinish:async({form})=>{
      const file=form.querySelector('[name="file"]').files[0],parts=chunk(rows,200);const progress=operationProgress({title:"Importando historial",message:"Registrando lote histórico…",fileName:file.name,fileSize:file.size,kind:"import"});let batchId=null,inserted=0,rejected=0;
      try{
        for(let index=0;index<parts.length;index++){
          progress.update({progress:Math.round(12+(index/Math.max(1,parts.length))*78),phase:"REGISTER",message:`Procesando lote ${index+1} de ${parts.length}…`});
          const result=await api.importHistory(file.name,parts[index],batchId);batchId=result.batchId;inserted+=result.inserted;rejected+=result.rejected;
        }
        progress.done(`Importación finalizada: ${inserted} incorporados y ${rejected} rechazados.`);toast(`Importación finalizada: ${inserted} incorporados y ${rejected} rechazados.`,rejected?"error":"success",8000);await Promise.all([loadHistory(),loadBatches()]);
      }catch(error){progress.error(error);throw error}
    }
  });
}
