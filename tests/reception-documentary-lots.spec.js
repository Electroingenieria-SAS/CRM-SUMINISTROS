import {test,expect} from "@playwright/test";

test("Recepción obliga a revisar los lotes de cada material y mantiene la corrección manual",async({page})=>{
  await page.goto("/");
  await page.evaluate(async()=>{
    const {receptionLotReviewCards,bindReceptionLotReviewCards,assertReceptionLotReview}=
      await import("/assets/js/domains/receiving/order/assignment/lot-review.js");
    const lines=[
      {reference:"TUBO-01",description:"Tubo PVC",quantity:3,unit:"UND",lotNumbers:["PDF-01"],lotSource:"PDF",lotReviewed:false},
      {reference:"CABLE-02",description:"Cable para corte",quantity:4,unit:"M",requiresCut:true,lotNumbers:[],lotSource:"MANUAL",lotReviewed:false}
    ];
    const host=document.querySelector("#modal-root");
    host.innerHTML='<div class="modal-overlay"><section class="modal reception-process-modal receiving-order-focus popup-ux-v1190"><div class="modal-body reception-process-body">'+receptionLotReviewCards(lines)+'</div></section></div>';
    window.__lotDraft={lines};
    window.__lotAssert=assertReceptionLotReview;
    bindReceptionLotReviewCards(host,{order:{id:"fixture-lot"}},window.__lotDraft,()=>{});
  });
  const root=page.locator("#modal-root");
  const cards=root.locator("[data-reception-lot-index]");
  await expect(cards).toHaveCount(2);
  await expect(root.locator("[data-lot-review-progress]")).toHaveText("0/2 verificados");
  await expect(cards.nth(0).locator("em")).toContainText("PDF");
  await cards.nth(0).locator("[data-reception-lot-verified]").check();
  await cards.nth(1).locator("[data-reception-lot-input]").fill("CORT-14, CORT-15");
  await cards.nth(1).locator("[data-reception-lot-verified]").check();
  await expect(root.locator("[data-lot-review-progress]")).toHaveText("2/2 verificados");
  expect(await page.evaluate(()=>{try{window.__lotAssert(window.__lotDraft);return true}catch{return false}})).toBe(true);
  await cards.nth(0).locator("[data-reception-lot-input]").fill("PDF-02");
  await expect(cards.nth(0).locator("[data-reception-lot-verified]")).not.toBeChecked();
  await expect(root.locator("[data-lot-review-progress]")).toHaveText("1/2 verificados");
  expect(await page.evaluate(()=>{try{window.__lotAssert(window.__lotDraft);return true}catch{return false}})).toBe(false);
  await cards.nth(0).locator("[data-reception-lot-verified]").check();
  expect(await page.evaluate(()=>{try{window.__lotAssert(window.__lotDraft);return true}catch{return false}})).toBe(true);
});

test("La revisión de múltiples lotes no desborda 390px",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.evaluate(async()=>{
    const {receptionLotReviewCards}=await import("/assets/js/domains/receiving/order/assignment/lot-review.js");
    document.querySelector("#modal-root").innerHTML='<div class="modal-overlay"><section class="modal reception-process-modal receiving-order-focus popup-ux-v1190"><div class="modal-body reception-process-body">'+receptionLotReviewCards([
      {reference:"REF-0001",description:"Material con descripción de largo considerable",quantity:20,unit:"UND",lotNumbers:["LOT-1001","LOT-1002"],lotSource:"PDF"},
      {reference:"REF-0002",description:"Otro material",quantity:5,unit:"KG",lotNumbers:[],lotSource:"MANUAL"}
    ])+'</div></section></div>';
  });
  const data=await page.locator("#modal-root").evaluate(root=>{
    const rect=root.querySelector(".modal").getBoundingClientRect();
    const docWidth=document.documentElement.clientWidth;
    return {left:rect.left,right:rect.right,width:docWidth,scroll:root.scrollWidth};
  });
  expect(data.left).toBeGreaterThanOrEqual(-1);
  expect(data.right).toBeLessThanOrEqual(data.width+1);
  await expect(page.locator("[data-reception-lot-input]")).toHaveCount(2);
});

test("Corregir incorpora lectura PDF local y del pedido sin abandonar la edición",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.evaluate(async()=>{
    const {editStage}=await import("/assets/js/domains/receiving/order/stages/edit-lines.js");
    const {assignmentStage}=await import("/assets/js/domains/receiving/order/stages/assignment.js");
    const data={order:{id:"qa",order_number:"PVE-QA"},files:[{drive_file_id:"pdf-qa",file_name:"materiales.pdf",mime_type:"application/pdf"}]};
    const draft={stage:"EDIT",sourceFileId:"pdf-qa",sourceFileName:"materiales.pdf",lines:[]};
    const root=document.querySelector("#modal-root");
    root.innerHTML='<div class="modal-overlay"><section class="modal receiving-order receiving-order-focus reception-process-modal popup-ux-v1190"><div class="modal-body reception-process-body">'+editStage(data,draft)+'</div></section></div>';
    window.__receptionPdfAssignmentHtml=assignmentStage(data,draft,[],[]);
  });
  await expect(page.locator("[data-correction-source-pdf]")).toHaveCount(1);
  await expect(page.locator("[data-correction-read-drive]")).toHaveCount(1);
  await expect(page.locator("[data-correction-local-pdf]")).toHaveCount(1);
  const right=await page.locator("[data-correction-pdf-panel]").evaluate(node=>node.getBoundingClientRect().right);
  expect(right).toBeLessThanOrEqual(392);
  const next=await page.evaluate(()=>window.__receptionPdfAssignmentHtml);
  expect(next).toContain("data-correction-local-pdf");
  expect(next).toContain("data-correction-read-drive");
});
