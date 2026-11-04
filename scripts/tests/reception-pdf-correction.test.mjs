import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mergePdfIntoReception} from "../../assets/js/domains/receiving/order/pdf/merge-corrections.js";
import {editableLine} from "../../assets/js/domains/receiving/order/lines/editable-line.js";

const source=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const fixture={order:{id:"demo",order_number:"PVE123"},files:[{drive_file_id:"drive1",file_name:"pedido.pdf",mime_type:"application/pdf"}]};
const draft={lines:[{orderItemId:"one",reference:"TUBO123",description:"Tubo",quantity:4,unit:"UND",lotNumbers:["MANUAL-1"],lotSource:"MANUAL",lotReviewed:true}]};

test("Corregir y Asignar incluyen selector de PDF local y del pedido",()=>{
  const [edit,assign,picker,binding,assignment]=[
    source("assets/js/domains/receiving/order/stages/edit-lines.js"),
    source("assets/js/domains/receiving/order/stages/assignment.js"),
    source("assets/js/domains/receiving/order/pdf/correction-pdf-controls.js"),
    source("assets/js/domains/receiving/order/stages/stage-bindings.js"),
    source("assets/js/domains/receiving/order/assignment/assignment-pool.js")
  ];
  assert.ok(edit.includes("correctionPdfControls(data,draft)"));
  assert.ok(assign.includes("correctionPdfControls(data,draft)"));
  for(const marker of ["data-correction-source-pdf","data-correction-read-drive","data-correction-local-pdf","Seleccionar y leer PDF"]){
    assert.ok(picker.includes(marker),marker);
  }
  assert.ok(binding.includes("bindCorrectionPdf(host,data,draft,callbacks)"));
  assert.ok(assignment.includes("bindCorrectionPdf(host,data,draft,callbacks)"));
});

test("Un nuevo PDF no sobrescribe lotes ni cantidades corregidas a mano",()=>{
  const incoming=[{reference:"TUBO123",description:"PDF tubo",quantity:100,lotNumbers:["PDF-1"],lotReviewed:false},
                  {reference:"CABLE456",description:"Cable nuevo",quantity:2,lotNumbers:["PDF-2"]}];
  const result=mergePdfIntoReception(draft.lines,incoming);
  assert.equal(result.lines.length,2);
  assert.equal(result.lines[0].quantity,4);
  assert.deepEqual(result.lines[0].lotNumbers,["MANUAL-1"]);
  assert.equal(result.lines[0].lotReviewed,true);
  assert.deepEqual(result.lines[0].pdfSuggestedLotNumbers,["PDF-1"]);
  assert.equal(result.lines[0].pdfLotDiscrepancy,true);
  assert.equal(result.lines[1].lotReviewed,false);
  assert.deepEqual(result.lines[1].lotNumbers,["PDF-2"]);
  assert.equal(result.summary.newMaterials,1);
  assert.match(editableLine(result.lines[0],0),/El PDF sugiere estos lotes/);
});

test("Completa únicamente lotes faltantes y exige revisión nueva",()=>{
  const lines=[{reference:"REF1",description:"Sin lote",quantity:7,lotNumbers:[],lotReviewed:true}];
  const result=mergePdfIntoReception(lines,[{reference:"REF1",lotNumbers:["LOTE-A","LOTE-B"]}]);
  assert.deepEqual(result.lines[0].lotNumbers,["LOTE-A","LOTE-B"]);
  assert.equal(result.lines[0].lotReviewed,false);
  assert.equal(result.lines[0].lotSource,"PDF");
  assert.equal(result.summary.lotsCompleted,1);
});

test("Referencias duplicadas nunca reciben lotes de otra línea automáticamente",()=>{
  const existing=[{reference:"REF1",lotNumbers:[]},{reference:"REF1",lotNumbers:[]}];
  const result=mergePdfIntoReception(existing,[{reference:"REF1",lotNumbers:["X"]}]);
  assert.equal(result.lines.length,2);
  assert.deepEqual(result.lines[0].lotNumbers,[]);
  assert.deepEqual(result.lines[1].lotNumbers,[]);
  assert.equal(result.summary.ambiguous,1);
});

test("Los archivos locales se leen, se guardan como soporte y no toman identificadores de PDF previo",()=>{
  const reader=source("assets/js/domains/receiving/order/pdf/process-pdf.js");
  const upload=source("assets/js/domains/receiving/order/pdf/correction-upload.js");
  assert.match(reader,/mergePdfIntoReception\(draft.lines,resolved\)/);
  assert.match(reader,/Object\.hasOwn\(stored,"sourceFileId"\)/);
  assert.match(reader,/await options\.afterRead\?\.\(file\)/);
  assert.match(upload,/uploadOrderFile\(data.order.id,file,"EVIDENCE"/);
  assert.match(upload,/uploadWarning/);
  const ops=source("assets/css/operations.css");
  assert.match(ops,/order-reception-pdf-correction\.css/);
});
