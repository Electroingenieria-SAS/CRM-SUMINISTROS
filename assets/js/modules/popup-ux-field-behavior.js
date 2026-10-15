// Consistent field hints and validation for legacy modal shells.
// This module never mutates business values or submits a workflow.
export function decorateFields(modal){
  modal.querySelectorAll(".field").forEach(field=>{
    field.classList.add("popup-field-v1190");
    const control=[...field.querySelectorAll("input,select,textarea")].find(item=>item.type!=="hidden");
    if(!control)return;
    const label=field.querySelector("label");
    if(control.required&&label&&!/\*/.test(label.textContent||""))label.append(" *");
    if(control.readOnly&&label&&!field.querySelector(".popup-auto-badge-v1190")){
      const badge=document.createElement("span");
      badge.className="popup-auto-badge-v1190";
      badge.textContent="Automático";
      label.append(badge);
    }
    setInputHints(control);
  });
}

function setInputHints(control){
  if(control.dataset.popupInputHints)return;
  control.dataset.popupInputHints="1";
  if(control.tagName!=="INPUT")return;
  const name=String(control.name||control.id||"").toLowerCase();
  const type=String(control.type||"text").toLowerCase();
  if(/phone|telefono|tel[eé]fono/.test(name)){
    control.inputMode="tel";
    if(!control.autocomplete)control.autocomplete="tel";
  }else if(type==="number"||/amount|monto|valor|quantity|cantidad|qty|medida|peso/.test(name)){
    control.inputMode="decimal";
  }
  if(/address|direcci[oó]n/.test(name)&&!control.autocomplete)control.autocomplete="street-address";
  if(/city|municipio|ciudad/.test(name)&&!control.autocomplete)control.autocomplete="address-level2";
  if(/department|departamento/.test(name)&&!control.autocomplete)control.autocomplete="address-level1";
  if(/country|pa[ií]s/.test(name)&&!control.autocomplete)control.autocomplete="country-name";
  // Do not trim values on blur: doing so without input/change silently desyncs state.
}

export function bindValidation(modal){
  if(modal.dataset.popupValidationBound)return;
  modal.dataset.popupValidationBound="1";
  modal.addEventListener("invalid",event=>{
    const control=event.target;
    if(!(control instanceof HTMLInputElement||control instanceof HTMLSelectElement||control instanceof HTMLTextAreaElement))return;
    event.preventDefault();showValidation(modal,control);
  },true);
  modal.addEventListener("input",event=>clearValidation(event.target),true);
  modal.addEventListener("change",event=>clearValidation(event.target),true);
}

function validationMessage(control){
  if(control.validity.valueMissing)return"Completa este dato para continuar.";
  if(control.validity.typeMismatch)return"Revisa el formato de este dato.";
  if(control.validity.rangeUnderflow)return`El valor debe ser igual o mayor a ${control.min}.`;
  if(control.validity.rangeOverflow)return`El valor debe ser igual o menor a ${control.max}.`;
  if(control.validity.stepMismatch)return"Revisa el valor ingresado.";
  if(control.validity.patternMismatch)return"El formato ingresado no es válido.";
  return"Revisa este dato antes de continuar.";
}

function fieldName(control){
  const label=control.closest(".field")?.querySelector("label")?.textContent?.replace(/Automático/g,"").replace(/\*/g,"").trim();
  return label||control.getAttribute("aria-label")||control.name||"Dato requerido";
}

function showValidation(modal,control){
  modal.querySelectorAll(".popup-validation-v1190").forEach(node=>node.remove());
  modal.querySelectorAll(".popup-invalid-v1190").forEach(node=>{
    node.classList.remove("popup-invalid-v1190");node.removeAttribute("aria-invalid");
  });
  control.classList.add("popup-invalid-v1190");
  control.setAttribute("aria-invalid","true");
  const container=control.closest(".wizard-panel.active")?.querySelector(".wizard-step-content")||
    control.closest(".modal-task-panel-body,.modal-body")||modal;
  const alert=document.createElement("div");
  alert.className="popup-validation-v1190";
  alert.setAttribute("role","alert");
  const title=document.createElement("strong");
  title.textContent="Falta revisar un dato";
  const message=document.createElement("span");
  message.textContent=`${fieldName(control)}: ${validationMessage(control)}`;
  alert.append(title,message);
  container.prepend(alert);
  requestAnimationFrame(()=>{
    if(!alert.isConnected)return;
    alert.scrollIntoView({block:"nearest",behavior:"smooth"});
    control.focus({preventScroll:true});
  });
}

function clearValidation(target){
  if(!(target instanceof HTMLElement)||!target.classList.contains("popup-invalid-v1190"))return;
  if(target.validity?.valid){
    target.classList.remove("popup-invalid-v1190");
    target.removeAttribute("aria-invalid");
    target.closest(".wizard-panel,.modal-body,.modal-task-panel-body")?.querySelector(".popup-validation-v1190")?.remove();
  }
}
