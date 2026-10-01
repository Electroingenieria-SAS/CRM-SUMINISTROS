import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { modal, toast } from "../../../../core/ui.js";
import { activeTask } from "../shared/shipping-status.js";
import { storeShippingFile } from "../files/shipping-file.js";

export function openGuideDialog(data,delivery,{reload,refreshLists}){
  modal({title:"Agregar guía",confirmLabel:"Guardar guía",size:"wide",body:`<div class="shipping-dialog-intro"><strong>Información de transporte</strong><p>Registra los datos del envío. El lector puede completar la información desde PDF, imagen o CSV.</p></div><div class="form-grid"><div class="field"><label>Número de guía *</label><input class="control" name="trackingNumber" value="${fmt.escape(delivery?.tracking_number||"")}" required autofocus></div><div class="field"><label>Transportadora *</label><input class="control" name="carrier" value="${fmt.escape(delivery?.carrier||"")}" required></div><div class="field full"><label>Soporte de guía</label><input class="control" name="guideFile" type="file" accept="application/pdf,.pdf,image/*,.csv,text/csv"></div></div>`,onConfirm:async dialog=>{
    const trackingNumber=dialog.querySelector('[name="trackingNumber"]')?.value.trim()||"";
    const carrier=dialog.querySelector('[name="carrier"]')?.value.trim()||"";
    const file=dialog.querySelector('[name="guideFile"]')?.files?.[0]||null;
    let fileId=delivery?.metadata?.guideFileId||null;
    if(file){const uploaded=await storeShippingFile(data,file,"SHIPPING_GUIDE",activeTask(data)?.id);fileId=uploaded?.file?.id||null}
    await api.saveShippingGuide(data.order.id,{trackingNumber,carrier,guideFileId:fileId});
    toast("Guía guardada. Revisa los datos y continúa.","success",5000);refreshLists?.();setTimeout(()=>reload?.(),80);
  }});
}
