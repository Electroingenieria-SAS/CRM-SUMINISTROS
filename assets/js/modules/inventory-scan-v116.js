import {state} from "../core/state.js";
import {modal,toast,closeDialog,loading,empty} from "../core/ui.js";
import {fmt} from "../core/format.js";
import {getSupabase} from "../services/supabase.js";
import {navigate} from "../core/router.js";

let installed=false;
let deepLinkHandled="";
let receiptEnhanceTimer=null;

async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error){
    const detail=[error.message,error.details,error.hint].filter(Boolean).join(" · ");
    throw new Error(detail||"No fue posible consultar el código.");
  }
  return data;
}

function esc(value){return fmt.escape(String(value??""))}
function buildInventoryUrl(scanCode){
  const base=`${location.origin}${location.pathname}`;
  return `${base}#/inventory?scan=${encodeURIComponent(scanCode)}`;
}

export function installInventoryScanV116(){
  if(installed)return;
  installed=true;
  document.addEventListener("click",event=>{
    const scan=event.target.closest?.("[data-v116-scan]");
    if(scan){event.preventDefault();openInventoryScanner();return}
    const labels=event.target.closest?.("[data-v116-item-labels]");
    if(labels){event.preventDefault();openItemLabels(labels.dataset.v116ItemLabels);return}
    const print=event.target.closest?.("[data-v116-print-lot]");
    if(print){event.preventDefault();printLotLabel(JSON.parse(decodeURIComponent(print.dataset.v116PrintLot)));return}
    const all=event.target.closest?.("[data-v116-print-all]");
    if(all){event.preventDefault();printAllLabels(all.closest("[data-v116-label-section]")?._v116LabelData||[]);return}
  },true);

  const app=document.querySelector("#app");
  if(app){
    const observer=new MutationObserver(()=>scheduleEnhance());
    observer.observe(app,{childList:true,subtree:true});
  }
  const modalRoot=document.querySelector("#modal-root");
  if(modalRoot){
    const modalObserver=new MutationObserver(()=>scheduleReceiptEnhance());
    modalObserver.observe(modalRoot,{childList:true,subtree:true});
  }
  scheduleEnhance();
  scheduleReceiptEnhance();
}

function scheduleEnhance(){setTimeout(enhanceInventoryPage,0)}
function scheduleReceiptEnhance(){
  clearTimeout(receiptEnhanceTimer);
  receiptEnhanceTimer=setTimeout(enhanceReceiptDetail,40);
}

function enhanceInventoryPage(){
  if(state.currentModule!=="inventory")return;
  const root=document.querySelector("#page-content");
  if(!root)return;
  const actions=root.querySelector(".page-head .page-actions");
  if(actions&&!actions.querySelector("[data-v116-scan]")){
    actions.insertAdjacentHTML("afterbegin",'<button type="button" class="btn btn-create v116-scan-btn" data-v116-scan>▣ Escanear QR / código</button>');
  }
  root.querySelectorAll(".official-inventory-card").forEach(card=>{
    const footer=card.querySelector("footer");
    if(!footer||footer.querySelector("[data-v116-item-labels]"))return;
    const source=footer.querySelector("[data-inventory-item],[data-inventory-view]");
    const itemId=source?.dataset.inventoryItem||source?.dataset.inventoryView;
    if(!itemId)return;
    footer.insertAdjacentHTML("beforeend",`<button type="button" class="btn btn-ghost v116-label-btn" data-v116-item-labels="${esc(itemId)}">QR / etiquetas</button>`);
  });
  const scanCode=state.currentParams?.scan||new URLSearchParams(location.hash.split("?")[1]||"").get("scan")||"";
  if(scanCode&&scanCode!==deepLinkHandled){
    deepLinkHandled=scanCode;
    setTimeout(()=>resolveAndShow(scanCode,{fromDeepLink:true}),80);
  }
}

export async function openInventoryScanner(){
  const view=modal({
    title:"Escanear inventario",
    size:"wide",
    confirmLabel:"Cerrar",
    body:`
      <section class="v116-scan-intro"><span>LECTOR DEL CRM</span><strong>Apunta al QR o al código de barras</strong><p>El lector identifica el material, lote y ubicación exactos. También puedes pegar o digitar el código.</p></section>
      <div class="v116-scanner-shell">
        <div class="v116-camera"><video playsinline muted autoplay data-v116-video></video><div class="v116-reticle"><i></i><i></i><i></i><i></i></div><div class="v116-camera-status" data-v116-camera-status>Preparando cámara…</div></div>
        <div class="v116-scan-side">
          <div class="field"><label>Código manual</label><input class="control" data-v116-manual placeholder="EI-L-… o enlace del CRM" autocomplete="off"></div>
          <button type="button" class="btn btn-primary" data-v116-resolve>Consultar código</button>
          <button type="button" class="btn btn-ghost" data-v116-torch hidden>Linterna</button>
          <div class="v116-scan-help"><strong>También funciona con la cámara normal</strong><p>Los QR impresos contienen un enlace directo al CRM. La cámara del celular puede abrir el lote aunque la app esté cerrada.</p></div>
        </div>
      </div>`
  });
  const root=view.root;
  const video=root.querySelector("[data-v116-video]");
  const status=root.querySelector("[data-v116-camera-status]");
  const manual=root.querySelector("[data-v116-manual]");
  const torch=root.querySelector("[data-v116-torch]");
  let stopped=false,stream=null,raf=0,controls=null;

  const cleanup=()=>{
    if(stopped)return;stopped=true;
    if(raf)cancelAnimationFrame(raf);
    try{controls?.stop?.()}catch{}
    try{stream?.getTracks?.().forEach(track=>track.stop())}catch{}
    if(video)video.srcObject=null;
  };
  const consume=async value=>{
    const code=String(value||"").trim();
    if(!code)return;
    cleanup();
    closeDialog();
    await resolveAndShow(code,{fromDeepLink:false});
  };
  root.querySelector("[data-v116-resolve]").onclick=()=>consume(manual.value);
  manual.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();consume(manual.value)}};
  const detachObserver=new MutationObserver(()=>{if(!document.contains(video)){cleanup();detachObserver.disconnect()}});
  detachObserver.observe(document.querySelector("#modal-root"),{childList:true,subtree:true});

  try{
    if("BarcodeDetector" in window&&navigator.mediaDevices?.getUserMedia){
      const supported=await window.BarcodeDetector.getSupportedFormats();
      const desired=["qr_code","code_128","code_39","ean_13","ean_8","data_matrix"];
      const formats=desired.filter(x=>supported.includes(x));
      const detector=new window.BarcodeDetector(formats.length?{formats}:undefined);
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"}}});
      video.srcObject=stream;await video.play();
      const track=stream.getVideoTracks()[0];
      const capabilities=track?.getCapabilities?.();
      if(capabilities?.torch){torch.hidden=false;let on=false;torch.onclick=async()=>{on=!on;await track.applyConstraints({advanced:[{torch:on}]});torch.textContent=on?"Apagar linterna":"Linterna"}};
      status.textContent="Cámara activa · acerca el código al recuadro";
      const detect=async()=>{
        if(stopped||!document.contains(video))return cleanup();
        try{const codes=await detector.detect(video);if(codes?.[0]?.rawValue)return consume(codes[0].rawValue)}catch{}
        raf=requestAnimationFrame(detect);
      };
      raf=requestAnimationFrame(detect);
      return;
    }
    if(window.ZXingBrowser?.BrowserMultiFormatReader){
      status.textContent="Cámara activa · lector compatible";
      const reader=new window.ZXingBrowser.BrowserMultiFormatReader();
      controls=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:"environment"}}},video,(result)=>{
        const value=result?.getText?.()||result?.text||"";
        if(value)consume(value);
      });
      if(controls?.switchTorch){torch.hidden=false;torch.onclick=()=>controls.switchTorch()}
      return;
    }
    status.textContent="Este navegador no habilitó lectura automática. Usa el QR con la cámara normal o digita el código.";
  }catch(error){
    status.textContent="No fue posible abrir la cámara. Revisa el permiso del navegador o usa el código manual.";
    console.warn("[CRM SCANNER]",error);
  }
}

async function resolveAndShow(raw,{fromDeepLink=false}={}){
  try{
    const data=await rpc("erp_x_inventory_scan_resolve",{p_code:raw});
    window.dispatchEvent(new CustomEvent("erp:inventory-scan",{detail:data}));
    showScanResult(data,{fromDeepLink});
  }catch(error){
    if(fromDeepLink)deepLinkHandled="";
    toast(error.message,"error",7500);
  }
}

function showScanResult(data,{fromDeepLink=false}={}){
  const item=data.item||{},lot=data.lot||{},receipt=data.receipt||null;
  const payload={scanCode:data.scanCode,reference:item.reference,description:item.description,unit:item.unit,lotNumber:lot.lotNumber,location:lot.location,warehouseCode:lot.warehouseCode,acceptedQuantity:lot.available};
  const view=modal({
    title:"Inventario identificado",
    size:"wide",
    confirmLabel:"Cerrar",
    body:`
      <section class="v116-found-hero"><span>LECTURA CORRECTA</span><strong>${esc(item.reference)}</strong><h3>${esc(item.description)}</h3><p>${esc(data.scanCode)}</p></section>
      <div class="v116-found-grid"><article><small>Lote</small><strong>${esc(lot.lotNumber||"—")}</strong></article><article><small>Ubicación</small><strong>${esc([lot.warehouseCode,lot.location,lot.locationName].filter(Boolean).join(" · ")||"—")}</strong></article><article><small>Disponible</small><strong>${fmt.number(lot.available,3)} ${esc(item.unit||"")}</strong></article><article><small>Reservado</small><strong>${fmt.number(lot.reserved,3)}</strong></article><article><small>Bloqueado</small><strong>${fmt.number(lot.blocked,3)}</strong></article><article><small>Origen</small><strong>${receipt?esc(receipt.receiptNumber):esc(lot.sourceSystem||"Inventario")}</strong></article></div>
      ${receipt?`<div class="v116-origin-note"><strong>Ingreso por recepción de mercancía</strong><span>${esc(receipt.receiptNumber)} · ${esc(receipt.supplierName||"Proveedor no informado")} · ${fmt.date(receipt.receivedAt)}</span></div>`:""}
      <section class="v116-result-actions"><button type="button" class="btn btn-primary" data-v116-result-print>Imprimir etiqueta</button>${state.currentModule!=="inventory"?'<button type="button" class="btn btn-create" data-v116-result-inventory>Abrir en Inventario</button>':""}</section>`
  });
  view.root.querySelector("[data-v116-result-print]").onclick=()=>printLotLabel(payload);
  view.root.querySelector("[data-v116-result-inventory]")?.addEventListener("click",()=>{closeDialog();navigate("inventory",{scan:data.scanCode})});
  if(fromDeepLink&&state.currentModule==="inventory"){
    const search=document.querySelector("#inv-search");
    if(search)search.value=item.reference||"";
  }
}

async function openItemLabels(itemId){
  try{
    const lots=await rpc("erp_x_inventory_lots",{p_item_id:itemId,p_search:null});
    const scannable=(lots||[]).filter(lot=>lot.scanCode);
    const view=modal({
      title:"QR y etiquetas de inventario",
      size:"wide",
      confirmLabel:"Cerrar",
      body:scannable.length?`<section class="v116-label-head"><div><span>CÓDIGOS PERMANENTES</span><strong>${esc(scannable[0].reference||"Material")}</strong><p>Cada lote tiene un QR con enlace al CRM y un código de barras compatible con el lector interno.</p></div><button type="button" class="btn btn-primary" data-v116-print-all>Imprimir todas</button></section><div class="v116-label-grid">${scannable.map(labelCardHtml).join("")}</div>`:empty("Sin lotes escaneables","Este material todavía no tiene lotes físicos activos.")
    });
    const section=view.root.querySelector(".v116-label-head")?.parentElement||view.root;
    section.setAttribute("data-v116-label-section","");section._v116LabelData=scannable.map(normalizeLotForLabel);
    renderInlineCodes(view.root);
  }catch(error){toast(error.message,"error",7500)}
}

function normalizeLotForLabel(lot){
  return {scanCode:lot.scanCode,reference:lot.reference,description:lot.description,unit:lot.unit,lotNumber:lot.lotNumber,location:lot.location,warehouseCode:lot.warehouseCode,locationName:lot.locationName,acceptedQuantity:lot.available};
}
function labelCardHtml(lot){
  const payload=encodeURIComponent(JSON.stringify(normalizeLotForLabel(lot)));
  return `<article class="v116-label-card" data-v116-code="${esc(lot.scanCode)}"><div><small>${esc(lot.reference)}</small><strong>${esc(lot.lotNumber||"Sin lote")}</strong><span>${esc([lot.warehouseCode,lot.location].filter(Boolean).join(" · ")||"Sin ubicación")}</span></div><div class="v116-code-preview"><svg data-v116-barcode></svg><img data-v116-qr alt="QR"></div><code>${esc(lot.scanCode)}</code><button type="button" class="btn btn-ghost" data-v116-print-lot="${payload}">Imprimir etiqueta</button></article>`;
}

async function enhanceReceiptDetail(){
  const root=document.querySelector("#modal-root");
  const hero=root?.querySelector(".v115-detail-hero");
  if(!hero||hero.dataset.v116Labels==="ready"||hero.dataset.v116Labels==="loading")return;
  const number=hero.querySelector("strong")?.textContent?.trim();
  if(!number||!/^\w+-\d{4}-\d+/i.test(number))return;
  hero.dataset.v116Labels="loading";
  try{
    const data=await rpc("erp_x_goods_receipt_labels",{p_receipt_number:number});
    const lines=(data.lines||[]).filter(line=>line.scanCode);
    if(!lines.length){hero.dataset.v116Labels="ready";return}
    const section=document.createElement("section");
    section.className="v116-receipt-labels";section.setAttribute("data-v116-label-section","");
    section._v116LabelData=lines.map(normalizeLotForLabel);
    section.innerHTML=`<header><div><span>ETIQUETAS GENERADAS AUTOMÁTICAMENTE</span><strong>QR + código de barras por lote ingresado</strong><p>El QR abre directamente este lote en Inventario desde la cámara del celular.</p></div><button type="button" class="btn btn-primary" data-v116-print-all>Imprimir todas</button></header><div class="v116-label-grid">${lines.map(labelCardHtml).join("")}</div>`;
    const detail=root.querySelector(".v115-detail-lines");
    (detail||hero).insertAdjacentElement("afterend",section);
    renderInlineCodes(section);
    hero.dataset.v116Labels="ready";
  }catch(error){hero.dataset.v116Labels="";console.warn("[CRM RECEIPT LABELS]",error)}
}

function renderInlineCodes(scope){
  scope.querySelectorAll("[data-v116-code]").forEach(card=>{
    const code=card.dataset.v116Code;
    const svg=card.querySelector("[data-v116-barcode]");
    const img=card.querySelector("[data-v116-qr]");
    try{window.JsBarcode?.(svg,code,{format:"CODE128",displayValue:false,height:38,margin:2,width:1.4})}catch{}
    try{if(window.qrcode){const qr=window.qrcode(0,"M");qr.addData(buildInventoryUrl(code));qr.make();img.src=qr.createDataURL(4,1)}}catch{}
  });
}

function printLotLabel(lot){printAllLabels([lot])}
function printAllLabels(lots){
  const rows=(lots||[]).filter(lot=>lot?.scanCode);
  if(!rows.length)return toast("No hay etiquetas disponibles para imprimir.","error");
  try{
    if(!window.JsBarcode||!window.qrcode)throw new Error("Los componentes de códigos aún no están disponibles.");
    const labels=rows.map(lot=>{
      const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
      window.JsBarcode(svg,lot.scanCode,{format:"CODE128",displayValue:true,height:50,margin:3,fontSize:12});
      const qr=window.qrcode(0,"M");qr.addData(buildInventoryUrl(lot.scanCode));qr.make();
      return `<section class="label"><div class="top"><div><small>CRM SUMINISTROS · INVENTARIO</small><h2>${esc(lot.reference||"")}</h2><strong>${esc(lot.description||"")}</strong></div><img src="${qr.createDataURL(5,1)}" alt="QR"></div><div class="meta"><span><small>Lote</small><b>${esc(lot.lotNumber||"—")}</b></span><span><small>Ubicación</small><b>${esc([lot.warehouseCode,lot.location,lot.locationName].filter(Boolean).join(" · ")||"—")}</b></span><span><small>Cantidad</small><b>${fmt.number(lot.acceptedQuantity??0,3)} ${esc(lot.unit||"")}</b></span></div><div class="barcode">${svg.outerHTML}</div><code>${esc(lot.scanCode)}</code></section>`;
    }).join("");
    const win=window.open("","_blank","width=980,height=760");
    if(!win)throw new Error("El navegador bloqueó la ventana de impresión.");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas de inventario</title><style>@page{size:auto;margin:5mm}body{font-family:Arial,sans-serif;margin:0;color:#111}.labels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5mm}.label{border:1.5px solid #111;border-radius:10px;padding:5mm;break-inside:avoid}.top{display:grid;grid-template-columns:1fr 35mm;gap:4mm;align-items:start}.top img{width:34mm;height:34mm}.top small,.meta small{display:block;color:#555;font-size:9px}.top h2{margin:2mm 0 1mm;font-size:19px}.top strong{font-size:12px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin:4mm 0}.meta span{border:1px solid #ddd;border-radius:6px;padding:2mm}.meta b{font-size:11px}.barcode svg{width:100%;max-height:22mm}code{display:block;text-align:center;font-size:10px;margin-top:1mm}@media print{.labels{gap:3mm}}</style></head><body><main class="labels">${labels}</main><script>window.addEventListener('load',()=>window.print(),{once:true});<\/script></body></html>`);
    win.document.close();
  }catch(error){toast(error.message,"error",7000)}
}
