import {extractNumbers} from './localized-values.js';

function isPhysicalTotal(line){
  return /^(?:(?:cantidad|peso|quantity|weight)\b.*\btotal\b|total\b.*\b(?:cantidad|peso|productos|unidades|bultos|paquetes|quantity|weight)\b)/i.test(line);
}

export function detectAmount(lines){
  const labels=/(TOTAL\s+A\s+PAGAR|TOTAL\s+FACTURA|VALOR\s+TOTAL|TOTAL\s+NETO|TOTAL)\b/i;
  for(let i=lines.length-1;i>=0;i--){
    if(!labels.test(lines[i])||isPhysicalTotal(lines[i]))continue;
    const numbers=extractNumbers(lines[i]);
    if(numbers.length){const n=numbers.at(-1);if(n>0)return n;}
    const following=lines[i+1];
    if(following&&!isPhysicalTotal(following)){
      const next=extractNumbers(following);
      if(next.length&&next.at(-1)>0)return next.at(-1);
    }
  }
  return null;
}
