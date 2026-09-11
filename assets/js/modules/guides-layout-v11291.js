/* CRM Suministros · capa visual aislada para guías contextuales.
   No modifica flujos, datos, permisos ni lógica operativa. */

const STYLE_ID="guides-layout-v11291-style";
const STYLES=`
#modal-root .modal.guide-modal-v11291{width:min(1380px,calc(100vw - 48px))!important;max-height:min(92dvh,980px)!important}
#modal-root .modal.guide-modal-v11291 .modal-head{min-height:72px;padding:16px 20px 16px 24px}
#modal-root .modal.guide-modal-v11291 .modal-head h3{font-size:19px}
#modal-root .modal.guide-modal-v11291 .modal-body{padding:22px 24px 26px;background:linear-gradient(180deg,#f7fafe 0%,#f4f7fb 100%)}
#modal-root .modal.guide-modal-v11291 .modal-foot{padding:12px 18px}
.guide-modal-v11291 .v113-guide-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:center;padding:22px 24px;border-radius:18px;box-shadow:0 8px 24px rgba(13,72,122,.06)}
.guide-modal-v11291 .v113-guide-hero h4{max-width:980px;margin:6px 0 7px;font-size:22px;line-height:1.3}
.guide-modal-v11291 .v113-guide-hero p{max-width:900px;font-size:12.5px;line-height:1.55}
.guide-modal-v11291 .v113-guide-badge{min-width:104px;padding:15px 14px;border-radius:16px;font-size:13px;box-shadow:0 8px 20px rgba(11,94,157,.14)}
.guide-modal-v11291 .v113-guide-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:22px;margin-top:20px;align-items:start}
.guide-modal-v11291 .v113-guide-section-title{margin-bottom:12px;padding:0 2px}
.guide-modal-v11291 .v113-guide-section-title strong{color:#173a5d;font-size:14px}
.guide-modal-v11291 .v113-guide-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch}
.guide-modal-v11291 .v113-guide-step{min-height:184px;display:flex;flex-direction:column;border-radius:16px;border-color:rgba(20,65,105,.14);box-shadow:0 5px 16px rgba(18,58,96,.045)}
.guide-modal-v11291 .v113-guide-step summary{grid-template-columns:38px minmax(0,1fr) 22px;gap:12px;padding:15px 16px 11px}
.guide-modal-v11291 .v113-guide-step summary>span{width:36px;height:36px;border-radius:11px;font-size:12px}
.guide-modal-v11291 .v113-guide-step summary strong{color:#173a5d;font-size:13px;line-height:1.35}
.guide-modal-v11291 .v113-guide-step summary small{display:none}
.guide-modal-v11291 .v113-guide-step summary>b{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:#edf6fd;color:#0b609f;font-size:12px;transition:transform .16s ease}
.guide-modal-v11291 .v113-guide-step[open] summary>b{transform:rotate(180deg)}
.guide-modal-v11291 .v113-guide-step-body{flex:1;display:flex;flex-direction:column;padding:0 16px 16px 66px}
.guide-modal-v11291 .v113-guide-step-body p{margin:0 0 12px;color:#53677c;font-size:12px;line-height:1.58}
.guide-modal-v11291 .v113-guide-tip{margin-top:auto;padding:10px 12px;border-radius:10px}
.guide-modal-v11291 .v113-guide-tip strong{color:#244d70;font-size:10.5px}
.guide-modal-v11291 .v113-guide-tip span{font-size:10.5px;line-height:1.45}
.guide-modal-v11291 .v113-evidence-panel{top:0;height:max-content;padding:18px;border-radius:17px;box-shadow:0 6px 18px rgba(18,58,96,.045)}
.guide-modal-v11291 .v113-evidence-panel li{gap:9px;padding:8px 0;border-bottom:1px solid #e8eef4;font-size:12px;line-height:1.4}
.guide-modal-v11291 .v113-evidence-panel li:last-child{border-bottom:0}
.guide-modal-v11291 .v113-guide-warning{margin-top:14px;padding:13px}
.guide-modal-v11291 .v115-dialog-intro{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;margin-bottom:18px;padding:19px 21px;border-radius:17px}
.guide-modal-v11291 .v115-dialog-intro strong{font-size:22px}
.guide-modal-v11291 .v115-dialog-intro p{max-width:1050px;font-size:12px;line-height:1.55}
.guide-modal-v11291 .v115-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:stretch}
.guide-modal-v11291 .v115-guide-process{display:flex;flex-direction:column;padding:19px;gap:14px;border-radius:18px;box-shadow:0 6px 20px rgba(18,58,96,.05)}
.guide-modal-v11291 .v115-guide-process>p{margin:0;color:#5f7082;font-size:12px;line-height:1.55}
.guide-modal-v11291 .v115-guide-process ol{counter-reset:v115-guide-step;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:0;padding:0;list-style:none}
.guide-modal-v11291 .v115-guide-process li{counter-increment:v115-guide-step;position:relative;min-width:0;padding:11px 11px 11px 40px;border:1px solid #e2e9f0;border-radius:11px;background:rgba(255,255,255,.86);color:#566779;font-size:11px;line-height:1.48}
.guide-modal-v11291 .v115-guide-process li:before{content:counter(v115-guide-step);position:absolute;left:10px;top:10px;width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:#eaf4fc;color:#0d62a8;font-size:9px;font-weight:900}
.guide-modal-v11291 .v115-guide-process.order li:before{background:#eaf7ef;color:#19734a}
.guide-modal-v11291 .v115-guide-rule{margin-top:auto;padding:12px 13px}
.guide-modal-v11291 .v115-guide-process footer{padding-top:12px}
@media(max-width:1180px){#modal-root .modal.guide-modal-v11291{width:min(1120px,calc(100vw - 32px))!important}.guide-modal-v11291 .v113-guide-layout{grid-template-columns:minmax(0,1fr) 280px}.guide-modal-v11291 .v115-guide-process ol{grid-template-columns:1fr}}
@media(max-width:920px){#modal-root .modal.guide-modal-v11291{width:calc(100vw - 24px)!important;max-height:calc(100dvh - 24px)!important}.guide-modal-v11291 .v113-guide-layout,.guide-modal-v11291 .v115-guide-grid{grid-template-columns:1fr}.guide-modal-v11291 .v113-evidence-panel{position:static}.guide-modal-v11291 .v115-guide-process ol{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){#modal-root .modal.guide-modal-v11291{width:calc(100vw - 16px)!important;max-height:calc(100dvh - 16px)!important}#modal-root .modal.guide-modal-v11291 .modal-body{padding:14px}.guide-modal-v11291 .v113-guide-hero{grid-template-columns:1fr;gap:12px;padding:17px}.guide-modal-v11291 .v113-guide-badge{width:max-content;min-width:0}.guide-modal-v11291 .v113-guide-steps,.guide-modal-v11291 .v115-guide-process ol{grid-template-columns:1fr}.guide-modal-v11291 .v113-guide-step{min-height:0}.guide-modal-v11291 .v113-guide-step-body{padding:0 14px 14px}.guide-modal-v11291 .v115-dialog-intro,.guide-modal-v11291 .v115-guide-process{padding:15px}}
`;

let observer=null;
let scheduled=false;

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=STYLES;
  document.head.append(style);
}

function isGuideDialog(dialog){
  return Boolean(dialog?.querySelector?.(".v113-guide-hero,.v115-guide-grid"));
}

function enhanceGuideDialog(dialog){
  if(!dialog||dialog.dataset.guideLayoutV11291==="1"||!isGuideDialog(dialog))return;
  dialog.dataset.guideLayoutV11291="1";
  dialog.classList.add("guide-modal-v11291");
  dialog.querySelectorAll("details.v113-guide-step").forEach(step=>{step.open=true});
}

function enhanceAll(){
  document.querySelectorAll("#modal-root .modal").forEach(enhanceGuideDialog);
}

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    enhanceAll();
  });
}

function install(){
  ensureStyles();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  enhanceAll();
  observer=new MutationObserver(schedule);
  observer.observe(root,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
else install();
