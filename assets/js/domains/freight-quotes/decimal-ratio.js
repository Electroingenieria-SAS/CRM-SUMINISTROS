// Positive finite decimals as exact rational BigInts; monetary arithmetic never uses binary floats.
export function decimal(value){
 if(value===null||value===undefined||typeof value==='boolean')throw Error('Decimal requerido');
 const m=String(value).match(/^\+?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
 if(!m||String(value).length>60)throw Error('Decimal inválido');
 const exponent=Number(m[3]||0);if(Math.abs(exponent)>18)throw Error('Decimal fuera de rango');
 const scale=(m[2]||'').length-exponent;if(scale>18)throw Error('Precisión decimal excesiva');
 const n=BigInt(m[1]+(m[2]||''));return scale>=0?{n,d:10n**BigInt(scale)}:{n:n*10n**BigInt(-scale),d:1n};
}
export const multiply=(a,b)=>({n:a.n*b.n,d:a.d*b.d});
export const divide=(a,b)=>{if(b.n===0n)throw Error('Divisor cero');return {n:a.n*b.d,d:a.d*b.n};};
export const maximum=(a,b)=>a.n*b.d>=b.n*a.d?a:b;
export const ceil=a=>(a.n+a.d-1n)/a.d;
export const floor=a=>a.n/a.d;
export const halfUp=a=>(2n*a.n+a.d)/(2n*a.d);
export const displayDecimal=a=>Number(a.n)/Number(a.d);
