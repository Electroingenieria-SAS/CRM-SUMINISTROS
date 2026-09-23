const STYLE_ID="workforce-experience-v11344-style";

export function ensureWorkforceExperienceStyles(){
  if(typeof document==="undefined"||document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;
  link.rel="stylesheet";
  link.href="./assets/runtime-css/workforce-experience-v11344.css?v=11.34.4";
  document.head.appendChild(link);
}
