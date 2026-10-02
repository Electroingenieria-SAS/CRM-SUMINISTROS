import { calendarCloudHtml } from "./calendar-cloud-content.js";
import { calendarCloudState } from "./calendar-cloud-state.js";

export function showCalendarCloud(item,anchor,openItem){
  if(typeof document==="undefined"||!item||!anchor?.isConnected)return;
  clearTimeout(calendarCloudState.calendarCloudHideTimer);
  closeCalendarCloud(false);

  const cloud=document.createElement("aside");
  cloud.className="work-calendar-cloud-v11361";
  cloud.setAttribute("role","dialog");
  cloud.setAttribute("aria-label","Resumen de actividad");
  cloud.innerHTML=calendarCloudHtml(item);
  document.body.appendChild(cloud);
  calendarCloudState.calendarCloud=cloud;

  cloud.addEventListener("pointerenter",()=>clearTimeout(calendarCloudState.calendarCloudHideTimer));
  cloud.addEventListener("pointerleave",()=>scheduleCalendarCloudClose());
  cloud.querySelector("[data-calendar-cloud-open]")?.addEventListener("click",()=>openItem(item.id));

  requestAnimationFrame(()=>{
    if(!cloud.isConnected)return;
    positionCalendarCloud(cloud,anchor);
    cloud.classList.add("is-visible");
  });
}

export function calendarCloudContains(node){
  return Boolean(node&&calendarCloudState.calendarCloud?.contains(node));
}

export function scheduleCalendarCloudClose(delay=180){
  clearTimeout(calendarCloudState.calendarCloudHideTimer);
  calendarCloudState.calendarCloudHideTimer=setTimeout(()=>closeCalendarCloud(),delay);
}

export function closeCalendarCloud(remove=true){
  clearTimeout(calendarCloudState.calendarCloudHideTimer);
  if(!calendarCloudState.calendarCloud)return;
  const current=calendarCloudState.calendarCloud;
  current.classList.remove("is-visible");
  if(remove){
    setTimeout(()=>{
      if(current===calendarCloudState.calendarCloud)calendarCloudState.calendarCloud=null;
      current.remove();
    },120);
  }else{
    current.remove();
    calendarCloudState.calendarCloud=null;
  }
}

export function positionCalendarCloud(cloud,anchor){
  const rect=anchor.getBoundingClientRect();
  const margin=12;
  const width=Math.min(340,Math.max(286,window.innerWidth-margin*2));
  cloud.style.width=`${width}px`;
  const height=cloud.offsetHeight||250;
  let left=rect.left+(rect.width-width)/2;
  left=Math.max(margin,Math.min(left,window.innerWidth-width-margin));
  let top=rect.bottom+9;
  if(top+height>window.innerHeight-margin)top=rect.top-height-9;
  top=Math.max(margin,Math.min(top,window.innerHeight-height-margin));
  cloud.style.left=`${Math.round(left)}px`;
  cloud.style.top=`${Math.round(top)}px`;
}
