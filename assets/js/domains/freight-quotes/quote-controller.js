import {quoteOrderMaterials,exactDocumentDestination} from "./quote-order-entry.js";
import {carrierAdapters,quoteCanSaveCalculated} from "./carrier-adapters.js";
import {api} from '../../services/api.js';
import {can} from '../../core/state.js';
import {quoteView,options,quoteResultHtml,quoteHistoryHtml} from './quote-view.js';
import {filterHistoryItems,historySummary,historyCsv} from './quote-history-view.js';
import {restoreMeasurements,measurementSummary} from './material-measurements.js';
import {addMaterial,readQuote} from './quote-lines.js';
import {createMotionKit} from '../../shared/motion/motion-kit.js';
import {createFreightDialogs} from './quote-dialogs.js';
import {setupFreightDestinationPicker} from './destination-picker.js';
import {animateCRMMetric} from '../../shared/motion/crm-visual-system.js';
export async function renderFreightQuotes(root,context={}){
 root.__freightController?.abort();
 root.__crmFreightMotion?.dispose?.();
 root.innerHTML=quoteView();
 const form=root.querySelector('[data-quote-form]'),message=root.querySelector('[data-quote-message]'),resultHost=root.querySelector('[data-quote-result]');
 const materialHost=form.querySelector('[data-quote-materials]');
 const controller=new AbortController();root.__freightController=controller;
 form.__freightSignal=controller.signal;
 const motion=createMotionKit(root);
 root.__crmFreightMotion=motion;
 void motion.enableMaterialMotion(materialHost);
 const save=form.querySelector('[data-save-quote]'),draft=form.querySelector('[data-save-draft]');
 let calculated=null,currentResult=null,revision=0,busy=false,page=1,history=[],visibleHistory=[],catalogCache=new Map(),destinationRequest=0,allDestinations=[];
 let totalHistory=0;
 const quoteWorkspace=root.querySelector('[data-quote-workspace]');
 const historyWorkspace=root.querySelector('[data-history-workspace]');
 const setWorkspace=target=>{
  const isHistory=target==='history';
  quoteWorkspace.hidden=isHistory;historyWorkspace.hidden=!isHistory;
  root.querySelectorAll('[data-view-tab]').forEach(button=>{
   const active=button.dataset.viewTab===target;
   button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
  });
 };
 root.querySelectorAll('[data-view-tab]').forEach(button=>button.addEventListener('click',()=>setWorkspace(button.dataset.viewTab)));
 const destinationPicker=setupFreightDestinationPicker(form);
 const localControls=root.querySelector('[data-local-controls]');
 const nationalControls=root.querySelectorAll('[data-national-route]');
 const syncRouteMode=()=>{
  const local=form.elements.carrier.value==='LOCAL';
  localControls.hidden=!local;
  nationalControls.forEach(field=>{field.hidden=local;});
  form.elements.department.disabled=local;
  form.elements.department.required=!local;
  const search=form.querySelector('[data-destination-search]');
  search.disabled=local||!form.elements.department.value;
  search.required=!local;
  form.elements.destinationKey.disabled=local||!form.elements.destinationKey.options.length||!form.elements.department.value;
  form.elements.localDestinationCode.disabled=!local;
  form.elements.localDestinationCode.required=local;
  ['localUnloadingCost','localDiversionCost','localExtraReason'].forEach(key=>form.elements[key].disabled=!local);
  form.elements.origin.disabled=local;
  if(local){form.elements.origin.value='TULUA';}
 };
 let lastNationalCarrier='TCC';
 const syncCarrier=()=>{
  const selected=form.elements.carrier.value;
  const scope=selected==='LOCAL'?'LOCAL':'NATIONAL';
  if(scope==='NATIONAL')lastNationalCarrier=selected;
  root.dataset.quoteScope=scope;
  root.querySelectorAll('[data-quote-scope]').forEach(button=>{
   button.setAttribute('aria-pressed',String(button.dataset.quoteScope===scope));
  });
  syncRouteMode();
  root.querySelectorAll('[data-carrier-choice]').forEach(button=>{
   const active=button.dataset.carrierChoice===selected;
   button.setAttribute('aria-pressed',String(active));
   const label=button.querySelector('small');if(label)label.textContent=active?'Seleccionada':'Elegir';
  });
 };
 root.querySelectorAll('[data-quote-scope]').forEach(button=>button.addEventListener('click',()=>{
  const next=button.dataset.quoteScope==='LOCAL'?'LOCAL':lastNationalCarrier;
  if(next===form.elements.carrier.value)return;
  form.elements.carrier.value=next;
  form.elements.carrier.dispatchEvent(new Event('change',{bubbles:true}));
  syncCarrier();
 }));
 root.querySelectorAll('[data-carrier-choice]').forEach(button=>button.addEventListener('click',()=>{
   if(form.elements.carrier.value===button.dataset.carrierChoice)return;
   form.elements.carrier.value=button.dataset.carrierChoice;
   form.elements.carrier.dispatchEvent(new Event('change',{bubbles:true}));
   syncCarrier();
 }));
 form.elements.carrier.addEventListener('change',syncCarrier);syncCarrier();
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const invalidate=()=>{revision++;calculated=null;currentResult=null;save.disabled=true;resultHost.innerHTML='';};
 const number=new Intl.NumberFormat('es-CO',{maximumFractionDigits:3});
 const syncSummary=()=>{
  const fields=[...materialHost.querySelectorAll('.freight-line')];
  root.querySelector('[data-material-count]').textContent=String(fields.length);
  try{
   const summary=measurementSummary(fields.map(row=>row.readMaterial()));
   root.querySelector('[data-material-weight]').textContent=number.format(summary.weightKg)+' kg';
   root.querySelector('[data-material-volume]').textContent=number.format(summary.volumeM3)+' m³';
   animateCRMMetric(root.querySelector('[data-material-weight]'));
   animateCRMMetric(root.querySelector('[data-material-volume]'));
  }catch{
   root.querySelector('[data-material-weight]').textContent='Revisar dato';
   root.querySelector('[data-material-volume]').textContent='Revisar dato';
  }
 };
 const replaceMaterials=items=>{
  motion.suspendMaterialMotion();
  materialHost.replaceChildren();
  items.forEach(item=>addMaterial(materialHost,item));
  motion.resumeMaterialMotion();
  syncSummary();
 };
 const onChange=event=>{if(event.target.matches('[data-destination-search]'))return;invalidate();syncSummary();};
 form.addEventListener('input',onChange);form.addEventListener('change',onChange,true);
 const notice=text=>{message.textContent=text;message.dataset.kind=/error|inválid|sin cálculo|completa|revisa/i.test(String(text))?'warning':'info';};
 // Re-query catalog/history only. Never replay save or link operations after a 503.
 const serviceBanner=root.querySelector('[data-freight-service-banner]');
 const serviceMessage=root.querySelector('[data-freight-service-message]');
 const transientError=error=>[503,504].includes(Number(error?.status))||
   /supabase está temporalmente ocupado|service unavailable|gateway timeout|pgrst003|503|504/i.test(String(error?.message||''));
 let lastSafeRetry=null;
 const showReadFailure=(error,retry)=>{
   notice(error.message||'No fue posible consultar los datos.');
   if(!transientError(error))return;
   lastSafeRetry=retry;
   serviceMessage.textContent='El servicio de consultas no respondió. Puedes reintentar sin duplicar cotizaciones ni modificar pedidos.';
   serviceBanner.hidden=false;
 };
 root.querySelector('[data-freight-retry]').onclick=async()=>{
   if(!lastSafeRetry)return;
   const button=root.querySelector('[data-freight-retry]');
   button.disabled=true;button.textContent='Consultando…';
   try{await lastSafeRetry();serviceBanner.hidden=true;lastSafeRetry=null;notice('Consulta restablecida.');}
   catch(error){showReadFailure(error,lastSafeRetry);}
   finally{button.disabled=false;button.textContent='Reintentar consulta';}
 };
 const run=async(action,{calculating=false}={})=>{
  if(busy)return;busy=true;const submit=form.querySelector('[type=submit]');
  submit.disabled=true;save.disabled=true;draft.disabled=true;form.setAttribute('aria-busy','true');
  if(calculating)submit.textContent='Calculando…';
  try{await action();}catch(error){notice(error.message);}finally{
   busy=false;form.removeAttribute('aria-busy');submit.textContent='Calcular';submit.disabled=false;
   save.disabled=!calculated||!can('freight_quotes','canCreate');draft.disabled=!can('freight_quotes','canCreate');
  }
 };
 function renderHistory(){
  const filters={
   search:root.querySelector('[data-history-search]').value,
   carrier:root.querySelector('[data-history-carrier]').value,
   status:root.querySelector('[data-history-status]').value,
   sort:root.querySelector('[data-history-sort]').value
  };
  const filtered=Object.values(filters).some(value=>value&&value!=='newest');
  visibleHistory=filterHistoryItems(history,filters);
  const summary=historySummary(visibleHistory);
  root.querySelector('[data-quote-history]').innerHTML=quoteHistoryHtml(visibleHistory,{filtered});
  root.querySelector('[data-history-count]').textContent=String(summary.count);
  root.querySelector('[data-history-priced]').textContent=String(summary.priced);
  root.querySelector('[data-history-actual]').textContent=String(summary.withActual);
  animateCRMMetric(root.querySelector('[data-history-count]'));
  root.querySelector('[data-history-visible-count]').textContent=summary.count+' visibles en esta página';
  root.querySelector('[data-history-export]').disabled=summary.count===0;
  root.querySelectorAll('[data-quote-link]').forEach(button=>button.disabled=!can('freight_quotes','canUpdate'));
 }
 for(const key of ['search','carrier','status','sort']){
  const input=root.querySelector('[data-history-'+key+']');
  input.addEventListener(key==='search'?'input':'change',renderHistory);
 }
 root.querySelector('[data-history-clear]').onclick=()=>{
  root.querySelector('[data-history-search]').value='';
  root.querySelector('[data-history-carrier]').value='';
  root.querySelector('[data-history-status]').value='';
  root.querySelector('[data-history-sort]').value='newest';renderHistory();
 };
 root.querySelector('[data-history-export]').onclick=()=>{
  if(!visibleHistory.length)return;
  const blob=new Blob([historyCsv(visibleHistory)],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download='historial-fletes-pagina-'+page+'.csv';
  document.body.append(anchor);anchor.click();anchor.remove();
  URL.revokeObjectURL(url);
 };
 async function destinations(department,key=''){
  const request=++destinationRequest;
  destinationPicker.reset(department?'Cargando municipios…':'Selecciona un departamento para comenzar.');
  allDestinations=[];
  if(!department)return [];
  if(!catalogCache.has(department))catalogCache.set(department,api.freightQuoteCatalog(department));
  let data;try{data=await catalogCache.get(department);}catch(error){catalogCache.delete(department);throw error;}
  if(request!==destinationRequest)return;
  allDestinations=data.destinations||[];
  destinationPicker.setDestinations(allDestinations,key);
  return allDestinations;
 }
 async function loadHistory(){
  const data=await api.freightQuoteList(page);history=data.items||[];totalHistory=data.total||0;
  root.querySelector('[data-history-tab-count]').textContent=String(totalHistory);
  renderHistory();
  root.querySelector('[data-history-page]').textContent=`Página ${page} · ${totalHistory} cotizaciones en total`;
  root.querySelector('[data-history-prev]').disabled=page<=1;
  root.querySelector('[data-history-next]').disabled=page*30>=totalHistory;
  root.querySelectorAll('[data-quote-link]').forEach(b=>b.disabled=!can('freight_quotes','canUpdate'));
 }
 form.elements.department.addEventListener('change',()=>destinations(form.elements.department.value).catch(e=>showReadFailure(e,()=>destinations(form.elements.department.value))));
 form.querySelector('[data-add-material]').onclick=()=>{addMaterial(materialHost);invalidate();syncSummary();};
 form.onsubmit=e=>{e.preventDefault();run(async()=>{
  if(!form.reportValidity())return;
  const payload=readQuote(form,{strict:true}),request=revision;notice('Calculando las opciones disponibles…');
  if(!carrierAdapters[payload.carrier])throw Error("Transportadora pendiente de contrato.");
  const result=await api.freightQuoteCalculate(payload);
  if(request!==revision)return;
  currentResult=result;
  resultHost.innerHTML=quoteResultHtml(result,{selectedCarrier:payload.carrier});
  void motion.revealResults(resultHost);
  void motion.highlightMoney(resultHost);
  const available=quoteCanSaveCalculated(result);
  calculated=available?{payload,result}:null;notice(available?(payload.carrier==='LOCAL'?'Flete local calculado con la matriz interna. Puedes guardarlo.':'Comparación lista. Puedes guardar la cotización.'):'No hay un flete respaldado por la información ingresada. Revisa el peso o guarda un borrador.');
  resultHost.scrollIntoView?.({behavior:'smooth',block:'start'});
 },{calculating:true});};
 save.onclick=()=>run(async()=>{
  if(!calculated)throw Error('Calcula nuevamente.');
  const q=await api.freightQuoteSave({...calculated.payload,status:'CALCULATED'});
  notice(`Cotización CF-${q.folio} guardada. No se modificó ningún pedido.`);await loadHistory();setWorkspace('history');
 });
 draft.onclick=()=>run(async()=>{const q=await api.freightQuoteSave({...readQuote(form),status:'DRAFT'});notice(`Borrador CF-${q.folio} guardado.`);await loadHistory();setWorkspace('history');});
  resultHost.addEventListener('click',event=>{
  const button=event.target.closest('[data-quote-select-carrier]');
  if(!button||!currentResult)return;
  const carrier=button.dataset.quoteSelectCarrier;
  const choice=(currentResult.comparison||[currentResult]).find(item=>item.carrier===carrier);
  if(!choice)return;
  const payload={...readQuote(form),carrier};
  form.elements.carrier.value=carrier;syncCarrier();
  const selected={...choice,comparison:currentResult.comparison};
  const available=quoteCanSaveCalculated(selected);
  calculated=available?{payload,result:selected}:null;
  save.disabled=!available||!can('freight_quotes','canCreate');
  resultHost.querySelectorAll('[data-quote-select-carrier]').forEach(node=>{
   const active=node.dataset.quoteSelectCarrier===carrier;
   node.setAttribute('aria-pressed',String(active));
   node.textContent=active?'Seleccionada':'Elegir '+(node.dataset.quoteSelectCarrier==='ENVIA'?'ENVÍA':node.dataset.quoteSelectCarrier==='LOCAL'?'LOCAL':'TCC');
   node.closest('[data-offer-carrier]')?.classList.toggle('freight-offer-selected',active);
  });
  notice(available?'Transportadora seleccionada. Puedes guardar esta cotización.':'Esta transportadora no tiene un precio suficiente. Puedes guardar un borrador.');
 });
 root.querySelector('[data-history-prev]').onclick=()=>{page--;loadHistory().catch(e=>notice(e.message));};
 root.querySelector('[data-history-next]').onclick=()=>{page++;loadHistory().catch(e=>notice(e.message));};
 const dialogs=createFreightDialogs(root,{
  canLink:()=>can('freight_quotes','canUpdate'),
  link:async(id,number)=>{await api.freightQuoteLink(id,number);await loadHistory();},
  duplicate:q=>{
   run(async()=>{
    invalidate();form.elements.carrier.value=q.input.carrier||'TCC';syncCarrier();form.elements.origin.value=q.input.carrier==='LOCAL'?'TULUA':q.input.origin;
    form.elements.department.value=q.input.department;form.elements.declaredValue.value=q.input.declaredValue??'';
    if(q.input.carrier!=='LOCAL')await destinations(q.input.department,q.input.destinationKey);
     form.elements.localDestinationCode.value=q.input.localDestinationCode||'';
     form.elements.localUnloadingCost.value=q.input.localUnloadingCost??0;
     form.elements.localDiversionCost.value=q.input.localDiversionCost??0;
     form.elements.localExtraReason.value=q.input.localExtraReason||'';
    replaceMaterials(restoreMeasurements(q.input));
    notice('Copia preparada. Calcula o guarda un borrador.');setWorkspace('quote');form.scrollIntoView({behavior:'smooth'});
   });
  },
  notice
 });
 root.querySelector('[data-quote-history]').onclick=e=>{
  const button=e.target.closest('button');if(!button)return;
  const q=history.find(q=>q.id===(button.dataset.quoteView||button.dataset.quoteDuplicate||button.dataset.quoteLink));if(!q)return;
  if(button.dataset.quoteView){dialogs.showDetails(q,button);return;}
  if(button.dataset.quoteLink){dialogs.showLink(q,button);return;}
  run(async()=>{
   invalidate();form.elements.carrier.value=q.input.carrier||'TCC';syncCarrier();form.elements.origin.value=q.input.carrier==='LOCAL'?'TULUA':q.input.origin;form.elements.department.value=q.input.department;form.elements.declaredValue.value=q.input.declaredValue??'';
   if(q.input.carrier!=='LOCAL')await destinations(q.input.department,q.input.destinationKey);
     form.elements.localDestinationCode.value=q.input.localDestinationCode||'';
     form.elements.localUnloadingCost.value=q.input.localUnloadingCost??0;
     form.elements.localDiversionCost.value=q.input.localDiversionCost??0;
     form.elements.localExtraReason.value=q.input.localExtraReason||'';
   replaceMaterials(restoreMeasurements(q.input));
   notice('Copia preparada. Calcula o guarda un nuevo borrador.');setWorkspace('quote');form.scrollIntoView({behavior:'smooth'});
  });
 };
 addMaterial(materialHost);syncSummary();draft.disabled=!can('freight_quotes','canCreate');
 try{
  const data=await api.freightQuoteCatalog();
  form.elements.origin.innerHTML=options(data.origins||[]);form.elements.origin.value=data.modelOrigin||'';
  form.elements.department.innerHTML=options(data.departments||[]);syncRouteMode();await loadHistory();
  if(context.params?.orderId){
   const orderData=await api.getOrder(context.params.orderId),order=orderData.order;
   replaceMaterials(quoteOrderMaterials(orderData));
   const dept=order.metadata?.clientDepartment||'';syncSummary();
   form.elements.department.value=dept;
   if(form.elements.department.value){const rows=await destinations(dept);form.elements.destinationKey.value=exactDocumentDestination(rows,order.client_city);destinationPicker.sync();}
   notice(`Materiales precargados del pedido ${order.order_number}. Confirma destino y las medidas de los materiales. Guardar no vincula ni modifica el pedido.`);
  }
 }catch(error){
   showReadFailure(error,async()=>{
     const data=await api.freightQuoteCatalog();
     form.elements.origin.innerHTML=options(data.origins||[]);
     form.elements.origin.value=data.modelOrigin||'';
     form.elements.department.innerHTML=options(data.departments||[]);
     await loadHistory();
   });
 }
}
