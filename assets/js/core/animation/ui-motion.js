import {reducedMotion,durations} from './motion-tokens.js';
let vendorPromise;
export function animationVendor(){
 return vendorPromise??=import('../../vendor/ui-animations.js');
}
export async function revealElement(element,{duration=durations.panel,y=8}={}){
 if(!element?.isConnected||reducedMotion())return null;
 const {animate}=await animationVendor();
 if(!element.isConnected)return null;
 return animate(element,{opacity:[.45,1],transform:['translateY('+y+'px)','translateY(0px)']},{duration,easing:'ease-out'});
}
export async function enhanceList(container,{duration=durations.list}={}){
 if(!container?.isConnected||reducedMotion())return {disable(){}};
 const {autoAnimate}=await animationVendor();
 if(!container.isConnected)return {disable(){}};
 return autoAnimate(container,{duration:duration*1000,easing:'ease-in-out'});
}
