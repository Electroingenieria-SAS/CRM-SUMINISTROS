# PROMPT PARA CHATGPT WORK — IMPLEMENTACIÓN DIRECTA DEL COTIZADOR DE FLETES

**ORDEN OBLIGATORIA: EJECUTAR, NO REINVESTIGAR TARIFAS**

Actúa como ingeniero senior de producto, desarrollador frontend modular, arquitecto PostgreSQL/Supabase y responsable de implementación. No entregues otro análisis del PDF. **Ya recibes el trabajo tarifario de TCC hecho:** toda la tabla digitalizada, los cálculos especificados, las restricciones y los casos de prueba. Tu tarea es **integrarlo en el CRM existente y rediseñar sus funciones de pedidos y cotización**; después integrar las tarifas de ENVÍA aportadas en un segundo prompt de Claude.

**Repositorio objetivo ÚNICO:** https://github.com/Electroingenieria-SAS/CRM-SUMINISTROS (rama base `main`). **No tocar:** `Electroingenieria-SAS/CRM` (repositorio diferente). Usar el proyecto Supabase que esté vinculado en realidad a `CRM-SUMINISTROS`: verificar identificador y entorno antes de escribir. Operar con cambios incrementales, branch nueva, PR y CI. Si tienes permisos y comprobaste que una migración es compatible, ejecútala también directamente en el proyecto correcto; no declares aplicado lo que solo dejaste en código.

## INSUMOS TERMINADOS QUE DEBES UTILIZAR

1. `TCC_TARIFAS_INTEGRACION_VERIFICADAS.csv` — 30.107 filas completas de rutas registradas, 30.086 valores PAQ numéricos legítimamente legibles, 21 PAQ sin precio por defecto físico en la página 4 de Barrancabermeja, 30.107 clasificaciones MSJ asociadas. Es **el conjunto definitivo que debes importar**, sin regenerar otro por tu cuenta.
2. `TCC_MODELO_MATEMATICO_Y_CONTRATO_DE_DATOS.md` — interpretación final del PDF, modelo de cotización, campos, condiciones TCC, tratamiento de costos reales y casos de prueba. **Implementa exactamente este contrato**.
3. `TCC_INFORME_CONTROL_EXTRACCION.json` — pruebas de integridad y casos especiales, incluyendo la homonimia/doble fila de San Pablo (Bolívar).
4. `Tarifas-tradicionales-2023-2024-1.pdf` — fuente original solo para **auditar las 21 celdas irrecuperables o resolver una discrepancia específica**; NO se te solicita leerlo ni digitalizarlo de nuevo. Su huella SHA-256 es `0a56ce97012329b5fa5a7fc758f628416a544e54ecd8417a0f26ddc595b98bb2`.

**PROHIBIDO utilizar el ZIP normalizado rechazado en conversaciones anteriores.** Ni descargarlo, ni mezclarlo, ni tomar cantidades o ejemplos de él. El CSV adjunto se creó nuevamente desde el PDF mediante análisis geométrico independiente y segunda comprobación textual; está listo para importarse. Evita gastar tiempo y recursos revisando una y otra vez las tablas: limítate a verificar checksum/esquema, integridad del lote e idempotencia de importación.

## OBJETIVO DEL NEGOCIO Y DISEÑO FINAL

Antes: en **Crear pedido** aparecen tarjetas y consultas automáticas de flete, un estimador y transportadoras.

Después: en **Crear pedido** ya **NO habrá nada de cotizar ni estimar fletes**. El formulario se concentra exclusivamente en cliente, datos comerciales del pedido, artículos, cantidades y los demás campos realmente exigidos por su operación. No debe calcular el transporte, ni presentar precios estimados, ni obligar a seleccionar transportadora para registrar el pedido. No borres requisitos de entrega/dirección que otros flujos genuinamente necesiten: desacopla sus dependencias de la cotización. Mantén funcionamiento de guías, despachos, Siesa, reservas e indicadores.

Crear en la navegación del CRM y/o en el módulo comercial una nueva **casilla/acción claramente visible llamada exactamente `Cotización de fletes`**. Debe ser un módulo independiente, completo, responsive y persistente, sin necesitar un pedido. Desde un pedido existente podrá abrirse opcionalmente prellenando artículos y municipio; guardar la cotización no crea ni modifica el pedido por sorpresa.

**La nueva casilla es el único sitio donde vivirá toda la máquina de cotización, tanto TCC como ENVÍA.** Mantén en el dashboard los indicadores históricos de predicho vs. real cuando sean pertinentes, pero sin generar consultas del estimador dentro del wizard de pedidos.

## TAREA TÉCNICA 1 — ELIMINAR FLETE DEL ASISTENTE CREAR PEDIDO

Partes verificadas en `main`:

- `assets/js/domains/orders/create/create-order.js` importa y llama a `estimatedSalesWeight`, `freightPredictionSnapshot` y `bindFreightPrediction`; en la confirmación agrega `estimatedMaterialWeightKg`, `freightPredictionVersion` y `freightPredictionAtCreation` como metadatos del pedido. Elimina dependencias de COTIZACIÓN en creación, conserva compatibilidad con pedidos históricos que ya tengan esos metadatos y no pierdas datos legítimos por cambios destructivos de esquema.
- `assets/js/domains/orders/create/order-form.js` contiene panel `data-freight-estimate`, `data-freight-carriers` y la tarjeta `data-material-freight-prediction`. Retíralos del paso de creación, incluida su lógica de consultas, estados `loading`, validaciones de costo y event listeners.
- `assets/js/domains/orders/freight/` contiene helpers de peso, predicción y presentación. **NO los borres sin examinar sus consumidores**: traslada/reutiliza la lógica en el módulo nuevo. Desacopla handlers de ciudad/materiales del evento automático de predicción.
- Verificar que se pueda crear un pedido nuevo sin flete ni cotización; validar que esto no afecte su estado ni los RPC de creación, que podrían tratar el campo de envío como obligatorio.

## TAREA TÉCNICA 2 — CASILLA «COTIZACIÓN DE FLETES»

Agregar módulo bajo Ventas/Pedidos, registrar su ruta/entrada, permisos y navegación en la arquitectura vigente (consultar `assets/js/core/routing/module-registry.js` y los metadatos de menú/RBAC reales, no crear un menú paralelo). Interfaz limpia y consistente con el estilo existente del CRM. Debe funcionar en desktop, portátil, tableta y móvil 375/768/1024/1440 px.

Diseñar una herramienta real de cotizaciones con:

- `Origen` operativo (predeterminado configurable; Tuluá si corresponde a la configuración de organización, NO equivalencia automática con Cali), `Departamento` y `Municipio destino` con catálogo validado. Si existe código DANE utilízalo; si no, mantén clave segura que distinga municipio/departamento/centro operativo.
- `Transportadora`: TCC y, en segunda fase, ENVÍA. Si el histórico del CRM tiene otras transportadoras, mantenerlas en modelos predictivos y auditorías, pero no presentarlas como tarifarios oficiales si no se aportó su acuerdo.
- `Modalidad/servicio`: paquetería, y mensajería solo si realmente tiene fórmula y precios identificados. Los `MSJ` del CSV son códigos categóricos **no importes de mensajería**.
- `Material`: integrar con maestro de materiales Siesa y su peso/dimensiones si existen y tienen unidad verificada. Posibilidad de varias líneas y de entrada manual controlada, cantidades y unidades, peso real, dimensión L/A/H o volumen, número de bultos, valor declarado cuando aplique. Evitar inventar atributos ausentes del maestro.
- `Calcular`: backend/RPC consistente con el esquema del CRM; separar resultado tarifario histórico, estimación histórica estadística e importe efectivamente pagado en la guía. Mostrar desgloses, intervalo predictivo, cobertura/ruta, condiciones vigentes/versión, advertencias, impuestos o adicionales sólo cuando están documentados. No mostrar un total oficial si se carece de política contractual, ruta o vigencia confirmada.
- `Guardar cotización`: persistencia con folio, fecha, usuario, organización, transportadora, origen, destino, líneas de material, bultos, snapshots numéricos, versión de tarifas y modelo, estatus borrador/calculado/vencido, permisos RLS. Poder consultar historial, duplicar y **vincular cotización opcionalmente a pedido**. No convertir estimado en costo facturado real.

## TAREA TÉCNICA 3 — CARGAR 30.107 REGISTROS TCC EN SUPABASE

El dataset ya está terminado. **No lo recalcules.** Crear migración de esquema aditiva e idempotente y una importación controlada por lotes mediante backend/herramienta privilegiada conectada a Supabase, no cargando más de treinta mil filas al navegador.

Condiciones:

- Preservar **exactamente** los 30.107 IDs `tcc_row_id` y los 30.107 códigos `MSJ`; de las 30.107 filas PAQ, 30.086 tendrán `paq_rate_cop_kg_reference` entero y 21 tendrán NULL.
- `tariff_version = TRADICIONALES_2023_2024` con estado `HISTORICAL_REFERENCE` por defecto, fuente y checksum. No reemplazar con esos precios las facturas del despacho ni tarifas contractuales vigentes 2026.
- Guardar `source_page`, `origin_city`, `destination_pdf`, `tcc_co`, banderas y código `msj_code`. No eliminar filas repetidas de nombre: **San Pablo (Bolívar)** tiene dos filas con tarifas distintas y C.O distintos; generar desambiguación segura antes de permitir elegir una.
- Crear lookup indexado por operador, origen, departamento/localidad y edición de tarifa, preservando el código original de localidad. Aceptar el PDF sólo como origen de `PAQ`, no asignar valor económico a `MSJ`.
- Las 21 tarifas ilegibles son NULL; no interpolar, no completar por promedio, no asignar costo cero, no bloquear por ellas la importación de las otras 30.086 tarifas.
- El documento no tiene TULUÁ como ciudad origen. Cuando el envío salga de Tuluá, seleccionar predicción a partir de guías históricas del CRM, o tabla contractual de origen Tuluá si existe. **Jamás usar la columna Cali sin una equivalencia formal documentada**.
- Validaciones postimportación en Supabase: `COUNT(*)=30107`, `COUNT(rate)=30086`, `COUNT(rate IS NULL)=21`, `COUNT(msj_code)=30107`, IDs únicos, 23 orígenes; contrastar muestras incluidas en la especificación. Emitir queries de validación y resultados efectivos. Evitar sobreescribir tablas predictivas con tarifas.

## TAREA TÉCNICA 4 — CONECTAR FÓRMULA TCC YA RESUELTA

**NO necesitas descubrir la fórmula: está en `TCC_MODELO_MATEMATICO_Y_CONTRATO_DE_DATOS.md`.** Implementar un motor por transportadora con reglas versionadas. Estas condiciones proceden de TCC web y deben parametrizarse (el CSV/PDF es referencia histórica de la tarifa/kg):

```
vol_m3 = L_m * A_m * H_m
peso_vol_kg = vol_m3 * 400
peso_cobrable_kg = max(peso_real_kg,peso_vol_kg)
recargo_kg = (peso_real_kg > 50 || peso_vol_kg > 86) ? 50 : 0
flete_base_i = peso_cobrable_i * (tarifa_Paq_ruta + recargo_kg)
flete_manejo = (valor_declarado >= 200000) ? valor_declarado * 0.01 : 0
subtotal_TCC_ref = SUM(flete_base_i) + flete_manejo
```

Antes de mostrar resultado oficial, verificar política contractual aplicable a la empresa y fecha: IVA, reglas de redondeo, unidad por bulto, flete mínimo si el acuerdo particular lo define, adicionales y convenios. **No modificar la fórmula de referencia hasta inventarle factores**. Si sólo existe el PDF histórico, etiquetar `Referencia histórica TCC` y presentar por separado la predicción actual del CRM; no llamarla «tarifa TCC vigente».

Fixture obligatorio: origen `CALI`, destino `TULUA (VALLE DEL CAUCA)`, tarifa fuente `953`, peso real `20 kg`, bulto `0,5 × 0,4 × 0,3 m`, peso volumen `24 kg`, recargo peso `0`, valor declarado `100000`, flete fijo `24×953=22872 COP`, manejo `0`; parcial de referencia `22872 COP` (sin cargos/impuestos adicionales no validados). El fixture **no autoriza a usar Tuluá como ORIGEN**. Añadir tests de umbrales 50 kg/86 kg, exención de manejo cuando valor declarado <200000, separación miles `2.563`→2563, ruta que no existe, fecha de tarifa y valores faltantes.

## TAREA TÉCNICA 5 — PRESERVAR EL APRENDIZAJE CONTINUO DESDE GUÍAS REALES

Reutilizar `public.erp_x_freight_predictions`, `public.erp_x_freight_estimate`, `erp_supply.freight_prediction_models`, `erp_supply.freight_route_reference`, migraciones 125/129/131 y posteriores y los procesos actuales de guardar guías. **No rehacer una regresión donde ya existe una**. El modelo `EI_FREIGHT_RIDGE_WEIGHT` tiene una parametrización existente; conserva esa fuente y agrega evaluación/calibración controlada de errores reales cuando sea viable, sin introducir una regresión de comportamiento.

Al registrar/corregir una guía de transporte, persistir el valor pagado real y conservarlo como única fuente de costo observado para evaluación/reentrenamiento. Debe poder existir guía y pedido SIN cotización. No usar los números del CSV TCC como ejemplos de costos observados. No entrenar con estimados, precios de venta ni guías duplicadas/rectificadas dos veces.

**Por pantalla de cotización:** mostrar predicción y rango de seguridad separado de precio tarifario, y posteriormente resultado de `costo_real - estimado` para aprendizaje y mejora en dashboard. Evitar recalibración en cada pulsación; hacerlo por proceso controlado versionado y medir MAE/MAPE y sesgo sobre datos futuros no vistos.

## TAREA TÉCNICA 6 — ENVÍA, SEGUNDA TRANSPORTADORA (PROMPT CLAUDE)

El siguiente bloque se integrará **DESPUÉS** de completar el desacople y el cotizador TCC. Mantén este punto literalmente preparado para pegar lo que Claude entregó:

**=== INICIO DEL PROMPT CLAUDE / TARIFAS ENVÍA ===**

[PEGAR AQUÍ EL PROMPT ÍNTEGRO DE CLAUDE SOBRE LA TRANSPORTADORA ENVÍA, INCLUYENDO SUS REGLAS MATEMÁTICAS Y SU CATÁLOGO DE TARIFAS. NO RESUMIRLO NI CAMBIAR SUS VALORES.]

**=== FIN DEL PROMPT CLAUDE / TARIFAS ENVÍA ===**

Si el contenido se adjunta en esta misma ejecución, procesarlo como fase 2: crear `carrier_adapter`/estrategia para ENVÍA y conectar su fuente/rutas/pesos/volúmenes, no replicar automáticamente la fórmula TCC. Hacer que TCC y ENVÍA se comparen en el mismo módulo **Cotización de fletes**, con desglose y criterios homogéneos, calculando cada una con sus propias reglas. **Si el bloque está vacío**, finalizar completamente FASE 1 de TCC e interfaz y entregar infraestructura extensible; indicar como único pendiente de segundo proveedor la recepción del texto Claude. No inventar datos ENVÍA ni bloquear por ello TCC.

## TAREA TÉCNICA 7 — SEGURIDAD, CALIDAD, PRUEBAS Y DESPLIEGUE

- Confirmar HEAD de `main`, PR abiertos y proyecto Supabase conectado ANTES de escribir; rama aislada y PR descriptivo. No resetear, no borrar datos, no desactivar RLS, no sobrescribir migraciones existentes ni tocar otro repositorio.
- Evitar repetir diagnósticos extensos ajenos a este cambio. Inspeccionar exclusivamente contratos involucrados en pedidos, fletes, guías, navegación, RBAC, Siesa y el historial de guías reales.
- Mínimo: unitarias de 30.107/30.086/21, prueba de idempotencia al importar dos veces, duplicado San Pablo, origen Tuluá sin tarifa, tarifa histórica, conversiones métricas, recargos, valor declarado, varios bultos, cotización sin pedido y pedido sin flete; integración y E2E del wizard, navegación, persistencia de cotización, despacho, seguridad/RLS y aprendizaje real.
- Asegurar pantallas responsive móvil y escritorio. No eliminar los indicadores históricos de inteligencia de fletes, sólo mover el acto de cotizar a su módulo.
- Ejecutar lint, tests, CI y desplegar siguiendo gates existentes. Migraciones de producción solo después de validar entorno, compatibilidad y reversibilidad. No fusionar con checks rojos.

## CRITERIOS DE ACEPTACIÓN / QUÉ DEBES ENTREGAR

1. **Crear pedido** ya no presenta flete estimado, tarjetas de predicción ni cotizaciones; permite crear pedido sin flete.
2. Existe una nueva casilla visible **Cotización de fletes** con formulario materiales/peso/volumen/ciudad/departamento, permite cotizar sin pedido y vincularlo luego si se desea.
3. Los 30.107 registros TCC del CSV están integrados o, si no se cuenta con acceso Supabase, las migraciones de importación están listas y sólo ese paso está pendiente; el reporte **no puede afirmar importación si no se verificó en SQL real**.
4. 30.086 tarifas legibles y 21 nulas, MSJ preservado y duplicados de localidades tratados, no se utilizan equivalencias geográficas inventadas.
5. El cotizador distingue referencia histórica TCC y costo estadístico de guías reales; continúa la captura del costo real después del despacho sin depender de cotización.
6. El motor y formulario están preparados para incorporar ENVÍA con el segundo prompt de Claude, o ENVÍA queda integrada si el prompt se adjuntó y se validó.
7. Entregar enlaces a PR/commits, archivos modificados, SQL de verificación, cantidad de filas reales en Supabase, capturas funcionales o evidencia E2E, pruebas verdes y pendientes reales. No responder simplemente con una propuesta de desarrollo: **ejecuta lo que esté a tu alcance en GitHub y Supabase**.
