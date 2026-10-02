import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { materialPickerHtml, bindMaterialPicker } from "../../../../services/materials.js";
import { esc, n } from "../shared/goods-values.js";

export function blankGoodsLine(){return {orderItemId:null,materialMasterId:null,materialVariantId:null,reference:"",description:"",unit:"UND",expected:null,received:"",accepted:"",rejected:0,location:"RECEPCION",lot:""}}

export function goodsLineHtml(line,index){
  const expected=line.expected!=null?`<small class="v115-expected">Referencia PVE: ${fmt.number(line.expected,3)} ${esc(line.unit||"UND")}</small>`:"";
  return `<article class="v115-goods-line" data-v115-line data-order-item-id="${esc(line.orderItemId||"")}">
    <div class="v115-line-number">${index+1}</div>
    <div class="v115-line-material">${materialPickerHtml({materialMasterId:line.materialMasterId,materialVariantId:line.materialVariantId,reference:line.reference,name:line.description,unit:line.unit})}${expected}</div>
    <div class="v115-line-qty"><label>Recibido<input class="control" type="number" step="any" min="0" data-field="received" value="${esc(line.received)}"></label><label>Aceptado<input class="control" type="number" step="any" min="0" data-field="accepted" value="${esc(line.accepted)}"></label><label>Rechazado<input class="control" type="number" step="any" min="0" data-field="rejected" value="${esc(line.rejected)}"></label></div>
    <div class="v115-line-lot"><label>Ubicación<input class="control" data-field="location" value="${esc(line.location||"RECEPCION")}"></label><label>Lote<input class="control" data-field="lot" value="${esc(line.lot||"")}"></label></div>
    <button type="button" class="icon-btn" data-v115-remove-line aria-label="Quitar material">×</button>
  </article>`;
}

export function bindGoodsLines(root){
  const host=root.querySelector("[data-v115-lines]");
  host.querySelectorAll("[data-v115-line]").forEach(row=>{
    bindMaterialPicker(row.querySelector("[data-material-picker]"));
    const received=row.querySelector('[data-field="received"]'),accepted=row.querySelector('[data-field="accepted"]'),rejected=row.querySelector('[data-field="rejected"]');
    received.oninput=()=>{if(!accepted.dataset.touched)accepted.value=received.value};
    accepted.oninput=()=>{accepted.dataset.touched="1";const r=n(received.value),a=n(accepted.value);rejected.value=String(Math.max(0,r-a))};
    rejected.oninput=()=>{rejected.dataset.touched="1"};
    row.querySelector("[data-v115-remove-line]").onclick=()=>{if(host.children.length<=1)return toast("La recepción necesita al menos un material.","error");row.remove();renumberLines(host)};
  });
}

export function renumberLines(host){host.querySelectorAll(".v115-line-number").forEach((node,index)=>node.textContent=String(index+1))}
