# CRM-SUMINISTROS · ejecución controlada

Repositorio exclusivo: `Electroingenieria-SAS/CRM-SUMINISTROS`.
Rama del ejecutor: `refactor/domain-modularization-20261001`.
Base: `4bdceeaa54847581f83e9425aa0310aae8b0547d`.

## Coordinación con el hilo auxiliar

El ejecutor principal modifica JavaScript, CSS, Apps Script y scripts de validación,
un dominio por vez. El auxiliar no modifica esos archivos ni mueve esta rama.
Trabaja en su propia rama y comunica SHA, PR, check y resultado concretos.

Tareas asignadas al auxiliar por el usuario:

- Reconciliar `supabase/production-migration-ledger.json` y documentación asociada.
  114 se aplicó efectivamente como `20261001153516_impersonation_metrics_security_v11_32_0`.
  No marcarla como aplicada en una fecha anterior ni modificar el SQL histórico.
- 079: nombre remoto `079_jefatura_revision_aprobacion_sin_operacion`, versión
  `20260904150023`; documentar alias al archivo histórico con sufijo `v11_8_1`.
- 083: códigos PVC/PVN/PVE/PVP tienen `name=code`; no existe entrada remota de 083.
  Registrar evidencia de efecto presente sin inventar una ejecución histórica.
- 129: conservar ambas entradas `20260924214248` y `20260924215240`.
  MD5 SQL remoto idéntico: `0d6936c4e8e8210e3400087712fc79c2`.
- Incorporar la deuda histórica omitida `qa_flow_pool_protection_v10_25_11`,
  versión `20260813220811`, sin tratarla como una nueva modificación productiva.
- CI y comprobaciones puntuales de Supabase/Vercel solicitadas en este PR.
  `main`: PENDIENTE EXTERNO — integración sin operación administrativa.

## Evidencia de infraestructura ya obtenida

114: tabla con RLS y sin SELECT anon/authenticated, tres RPC autenticadas,
helpers privados, trigger habilitado y contrato SECURITY DEFINER correcto.
Se desplegó primero `erp-admin-impersonate` v2 y después `erp-auditoria-metrics` v2.
Ambas mantienen `verify_jwt=true`: HTTP sin sesión 401, OPTIONS permitido 204,
origen no permitido 403 y ausencia de CORS permisivo para ese origen.
No se ejercitaron sesiones de usuarios reales ni se cambiaron planes.

## Registro del ejecutor

- Orders: contratos históricos verdes antes del cambio. Extracción por
  responsabilidades, incluyendo callbacks del asistente de creación.
  Pruebas de badges/rutas y cinco contratos históricos verdes después.
  Se conservó el texto original «Cartera · cliente con mora» y «Caja · pedido retenido».
- Enlace ES Modules después de Orders: 140 archivos, 0 contratos rotos,
  0 módulos huérfanos. Verificación visual del dominio en curso.
- Próximo bloque: Workforce, después PACO y CSS. Ledger e infraestructura
  permanecen asignados al auxiliar.

- Workforce: jornada, catálogo, cronograma, calendario, timeline, evidencias,
  capacidad, asignación e indicadores extraídos. Ocho entradas JS versionadas
  eliminadas después de redirigir y comprobar consumidores. Archivo máximo: 161 líneas.
- Fallo reproducido y corregido: Actualizar jornada pasaba `true` como datos de
  `renderToday`, omitiendo el API. Prueba DOM RED (1 llamada) → GREEN (2 llamadas).
  Añadida regresión de navegador en `tests/domain-refactor.spec.js`.
- Nueve contratos Workforce verdes. DOM de cronograma, filtros dentro de acciones,
  modo Día e indicadores verde. Enlace: 228 archivos, 0 rotos/huérfanos.
- Los contratos de texto ahora leen los módulos canónicos y el orden de filtros
  se comprueba sobre el HTML compuesto, conservando las mismas exigencias.
- La instalación del navegador local no obtuvo un ZIP válido. No se insiste.
  Auxiliar: ejecutar smoke Playwright del PR, incluido `tests/domain-refactor.spec.js`.

- PACO: motor dividido en contexto, acciones, respuestas, voz, alertas y UI;
  lenguaje separado en normalización, coincidencias, aliases e intenciones.
  Tres entradas JS versionadas retiradas después de redirigir consumidores.
  Archivo máximo: 122 líneas. 1.179 comprobaciones de lenguaje verdes,
  contratos operacional/Workforce/logística verdes y apertura en DOM verde.
  Enlace: 256 archivos, 0 imports rotos y 0 módulos huérfanos.
- Siguiente bloque: CSS. Se conservará el orden original de reglas y la cascada;
  el smoke visual y responsive real queda asignado al auxiliar sobre este PR.

- CSS: cuatro familias críticas y cuatro capas Workforce/PACO divididas por
  responsabilidad. Las entradas conservan exclusivamente imports ordenados.
  162 archivos de estilos, máximo 281 líneas. No se quitaron `!important`
  sin evidencia visual; selectores y declaraciones permanecen equivalentes.
- Comparación AST original/composición: mismos 8.778 registros de reglas,
  condiciones, declaraciones y recursos resueltos, en el mismo orden.
  Huellas registradas en `css-cascade-equivalence-20261001.json`.
  Ocho contratos afectados y prueba de composición/recursos verdes.
- Auxiliar: smoke visual del PR #94 en Orders, Jornada, cronograma Día/Semana/Mes,
  indicadores y PACO; desktop, iPhone/WebKit, tablet, 1024 px y landscape.
  Confirmar scroll horizontal, teclado/foco, zoom 200 % y reduced motion.
  No se certifica responsive basándose únicamente en DOM o igualdad CSS.

- Reports: archivo versionado de 680 líneas retirado; 24 responsabilidades
  canónicas bajo `domains/analytics/reports`, controlador de menos de 100 líneas.
  Comparación DOM de ocho pestañas idéntica antes/después; consulta BI y apertura
  de vista guardada correctas. Enlace de dependencias verde.

- Receiving: pedido y mercancía extraídos en controladores, etapas, líneas,
  PDF, asignación, borradores, acciones y detalle. Hub versionado retirado.
  Comparación DOM antes/después de seis estados idéntica, incluyendo bloqueo
  por permisos, revisión/PDF, persistencia del borrador y lista de mercancía.
  Dependencias del dominio enlazadas. Regresión Playwright añadida para el auxiliar.

- Picking: verificación, origen físico, recogida de cortes, rondas parciales,
  confirmación y borradores extraídos. Comparación DOM de cuatro estados idéntica.
  Permisos y novedad obligatoria verdes; enlace del dominio verde.
- Fallo concreto reproducido: reanudar una línea FOUND usaba `sync` antes de
  inicializarlo, cerrando el popup. Inicialización adelantada a la restauración
  de orígenes; regresión DOM RED → GREEN y Playwright añadido.

- Core UI: saneamiento HTML, diálogos, accesibilidad/foco, toast, loading,
  empty state, formularios, paginación, task panel y asistente separados.
  `core/ui.js` conserva la API pública como fachada. El wizard se divide en
  preparación, plantilla y navegación; ninguna función nueva supera 80 líneas.
- XSS, avance/validación/cierre del wizard, Tab/Escape y restauración de app
  pasan tanto con el código previo como con la composición nueva en DOM.
  Orders sigue verde como consumidor inmediato. Dependencias enlazadas.
  Los gates de seguridad leen la implementación canónica, sin quitar exigencias.

- Drive: integración institucional separada en sesión, autorización de descarga,
  validación de archivo, codificación, puente POST/postMessage, uploads, preview
  y descarga. La fachada `services/drive.js` mantiene sus cuatro exports.
  Se reubicó correctamente el import dinámico de sesión.
- Prueba DOM antes/después: upload de pedido, registro de evidencia de actividad,
  preview, bloqueo de HTML/MIME, rechazo de origen/requestId incorrectos y limpieza
  de iframe/form verdes, sin escrituras externas. Contratos Workforce verdes.

- Finance/Billing: liberación financiera, estados/aprobación, acciones y resumen
  separados de pantallas de facturación, documentos, uploads y cierre.
  Comparación DOM de diez estados idéntica (Cartera, Caja, factura, PVP y Caja
  Facturación). Liberación permanece bloqueada antes de aprobación.
  Contrato comercial/fletes y enlace del dominio verdes.

- Lector de facturas: entrada versionada retirada; instalación/observación,
  adaptación de guardado, campos manuales, PDF, identidad, fechas, cantidades,
  peso e importes separados. Seis campos editables y comparación de parsing
  previo/nuevo verdes, con la corrección intencional descrita abajo.
- Fallo concreto de importe: `Cantidad total: 3` o `Peso total: 8 kg` eran
  interpretados como dinero por el detector genérico TOTAL. Se excluyen esos
  totales físicos; se conservan cantidades/peso y totales monetarios en la línea
  siguiente. Tres regresiones Node RED → GREEN, sin importaciones muertas.

- Shipping: rutas, permisos/responsable, toma/guía, cierre con evidencia,
  confirmación de entrega, pie de navegación y vista comercial separados.
  Comparación DOM original/nuevo de ocho estados (cuatro rutas × cola/en curso)
  y vista de Ventas idéntica, con roles cargados en `state.profile.roles`.
  Ventas no muestra acciones de operación. Dependencias del dominio enlazadas.

- VSM: controlador/filtros, carga, cálculos, diagnósticos, gráficos, órdenes,
  exportación y secciones de presentación separados; dos funciones de más de
  100 líneas reemplazadas por composición. DOM del mapa original/nuevo idéntico,
  preset/actualización y bloqueo de rango invertido verdes. Dependencias enlazadas.

- History: entrada versionada retirada; controlador, estado/filtros, RPC,
  archivo/lista, facetas, importaciones, cobertura, expediente y exportación
  separados. Tres pestañas DOM idénticas, ausencia de importación sin permiso
  y envío de búsqueda/origen correctos. Dependencias enlazadas.

- Materials/Siesa: selector, stock/ATP, resolución de líneas, runtime SheetJS,
  lectura de columnas, parsing y sincronización separados. `services/materials.js`
  conserva sus siete exports. Selección, ATP, invalidación al editar, parsing de
  fila física y rechazo de duplicados equivalentes antes/después.
  Contrato de fletes, Orders como consumidor inmediato y enlace verdes.

- Adaptadores operativos: entrada versionada retirada; captura de acciones queda
  en core/layout, y recepción/factura/guía/dashboard en sus respectivos dominios.
  El diálogo de recepción se divide en preparación, plantilla, confirmación y
  cambio de tipo. Plantilla DOM equivalente, devolución DEV y cantidades parciales
  correctas. Un conflicto local de nombre de contexto fue corregido antes de
  publicar; la prueba específica y el enlace del dominio quedaron verdes.

- Capa comercial: entrada versionada retirada; instalación/observación, encabezado,
  experiencia/búsqueda de Orders, asistentes y experiencia de Crédito separados.
  DOM original/nuevo de Orders y Crédito idéntico; enhancement idempotente y
  dependencias enlazadas.

- Apps Script: `Code.gs` retirado; diez archivos semánticos, todos inferiores a
  200 líneas. La función de upload de 84 líneas ahora compone contenido, contexto,
  carpetas, descripción y contrato de respuesta, reutilizando el contexto.
  Contrato Node de Drive privado/locks/identidades/validación/callback y contrato
  timeline verdes. Sesión ERP denegada impide crear archivos; POST permitido
  conserva su Authorization. No se ejecutaron escrituras reales de Drive.
- PENDIENTE EXTERNO — publicar fuentes en el proyecto Apps Script institucional.
  No hay operación conectada de despliegue en esta sesión. Instrucciones concretas
  en `google-apps-script/README.md`; conservar el despliegue/URL existente.

## Cierre técnico local

- Validator: `scripts/validate.mjs` queda como orquestador de 54 líneas y 17
  gates separados en architecture/security/database/tests/ci. Los controles
  existentes se conservan; las lecturas apuntan a implementaciones canónicas.
  Los tres contratos pendientes del adaptador operativo usan una composición
  compartida. El workflow queda en 297 líneas; syntax, invariantes de release
  y empaquetado tienen scripts pequeños.
- PWA: prueba RED reprodujo la instalación rechazada por rutas eliminadas.
  Se genera `assets/precache-manifest.json` con todos los JS/CSS actuales,
  incluidos fragmentos runtime; GREEN en instalación, limpieza de cachés y
  fallback offline/versionado. La caché incluye una revisión del contenido.
  `npm run pwa:generate` actualiza manifiesto y revisión; CI rechaza drift.
  Presupuesto del conjunto offline: 3 MiB de fuente y 750 assets. Actual:
  2.550.374 bytes y 651 assets. No representa transferencia ni Core Web Vitals.
- Ledger/DR del auxiliar absorbidos selectivamente desde
  `d0ffeb1f6a3758f3604d27508a18f5c771bee2f4` (#98), sin sobrescribir CI/PWA.
  079 se relaciona por alias/version/hash; 083 conserva evidencia de efecto
  sin fila histórica; 114 conserva timestamp/hash reales; ambas filas 129 se
  mantienen; QA tiene evidencia en `sql/`. Deuda database-only congelada en 27.
  Un gate valida consistencia de esta evidencia. No se escribió historia falsa,
  no se borraron/renombraron migraciones productivas ni se archivó `sql/`.
- `index.html` incluye `noindex,nofollow,noarchive` con salto de línea real.
- Revisión CodeQL puntual: fechas de vistas guardadas en Reports podían
  convertirse en HTML en el Explorador. Regresión RED → GREEN usando el escape
  compartido; ocho vistas con fechas normales conservan el DOM. El control de
  origen de Drive ya existía; ahora queda directamente en el receptor, sin
  duplicar el validador anterior. Origen/requestId, cleanup, uploads y preview
  pasan. La confirmación de cierre de las alertas depende del próximo CodeQL.
- Facturación: regresiones del auxiliar ampliadas para total monetario antes/
  después de cantidad, TOTAL genérico, peso/productos/unidades/bultos/paquetes
  y valor en línea siguiente. Se excluyen etiquetas físicas del importe sin
  umbrales arbitrarios. Identidad, fecha y seis campos editables siguen verdes.
- Verificación de fuentes refactorizadas: 407 archivos JS/MJS canónicos,
  máximo 161 líneas, ninguna función de más de 80 líneas ni imports sin uso.
  CI aplica límites de archivo y nombres semánticos a los dominios nuevos.
- Cierre global local: `npm run validate` completo verde tras corregir las
  tres lecturas legacy de Operational. Incluye grafo de 475 módulos sin rotos
  ni huérfanos, contratos funcionales, corpus PACO (1.179 checks), contrato de
  seguridad, integración y ledger, 16 regresiones Node y presupuesto PWA.
  Sintaxis JS/MJS y whitespace verdes. Empaquetado estático verificado con
  manifiesto, módulos, `.nojekyll` y BUILD_INFO.
- Browser: CI incluye regresiones Orders/Workforce/Receiving/Picking, shell/
  diálogo, labels, Tab/Shift+Tab/Escape/foco, reduced motion y scroll horizontal
  en Desktop Chrome, Pixel 7, WebKit/iPhone y tablet/1024/landscape. No confundir
  configuración/sintaxis con ejecución. El entorno local carece de binarios;
  las descargas fallaron y no se reiteran. El auxiliar informó bloqueo del
  navegador/preview y ausencia de credenciales QA para E2E autenticado.

### Pendientes externos de cierre

- `main`: branch protection/rulesets, ya confirmados inaccesibles mediante
  la integración. No se reintenta ni se cambia un plan.
- CI/browser: auxiliar verifica el SHA final y distingue pasos ejecutados de
  skipped. No certificar E2E autenticado sin `ERP_QA_EMAIL`/`ERP_QA_PASSWORD`.
  Smoke visual, contraste, zoom 200% y Core Web Vitals requieren navegador real.
- Auth: auxiliar confirma controles gratuitos reales (password leak, rate limit,
  brute force, MFA administrativo). Si un control exige pago: OMITIDO — requiere
  funcionalidad de pago. No simular controles de Supabase con JavaScript.
- Apps Script: publicación institucional siguiendo su README; fuentes/contrato
  ya probados, sin despliegue conectado ni escrituras reales de Drive.
- Baseline/rebuild: solo base local/desechable gratuita. No se certifica una
  reconstrucción 100% ni se usa producción para reconstruir. Deuda histórica
  conservada hasta que exista esa prueba.

El cierre de la PR sigue condicionado a esas evidencias; no se hace merge con
checks desconocidos ni se declara equivalencia visual sin smoke real.
