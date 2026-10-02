import { DRAFT_PREFIX } from "../picking-state.js";

export function draftKey(task){return `${DRAFT_PREFIX}${task?.id||"none"}`}

export function loadDraft(task,items){
  try{
    const raw=JSON.parse(localStorage.getItem(draftKey(task))||"{}");
    return Object.fromEntries(items.map(item=>[item.id,raw[item.id]||{}]));
  }catch{return {}}
}

export function saveDraft(task,rows){
  const value=Object.fromEntries(rows.map(row=>[row.orderItemId,{result:row.result,novelty:row.novelty,origins:row.origins||[]}]));
  localStorage.setItem(draftKey(task),JSON.stringify(value));
}

export function clearDraft(task){localStorage.removeItem(draftKey(task))}
