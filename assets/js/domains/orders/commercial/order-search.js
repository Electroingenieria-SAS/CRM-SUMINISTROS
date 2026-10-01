import { icon } from "../../../core/icons.js";

export function upgradeOrdersSearch(root){
  const toolbar=root.querySelector("#orders-result")?.closest(".card")?.querySelector(".toolbar");
  if(!toolbar||toolbar.dataset.commercialSearch)return;
  toolbar.dataset.commercialSearch="1";
  const card=toolbar.closest(".card");
  card?.classList.add("commercial-results-card");
  const search=toolbar.querySelector("#f-search");
  const apply=toolbar.querySelector("#apply-filters");
  if(!search||!apply)return;

  const shell=document.createElement("section");
  shell.className="commercial-search-shell";
  shell.innerHTML=`
    <header class="commercial-search-head"><div><span>BUSCAR PEDIDO</span><h3>¿Qué pedido necesitas?</h3><p>Escribe el número, el cliente o una referencia. Para la mayoría de consultas no necesitas ningún otro filtro.</p></div><div class="commercial-search-hint">Puedes escribir y presionar Enter</div></header>
    <div class="commercial-search-primary"><div class="commercial-search-input"></div><div class="commercial-search-button"></div></div>
    <div class="commercial-presets" aria-label="Consultas rápidas">
      <button type="button" data-order-preset="all">Todos</button>
      <button type="button" data-order-preset="mine">Mis pedidos</button>
      <button type="button" data-order-preset="active">Activos</button>
      <button type="button" data-order-preset="history">Cerrados / historial</button>
    </div>
    <details class="commercial-advanced-filters"><summary><span>${icon("search")} Filtros avanzados</span><small>Etapa, estado, tipo, modalidad y asignación</small></summary><div class="commercial-advanced-grid"></div><footer><button type="button" class="btn btn-ghost" data-clear-order-filters>Limpiar filtros</button></footer></details>`;

  const inputHost=shell.querySelector(".commercial-search-input");
  inputHost.append(search);
  search.classList.add("commercial-main-search");
  search.placeholder="Ejemplo: PVC-5001, Comercial ABC o referencia";
  const buttonHost=shell.querySelector(".commercial-search-button");
  buttonHost.append(apply);
  apply.innerHTML=`${icon("search")}<span>Buscar pedido</span>`;
  apply.classList.add("commercial-search-cta");

  const advanced=shell.querySelector(".commercial-advanced-grid");
  [...toolbar.children].forEach(node=>advanced.append(node));
  toolbar.replaceWith(shell);

  shell.querySelectorAll("[data-order-preset]").forEach(button=>button.addEventListener("click",()=>{
    applyOrderPreset(root,button.dataset.orderPreset);
    shell.querySelectorAll("[data-order-preset]").forEach(item=>item.classList.toggle("active",item===button));
  }));
  shell.querySelector("[data-clear-order-filters]")?.addEventListener("click",()=>{
    ["#f-step","#f-status","#f-type","#f-route"].forEach(selector=>{const el=root.querySelector(selector);if(el)el.value=""});
    const assignment=root.querySelector("#f-assignment");if(assignment)assignment.value="ALL";
    const history=root.querySelector("#f-history");if(history)history.checked=true;
    if(search)search.value="";
    shell.querySelectorAll("[data-order-preset]").forEach(item=>item.classList.remove("active"));
    apply.click();
  });

  const hint=card?.querySelector(".selection-hint");
  if(hint){
    hint.classList.add("commercial-result-heading");
    hint.innerHTML=`<div><span>RESULTADOS</span><strong>Pedidos encontrados</strong></div><div class="commercial-result-summary"><b data-commercial-order-count>—</b><small>visibles en esta página</small></div>`;
  }
}

export function applyOrderPreset(root,preset){
  const search=root.querySelector("#f-search");
  const status=root.querySelector("#f-status");
  const assignment=root.querySelector("#f-assignment");
  const history=root.querySelector("#f-history");
  ["#f-step","#f-type","#f-route"].forEach(selector=>{const el=root.querySelector(selector);if(el)el.value=""});
  if(status)status.value="";
  if(assignment)assignment.value="ALL";
  if(history)history.checked=true;
  if(preset==="mine"){
    if(assignment)assignment.value="MINE";
    if(history)history.checked=false;
  }else if(preset==="active"){
    if(history)history.checked=false;
  }else if(preset==="history"){
    if(status)status.value="CLOSED";
    if(history)history.checked=true;
  }
  root.querySelector("#apply-filters")?.click();
  search?.focus({preventScroll:true});
}

export function refreshOrderResultMeta(root){
  const count=root.querySelector("[data-commercial-order-count]");
  if(count)count.textContent=String(root.querySelectorAll("#orders-result .orders-master-row").length);
  root.querySelectorAll("#orders-result .orders-master-row").forEach(row=>row.classList.add("commercial-order-row"));
}
