# CONTINUACIÓN OBLIGATORIA DE CHATGPT WORK — FASE 2: ENVÍA
## CRM-SUMINISTROS | Completar TCC existente + integrar ENVÍA en «Cotización de fletes»

**TIPO DE TAREA: EJECUTAR E INTEGRAR EN EL TRABAJO EXISTENTE. NO PROGRAMAR UN ESTIMADOR AISLADO.**

Actúa como responsable técnico que **continúa** la ejecución anterior de Work, iniciada con `PROMPT_WORK_IMPLEMENTAR_TCC_Y_DESPUES_ENVIA_CRM_SUMINISTROS.md`. Ese encargo dejó establecido un único módulo comercial «Cotización de fletes» para TCC y la posterior integración de ENVÍA. **Este documento sustituye las instrucciones iniciales del prompt de Claude que proponían crear una app independiente en Python, una CLI o una nueva interfaz mínima.** Sus datos, fórmula y ejemplos se preservan íntegros en el **ANEXO A** al final; para desarrollarlos dentro del CRM se usarán los datos JSON adicionales ya preparados.

**Repositorio autorizado:** https://github.com/Electroingenieria-SAS/CRM-SUMINISTROS — únicamente éste; **PROHIBIDO** tocar el otro repositorio `Electroingenieria-SAS/CRM`. Supabase: reconocer el proyecto conectado a este repositorio antes de realizar una operación de escritura; **no** asumir que una referencia a un ID histórico prueba que es el entorno correcto. Respeta el frontend y las migraciones/RPC que efectivamente estén en uso.

### I. Recuperación del checkpoint anterior (primera operación; no volver a empezar)

1. **Retoma la misma tarea/sesión de Work, si su workspace continúa disponible.** Lee sus últimos cambios registrados, mensajes de cierre parcial, archivos locales no confirmados, rama, HEAD, commits, PR, CI y migraciones Supabase aplicadas. Si cambiaste de sesión, recupera estado desde GitHub, Supabase y documentos disponibles. NO asumas que la ejecución de TCC se completó solo porque el prompt original lo ordenaba.
2. Al contrastar con `main`, determina **qué partes están ya terminadas, cuáles están en una rama/PR pendientes y cuáles faltan**: desacoplamiento de «Crear pedido», módulo «Cotización de fletes», carga TCC, motor, RLS, guías reales, pruebas y despliegue. Reutiliza las implementaciones **y los identificadores verdaderos**. No dupliques tablas, no regeneres tarifas TCC, no crees otra ruta/menu ni abras un PR diferente cuando exista una rama/PR de trabajo recuperable y segura.
3. En la consulta de solo lectura disponible durante la redacción de este prompt (13-oct-2026), el `main` visible seguía en `f6335ef8405f6438dd053d29f9d228e362dd7d1d` (hotfix de predicción de fletes del 8-oct); **esto NO es una instrucción para resetear ramas ni es prueba del estado actual de Work**. El commit/PR más reciente que efectivamente contenga cambios de TCC tiene prioridad. Una implementación no fusionada puede estar en el workspace. Reconfirmar el estado real antes de escribir.
4. Si TCC quedó a medio implementar, completa **solo los pendientes necesarios** para tener un módulo común estable, conservando todo lo válido. No vuelvas a auditar las 43 páginas, no recrees la matriz y no ejecutes importaciones repetidas: comprueba IDs, conteos, checksums y estado real en Supabase antes de decidir si falta importar algo. Si faltan insumos TCC de la sesión anterior, recupera los que se suministraron con el primer encargo (`TCC_TARIFAS_INTEGRACION_VERIFICADAS.csv`, `TCC_MODELO_MATEMATICO_Y_CONTRATO_DE_DATOS.md`, `TCC_INFORME_CONTROL_EXTRACCION.json`) desde el workspace original, **no** del ZIP desechado. Nunca inventes que están presentes si no los encuentras. Si no se recuperan, preserva el avance y reporta el bloqueo específico, sin reemplazar los datos.
5. **Checkpoint duradero**: fija rama/SHA de continuación, inventario corto `Hecho / Pendiente / No verificado`, lista de migraciones aplicadas (no solo versionadas) y ruta exacta de entrada al cotizador. Haz commits progresivos en la rama de trabajo. No consumas tiempo releyendo todo el sistema por defecto ni repitas loops de herramientas y CI sin cambios.

### II. Resultado final que debe quedar en el CRM

- En **«Crear pedido»** no se muestra flete estimado, comparación de transportadoras, calculadora ni predicción automática. La creación comercial funciona sin cotización y sigue compatible con pedidos anteriores, Siesa, despacho, dirección cuando sea operacionalmente necesaria y estados vigentes. Si el cambio ya quedó implementado, **no lo rehagas**; solo ejecuta una prueba de no regresión.
- Existe **una sola casilla/entrada «Cotización de fletes»**, con selección de transportadora **TCC / ENVÍA**, origen, departamento, municipio, materiales de Siesa o manuales, cantidades, pesos, dimensiones/volumen y cotización editable/guardable sin pedido. Cuando haya pedido puede precargar datos y asociar la cotización opcionalmente; no convertir estimado en costo real.
- Ambas transportadoras aparecen en **el mismo formulario y la misma vista comparativa** si ambas pueden estimar esa ruta, pero con **reglas, tablas, vigencias, mínimos, pesos, recargos y fuentes separadas**. No sumar resultados de TCC + ENVÍA, no copiar parámetros TCC a ENVÍA, y no presentar estimaciones internas como cotizaciones contractuales confirmadas.
- Mantener el modelo estadístico de fletes basado en guías/facturas reales (`EI_FREIGHT_RIDGE_WEIGHT` y las funciones existentes si siguen siendo la versión desplegada), la auditoría predicho-vs-real y el registro de `carrier_cost` real; ninguna tarifa teórica de ninguno de los dos proveedores sirve como observación real de entrenamiento.

### III. Fuente de datos de ENVÍA: ya procesada, no investigar desde cero

La especificación Claude del **ANEXO A** forma parte obligatoria de este prompt y contiene los **25 destinos/grupos tarifarios**, con `tarifa_kg`, `minimo`, `variable`, indicador informativo `desde_kg`, `confianza`, casos de prueba y advertencias. Para reducir errores de transcripción, adjunto además:

1. `ENVIA_TARIFAS_CLAUDE_INTEGRACION.json`: los mismos 25 registros en formato listo para integrar, tarifas decimales conservadas como cadenas exactas y parámetros de motor separados de la tabla.
2. `ENVIA_PRUEBAS_MATEMATICAS_VERIFICADAS.json`: los 33 casos del anexo, calculados con **aritmética decimal exacta y redondeo half-up**, incluyendo un error aritmético detectado en la expectativa original de Caquetá.

**Importa esos datos, no los reestimes ni cambies sus cifras por intuición.** No vuelvas a pedir al usuario su documento de Claude: ya está incorporado. Mantén procedencia `ENVIA_CLAUDE_2026_10_13_V1`, fuente, fecha del modelo y estatus `ESTIMATED_REFERENCE` o equivalente. Los precios del anexo son un **modelo interno inferido de cotizaciones**, no una tabla pública/contractual vigente verificada de la transportadora. No rellenar municipios faltantes con tarifas inventadas ni mostrar etiquetas «tarifa oficial», «garantizada» o «confianza estadística del 95 %». Preservar las diferencias entre alta/media indicadas por Claude como un indicador de soporte **de la fuente**, no como métrica estadística calibrada.

### IV. Fórmula matemática exacta de ENVÍA (independiente de TCC)

**Un envío de un bulto y servicio estándar del conjunto de prueba**:

```text
peso_volumetrico_kg = largo_cm * ancho_cm * alto_cm / divisor_vol
    divisor_vol = 5000 [CONFIGURABLE, SUPUESTO, NO CONFIRMADO POR ENVÍA]

peso_cobrable_kg = ceil(max(peso_real_kg, peso_volumetrico_kg))
precio_por_kg     = decimalExacto(tarifa_kg)
base_sin_redondear = max(minimo, peso_cobrable_kg * precio_por_kg)
flete_base_cop    = round_half_up(base_sin_redondear, 0 decimales)
flete_variable_cop = variable [FIJO UNA VEZ POR ENVÍO DE LA PRUEBA]
total_central_cop = flete_base_cop + flete_variable_cop

umbral_kg = floor(minimo / tarifa_kg) + 1
margen = 0.10 si source_confidence == "media" o abs(peso_cobrable_kg - umbral_kg) < 5
       = 0.05 en los demás casos
rango_min_cop = round_half_up(total_central_cop * (1 - margen), 0)
rango_max_cop = round_half_up(total_central_cop * (1 + margen), 0)
```

Asegura cálculo de moneda decimal exacto en JavaScript/TypeScript/SQL (no multiplicar floats binarios y confiar en redondeos fortuitos). Usa una función pura testeable y un adaptador de transportadora integrado al motor ya creado para TCC. No implementes Python/CLI si la aplicación existente no lo usa; mantén módulos JS/arquitectura real del CRM. No uses `Math.round` sin probar explícitamente los casos de mitad decimal. No agregar IVA, seguro, manejo, volumen TCC, mínimos TCC, recargos adicionales ni escalones no indicados para ENVÍA.

**Límites:** si las dimensiones no están, usa solo peso real e informa si la cotización es provisional cuando el tamaño no fue confirmado. Si solo se informa volumen, permitirlo únicamente si la interfaz/modelo define las unidades de modo inequívoco. No sumar `variable` ni `minimo` por cada línea comercial/material. En envíos de múltiples bultos, la fuente original **no define** si se redondea/cobra por bulto o por envío: abstenerse de ofrecer un precio definitivo hasta documentar dicha política; permitir captura y estado `PENDING_PACKAGING_RULE` o equivalente. No ocultar la suposición del divisor ni presentar el margen heurístico como intervalo probabilístico. Para >100 kg: advertir que la linealidad es una extrapolación no confirmada.

**Resolución de destino: SIN cobertura imaginaria.** Mantén identificador territorial (departamento + municipio, preferentemente código confiable) y la prioridad de selección explícita: regla específica de **Tunja** sobre regla general de Boyacá; regla **Boyacá general** únicamente para el resto de ese departamento; **Valle del Cauca (Cali)** se extiende a todo Valle del Cauca y **Caquetá (Florencia)** a todo Caquetá, porque el propio Claude lo indica. `Risaralda = Quindío` y `Córdoba = Cesar` comparten números, NO un mismo identificador territorial. Para etiquetas mixtas como `Tolima (Ibagué)`, `Cauca (Popayán)`, `Nariño (Pasto)`, `Atlántico (Barranquilla)`, `Casanare (Yopal)` y `Córdoba (Montería)`, no asumir por defecto que la cobertura se extiende a todos los municipios del departamento cuando la fuente no es explícita. Mantener búsqueda seleccionable de la ciudad indicada o marcar cobertura pendiente para otras ciudades. Si no hay regla inequívoca, responder `ENVÍA: sin tarifa de referencia documentada para esta localidad`, dejando TCC/histórico independiente disponibles.

**Transportadora e histórico:** revisar los catálogos reales y el identificador que las guías usan (la base histórica podría usar `COLVANES` para envíos identificados comercialmente como ENVÍA). Si corresponde a la misma empresa, crear **alias controlado respaldado por evidencia real**, sin duplicar ni fusionar ciegamente observaciones de otros proveedores; no modificar nombres históricos en masa. Mantener `carrier_id`/código existente para integridad de histórico cuando aplique y etiquetar presentación `ENVÍA`. La tarificación Claude no sustituye las predicciones estadísticas basadas en guías reales.

### V. Integración técnica concreta — reutilizar lo que Work ya hizo

1. Localiza los contratos efectivos para `carrier`, `tariff_version`, `quote`, `quote_lines`, `weight`, `destination`, `source`, `quote_result` y la persistencia de snapshots. **Extiéndelos aditivamente** para ENVÍA; no crees un esquema de cotización paralelo si ya hay uno para TCC. Reutiliza su servicio de cotización, persistencia, validadores, auditoría, RBAC y navegación.
2. Si el modelo TCC está en tabla multi-carrier, añade una fuente `ENVIA_CLAUDE_2026_10_13_V1` con las 25 reglas; si requiere un adaptador separado, mantén una única fachada `quoteFreight(...)` con estrategias por carrier. No copies el SQL de TCC y reemplaces solo el nombre; son fórmulas matemáticas diferentes.
3. Preferir filas declarativas JSON/configuradas en base de datos con versión y checksum, idempotencia por `(carrier, dataset_version, source_key)`; precios y parámetros no están hardcodeados en HTML. Conservar matriz original del anexo, permitir versionar y desactivar, sin sobrescribir tarifas anteriores.
4. Renderizar, dentro del único módulo **«Cotización de fletes»**, una tarjeta de ENVÍA con peso real/volumétrico/cobrable, tarifa/kg, mínimo, flete base, variable, subtotal, rango 5/10 %, umbral y advertencias. Si la ruta existe en TCC y se puede usar válidamente para el origen real, agregar tarjeta TCC comparable; de lo contrario mostrar estado no cotizable de TCC sin fabricar precio.
5. La pantalla debe ofrecer recalcular al cambiar destino, material Siesa/manual, peso, volumen, bultos y transportadora sin dejar referencias stale. No reconsultar todas las tarifas en cada tecla: cache/lookup por claves y consultas concretas a backend.
6. Permitir guardar cotización sin pedido, consultar historial, asociar al pedido si se elige y conservar snapshots independientes por proveedor para explicar el número mostrado posteriormente. Una cotización ENVÍA nunca modifica una guía/factura ni se suma como `carrier_cost` real.
7. Mantener de forma estricta **Crear pedido sin flete**. Validar que los listeners y componentes desplazados por fase TCC no reaparezcan con la nueva fase. Conservar panel de inteligencia histórico, workflow logístico, seguridad y material maestro; no hacer limpieza general del CRM.

### VI. Discrepancia real del documento de Claude: corregir prueba, no fórmula

**Caso Caquetá, 22 kg**: la tarifa fuente es `1725.75 COP/kg`, y:

```text
22 × 1725.75 = 37966.50
round_half_up(37966.50) = 37967
37967 + 13300 = 51267
```

El ANEXO A escribe `37966` y `51266`, valores incompatibles con el redondeo `round_half_up` que también exige. **Preserva la matriz original intacta**, conserva la discrepancia en auditoría y adopta como expectativa de prueba aritmética correcta `37967 / 51267`. No cambies `tarifa_kg`, ni uses truncamiento o redondeo bancario para igualar el caso erróneo. De las 33 filas de pruebas del anexo, **32 coinciden** con el algoritmo; esta es la única discrepancia hallada con números enteros de peso y sin dimensiones.

Además, el documento identifica incertidumbres de Bogotá 36/38 kg, un posible typo en Ibagué, umbral Popayán, tarifas/umbrales de Pasto, factor volumétrico y linealidad después de 100 kg. Tratarlas como supuestos y avisos **sin bloquear la integración de los casos correctamente definidos**; no declarar esos aspectos confirmados con contrato de ENVÍA.

### VII. Pruebas y cierre, sin regresiones

**Gates obligatorios en la rama de continuación**:

- Pasar los **33 fixtures matemáticos** con `half_up`, usando la corrección explícita para Caquetá y conservar un test que documente la divergencia respecto del dato original. Verificar los 25 registros y umbrales derivados; min/base/variable; 5 % vs 10 %; divisor supuesto 5000; `ceil` al peso entero; y dimensiones opcionales.
- Probar por lo menos: Tunja vs Boyacá general; Valle completo y Caquetá completo según fuente; ausencia de tarifa en municipio no cubierto; cero/negativos/no números; peso por debajo/en/sobre mínimo; márgenes alrededor del umbral; más de 100 kg con advertencia; varios bultos no liquidables automáticamente sin política; dos carriers con políticas separadas.
- Regresión TCC sin cambiar la matriz, sus 21 celdas en NULL ni las anomalías/homónimos originales. **No reimportar ni reentrenar TCC** salvo defecto comprobado de la implementación existente; verificar que precios y snapshots de TCC permanezcan idénticos.
- E2E: crear pedido sin flete; abrir y usar **Cotización de fletes** sin pedido; seleccionar ENVÍA/TCC; guardar/ver/volver a abrir; asociar a pedido sin alterar su contenido; preservar registro de guía y su costo real; probar RBAC/RLS, accesibilidad, y responsive 375/768/1024/1440 px.
- Ejecutar CI **una vez por commit o checkpoint**, leer solo errores de jobs fallidos para corregir causa raíz. No abrir ciclos de polling redundantes ni desplegar si hay gates rojos. Migraciones Supabase solo en proyecto/entorno comprobado, con pruebas idempotentes, control de versiones, rollback disponible y migraciones aditivas. No forzar push, resetear `main`, editar migraciones históricas ni activar tarifas como contractuales vigentes sin documentación.

**Orden operativo:** checkpoint recuperación → finalizar pendientes TCC si los hay → integrar datos/adapter ENVÍA → conectar UI común y guardado → pruebas de 33 casos + regresiones TCC/pedidos/guías → PR y CI → migración/despliegue controlado donde sea seguro → verificación final con evidencia.

**Entregables obligatorios:** rama y SHA recuperados; identificación de qué hizo el Work anterior (hecho/pendiente); nombres reales de tablas/RPC/componentes reutilizados; checksum y conteo de 25 reglas ENVÍA; lista de migraciones ejecutadas y resultados SQL reales; prueba 33/33 bajo expectativa corregida, diferencias documentadas; screenshots/E2E de módulo único y Crear pedido sin flete; resultados TCC post-integración; PR/commits y gates; estado de producción separado de estado en PR. **No declares “implementado” lo que solo programaste pero no desplegaste ni verificaste.**

---

# ANEXO A — DOCUMENTO ORIGINAL DE CLAUDE (PRESERVADO SIN CAMBIOS)

El siguiente contenido se incluye íntegro para auditar los parámetros originales. **Las instrucciones de crear CLI/web independiente que contiene están anuladas por las secciones I–VII de este documento**; las fórmulas/datos se aplican según la sección IV y la corrección aritmética documentada en VI.

---

# PROMPT: Estimador de fletes Envía (Colombia)

Eres un desarrollador senior. Programa un **estimador de fletes** para la transportadora Envía, usando el modelo matemático y la matriz de tarifas de abajo. Lenguaje sugerido: Python (o JavaScript si prefieres). Entrega: función pura `estimar_flete(...)`, la matriz como JSON/diccionario separado del código, pruebas unitarias con los casos de la sección 6 y una interfaz mínima (CLI o web) donde el usuario elige destino, peso real y dimensiones.

---

## 1. Modelo matemático

Para cada destino hay 3 parámetros:

- `tarifa_kg`: valor por kilo (se obtiene de `valor_100kg / 100`)
- `minimo`: flete base mínimo (se cobra mientras `kg * tarifa_kg` sea menor)
- `variable`: flete variable fijo (no cambia con el peso)

Fórmulas:

```
peso_volumetrico = (largo_cm * ancho_cm * alto_cm) / DIVISOR_VOL     # DIVISOR_VOL = 5000 (configurable, asumido)
peso_cobrar      = ceil( max(peso_real_kg, peso_volumetrico) )       # siempre entero hacia arriba

flete_base = max( minimo, peso_cobrar * tarifa_kg )
flete_base = round_half_up( flete_base )                             # a peso entero

total = flete_base + variable
```

Propiedades verificadas con los datos reales:
- Mientras `peso_cobrar * tarifa_kg <= minimo`, el flete base es el mínimo (por eso "no cambia" de 1 hasta el umbral).
- Después del umbral, cada kilo adicional suma exactamente `tarifa_kg` (lineal desde 0, sin kilo inicial).
- El umbral = `floor(minimo / tarifa_kg) + 1` (primer kg donde ya se cobra por kilo). Calcúlalo en código, no lo escribas a mano.
- El `variable` es fijo para cualquier peso.

## 2. Margen de error (rango de estimación)

El estimador no devuelve un solo número sino **tres**: mínimo probable, estimado y máximo probable.

```
margen = 0.05   (5%)   por defecto
margen = 0.10   (10%)  si el destino tiene "confianza": "media" en la matriz
                       o si peso_cobrar está a menos de 5 kg del umbral

total_min = round(total * (1 - margen))
total_max = round(total * (1 + margen))
```

Motivos del margen: tarifas redondeadas por la plataforma, divisor volumétrico asumido, posibles ajustes de contrato y destinos con pocos datos verificados. Muestra siempre: `Estimado: $X (rango $min – $max)`.

## 3. Matriz de tarifas (JSON)

`valor_100kg` es el flete base de 100 kg (sin variable). `desde_kg` es el primer kg donde ya se cobra por kilo (solo informativo, se recalcula).

```json
{
  "Bogotá":              {"tarifa_kg": 788.45,  "minimo": 27600, "variable": 13300, "desde_kg": 36, "confianza": "media"},
  "Antioquia":           {"tarifa_kg": 788.45,  "minimo": 27600, "variable": 13300, "desde_kg": 36, "confianza": "alta"},
  "Tolima (Ibagué)":     {"tarifa_kg": 788.45,  "minimo": 27600, "variable": 13300, "desde_kg": 36, "confianza": "alta"},
  "Valle del Cauca (Cali)": {"tarifa_kg": 396.5, "minimo": 15250, "variable": 8650,  "desde_kg": 39, "confianza": "alta"},
  "Caldas":              {"tarifa_kg": 788.45,  "minimo": 21600, "variable": 10300, "desde_kg": 28, "confianza": "alta"},
  "Quindío":             {"tarifa_kg": 833.30,  "minimo": 21600, "variable": 10300, "desde_kg": 26, "confianza": "alta"},
  "Risaralda":           {"tarifa_kg": 833.30,  "minimo": 21600, "variable": 10300, "desde_kg": 26, "confianza": "alta"},
  "Nariño (Pasto)":      {"tarifa_kg": 672.75,  "minimo": 21600, "variable": 10300, "desde_kg": 33, "confianza": "media"},
  "Cauca (Popayán)":     {"tarifa_kg": 599.95,  "minimo": 21600, "variable": 10300, "desde_kg": 37, "confianza": "media"},
  "Atlántico (Barranquilla)": {"tarifa_kg": 1233.05, "minimo": 27600, "variable": 13300, "desde_kg": 23, "confianza": "alta"},
  "Huila":               {"tarifa_kg": 1361.10, "minimo": 27600, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Santander":           {"tarifa_kg": 1415.05, "minimo": 28301, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Magdalena":           {"tarifa_kg": 1493.05, "minimo": 29861, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Meta":                {"tarifa_kg": 1455.35, "minimo": 29107, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Boyacá (Tunja)":      {"tarifa_kg": 1616.55, "minimo": 32331, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Norte de Santander":  {"tarifa_kg": 1641.90, "minimo": 32838, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Sucre":               {"tarifa_kg": 1647.10, "minimo": 32942, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Casanare (Yopal)":    {"tarifa_kg": 1591.20, "minimo": 31824, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Caquetá (Florencia)": {"tarifa_kg": 1725.75, "minimo": 34515, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Cesar":               {"tarifa_kg": 1842.10, "minimo": 36842, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Córdoba (Montería)":  {"tarifa_kg": 1842.10, "minimo": 36842, "variable": 13300, "desde_kg": 21, "confianza": "alta"},
  "Arauca":              {"tarifa_kg": 3400.00, "minimo": 85000, "variable": 12700, "desde_kg": 26, "confianza": "alta"},
  "Boyacá (general)":    {"tarifa_kg": 3400.00, "minimo": 85000, "variable": 12700, "desde_kg": 26, "confianza": "alta"},
  "Chocó":               {"tarifa_kg": 3400.00, "minimo": 85000, "variable": 12700, "desde_kg": 26, "confianza": "alta"},
  "La Guajira":          {"tarifa_kg": 5400.00, "minimo": 135000, "variable": 22700, "desde_kg": 26, "confianza": "alta"}
}
```

Notas de la matriz:
- "Boyacá (Tunja)" y "Boyacá (general)" son tarifas distintas: Tunja usa la fila de Tunja; el resto del departamento usa la general (igual a Arauca).
- Valle del Cauca: la tarifa de Cali aplica a todo el departamento.
- Caquetá: la tarifa de Florencia aplica a todo el departamento.
- Risaralda = Quindío (idénticos). Córdoba = Cesar (idénticos).

## 4. Tabla resumen (para validar visualmente)

| Destino | $/kg | Mínimo | Variable | Cobra por kg desde | Total 100 kg |
|---|---|---|---|---|---|
| Bogotá / Antioquia / Tolima | 788,45 | 27.600 | 13.300 | 36 kg | 92.145 |
| Valle del Cauca | 396,50 | 15.250 | 8.650 | 39 kg | 48.300 |
| Caldas | 788,45 | 21.600 | 10.300 | 28 kg | 89.145 |
| Quindío / Risaralda | 833,30 | 21.600 | 10.300 | 26 kg | 93.630 |
| Nariño (Pasto) | 672,75 | 21.600 | 10.300 | 33 kg | 77.575 |
| Cauca (Popayán) | 599,95 | 21.600 | 10.300 | 37 kg | 70.295 |
| Atlántico | 1.233,05 | 27.600 | 13.300 | 23 kg | 136.605 |
| Huila | 1.361,10 | 27.600 | 13.300 | 21 kg | 149.410 |
| Santander | 1.415,05 | 28.301 | 13.300 | 21 kg | 154.805 |
| Meta | 1.455,35 | 29.107 | 13.300 | 21 kg | 158.835 |
| Magdalena | 1.493,05 | 29.861 | 13.300 | 21 kg | 162.605 |
| Casanare | 1.591,20 | 31.824 | 13.300 | 21 kg | 172.420 |
| Boyacá (Tunja) | 1.616,55 | 32.331 | 13.300 | 21 kg | 174.955 |
| Norte de Santander | 1.641,90 | 32.838 | 13.300 | 21 kg | 177.490 |
| Sucre | 1.647,10 | 32.942 | 13.300 | 21 kg | 178.010 |
| Caquetá | 1.725,75 | 34.515 | 13.300 | 21 kg | 185.875 |
| Cesar / Córdoba | 1.842,10 | 36.842 | 13.300 | 21 kg | 197.510 |
| Arauca / Boyacá gral. / Chocó | 3.400,00 | 85.000 | 12.700 | 26 kg | 352.700 |
| La Guajira | 5.400,00 | 135.000 | 22.700 | 26 kg | 562.700 |

## 5. Reglas de implementación

1. Separa la matriz en un archivo `tarifas.json`; el código solo lee de ahí. Agregar un destino no debe requerir tocar la lógica.
2. `DIVISOR_VOL` y los márgenes (0.05 / 0.10) son constantes configurables.
3. Valida entradas: peso > 0, dimensiones > 0 (opcionales), destino existente.
4. Redondeo: `round_half_up` a peso entero (no usar el redondeo bancario de Python; usa `decimal` o `int(x + 0.5)`).
5. Calcula `desde_kg` en tiempo de ejecución con `floor(minimo / tarifa_kg) + 1` y úsalo para decidir el margen del 10% cerca del umbral.
6. Salida: desglose (peso a cobrar, flete base, variable, total) y el rango min–max.
7. Pesos grandes (más de 100 kg): se asume la misma tarifa lineal; muestra una advertencia "estimación extrapolada".

## 6. Casos de prueba (datos reales, deben dar exacto)

| Destino | kg | Flete base | + Variable | Total |
|---|---|---|---|---|
| Bogotá | 40 | 31.538 | 13.300 | 44.838 |
| Antioquia | 36 | 28.384 | 13.300 | 41.684 |
| Antioquia | 38 | 29.961 | 13.300 | 43.261 |
| Antioquia | 100 | 78.845 | 13.300 | 92.145 |
| Valle (Cali) | 38 | 15.250 | 8.650 | 23.900 |
| Valle (Cali) | 39 | 15.464 | 8.650 | 24.114 |
| Valle (Cali) | 42 | 16.653 | 8.650 | 25.303 |
| Arauca | 27 | 91.800 | 12.700 | 104.500 |
| Arauca | 28 | 95.200 | 12.700 | 107.900 |
| Arauca | 100 | 340.000 | 12.700 | 352.700 |
| Caldas | 28 | 22.077 | 10.300 | 32.377 |
| Caldas | 29 | 22.865 | 10.300 | 33.165 |
| Atlántico | 23 | 28.360 | 13.300 | 41.660 |
| Atlántico | 24 | 29.593 | 13.300 | 42.893 |
| Boyacá (Tunja) | 21 | 33.948 | 13.300 | 47.248 |
| Boyacá (Tunja) | 22 | 35.564 | 13.300 | 48.864 |
| Caquetá | 22 | 37.966 | 13.300 | 51.266 |
| Cesar | 21 | 38.684 | 13.300 | 51.984 |
| Huila | 21 | 28.583 | 13.300 | 41.883 |
| Huila | 22 | 29.944 | 13.300 | 43.244 |
| La Guajira | 26 | 140.400 | 22.700 | 163.100 |
| La Guajira | 27 | 145.800 | 22.700 | 168.500 |
| Magdalena | 21 | 31.354 | 13.300 | 44.654 |
| Meta | 22 | 32.018 | 13.300 | 45.318 |
| Quindío | 25 | 21.600 | 10.300 | 31.900 |
| Quindío | 26 | 21.666 | 10.300 | 31.966 |
| Quindío | 27 | 22.499 | 10.300 | 32.799 |
| Santander | 22 | 31.131 | 13.300 | 44.431 |
| Sucre | 22 | 36.236 | 13.300 | 49.536 |
| Norte de Santander | 22 | 36.122 | 13.300 | 49.422 |
| Popayán | 100 | 59.995 | 10.300 | 70.295 |
| Pasto | 100 | 67.275 | 10.300 | 77.575 |
| Casanare | 21 | 33.415 | 13.300 | 46.715 |

## 7. Datos pendientes de confirmar con cotizaciones reales

- **Bogotá:** con la fórmula el cobro por kilo empieza en 36 kg (28.384), igual que Antioquia. Antes se había dicho que de 30 a 39 no cambia; cotizar 36 y 38 kg para confirmar.
- **Ibagué:** el dato de 36 kg (28.374) parece un error de digitación; la fórmula da 28.384.
- **Popayán:** según la fórmula el cobro por kilo empieza en 37 kg (22.198), no en 36.
- **Pasto:** el mínimo (21.600) y el umbral (33 kg) se asumieron por analogía con Quindío/Caldas; cotizar 30 y 34 kg.
- **Divisor volumétrico:** 5.000 es el estándar de mercado, no confirmado para Envía.
- **Peso mayor a 100 kg:** se supone el mismo $/kg; confirmar si hay otro escalón.

