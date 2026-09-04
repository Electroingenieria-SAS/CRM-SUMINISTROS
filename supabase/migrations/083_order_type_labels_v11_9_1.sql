-- CRM Suministros V11.9.1
-- Los tipos comerciales se identifican exclusivamente por su código oficial.
update erp_supply.order_types
set name = code
where code in ('PVC','PVN','PVE','PVP');
