import { formSelect } from "../shared/form-values.js";
import { validateDeliveryAddress, validateOrderMaterials } from "./validation.js";
import { renderOrderReview } from "./order-review.js";

export function orderFormStep(types,payments,routes,departmentOptions){return {title:"Pedido, cliente y entrega",description:"La dirección se registra aquí y Logística solo agregará la guía.",content:`
        <div class="form-grid">
          <div class="field"><label>Número de pedido *</label><input class="control" name="orderNumber" placeholder="Ejemplo: PVC-5001" required autofocus></div>
          <div class="field"><label>Cliente *</label><input class="control" name="clientName" required></div>
          <div class="field"><label>Tipo *</label>${formSelect("orderType",types,"code","name",types[0]?.code)}</div>
          <div class="field"><label>Condición de pago *</label>${formSelect("paymentCondition",payments,"code","name",payments[0]?.code)}</div>
          <div class="field full order-routing-conditions" data-routing-conditions>
            <div class="conditional-routing-card" data-credit-arrears hidden><label><input type="checkbox" name="hasCreditArrears"> <span><strong>Cliente con mora en crédito</strong><small>Solo al marcarlo, los pedidos PVC o PVP pasarán primero por Cartera.</small></span></label></div>
            <div class="conditional-routing-card" data-cash-hold hidden><label><input type="checkbox" name="heldByCashier"> <span><strong>Pedido retenido por Caja</strong><small>Solo al marcarlo, el pedido PVN pasará primero por Caja.</small></span></label></div>
            <div class="conditional-routing-direct" data-direct-reception><strong>Ruta inicial: Recepción de pedidos</strong><small>Si no existe una condición excepcional, el pedido no pasa por Cartera ni Caja.</small></div>
          </div>
          <div class="field"><label>Modalidad de entrega *</label>${formSelect("deliveryRoute",routes,"code","name",routes[0]?.code)}</div>
          <section class="sales-intelligence-card full" data-customer-intelligence>
            <div class="sales-intelligence-mark">◎</div>
            <div><span>SEGMENTACIÓN AUTOMÁTICA</span><strong data-customer-segment>Normal · aprendiendo</strong><p data-customer-intelligence-copy>El CRM clasificará al cliente por cantidad de pedidos y valor económico reconocido. Prioriza pagos confirmados de Caja y usa la factura solo como respaldo provisional cuando aún no existe pago.</p></div>
            <small data-customer-confidence>50% frecuencia · 50% valor</small>
          </section>
        </div>
        <section class="sales-address-card">
          <header class="sales-address-head"><span>Dirección</span><div><strong>Lugar de entrega obligatorio</strong><p>Selecciona el departamento y el municipio. Después escribe la dirección exactamente como debe verla Logística.</p></div></header>
          <div class="sales-address-grid">
            <div class="field"><label>País</label><input class="control" value="Colombia" readonly aria-readonly="true"><input type="hidden" name="clientCountry" value="Colombia"></div>
            <div class="field"><label>Departamento *</label><select class="control" name="clientDepartmentCode" required>${departmentOptions}</select><input type="hidden" name="clientDepartment"></div>
            <div class="field"><label>Municipio o ciudad *</label><select class="control" name="clientCity" required disabled><option value="">Primero selecciona el departamento</option></select><small class="field-help" data-municipality-help>La lista se cargará según el departamento.</small></div>
            <div class="field full"><label>Dirección completa *</label><input class="control" name="clientAddress" placeholder="Ejemplo: Carrera 40 # 28-15, Bodega 3" required autocomplete="street-address"><small class="field-help">Incluye vía, número, barrio, vereda, bodega, local o referencia cuando aplique.</small></div>
          </div>
          <section class="sales-freight-estimate" data-freight-estimate>
            <div class="sales-freight-icon">↗</div>
            <div><span>FLETE ESTIMADO</span><strong data-freight-estimate-value>Selecciona modalidad y destino</strong><p data-freight-estimate-copy>El rango se aprenderá de guías y facturas reales por ciudad, modalidad, peso, paquetes y volumen cuando exista.</p></div>
            <small data-freight-confidence>Sin histórico todavía</small>
            <div class="sales-freight-carriers-v1140" data-freight-carriers></div>
          </section>
        </section>
        <input type="hidden" name="clientDocument"><input type="hidden" name="clientPhone"><input type="hidden" name="externalReference"><input type="hidden" name="requestedDeliveryDate">`,validate:validateDeliveryAddress};}

export function orderMaterialsStep(){return {title:"Materiales",description:"Ventas define qué se vendió y cuánto. Logística decidirá después de qué lote, ubicación o carreto sale.",content:`
        <section class="sales-materials-intro">
          <div class="sales-materials-intro-main"><span class="official-material-mark">SIESA</span><div><strong>Busca, selecciona y registra la necesidad</strong><p>No escribas referencias, nombres, lotes ni ubicaciones. El ERP usa el maestro oficial y reserva lógicamente la cantidad al crear el pedido.</p></div></div>
          <label class="sales-purchase-toggle"><input type="checkbox" name="requiresPurchase"><span><strong>Requiere compra</strong><small>Úsalo cuando comercialmente el pedido dependa de abastecimiento. PVE conserva su ruta por Compras.</small></span></label>
        </section>
        <div class="items-wizard-head"><div><strong>Materiales vendidos</strong><p>Para materiales en metros puedes registrar entrega directa o varias medidas de corte. El total se calcula automáticamente.</p></div><button class="btn btn-create" type="button" id="add-item">Agregar material</button></div>
        <div class="sales-material-list" id="items-editor"></div>
        <section class="sales-material-freight-v1140" data-material-freight-prediction>
          <span>PREDICCIÓN LOGÍSTICA</span>
          <div><strong>Completa los materiales para refinar el flete</strong><p>El CRM calculará el peso usando el maestro Siesa y comparará COLVANES, TCC y VELOENVIOS para despacho nacional.</p></div>
        </section>`,validate:validateOrderMaterials};}

export function orderConfirmationStep(){return {title:"Confirmar",description:"Revisa el destino, el total de materiales y si existen cortes antes de crear.",content:`<div id="order-review" class="wizard-summary"></div><section class="sales-reservation-confirm"><span>RESERVA ERP</span><div><strong>Ventas no asigna lotes</strong><p>Al crear el pedido, el ERP reservará la necesidad contra la disponibilidad comercial. Alistamiento y Corte definirán el origen físico real y lo dejarán trazado.</p></div></section>`,onEnter:renderOrderReview};}
