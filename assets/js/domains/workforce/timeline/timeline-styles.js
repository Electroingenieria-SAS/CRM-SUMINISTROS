

export const STYLE_ID="workforce-timeline-v11350-style";

export function ensureWorkforceTimelineStyles(){
  if(typeof document==="undefined"||document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;
  link.rel="stylesheet";
  link.href="./assets/runtime-css/workforce-timeline-v11350.css?v=11.35.4";
  document.head.appendChild(link);
}
