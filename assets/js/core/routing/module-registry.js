import {renderDashboard} from "../../modules/dashboard.js";
import {renderOrders} from "../../modules/orders.js";
import {renderInventory} from "../../modules/inventory.js";
import {renderApprovals} from "../../modules/approvals.js";
import {renderVsm} from "../../modules/vsm.js";
import {renderImports} from "../../modules/imports.js";
import {renderAudit} from "../../modules/audit.js";
import {renderAdmin} from "../../modules/admin.js";
import {renderCredit} from "../../modules/credit.js";
import {renderReports} from "../../modules/reports.js";
import {renderCutting} from "../../modules/cutting-flow.js";
import {renderWorkforce} from "../../modules/workforce.js";
import {renderReceivingHub} from "../../domains/receiving/index.js";
import {enhanceOperationalDashboard} from "../layout/operational/index.js";
import {enhanceFreightIntelligenceDashboard} from "../../modules/freight-intelligence-v11410.js";

const ROUTES={
  dashboard:async root=>{await renderDashboard(root);await enhanceOperationalDashboard(root);await enhanceFreightIntelligenceDashboard(root)},
  orders:renderOrders,
  sales:renderOrders,
  credit:renderCredit,
  receiving:renderReceivingHub,
  inventory:renderInventory,
  approvals:renderApprovals,
  vsm:renderVsm,
  imports:renderImports,
  audit:renderAudit,
  admin:renderAdmin,
  reports:renderReports,
  cutting:renderCutting,
  workforce:renderWorkforce
};

const QUEUE_MODULES={
  cartera:["CARTERA"],
  caja:["CAJA","CAJA_FACTURACION"],
  purchasing:["COMPRAS"],
  picking:["ALISTAMIENTO"],
  billing:["FACTURACION"],
  shipping:["CLIENT_POINT","CLIENT_PICKUP","LOCAL_DISPATCH","NATIONAL_DISPATCH","CLOSURE"]
};

function ownRegistryValue(registry,key){
  return Object.prototype.hasOwnProperty.call(registry,key)?registry[key]:null;
}

export function registeredModuleIds(){
  return [...Object.keys(ROUTES),...Object.keys(QUEUE_MODULES)];
}

export function rendererFor(moduleId){
  return ownRegistryValue(ROUTES,moduleId);
}

export function queueStepsFor(moduleId){
  const steps=ownRegistryValue(QUEUE_MODULES,moduleId);
  return steps?[...steps]:null;
}

export function moduleReadable(modules,moduleId){
  return Boolean(modules?.find(module=>module.code===moduleId)?.canRead);
}

export function firstReadableModule(modules){
  return modules?.find(module=>module.canRead)?.code||"dashboard";
}

export async function renderModule(moduleId,root,context){
  switch(moduleId){
    case "orders":
    case "sales": return ROUTES.orders(root,context);
    case "credit": return ROUTES.credit(root,context);
    case "receiving": return ROUTES.receiving(root,context);
    case "inventory": return ROUTES.inventory(root,context);
    case "approvals": return ROUTES.approvals(root,context);
    case "vsm": return ROUTES.vsm(root,context);
    case "imports": return ROUTES.imports(root,context);
    case "audit": return ROUTES.audit(root,context);
    case "admin": return ROUTES.admin(root,context);
    case "reports": return ROUTES.reports(root,context);
    case "cutting": return ROUTES.cutting(root,context);
    case "workforce": return ROUTES.workforce(root,context);
    case "dashboard":
    default: return ROUTES.dashboard(root,context);
  }
}
