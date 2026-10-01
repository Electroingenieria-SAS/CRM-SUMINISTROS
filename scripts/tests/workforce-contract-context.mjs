import { readDomainSource } from "../tests/read-domain-source.mjs";

export function readWorkforceContractContext({ read }){
  const workforce=readDomainSource("workforce");
  const workforcePlanner=readDomainSource("workforce/planner");
  const workforceToday=read("assets/js/domains/workforce/today/time-traffic.js");
  const workforceManager=read("assets/js/domains/workforce/analytics/time-review.js");
  const workforceCatalog=readDomainSource("workforce/catalog");
  const workforceExperience=read("assets/js/domains/workforce/today/experience-styles.js");
  const workforceTimeline=readDomainSource("workforce/timeline");
  const workforceEvidenceManager=readDomainSource("workforce/evidence");
  const workforceCalendar=readDomainSource("workforce/calendar");
    return { workforce, workforcePlanner, workforceToday, workforceManager, workforceCatalog, workforceExperience, workforceTimeline, workforceEvidenceManager, workforceCalendar };
}
