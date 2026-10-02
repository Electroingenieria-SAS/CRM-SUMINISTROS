import { showCalendarCloud, calendarCloudContains, scheduleCalendarCloudClose, closeCalendarCloud } from "./calendar-cloud.js";

export function bindCalendarPointerEvents(binding){
for(const element of binding.openNodes){
    const id=element.dataset.assignmentOpen;
    const item=binding.byId.get(String(id||""));

    const pointerHandler=()=>{
      if(!item)return;
      binding.primePreview(item);
      showCalendarCloud(item,element,binding.openItem);
    };
    const pointerLeaveHandler=()=>scheduleCalendarCloudClose();
    const focusHandler=()=>{
      if(!item)return;
      binding.primePreview(item);
      showCalendarCloud(item,element,binding.openItem);
    };
    const blurHandler=event=>{
      if(calendarCloudContains(event.relatedTarget))return;
      scheduleCalendarCloudClose();
    };
    const clickHandler=event=>{
      if(event.target.closest("[data-assignment-cancel]"))return;
      event.stopPropagation();
      if(item)showCalendarCloud(item,element,binding.openItem);
    };
    const doubleClickHandler=event=>{
      if(event.target.closest("[data-assignment-cancel]"))return;
      event.preventDefault();
      event.stopPropagation();
      binding.openItem(id);
    };
    const keyHandler=event=>{
      if(event.key==="Enter"){
        event.preventDefault();
        event.stopPropagation();
        binding.openItem(id);
        return;
      }
      if(event.key===" "){
        event.preventDefault();
        event.stopPropagation();
        if(item)showCalendarCloud(item,element,binding.openItem);
      }
      if(event.key==="Escape")closeCalendarCloud();
    };

    element.addEventListener("pointerenter",pointerHandler,{passive:true});
    element.addEventListener("pointerleave",pointerLeaveHandler,{passive:true});
    element.addEventListener("focus",focusHandler,{passive:true});
    element.addEventListener("blur",blurHandler,{passive:true});
    element.addEventListener("click",clickHandler);
    element.addEventListener("dblclick",doubleClickHandler);
    element.addEventListener("keydown",keyHandler);

    binding.cleanup.push(()=>{
      element.removeEventListener("pointerenter",pointerHandler);
      element.removeEventListener("pointerleave",pointerLeaveHandler);
      element.removeEventListener("focus",focusHandler);
      element.removeEventListener("blur",blurHandler);
      element.removeEventListener("click",clickHandler);
      element.removeEventListener("dblclick",doubleClickHandler);
      element.removeEventListener("keydown",keyHandler);
    });
  }
}
