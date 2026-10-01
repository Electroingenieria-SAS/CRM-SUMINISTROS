import { fmt } from "../../../../core/format.js";
import { materialPickerHtml } from "../../../../services/materials.js";

export function editableLine(line,index){
  const unresolved=line.materialResolution==="NOT_FOUND";
  return `<article class="reception-line-row official-reception-line ${unresolved?"unresolved":""}" data-line-row data-order-item-id="${fmt.escape(line.orderItemId||"")}">
    <div class="reception-line-number">${index+1}</div>
    <div class="reception-line-material">
      ${materialPickerHtml({materialMasterId:line.materialMasterId||line.material_master_id,materialVariantId:line.materialVariantId||line.material_variant_id,variantLabel:line.variantLabel||line.variant_label,reference:line.reference,sku:line.sku,name:line.description,description:line.description,unit:line.unit})}
      ${unresolved?`<div class="material-resolution-warning">No se pudo relacionar automáticamente esta línea. Busca y selecciona el material oficial antes de continuar.</div>`:""}
    </div>
    <div class="reception-line-fields official-line-quantity">
      <div class="field"><label>Cantidad *</label><input class="control" data-field="quantity" type="number" min="0.0001" step="any" value="${fmt.escape(line.quantity??"")}" placeholder="Cantidad" required></div>
      <div class="field"><label>Ubicación operativa</label><input class="control" data-field="warehouseLocation" value="${fmt.escape(line.warehouseLocation||"")}" placeholder="Opcional"></div>
    </div>
    <div class="reception-cut-controls">
      <label class="filter-pill"><input type="checkbox" data-field="requiresCut" ${line.requiresCut?"checked":""}> Requiere corte</label>
      <input class="control" data-field="requestedCutLength" type="number" min="0.0001" step="any" value="${fmt.escape(line.requestedCutLength??"")}" placeholder="Longitud por unidad" ${line.requiresCut?"required":"disabled"}>
      <button type="button" class="icon-btn" data-remove-line title="Eliminar línea">×</button>
    </div>
  </article>`;
}
