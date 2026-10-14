// Canonical duration / accessibility preferences for CRM microinteractions.
export const motionTokens=Object.freeze({
 hover:130,button:170,tab:210,card:240,drawer:260,list:260,number:350
});
export const shouldReduceMotion=()=>typeof matchMedia==='function'
 &&matchMedia('(prefers-reduced-motion: reduce)').matches;
