/* CRM Suministros · Receiving Popups V11.29.1
   Ajuste estrictamente limitado a pop-ups de Recepción.
   No modifica la vista principal, RPC, datos, permisos ni handlers. */

const STYLE_ID="receiving-workspace-v11290";

if(!document.getElementById(STYLE_ID)){
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=String.raw`
/* ===== Pop-up: selección/origen PVE ===== */
#modal-root .modal:has(.v115-dialog-intro){
  width:min(1180px,calc(100vw - 48px));
  max-height:calc(100dvh - 46px);
}
#modal-root .modal:has(.v115-dialog-intro) .v115-dialog-intro{padding:19px 21px}
#modal-root .modal:has(.v115-dialog-intro) .v115-source-choice{gap:12px}
#modal-root .modal:has(.v115-dialog-intro) .v115-source-choice span{
  min-height:105px;
  justify-content:center;
  padding:18px;
}
#modal-root .modal:has(.v115-dialog-intro) .v115-pve-list{max-height:440px}
#modal-root .modal:has(.v115-dialog-intro) .v115-pve-card{
  grid-template-columns:20px minmax(250px,1.15fr) minmax(290px,1fr) auto;
  gap:15px;
  padding:14px 15px;
}

/* ===== Pop-up: nueva recepción de mercancía ===== */
#modal-root .modal:has(.v115-receipt-banner){
  width:min(1420px,calc(100vw - 42px));
  max-height:calc(100dvh - 36px);
}
#modal-root .modal:has(.v115-receipt-banner) .modal-head{
  min-height:76px;
  padding-inline:24px;
}
#modal-root .modal:has(.v115-receipt-banner) .modal-head h3{font-size:19px}
#modal-root .modal:has(.v115-receipt-banner) .modal-body{padding:22px 24px 25px}
#modal-root .modal:has(.v115-receipt-banner) .v115-receipt-banner{
  padding:20px 22px;
  margin-bottom:16px;
}
#modal-root .modal:has(.v115-receipt-banner) .v115-receipt-banner strong{font-size:22px}
#modal-root .modal:has(.v115-receipt-banner) .v115-receipt-status{
  gap:11px;
  margin-bottom:16px;
}
#modal-root .modal:has(.v115-receipt-banner) .v115-receipt-status span{
  min-height:76px;
  align-content:center;
  padding:14px 16px;
}
#modal-root .modal:has(.v115-receipt-banner) .v115-receipt-status b{font-size:14px}
#modal-root .modal:has(.v115-receipt-banner) .v115-form-section{
  gap:15px;
  margin-top:15px;
  padding:19px 20px 20px;
  border-radius:15px;
  background:#f9fbfd;
}
#modal-root .modal:has(.v115-receipt-banner) .v115-form-section>header{
  padding-bottom:12px;
  border-bottom:1px solid #e3e9ef;
}
#modal-root .modal:has(.v115-receipt-banner) .v115-form-section>header>span{
  width:34px;
  height:34px;
  border-radius:10px;
}
#modal-root .modal:has(.v115-receipt-banner) .v115-form-section header strong{font-size:16px}
#modal-root .modal:has(.v115-receipt-banner) .v115-form-section header small{font-size:10px}
#modal-root .modal:has(.v115-receipt-banner) .v115-receipt-status + .v115-form-section .form-grid{
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:12px 14px;
}
#modal-root .modal:has(.v115-receipt-banner) .v115-form-section:has([name="noveltyType"]) .form-grid{
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px 14px;
}
#modal-root .modal:has(.v115-receipt-banner) .v115-form-section .field{margin-bottom:0}
#modal-root .modal:has(.v115-receipt-banner) .v115-form-section .control{min-height:44px}
#modal-root .modal:has(.v115-receipt-banner) .v115-form-section textarea.control{min-height:92px}
#modal-root .modal:has(.v115-receipt-banner) .v115-goods-lines{gap:11px}
#modal-root .modal:has(.v115-receipt-banner) .v115-goods-line{
  grid-template-columns:34px minmax(300px,1.45fr) minmax(265px,.9fr) minmax(230px,.8fr) 36px;
  gap:12px;
  padding:14px;
  border-radius:13px;
  background:#fff;
  box-shadow:0 3px 10px rgba(16,42,70,.035);
}
#modal-root .modal:has(.v115-receipt-banner) .v115-line-number{width:31px;height:31px}
#modal-root .modal:has(.v115-receipt-banner) .v115-line-qty,
#modal-root .modal:has(.v115-receipt-banner) .v115-line-lot{gap:8px}
#modal-root .modal:has(.v115-receipt-banner) .v115-line-qty label,
#modal-root .modal:has(.v115-receipt-banner) .v115-line-lot label{
  font-size:8.5px;
  letter-spacing:.02em;
}
#modal-root .modal:has(.v115-receipt-banner) .v115-verified{
  min-height:58px;
  align-items:center;
  padding:13px 15px;
}

/* ===== Pop-up: detalle de recepción ===== */
#modal-root .modal:has(.v115-detail-hero){
  width:min(1420px,calc(100vw - 42px));
  max-height:calc(100dvh - 36px);
}
#modal-root .modal:has(.v115-detail-hero) .modal-head{
  min-height:76px;
  padding-inline:24px;
}
#modal-root .modal:has(.v115-detail-hero) .modal-head h3{font-size:19px}
#modal-root .modal:has(.v115-detail-hero) .modal-body{padding:22px 24px 25px}
#modal-root .modal:has(.v115-detail-hero) .v115-detail-hero{
  padding:20px 22px;
  margin-bottom:15px;
}
#modal-root .modal:has(.v115-detail-hero) .v115-detail-hero strong{font-size:25px}
#modal-root .modal:has(.v115-detail-hero) .v115-detail-grid{
  grid-template-columns:repeat(6,minmax(0,1fr));
  gap:9px;
  margin-bottom:14px;
}
#modal-root .modal:has(.v115-detail-hero) .v115-detail-grid article{
  min-height:70px;
  align-content:center;
  padding:11px 12px;
}
#modal-root .modal:has(.v115-detail-hero) .v115-detail-lines table{min-width:980px}

@media(max-width:1450px){
  #modal-root .modal:has(.v115-detail-hero) .v115-detail-grid{
    grid-template-columns:repeat(3,minmax(0,1fr));
  }
}
@media(max-width:1180px){
  #modal-root .modal:has(.v115-receipt-banner) .v115-receipt-status + .v115-form-section .form-grid{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
  #modal-root .modal:has(.v115-receipt-banner) .v115-goods-line{
    grid-template-columns:34px minmax(0,1fr) 36px;
  }
  #modal-root .modal:has(.v115-receipt-banner) .v115-line-qty,
  #modal-root .modal:has(.v115-receipt-banner) .v115-line-lot{grid-column:2}
}
@media(max-width:820px){
  #modal-root .modal:has(.v115-dialog-intro),
  #modal-root .modal:has(.v115-receipt-banner),
  #modal-root .modal:has(.v115-detail-hero){
    width:100%;
    max-height:calc(100dvh - 16px);
  }
  #modal-root .modal:has(.v115-receipt-banner) .v115-form-section:has([name="noveltyType"]) .form-grid,
  #modal-root .modal:has(.v115-receipt-banner) .v115-receipt-status + .v115-form-section .form-grid,
  #modal-root .modal:has(.v115-detail-hero) .v115-detail-grid{grid-template-columns:1fr}
  #modal-root .modal:has(.v115-dialog-intro) .v115-pve-card{grid-template-columns:18px 1fr}
  #modal-root .modal:has(.v115-dialog-intro) .v115-pve-card>div:nth-of-type(2),
  #modal-root .modal:has(.v115-dialog-intro) .v115-pve-card em{grid-column:2}
}
@media(max-width:520px){
  #modal-root .modal:has(.v115-receipt-banner) .v115-line-qty,
  #modal-root .modal:has(.v115-receipt-banner) .v115-line-lot{grid-template-columns:1fr}
}
`;
  document.head.append(style);
}
