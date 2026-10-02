import { fmt } from "../../../core/format.js";

export function formSelect(name,items,valueKey=null,labelKey=null,selected=null){
  return `<select class="control" name="${name}" required>${items.map(item=>{const value=valueKey?item[valueKey]:item;const label=labelKey?item[labelKey]:fmt.label(item);return `<option value="${fmt.escape(value)}" ${value===(selected??"MEDIUM")?"selected":""}>${fmt.escape(label)}</option>`}).join("")}</select>`;
}

export function dialogData(dialog){
  const data={};
  dialog.querySelectorAll("input,select,textarea").forEach(control=>{
    if(!control.name||control.disabled)return;
    if(control.type==="radio"){if(control.checked)data[control.name]=control.value;return;}
    if(control.type==="checkbox"){data[control.name]=control.checked;return;}
    if(control.type!=="file")data[control.name]=control.value;
  });
  return data;
}
