/*
 * Observabilidad específica por plataforma.
 * GitHub Pages no expone /_vercel/speed-insights/script.js, por lo que
 * únicamente cargamos Speed Insights cuando el host pertenece a Vercel.
 */
(function installPlatformObservability(){
  const host=String(window.location.hostname||"").toLowerCase();
  const isVercel=host==="vercel.app"||host.endsWith(".vercel.app");

  if(!isVercel)return;

  window.si=window.si||function(){
    (window.siq=window.siq||[]).push(arguments);
  };

  if(document.querySelector('script[data-erp-vercel-speed-insights="true"]'))return;

  const script=document.createElement("script");
  script.defer=true;
  script.src="/_vercel/speed-insights/script.js";
  script.dataset.sampleRate="0.25";
  script.dataset.erpVercelSpeedInsights="true";
  document.head.appendChild(script);
})();
