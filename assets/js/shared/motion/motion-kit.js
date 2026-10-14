import {motionTokens,shouldReduceMotion} from './motion-tokens.js';
import {animate} from './vendor-motion.js';
import {autoAnimate} from './vendor-auto-animate.js';
import {computePosition,offset,flip,shift,autoUpdate} from './vendor-floating-ui.js';
export {motionTokens,shouldReduceMotion};
export function createMotionKit(root){
 let disposed=false,activeAnimations=[],listController=null,tooltip=null,stopPosition=null;
 const events=new AbortController();
 const active=()=>!disposed&&root.isConnected;
 const clearAnimations=()=>{for(const item of activeAnimations){item.stop?.();item.cancel?.();}activeAnimations=[];};
 async function enableMaterialMotion(host){
  if(shouldReduceMotion()||!active()||!host)return;
  try{
   if(!active()||!host.isConnected)return;
   listController=autoAnimate(host,{duration:motionTokens.list,easing:'ease-in-out'});
  }catch(error){console.warn('Material animation unavailable',error);}
 }
 async function revealResults(host){
  clearAnimations();
  if(!active()||shouldReduceMotion())return;
  const nodes=[...host.querySelectorAll('[data-offer-carrier]')];
  if(!nodes.length)return;
  try{
   if(!active())return;
   nodes.forEach((node,index)=>{
    const animation=animate(node,{opacity:[0,1],transform:['translateY(12px)','translateY(0px)']},
      {duration:motionTokens.card/1000,ease:'ease-out',delay:index*.045});
    activeAnimations.push(animation);
   });
  }catch(error){console.warn('Card animation unavailable',error);}
 }
 async function highlightMoney(host){
  if(!active()||shouldReduceMotion())return;
  try{
   const {animate}=await import('./vendor-motion.js');
   if(!active())return;
   const el=host.querySelector('.freight-price-hero>strong');
   if(!el)return;
   // The final COP amount remains in the DOM; only its visible reveal moves.
   activeAnimations.push(animate(el,{opacity:[.45,1],transform:['translateY(5px)','translateY(0px)']},
    {duration:motionTokens.number/1000,ease:'easeOut'}));
  }catch(error){console.warn('Price reveal unavailable',error);}
 }
 function hideTooltip(){
  stopPosition?.();stopPosition=null;
  tooltip?.remove();tooltip=null;
 }
 async function showTooltip(button){
  if(!active()||!button.isConnected)return;
  hideTooltip();
  const help=button.getAttribute('data-freight-help');
  if(!help)return;
  tooltip=document.createElement('div');
  tooltip.className='crm-motion-tooltip';tooltip.setAttribute('role','tooltip');
  tooltip.textContent=help;root.append(tooltip);
  button.setAttribute('aria-describedby','freight-motion-tooltip');
  tooltip.id='freight-motion-tooltip';
  try{
   if(!active()||!tooltip?.isConnected)return hideTooltip();
   const positioned=()=>computePosition(button,tooltip,{placement:'top',strategy:'fixed',middleware:[offset(9),flip(),shift({padding:12})]})
    .then(({x,y})=>{if(tooltip?.isConnected){tooltip.style.left=x+'px';tooltip.style.top=y+'px';}});
   tooltip.style.position='fixed';
   stopPosition=autoUpdate(button,tooltip,positioned,{ancestorScroll:true,ancestorResize:true,elementResize:false,layoutShift:false});
  }catch(error){hideTooltip();button.title=help;console.warn('Tooltip positioning unavailable',error);}
 }
 function wireHelp(){
  root.addEventListener('pointerover',e=>{const button=e.target.closest?.('[data-freight-help]');if(button&&e.pointerType!=='touch')void showTooltip(button);},{signal:events.signal});
  root.addEventListener('pointerout',e=>{if(e.target.closest?.('[data-freight-help]'))hideTooltip();}, {signal:events.signal});
  root.addEventListener('focusin',e=>{const button=e.target.closest?.('[data-freight-help]');if(button)void showTooltip(button);}, {signal:events.signal});
  root.addEventListener('focusout',e=>{if(e.target.closest?.('[data-freight-help]'))hideTooltip();}, {signal:events.signal});
  root.addEventListener('click',e=>{const button=e.target.closest?.('[data-freight-help]');if(button&&e.detail!==0){e.preventDefault();tooltip?hideTooltip():void showTooltip(button);}}, {signal:events.signal});
  root.addEventListener('keydown',e=>{if(e.key==='Escape')hideTooltip();}, {signal:events.signal});
 }
 function suspendMaterialMotion(){listController?.disable?.();}
 function resumeMaterialMotion(){queueMicrotask(()=>{if(active())listController?.enable?.();});}
 function dispose(){disposed=true;events.abort();clearAnimations();hideTooltip();listController?.disable?.();}
 wireHelp();
 return {enableMaterialMotion,suspendMaterialMotion,resumeMaterialMotion,revealResults,highlightMoney,hideTooltip,dispose};
}
