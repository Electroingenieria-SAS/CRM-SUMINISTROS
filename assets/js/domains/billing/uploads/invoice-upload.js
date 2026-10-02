import { modal, toast } from "../../../core/ui.js";
import { activeTask } from "../../finance/shared/financial-status.js";
import { storeBillingFile } from "../shared/billing-document.js";
import { refresh } from "../../finance/shared/flow-callbacks.js";
import { installBillingUpload } from "./upload-experience.js";
import { installInvoiceReader } from "../invoice-reader/index.js";
import { buildInvoiceReaderPayload, saveInvoiceExplicit } from "../invoice-reader/save/invoice-save-adapter.js";

export function openInvoiceUpload(data,{reload,refreshLists,source}){
  const view=modal({
    title:"Subir factura",
    confirmLabel:"Guardar factura",
    size:"wide",
    body:'<div class="billing-upload-note"><strong>Carga directa mediante Google Drive</strong><p>Selecciona PDF, imagen o CSV. El CRM leerá los datos y podrás corregirlos antes de guardar.</p></div><div class="field"><label>Factura *</label><input class="control" name="file" type="file" accept="application/pdf,.pdf,image/*,.csv,text/csv" required autofocus></div>',
    onConfirm:async dialog=>{
      const file=dialog.querySelector('[name="file"]').files?.[0];
      if(!file)throw new Error("Selecciona la factura.");
      const task=activeTask(data);
      const uploaded=await storeBillingFile(data,file,"INVOICE",task?.id);
      const basePayload={
        invoiceNumber:file.name.replace(/\.[^.]+$/u,"").trim()||`FACTURA-${data.order.order_number}`,
        invoiceDate:new Date().toISOString().slice(0,10),
        currency:"COP",
        driveFileRecordId:uploaded?.file?.id||null,
        metadata:{source,fileName:file.name,taskId:task?.id||null,automaticRecord:true}
      };
      const payload=buildInvoiceReaderPayload(dialog,basePayload);
      await saveInvoiceExplicit(data.order.id,payload);
      toast("Factura cargada correctamente.","success");
      refresh(refreshLists);
      setTimeout(()=>reload(),80);
    }
  });
  const dialog=view.root.querySelector(".modal");
  installBillingUpload(dialog,{pvp:false});
  installInvoiceReader(dialog);
  return view;
}

export function openPvpAnnexUpload(data,{reload,refreshLists}){
  const view=modal({
    title:"Subir Anexo PVP",
    confirmLabel:"Guardar Anexo PVP",
    size:"wide",
    body:'<div class="billing-upload-note"><strong>Documento requerido para PVP</strong><p>Adjunta el archivo comercial correspondiente. En el ERP quedará identificado únicamente como Anexo PVP.</p></div><div class="field"><label>Anexo PVP *</label><input class="control" name="file" type="file" required autofocus></div>',
    onConfirm:async dialog=>{
      const file=dialog.querySelector('[name="file"]').files?.[0];
      if(!file)throw new Error("Selecciona el Anexo PVP.");
      await storeBillingFile(data,file,"PVP_ANNEX",activeTask(data)?.id);
      toast("Anexo PVP cargado correctamente.","success");
      refresh(refreshLists);
      setTimeout(()=>reload(),80);
    }
  });
  installBillingUpload(view.root.querySelector(".modal"),{pvp:true});
  return view;
}
