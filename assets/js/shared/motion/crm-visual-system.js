// Progressive enhancements for every CRM screen; no React migration or global DOM rewrites.
import {animate as animeAnimate} from './vendor-anime.js';
// Visual patterns correspond to Ripple, Liquid, Shine, Fade, Tabs and Copy interactions.
const prefersReduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
let installed=false;
export function installCRMVisualSystem(){
 if(installed||typeof document==='undefined')return;
 installed=true;
 const reveal=element=>{
  if(!element||prefersReduced())return;
  try{animeAnimate(element,{opacity:[.72,1],y:[7,0],duration:320,ease:'outCubic'});}
  catch(error){console.warn('Anime.js reveal unavailable',error);}
 };
 document.addEventListener('click',event=>{
  const tab=event.target.closest?.('[data-view-tab],[data-carrier-choice],[role=tab]');
  if(tab){
   requestAnimationFrame(()=>{
    if(tab.dataset.viewTab==='quote')reveal(document.querySelector('[data-quote-workspace]'));
    else if(tab.dataset.viewTab==='history')reveal(document.querySelector('[data-history-workspace]'));
    else reveal(tab);
   });
  }
 });
 document.addEventListener('pointerdown',event=>{
  const button=event.target.closest?.('button.btn, .btn-primary, [data-ui-ripple]');
  if(!button||button.disabled||prefersReduced()||event.button!==0)return;
  const rect=button.getBoundingClientRect();
  if(rect.width<12||rect.height<12)return;
  const ripple=document.createElement('span');
  ripple.className='crm-ui-ripple';
  ripple.style.left=event.clientX-rect.left+'px';
  ripple.style.top=event.clientY-rect.top+'px';
  const size=Math.max(rect.width,rect.height)*2.5;
  ripple.style.width=size+'px';ripple.style.height=size+'px';
  button.append(ripple);
  const animation=ripple.animate([{opacity:.28,transform:'translate(-50%,-50%) scale(.05)'},{opacity:0,transform:'translate(-50%,-50%) scale(1)'}],{duration:470,easing:'cubic-bezier(.2,.8,.2,1)'});
  animation.finished.catch(()=>{}).finally(()=>ripple.remove());
 },{passive:true});
 // Run only on actual opening of operational dialogs, not all DOM nodes.
 document.addEventListener('toggle',event=>{
  const item=event.target;
  if(!(item instanceof HTMLDetailsElement)||!item.open||prefersReduced())return;
  const content=[...item.children].filter(n=>n.tagName!=='SUMMARY');
  content.forEach(el=>el.animate([{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0px)'}],{duration:210,easing:'ease-out'}));
 },true);
}

export function animateCRMMetric(node){if(node&&!prefersReduced())try{animeAnimate(node,{opacity:[.6,1],y:[5,0],duration:380,ease:'outCubic'});}catch{}}
