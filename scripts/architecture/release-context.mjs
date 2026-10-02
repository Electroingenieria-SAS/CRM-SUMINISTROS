

export function readReleaseContext({ read }){
  const pkg=JSON.parse(read("package.json"));
  const pkgLock=JSON.parse(read("package-lock.json"));
  const config=read("assets/js/config.js");
  const version=config.match(/version:\s*"([^"]+)"/)?.[1]||"";
  const build=config.match(/build:\s*"([^"]+)"/)?.[1]||"";
  const index=read("index.html");
  const entry=read("assets/js/app-entry.js");
  const main=read("assets/js/main.js");
  const sw=read("service-worker.js")+"\n"+read("assets/precache-manifest.json");
  const vercel=read("vercel.json");
  const workflow=read(".github/workflows/validate-crm.yml");
    return { pkg, pkgLock, config, version, build, index, entry, main, sw, vercel, workflow };
}
