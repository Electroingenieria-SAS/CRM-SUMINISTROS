import { fmt } from "../../../core/format.js";
import { currentList } from "../orders-state.js";

export function setFilters(values){
  if("assignment" in values)currentList.root.querySelector("#f-assignment").value=values.assignment;
  if("status" in values)currentList.root.querySelector("#f-status").value=values.status;
  if("includeHistory" in values)currentList.root.querySelector("#f-history").checked=values.includeHistory;
}

export function select(id,label,items=[],valueKey="code",labelKey="name",selected=""){
  return `<select class="control" id="${id}"><option value="">${label}: todos</option>${items.map(item=>`<option value="${fmt.escape(item[valueKey])}" ${item[valueKey]===selected?"selected":""}>${fmt.escape(item[labelKey])}</option>`).join("")}</select>`;
}

export function simpleSelect(id,label,items,selected=""){
  return `<select class="control" id="${id}"><option value="">${label}: todos</option>${items.map(item=>`<option value="${item}" ${item===selected?"selected":""}>${fmt.escape(fmt.label(item))}</option>`).join("")}</select>`;
}
