/* CRM Suministros · Inventory Visual System V11.27.0
   Glow up integral del módulo Inventario sin alterar lógica de negocio.
   Alcance: navegación, cabeceras, KPI, tarjetas, filtros, filas, revisión,
   Pareto, formularios, pop-ups, scanner, etiquetas y estados. */

const STYLE_ID="inventory-visual-v11270";

function installInventoryVisualV11270(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
  .inventory-app-v11251,
  #modal-root .inventory-dialog-v11260{
    --inv-navy:#0b2f57;
    --inv-blue:#0b65c7;
    --inv-blue-2:#1677d2;
    --inv-ink:#17324f;
    --inv-muted:#667b8f;
    --inv-border:#dce6ef;
    --inv-border-strong:#c9d8e6;
    --inv-surface:#ffffff;
    --inv-surface-soft:#f7fafd;
    --inv-surface-blue:#f1f7fd;
    --inv-success:#22724b;
    --inv-success-bg:#edf8f2;
    --inv-warning:#8a621c;
    --inv-warning-bg:#fff8ea;
    --inv-danger:#9a3e3e;
    --inv-danger-bg:#fff1f1;
    --inv-shadow-sm:0 5px 16px rgba(18,55,88,.055);
    --inv-shadow-md:0 12px 32px rgba(18,55,88,.08);
    --inv-shadow-lg:0 22px 58px rgba(8,36,65,.14);
    --inv-radius:18px;
    --inv-radius-sm:12px;
  }

  /* Superficie general */
  .inventory-app-v11251{position:relative;isolation:isolate;gap:20px!important}
  .inventory-app-v11251::before{
    content:"";position:absolute;z-index:-1;inset:-18px -18px auto;height:250px;
    background:radial-gradient(circle at 16% 12%,rgba(11,101,199,.085),transparent 31%),radial-gradient(circle at 83% 2%,rgba(246,184,36,.08),transparent 24%);
    pointer-events:none;border-radius:28px;
  }
  .inventory-app-v11251 #inventory-workspace-v11251{gap:18px!important}

  /* Cabeceras */
  .inventory-app-v11251 .page-head,
  .inventory-app-v11251 .inventory-audit-head-v11251{
    position:relative;overflow:hidden;padding:24px 26px!important;border:1px solid var(--inv-border)!important;
    border-radius:22px!important;background:linear-gradient(135deg,#fff 0%,#fbfdff 58%,#f3f8fd 100%)!important;
    box-shadow:var(--inv-shadow-md)!important;
  }
  .inventory-app-v11251 .page-head::after,
  .inventory-app-v11251 .inventory-audit-head-v11251::after{
    content:"";position:absolute;right:-34px;top:-54px;width:180px;height:180px;border-radius:50%;
    border:26px solid rgba(11,101,199,.045);box-shadow:0 0 0 24px rgba(11,101,199,.025);pointer-events:none;
  }
  .inventory-app-v11251 .inventory-kicker-v11109,
  .inventory-app-v11251 .inventory-audit-kicker-v11251{
    display:inline-flex!important;align-items:center!important;width:max-content!important;min-height:25px!important;
    padding:5px 9px!important;border:1px solid #d4e4f3!important;border-radius:999px!important;background:#eff6fd!important;
    color:var(--inv-blue)!important;font-size:10px!important;font-weight:900!important;letter-spacing:.085em!important;
  }
  .inventory-app-v11251 .page-head h2,
  .inventory-app-v11251 .inventory-audit-head-v11251 h2{
    color:var(--inv-navy)!important;letter-spacing:-.035em!important;line-height:1.08!important;
  }
  .inventory-app-v11251 .page-head h2{font-size:clamp(28px,2.6vw,38px)!important;margin-top:8px!important}
  .inventory-app-v11251 .page-head p,
  .inventory-app-v11251 .inventory-audit-head-v11251 p{
    max-width:850px!important;color:var(--inv-muted)!important;font-size:13.5px!important;line-height:1.58!important;
  }

  /* Botones */
  .inventory-app-v11251 .btn,
  #modal-root .inventory-dialog-v11260 .btn{
    border-radius:11px!important;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease!important;
  }
  .inventory-app-v11251 .btn:hover,
  #modal-root .inventory-dialog-v11260 .btn:hover{transform:translateY(-1px)}
  .inventory-app-v11251 .btn-primary,
  #modal-root .inventory-dialog-v11260 .btn-primary{
    border-color:#0a5cb5!important;background:linear-gradient(180deg,#1677d2,#0b65c7)!important;color:#fff!important;
    box-shadow:0 8px 18px rgba(11,101,199,.19)!important;
  }
  .inventory-app-v11251 .btn-primary:hover,
  #modal-root .inventory-dialog-v11260 .btn-primary:hover{box-shadow:0 10px 22px rgba(11,101,199,.25)!important}
  .inventory-app-v11251 .btn-ghost,
  #modal-root .inventory-dialog-v11260 .btn-ghost{background:#fff!important;border-color:#d6e2ed!important;color:#49627b!important}
  .inventory-app-v11251 .btn-search,
  #modal-root .inventory-dialog-v11260 .btn-search{background:#eef6fd!important;border-color:#cfe0f0!important;color:#155d9d!important}
  .inventory-app-v11251 .btn:focus-visible,
  .inventory-app-v11251 button:focus-visible,
  .inventory-app-v11251 .control:focus-visible,
  #modal-root .inventory-dialog-v11260 button:focus-visible,
  #modal-root .inventory-dialog-v11260 .control:focus-visible{
    outline:3px solid rgba(11,101,199,.23)!important;outline-offset:2px!important;
  }

  /* Navegación del módulo */
  .inventory-app-v11251 .inventory-nav-v11251{
    padding:16px!important;border-color:var(--inv-border)!important;border-radius:22px!important;background:rgba(255,255,255,.94)!important;
    box-shadow:var(--inv-shadow-md)!important;backdrop-filter:blur(12px);
  }
  .inventory-app-v11251 .inventory-nav-head-v11251{padding:2px 4px 3px!important}
  .inventory-app-v11251 .inventory-nav-head-v11251 strong{font-size:21px!important;color:var(--inv-navy)!important}
  .inventory-app-v11251 .inventory-nav-head-v11251 small{font-size:12px!important;color:var(--inv-muted)!important}
  .inventory-app-v11251 .inventory-nav-group-v11251{
    padding:11px!important;border-color:#e1e9f0!important;border-radius:15px!important;background:linear-gradient(180deg,#fff,#fbfcfe)!important;
  }
  .inventory-app-v11251 .inventory-nav-group-v11251>small{font-size:9px!important;color:#8392a1!important}
  .inventory-app-v11251 .inventory-nav-actions-v11251 button{
    min-height:39px!important;padding:9px 12px!important;border-color:#dce5ed!important;border-radius:10px!important;background:#fff!important;
    color:#566b80!important;font-size:11.5px!important;box-shadow:0 2px 7px rgba(18,55,88,.025)!important;
  }
  .inventory-app-v11251 .inventory-nav-actions-v11251 button:hover{background:#f6faff!important;border-color:#bcd3e8!important;color:#244f78!important}
  .inventory-app-v11251 .inventory-nav-actions-v11251 button.active{
    background:linear-gradient(180deg,#edf6ff,#e6f2fd)!important;border-color:#8cb8e0!important;color:#09589f!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.65),0 5px 12px rgba(11,101,199,.09)!important;
  }

  /* KPI */
  .inventory-app-v11251 .inventory-summary-v11109{gap:11px!important}
  .inventory-app-v11251 .inventory-summary-item-v11109,
  #modal-root .inventory-dialog-v11260 .inventory-summary-item-v11109{
    position:relative;overflow:hidden;min-height:92px!important;padding:15px 16px!important;border:1px solid var(--inv-border)!important;
    border-radius:16px!important;background:linear-gradient(180deg,#fff,#fbfdff)!important;box-shadow:var(--inv-shadow-sm)!important;
  }
  .inventory-app-v11251 .inventory-summary-item-v11109::after,
  #modal-root .inventory-dialog-v11260 .inventory-summary-item-v11109::after{
    content:"";position:absolute;right:-26px;bottom:-31px;width:78px;height:78px;border-radius:50%;background:rgba(11,101,199,.045);
  }
  .inventory-app-v11251 .inventory-summary-item-v11109>span,
  #modal-root .inventory-dialog-v11260 .inventory-summary-item-v11109>span{
    width:4px!important;border-radius:999px!important;background:#a8bfd3!important;
  }
  .inventory-app-v11251 .inventory-summary-item-v11109.warning>span,
  #modal-root .inventory-dialog-v11260 .inventory-summary-item-v11109.warning>span{background:#e1a52c!important}
  .inventory-app-v11251 .inventory-summary-item-v11109.success>span,
  #modal-root .inventory-dialog-v11260 .inventory-summary-item-v11109.success>span{background:#3a9a69!important}
  .inventory-app-v11251 .inventory-summary-item-v11109.info>span,
  #modal-root .inventory-dialog-v11260 .inventory-summary-item-v11109.info>span{background:#3f8fd9!important}
  .inventory-app-v11251 .inventory-summary-item-v11109 strong,
  #modal-root .inventory-dialog-v11260 .inventory-summary-item-v11109 strong{font-size:23px!important;color:var(--inv-navy)!important;letter-spacing:-.025em!important}
  .inventory-app-v11251 .inventory-summary-item-v11109 b,
  #modal-root .inventory-dialog-v11260 .inventory-summary-item-v11109 b{font-size:11px!important;color:#52687e!important}
  .inventory-app-v11251 .inventory-summary-item-v11109 small,
  #modal-root .inventory-dialog-v11260 .inventory-summary-item-v11109 small{font-size:10.5px!important;color:#83909d!important}

  /* Hero y accesos */
  .inventory-app-v11251 .v115-goods-hero{
    position:relative;overflow:hidden;padding:24px!important;border:1px solid rgba(255,255,255,.15)!important;border-radius:22px!important;
    background:linear-gradient(128deg,#092f5b 0%,#0a5aa8 52%,#1677d2 100%)!important;
    box-shadow:0 18px 38px rgba(7,59,120,.20)!important;
  }
  .inventory-app-v11251 .v115-goods-hero::after{
    content:"";position:absolute;right:-42px;top:-48px;width:205px;height:205px;border-radius:50%;border:30px solid rgba(255,255,255,.055);pointer-events:none;
  }
  .inventory-app-v11251 .v115-goods-copy>span{font-size:10px!important;letter-spacing:.13em!important}
  .inventory-app-v11251 .v115-goods-copy h3{font-size:25px!important;letter-spacing:-.025em!important}
  .inventory-app-v11251 .v115-goods-copy p{font-size:13px!important;line-height:1.58!important}
  .inventory-app-v11251 .v115-process-switch{gap:12px!important}
  .inventory-app-v11251 .v115-process-card{
    position:relative;overflow:hidden;min-height:132px!important;padding:17px!important;border-color:#dee7ef!important;border-radius:18px!important;
    background:linear-gradient(180deg,#fff 0%,#fbfdff 100%)!important;box-shadow:var(--inv-shadow-sm)!important;
  }
  .inventory-app-v11251 .v115-process-card::before{
    content:"";position:absolute;inset:0 auto 0 0;width:3px;background:linear-gradient(#0b65c7,#6ab0ee);opacity:0;transition:.16s ease;
  }
  .inventory-app-v11251 .v115-process-card:hover{transform:translateY(-2px)!important;border-color:#bdd2e5!important;box-shadow:var(--inv-shadow-md)!important}
  .inventory-app-v11251 .v115-process-card:hover::before{opacity:1}
  .inventory-app-v11251 .v115-process-icon{
    width:50px!important;height:50px!important;border-radius:15px!important;background:linear-gradient(145deg,#edf6ff,#dcecfb)!important;
    color:#0b65c7!important;box-shadow:inset 0 0 0 1px rgba(11,101,199,.07)!important;
  }
  .inventory-app-v11251 .v115-process-icon .ui-icon{width:25px!important;height:25px!important}
  .inventory-app-v11251 .v115-process-card strong{font-size:16px!important;color:var(--inv-ink)!important}
  .inventory-app-v11251 .v115-process-card p{font-size:12px!important;line-height:1.52!important;color:#6a7b8c!important}
  .inventory-app-v11251 .v115-process-card em{background:#f2f7fb!important;color:#45657f!important;border:1px solid #dfe9f2!important}

  /* Resultados, filtros y listas */
  .inventory-app-v11251 .inventory-results-v11109,
  .inventory-app-v11251 .inventory-filter-shell-v11109,
  .inventory-app-v11251 .inventory-audit-panel-v11251{
    border:1px solid var(--inv-border)!important;border-radius:19px!important;background:rgba(255,255,255,.96)!important;
    box-shadow:var(--inv-shadow-sm)!important;
  }
  .inventory-app-v11251 .inventory-results-v11109{padding:17px!important}
  .inventory-app-v11251 .inventory-filter-shell-v11109{padding:16px!important}
  .inventory-app-v11251 .inventory-results-head-v11109{padding:1px 2px 10px!important}
  .inventory-app-v11251 .inventory-results-head-v11109 span{color:var(--inv-blue)!important;font-size:9.5px!important;letter-spacing:.1em!important}
  .inventory-app-v11251 .inventory-results-head-v11109 strong{font-size:18px!important;color:var(--inv-ink)!important}
  .inventory-app-v11251 .inventory-results-head-v11109 small{font-size:11px!important;color:#7b8a99!important}
  .inventory-app-v11251 .control,
  #modal-root .inventory-dialog-v11260 .control{
    border:1px solid #d7e1ea!important;background:#fff!important;color:#27435e!important;box-shadow:inset 0 1px 2px rgba(15,45,72,.03)!important;
  }
  .inventory-app-v11251 .control:hover,
  #modal-root .inventory-dialog-v11260 .control:hover{border-color:#bfcfdd!important}
  .inventory-app-v11251 .control:focus,
  #modal-root .inventory-dialog-v11260 .control:focus{border-color:#7fb0dd!important;box-shadow:0 0 0 3px rgba(11,101,199,.09)!important}
  .inventory-app-v11251 .v115-list-toolbar{padding:12px 13px!important;border:1px solid #e4ebf1!important;border-radius:13px!important;background:#fafcfe!important}
  .inventory-app-v11251 .v115-goods-list{gap:10px!important}
  .inventory-app-v11251 .v115-goods-row{
    border-color:#e1e8ef!important;border-radius:16px!important;background:#fff!important;box-shadow:0 3px 10px rgba(18,55,88,.028)!important;
  }
  .inventory-app-v11251 .v115-goods-row:hover{border-color:#bed2e4!important;box-shadow:0 8px 20px rgba(18,55,88,.06)!important}
  .inventory-app-v11251 .v115-goods-id>span{color:#0b65c7!important}
  .inventory-app-v11251 .v115-goods-id strong{color:#173b63!important;font-size:15.5px!important}
  .inventory-app-v11251 .v115-goods-id small{color:#708091!important}
  .inventory-app-v11251 .v115-goods-meta span{padding:7px 8px!important;border-radius:10px!important;background:#f8fafc!important;border:1px solid #edf1f4!important}
  .inventory-app-v11251 .v115-goods-meta small{color:#8793a0!important}
  .inventory-app-v11251 .v115-goods-meta b{color:#324c67!important}
  .inventory-app-v11251 .v115-goods-link{border:1px solid transparent!important;border-radius:12px!important}
  .inventory-app-v11251 .v115-goods-link.linked{background:#edf8f2!important;border-color:#d8eee1!important;color:#2b704d!important}
  .inventory-app-v11251 .v115-goods-link.standalone{background:#f3f7fa!important;border-color:#e3ebf1!important;color:#52677b!important}

  /* Auditoría y revisión */
  .inventory-app-v11251 .inventory-audit-tabs-v11251{padding:2px 2px 8px!important}
  .inventory-app-v11251 .inventory-audit-tabs-v11251 button{min-height:40px!important;border-color:#dce5ed!important;background:#fff!important;color:#617386!important}
  .inventory-app-v11251 .inventory-audit-tabs-v11251 button.active{background:#edf6ff!important;border-color:#94bce0!important;color:#0a599f!important;box-shadow:0 5px 12px rgba(11,101,199,.07)!important}
  .inventory-app-v11251 .inventory-audit-card-v11251{
    border-color:#dfe7ee!important;border-radius:17px!important;background:linear-gradient(180deg,#fff,#fcfdff)!important;
    box-shadow:0 4px 13px rgba(18,55,88,.035)!important;
  }
  .inventory-app-v11251 .inventory-audit-card-v11251:hover{border-color:#bad0e3!important;box-shadow:0 10px 25px rgba(18,55,88,.07)!important}
  .inventory-app-v11251 .inventory-audit-chip-v11251{background:#edf6ff!important;border:1px solid #d8e9f8!important;color:#0a5fae!important}
  .inventory-app-v11251 .inventory-audit-metric-v11251{background:#f8fafc!important;border-color:#e8eef3!important;border-radius:12px!important}
  .inventory-app-v11251 .inventory-audit-status-v11251{border:1px solid #e1e8ee!important}
  .inventory-app-v11251 .inventory-audit-status-v11251.is-applied{background:var(--inv-success-bg)!important;border-color:#d7ecdf!important}
  .inventory-app-v11251 .inventory-audit-status-v11251.is-pending{background:#eef6ff!important;border-color:#d8e8f6!important}
  .inventory-app-v11251 .inventory-audit-status-v11251.is-recount{background:var(--inv-warning-bg)!important;border-color:#f1e3bc!important}
  .inventory-app-v11251 .inventory-audit-status-v11251.is-rejected{background:var(--inv-danger-bg)!important;border-color:#efd7d7!important}

  /* Pareto / analítica */
  .inventory-app-v11251 .v115-detail-grid{gap:10px!important}
  .inventory-app-v11251 .v115-detail-grid article{
    border-color:#dfe7ee!important;border-radius:15px!important;background:linear-gradient(180deg,#fff,#fbfdff)!important;
    box-shadow:0 4px 12px rgba(18,55,88,.035)!important;
  }
  .inventory-app-v11251 .v115-detail-grid article small{color:#81909e!important}
  .inventory-app-v11251 .v115-detail-grid article strong{color:#234765!important;font-size:14px!important}
  .inventory-app-v11251 .card.card-pad{border-color:#dfe7ee!important;border-radius:17px!important;background:#fbfdff!important;box-shadow:var(--inv-shadow-sm)!important}

  /* Pop-ups: acabado premium sin cambiar anchos V11.26 */
  #modal-root .modal-overlay.inventory-dialog-overlay-v11260{background:rgba(6,24,43,.53)!important;backdrop-filter:blur(8px) saturate(1.02)!important}
  #modal-root .modal.inventory-dialog-v11260{
    border-color:#cfdae4!important;border-radius:20px!important;background:#fff!important;box-shadow:var(--inv-shadow-lg)!important;
  }
  #modal-root .inventory-dialog-v11260 .modal-head{
    position:relative!important;overflow:hidden!important;min-height:82px!important;padding:18px 20px 17px 23px!important;
    background:linear-gradient(135deg,#fff 0%,#fbfdff 63%,#f2f7fc 100%)!important;border-bottom-color:#dde6ee!important;
    box-shadow:inset 4px 0 0 #0b65c7!important;
  }
  #modal-root .inventory-dialog-v11260 .modal-head::after{
    content:"";position:absolute;right:-30px;top:-50px;width:150px;height:150px;border-radius:50%;border:23px solid rgba(11,101,199,.045);pointer-events:none;
  }
  #modal-root .inventory-dialog-v11260 .modal-kicker{color:#0b65c7!important;font-size:11px!important}
  #modal-root .inventory-dialog-v11260 .modal-head h3{color:var(--inv-navy)!important;font-size:24px!important;letter-spacing:-.025em!important}
  #modal-root .inventory-dialog-v11260 .modal-head p{color:#6b7d8f!important}
  #modal-root .inventory-dialog-v11260 .icon-close{background:#fff!important;border:1px solid #d9e3ec!important;color:#587087!important;box-shadow:0 4px 10px rgba(18,55,88,.05)!important}
  #modal-root .inventory-dialog-v11260 .inventory-dialog-guide-v11260{
    padding:12px 22px!important;background:linear-gradient(180deg,#f6f9fc,#f9fbfd)!important;border-bottom-color:#e1e9f0!important;
  }
  #modal-root .inventory-dialog-v11260 .inventory-dialog-guide-v11260>strong{color:#345b7c!important}
  #modal-root .inventory-dialog-v11260 .inventory-dialog-guide-v11260 li::before{
    background:linear-gradient(145deg,#eaf5ff,#dcecfb)!important;color:#0b65c7!important;box-shadow:inset 0 0 0 1px #cfe2f3!important;
  }
  #modal-root .inventory-dialog-v11260 .modal-body{background:linear-gradient(180deg,#f8fafc,#fbfcfe)!important}
  #modal-root .inventory-dialog-v11260 .modal-foot{background:rgba(255,255,255,.97)!important;backdrop-filter:blur(10px)!important}
  #modal-root .inventory-dialog-v11260 .inventory-count-v11109>header:not(.inventory-review-hero-v11251){
    border-color:#dce6ef!important;border-left-color:#0b65c7!important;background:linear-gradient(180deg,#fff,#fbfdff)!important;box-shadow:var(--inv-shadow-sm)!important;
  }
  #modal-root .inventory-dialog-v11260 .inventory-source-bar-v11109{background:#f0f7fd!important;border-color:#d7e7f4!important}
  #modal-root .inventory-dialog-v11260 .inventory-lot-row-v11109,
  #modal-root .inventory-dialog-v11260 .inventory-comparison-row-v11251,
  #modal-root .inventory-dialog-v11260 .v115-goods-row{
    border-color:#dde6ee!important;border-radius:14px!important;background:#fff!important;box-shadow:0 4px 12px rgba(18,55,88,.035)!important;
  }
  #modal-root .inventory-dialog-v11260 .inventory-lot-qty-v11109 input{
    border-color:#9fc3e3!important;background:#fafdff!important;font-size:18px!important;font-weight:900!important;color:#173b63!important;
  }
  #modal-root .inventory-dialog-v11260 .inventory-review-hero-v11251{
    background:linear-gradient(128deg,#092f5b,#0b65c7)!important;border:1px solid rgba(255,255,255,.12)!important;box-shadow:0 12px 26px rgba(7,59,120,.16)!important;
  }
  #modal-root .inventory-dialog-v11260 .inventory-comparison-cell-v11251{background:#f8fafc!important;border:1px solid #edf1f4!important;border-radius:10px!important}
  #modal-root .inventory-dialog-v11260 .inventory-comparison-delta-v11251{border:1px solid #dce9e1!important}
  #modal-root .inventory-dialog-v11260 .inventory-comparison-delta-v11251.is-diff{border-color:#f0dfb6!important;background:#fff8ea!important}
  #modal-root .inventory-dialog-v11260 .inventory-decision-v11251{background:#fbfdff!important;border-color:#dce6ef!important;box-shadow:var(--inv-shadow-sm)!important}
  #modal-root .inventory-dialog-v11260 .v116-camera{border:1px solid #c7d7e5!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),0 10px 24px rgba(7,33,60,.12)!important}
  #modal-root .inventory-dialog-v11260 .v116-reticle{filter:drop-shadow(0 0 8px rgba(255,255,255,.22))}
  #modal-root .inventory-dialog-v11260 .v116-label-card{border-color:#dce6ee!important;border-radius:16px!important;background:#fff!important;box-shadow:var(--inv-shadow-sm)!important}
  #modal-root .inventory-dialog-v11260 .v116-found-hero{border-radius:17px!important;background:linear-gradient(135deg,#eef7ff,#fff)!important;border:1px solid #d7e7f4!important;box-shadow:var(--inv-shadow-sm)!important}
  #modal-root .inventory-dialog-v11260 .v116-origin-note{border-radius:12px!important;background:#eef8f3!important;border:1px solid #d7ecdf!important;border-left:4px solid #3a9a69!important}

  /* Feedback y movimiento */
  @media(prefers-reduced-motion:no-preference){
    .inventory-app-v11251 .v115-process-card,
    .inventory-app-v11251 .v115-goods-row,
    .inventory-app-v11251 .inventory-audit-card-v11251{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease!important}
  }
  @media(prefers-reduced-motion:reduce){
    .inventory-app-v11251 *,#modal-root .inventory-dialog-v11260 *{scroll-behavior:auto!important;transition:none!important;animation:none!important}
  }

  /* Tablet y móvil: conserva claridad, no miniaturiza */
  @media(max-width:1024px){
    .inventory-app-v11251 .page-head,.inventory-app-v11251 .inventory-audit-head-v11251{padding:20px!important}
    .inventory-app-v11251 .v115-process-card{min-height:118px!important}
    .inventory-app-v11251 .inventory-results-v11109{padding:14px!important}
  }
  @media(max-width:760px){
    .inventory-app-v11251::before{inset:-10px -8px auto;height:180px}
    .inventory-app-v11251 .page-head,.inventory-app-v11251 .inventory-audit-head-v11251{padding:17px!important;border-radius:18px!important}
    .inventory-app-v11251 .page-head h2{font-size:28px!important}
    .inventory-app-v11251 .v115-goods-hero{padding:19px!important;border-radius:18px!important}
    .inventory-app-v11251 .inventory-summary-item-v11109{min-height:84px!important}
    .inventory-app-v11251 .v115-process-card{border-radius:16px!important}
    #modal-root .inventory-dialog-v11260 .modal-head{padding:15px 14px 14px 18px!important}
    #modal-root .inventory-dialog-v11260 .modal-head h3{font-size:22px!important}
    #modal-root .inventory-dialog-v11260 .inventory-dialog-guide-v11260{padding:10px 14px!important}
  }
  `;
  document.head.appendChild(style);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installInventoryVisualV11270,{once:true});
else installInventoryVisualV11270();
