import {quoteOrderMaterials,exactDocumentDestination} from "./quote-order-entry.js";
import {carrierAdapters} from "./tcc-reference.js";
import {api} from '../../services/api.js';
import {can} from '../../core/state.js';
import {quoteView,options,quoteResultHtml,quoteHistoryHtml} from './quote-view.js';
import {addMaterial,addPackage,readQuote} from './quote-lines.js';
export async function renderFreightQuotes(root,context={}){
 root.innerHTML=quoteView();
 const form=root.querySelector('[data-quote-form]'),message=root.querySelector('[data-quote-message]'),resultHost=root.querySelector('[data-quote-result]');
 const materialHost=form.querySelector('[data-quote-materials]'),packageHost=form.querySelector('[data-quote-packages]');
 const save=form.querySelector('[data-save-quote]'),draft=form.querySelector('[data-save-draft]');
 let calculated=null,revision=0,busy=false,page=1,history=[];
 const invalidate=()=>{revision++;calculated=null;save.disabled=true;resultHost.innerHTML='';};
 form.addEventListener('input',invalidate);form.addEventListener('change',invalidate,true);
 const notice=text=>{message.textContent=text;};
 const run=async action=>{if(busy)return;busy=true;form.querySelector('[type=submit]').disabled=true;save.disabled=true;draft.disabled=true;try{await action();}catch(error){notice(error.message);}finally{busy=false;form.querySelector('[type=submit]').disabled=false;save.disabled=!calculated||!can('freight_quotes','canCreate');draft.disabled=!can('freight_quotes','canCreate');}};
 async function destinations(department,key=''){
  const request=revision;
  form.elements.destinationKey.disabled=true;
  const data=await api.freightQuoteCatalog(department);
  if(request!==revision)return;
  form.elements.destinationKey.innerHTML=options(data.destinations,r=>`${r.name} · C.O ${r.center}`,r=>r.key);
  form.elements.destinationKey.disabled=false;form.elements.destinationKey.value=key;
  return data.destinations;
 }
 async function loadHistory(){
  const data=await api.freightQuoteList(page);history=data.items||[];
  root.querySelector('[data-quote-history]').innerHTML=quoteHistoryHtml(history);
  root.querySelector('[data-history-page]').textContent=`Página ${page} · ${data.total} cotizaciones`;
  root.querySelector('[data-history-prev]').disabled=page<=1;
  root.querySelector('[data-history-next]').disabled=page*30>=data.total;
  root.querySelectorAll('[data-quote-link]').forEach(b=>b.disabled=!can('freight_quotes','canUpdate'));
 }
 form.elements.department.addEventListener('change',()=>destinations(form.elements.department.value).catch(e=>notice(e.message)));
 form.querySelector('[data-add-material]').onclick=()=>{addMaterial(materialHost);invalidate();};
 form.querySelector('[data-add-manual]').onclick=()=>{addMaterial(materialHost,{},true);invalidate();};
 form.querySelector('[data-add-package]').onclick=()=>{addPackage(packageHost);invalidate();};
 form.onsubmit=e=>{e.preventDefault();run(async()=>{
  const payload=readQuote(form,{strict:true}),request=revision;
  if(!carrierAdapters[payload.carrier])throw Error("Transportadora pendiente de contrato.");
  const result=await api.freightQuoteCalculate(payload);
  if(request!==revision)return;
  resultHost.innerHTML=quoteResultHtml(result);
  const available=result.reference.status==='HISTORICAL_REFERENCE'||result.prediction?.available;
  calculated=available?{payload,result}:null;notice(available?'Cálculo disponible. Puedes guardar la cotización.':'Sin cálculo disponible. Puedes guardar un borrador.');
 });};
 save.onclick=()=>run(async()=>{
  if(!calculated)throw Error('Calcula nuevamente.');
  const q=await api.freightQuoteSave({...calculated.payload,status:'CALCULATED'});
  notice(`Cotización CF-${q.folio} guardada. No se modificó ningún pedido.`);await loadHistory();
 });
 draft.onclick=()=>run(async()=>{const q=await api.freightQuoteSave({...readQuote(form),status:'DRAFT'});notice(`Borrador CF-${q.folio} guardado.`);await loadHistory();});
 root.querySelector('[data-history-prev]').onclick=()=>{page--;loadHistory().catch(e=>notice(e.message));};
 root.querySelector('[data-history-next]').onclick=()=>{page++;loadHistory().catch(e=>notice(e.message));};
 root.querySelector('[data-quote-history]').onclick=e=>{
  const button=e.target.closest('button');if(!button)return;
  const q=history.find(q=>q.id===(button.dataset.quoteView||button.dataset.quoteDuplicate||button.dataset.quoteLink));if(!q)return;
  if(button.dataset.quoteView){resultHost.innerHTML=quoteResultHtml(q.snapshot);resultHost.scrollIntoView({behavior:'smooth'});return;}
  if(button.dataset.quoteLink){const number=window.prompt('Número exacto del pedido a vincular');if(number)run(async()=>{await api.freightQuoteLink(q.id,number);await loadHistory();notice('Vínculo guardado. El pedido conserva sus datos.');});return;}
  run(async()=>{
   invalidate();form.elements.origin.value=q.input.origin;form.elements.department.value=q.input.department;form.elements.declaredValue.value=q.input.declaredValue??'';
   await destinations(q.input.department,q.input.destinationKey);
   materialHost.innerHTML='';packageHost.innerHTML='';
   q.input.materials.forEach(m=>addMaterial(materialHost,m,!!m.manual));q.input.packages.forEach(p=>addPackage(packageHost,p));
   notice('Copia preparada. Calcula o guarda un nuevo borrador.');form.scrollIntoView({behavior:'smooth'});
  });
 };
 addMaterial(materialHost);addPackage(packageHost);draft.disabled=!can('freight_quotes','canCreate');
 try{
  const data=await api.freightQuoteCatalog();
  form.elements.origin.innerHTML=options(data.origins||[]);form.elements.origin.value=data.modelOrigin||'';
  form.elements.department.innerHTML=options(data.departments||[]);await loadHistory();
  if(context.params?.orderId){
   const orderData=await api.getOrder(context.params.orderId),order=orderData.order;
   materialHost.innerHTML='';quoteOrderMaterials(orderData).forEach(m=>addMaterial(materialHost,m,!!m.manual));
   const dept=order.metadata?.clientDepartment||'';
   form.elements.department.value=dept;
   if(form.elements.department.value){const rows=await destinations(dept);form.elements.destinationKey.value=exactDocumentDestination(rows,order.client_city);}
   notice(`Materiales precargados del pedido ${order.order_number}. Confirma destino y bultos. Guardar no vincula ni modifica el pedido.`);
  }
 }catch(error){notice(error.message);}
}
