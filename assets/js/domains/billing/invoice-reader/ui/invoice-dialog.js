import { bindManualTracking } from "./manual-fields.js";
import { handleFile } from "../pdf/read-invoice-file.js";
import { escapeHtml } from "../parse/localized-values.js";

export function enhanceInvoiceDialog(modal){
  const note=modal.querySelector(".billing-upload-note");
  const fileInput=modal.querySelector('input[type="file"][name="file"]');
  if(!note||!fileInput)return;
  if(/PVP/i.test(modal.querySelector(".modal-head")?.textContent||""))return;
  if(modal.dataset.invoiceReaderEnhanced==="1")return;
  modal.dataset.invoiceReaderEnhanced="1";
  modal.classList.add("invoice-reader-v1199");

  const workspace=modal.querySelector(".billing-upload-workspace-v1199")||fileInput.closest(".field")||modal.querySelector(".modal-body");
  if(!workspace)return;
  const section=document.createElement("section");
  section.className="invoice-reader-panel-v1199";
  section.dataset.invoiceReaderState="idle";
  section.innerHTML=`
    <header class="invoice-reader-head-v1199">
      <div class="invoice-reader-icon-v1199" aria-hidden="true">⌁</div>
      <div><span>LECTURA AUTOMÁTICA</span><h4>Datos de la factura</h4><p>Al seleccionar el PDF, el CRM intentará completar estos campos. Todos se pueden editar antes de guardar.</p></div>
      <span class="invoice-reader-status-v1199" data-invoice-reader-status>Esperando PDF</span>
    </header>
    <div class="invoice-reader-message-v1199" data-invoice-reader-message>Selecciona la factura para iniciar la lectura automática.</div>
    <div class="invoice-reader-grid-v1199">
      ${field("Número de factura","invoiceNumberV1199","text","Ej. FE-102845",true)}
      ${field("Nombre / emisor de factura","invoiceNameV1199","text","Razón social o nombre que aparece en la factura",true)}
      ${field("Fecha de factura","invoiceDateV1199","date","",true)}
      ${field("Valor total","invoiceAmountV1199","number","0",true,'step="0.01" min="0.01" inputmode="decimal"')}
      ${field("Cantidad total de productos","invoiceQuantityV1199","number","0",true,'step="0.001" min="0.001" inputmode="decimal"')}
      ${field("Peso total (kg)","invoiceWeightV1199","number","Completar si el PDF no lo informa",true,'step="0.001" min="0.001" inputmode="decimal" data-weight-field')}
    </div>
    <input type="hidden" name="invoiceLinesV1199" value="">
    <div class="invoice-reader-foot-v1199">
      <span><b>Automático</b> número, fecha, valor, cantidad y peso cuando estén presentes.</span>
      <span><b>Editable</b> puedes corregir cualquier dato antes de guardar.</span>
    </div>`;
  workspace.append(section);

  const today=new Date().toISOString().slice(0,10);
  modal.querySelector('[name="invoiceDateV1199"]').value=today;
  bindManualTracking(modal);
  fileInput.addEventListener("change",()=>handleFile(modal,fileInput));
  if(fileInput.files?.[0])handleFile(modal,fileInput);
}

export function field(label,name,type,placeholder,required=false,extra=""){
  return `<label class="invoice-reader-field-v1199"><span>${escapeHtml(label)}${required?' <em>*</em>':''}</span><input class="control" name="${name}" type="${type}" placeholder="${escapeHtml(placeholder)}" ${required?"required":""} ${extra}><small data-field-source="${name}">Editable</small></label>`;
}
