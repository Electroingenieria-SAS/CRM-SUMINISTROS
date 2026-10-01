const timestamp=/^\d{14}$/;
const md5=/^[a-f0-9]{32}$/;

export function validateReconciledHistory(ledger,{exists,check}){
  const applied=ledger.verifiedApplied||[];
  check(new Set(applied.map(row=>row.productionVersion)).size===applied.length,'Applied ledger versions must be unique.');
  for(const row of applied){
    check(timestamp.test(row.productionVersion),'Applied migration lacks its real production timestamp.');
    check(row.repositoryFile&&exists(row.repositoryFile),'Applied migration lacks a repository source.');
    check(md5.test(row.statementsMd5),'Applied migration lacks its verified statement hash.');
  }
  for(const row of ledger.repositoryHistoryEvidence||[]){
    check(row.repositoryFile&&exists(row.repositoryFile),'Historical migration evidence lacks a repository source.');
    check(['effect-present-history-row-absent','historical-repository-evidence'].includes(row.status),'Historical evidence has an unknown status.');
    if(row.status==='effect-present-history-row-absent'){
      check(!applied.some(entry=>entry.repositoryFile===row.repositoryFile),'An absent history row cannot also be declared applied.');
    }else{
      check(timestamp.test(row.productionVersion),'Historical SQL lacks its real production version.');
      check(md5.test(row.productionStatementsMd5),'Historical SQL lacks its production statement hash.');
    }
  }
  for(const row of ledger.duplicateAppliedHistory||[]){
    const versions=row.productionVersions||[];
    check(versions.length>=2&&versions.every(version=>timestamp.test(version))&&new Set(versions).size===versions.length,'Duplicate history must retain distinct real versions.');
    check(md5.test(row.statementsMd5)&&row.status==='identical-duplicate-history','Duplicate history lacks evidence of identical SQL.');
  }
}
