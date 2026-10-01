import { isoDay, daysBefore } from "./shared/flow-values.js";
import { renderVsmShell } from "./ui/vsm-shell.js";
import { prepareVsmLoading, loadInitialVsm } from "./data/load-vsm.js";
import { bindVsmControls } from "./ui/vsm-controls.js";

export async function renderVsm(root){
const vsm={root};
prepareVsmContext(vsm);
renderVsmShell(vsm);
prepareVsmLoading(vsm);
bindVsmControls(vsm);
await loadInitialVsm(vsm);
}

export function prepareVsmContext(vsm){
vsm.today=new Date();
vsm.to=isoDay(vsm.today);
vsm.initialFrom=daysBefore(29,vsm.today);
vsm.lastData=null;
vsm.lastPartial={orders:[]};
}
