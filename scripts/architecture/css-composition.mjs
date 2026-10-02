import path from "node:path";

export function validateCssComposition({ root, check, exists, rel, walk, version, index, sw, coreCss, experienceCss }){
  const canonicalCss=["assets/css/core-shell.css","assets/css/operations.css","assets/css/analytics.css","assets/css/experience.css"];
  const cssRefs=[...index.matchAll(/href="\.\/([^"?#]+)(?:\?v=([^"#]+))?"/g)].filter(m=>m[1].endsWith(".css"));
  check(cssRefs.length===4,"index.html debe cargar exactamente cuatro familias CSS canónicas.");
  check(JSON.stringify(cssRefs.map(m=>m[1]))===JSON.stringify(canonicalCss),"El orden CSS canónico es inválido.");
  check(cssRefs.every(m=>m[2]===version),"Todas las familias CSS deben usar la versión vigente.");
  for(const cssPath of canonicalCss)check(exists(cssPath),`Falta CSS canónico: ${cssPath}`);
  const runtimeCss=[
    "assets/runtime-css/guides-layout-v11291.css",
    "assets/runtime-css/receiving-workspace-v11290.css",
    "assets/runtime-css/inventory-dialogs-v11260.css",
    "assets/runtime-css/inventory-visual-v11270.css",
    "assets/runtime-css/inventory-ui-v11240.css",
    "assets/runtime-css/inventory-workspace-v11251.css"
  ];
  for(const cssPath of runtimeCss){
    check(exists(cssPath),`Falta CSS runtime externalizado: ${cssPath}`);
    check(sw.includes("./"+cssPath),`PWA debe precachear ${cssPath}`);
  }
  check(walk(path.join(root,"assets/css")).filter(file=>file.endsWith(".css")).map(rel).every(file=>canonicalCss.includes(file)||/^assets\/css\/(?:tokens|base|components|modules|core)\/.+\.css$/.test(file)),"assets/css conserva una familia no canónica.");
  check((coreCss.match(/:root\{/g)||[]).length===1,"core-shell.css debe conservar una sola raíz de tokens.");
  check(coreCss.includes('font-family:"Century Gothic"'),"Falta tipografía institucional.");
  check(experienceCss.includes('.paco2-panel{display:none!important}'),"Se perdió el contrato visual de Paco.");
}
