import path from "node:path";
import {readCssSource} from "../tests/read-css-source.mjs";

export function readCssContractContext({ root }){
  const workforceExperienceCss=readCssSource(path.join(root,"assets/runtime-css/workforce-experience-v11344.css"));
  const workforceTimelineCss=readCssSource(path.join(root,"assets/runtime-css/workforce-timeline-v11350.css"));
  const workforceCalendarCss=readCssSource(path.join(root,"assets/runtime-css/workforce-calendar-v11360.css"));
  const analyticsCss=readCssSource(path.join(root,"assets/css/analytics.css"));
  const operationsCss=readCssSource(path.join(root,"assets/css/operations.css"));
  const coreCss=readCssSource(path.join(root,"assets/css/core-shell.css"));
  const experienceCss=readCssSource(path.join(root,"assets/css/experience.css"));
  const pacoOperationalCss=readCssSource(path.join(root,"assets/runtime-css/paco-operational-v11370.css"));
    return { workforceExperienceCss, workforceTimelineCss, workforceCalendarCss, analyticsCss, operationsCss, coreCss, experienceCss, pacoOperationalCss };
}
