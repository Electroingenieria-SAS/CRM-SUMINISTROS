import { timeTrafficLight, trafficHelp, elapsedActiveSeconds } from "./time-traffic.js";
import { clock } from "../shared/local-dates.js";
import { workforceState } from "../workforce-state.js";

export function startLiveClock(content,active){
  clearInterval(workforceState.liveTimer);if(!active)return;
  const target=content.querySelector("[data-live-clock]");
  const trafficRoot=content.querySelector("[data-time-traffic]");
  const renderTick=()=>{
    const seconds=elapsedActiveSeconds(active);
    if(target)target.textContent=clock(seconds);
    if(trafficRoot){
      const traffic=timeTrafficLight(seconds);
      trafficRoot.className=`work-timer-traffic tone-${traffic.tone}`;
      trafficRoot.dataset.tone=traffic.tone;
      const label=trafficRoot.querySelector("[data-traffic-label]");if(label)label.textContent=traffic.label;
      const help=trafficRoot.querySelector("[data-traffic-help]");if(help)help.textContent=trafficHelp(seconds);
    }
  };
  renderTick();
  if(active.status!=="PAUSED")workforceState.liveTimer=setInterval(renderTick,1000);
}
