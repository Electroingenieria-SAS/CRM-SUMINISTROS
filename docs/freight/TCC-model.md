# TCC — MODELO MATEMÁTICO RESUELTO Y CONTRATO DE INTEGRACIÓN

**Preparado para implementación por ChatGPT Work. Work NO debe volver a interpretar ni reconstruir las tarifas.**

## 1. Resultados del análisis del PDF original

PDF: `Tarifas-tradicionales-2023-2024-1.pdf`. Identificación SHA-256: `0a56ce97012329b5fa5a7fc758f628416a544e54ecd8417a0f26ddc595b98bb2`.

- 43 páginas de tabla.
- 23 columnas correspondientes a ciudades origen, en este orden:
  `ARMENIA`, `BARRANQUILLA`, `BOGOTA, D.C`, `BUCARAMANGA`, `BUENAVENTURA`, `CALI`, `CARTAGENA DE INDIAS`, `CAUCASIA`, `CUCUTA`, `IBAGUE`, `IPIALES`, `MANIZALES`, `MEDELLIN`, `MONTERIA`, `NEIVA`, `PASTO`, `PEREIRA`, `SANTA MARTA`, `SINCELEJO`, `TUNJA`, `VALLEDUPAR`, `VILLAVICENCIO`, `YOPAL`.
- 1.309 posiciones de destino, 30.107 pares origen/destino (1.309 × 23).
- **30.086 celdas de tarifa PAQ numérica legible** y **21 celdas PAQ dañadas** (todas en el destino Barrancabermeja, Santander, página 4). Las 21 permanecen NULAS; las otras dos, ARMENIA → Barrancabermeja `2.281` y SANTA MARTA → Barrancabermeja `1.835`, se conservaron porque SÍ son legibles en la página.
- 30.107 códigos `MSJ` válidos (N, O, Z, R, U, E); son categorías, **no precios**.
- Encabezados `RX`, `SERV RECOGIDA`, `FCE Y BOOMERANG`, `C.O` (centro operativo) y `HACIA` (destino). Se guardan como información asociada a cada fila; no añaden por sí mismos costos no documentados.
- La palabra `SAN PABLO (BOLIVAR)` aparece dos veces en la página 34: una vez asociada al centro `BUCA`, y otra a `CART`, con valores y propiedades distintos. Ejemplo origen CALI: `3.614` versus `2.778`. **No hacer UPSERT por `(origen, nombre_destino)` solamente**. Conservar el `tcc_row_id` y exigir desambiguación territorial/operativa cuando aplique.
- El PDF **NO tiene columna TULUÁ como ciudad de origen**. Tuluá aparece como DESTINO; no fabricar el sentido inverso ni asumir que CALI = TULUÁ. El centro operativo `CALI` de algunas localidades tampoco equivale a origen Cali en cotización.
- Versión histórica rotulada 2023–2024: no afirmar que estos precios sean contractualmente vigentes en 2026.

**Extracción**: se volvió a extraer de cero utilizando coordenadas reales y celdas geométricas de las páginas del PDF, no a partir de la normalización anteriormente rechazada. Todos los pares `PAQ/MSJ` se alinearon por fila y destino. 1.296 filas PAQ legibles se contrastaron con una segunda ruta de extracción textual, sin diferencias en sus vectores de tarifas. Las otras filas tienen singularidades de composición, recortes/cierres entre páginas o etiquetas combinadas, resueltas por su posición visual. Los números de las 21 celdas tapadas no pueden recuperarse con legitimidad del documento; no presentarlos como «integrados». La importación contiene las 30.107 rutas, pero las 21 no son cotizables a partir del tarifario.

## 2. CSV listo para importar

Archivo **`TCC_TARIFAS_INTEGRACION_VERIFICADAS.csv`**, codificación UTF-8 con BOM, un registro **por origen/destino**. No usar el ZIP antiguo.

- `tcc_row_id`: ID estable del registro, clave única de carga y origen + posición de fila.
- `source_sha256`: huella del PDF original.
- `tariff_version`: `TRADICIONALES_2023_2024`.
- `source_page`, `source_row_y_pt`, `source_page_msj`: ubicación de lectura comprobable en el PDF.
- `carrier` = `TCC`; `service_type` = `PAQ`: tarifa monetaria para paquetería (el código MSJ separado se guarda como metadato de clasificación).
- `origin_city`, `destination_pdf`, `destination_departamento_pdf`: clave geográfica literal de la tabla. La vinculación con códigos DANE debe hacerse conservando el valor original y revisando homónimos; **nunca inventar códigos**.
- `tcc_co`, `rx`, `serv_recogida`, `fce_y_boomerang`: datos PAQ del documento.
- `msj_rx`, `msj_serv_recogida`, `msj_fce_y_boomerang`: banderas MSJ, guardadas independientemente (en algunos registros difiere `RX` entre modalidades).
- `paq_rate_source_text`: texto original de la celda (por ejemplo `2.563`).
- `paq_rate_cop_kg_reference`: versión entera en pesos colombianos, por ejemplo `2563`. La **interpretación comercial por kilogramo** se corrobora con la descripción de «flete fijo» de TCC en su página oficial; no implica que el valor del PDF de 2023–2024 sea vigente hoy.
- `msj_code`: código de clasificación para ese origen/destino, **no base monetaria**.
- `data_status`: `OK_PDF` o `FUENTE_DANADA_O_ILEGIBLE`. Los importes dañados tienen campo numérico vacío y deben importarse como SQL `NULL`.

Importar **todos los 30.107 registros** a catálogo versionado; no rechazar toda la tabla por 21 celdas faltantes. Si una cotización cae en celda dañada, mostrar «tarifa documental no disponible», no rellenarla ni promediarla sin acuerdo expreso. No usar deduplicación agresiva.

## 3. Fórmula TCC aplicable cuando el precio por kilogramo y la política comercial estén autorizados

La **fuente documental PDF** contiene la matriz de valores PAQ; no contiene el detalle de cálculo del peso volumétrico, manejo, recargos ni IVA. Las siguientes políticas **NO derivan del PDF**; provienen de las explicaciones comerciales publicadas por TCC en su web, https://tcc.com.co/courier/paqueteria/formas-de-pago-y-tarifas/. La empresa deberá verificar su vigencia contractual para el cliente, porque el documento base es histórico.

Para cada unidad/bulto `i`:

```
volumen_m3_i = largo_m_i * ancho_m_i * alto_m_i
peso_volumetrico_kg_i = volumen_m3_i * 400
peso_cobrable_kg_i = max(peso_real_kg_i, peso_volumetrico_kg_i)
recargo_por_kg_i = 50 si (peso_real_kg_i > 50 O peso_volumetrico_kg_i > 86), en otro caso 0
flete_fijo_i = peso_cobrable_kg_i * (tarifa_Paq_de_la_ruta + recargo_por_kg_i)
flete_manejo = 0.01 * valor_declarado si valor_declarado >= 200000 COP; si es menor, 0
subtotal_referencia = SUM(flete_fijo_i) + flete_manejo
cotizacion = subtotal_referencia + cargos_adicionales_confirmados + impuestos_si_corresponden
```

**Importante:** la web comercial indica: factor 400 kg/m³; no se aplica mínimo de 30 kg; flete fijo calculado kilo a kilo; flete de manejo 1 % cuando valor declarado no es inferior a $200.000; incremento $50/kg bajo los umbrales citados. La granularidad exacta por bulto/envío, criterios de redondeo, tratamiento de IVA, servicios especiales, recargos negociados y tarifas actuales deben figurar como políticas configurables por vigencia. No inventar cargo adicional o impuesto. Las reglas deben poder deshabilitarse si un acuerdo comercial diferente está registrado. **No utilizar una tarifa antigua para mostrar un total «vigente garantizado».**

Si el valor declarado o los bultos necesarios no están disponibles, el cálculo tiene estado `PARTIAL` o `REQUIRES_INFORMATION`, sin convertir un subtotal en precio final.

### Ejemplo numérico completamente resuelto (referencia histórica, NO cotización actual)

Origen **CALI** → destino **TULUA (VALLE DEL CAUCA)** (fila de origen Cali de la tabla PDF): `953` COP por kilogramo de referencia. **Este ejemplo no representa despachos desde Tuluá**, porque el PDF no ofrece ese origen.

Un bulto de 20 kg reales y 50 × 40 × 30 cm:

- Volumen = `0,50 × 0,40 × 0,30 = 0,060 m³`.
- Peso volumétrico = `0,060 × 400 = 24 kg`.
- Peso cobrable = `max(20, 24) = 24 kg`.
- No se activa el adicional de $50/kg: 20 kg reales ≤ 50 y 24 kg volumétricos ≤ 86.
- Flete fijo histórico = `24 × 953 = 22.872 COP`.
- Para un valor declarado de `100.000 COP`, flete de manejo = `0 COP` bajo la regla publicada de TCC.
- **Subtotal de referencia = $22.872 COP**, excluidos cargos/impuestos no verificados, y **sin validez como cotización vigente**.

El mismo pedido origen TULUÁ → destino CALI **NO** tiene un importe documentado en este PDF: usar modelo histórico del CRM o una tabla contractual específica, no los $953 anteriores.

## 4. El aprendizaje ya existente en el CRM

Repositorio confirmado: `https://github.com/Electroingenieria-SAS/CRM-SUMINISTROS`, rama `main`.

Entradas existentes en código que debe reaprovechar Work:

- `assets/js/domains/orders/create/create-order.js`: ahora importa `estimatedSalesWeight`, `freightPredictionSnapshot`, `bindFreightPrediction`, llama a la predicción al cambiar destino o materiales, y persiste metadatos de predicción al crear pedido. Estas llamadas deben salir del wizard sin romper el flujo comercial.
- `assets/js/domains/orders/create/order-form.js`: contiene el panel visual `data-freight-estimate`, el bloque `data-material-freight-prediction` y los transportadores `data-freight-carriers`, que deben **moverse/reemplazarse** en Cotización de fletes, no seguirse ejecutando en Crear pedido.
- `assets/js/domains/orders/freight/freight-prediction.js`, `material-weight.js`, `freight-display.js`, `national-freight-display.js`, `local-freight-display.js`: refactorizar para consumo desde el módulo independiente; conservar integridad de helpers.
- `assets/js/core/routing/module-registry.js`: registrar módulo nuevo y acceso desde área comercial según permisos.
- `supabase/migrations/129_freight_predictive_model_v11_40_0.sql` y `131_freight_historical_base_v11_42_0.sql`: regresión de flete y jerarquía geográfica histórica (`EI_FREIGHT_RIDGE_WEIGHT`, `erp_supply.freight_route_reference`, `public.erp_x_freight_predictions`). Conservar el modelo predictivo histórico vigente; **no sustituirlo** por producto peso × tarifa PDF.
- `assets/js/modules/freight-intelligence-v11410.js`: panel de predicho vs real; no eliminar ni romper.
- Persistencia existente de guías/transportadora/costo real: mantener y conectar a evaluación/reentrenamiento versionado idempotente. Evaluar nuevas guías verificadas, evitando que una predicción/cotización se trate como costo real.

## 5. Contrato del nuevo módulo «Cotización de fletes»

La UI sale del flujo **Crear pedido** y aparece como módulo/botón comercial independiente **Cotización de fletes**. El wizard deja de calcular el envío; conserva solamente campos de pedido que tengan utilidad real en despacho y contratos. El módulo puede usarse **sin pedido** y puede ser invocado con un pedido para precargar materiales/dirección opcionalmente.

Entradas: origen efectivo, departamento/ciudad destino, transportadora TCC o ENVÍA cuando se integre, modalidad, maestro Siesa, material o producto manual, cantidad/unidad, peso real, volumen o dimensiones y número de bultos, valor declarado, otros datos estrictamente necesarios.

Salidas sin mezclar: (1) tarifa histórica documental cuando la ruta y política lo permiten; (2) predicción del CRM respaldada en guías reales y su intervalo de confianza; (3) costo real de la guía cuando el envío se concrete. Incluir desglose peso real, volumen, peso cobrable, tarifa/kg, recargo, manejo, otras partidas; origen/destino/versión y estado de certeza. Permitir guardar cotización sin pedido, vincular posteriormente a pedido, consultar historial y comparar con guía. No volver obligatoria la cotización para crear pedidos, ni exigir transportadora en el pedido si el proceso actual permite resolverla en despacho.

## 6. Reglas de aceptación de datos y del cálculo

- CSV tiene exactamente **30.107** filas de tarifa PAQ con código MSJ asociado, IDs únicos `tcc_row_id`, 23 orígenes y 1.309 posiciones de destino.
- **30.086** tarifas PAQ tienen valor de referencia numérico en COP/kg (interpretación comercial contrastada con las condiciones públicas TCC, no tarifa garantizada 2026); **21** están en NULL. No inventar importes de esos 21 casos.
- Códigos MSJ válidos y conservados como categorías, no como números a cobrar.
- El destino `SAN PABLO (BOLIVAR)` no se colapsa (dos centros y tarifas); exigir selección inequívoca.
- Si origen es `TULUA`, usar el histórico/contrato de origen Tuluá, nunca la celda de origen `CALI`.
- Calcular demo CALI → TULUA con valores anteriores y comprobar `24 × 953 = 22.872` antes de suplementos no documentados.
- Mantener conciliación de costos reales de guías y errores estadísticos sin contaminación por tarifas o cotizaciones.

## 7. Obligaciones específicas de Work (SOLO IMPLEMENTACIÓN)

1. Leer esta especificación + CSV y cargar la versión TCC en base de datos después de confirmar proyecto Supabase. **No rehacer el análisis ni generar un segundo tarifario**.
2. Crear tablas/RPC/índices/RLS de forma aditiva e idempotente conforme a arquitectura vigente y cargar CSV por lotes de manera segura, dejando las 21 celdas sin tarifa y preservando homónimos.
3. Crear el módulo/botón «Cotización de fletes» e integrar cálculo y modelo estadístico; desacoplar «Crear pedido» y conservar guías, costos reales y aprendizaje.
4. Preparar el adaptador adicional para **ENVÍA**; conectar sus tarifas y modelo matemático **cuando se adjunte el prompt de Claude**, en fase posterior o dentro del mismo encargo si se proporciona.
5. Ejecutar pruebas, CI, regresión y responsive; entregar PR, migraciones, cargas verificadas y evidencias. No fusionar/desplegar con checks rojos ni modificar datos históricos de forma destructiva.
