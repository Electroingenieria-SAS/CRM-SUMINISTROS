import { fmt } from "../../../core/format.js";

export function clockSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 10.4V6h-2v7.2l4.5 2.7 1-1.7Z"/></svg>';
}

export function cameraSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 5 10.8 3h2.4l1.4 2H18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3.4ZM12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4Z"/></svg>';
}

export function cancelButton(item){
  if(!item?.canCancel)return "";
  return `<button type="button" class="work-calendar-cancel-v11360" data-assignment-cancel="${fmt.escape(item.assignmentId||item.id)}" aria-label="Cancelar asignación">×</button>`;
}

export function photoBadge(){
  return `<span class="work-calendar-photo-badge-v11360">${cameraIcon()}<span>Evidencia</span></span>`;
}

export function clockIcon(){
  return '<svg class="work-calendar-icon-v11360" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm1-8.414 3.207 3.207-1.414 1.414L11 12.414V6h2Z"/></svg>';
}

export function cameraIcon(){
  return '<svg class="work-calendar-icon-v11360" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 5 10.8 3h2.4l1.4 2H18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3.4ZM12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4Zm0 2a2 2 0 1 1-2 2 2 2 0 0 1 2-2Z"/></svg>';
}
