// Compatibility entrypoint.
// PACO V11.37.0 lives in a single operational runtime.
import {installPacoAssistant as installOperationalPaco} from "./paco-operational-v11370.js";

export function installPacoAssistant(){
  return installOperationalPaco();
}
