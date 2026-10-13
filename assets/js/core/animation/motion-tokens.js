// Shared, intentionally conservative motion defaults.
export const durations=Object.freeze({feedback:.15,selection:.19,panel:.26,list:.23,price:.34});
export function reducedMotion(){
 return typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
export function currencyLabel(value){
 const n=Number(value);
 return Number.isFinite(n)?new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n):'—';
}
