import { fmt } from "../../../../core/format.js";
import { safeText } from "../../../../shared/formatting/material-values.js";

export function materialPickerHtml(initial={}){
  const ref=safeText(initial.reference||initial.sku);
  const name=safeText(initial.name||initial.description);
  const unit=safeText(initial.unit||"UND");
  const weight=Number(initial.weight||initial.materialWeight||0);
  const id=safeText(initial.materialMasterId||initial.material_master_id);
  const variantId=safeText(initial.materialVariantId||initial.material_variant_id);
  const variantLabel=safeText(initial.variantLabel||initial.variant_label||initial.metadata?.variantLabel);
  const selected=id||ref;
  return `<div class="material-picker ${selected?"selected":""}" data-material-picker
    data-material-id="${fmt.escape(id)}" data-material-reference="${fmt.escape(ref)}"
    data-material-name="${fmt.escape(name)}" data-material-unit="${fmt.escape(unit)}" data-material-weight="${Number.isFinite(weight)?weight:0}"
    data-material-variant-id="${fmt.escape(variantId)}" data-material-variant-label="${fmt.escape(variantLabel)}">
    <label class="material-search-label"><span>Material oficial Siesa</span>
      <input class="control material-search-input" data-material-query autocomplete="off"
        placeholder="Referencia, nombre, familia o marca"
        value="${selected?fmt.escape(`${ref} · ${name}`):""}">
    </label>
    <div class="material-search-results" data-material-results hidden></div>
    <div class="material-selected-card" data-material-selected ${selected?"":"hidden"}>
      <div class="material-selected-identity"><span data-material-reference-label>${fmt.escape(ref||"—")}</span><strong data-material-name-label>${fmt.escape(name||"Material sin resolver")}</strong></div>
      <div class="material-selected-meta">
        <span data-material-unit-label>${fmt.escape(unit)}</span>
        <span class="stock-physical" data-material-physical-label>Físico: —</span>
        <span class="stock-reserved" data-material-reserved-label>Reservado ERP: —</span>
        <span class="stock-atp" data-material-stock-label>Disponible venta: —</span>
      </div>
    </div>
    <div class="material-variant-field" data-material-variant-wrap ${variantLabel?"":"hidden"}>
      <label>Color / variante<select class="control" data-material-variant><option value="${fmt.escape(variantId)}">${fmt.escape(variantLabel||"Selecciona")}</option></select></label>
    </div>
  </div>`;
}
