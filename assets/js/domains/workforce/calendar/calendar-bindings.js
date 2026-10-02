import { openWorkTimelineCard, timelineDetailRequest } from "../timeline/index.js";
import { collectPreviewRefs } from "../evidence/index.js";
import { closeCalendarCloud } from "./calendar-cloud.js";
import { bindCalendarPointerEvents } from "./calendar-pointer-events.js";

export function bindWorkforceCalendar({
  container,
  items=[],
  api,
  evidenceManager,
  canPlanTeam=false,
  onPlanDay,
  onCancel,
  onActiveProfile,
  notify
}={}){
const binding={container,items,api,evidenceManager,canPlanTeam,onPlanDay,onCancel,onActiveProfile,notify};
prepareCalendarBinding(binding);
if(!binding.container)return()=>{};
bindCalendarDetails(binding);
bindCalendarPointerEvents(binding);
bindCalendarPreviews(binding);
bindCalendarPlanning(binding);
return finalizeCalendarBinding(binding);
}

export function prepareCalendarBinding(binding){
if(!binding.container)return ()=>{};
binding.timeline=Array.isArray(binding.items)?binding.items:[];
binding.byId=new Map(binding.timeline.map(item=>[String(item.id),item]));
binding.detailCache=new Map();
binding.cleanup=[];
binding.toast=typeof binding.notify==="function"?binding.notify:()=>{};
binding.detailKey=item=>[
    item?.assignmentId||"",
    item?.executionId||"",
    item?.taskSessionId||"",
    item?.cutExecutionId||"",
    item?.profileId||""
  ].join(":");
}

export function bindCalendarDetails(binding){
binding.loadDetail=item=>{
    const key=binding.detailKey(item);
    if(binding.detailCache.has(key))return binding.detailCache.get(key);

    const request=(item?.sourceType==="ORDER_PROCESS"
      ? binding.api.workOperationalDetail({taskSessionId:item.taskSessionId||null,cutExecutionId:item.cutExecutionId||null})
      : binding.api.workPlannerDetail(timelineDetailRequest(item)))
      .catch(error=>{
        binding.detailCache.delete(key);
        throw error;
      });

    binding.detailCache.set(key,request);
    return request;
  };
binding.primePreview=item=>{
    if(!item?.previewEvidenceId||!item?.previewDriveFileId||!binding.evidenceManager)return Promise.resolve(null);
    return binding.evidenceManager
      .get(item.previewEvidenceId,item.previewDriveFileId)
      .catch(()=>null);
  };
binding.openItem=id=>{
    const item=binding.byId.get(String(id||""));
    if(!item){
      binding.toast("No se encontró el detalle de esta actividad.","warning");
      return;
    }

    // La foto empieza antes de solicitar el detalle completo.
    binding.primePreview(item);

    return openWorkTimelineCard(
      item,
      ()=>binding.loadDetail(item),
      (evidenceId,fileId)=>binding.evidenceManager.get(evidenceId,fileId)
    );
  };
binding.openNodes=[...binding.container.querySelectorAll("[data-assignment-open]")];
}

export function bindCalendarPreviews(binding){
if(typeof IntersectionObserver!=="undefined"&&binding.evidenceManager){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        const item=binding.byId.get(String(entry.target.dataset.assignmentOpen||""));
        if(item)binding.primePreview(item);
        observer.unobserve(entry.target);
      }
    },{root:null,rootMargin:"140px 0px",threshold:0.01});

    for(const node of binding.openNodes)observer.observe(node);
    binding.cleanup.push(()=>observer.disconnect());
  }else if(binding.evidenceManager){
    binding.evidenceManager.prefetch(collectPreviewRefs(binding.timeline,4),{limit:4,concurrency:2});
  }
binding.container.querySelectorAll("[data-active-profile]").forEach(button=>{
    const handler=event=>{
      event.stopPropagation();
      const profileId=button.dataset.activeProfile;
      const active=binding.timeline.find(row=>
        row.profileId===profileId&&
        ["IN_PROGRESS","PAUSED"].includes(String(row.memberStatus||"").toUpperCase())
      );

      if(active)return binding.openItem(active.id);
      if(typeof binding.onActiveProfile==="function")return binding.onActiveProfile(profileId);
      binding.toast("La actividad actual todavía no tiene detalle disponible en este rango.","warning");
    };

    button.addEventListener("click",handler);
    binding.cleanup.push(()=>button.removeEventListener("click",handler));
  });
}

export function bindCalendarPlanning(binding){
if(binding.canPlanTeam){
    binding.container.querySelectorAll("[data-plan-day]").forEach(day=>{
      const click=event=>{
        if(event.target.closest("[data-assignment-open],[data-active-profile],[data-assignment-cancel]"))return;
        binding.onPlanDay?.(day.dataset.planDay);
      };
      const key=event=>{
        if((event.key==="Enter"||event.key===" ")&&event.target===day){
          event.preventDefault();
          binding.onPlanDay?.(day.dataset.planDay);
        }
      };
      day.addEventListener("click",click);
      day.addEventListener("keydown",key);
      binding.cleanup.push(()=>{
        day.removeEventListener("click",click);
        day.removeEventListener("keydown",key);
      });
    });

    binding.container.querySelectorAll("[data-assignment-cancel]").forEach(button=>{
      const handler=event=>{
        event.stopPropagation();
        binding.onCancel?.(button.dataset.assignmentCancel);
      };
      button.addEventListener("click",handler);
      binding.cleanup.push(()=>button.removeEventListener("click",handler));
    });
  }
}

export function finalizeCalendarBinding(binding){
binding.closeOnViewportMove=()=>closeCalendarCloud();
window.addEventListener("scroll",binding.closeOnViewportMove,{passive:true,capture:true});
window.addEventListener("resize",binding.closeOnViewportMove,{passive:true});
binding.cleanup.push(()=>{
    window.removeEventListener("scroll",binding.closeOnViewportMove,true);
    window.removeEventListener("resize",binding.closeOnViewportMove);
    closeCalendarCloud();
  });
return ()=>binding.cleanup.splice(0).forEach(fn=>fn());
}
