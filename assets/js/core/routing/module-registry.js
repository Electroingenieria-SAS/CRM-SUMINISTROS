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

export function registeredModuleIds(){
  return [...Object.keys(ROUTES),...Object.keys(QUEUE_MODULES)];
}

export function rendererFor(moduleId){
  return ROUTES[moduleId]||null;
}

export function queueStepsFor(moduleId){
  const steps=QUEUE_MODULES[moduleId];
  return steps?[...steps]:null;
}

export function moduleReadable(modules,moduleId){
  return Boolean(modules?.find(module=>module.code===moduleId)?.canRead);
}

export function firstReadableModule(modules){
  return modules?.find(module=>module.canRead)?.code||"dashboard";
}

export async function renderModule(moduleId,root,context){
  return (ROUTES[moduleId]||ROUTES.dashboard)(root,context);
}
