import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=relative=>fs.readFileSync(new URL("../../"+relative,import.meta.url),"utf8");

const pickingFocus=read("assets/css/modules/picking/task-layout-picking-focus.css");
const pickingRoot=read("assets/css/modules/picking/task-layout-modal-root.css");
const pickingReview=read("assets/css/modules/picking/material-review.css");
const pickingOrigin=read("assets/css/modules/picking/material-origin.css");
const billingFocus=read("assets/css/modules/billing/task-layout-billing-focus.css");
const billingRoot=read("assets/css/modules/billing/task-layout-modal-root.css");
const billingRoot2=read("assets/css/modules/billing/task-layout-modal-root-2.css");
const billingUpload=read("assets/css/modules/billing/invoice-upload-modal-root.css")+"\n"+read("assets/css/modules/billing/invoice-upload-modal-root-2.css");
const billingReader=read("assets/css/modules/billing/invoice-reader.css");
const accessibility=read("assets/css/base/accessibility.css")+"\n"+read("assets/css/base/accessible-controls.css");

function selectorPattern(selector){
  return selector
    .replaceAll("\\","\\\\")
    .replaceAll(".","\\.")
    .replaceAll("[","\\[")
    .replaceAll("]","\\]")
    .replaceAll("(","\\(")
    .replaceAll(")","\\)")
    .replaceAll(":","\\:")
    .replaceAll("-","\\-");
}
function noDisplayNone(css,selector){
  assert.doesNotMatch(css,new RegExp(selectorPattern(selector)+"\\s*\\{[^}]*display\\s*:\\s*none","i"),selector);
}

test("Picking responsive contract covers desktop/tablet/mobile and preserves primary CTAs",()=>{
  assert.match(pickingFocus,/@media \(max-width:980px\)/);
  assert.match(pickingFocus,/@media \(max-width:720px\)/);
  assert.match(pickingFocus,/@media \(max-width:430px\)/);
  assert.match(pickingReview,/@media \(max-width:900px\)/);
  assert.match(pickingReview,/@media \(max-width:720px\)/);
  assert.match(pickingReview,/@media \(max-width:430px\)/);
  assert.match(pickingOrigin,/@media \(max-width:900px\)/);
  assert.match(pickingOrigin,/@media \(max-width:620px\)/);

  assert.match(pickingFocus,/\.picking-take-button \{ width:100%; min-width:0; min-height:50px!important;/);
  assert.match(pickingFocus,/\[data-picking-next-v1195\][\s\S]*?width:100%;[\s\S]*?min-height:50px!important;/);
  assert.match(pickingFocus,/\.parallel-work-actions \{ width:100%;[\s\S]*?grid-template-columns:1fr 1fr/);
  assert.match(pickingRoot,/width:min\(1180px,calc\(100vw - 56px\)\)/);
  assert.match(pickingReview,/\.picking-item-row \{ grid-template-columns:1fr!important;/);

  noDisplayNone(pickingFocus,".picking-take-button");
  noDisplayNone(pickingFocus,"[data-picking-next-v1195]");
});

test("Billing responsive contract covers tablet/mobile, upload/reader and preserves primary CTAs",()=>{
  assert.match(billingFocus,/@media \(max-width:900px\)/);
  assert.match(billingFocus,/@media \(max-width:720px\)/);
  assert.match(billingRoot2,/@media \(max-width:430px\)/);
  assert.match(billingUpload,/@media \(max-width:760px\)/);
  assert.match(billingUpload,/@media \(max-width:430px\)/);
  assert.match(billingReader,/@media \(max-width:760px\)/);
  assert.match(billingReader,/@media \(max-width:430px\)/);

  assert.match(billingFocus,/\.billing-task-cta-v1198 \{ grid-column:1\/-1; min-height:50px!important;/);
  assert.match(billingFocus,/\[data-billing-next-v1198\][\s\S]*?width:100%;[\s\S]*?min-height:50px!important;/);
  assert.match(billingRoot2,/\.parallel-work-actions \{ grid-template-columns:1fr;/);
  assert.match(billingUpload,/\.modal-foot \.btn \{ width:100%; min-width:0; min-height:50px!important;/);
  assert.match(billingReader,/\.invoice-reader-field-v1199 \.control \{ font-size:16px!important;/);
  assert.match(billingRoot,/width:min\(1080px,calc\(100vw - 48px\)\)/);

  noDisplayNone(billingFocus,".billing-task-cta-v1198");
  noDisplayNone(billingFocus,"[data-billing-next-v1198]");
  noDisplayNone(billingUpload,".billing-dropzone-v1199");
});

test("critical fixed desktop minimums are released on small screens",()=>{
  assert.match(pickingRoot,/\.picking-take-button \{[\s\S]*?min-width:220px/);
  assert.match(pickingFocus,/\.picking-take-button \{ width:100%; min-width:0;/);
  assert.match(billingRoot,/\.billing-task-cta-v1198 \{[\s\S]*?min-width:180px/);
  assert.match(billingFocus,/\.billing-task-cta-v1198 \{ grid-column:1\/-1; min-height:50px!important;/);
  assert.match(billingFocus,/\.parallel-work-actions \[data-take-another\],[\s\S]*?min-width:0/);
  assert.match(billingUpload,/\.modal-foot \.btn \{ width:100%; min-width:0;/);
});

test("touch and keyboard focus contracts are not hover-only",()=>{
  assert.match(accessibility,/:where\(button,a,input,select,textarea,\[tabindex\]\):focus-visible/);
  assert.match(accessibility,/:where\(\.btn,\.icon-btn,\.nav-item,\.guided-action-card\) \{ touch-action:manipulation; \}/);
  assert.match(accessibility,/@media \(max-width:520px\)[\s\S]*?\.btn \{ min-height:42px; \}/);
  assert.match(accessibility,/@media \(max-width:520px\)[\s\S]*?\.icon-btn \{ min-width:42px; min-height:42px; \}/);
  assert.match(billingUpload,/\.billing-dropzone-v1199:focus-visible/);
  assert.match(billingUpload,/\.billing-file-remove-v1199[\s\S]*?min-height:36px/);
});

test("canonical owners emit every versioned CSS root still used after legacy module retirement",()=>{
  const pickingOwner=read("assets/js/domains/picking/ui/picking-focus.js");
  const billingOwner=read("assets/js/domains/billing/ui/billing-focus.js");
  const uploadOwner=read("assets/js/domains/billing/uploads/upload-experience.js");
  const readerOwner=read("assets/js/domains/billing/invoice-reader/ui/invoice-dialog.js");

  assert.match(pickingOwner,/classList\.add\("picking-focus-v1195"\)/);
  assert.match(pickingOwner,/classList\.add\("picking-review-v1197"\)/);
  assert.match(billingOwner,/classList\.add\("billing-focus-v1198"\)/);
  assert.match(uploadOwner,/classList\.add\("billing-upload-v1199","billing-upload-dialog-v1198"\)/);
  assert.match(readerOwner,/classList\.add\("invoice-reader-v1199","billing-multiformat-v11101"\)/);

  const legacyFiles=[
    "assets/js/modules/picking-focus-v1195.js",
    "assets/js/modules/billing-focus-v1198.js",
    "assets/js/modules/billing-upload-v1199.js",
    "assets/js/modules/billing-multiformat-v11101.js"
  ];
  for(const file of legacyFiles)assert.equal(fs.existsSync(new URL("../../"+file,import.meta.url)),false,file);
});

test("responsive CSS contains no removed legacy module filenames or critical CTA hide rule",()=>{
  const css=[pickingFocus,pickingRoot,pickingReview,pickingOrigin,billingFocus,billingRoot,billingRoot2,billingUpload,billingReader].join("\n");
  assert.doesNotMatch(css,/picking-focus-v1195\.js|billing-focus-v1198\.js|billing-upload-v1199\.js|billing-multiformat-v11101\.js/);
  assert.doesNotMatch(css,/\[data-picking-next-v1195\][^{]*\{[^}]*display\s*:\s*none/i);
  assert.doesNotMatch(css,/\[data-billing-next-v1198\][^{]*\{[^}]*display\s*:\s*none/i);
  assert.doesNotMatch(css,/\.billing-task-cta-v1198[^{]*\{[^}]*display\s*:\s*none/i);
  assert.doesNotMatch(css,/\.billing-dropzone-v1199[^{]*\{[^}]*display\s*:\s*none/i);
});
