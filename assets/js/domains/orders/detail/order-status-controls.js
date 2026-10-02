import { fmt } from "../../../core/format.js";

export function statusOption(code,title,detail,current,enabled){return `<button type="button" class="simple-status-option ${current?"current":""}" data-status-choice="${code}" ${enabled||current?"":"disabled"}><span></span><strong>${fmt.escape(title)}</strong><small>${fmt.escape(detail)}</small>${current?'<b>Estado actual</b>':""}</button>`}

export function workflowMini(tasks,current){return `<section class="simple-flow-line">${(tasks||[]).map(task=>`<div class="${task.step_code===current?"current":""} ${task.status==="COMPLETED"?"done":""}"><span></span><small>${fmt.escape(fmt.step(task.step_code))}</small></div>`).join("")}</section>`}
