import fs from "node:fs";
import path from "node:path";
import { readDomainSource, readModuleSource } from "../tests/read-domain-source.mjs";
import {readOperationalSource} from './read-operational-source.mjs';

export function readRuntimeContractContext({ root, read, walk }){
  const responsive=read("assets/js/modules/responsive-foundation-v11190.js");
  const popupUx=read("assets/js/modules/popup-ux-v1190.js");
  const approvalsModule=read("assets/js/modules/approvals.js");
  const operational=readOperationalSource();
  const coreUi=readModuleSource("assets/js/core/ui","assets/js/core/ui.js");
  const adminWrapper=read("assets/js/modules/admin.js");
  const adminVerification=read("assets/js/modules/admin-user-verification-v11320.js");
  const supabaseConfig=read("supabase/config.toml");
  const shippingFlow=readDomainSource("logistics/shipping","assets/js/modules/shipping-flow.js");
  const sentOrders=read("assets/js/modules/sent-orders.js");
  const api=read("assets/js/services/api.js");
  const reportsEnterprise=readDomainSource("analytics/reports","assets/js/domains/analytics/reports/index.js");
  const jsFiles=walk(path.join(root,"assets/js")).filter(file=>file.endsWith(".js"));
  const jsRuntime=jsFiles.map(file=>fs.readFileSync(file,"utf8")).join("\n");
  const normalizedJsRuntime=jsRuntime
    .replace(/\bArray\s*\.\s*from\s*\(/g,"Array_from(")
    .replace(/\bObject\s*\.\s*fromEntries\s*\(/g,"Object_fromEntries(");
    return { responsive, popupUx, approvalsModule, operational, coreUi, adminWrapper, adminVerification, supabaseConfig, shippingFlow, sentOrders, api, reportsEnterprise, jsFiles, jsRuntime, normalizedJsRuntime };
}
