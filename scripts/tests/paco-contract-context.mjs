import { readDomainSource } from "../tests/read-domain-source.mjs";

export function readPacoContractContext({ read }){
  const pacoEntry=read("assets/js/domains/paco/index.js");
  const pacoOperational=readDomainSource("paco");
  const pacoLanguage=readDomainSource("paco/language");
    return { pacoEntry, pacoOperational, pacoLanguage };
}
