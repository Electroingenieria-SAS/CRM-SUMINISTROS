import { toast } from "../../../core/ui.js";
import { num } from "../../../core/layout/operational/operational-values.js";

export function exportOperationalWorkbook(module,data){
  const rows=data?.rows||[];
  if(!rows.length)return toast("No hay registros para exportar.","error");
  if(!window.XLSX)return toast("El componente de Excel no terminó de cargar. Recarga la página e inténtalo nuevamente.","error",7000);
  const XLSX=window.XLSX;let aoa=[],formulaCells=[];let widths=[];let name="Control";
  if(module==="billing"){
    name="Facturacion";aoa=[["Pedido","Cliente","Factura","Fecha","Valor","Cantidad","Peso kg","Kg/unidad (fórmula)","Validación consecutivo (fórmula)"]];
    rows.forEach((r,i)=>{const row=i+2;aoa.push([r.orderNumber,r.clientName,r.invoiceNumber,r.invoiceDate,num(r.amount),num(r.packageQuantity),num(r.packageWeightKg),null,null]);formulaCells.push([`H${row}`,{t:"n",f:`IF(AND(F${row}>0,G${row}>0),G${row}/F${row},0)`}],[`I${row}`,{t:"str",f:`IF(COUNTIF($C:$C,C${row})>1,"DUPLICADO","OK")`}])});widths=[16,28,18,14,16,14,14,20,25];
  }else if(module==="shipping"){
    name="Transportadoras";aoa=[["Pedido","Cliente","Transportadora","Guía","Factura transportadora","Costo","Moneda","Validación factura (fórmula)"]];
    rows.forEach((r,i)=>{const row=i+2;aoa.push([r.orderNumber,r.clientName,r.carrier,r.trackingNumber,r.carrierInvoiceNumber,num(r.carrierCost),r.currency||"COP",null]);formulaCells.push([`H${row}`,{t:"str",f:`IF(E${row}="","FALTA FACTURA",IF(COUNTIF($E:$E,E${row})>1,"DUPLICADO","OK"))`}])});widths=[16,28,24,22,24,16,10,26];
  }else{
    name="Recepcion";aoa=[["Prefijo","Consecutivo","Recepción","Tipo","Pedido","Proveedor","Recibido","Aceptado","Rechazado","Diferencia (fórmula)","Novedad","Verificado por","Fecha verificación","Control consecutivo (fórmula)"]];
    rows.forEach((r,i)=>{const row=i+2;aoa.push([r.documentPrefix,num(r.consecutiveNo),r.receiptNumber,r.receiptType==="RETURN"?"Devolución":"Compra",r.orderNumber,r.supplierName,num(r.receivedQuantity),num(r.acceptedQuantity),num(r.rejectedQuantity),null,r.noveltyStatus==="OPEN"?(r.noveltyType||"Abierta"):"Sin novedad",r.verifiedBy||"",r.verifiedAt||"",null]);formulaCells.push([`J${row}`,{t:"n",f:`G${row}-H${row}-I${row}`}],[`N${row}`,{t:"str",f:`IF(B${row}="","SIN CONSECUTIVO","OK")`}])});widths=[10,14,22,14,16,26,14,14,14,20,18,24,24,24];
  }
  const ws=XLSX.utils.aoa_to_sheet(aoa);for(const [cell,value] of formulaCells)ws[cell]=value;ws["!cols"]=widths.map(w=>({wch:w}));ws["!autofilter"]={ref:ws["!ref"]};
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,name);wb.Workbook={CalcPr:{calcMode:"auto",fullCalcOnLoad:true,forceFullCalc:true}};
  const safeDate=new Date().toISOString().slice(0,10);XLSX.writeFile(wb,`CRM_${name}_${safeDate}.xlsx`,{compression:true});
  toast("Excel generado con fórmulas de control.","success");
}
