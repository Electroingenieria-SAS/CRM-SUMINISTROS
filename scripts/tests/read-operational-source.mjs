import {readDomainSource,readModuleSource} from './read-domain-source.mjs';

export function readOperationalSource(){
  const domains=['analytics/operational-dashboard','receiving/operational','billing/operational','logistics/operational'];
  return readModuleSource('assets/js/core/layout/operational')+'\n'
    +domains.map(domain=>readDomainSource(domain)).join('\n');
}
