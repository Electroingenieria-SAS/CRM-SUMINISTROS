import { positiveNumber, trimNumber } from "../parse/localized-values.js";

export function bindManualTracking(modal){
  modal.querySelectorAll(".invoice-reader-field-v1199 input").forEach(input=>{
    input.addEventListener("input",()=>{
      input.dataset.manual="1";
      const hint=modal.querySelector(`[data-field-source="${input.name}"]`);
      if(hint){hint.textContent="Editado manualmente";hint.classList.add("manual")}
      if(input.name==="invoiceWeightV1199")refreshWeightState(modal);
    });
  });
}

export function seedFallbacks(modal,file){
  const number=modal.querySelector('[name="invoiceNumberV1199"]');
  const name=modal.querySelector('[name="invoiceNameV1199"]');
  if(number&&!number.value)number.value=file.name.replace(/\.[^.]+$/u,"").trim();
  if(name&&!name.value)name.value=file.name.replace(/\.[^.]+$/u,"").trim();
}

export function applyParsed(modal,parsed,file){
  setAuto(modal,"invoiceNumberV1199",parsed.invoiceNumber||file.name.replace(/\.[^.]+$/u,""));
  setAuto(modal,"invoiceNameV1199",parsed.issuer||file.name.replace(/\.[^.]+$/u,""));
  setAuto(modal,"invoiceDateV1199",parsed.invoiceDate||new Date().toISOString().slice(0,10));
  setAuto(modal,"invoiceAmountV1199",parsed.amount>0?trimNumber(parsed.amount):"");
  setAuto(modal,"invoiceQuantityV1199",parsed.packageQuantity>0?trimNumber(parsed.packageQuantity):"");
  setAuto(modal,"invoiceWeightV1199",parsed.packageWeightKg>0?trimNumber(parsed.packageWeightKg):"");
  const lines=modal.querySelector('[name="invoiceLinesV1199"]');
  if(lines)lines.value=parsed.productLineCount>0?String(parsed.productLineCount):"";
  refreshWeightState(modal);
}

export function setAuto(modal,name,val){
  const input=modal.querySelector(`[name="${name}"]`);
  if(!input||input.dataset.manual==="1")return;
  input.value=val??"";
  const hint=modal.querySelector(`[data-field-source="${name}"]`);
  if(hint){hint.textContent=val!==""?"Leído automáticamente":"Revisar manualmente";hint.classList.toggle("detected",val!=="");hint.classList.toggle("missing",val==="")}
}

export function refreshWeightState(modal){
  const input=modal.querySelector('[name="invoiceWeightV1199"]');
  const field=input?.closest(".invoice-reader-field-v1199");
  const valid=positiveNumber(input?.value)>0;
  field?.classList.toggle("needs-review",!valid);
  const hint=modal.querySelector('[data-field-source="invoiceWeightV1199"]');
  if(hint&&!valid){hint.textContent="Peso pendiente · escribe un valor mayor que 0";hint.classList.add("missing")}
}

export function value(root,name){return root.querySelector(`[name="${name}"]`)?.value?.trim?.()||""}
