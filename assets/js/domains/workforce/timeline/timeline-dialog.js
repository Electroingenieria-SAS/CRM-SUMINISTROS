import { fmt } from "../../../core/format.js";
import { timelineDetailHtml } from "./timeline-detail.js";
import { bindEvidenceGallery } from "./evidence-gallery.js";
import { isPhotoEvidence, statusLabel, timeRange } from "./timeline-formatters.js";

export async function openWorkTimelineCard(item,loadDetail,loadPreview){
  if(typeof document==="undefined")return;
  closeWorkTimelineCard();

  const previousFocus=document.activeElement;
  const layer=document.createElement("div");
  layer.className="work-timeline-layer-v11350";
  layer.dataset.workTimelineLayer="";
  layer.innerHTML=`
    <button type="button" class="work-timeline-backdrop-v11350" data-timeline-close aria-label="Cerrar detalle"></button>
    <aside class="work-timeline-sheet-v11350" role="dialog" aria-modal="true" aria-label="Detalle de actividad" tabindex="-1">
      <header class="work-timeline-sheet-head-v11350">
        <div>
          <span class="work-timeline-kicker-v11350">${fmt.escape(item?.sourceType==="ORDER_PROCESS"?"Trabajo de pedido":item?.sourceType==="EXECUTION"?"Actividad registrada":"Actividad del cronograma")}</span>
          <h3>${fmt.escape(item?.title||"Actividad")}</h3>
        </div>
        <button type="button" class="work-timeline-close-v11350" data-timeline-close aria-label="Cerrar">×</button>
      </header>
      <div class="work-timeline-sheet-body-v11350" data-timeline-body>
        ${timelineSkeleton(item)}
      </div>
    </aside>`;

  document.body.appendChild(layer);
  const panel=layer.querySelector(".work-timeline-sheet-v11350");
  const close=()=>{
    layer.classList.add("is-closing");
    const remove=()=>{layer.remove();previousFocus?.focus?.({preventScroll:true})};
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return remove();
    setTimeout(remove,180);
  };
  layer.querySelectorAll("[data-timeline-close]").forEach(node=>node.addEventListener("click",close));
  const onKey=event=>{
    if(event.key==="Escape"){
      event.preventDefault();
      document.removeEventListener("keydown",onKey,true);
      close();
    }
  };
  document.addEventListener("keydown",onKey,true);
  panel.focus({preventScroll:true});

  try{
    const detail=await loadDetail();
    if(!layer.isConnected)return;
    const resolvedDetail=detail||item;
    const firstPhoto=(Array.isArray(resolvedDetail?.evidence)?resolvedDetail.evidence:[]).find(isPhotoEvidence);
    const firstPreviewPromise=
      firstPhoto?.id&&firstPhoto?.driveFileId&&typeof loadPreview==="function"
        ? loadPreview(firstPhoto.id,firstPhoto.driveFileId)
        : null;

    layer.querySelector("[data-timeline-body]").innerHTML=timelineDetailHtml(resolvedDetail);
    bindEvidenceGallery(layer,resolvedDetail,loadPreview,firstPreviewPromise);
  }catch(error){
    if(!layer.isConnected)return;
    layer.querySelector("[data-timeline-body]").innerHTML=`
      <div class="work-timeline-error-v11350">
        <span>!</span>
        <div><strong>No fue posible abrir el detalle</strong><p>${fmt.escape(error?.message||"Intenta nuevamente.")}</p></div>
      </div>`;
  }
}

export function closeWorkTimelineCard(){
  if(typeof document==="undefined")return;
  document.querySelector("[data-work-timeline-layer]")?.remove();
}

export function timelineSkeleton(item){
  return `<div class="work-timeline-summary-v11350">
    <div class="work-timeline-summary-state-v11350"><span class="pulse"></span><strong>${fmt.escape(statusLabel(item?.memberStatus))}</strong></div>
    <div class="work-timeline-summary-grid-v11350">
      <span><small>Responsable</small><b>${fmt.escape(item?.profileName||"—")}</b></span>
      <span><small>Hora</small><b>${fmt.escape(timeRange(item?.actualStart||item?.plannedStart,item?.actualEnd||item?.plannedEnd))}</b></span>
    </div>
  </div>
  <div class="work-timeline-loading-v11350"><i></i><i></i><i></i></div>`;
}
