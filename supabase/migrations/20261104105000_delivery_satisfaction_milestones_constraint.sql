-- Reparación del flujo de satisfacción: la restricción histórica omitía los dos
-- hitos que public.erp_x_shipping_confirm_satisfaction ya emitía desde V11.31.
alter table erp_supply.delivery_milestones
  drop constraint if exists delivery_milestones_milestone_code_check;
alter table erp_supply.delivery_milestones
  add constraint delivery_milestones_milestone_code_check
  check (milestone_code in (
    'GUIDE_ADDED','LOCATION_CAPTURED','DISPATCHED','CLOSURE_ASSIGNED',
    'DELIVERY_EVIDENCE_UPLOADED','DELIVERED','NO_DELIVERY_REPORTED',
    'LOCAL_LOAD_REGISTERED','LOCAL_RETURN_RECORDED',
    'DELIVERED_SATISFIED','DELIVERY_REVIEW_UPDATED'
  ));
