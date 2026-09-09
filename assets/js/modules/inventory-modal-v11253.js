import {state} from "../core/state.js";

const STYLE_ID="inventory-modal-styles-v11253";
const VARIANTS=["count","review","stock","plan","scanner","labels","identified","sync","generic"];

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
  #modal-root .modal-overlay.inventory-modal-overlay-v11253{padding:24px;background:rgba(4,20,38,.70);backdrop-filter:blur(9px) saturate(1.03)}
  #modal-root .modal.inventory-modal-v11253{width:min(1480px,calc(100vw - 48px))!important;height:min(920px,calc(100dvh - 48px));max-width:none!important;max-height:none!important;border:1px solid #c4d3e1;border-radius:18px;background:#fff;box-shadow:0 38px 100px rgba(1,18,35,.42),0 12px 30px rgba(2,40,76,.17);overflow:hidden}
  #modal-root .inventory-modal-v11253.inventory-modal-scanner-v11253{width:min(1260px,calc(100vw - 48px))!important;height:min(820px,calc(100dvh - 48px))}
  #modal-root .inventory-modal-v11253.inventory-modal-sync-v11253{width:min(980px,calc(100vw - 48px))!important;height:auto;max-height:calc(100dvh - 48px)!important}
  #modal-root .inventory-modal-v11253.inventory-modal-identified-v11253{width:min(1180px,calc(100vw - 48px))!important;height:auto;max-height:calc(100dvh - 48px)!important}
  #modal-root .inventory-modal-v11253 .modal-head{flex:0 0 auto;min-height:82px;padding:18px 22px 18px 26px;border-bottom:1px solid #dce5ed;background:linear-gradient(135deg,#fff 0%,#f7fbff 72%,#eef6fd 100%);box-shadow:inset 5px 0 0 #0b65c7}
  #modal-root .inventory-modal-v11253 .modal-title-group{min-width:0;display:grid;gap:3px}
  #modal-root .inventory-modal-v11253 .modal-head h3{margin:0;color:#102f55;font-size:clamp(19px,1.7vw,25px);line-height:1.2;letter-spacing:-.025em;white-space:normal;overflow-wrap:anywhere}
  #modal-root .inventory-modal-v11253 .modal-head p{max-width:980px;margin:0;color:#65778a;font-size:11px;line-height:1.45;white-space:normal;overflow-wrap:anywhere}
  #modal-root .inventory-modal-v11253 .modal-head .icon-close{flex:0 0 42px;width:42px;height:42px;border-radius:11px}
  #modal-root .inventory-modal-v11253 .modal-body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:22px 24px 26px;background:linear-gradient(180deg,#f7f9fc,#fbfcfe);scrollbar-width:thin}
  #modal-root .inventory-modal-v11253 .modal-foot{flex:0 0 auto;min-height:64px;padding:12px 18px;border-top:1px solid #dce5ed;background:rgba(255,255,255,.98);box-shadow:0 -8px 24px rgba(16,42,70,.055);gap:9px}
  #modal-root .inventory-modal-v11253 .modal-foot .btn{min-width:138px;min-height:42px;white-space:normal;line-height:1.25}
  #modal-root .inventory-modal-v11253 .modal-body *,#modal-root .inventory-modal-v11253 .modal-foot *{box-sizing:border-box;min-width:0}
  #modal-root .inventory-modal-v11253 p,#modal-root .inventory-modal-v11253 span,#modal-root .inventory-modal-v11253 small,#modal-root .inventory-modal-v11253 strong,#modal-root .inventory-modal-v11253 b,#modal-root .inventory-modal-v11253 em,#modal-root .inventory-modal-v11253 code,#modal-root .inventory-modal-v11253 label{max-width:100%;overflow-wrap:anywhere;word-break:normal;white-space:normal}
  #modal-root .inventory-modal-v11253 code{word-break:break-all}
  #modal-root .inventory-modal-v11253 .btn{white-space:normal;text-align:center}
  #modal-root .inventory-modal-v11253 .control{min-width:0;width:100%}

  #modal-root .inventory-modal-v11253 .inventory-count-v11109{display:grid;gap:16px;min-width:0}
  #modal-root .inventory-modal-v11253 .inventory-count-v11109>header:not(.inventory-review-hero-v11251){display:grid;gap:4px;padding:18px 20px;border:1px solid #dce6ef;border-left:5px solid #0b65c7;border-radius:14px;background:#fff;box-shadow:0 5px 16px rgba(20,55,90,.04)}
  #modal-root .inventory-modal-v11253 .inventory-count-v11109>header:not(.inventory-review-hero-v11251)>span{color:#0b65c7;font-size:9px;font-weight:900;letter-spacing:.10em;text-transform:uppercase}
  #modal-root .inventory-modal-v11253 .inventory-count-v11109>header:not(.inventory-review-hero-v11251)>strong{color:#173b63;font-size:20px;line-height:1.25}
  #modal-root .inventory-modal-v11253 .inventory-count-v11109>header:not(.inventory-review-hero-v11251)>p{margin:0;color:#65778a;font-size:12px;line-height:1.5}
  #modal-root .inventory-modal-v11253 .inventory-source-bar-v11109{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px 16px;border:1px solid #d7e5f2;border-radius:13px;background:#f1f7fd}
  #modal-root .inventory-modal-v11253 .inventory-source-main-v11109{min-width:0;display:flex;align-items:center;gap:11px}
  #modal-root .inventory-modal-v11253 .inventory-source-main-v11109>span{flex:0 0 34px;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#0b65c7;color:#fff;font-weight:900}
  #modal-root .inventory-modal-v11253 .inventory-source-main-v11109>div{display:grid;gap:2px;min-width:0}
  #modal-root .inventory-modal-v11253 .inventory-source-main-v11109 strong{font-size:12px;color:#20486f}
  #modal-root .inventory-modal-v11253 .inventory-source-main-v11109 small{font-size:10.5px;color:#687b8f;line-height:1.45}
  #modal-root .inventory-modal-v11253 .inventory-summary-v11109{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important;gap:10px!important;min-width:0}
  #modal-root .inventory-modal-v11253 .inventory-summary-item-v11109{min-width:0}

  #modal-root .inventory-modal-count-v11253 .inventory-lot-list-shell-v11109{display:grid;gap:9px;min-width:0}
  #modal-root .inventory-modal-count-v11253 .inventory-lot-row-v11109{display:grid!important;grid-template-columns:minmax(240px,1.05fr) minmax(300px,1.28fr) minmax(190px,.62fr)!important;gap:12px!important;align-items:center!important;padding:13px 14px!important;border:1px solid #dfe7ee!important;border-radius:13px!important;background:#fff!important;box-shadow:0 3px 10px rgba(20,55,90,.035)!important;min-width:0}
  #modal-root .inventory-modal-count-v11253 .inventory-lot-id-v11109,#modal-root .inventory-modal-count-v11253 .inventory-lot-location-v11109,#modal-root .inventory-modal-count-v11253 .inventory-lot-qty-v11109{display:grid!important;gap:3px!important;min-width:0!important}
  #modal-root .inventory-modal-count-v11253 .inventory-lot-id-v11109 small,#modal-root .inventory-modal-count-v11253 .inventory-lot-location-v11109 small,#modal-root .inventory-modal-count-v11253 .inventory-lot-qty-v11109 small{font-size:9px!important;font-weight:900!important;color:#7b8998!important;text-transform:uppercase!important}
  #modal-root .inventory-modal-count-v11253 .inventory-lot-id-v11109 strong,#modal-root .inventory-modal-count-v11253 .inventory-lot-location-v11109 strong{font-size:12px!important;line-height:1.35!important;color:#274766!important}
  #modal-root .inventory-modal-count-v11253 .inventory-lot-id-v11109 span,#modal-root .inventory-modal-count-v11253 .inventory-lot-location-v11109 span{font-size:10px!important;line-height:1.4!important;color:#718093!important}
  #modal-root .inventory-modal-count-v11253 .inventory-lot-qty-v11109{grid-template-columns:minmax(0,1fr) auto!important;align-items:end!important}
  #modal-root .inventory-modal-count-v11253 .inventory-lot-qty-v11109 small{grid-column:1/-1!important}
  #modal-root .inventory-modal-count-v11253 .inventory-lot-qty-v11109 input{min-height:46px!important;font-size:15px!important;font-weight:800!important;text-align:right!important}
  #modal-root .inventory-modal-count-v11253 .inventory-lot-qty-v11109>span{padding-bottom:12px;color:#526a80;font-weight:850}
  #modal-root .inventory-modal-count-v11253 .field{margin:0;padding:14px;border:1px solid #e0e7ee;border-radius:13px;background:#fff}
  #modal-root .inventory-modal-count-v11253 .v116-origin-note{display:grid;gap:3px;padding:13px 15px;border-left:4px solid #0d7a53;border-radius:10px;background:#eef9f4;color:#245f47}

  #modal-root .inventory-modal-review-v11253 .inventory-review-hero-v11251{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(170px,auto)!important;gap:18px!important;align-items:center!important;padding:18px 20px!important;border-radius:14px!important}
  #modal-root .inventory-modal-review-v11253 .inventory-review-hero-v11251>div{min-width:0}
  #modal-root .inventory-modal-review-v11253 .inventory-review-hero-v11251 aside{min-width:0;text-align:right}
  #modal-root .inventory-modal-review-v11253 .inventory-comparison-list-v11251{display:grid;gap:8px;min-width:0}
  #modal-root .inventory-modal-review-v11253 .inventory-comparison-row-v11251{display:grid!important;grid-template-columns:minmax(230px,1.35fr) repeat(4,minmax(115px,.72fr)) minmax(150px,.85fr)!important;gap:8px!important;align-items:stretch!important;padding:10px!important;border:1px solid #dfe7ee!important;border-radius:13px!important;background:#fff!important;min-width:0}
  #modal-root .inventory-modal-review-v11253 .inventory-comparison-id-v11251,#modal-root .inventory-modal-review-v11253 .inventory-comparison-cell-v11251,#modal-root .inventory-modal-review-v11253 .inventory-comparison-delta-v11251{min-width:0!important;padding:8px 9px!important}
  #modal-root .inventory-modal-review-v11253 .inventory-comparison-cell-v11251{border-left:1px solid #edf1f4}
  #modal-root .inventory-modal-review-v11253 .inventory-decision-v11251{position:relative;display:grid;gap:11px;padding:15px 16px;border:1px solid #dce6ef;border-radius:14px;background:#fff}
  #modal-root .inventory-modal-review-v11253 .inventory-decision-v11251 textarea{min-height:92px}
  #modal-root .inventory-modal-review-v11253 .inventory-decision-actions-v11251{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}
  #modal-root .inventory-modal-review-v11253 .inventory-decision-actions-v11251 .btn{min-width:150px}
  #modal-root .inventory-modal-review-v11253 .module-error{border:1px solid #efc8c8;border-left:5px solid #b5263b;border-radius:12px;background:#fff4f5}

  #modal-root .inventory-modal-v11253 .v115-detail-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important;gap:9px!important;min-width:0}
  #modal-root .inventory-modal-v11253 .v115-detail-grid article{min-width:0;padding:12px!important}
  #modal-root .inventory-modal-v11253 .v115-goods-list{display:grid;gap:9px;min-width:0}
  #modal-root .inventory-modal-v11253 .v115-goods-row{display:grid!important;grid-template-columns:minmax(220px,1.05fr) minmax(330px,1.45fr) minmax(165px,.68fr) minmax(120px,auto)!important;gap:12px!important;align-items:stretch!important;min-width:0!important;padding:13px 14px!important}
  #modal-root .inventory-modal-v11253 .v115-goods-row.no-actions{grid-template-columns:minmax(220px,1.05fr) minmax(330px,1.45fr) minmax(180px,.75fr)!important}
  #modal-root .inventory-modal-v11253 .v115-goods-row.no-meta.no-actions{grid-template-columns:minmax(0,1fr) minmax(180px,.55fr)!important}
  #modal-root .inventory-modal-v11253 .v115-goods-row.no-status.no-actions{grid-template-columns:minmax(0,1fr)!important}
  #modal-root .inventory-modal-v11253 .v115-goods-id,#modal-root .inventory-modal-v11253 .v115-goods-meta,#modal-root .inventory-modal-v11253 .v115-goods-link{min-width:0!important}
  #modal-root .inventory-modal-v11253 .v115-goods-id strong,#modal-root .inventory-modal-v11253 .v115-goods-id small,#modal-root .inventory-modal-v11253 .v115-goods-meta b,#modal-root .inventory-modal-v11253 .v115-goods-meta small,#modal-root .inventory-modal-v11253 .v115-goods-link strong,#modal-root .inventory-modal-v11253 .v115-goods-link em{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere!important;line-height:1.35!important}
  #modal-root .inventory-modal-v11253 .v115-goods-meta{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;align-content:center!important}
  #modal-root .inventory-modal-v11253 .v115-goods-link{align-content:center!important}
  #modal-root .inventory-modal-v11253 .v115-goods-row>.page-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:7px!important;flex-wrap:wrap!important}

  #modal-root .inventory-modal-scanner-v11253 .v116-scan-intro{display:grid;gap:4px;margin-bottom:16px;padding:15px 17px;border:1px solid #d9e6f2;border-left:5px solid #0b65c7;border-radius:13px;background:#f5faff}
  #modal-root .inventory-modal-scanner-v11253 .v116-scan-intro span{font-size:9px;font-weight:900;letter-spacing:.1em;color:#0b65c7}
  #modal-root .inventory-modal-scanner-v11253 .v116-scan-intro strong{font-size:18px;color:#173b63}
  #modal-root .inventory-modal-scanner-v11253 .v116-scan-intro p{margin:0;color:#65778a;line-height:1.5}
  #modal-root .inventory-modal-scanner-v11253 .v116-scanner-shell{display:grid!important;grid-template-columns:minmax(0,1.55fr) minmax(320px,.72fr)!important;gap:18px!important;align-items:stretch!important;min-width:0}
  #modal-root .inventory-modal-scanner-v11253 .v116-camera{position:relative;min-height:460px;overflow:hidden;border:1px solid #cbd8e4;border-radius:16px;background:#081b31}
  #modal-root .inventory-modal-scanner-v11253 .v116-camera video{display:block;width:100%;height:100%;min-height:460px;object-fit:cover}
  #modal-root .inventory-modal-scanner-v11253 .v116-scan-side{display:grid!important;align-content:start!important;gap:11px!important;padding:16px!important;border:1px solid #dce5ed!important;border-radius:15px!important;background:#fff!important;min-width:0}
  #modal-root .inventory-modal-scanner-v11253 .v116-scan-side .field{margin:0}
  #modal-root .inventory-modal-scanner-v11253 .v116-scan-help{padding:13px;border-radius:11px;background:#f3f7fb;color:#5e7287}

  #modal-root .inventory-modal-labels-v11253 .v116-label-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:16px!important;align-items:center!important;padding:15px 17px!important;margin-bottom:14px!important;border:1px solid #dce5ed!important;border-radius:14px!important;background:#fff!important}
  #modal-root .inventory-modal-labels-v11253 .v116-label-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;min-width:0}
  #modal-root .inventory-modal-labels-v11253 .v116-label-card{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(180px,.7fr)!important;gap:10px!important;align-items:center!important;padding:14px!important;min-width:0!important;border:1px solid #dfe7ee!important;border-radius:14px!important;background:#fff!important}
  #modal-root .inventory-modal-labels-v11253 .v116-code-preview{min-width:0;overflow:hidden}
  #modal-root .inventory-modal-labels-v11253 .v116-code-preview svg,#modal-root .inventory-modal-labels-v11253 .v116-code-preview img{max-width:100%;height:auto}
  #modal-root .inventory-modal-labels-v11253 .v116-label-card code,#modal-root .inventory-modal-labels-v11253 .v116-label-card .btn{grid-column:1/-1}

  #modal-root .inventory-modal-identified-v11253 .v116-found-hero{display:grid;gap:4px;padding:17px 19px;border-radius:14px;background:linear-gradient(135deg,#073b78,#0d67ae);color:#fff}
  #modal-root .inventory-modal-identified-v11253 .v116-found-hero h3{margin:0;color:#fff;font-size:17px;overflow-wrap:anywhere}
  #modal-root .inventory-modal-identified-v11253 .v116-found-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:9px!important;margin:14px 0!important}
  #modal-root .inventory-modal-identified-v11253 .v116-found-grid article{display:grid;gap:3px;padding:12px;border:1px solid #dfe7ee;border-radius:12px;background:#fff;min-width:0}
  #modal-root .inventory-modal-identified-v11253 .v116-result-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:14px}
  #modal-root .inventory-modal-identified-v11253 .v116-origin-note{padding:12px 14px;border-radius:11px;background:#eef6ff}

  #modal-root .inventory-modal-sync-v11253 .inventory-count-v11109{gap:14px}
  #modal-root .inventory-modal-sync-v11253 .field{margin:0;padding:16px;border:1px dashed #aac3d9;border-radius:14px;background:#f8fbfe}
  #modal-root .inventory-modal-sync-v11253 input[type=file]{min-height:48px;padding:10px;background:#fff}
  #modal-root .inventory-modal-sync-v11253 [data-run]{width:max-content;min-width:190px}
  #modal-root .inventory-modal-sync-v11253 [data-progress]{min-height:0}

  @media(max-width:1200px){
    #modal-root .modal.inventory-modal-v11253{width:calc(100vw - 30px)!important;height:calc(100dvh - 30px)}
    #modal-root .inventory-modal-review-v11253 .inventory-comparison-row-v11251{grid-template-columns:minmax(220px,1.2fr) repeat(3,minmax(110px,.72fr))!important}
    #modal-root .inventory-modal-review-v11253 .inventory-comparison-row-v11251>.inventory-comparison-cell-v11251:nth-of-type(5),#modal-root .inventory-modal-review-v11253 .inventory-comparison-delta-v11251{grid-column:auto}
    #modal-root .inventory-modal-v11253 .v115-goods-row,#modal-root .inventory-modal-v11253 .v115-goods-row.no-actions{grid-template-columns:minmax(0,1fr) minmax(170px,.42fr)!important}
    #modal-root .inventory-modal-v11253 .v115-goods-meta{grid-column:1/-1!important;grid-row:2!important}
    #modal-root .inventory-modal-v11253 .v115-goods-link{grid-column:1!important;grid-row:3!important}
    #modal-root .inventory-modal-v11253 .v115-goods-row>.page-actions{grid-column:2!important;grid-row:1!important}
  }
  @media(max-width:900px){
    #modal-root .modal-overlay.inventory-modal-overlay-v11253{padding:10px}
    #modal-root .modal.inventory-modal-v11253,#modal-root .modal.inventory-modal-v11253.inventory-modal-scanner-v11253,#modal-root .modal.inventory-modal-v11253.inventory-modal-sync-v11253,#modal-root .modal.inventory-modal-v11253.inventory-modal-identified-v11253{width:calc(100vw - 20px)!important;height:calc(100dvh - 20px);max-height:none!important;border-radius:14px}
    #modal-root .inventory-modal-v11253 .modal-head{min-height:72px;padding:15px 16px 15px 20px}
    #modal-root .inventory-modal-v11253 .modal-body{padding:15px}
    #modal-root .inventory-modal-count-v11253 .inventory-lot-row-v11109{grid-template-columns:minmax(0,1fr) minmax(200px,.72fr)!important}
    #modal-root .inventory-modal-count-v11253 .inventory-lot-location-v11109{grid-column:1}
    #modal-root .inventory-modal-count-v11253 .inventory-lot-qty-v11109{grid-column:2;grid-row:1/3}
    #modal-root .inventory-modal-review-v11253 .inventory-review-hero-v11251{grid-template-columns:1fr!important}
    #modal-root .inventory-modal-review-v11253 .inventory-review-hero-v11251 aside{text-align:left!important}
    #modal-root .inventory-modal-review-v11253 .inventory-comparison-row-v11251{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    #modal-root .inventory-modal-review-v11253 .inventory-comparison-id-v11251{grid-column:1/-1!important}
    #modal-root .inventory-modal-scanner-v11253 .v116-scanner-shell{grid-template-columns:1fr!important}
    #modal-root .inventory-modal-scanner-v11253 .v116-camera,#modal-root .inventory-modal-scanner-v11253 .v116-camera video{min-height:330px}
    #modal-root .inventory-modal-labels-v11253 .v116-label-grid{grid-template-columns:1fr!important}
    #modal-root .inventory-modal-identified-v11253 .v116-found-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  }
  @media(max-width:620px){
    #modal-root .modal-overlay.inventory-modal-overlay-v11253{padding:0}
    #modal-root .modal.inventory-modal-v11253,#modal-root .modal.inventory-modal-v11253.inventory-modal-scanner-v11253,#modal-root .modal.inventory-modal-v11253.inventory-modal-sync-v11253,#modal-root .modal.inventory-modal-v11253.inventory-modal-identified-v11253{width:100vw!important;height:100dvh;max-height:100dvh!important;border:0;border-radius:0}
    #modal-root .inventory-modal-v11253 .modal-head{min-height:66px;padding:12px 12px 12px 16px}
    #modal-root .inventory-modal-v11253 .modal-head h3{font-size:18px}
    #modal-root .inventory-modal-v11253 .modal-body{padding:11px}
    #modal-root .inventory-modal-v11253 .modal-foot{display:grid!important;grid-template-columns:1fr!important;padding:9px 11px calc(9px + env(safe-area-inset-bottom))}
    #modal-root .inventory-modal-v11253 .modal-foot .btn{width:100%;min-width:0}
    #modal-root .inventory-modal-count-v11253 .inventory-lot-row-v11109{grid-template-columns:1fr!important;padding:11px!important}
    #modal-root .inventory-modal-count-v11253 .inventory-lot-id-v11109,#modal-root .inventory-modal-count-v11253 .inventory-lot-location-v11109,#modal-root .inventory-modal-count-v11253 .inventory-lot-qty-v11109{grid-column:1!important;grid-row:auto!important}
    #modal-root .inventory-modal-review-v11253 .inventory-comparison-row-v11251{grid-template-columns:1fr!important}
    #modal-root .inventory-modal-review-v11253 .inventory-comparison-id-v11251{grid-column:1!important}
    #modal-root .inventory-modal-review-v11253 .inventory-comparison-cell-v11251{border-left:0!important;border-top:1px solid #edf1f4}
    #modal-root .inventory-modal-review-v11253 .inventory-decision-actions-v11251{display:grid!important;grid-template-columns:1fr!important}
    #modal-root .inventory-modal-review-v11253 .inventory-decision-actions-v11251 .btn{width:100%;min-width:0}
    #modal-root .inventory-modal-v11253 .v115-goods-row,#modal-root .inventory-modal-v11253 .v115-goods-row.no-actions,#modal-root .inventory-modal-v11253 .v115-goods-row.no-meta.no-actions{grid-template-columns:1fr!important}
    #modal-root .inventory-modal-v11253 .v115-goods-id,#modal-root .inventory-modal-v11253 .v115-goods-meta,#modal-root .inventory-modal-v11253 .v115-goods-link,#modal-root .inventory-modal-v11253 .v115-goods-row>.page-actions{grid-column:1!important;grid-row:auto!important}
    #modal-root .inventory-modal-v11253 .v115-goods-meta{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    #modal-root .inventory-modal-v11253 .v115-goods-row>.page-actions{justify-content:stretch!important}
    #modal-root .inventory-modal-v11253 .v115-goods-row>.page-actions .btn{width:100%}
    #modal-root .inventory-modal-scanner-v11253 .v116-camera,#modal-root .inventory-modal-scanner-v11253 .v116-camera video{min-height:260px}
    #modal-root .inventory-modal-labels-v11253 .v116-label-head{grid-template-columns:1fr!important}
    #modal-root .inventory-modal-labels-v11253 .v116-label-head .btn{width:100%}
    #modal-root .inventory-modal-labels-v11253 .v116-label-card{grid-template-columns:1fr!important}
    #modal-root .inventory-modal-labels-v11253 .v116-label-card>*{grid-column:1!important}
    #modal-root .inventory-modal-identified-v11253 .v116-found-grid{grid-template-columns:1fr!important}
    #modal-root .inventory-modal-identified-v11253 .v116-result-actions{display:grid;grid-template-columns:1fr}
    #modal-root .inventory-modal-identified-v11253 .v116-result-actions .btn{width:100%}
    #modal-root .inventory-modal-sync-v11253 [data-run]{width:100%;min-width:0}
  }
  @media(max-width:420px){#modal-root .inventory-modal-v11253 .v115-goods-meta{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(style);
}

function titleOf(dialog){return (dialog.querySelector(".modal-head h3")?.textContent||"").trim().toLowerCase()}
function inventorySignal(dialog,title){
  const explicit=/^(escanear inventario|inventario identificado|qr y etiquetas de inventario|actualizar maestro siesa|inventario ·|plan ·|etiquetas ·|metraje ·|conteo ·|detalle ·)/i.test(title);
  if(explicit)return true;
  if(state.currentModule!=="inventory")return false;
  return Boolean(dialog.querySelector(".inventory-count-v11109,.inventory-review-hero-v11251,.inventory-comparison-list-v11251,.v116-scanner-shell,.v116-found-hero,.v116-label-grid"));
}
function variantOf(dialog,title){
  if(dialog.querySelector(".inventory-comparison-list-v11251,.inventory-review-hero-v11251"))return "review";
  if(dialog.querySelector(".inventory-lot-list-shell-v11109")||/^(metraje|conteo) ·/i.test(title))return "count";
  if(dialog.querySelector(".v116-scanner-shell")||/^escanear inventario$/i.test(title))return "scanner";
  if(dialog.querySelector(".v116-found-hero")||/^inventario identificado$/i.test(title))return "identified";
  if(dialog.querySelector(".v116-label-grid")||/^(qr y etiquetas de inventario|etiquetas ·)/i.test(title))return "labels";
  if(/^actualizar maestro siesa$/i.test(title))return "sync";
  if(/^plan ·/i.test(title))return "plan";
  if(/^inventario ·/i.test(title))return "stock";
  return "generic";
}
function enhanceDialog(dialog){
  if(!(dialog instanceof HTMLElement))return;
  const title=titleOf(dialog);
  if(!inventorySignal(dialog,title))return;
  installStyles();
  dialog.classList.add("inventory-modal-v11253");
  VARIANTS.forEach(v=>dialog.classList.remove(`inventory-modal-${v}-v11253`));
  const variant=variantOf(dialog,title);
  dialog.classList.add(`inventory-modal-${variant}-v11253`);
  dialog.dataset.inventoryModal="v11.25.3";
  const overlay=dialog.closest(".modal-overlay");
  overlay?.classList.add("inventory-modal-overlay-v11253");
  dialog.querySelector(".modal-body")?.setAttribute("data-inventory-modal-body",variant);
}
function scan(){
  const root=document.querySelector("#modal-root");
  if(!root)return;
  root.querySelectorAll(".modal").forEach(enhanceDialog);
}

export function installInventoryModalSystemV11253(){
  installStyles();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  if(root.dataset.inventoryModalObserver==="v11253"){scan();return}
  root.dataset.inventoryModalObserver="v11253";
  const observer=new MutationObserver(()=>queueMicrotask(scan));
  observer.observe(root,{childList:true,subtree:true,characterData:true});
  scan();
}

installInventoryModalSystemV11253();
