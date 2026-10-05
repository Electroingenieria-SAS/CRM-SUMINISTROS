-- Run against a migrated database. Evaluates the actual production CHECK without data writes.
do $test$
declare
  expression text;
  code text;
  accepted boolean;
begin
  select pg_get_expr(conbin, conrelid) into strict expression
  from pg_constraint
  where conrelid = 'erp_supply.delivery_milestones'::regclass
    and conname = 'delivery_milestones_milestone_code_check';
  foreach code in array array[
    'GUIDE_ADDED', 'LOCATION_CAPTURED', 'DISPATCHED', 'CLOSURE_ASSIGNED',
    'DELIVERY_EVIDENCE_UPLOADED', 'DELIVERED', 'NO_DELIVERY_REPORTED',
    'LOCAL_LOAD_REGISTERED', 'LOCAL_RETURN_RECORDED'
  ] loop
    execute 'select ' || replace(expression, 'milestone_code', quote_literal(code)) into accepted;
    if accepted is distinct from true then
      raise exception 'Milestone contract rejects %', code;
    end if;
  end loop;
  execute 'select ' || replace(expression, 'milestone_code', quote_literal('INVALID_TEST_CODE')) into accepted;
  if accepted is distinct from false then
    raise exception 'Milestone contract accepts an unknown code';
  end if;
end $test$;
select 'PASS: all legacy/local milestones accepted; unknown codes rejected' as result;
