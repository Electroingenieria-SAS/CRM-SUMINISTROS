import { materialPickerHtml } from "../../../services/materials.js";

export function salesMaterialCardHtml(){
  return `<div class="sales-material-index item-row-number"></div>
    <div class="sales-material-main">
      <div class="official-item-picker">${materialPickerHtml()}</div>
      <section class="sales-demand-builder" data-sales-demand hidden>
        <div class="sales-demand-mode" data-sales-mode-wrap hidden>
          <button type="button" class="sales-mode active" data-sales-mode="DIRECT"><span>Entrega directa</span><small>Empacar / enviar la cantidad solicitada</small></button>
          <button type="button" class="sales-mode" data-sales-mode="CUTS"><span>Cortes por medida</span><small>Define tramos y el ERP calcula el total</small></button>
        </div>
        <div class="sales-direct-demand" data-direct-demand>
          <label class="field"><span>Cantidad solicitada *</span><div class="sales-quantity-control"><input class="control" data-sales-quantity type="number" min="0.0001" step="any" placeholder="0"><b data-sales-unit>UND</b></div></label>
        </div>
        <div class="sales-cuts-demand" data-cuts-demand hidden>
          <div class="sales-cut-head"><div><strong>Plan de cortes</strong><p>Agrega una fila por medida. Puedes pedir varias piezas de la misma longitud.</p></div><button type="button" class="btn btn-create" data-add-cut>Agregar medida</button></div>
          <div class="sales-cut-list" data-cut-list></div>
        </div>
        <div class="sales-demand-summary" data-demand-summary><div><small>Total solicitado</small><strong>0</strong></div><div><small>Disponible para venta</small><strong>—</strong></div><div><small>Después de reservar</small><strong>—</strong></div></div>
        <div class="sales-demand-status" data-demand-status></div>
      </section>
    </div>
    <button type="button" class="icon-btn sales-material-remove" data-remove-material title="Eliminar material">×</button>`;
}
