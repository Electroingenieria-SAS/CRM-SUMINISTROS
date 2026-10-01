import { bindMaterialPicker } from "../../../../services/materials.js";

export function bindRows(editor){
  editor.querySelectorAll("[data-line-row]").forEach(row=>{
    syncCutRow(row);
    bindMaterialPicker(row.querySelector("[data-material-picker]"),{onChange:()=>row.classList.remove("unresolved")});
  });
}

export function syncCutRow(row){
  if(!row)return;
  const toggle=row.querySelector('[data-field="requiresCut"]');
  const length=row.querySelector('[data-field="requestedCutLength"]');
  length.disabled=!toggle.checked;
  length.required=toggle.checked;
  if(toggle.checked&&!length.value){
    const quantity=Number(row.querySelector('[data-field="quantity"]')?.value||0);
    if(quantity>0)length.value=String(quantity);
  }
  if(!toggle.checked)length.value="";
}

export function renumberEditor(editor){editor.querySelectorAll(".reception-line-number").forEach((node,index)=>node.textContent=String(index+1))}
