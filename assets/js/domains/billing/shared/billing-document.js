import { uploadOrderFile } from "../../../services/drive.js";
import { activeTask } from "../../finance/shared/financial-status.js";

export function currentTaskFiles(data){
  const task=activeTask(data);
  return task?(data.files||[]).filter(file=>file.task_id===task.id):[];
}

export function registeredInvoice(data){
  const task=activeTask(data);
  const taskFiles=currentTaskFiles(data);
  const fileIds=new Set(taskFiles.map(file=>file.id));
  const rows=[...(data.invoices||[])].reverse().filter(row=>row.status==="REGISTERED");
  if(!task)return rows[0]||null;
  return rows.find(row=>(row.drive_file_id&&fileIds.has(row.drive_file_id))||row.metadata?.taskId===task.id)||null;
}

export async function storeBillingFile(data,file,category,taskId){
  return uploadOrderFile(data.order.id,file,category,taskId,data.order.order_number);
}

export function pvpAnnex(data){return [...currentTaskFiles(data)].reverse().find(file=>String(file.file_category||"").toUpperCase()==="PVP_ANNEX")||null}

export function isCashOrder(order){return ["PVN","PNV"].includes(String(order?.order_type_code||"").toUpperCase())}

export function isPvpOrder(order){return String(order?.order_type_code||"").toUpperCase()==="PVP"}

export function approvedException(data,requestType,exceptionCode){
  return (data.approvals||[]).some(item=>String(item.request_type||item.requestType||"").toUpperCase()===requestType&&String(item.request_payload?.exceptionCode||item.requestPayload?.exceptionCode||"").toUpperCase()===exceptionCode&&["APPROVED","EXECUTED"].includes(String(item.status||"").toUpperCase()));
}
