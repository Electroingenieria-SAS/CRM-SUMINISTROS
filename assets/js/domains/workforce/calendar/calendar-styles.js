

export const STYLE_ID="workforce-calendar-v11360-style";

export function ensureWorkforceCalendarStyles(){
  if(typeof document==="undefined"||document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;
  link.rel="stylesheet";
  link.href="./assets/runtime-css/workforce-calendar-v11360.css?v=11.38.0";
  document.head.appendChild(link);
}
