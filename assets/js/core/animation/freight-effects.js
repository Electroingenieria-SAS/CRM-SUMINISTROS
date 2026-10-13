import {durations,reducedMotion} from './motion-tokens.js';
import {animationVendor} from './ui-motion.js';
const tooltips=Object.freeze({
 estimate:'Valor aproximado calculado con la información disponible. La transportadora confirma el cobro final.',
 source:'Referencia utilizada por el cotizador. No equivale necesariamente a una tarifa contractual vigente.',
 volume:'La transportadora puede considerar peso real o equivalencia volumétrica según su modalidad.'
});

export async function mountFreightEffects(root){
 const surface=root.querySelector('.freight-quotes');
 if(!surface)return {results(){},history(){},tab(){},destroy(){}};
 let lib;
 try{lib=await animationVendor();}catch(error){console.warn('Animaciones opcionales no disponibles',error);return {results(){},history(){},tab(){},destroy(){}};}
 if(!surface.isConnected)return {results(){},history(){},tab(){},destroy(){}};
 const controllers=[],animations=new Set(),abort=new AbortController();
 const run=(element,frames,duration)=>{
  if(!element||reducedMotion()||!element.isConnected)return;
  const a=lib.animate(element,frames,{duration,easing:'ease-out'});
  animations.add(a);Promise.resolve(a.finished).catch(()=>{}).finally(()=>animations.delete(a));
 };
 const materialHost=surface.querySelector('[data-quote-materials]');
 if(materialHost&&!reducedMotion())controllers.push(lib.autoAnimate(materialHost,{duration:durations.list*1000,easing:'ease-in-out'}));
 const historyHost=surface.querySelector('[data-quote-history]');
 // Animate the immediate table/empty state, not all 30 rows on every search.
 if(historyHost&&!reducedMotion())controllers.push(lib.autoAnimate(historyHost,{duration:durations.list*1000,easing:'ease-in-out'}));
 let tip=null,closePosition=null,anchor=null;
 const hideTip=()=>{closePosition?.();closePosition=null;tip?.remove();tip=null;anchor=null;};
 const showTip=node=>{
  if(!node||reducedMotion()&&node===anchor)return;
  const message=tooltips[node.dataset.freightTip];if(!message)return;
  if(node===anchor)return;
  hideTip();anchor=node;
  tip=document.createElement('div');tip.className='freight-float-tip';tip.setAttribute('role','tooltip');tip.textContent=message;surface.append(tip);
  const update=()=>lib.computePosition(node,tip,{strategy:'fixed',placement:'top',
   middleware:[lib.offset(9),lib.flip(),lib.shift({padding:9})]}).then(({x,y})=>{
    if(tip&&node===anchor){tip.style.left=x+'px';tip.style.top=y+'px';}
   });
  closePosition=lib.autoUpdate(node,tip,update);
 };
 surface.addEventListener('pointerover',e=>{const n=e.target.closest?.('[data-freight-tip]');if(n)showTip(n);},{signal:abort.signal});
 surface.addEventListener('pointerout',e=>{if(anchor&&!anchor.contains(e.relatedTarget))hideTip();},{signal:abort.signal});
 surface.addEventListener('focusin',e=>{const n=e.target.closest?.('[data-freight-tip]');if(n)showTip(n);},{signal:abort.signal});
 surface.addEventListener('focusout',e=>{if(anchor&&!anchor.contains(e.relatedTarget))hideTip();},{signal:abort.signal});
 surface.addEventListener('click',e=>{const n=e.target.closest?.('[data-freight-tip]');if(n)showTip(n);else hideTip();},{signal:abort.signal});
 surface.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();},{signal:abort.signal});
 let stopped=false;
 const destroy=()=>{
  if(stopped)return;stopped=true;hideTip();abort.abort();observer.disconnect();
  controllers.forEach(c=>c?.disable?.());animations.forEach(a=>a?.stop?.());animations.clear();
 };
 const observer=new MutationObserver(()=>{if(!surface.isConnected)destroy();});
 observer.observe(root,{childList:true});
 return {
  results(){
   const cards=[...surface.querySelectorAll('[data-offer-carrier]')];
   cards.forEach((card,i)=>{
    run(card,{opacity:[0,1],transform:['translateY(9px)','translateY(0px)']},durations.panel+i*.04);
    card.querySelectorAll('[data-freight-money]').forEach(node=>run(node,{opacity:[.4,1],transform:['translateY(5px)','translateY(0px)']},durations.price));
   });
  },
  history(){run(surface.querySelector('[data-history-workspace] .freight-history-heading'),{opacity:[.5,1]},durations.selection);},
  tab(target){
   const panel=surface.querySelector(target==='history'?'[data-history-workspace]':'[data-quote-workspace]');
   run(panel,{opacity:[.65,1]},durations.selection);
  },
  destroy
 };
}
