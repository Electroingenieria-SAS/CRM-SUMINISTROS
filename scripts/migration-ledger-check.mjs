import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const ledgerPath=path.join(root,"supabase/production-migration-ledger.json");
const migrationDir=path.join(root,"supabase/migrations");
const failures=[];

if(!fs.existsSync(ledgerPath))failures.push("Falta supabase/production-migration-ledger.json.");
const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,"utf8")):{};
const migrationFiles=fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).sort()
  : [];

const debt=Array.isArray(ledger.knownDatabaseOnly)?ledger.knownDatabaseOnly:[];
if(debt.length!==Number(ledger.debtBudget))failures.push(`La deuda histórica cambió: ledger=${debt.length}, budget=${ledger.debtBudget}.`);
if(new Set(debt).size!==debt.length)failures.push("El ledger contiene migraciones database-only duplicadas.");

for(const alias of ledger.equivalentRepositoryAliases||[]){
  const rel=String(alias.repositoryFile||"");
  if(!rel||!fs.existsSync(path.join(root,rel)))failures.push(`Alias de migración sin archivo: ${alias.productionName} -> ${rel}`);
}
if(!migrationFiles.some(name=>name==="114_impersonation_metrics_security_v11_32_0.sql"))failures.push("Falta la migración canónica V11.32.0.");
if(fs.existsSync(path.join(root,"sql/00_INSTALL_ALL.sql")))failures.push("No se debe reintroducir sql/00_INSTALL_ALL.sql como instalador actual: es un artefacto histórico incompleto.");

const badNames=migrationFiles.filter(name=>!/^(?:\d{3}|\d{14})_[a-z0-9_]+\.sql$/i.test(name));
if(badNames.length)failures.push(`Migraciones con nombre no canónico: ${badNames.join(", ")}`);

if(failures.length){
  console.error("MIGRATION LEDGER CHECK FALLÓ");
  failures.forEach(item=>console.error(`- ${item}`));
  process.exit(1);
}
console.log(`MIGRATION LEDGER OK · ${migrationFiles.length} migraciones versionadas · deuda histórica congelada en ${debt.length} entradas database-only.`);
console.log("El ledger evita que la brecha histórica crezca; una reconstrucción source-only completa requiere todavía un baseline validado de producción.");
