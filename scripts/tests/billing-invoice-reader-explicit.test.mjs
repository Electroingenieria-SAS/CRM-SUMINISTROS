import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { api } from "../../assets/js/services/api.js";
import { parseInvoiceText } from "../../assets/js/domains/billing/invoice-reader/parse/invoice-text.js";
import { readInvoiceDocument } from "../../assets/js/domains/billing/invoice-reader/pdf/read-invoice-file.js";
import {
  buildInvoiceReaderPayload,
  saveInvoiceExplicit
} from "../../assets/js/domains/billing/invoice-reader/save/invoice-save-adapter.js";
import { validateBillingUploadFile } from "../../assets/js/domains/billing/uploads/upload-experience.js";

const invoiceText="Factura No. FE12345\nProveedor: Suministros SAS\nFecha: 25/09/2026\nTotal a pagar: $ 1.234.567,89\nPeso total: 12,5 kg\nCantidad total: 3\nSKU A\nSKU B";

test("invoice parser keeps money, quantity and weight separated",()=>{
  const parsed=parseInvoiceText(invoiceText);
  assert.equal(parsed.amount,1234567.89);
  assert.equal(parsed.packageQuantity,3);
  assert.equal(parsed.packageWeightKg,12.5);
  assert.equal(parsed.invoiceNumber,"FE12345");
  assert.equal(parsed.invoiceDate,"2026-09-25");
  assert.equal(parsed.issuer,"Suministros SAS");
});

test("invoice document reader supports PDF image and CSV through the shared reader",async()=>{
  for(const kind of ["pdf","image","csv"]){
    const file={name:`factura.${kind==="image"?"png":kind}`,type:kind==="pdf"?"application/pdf":kind==="image"?"image/png":"text/csv"};
    const parsed=await readInvoiceDocument(file,{reader:async()=>({kind,text:invoiceText})});
    assert.equal(parsed.amount,1234567.89);
    assert.equal(parsed.readerVersion,`factura-${kind}-v11101`);
  }
  assert.equal(validateBillingUploadFile({name:"factura.png",type:"image/png",size:1000}).valid,true);
  assert.equal(validateBillingUploadFile({name:"factura.csv",type:"text/csv",size:1000}).valid,true);
  assert.equal(validateBillingUploadFile({name:"factura.exe",type:"application/octet-stream",size:1000}).valid,false);
});

test("invoice reader payload preserves complete metadata and manual review flags",()=>{
  const fields={
    invoiceNumberV1199:{value:"FE-77",dataset:{}},
    invoiceDateV1199:{value:"2026-10-01",dataset:{}},
    invoiceNameV1199:{value:"Proveedor SAS",dataset:{manual:"1"}},
    invoiceAmountV1199:{value:"450000",dataset:{}},
    invoiceQuantityV1199:{value:"3",dataset:{}},
    invoiceWeightV1199:{value:"12.5",dataset:{manual:"1"}},
    invoiceLinesV1199:{value:"2",dataset:{}}
  };
  const dialog={
    dataset:{invoiceReaderVersion:"factura-image-v11101",invoiceAutoRead:"1"},
    querySelector(selector){
      const match=selector.match(/name="([^"]+)"/);
      return match?fields[match[1]]||null:null;
    }
  };
  const payload=buildInvoiceReaderPayload(dialog,{driveFileRecordId:"file-1",metadata:{source:"CAJA_FACTURACION"}});
  assert.equal(payload.invoiceNumber,"FE-77");
  assert.equal(payload.invoiceDate,"2026-10-01");
  assert.equal(payload.amount,450000);
  assert.equal(payload.currency,"COP");
  assert.deepEqual(payload.metadata,{
    source:"CAJA_FACTURACION",
    invoiceName:"Proveedor SAS",
    packageQuantity:3,
    packageWeightKg:12.5,
    productLineCount:2,
    pdfReaderVersion:"factura-image-v11101",
    readerVersion:"factura-image-v11101",
    autoRead:true,
    pdfAutoRead:true,
    pdfFieldsEditable:true,
    weightManuallyReviewed:true,
    invoiceDataReviewed:true
  });
});

test("invoice explicit save calls api contract exactly once without changing identity and propagates errors",async()=>{
  const identity=api.saveInvoice;
  const calls=[];
  await saveInvoiceExplicit("order-1",{invoiceNumber:"FE-1"},{save:async(...args)=>{calls.push(args);return {ok:true}}});
  assert.deepEqual(calls,[["order-1",{invoiceNumber:"FE-1"}]]);
  assert.equal(api.saveInvoice,identity);
  await assert.rejects(()=>saveInvoiceExplicit("order-1",{}, {save:async()=>{throw new Error("backend down")}}),/backend down/);
});

test("invoice reader installation is explicit and has no global observer or patch",()=>{
  const installation=fs.readFileSync(new URL("../../assets/js/domains/billing/invoice-reader/installation.js",import.meta.url),"utf8");
  const adapter=fs.readFileSync(new URL("../../assets/js/domains/billing/invoice-reader/save/invoice-save-adapter.js",import.meta.url),"utf8");
  const index=fs.readFileSync(new URL("../../assets/js/domains/billing/invoice-reader/index.js",import.meta.url),"utf8");
  assert.doesNotMatch(installation,/MutationObserver/);
  assert.doesNotMatch(index,/DOMContentLoaded/);
  assert.doesNotMatch(adapter,/api\.saveInvoice\s*=/);
  assert.match(adapter,/buildInvoiceReaderPayload/);
  assert.match(adapter,/saveInvoiceExplicit/);
});
