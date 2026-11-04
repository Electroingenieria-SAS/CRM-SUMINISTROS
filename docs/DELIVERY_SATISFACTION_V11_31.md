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

## Actualización de captura automática · noviembre de 2026

El usuario **ya no ve ni completa** un campo de kilómetros ni una fuente manual en la confirmación de satisfacción.

El cliente toma el municipio y departamento de salida desde los ajustes de la organización, y el destino desde el envío. Resuelve coordenadas de los centroides municipales con el conjunto DIVIPOLA publicado en datos.gov.co y solicita una ruta para automóvil a FOSSGIS/OSRM utilizando OpenStreetMap. La distancia se guarda como `ROUTE_ESTIMATE` (estimación vial), **no como kilometraje real medido**. Se envían solo los centroides de los municipios y se reutiliza una ruta calculada mediante caché por 30 días.

- Si origen y destino pertenecen al mismo municipio, no se inventa una distancia con centroides coincidentes: queda pendiente hasta contar con geocodificación exacta o un recorrido GPS real.
- Si el destino no tiene municipio/departamento reconocible, o falla la API pública de carreteras, el dato queda en `NULL` y se puede confirmar satisfacción sin teclear kilometraje.
- Si la distancia ya había sido registrada desde una fuente anterior, se preserva.
- Se mantiene el control de permisos en la RPC geográfica y el aislamiento por organización y asesor comercial.
- Esta integración de bajo volumen depende de la disponibilidad y de las condiciones de uso del servicio comunitario de rutas. Antes de escalar su uso conviene contratar o alojar una API de routing y usar coordenadas precisas de las direcciones.
- El listado **Pedidos enviados** identifica una ruta estimada con prefijo aproximado (`~`) y no transforma los valores pendientes en cero.

La regla de kilometraje obligatorio descrita en la versión 11.31 fue sustituida: la confirmación ya **no se bloquea** por un servicio de rutas caído. La restricción histórica de hitos de entrega también se actualizó para aceptar `DELIVERED_SATISFIED` y `DELIVERY_REVIEW_UPDATED`.

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
