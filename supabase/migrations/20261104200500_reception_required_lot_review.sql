-- Recepción de pedidos: números de lote obligatorios por cada material.
-- Se valida solo una confirmación NUEVA; los pedidos históricos no se modifican.
-- No cambia reservas/consumos ni sustituye el inventario físico de Alistamiento/Corte.

create or replace function erp_supply.enforce_reception_documentary_lots()
returns trigger
language plpgsql
security invoker
set search_path=erp_supply,pg_catalog
as $$
declare
  v_lots jsonb;
  v_value jsonb;
  v_number text;
  v_seen text[]:=array[]::text[];
begin
  -- Únicamente se evalúa cuando la RPC de Recepción confirma/reconfirma la línea.
  if coalesce(new.metadata->>'receptionActive','false')<>'true'
     or new.metadata->>'confirmedAt' is null then
    return new;
  end if;
  if tg_op='UPDATE'
     and old.metadata->>'confirmedAt' is not distinct from new.metadata->>'confirmedAt' then
    return new;
  end if;

  v_lots:=new.metadata->'receptionLotNumbers';
  if coalesce(new.metadata->>'receptionLotReviewed','false')<>'true' then
    raise exception 'Debes verificar los lotes del material antes de confirmar Recepción';
  end if;
  if jsonb_typeof(v_lots) is distinct from 'array'
     or jsonb_array_length(v_lots) not between 1 and 20 then
    raise exception 'Cada material debe tener de 1 a 20 números de lote';
  end if;
  if coalesce(new.metadata->>'receptionLotSource','') not in ('PDF','MANUAL') then
    raise exception 'Origen de lote inválido para Recepción';
  end if;
  for v_value in select value from jsonb_array_elements(v_lots) loop
    if jsonb_typeof(v_value)<>'string' then
      raise exception 'El número de lote debe ser texto';
    end if;
    v_number:=btrim(v_value#>>'{}');
    if length(v_number)<1 or length(v_number)>80
       or v_number ~ '[[:cntrl:]<>]' then
      raise exception 'Número de lote vacío o inválido';
    end if;
    if upper(v_number)=any(v_seen) then
      raise exception 'No repitas el mismo número de lote para un material';
    end if;
    v_seen:=array_append(v_seen,upper(v_number));
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_reception_required_documentary_lots on erp_supply.order_items;
create trigger trg_reception_required_documentary_lots
before insert or update of metadata on erp_supply.order_items
for each row execute function erp_supply.enforce_reception_documentary_lots();

comment on function erp_supply.enforce_reception_documentary_lots()
is 'Valida lotes documentales obligatorios al confirmar nuevas líneas de Recepción; protege registros históricos sin revalidarlos.';
