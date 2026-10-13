import {can} from '../../core/state.js';
import {navigate} from '../../core/router.js';
export function mountFreightQuoteOrderEntry(host,data){
 if(!can('freight_quotes')||!data.order?.id)return;
 const target=host.querySelector('.modal-head');if(!target||target.querySelector('[data-order-freight-quote]'))return;
 const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.orderFreightQuote='';button.textContent='Cotización de fletes';
 button.onclick=()=>{host.replaceChildren();navigate('freight_quotes',{orderId:data.order.id});};target.append(button);
}
export function quoteOrderMaterials(data){return (data.items||[]).map(i=>({materialMasterId:i.material_master_id||i.metadata?.materialMasterId,reference:i.sku||i.reference,name:i.description,description:i.description,unit:i.unit,quantity:Number(i.metadata?.totalRequested??i.quantity)||1,manual:!(i.material_master_id||i.metadata?.materialMasterId)}));}
export function exactDocumentDestination(rows,city){
 const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
 const matches=rows.filter(r=>key(r.name.replace(/\s*\([^)]*\)\s*$/,''))===key(city));
 return matches.length===1?matches[0].key:'';
}
