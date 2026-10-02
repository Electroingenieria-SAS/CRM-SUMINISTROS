import { modal } from "../../../core/ui.js";
import { escapeText } from "../../../core/layout/operational/operational-values.js";
import { confirmOperationalReceipt } from "./confirm-receipt.js";

export function showOperationalReceipt(receiptDialog){
receiptDialog.view=modal({
      title:"Confirmar recepción de mercancía",
      confirmLabel:"Guardar recepción",
      size:"wide",
      body:operationalReceiptBody(receiptDialog),
      onConfirm:dialog=>confirmOperationalReceipt(receiptDialog,dialog)
    });
}

export function operationalReceiptBody(receiptDialog){return `
        <section class="v112-dialog-intro"><span>Recepción integrada</span><strong>${escapeText(receiptDialog.data.order.order_number)}</strong><p>Compra y devolución utilizan el mismo flujo de Recepción. El CRM genera prefijo, consecutivo, código de barras y QR.</p></section>
        <div class="simple-choice-row v112-status-choices">
          <label class="choice"><input type="radio" name="status" value="CONFORMING" checked><span><strong>Conforme</strong><small>Completa cantidades pendientes.</small></span></label>
          <label class="choice"><input type="radio" name="status" value="PARTIAL"><span><strong>Parcial</strong><small>Quedarán cantidades pendientes.</small></span></label>
          <label class="choice"><input type="radio" name="status" value="NONCONFORMING"><span><strong>Con novedad</strong><small>Existe diferencia o rechazo.</small></span></label>
        </div>
        <div class="form-grid">
          <div class="field"><label>Tipo de recepción *</label><select class="control" name="receiptType"><option value="PURCHASE" selected>Compra</option><option value="RETURN">Devolución</option></select></div>
          <div class="field"><label>Prefijo *</label><input class="control" name="documentPrefix" value="REC" minlength="2" maxlength="8" required></div>
          <div class="field"><label>Orden de compra</label><input class="control" name="purchaseOrder"></div>
          <div class="field"><label>Proveedor / origen</label><input class="control" name="supplierName"></div>
          <div class="field"><label>Ubicación *</label><input class="control" name="location" value="RECEPCION" required></div>
          <div class="field"><label>Lote común</label><input class="control" name="lotNumber"></div>
        </div>
        <div class="simple-receipt-list">${receiptDialog.rows}</div>
        <section class="v112-subsection">
          <header><strong>Verificación y levantamiento de información</strong><small>Queda asociado a la misma recepción y a su trazabilidad.</small></header>
          <div class="form-grid">
            <label class="v112-open-ended full"><input type="checkbox" name="verified" checked><span><strong>Recepción verificada</strong><small>Registra quién verificó y la fecha automáticamente.</small></span></label>
            <div class="field full"><label>Información levantada</label><textarea class="control" name="informationCaptured" placeholder="Datos tomados durante la recepción, referencias, empaque, observaciones del proveedor, etc."></textarea></div>
            <div class="field full"><label>Nota de verificación</label><textarea class="control" name="verificationNote" placeholder="Resultado de la revisión física/documental"></textarea></div>
          </div>
        </section>
        <section class="v112-subsection">
          <header><strong>Novedades</strong><small>Solo diligencia estos campos cuando exista una novedad real.</small></header>
          <div class="form-grid">
            <div class="field"><label>Tipo de novedad</label><select class="control" name="noveltyType"><option value="">Sin novedad</option><option value="SHORTAGE">Faltante</option><option value="EXCESS">Sobrante</option><option value="DAMAGED">Avería</option><option value="WRONG_ITEM">Material incorrecto</option><option value="DOCUMENT">Documento / factura</option><option value="QUALITY">Calidad</option><option value="OTHER">Otra</option></select></div>
            <div class="field"><label>Severidad</label><select class="control" name="noveltySeverity"><option value="LOW">Baja</option><option value="MEDIUM" selected>Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></div>
            <div class="field full"><label>Detalle de novedad</label><textarea class="control" name="noveltyNote"></textarea></div>
          </div>
        </section>
        <div class="field"><label>Observación general</label><textarea class="control" name="note"></textarea></div>`;}
