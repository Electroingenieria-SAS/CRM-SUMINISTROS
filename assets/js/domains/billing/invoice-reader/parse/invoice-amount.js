import {extractNumbers} from './localized-values.js';

function hasPhysicalLabel(line){
  return /\b(?:cantidad(?:es)?|productos?|unidades?|peso|kgs?|kilogramos?|items?|l[ií]neas?|bultos?|paquetes?|quantity|weight)\b/i.test(line);
}

export function detectAmount(lines){
  const monetaryLabels=/\b(TOTAL\s+A\s+PAGAR|TOTAL\s+FACTURA|VALOR\s+TOTAL|TOTAL\s+NETO|TOTAL\s+GENERAL|IMPORTE\s+TOTAL)\b/i;
  const genericTotal=/^\s*TOTAL\b/i;
  for(let i=lines.length-1;i>=0;i--){
    if(hasPhysicalLabel(lines[i])||(!monetaryLabels.test(lines[i])&&!genericTotal.test(lines[i])))continue;
    const numbers=extractNumbers(lines[i]);
    if(numbers.length){const n=numbers.at(-1);if(n>0)return n;}
    const following=lines[i+1];
    if(following&&!hasPhysicalLabel(following)){
      const next=extractNumbers(following);
      if(next.length&&next.at(-1)>0)return next.at(-1);
    }
  }
  return null;
}
