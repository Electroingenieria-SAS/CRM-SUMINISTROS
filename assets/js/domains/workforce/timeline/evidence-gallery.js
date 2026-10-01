import { isPhotoEvidence } from "./timeline-formatters.js";
import { prepareGalleryPreview } from "./evidence-preview.js";

export function bindEvidenceGallery(layer,detail,loadPreview,initialPreviewPromise=null){
const gallery={layer,detail,loadPreview,initialPreviewPromise};
prepareTimelineGallery(gallery);
if(!gallery.cover)return;
prepareGalleryPreview(gallery);
bindGalleryControls(gallery);
}

export function prepareTimelineGallery(gallery){
gallery.evidence=Array.isArray(gallery.detail?.evidence)?gallery.detail.evidence:[];
gallery.first=gallery.evidence.find(isPhotoEvidence);
gallery.cover=gallery.layer.querySelector("[data-timeline-photo-main]");
if(!gallery.cover)return;
gallery.setActionState=(evidenceId,state)=>{
    gallery.layer.querySelectorAll("[data-timeline-evidence-preview]").forEach(button=>{
      if(String(button.dataset.evidenceId||"")!==String(evidenceId||""))return;
      const label=button.querySelector("[data-preview-label]");
      button.disabled=state==="loading";
      button.classList.toggle("is-loading",state==="loading");
      if(label)label.textContent=state==="loading"?"Cargando…":state==="error"?"Reintentar":"Ver foto";
    });
  };
}

export function bindGalleryControls(gallery){
gallery.cover.addEventListener("click",()=>{
    gallery.show(gallery.cover.dataset.evidenceId,gallery.cover.dataset.driveFileId);
  });
if(gallery.first?.id&&gallery.first?.driveFileId)gallery.show(gallery.first.id,gallery.first.driveFileId);
gallery.layer.querySelectorAll("[data-timeline-thumb]").forEach(button=>button.addEventListener("click",async()=>{
    gallery.layer.querySelectorAll("[data-timeline-thumb]").forEach(node=>node.classList.toggle("active",node===button));
    await gallery.show(button.dataset.evidenceId,button.dataset.driveFileId);
  }));
gallery.layer.querySelectorAll("[data-timeline-evidence-preview]").forEach(button=>button.addEventListener("click",async()=>{
    const fileId=button.dataset.driveFileId;
    const thumb=[...gallery.layer.querySelectorAll("[data-timeline-thumb]")].find(node=>node.dataset.driveFileId===fileId);
    if(thumb)gallery.layer.querySelectorAll("[data-timeline-thumb]").forEach(node=>node.classList.toggle("active",node===thumb));
    await gallery.show(button.dataset.evidenceId,fileId);
    gallery.cover.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"});
  }));
}
