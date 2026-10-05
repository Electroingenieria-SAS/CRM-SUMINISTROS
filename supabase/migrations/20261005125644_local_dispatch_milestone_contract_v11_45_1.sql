begin;
set local lock_timeout = '5s';
alter table erp_supply.delivery_milestones
  drop constraint delivery_milestones_milestone_code_check;
alter table erp_supply.delivery_milestones
  add constraint delivery_milestones_milestone_code_check
  check (milestone_code in (
    'GUIDE_ADDED', 'LOCATION_CAPTURED', 'DISPATCHED', 'CLOSURE_ASSIGNED',
    'DELIVERY_EVIDENCE_UPLOADED', 'DELIVERED', 'NO_DELIVERY_REPORTED',
    'LOCAL_LOAD_REGISTERED', 'LOCAL_RETURN_RECORDED'
  ));
commit;
