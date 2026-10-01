import { num } from "../shared/flow-values.js";
import { buildDiagnostics } from "../analysis/flow-diagnostics.js";
import { flowSummaryHtml, flowDiagnosticsHtml } from "../sections/summary.js";
import { flowMapHtml, flowCapacityHtml } from "../sections/capacity.js";
import { flowDailyHtml } from "../sections/daily.js";
import { flowOrdersHtml, flowPartialHtml } from "../sections/orders.js";
import { flowTraceabilityHtml } from "../sections/traceability.js";

export function renderFlow(data,partialData){
const flowView={data,partialData};
calculateFlowContext(flowView);
return renderFlowContent(flowView);
}

export function calculateFlowContext(flowView){
flowView.summary=flowView.data.summary||{};
flowView.steps=flowView.data.steps||[];
flowView.throughput=flowView.data.throughput||[];
flowView.atRisk=flowView.data.atRisk||[];
flowView.slowest=flowView.data.slowestOrders||[];
flowView.partials=flowView.partialData?.orders||[];
flowView.range=flowView.data.range||{};
flowView.diagnostics=buildDiagnostics(flowView.summary,flowView.steps,flowView.throughput);
flowView.completed=num(flowView.summary.completedTasks);
flowView.closed=num(flowView.summary.closedOrders);
flowView.waitShare=num(flowView.summary.totalStageLeadHours)>0?num(flowView.summary.totalWaitHours)/num(flowView.summary.totalStageLeadHours)*100:0;
flowView.coverageClass=flowView.completed>=30?"good":flowView.completed>=10?"medium":"low";
}

export function renderFlowContent(flowView){
return flowSummaryHtml(flowView)+flowDiagnosticsHtml(flowView)+flowMapHtml(flowView)+flowCapacityHtml(flowView)+flowDailyHtml(flowView)+flowOrdersHtml(flowView)+flowPartialHtml(flowView)+flowTraceabilityHtml(flowView);
}
