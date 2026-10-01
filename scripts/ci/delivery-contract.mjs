import path from "node:path";

export function validateDeliveryContract({ root, check, exists, rel, walk, main, vercel, api }){
  const workflows=walk(path.join(root,".github/workflows")).filter(file=>/\.ya?ml$/i.test(file)).map(rel);
  check(workflows.length===1&&workflows[0]===".github/workflows/validate-crm.yml","Debe existir una sola CI canónica.");
  check(vercel.includes('"main": false')&&vercel.includes('"*": false'),"Vercel Git auto-deploy debe permanecer deshabilitado; releases salen por GitHub Actions.");
  check(exists(".vercelignore"),"Falta .vercelignore.");
  check(main.includes('installPacoAssistant();')&&main.includes('initRouter('),"main.js perdió el arranque principal.");
  check(api.includes('pacoSnapshot:()=>rpc("erp_x_paco_snapshot")'),"API debe exponer el snapshot operacional de PACO.");
}
