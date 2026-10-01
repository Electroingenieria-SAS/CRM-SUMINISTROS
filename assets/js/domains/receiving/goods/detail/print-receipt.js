import { toast } from "../../../../core/ui.js";
import { esc } from "../shared/goods-values.js";

export function printGoodsReceipt(data){
  try{
    if(!window.JsBarcode||!window.qrcode)throw new Error("Los componentes de QR/código de barras no están disponibles todavía.");
    const r=data.receipt,svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    window.JsBarcode(svg,String(r.barcode_value),{format:"CODE128",displayValue:true,height:52,margin:5,fontSize:13});
    const qr=window.qrcode(0,"M");
    qr.addData(String(r.qr_value));
    qr.make();
    const qrUrl=qr.createDataURL(5,2);
    const win=window.open("","_blank","width=900,height=700");
    if(!win)throw new Error("El navegador bloqueó la ventana de impresión.");
    const linkedLabel=data.linkedPve?esc(data.linkedPve.orderNumber):"INDEPENDIENTE";
    const document=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.receipt_number)}</title><style>body{font-family:Arial,sans-serif;margin:10mm;color:#111}.label{border:2px solid #111;border-radius:14px;padding:9mm}.head{display:flex;justify-content:space-between;border-bottom:1px solid #aaa;padding-bottom:5mm}.head h1{margin:2mm 0}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;margin:6mm 0}.meta div{border:1px solid #ddd;border-radius:8px;padding:3mm}.meta small{display:block;color:#555;text-transform:uppercase}.codes{display:grid;grid-template-columns:1fr 45mm;gap:8mm;align-items:center;border-top:1px solid #aaa;padding-top:5mm}.codes svg{max-width:100%}.codes img{width:42mm;height:42mm}@media print{body{margin:3mm}}</style></head><body><section class="label"><div class="head"><div><small>Recepción de mercancía · Bodega</small><h1>${esc(r.receipt_number)}</h1><strong>${r.receipt_type==="RETURN"?"DEVOLUCIÓN":"COMPRA"}</strong></div><div><small>${data.linkedPve?"PVE enlazado":"Registro"}</small><h2>${linkedLabel}</h2></div></div><div class="meta"><div><small>Proveedor</small><strong>${esc(r.supplier_name||"—")}</strong></div><div><small>Orden de compra</small><strong>${esc(r.purchase_order_number||"—")}</strong></div><div><small>Recibió</small><strong>${esc(data.receivedBy||"—")}</strong></div><div><small>Materiales</small><strong>${(data.lines||[]).length}</strong></div></div><div class="codes"><div>${svg.outerHTML}</div><img src="${qrUrl}" alt="QR"></div></section><script>window.addEventListener('load',()=>window.print(),{once:true});<\/script></body></html>`;
    win.document.write(document);
    win.document.close();
  }catch(error){toast(error.message,"error",7000)}
}
