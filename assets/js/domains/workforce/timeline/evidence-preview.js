

export function prepareGalleryPreview(gallery){
gallery.show=async(evidenceId,fileId)=>{
    const evidenceKey=String(evidenceId||"").trim();
    const driveId=String(fileId||"").trim();
    if(!evidenceKey||!driveId)return;

    const image=gallery.cover.querySelector("img");
    const loader=gallery.cover.querySelector(".work-timeline-photo-loader-v11350");
    gallery.cover.dataset.evidenceId=evidenceKey;
    gallery.cover.dataset.driveFileId=driveId;
    gallery.cover.classList.add("is-loading");
    gallery.cover.classList.remove("is-error","is-ready");
    gallery.setActionState(evidenceKey,"loading");
    if(loader){
      loader.hidden=false;
      loader.textContent="Cargando evidencia…";
    }

    try{
      if(typeof gallery.loadPreview!=="function")throw new Error("El visor de evidencia no está disponible. Actualiza la aplicación.");
      const preview=await (
        gallery.initialPreviewPromise&&gallery.first?.id===evidenceKey&&gallery.first?.driveFileId===driveId
          ? gallery.initialPreviewPromise
          : gallery.loadPreview(evidenceKey,driveId)
      );
      gallery.initialPreviewPromise=null;
      if(!gallery.layer.isConnected)return;
      if(!preview?.dataUrl)throw new Error("Drive no devolvió una vista previa válida.");

      image.hidden=false;
      image.classList.remove("is-visible");
      image.src=preview.dataUrl;

      if(typeof image.decode==="function"){
        await image.decode();
      }else{
        await new Promise((resolve,reject)=>{
          if(image.complete&&image.naturalWidth>0)return resolve();
          image.onload=()=>resolve();
          image.onerror=()=>reject(new Error("La fotografía recibida no pudo mostrarse."));
        });
      }

      if(!gallery.layer.isConnected)return;
      requestAnimationFrame(()=>{
        if(!gallery.layer.isConnected)return;
        gallery.cover.classList.remove("is-loading","is-error");
        gallery.cover.classList.add("is-ready");
        image.classList.add("is-visible");
        gallery.setActionState(evidenceKey,"ready");
        if(loader)loader.hidden=true;
      });
    }catch(error){
      if(!gallery.layer.isConnected)return;
      image.hidden=true;
      image.removeAttribute("src");
      gallery.cover.classList.remove("is-loading");
      gallery.cover.classList.add("is-error");
      gallery.setActionState(evidenceKey,"error");
      if(loader){
        loader.hidden=false;
        loader.textContent=(error?.message||"No fue posible cargar la fotografía.")+" Toca aquí para reintentar.";
      }
    }
  };
}
