import { hasCutHistory } from "../shared/picking-status.js";

export function pickingProgress(data,stage){
  const hasCuts=hasCutHistory(data);
  if(!hasCuts)return `<section class="picking-progress-strip"><div class="done"><span>1</span><strong>Pedido tomado</strong></div><div class="${stage==="VERIFY"?"active":""}"><span>2</span><strong>Verificación de mercancía</strong></div><div><span>3</span><strong>Enviar a facturación</strong></div></section>`;
  return `<section class="picking-progress-strip four-steps"><div class="done"><span>1</span><strong>Pedido tomado</strong></div><div class="${stage==="PICKUP"?"active":"done"}"><span>2</span><strong>Recoger cortes</strong></div><div class="${stage==="VERIFY"?"active":""}"><span>3</span><strong>Verificar mercancía</strong></div><div><span>4</span><strong>Enviar a facturación</strong></div></section>`;
}
