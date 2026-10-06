

export function validatePwaRouting({ check, index, sw, vercel }){
  check(sw.includes('// previous-cache: crm-suministros-v11-45-0-20261002-39'),"previous-cache PWA debe apuntar a V11.45.0.");
  check(sw.includes('const CACHE="crm-suministros-v11-46-0-20261006-40";'),"CACHE activo PWA no corresponde a V11.46.0.");
  check(sw.includes('caches.match(event.request,{ignoreSearch:true})'),"PWA debe resolver assets versionados.");
  check(index.includes('<link rel="manifest" href="./manifest.webmanifest">'),"index.html debe declarar el manifest PWA.");
  check(vercel.includes('manifest\\\\.webmanifest')||vercel.includes('/manifest.webmanifest'),"Vercel debe excluir o tratar explícitamente el manifest real.");
  check(vercel.includes('/service-worker.js')&&vercel.includes('no-cache, no-store, must-revalidate'),"Service worker debe revalidarse en cada release.");
  check(!/style-src(?!-)[^;]*'unsafe-inline'/i.test(vercel),"CSP no debe permitir unsafe-inline en style-src general.");
  check(/style-src-attr[^;]*'unsafe-inline'/i.test(vercel),"La excepción temporal debe limitarse a style-src-attr.");
}
