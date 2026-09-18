-- CRM SUMINISTROS V11.31.0
-- Ajuste de índices de la trazabilidad post-entrega:
-- retira índices temporales sin hot path y cubre las dos nuevas FKs de actor.

drop index if exists erp_supply.idx_deliveries_satisfaction_confirmed_v1131;
drop index if exists erp_supply.idx_deliveries_distance_recorded_v1131;

create index if not exists idx_deliveries_distance_recorded_by_v1131
  on erp_supply.deliveries(distance_recorded_by)
  where distance_recorded_by is not null;

create index if not exists idx_deliveries_satisfaction_confirmed_by_v1131
  on erp_supply.deliveries(satisfaction_confirmed_by)
  where satisfaction_confirmed_by is not null;
