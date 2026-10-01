import { createValidationContext } from "./ci/validation-context.mjs";
import { validateReleaseIdentity } from "./architecture/release-identity.mjs";
import { validateWorkforceBootstrap } from "./tests/workforce-bootstrap-contract.mjs";
import { validateRequiredMigrationContracts } from "./database/required-migration-contracts.mjs";
import { validatePacoRuntime } from "./tests/paco-runtime-contract.mjs";
import { validateInventoryBootstrap } from "./architecture/inventory-bootstrap.mjs";
import { validateCssComposition } from "./architecture/css-composition.mjs";
import { validatePwaRouting } from "./architecture/pwa-routing.mjs";
import { validateBrowserBoundaries } from "./security/browser-boundaries.mjs";
import { validateWorkforceRuntime } from "./tests/workforce-runtime-contract.mjs";
import { validateDatabaseSecurityPerformance } from "./database/security-performance-contract.mjs";
import { validateFrontendSecurity } from "./security/frontend-contract.mjs";
import { validatePopupLayout } from "./tests/popup-layout-contract.mjs";
import { validateInventoryAccounting } from "./database/inventory-accounting-contract.mjs";
import { validateInventoryOwnership } from "./architecture/inventory-ownership.mjs";
import { validateInventoryRuntime } from "./tests/inventory-runtime-contract.mjs";
import { validateInventoryDialogs } from "./tests/inventory-dialog-contract.mjs";
import { validateDeliveryContract } from "./ci/delivery-contract.mjs";

const gates=[
  ["release-identity",validateReleaseIdentity],
  ["workforce-bootstrap-contract",validateWorkforceBootstrap],
  ["required-migration-contracts",validateRequiredMigrationContracts],
  ["paco-runtime-contract",validatePacoRuntime],
  ["inventory-bootstrap",validateInventoryBootstrap],
  ["css-composition",validateCssComposition],
  ["pwa-routing",validatePwaRouting],
  ["browser-boundaries",validateBrowserBoundaries],
  ["workforce-runtime-contract",validateWorkforceRuntime],
  ["security-performance-contract",validateDatabaseSecurityPerformance],
  ["frontend-contract",validateFrontendSecurity],
  ["popup-layout-contract",validatePopupLayout],
  ["inventory-accounting-contract",validateInventoryAccounting],
  ["inventory-ownership",validateInventoryOwnership],
  ["inventory-runtime-contract",validateInventoryRuntime],
  ["inventory-dialog-contract",validateInventoryDialogs],
  ["delivery-contract",validateDeliveryContract],
];
const requested=process.argv.indexOf("--gate");
const selected=requested<0?null:process.argv[requested+1];
if(requested>=0&&!gates.some(([name])=>name===selected))throw new Error("Unknown validation gate: "+selected);
const context=createValidationContext();
for(const [name,validate] of gates)if(!selected||name===selected)validate(context);
const {failures,version,build,jsFiles}=context;
if(failures.length){
  console.error(`VALIDACIÓN CRM ${version||"SIN VERSIÓN"} FALLÓ`);
  failures.forEach(item=>console.error(`- ${item}`));
  process.exitCode=1;
}else{
  console.log(`VALIDACIÓN CRM ${version} CORRECTA${selected?" · "+selected:""}`);
  console.log(`- Build ${build}; ${jsFiles.length} archivos JavaScript bajo un único app-entry.`);
  console.log("- Contratos estáticos de arquitectura, dominios, SQL y seguridad conservados.");
}
