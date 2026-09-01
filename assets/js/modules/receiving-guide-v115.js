import {state} from "../core/state.js";
import {modal} from "../core/ui.js";

let installed=false;

export function installReceivingGuideV115(){
  if(installed)return;
  installed=true;
  document.addEventListener("click",event=>{
    const button=event.target?.closest?.("[data-v113-guide-module]");
    if(!button||state.currentModule!=="receiving")return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openReceivingGuideV115();
  },true);
}

export function openReceivingGuideV115(){
  modal({
    title:"Guía · Recepción",
    confirmLabel:"Entendido",
    size:"wide",
    body:`
      <section class="v115-dialog-intro">
        <span>DOS PROCESOS DIFERENTES</span>
        <strong>Primero identifica qué estás haciendo</strong>
        <p>Recepción de mercancía controla el ingreso físico a bodega. Recepción de pedido controla la validación y continuidad de un pedido. No son la misma operación.</p>
      </section>
      <div class="v115-guide-grid">
        <article class="v115-guide-process goods">
          <header><span>▣</span><div><small>PROCESO DE BODEGA</small><h4>Recepción de mercancía</h4></div></header>
          <p>Úsala cuando una compra o devolución llega físicamente y debe ingresar al sistema y a bodega.</p>
          <ol>
            <li><strong>Crea la recepción.</strong> Puede ser completamente independiente de un pedido.</li>
            <li><strong>Enlaza un PVE solo si corresponde.</strong> El vínculo sirve para precargar OC, proveedor y materiales.</li>
            <li><strong>Cuenta y clasifica.</strong> Registra recibido, aceptado y rechazado por material.</li>
            <li><strong>Selecciona el material oficial Siesa.</strong> Solo lo aceptado ingresa a inventario y lote de bodega.</li>
            <li><strong>Registra novedades y verificación.</strong> Deja faltantes, averías, documentos, observaciones y responsable.</li>
            <li><strong>Identifica la recepción.</strong> El CRM genera REC/DEV, consecutivo, QR y código de barras.</li>
          </ol>
          <div class="v115-guide-rule"><strong>Si está enlazada a un PVE</strong><span>Al guardar se marca Mercancía OK automáticamente. No cambia etapa, estado, responsable ni ruta del pedido.</span></div>
          <footer><b>Debe quedar evidenciado</b><span>REC/DEV · proveedor/OC/factura · materiales y cantidades · ubicación/lote · novedades · verificación · QR/código.</span></footer>
        </article>
        <article class="v115-guide-process order">
          <header><span>✓</span><div><small>PROCESO DEL PEDIDO</small><h4>Recepción de pedido</h4></div></header>
          <p>Úsala cuando un pedido ya llegó a su etapa de Recepción de pedido y debe validarse antes de Alistamiento.</p>
          <ol>
            <li><strong>Toma el pedido.</strong> Evita que dos personas lo trabajen simultáneamente.</li>
            <li><strong>Revisa la información comercial.</strong> Valida soportes, materiales y datos del asesor.</li>
            <li><strong>Corrige o asigna información.</strong> Puedes conservar las líneas o leer/ajustar el PDF.</li>
            <li><strong>Relaciona materiales con Siesa.</strong> Confirma cantidades y requisitos de corte.</li>
            <li><strong>Asigna auxiliares.</strong> Define responsable de Alistamiento y Corte cuando corresponda.</li>
            <li><strong>Confirma la recepción del pedido.</strong> Esta acción sí mueve el workflow hacia Alistamiento.</li>
          </ol>
          <div class="v115-guide-rule"><strong>Importante</strong><span>Este proceso no recibe mercancía en inventario. Su función es validar y preparar la continuidad logística del pedido.</span></div>
          <footer><b>Debe quedar evidenciado</b><span>Pedido validado · líneas definitivas · material Siesa · responsable de Alistamiento/Corte · evento de transición.</span></footer>
        </article>
      </div>`
  });
}
