import path from "node:path";

const RELEASE_WINDOW_FILE="release/vercel-production-window.json";

export function validateDeliveryContract({ root, check, exists, rel, walk, read, main, vercel, api }){
  const workflows=walk(path.join(root,".github/workflows")).filter(file=>/\.ya?ml$/i.test(file)).map(rel);
  const application=read("assets/js/core/bootstrap/application.js");
  const authenticatedBootstrap=read("assets/js/core/bootstrap/authenticated-bootstrap.js");
  const runtimeInstallers=read("assets/js/core/bootstrap/runtime-installers.js");
  const releaseWindowOpen=exists(RELEASE_WINDOW_FILE);
  const mainAutoDeployEnabled=vercel.includes('"main": true');
  const mainAutoDeployDisabled=vercel.includes('"main": false');
  const nonMainAutoDeployDisabled=vercel.includes('"*": false');

  check(workflows.length===1&&workflows[0]===".github/workflows/validate-crm.yml","Debe existir una sola CI canónica.");
  check(
    nonMainAutoDeployDisabled
      && (
        (!releaseWindowOpen&&mainAutoDeployDisabled)
        || (releaseWindowOpen&&mainAutoDeployEnabled)
      ),
    "Vercel debe permanecer cerrado salvo durante una ventana productiva explícita y versionada."
  );
  if(releaseWindowOpen){
    const releaseWindow=JSON.parse(read(RELEASE_WINDOW_FILE));
    check(
      releaseWindow.mode==="CONTROLLED_PRODUCTION_WINDOW"
        && Boolean(releaseWindow.reason)
        && Boolean(releaseWindow.expectedPwaRevision),
      "La ventana Vercel debe declarar modo, motivo y revisión PWA esperada."
    );
  }
  check(exists(".vercelignore"),"Falta .vercelignore.");
  check(
    main.includes("startApplication();")
      && application.includes("createSessionLifecycle")
      && authenticatedBootstrap.includes("initRouter(createRouteDispatcher(")
      && runtimeInstallers.includes("installPacoAssistant"),
    "El composition root perdió el arranque principal."
  );
  check(api.includes('pacoSnapshot:()=>rpc("erp_x_paco_snapshot")'),"API debe exponer el snapshot operacional de PACO.");
}
