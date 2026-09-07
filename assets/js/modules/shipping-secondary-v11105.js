let observer=null;
let scheduled=false;

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    observer?.disconnect();
    enhanceAll();
    observe();
  });
}

function observe(){
  const root=document.querySelector('#modal-root');
  if(root&&observer)observer.observe(root,{childList:true,subtree:true});
}

function enhanceAll(){
  document.querySelectorAll('#modal-root .shipping-process-modal.shipping-workflow-v11102 .shipping-secondary-v11102').forEach(enhanceSecondary);
}

function enhanceSecondary(details){
  details.classList.add('shipping-secondary-organized-v11105');
  const body=details.querySelector(':scope > .shipping-secondary-body-v11102');
  if(!body)return;
  body.classList.add('shipping-secondary-layout-v11105');

  const info=ensureSection(body,'shipping-secondary-info-v11105','Destino y datos de entrega','Información registrada previamente para consultar durante el despacho.');
  const trace=ensureSection(body,'shipping-secondary-trace-v11105','Trazabilidad operativa','Registra únicamente una situación cuando realmente sea necesario.');
  const exception=ensureSection(body,'shipping-secondary-exception-v11105','Acciones excepcionales','Estas acciones modifican o detienen el flujo normal del pedido.');
  const detail=ensureSection(body,'shipping-secondary-detail-v11105','','');

  [...body.children].forEach(node=>{
    if(node.matches('.shipping-secondary-section-v11105'))return;
    routeNode(node,{info,trace,exception,detail});
  });

  // Algunos módulos pueden volver a insertar acciones después de la primera pasada.
  body.querySelectorAll(':scope > .shipping-secondary-actions-v11102').forEach(node=>exception.append(node));
  body.querySelectorAll(':scope > .order-support-zone').forEach(node=>trace.append(node));
  body.querySelectorAll(':scope > .shipping-sales-address,:scope > .shipping-overview-grid,:scope > .dispatch-recap').forEach(node=>info.append(node));
  body.querySelectorAll(':scope > .simple-details').forEach(node=>detail.append(node));

  syncSection(info);
  syncSection(trace);
  syncSection(exception);
  syncSection(detail);
}

function ensureSection(body,className,title,copy){
  let section=body.querySelector(`:scope > .${className}`);
  if(section)return section;
  section=document.createElement('section');
  section.className=`shipping-secondary-section-v11105 ${className}`;
  if(title){
    const head=document.createElement('header');
    head.className='shipping-secondary-section-head-v11105';
    head.innerHTML=`<div><span>${escapeHtml(title)}</span><small>${escapeHtml(copy)}</small></div>`;
    section.append(head);
  }
  body.append(section);
  return section;
}

function routeNode(node,sections){
  if(node.matches('.order-support-zone')){sections.trace.append(node);return}
  if(node.matches('.shipping-secondary-actions-v11102')||node.querySelector?.('[data-request-order-cancellation]')){sections.exception.append(node);return}
  if(node.matches('.simple-details')){sections.detail.append(node);return}
  if(node.matches('.shipping-sales-address,.shipping-overview-grid,.dispatch-recap')){sections.info.append(node);return}
  if(node.matches('.shipping-closure-callout,.shipping-system-action-v11102')){sections.exception.append(node);return}
  sections.info.append(node);
}

function syncSection(section){
  const content=[...section.children].filter(node=>!node.matches('.shipping-secondary-section-head-v11105'));
  section.hidden=content.length===0;
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[char]));
}

function install(){
  enhanceAll();
  const root=document.querySelector('#modal-root');
  if(!root)return;
  observer=new MutationObserver(schedule);
  observe();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
