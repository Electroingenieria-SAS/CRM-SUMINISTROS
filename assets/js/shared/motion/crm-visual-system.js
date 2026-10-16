// Progressive enhancements for every CRM screen; no React migration or global DOM rewrites.
import {animate as animeAnimate} from './vendor-anime.js';
// Page-level reveals only; button interactions are implemented in the shared CSS layer.
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
    // Other selection feedback belongs to the shared CSS motion component.
   });
  }
 });
 // Run only on actual opening of operational dialogs, not all DOM nodes.
 document.addEventListener('toggle',event=>{
  const item=event.target;
  if(!(item instanceof HTMLDetailsElement)||!item.open||prefersReduced())return;
  const content=[...item.children].filter(n=>n.tagName!=='SUMMARY');
  content.forEach(el=>el.animate([{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0px)'}],{duration:210,easing:'ease-out'}));
 },true);
}

export function animateCRMMetric(node){if(node&&!prefersReduced())try{animeAnimate(node,{opacity:[.6,1],y:[5,0],duration:380,ease:'outCubic'});}catch{}}
