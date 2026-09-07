/* CRM Suministros V11.10.6 · navegación robusta de Despachos */
import {navigate} from "../core/router.js";
import {toast} from "../core/ui.js";
import {moduleForStep} from "./active-work.js";

let observer=null;
let scheduled=false;

const NEXT_SELECTOR='[data-shipping-next-v11102],[data-shipping-next],.shipping-next-v11101';
const TAKE_ANOTHER_SELECTOR='[data-take-another]';

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
  if(next){
    const target=resolveTarget(modal);
    const blocked=modal.classList.contains('order-blocked-by-issue');
    const enabled=Boolean(target&&!blocked);

    if(next.disabled===enabled)next.disabled=!enabled;
    const aria=enabled?'false':'true';
    if(next.getAttribute('aria-disabled')!==aria)next.setAttribute('aria-disabled',aria);
    const title=enabled?'Continuar con el paso actual':'Completa o resuelve la condición pendiente antes de continuar';
    if(next.title!==title)next.title=title;
    next.dataset.shippingNextGuardV11106='1';
  }

  const takeAnother=modal.querySelector(TAKE_ANOTHER_SELECTOR);
  if(takeAnother){
    takeAnother.disabled=false;
    takeAnother.setAttribute('aria-disabled','false');
    takeAnother.dataset.shippingTakeAnotherGuardV11106='1';
  }
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

function handleNext(event,button,modal){
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

  // Conserva la lógica de negocio original de shipping-flow.js.
  target.click();

  setTimeout(()=>{
    if(!button.isConnected)return;
    button.classList.remove('crm-busy-button-v11100');
    syncModal(modal);
  },650);
}

function handleTakeAnother(event,button,modal){
  event.preventDefault();
  event.stopImmediatePropagation();

  const step=button.dataset.takeAnother||modal.dataset.shippingRouteV11102||'';
  document.querySelector('#modal-root')?.replaceChildren();
  navigate(moduleForStep(step),{step,assignment:'ALL'});
  toast('El pedido anterior continúa en Mis pedidos activos. Puedes tomar otro sin perder el avance.','success',6000);
}

function onClick(event){
  const next=event.target?.closest?.(NEXT_SELECTOR);
  if(next){
    const modal=isShippingModal(next);
    if(modal)handleNext(event,next,modal);
    return;
  }

  const takeAnother=event.target?.closest?.(TAKE_ANOTHER_SELECTOR);
  if(takeAnother){
    const modal=isShippingModal(takeAnother);
    if(modal)handleTakeAnother(event,takeAnother,modal);
  }
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
