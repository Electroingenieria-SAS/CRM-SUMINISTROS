# Entregas, satisfacción y distancia · V11.31.0

## Objetivo

Separar tres momentos que antes podían confundirse:

1. **Salida / despacho:** inicia en `dispatched_at`.
2. **Entrega logística:** se registra en `delivered_at` cuando Logística completa cierre y evidencia.
3. **Entrega con satisfacción:** confirmación posterior del resultado con el cliente, registrada en `satisfaction_confirmed_at`.

La confirmación de satisfacción **no sustituye ni modifica** la hora real de entrega logística y no reabre un pedido cerrado.

## Distancia recorrida

La distancia se registra **después de la entrega**, durante la confirmación de satisfacción.

Campos:

- `distance_km`;
- `distance_source`;
- `distance_recorded_at`;
- `distance_recorded_by`.

Fuentes aceptadas:

- `CARRIER_REPORTED` — transportadora;
- `ODOMETER_GPS` — odómetro/GPS;
- `ROUTE_ESTIMATE` — distancia estimada de ruta;
- `CLIENT_CONFIRMED` — confirmada con el cliente;
- `OTHER` — otra fuente verificable.

Para `LOCAL_DISPATCH` y `NATIONAL_DISPATCH` la distancia es obligatoria y debe ser mayor que cero. En `CLIENT_POINT` y `CLIENT_PICKUP` puede dejarse vacía cuando no exista recorrido atribuible al despacho.

No se calcula automáticamente una distancia vial desde una dirección textual porque el CRM no dispone hoy de un proveedor de routing/geocoding contractual. Registrar una estimación como si fuera recorrido real degradaría la calidad del indicador.

## Satisfacción

Campos:

- `satisfaction_status = 'SATISFIED'`;
- `satisfaction_confirmed_at`;
- `satisfaction_confirmed_by`;
- `satisfaction_note`.

El RPC `public.erp_x_shipping_confirm_satisfaction(uuid,jsonb)`:

- exige una entrega logística previa;
- bloquea confirmación si existe novedad abierta;
- valida propiedad comercial para el rol Ventas;
- permite Super Admin y Jefatura Logística;
- registra milestone y evento de auditoría;
- conserva el estado `DELIVERED` para no alterar contratos históricos.

## Tiempos

Se conservan y distinguen:

| Métrica | Inicio | Fin |
|---|---|---|
| Tránsito logístico | `dispatched_at` | `delivered_at` |
| Tiempo hasta satisfacción | `dispatched_at` | `satisfaction_confirmed_at` |
| Confirmación post-entrega | `delivered_at` | `satisfaction_confirmed_at` |

El RPC de pedidos enviados entrega tanto tiempo calendario como tiempo laboral para los dos primeros indicadores cuando aplica.

## Analítica

El dataset **Entregas** admite desde V11.31.0:

- entregas;
- entregas completadas;
- entregas con satisfacción;
- costo logístico;
- tránsito promedio;
- distancia total;
- distancia promedio;
- tiempo promedio hasta satisfacción;
- demora promedio entre entrega y confirmación.

La exportación de Entregas incluye los campos de distancia, satisfacción, receptor y las tres duraciones.

## Trazabilidad

Primer registro:

- milestone: `DELIVERED_SATISFIED`;
- evento: `DELIVERY_SATISFACTION`.

Una actualización posterior controlada registra:

- milestone: `DELIVERY_REVIEW_UPDATED`;
- evento: `DELIVERY_REVIEW_UPDATE`.
