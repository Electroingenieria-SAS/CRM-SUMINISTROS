function matchesDriveDeployment(config){
  const value=config.match(/^\s*bridgeUrl:\s*["']([^"']+)["']/m)?.[1];
  try{
    const url=new URL(value);
    return url.origin==="https://script.google.com"
      && url.pathname==="/macros/s/AKfycbwjl1JCfE0eV92P6DCn6h8jIVIBlSwLOQj8U7Mz1_7YW2Xan8DPI5tpWJuiG7znSCSs/exec"
      && !url.search && !url.hash && !url.username && !url.password;
  }catch{return false}
}

export function validateReleaseIdentity({ check, pkg, pkgLock, config, version, build, index }){
  check(version==="11.46.0","CONFIG.version debe ser 11.46.0.");
  check(build==="2026-10-06.40","CONFIG.build debe ser 2026-10-06.40.");
  check(pkg.version===version,"package.json y CONFIG.version deben coincidir.");
  check(pkgLock.version===version&&pkgLock.packages?.[""]?.version===version,"package-lock.json debe coincidir con la versión vigente.");
  check(index.includes(`app-entry.js?v=${version}`),"index.html debe cargar el entrypoint de la versión vigente.");
  check(index.includes('<meta name="robots" content="noindex,nofollow,noarchive">'),"CRM interno debe permanecer fuera de indexación pública.");
  check(matchesDriveDeployment(config),"CONFIG.drive.bridgeUrl debe apuntar a la implementación Apps Script 3.5.1 vigente.");
  check((index.match(/<script\s+type="module"\s+src="\.\/assets\/js\//g)||[]).length===1,"index.html debe tener un único entrypoint ES Module local.");
}
