

export function semanticActionClass(label,fallback="btn-primary"){
  const value=String(label||"").trim().toLowerCase();
  if(/^(crear|agregar|nuevo|nueva|añadir)\b/.test(value))return "btn-create";
  if(/^(buscar|consultar)\b/.test(value))return "btn-search";
  if(/^(eliminar|borrar|rechazar|anular)\b/.test(value))return "btn-danger";
  if(/^(aprobar|finalizar|completar|mercancía ok|pasar a cierre)\b/.test(value))return "btn-success";
  return fallback;
}

export function validatePanel(panel){
  const controls=[...panel.querySelectorAll("input,select,textarea")].filter(control=>!control.disabled&&control.type!=="hidden");
  for(const control of controls){
    if(!control.checkValidity()){
      control.reportValidity();
      control.focus();
      return false;
    }
  }
  return true;
}

export function serializeForm(form){
  const data=Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach(input=>{if(input.name)data[input.name]=input.checked});
  return data;
}
