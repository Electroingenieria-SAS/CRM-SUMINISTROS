import path from "node:path";

export function validateDeliveryContract({ root, check, exists, rel, walk, read, main, vercel, api }){
  const workflows=walk(path.join(root,".github/workflows")).filter(file=>/\.ya?ml$/i.test(file)).map(rel);
  const application=read("assets/js/core/bootstrap/application.js");
  const authenticatedBootstrap=read("assets/js/core/bootstrap/authenticated-bootstrap.js");
  const runtimeInstallers=read("assets/js/core/bootstrap/runtime-installers.js");

  check(workflows.length===1&&workflows[0]===".github/workflows/validate-crm.yml","Debe existir una sola CI canónica.");
  check(vercel.includes('"main": false')&&vercel.includes('"*": false'),"Vercel Git auto-deploy debe permanecer deshabilitado; releases salen por GitHub Actions.");
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
