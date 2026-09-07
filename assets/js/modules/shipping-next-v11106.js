/* CRM Suministros V11.10.6 · navegación robusta de Despachos
   Usa delegación sobre #modal-root para que Siguiente siga funcionando aunque
   otras capas reorganicen o reemplacen nodos del footer. */

let observer=null;
let scheduled=false;

const NEXT_SELECTOR='[data-shipping-next-v11102],[data-shipping-next],.shipping-next-v11101';

function isShippingModal(node){
  return node?.closest?.('.shipping-process-modal.shipping-workflow-v11102')||null;
}

function resolveTarget(modal){
  const take=modal.querySelector('[data-take-shipping]:not(:disabled)');
  if(take)return take;

  const closure=modal.querySelector('[data-attach-closure-photo]:not(:disabled)');
  if(closure)return closure;

  const guideCard=modal.querySelector('.shipping-step-card,.shipping-guide-task-v11101');
  const guideReady=Boolean(guideCard?.classList.contains('completed'));

  if(guideReady){
    const sendClosure=modal.querySelector('[data-send-closure]:not(:disabled)');
    if(sendClosure)return sendClosure;
    const editGuide=modal.querySelector('[data-add-guide]:not(:disabled)');
    if(editGuide)return editGuide;
  }else{
    const addGuide=modal.querySelector('[data-add-guide]:not(:disabled)');
    if(addGuide)return addGuide;
  }

  return modal.querySelector('[data-send-closure]:not(:disabled),[data-add-guide]:not(:disabled),[data-attach-closure-photo]:not(:disabled)');
}

function syncModal(modal){
  const next=modal.querySelector(NEXT_SELECTOR);
  if(!next)return;

  const target=resolveTarget(modal);
  const blocked=modal.classList.contains('order-blocked-by-issue');
  const enabled=Boolean(target&&!blocked);

  if(next.disabled===enabled)next.disabled=!enabled;
  const aria=enabled?'false':'true';
  if(next.getAttribute('aria-disabled')!==aria)next.setAttribute('aria-disabled',aria);
  next.title=enabled?'Continuar con el paso actual':'Completa o resuelve la condición pendiente antes de continuar';
  next.dataset.shippingNextGuardV11106='1';
}

function syncAll(){
  document.querySelectorAll('#modal-root .shipping-process-modal.shipping-workflow-v11102').forEach(syncModal);
}

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    observer?.disconnect();
    syncAll();
    observe();
  });
}

function observe(){
  const root=document.querySelector('#modal-root');
  if(root&&observer)observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
}

function highlightTask(modal){
  const focus=modal.querySelector('.shipping-primary-task-v11102,.shipping-take-card,.shipping-guide-task-v11101,.shipping-photo-only');
  if(!focus)return;
  focus.scrollIntoView({behavior:'smooth',block:'center'});
  focus.classList.remove('shipping-next-highlight-v11102');
  void focus.offsetWidth;
  focus.classList.add('shipping-next-highlight-v11102');
  setTimeout(()=>focus.classList.remove('shipping-next-highlight-v11102'),850);
}

function onClick(event){
  const button=event.target?.closest?.(NEXT_SELECTOR);
  if(!button)return;
  const modal=isShippingModal(button);
  if(!modal)return;

  // Interceptamos antes de listeners ligados a nodos que pudieron ser clonados.
  event.preventDefault();
  event.stopImmediatePropagation();

  if(button.disabled||button.getAttribute('aria-disabled')==='true'){
    highlightTask(modal);
    return;
  }

  const target=resolveTarget(modal);
  if(!target){
    syncModal(modal);
    highlightTask(modal);
    return;
  }

  button.disabled=true;
  button.setAttribute('aria-disabled','true');
  button.classList.add('crm-busy-button-v11100');

  // El botón real conserva la lógica de negocio original de shipping-flow.js.
  target.click();

  // Si el flujo no rerenderiza inmediatamente (por ejemplo, abre un subpopup),
  // devolvemos el control al botón Siguiente sin interferir con la operación.
  setTimeout(()=>{
    if(!button.isConnected)return;
    button.classList.remove('crm-busy-button-v11100');
    syncModal(modal);
  },500);
}

function install(){
  const root=document.querySelector('#modal-root');
  if(!root)return;
  root.addEventListener('click',onClick,true);
  observer=new MutationObserver(schedule);
  syncAll();
  observe();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
