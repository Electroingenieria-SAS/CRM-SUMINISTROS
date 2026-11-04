import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseOrderText, detectPdfLotNumbers } from "../../assets/js/services/pdf-order-reader.js";
import { normalizeReceptionLotNumbers,validateReceptionLineLots } from "../../assets/js/domains/receiving/order/lines/reception-lot-values.js";
import { fromOrderItem,mergeReaderLine } from "../../assets/js/domains/receiving/order/lines/map-reception-line.js";
import { editableLine } from "../../assets/js/domains/receiving/order/lines/editable-line.js";
import { receptionLotReviewCards,assertReceptionLotReview } from "../../assets/js/domains/receiving/order/assignment/lot-review.js";

const read=file=>fs.readFileSync(new URL("../../"+file,import.meta.url),"utf8");

test("Los lotes múltiples conservan los códigos y eliminan duplicados",()=>{
  assert.deepEqual(normalizeReceptionLotNumbers(" LT-01, LT-02; LT-01"),["LT-01","LT-02"]);
  assert.deepEqual(normalizeReceptionLotNumbers("ABC/2026; 0520"),["ABC/2026","0520"]);
  assert.deepEqual(normalizeReceptionLotNumbers([]),[]);
  assert.deepEqual(detectPdfLotNumbers("LOTE: L-A1, L-A2"),["L-A1","L-A2"]);
  assert.deepEqual(detectPdfLotNumbers("SIN NUMERO DE LOTE INFORMADO"),[]);
});

test("PDF identifica el lote explícito por cada material y deja en blanco el que no tiene",()=>{
  const result=parseOrderText([
    "CLIENTE: EJEMPLO SAS",
    "1234 TUBO DE PVC 6 UND LOTE: AZ-110, AZ-111",
    "2345 ROLLO CABLE 8 M",
    "LOTE: W-900",
    "3456 CONECTOR METALICO 2 UND"
  ].join("\n"));
  assert.equal(result.items.length,3);
  assert.deepEqual(result.items[0].lotNumbers,["AZ-110","AZ-111"]);
  assert.deepEqual(result.items[1].lotNumbers,["W-900"]);
  assert.deepEqual(result.items[2].lotNumbers,[]);
  assert.equal(result.items[1].requiresCut,true);
});

test("El lote del PDF se asocia con su referencia y no con otra",()=>{
  const order=[
    {id:"item-1",reference:"1234",description:"Tubo"},
    {id:"item-2",reference:"2345",description:"Conector"}
  ];
  const first=mergeReaderLine({reference:"2345",quantity:2,requiresCut:false,lotNumbers:["XY-02"]},order,0);
  assert.equal(first.orderItemId,"item-2");
  assert.deepEqual(first.lotNumbers,["XY-02"]);
  assert.equal(first.lotReviewed,false);
  assert.equal(first.lotSource,"PDF");
  const clean=fromOrderItem(order[0],0);
  assert.deepEqual(clean.lotNumbers,[]);
  assert.equal(clean.lotReviewed,false);
});

test("Manual y PDF exigen un lote válido y verificación explícita incluso en Corte",()=>{
  const lines=[
    {reference:"TUBO",lotNumbers:["A-100"],lotReviewed:true,requiresCut:false},
    {reference:"CABLE",lotNumbers:["C-200","C-201"],lotReviewed:true,requiresCut:true}
  ];
  assert.doesNotThrow(()=>assertReceptionLotReview({lines}));
  lines[1].lotReviewed=false;
  assert.throws(()=>assertReceptionLotReview({lines}),/Verifica manualmente/);
  lines[1].lotReviewed=true;
  lines[0].lotNumbers=[];
  assert.throws(()=>validateReceptionLineLots(lines[0],0),/Registra al menos un lote/);
  lines[0].lotNumbers=["x".repeat(81)];
  assert.throws(()=>assertReceptionLotReview({lines}),/lotes inválidos/);
});

test("Todos los materiales tienen control editable y firma de verificación por separado",()=>{
  const lines=[
    {reference:"REF-A",description:"A",quantity:4,unit:"UND",lotNumbers:["A1"],lotSource:"PDF"},
    {reference:"REF-B",description:"B",quantity:7,unit:"M",lotNumbers:[],requiresCut:true}
  ];
  const html=receptionLotReviewCards(lines);
  assert.equal((html.match(/data-reception-lot-index=/g)||[]).length,2);
  assert.equal((html.match(/data-reception-lot-verified/g)||[]).length,2);
  assert.match(html,/Detectado en PDF/);
  assert.match(html,/Ingreso manual/);
  assert.match(editableLine(lines[0],0),/data-field="lotNumbers"/);
});

test("El guardado incluye los lotes verificados y la migración rechaza confirmaciones vacías",()=>{
  const assignment=read("assets/js/domains/receiving/order/assignment/assignment-pool.js");
  const confirmation=read("assets/js/domains/receiving/order/actions/confirm-reception.js");
  const migration=read("supabase/migrations/20261104200500_reception_required_lot_review.sql");
  assert.ok(assignment.indexOf("assertReceptionLotReview(draft)")<assignment.indexOf("confirmReception(host,data,draft,callbacks)"));
  assert.match(confirmation,/receptionLotNumbers:reviewedLots\[index\]/);
  assert.match(confirmation,/receptionLotReviewed:true/);
  assert.match(migration,/jsonb_array_length\(v_lots\)/);
  assert.match(migration,/trg_reception_required_documentary_lots/);
  // Un navegador antiguo sin estos dos campos continúa sin caída de recepción;
  // cualquier carga de la versión nueva queda validada por la base de datos.
  assert.match(migration,/not \(new\.metadata \? 'receptionLotNumbers'\)/);
  assert.match(migration,/not \(new\.metadata \? 'receptionLotReviewed'\)/);
  assert.match(migration,/receptionActive/);
  assert.match(migration,/confirmedAt/);
});
