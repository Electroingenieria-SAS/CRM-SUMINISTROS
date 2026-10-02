import { installDialogSystem } from "./dialog.js";
import { renderWizardShell } from "./wizard-shell.js";
import { prepareWizardNavigation, bindWizardNavigation } from "./wizard-navigation.js";

export function wizard({
  title,
  subtitle="Completa la información requerida en cada etapa del proceso.",
  steps=[],
  finishLabel="Confirmar y guardar",
  cancelLabel="Cancelar",
  size="wide",
  onFinish
}){
const wizardState={title,subtitle,steps,finishLabel,cancelLabel,size,onFinish};
prepareWizard(wizardState);
renderWizardShell(wizardState);
prepareWizardNavigation(wizardState);
return bindWizardNavigation(wizardState);
}

export function prepareWizard(wizardState){
if(!wizardState.steps.length)throw new Error("El asistente necesita al menos un paso.");
installDialogSystem();
wizardState.root=document.querySelector("#modal-root");
wizardState.titleId=`erp-dialog-title-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;
}
