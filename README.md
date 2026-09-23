# CRM Suministros — Electroingeniería S.A.S.

> Versión candidata: **V11.34.1** · build **2026-09-23.05**  
> Producción: Vercel + Supabase `hezjxcxxcjlpmyalftam`  
> Auditoría integral vigente: `docs/AUDITORIA_INTEGRAL_2026-09-14.md`

## 1. Propósito

CRM Suministros centraliza relación comercial, pedidos y operación de suministros desde Ventas hasta el cierre: Cartera, Caja, Compras, Recepción, Alistamiento, Corte, Facturación, Despachos, Inventario, aprobaciones, auditoría, analítica y gestión de actividades.

Las transiciones de negocio no dependen de estados manipulados en el navegador. El frontend solicita acciones a RPC `public.erp_x_*`; PostgreSQL/Supabase valida identidad, roles, propiedad, versión y reglas operativas antes de persistir cambios.

## 2. Arquitectura productiva

```text
Usuario
  │
  ▼
SPA HTML/CSS/ES Modules
  │
  ├── Supabase Auth ───────────── sesión JWT
  ├── public.erp_x_* RPC ──────── lógica de negocio / erp_supply
  ├── Edge Functions ──────────── administración e integraciones server-side
  ├── Google Apps Script ──────── Drive institucional
  └── Vercel ──────────────────── hosting, security headers y Speed Insights
```

El browser no accede directamente a tablas operativas. El esquema `erp_supply` permanece detrás de RLS y contratos RPC. `scripts/validate.mjs` y `scripts/link-check.mjs` hacen cumplir esta frontera.

## 3. Estado V11.33.0

La línea base productiva V11.31.2 fue auditada nuevamente el 23 de septiembre de 2026. V11.32.0 introdujo el saneamiento y hardening de la candidata; V11.33.0 añade el rediseño de **Jornada y actividades → Cronograma** sin promover todavía cambios a Vercel ni a la base productiva.

### Mi jornada V11.34.1

- iniciar una actividad requiere un solo toque desde agenda o inicio rápido, **sin aprobación previa del jefe**;
- el usuario **no informa duración estimada**: el cronómetro mide el tiempo real;
- semáforo automático: verde < 45 min, amarillo 45–60 min, rojo > 60 min;
- > 60 min queda marcado como **Pendiente de revisión** por la base candidata; el control del jefe ocurre únicamente después de la ejecución;
- finalizar exige seleccionar primero **Tomar foto** o **Subir foto**;
- la foto se carga exclusivamente mediante el puente institucional **Google Apps Script → Google Drive** y luego se registra en el ERP;
- las actividades operativas requieren foto final; `BEFORE_AFTER` conserva foto inicial + foto final;
- el catálogo diario se vuelve liviano y deja de recalcular percentiles históricos al abrir Mi jornada;
- migraciones `116_workforce_my_day_automation_v11_34_0.sql` y `117_workforce_manager_review_v11_34_1.sql` versionadas y **no aplicadas todavía a Supabase productivo**.
- la bandeja gerencial muestra solo tiempos > 1 h, foto final y revisiones recientes; no existe cola de aprobación previa.

### Cronograma laboral V11.33.0

- vistas **Día, Semana y Mes laboral**;
- Día usa los segmentos institucionales 07:00–12:00 y 13:40–17:30;
- Semana usa exclusivamente lunes a viernes;
- Mes usa una grilla laboral de cinco columnas, sin sábados ni domingos;
- festivos del calendario institucional se muestran bloqueados y no consumen capacidad;
- cada persona muestra **Disponible / Ocupado / En pausa** y, cuando aplica, la actividad actual;
- capacidad usa minutos laborales reales (530 min por día configurado);
- catálogo de actividades se carga bajo demanda y se conserva en memoria;
- calendario se reutiliza en memoria; tras promover la migración 115, el RPC del planner entregará equipo, asignaciones, segmentos y festivos en una sola respuesta;
- la migración `115_workforce_planner_calendar_v11_33_0.sql` está versionada pero **no aplicada todavía a Supabase productivo**.

El hardening acumulado conserva además:

- health check de backend **21/21 OK**;
- 0 pedidos finalizados con tareas activas;
- 0 pedidos activos duplicados;
- 0 saldos negativos de inventario o reservas;
- 0 perfiles operativos activos sin identidad Auth;
- 0 RPC `erp_x_*` ejecutables por `anon`;
- 0 eventos CRM → AuditoriaERP fallidos, vencidos o atascados;
- Vercel sin errores runtime detectados en la ventana auditada;
- CI canónica en sintaxis, ES Modules, seguridad, arquitectura, release y smoke desktop/móvil;
- scanner de secretos del historial Git completo;
- health contract service-role-only para `SECURITY DEFINER`;
- smoke browser también en el push post-merge a `main`;
- CSS runtime externalizado a recursos same-origin;
- `style-src` general sin `'unsafe-inline'`; la compatibilidad dinámica queda confinada a `style-src-attr`;
- Gestión rápida usa hasta 1120 px en desktop sin afectar el ancho de otros popups;
- encabezado de Gestión rápida con kicker, pedido y subtítulo en tonos azules legibles;
- cinco estados operativos aprovechan una sola fila en desktop y degradan responsivamente;
- confirmación independiente **Entregado con satisfacción** después de la entrega logística;
- distancia recorrida y fuente de kilometraje por entrega;
- tiempos separados: salida → entrega, salida → satisfacción y entrega → confirmación;
- métricas de distancia/satisfacción disponibles en Pedidos enviados, detalle y Analítica → Entregas.
- E2E autenticado obligatorio en desktop y móvil para módulos críticos;
- CodeQL, Dependency Review, TruffleHog y Dependabot incorporados al gobierno CI;
- métricas de AuditoriaERP autenticadas, sin CORS wildcard y limitadas por organización;
- sesiones de impersonación con actor original, actor efectivo, motivo, vigencia y trazabilidad en auditoría;
- barrera XSS central para HTML reutilizable de modales/wizards;
- ledger de procedencia de migraciones y documentación DR realista;

Estado detallado: `docs/IMPLEMENTATION_STATUS.md`.

## 4. Integración CRM → AuditoriaERP

Una recepción de mercancía con novedad, avería, faltante, rechazo, estado parcial/no conforme o texto de novedad genera una entrada idempotente para **AuditoriaERP → Recepción**.

```text
warehouse_receipts
   │ trigger
   ▼
auditoria_erp_outbox
   │ pg_net / dispatcher
   ▼
erp-auditoria-bridge
   │
   ▼
AuditoriaERP.recepciones
```

El payload conserva el texto humano digitado en CRM (`noveltyNote`, `informationCaptured`, `verificationNote`, `generalNote`) y usa el marcador determinístico `[CRM_SYNC:<eventKey>]` para no duplicar la recepción destino.

El navegador conserva un fallback autenticado, pero el flujo principal no depende de mantener una pestaña abierta. `scripts/integration-contract-check.mjs` protege este contrato en cada PR.

## 5. Módulos

### Comercial
- Centro de operaciones.
- Pedidos / Ventas.
- Crédito.

### Operación de suministros
- Cartera.
- Caja.
- Compras.
- Recepción de mercancía y Recepción de pedido.
- Alistamiento.
- Corte.
- Facturación.
- Despachos, entregas y cierre.

### Personas y productividad
- Jornada, actividades, planeación, cronograma, evidencias y capacidad.

### Control y análisis
- Inventario.
- Excepciones y aprobaciones.
- Flujo y tiempos / VSM.
- Analítica y reportes.
- Histórico.
- Auditoría.
- Administración.

## 6. Estructura canónica

```text
assets/
  css/
    core-shell.css
    operations.css
    analytics.css
    experience.css
  js/
    app-entry.js          único composition root
    main.js               boot/router
    config.js             configuración pública del browser
    core/
    modules/
    services/
docs/
scripts/
supabase/
  functions/
  migrations/
google-apps-script/
templates/
index.html
service-worker.js
vercel.json
```

No agregar familias CSS, entrypoints o propietarios de módulos paralelos sin actualizar el contrato canónico y pasar CI.

## 7. Desarrollo y validación

Requisitos: Node.js 24 en CI; navegador moderno con ES Modules.

```bash
npm install
npm run validate
npm run serve
```

`npm run validate` ejecuta:

1. arquitectura/invariantes del CRM;
2. grafo ES Modules y detección de huérfanos;
3. scanner/contrato de seguridad;
4. contrato CRM → AuditoriaERP.

La CI añade además Playwright para el shell público desktop/móvil y construye el artefacto desplegable.

## 8. Configuración pública y secretos

`assets/js/config.js` puede contener exclusivamente configuración pública de cliente, incluida la publishable key de Supabase.

Nunca añadir al frontend ni al repositorio:

- `service_role`;
- `sb_secret_...`;
- JWT signing secrets;
- private keys;
- passwords.

Los secretos de integración se mantienen server-side/Vault. La configuración de destino de AuditoriaERP se obtiene mediante RPC service-role-only.

## 9. Edge Functions

`supabase/config.toml` documenta el contrato productivo:

- `erp-admin-users`: `verify_jwt=true`;
- `erp-admin-impersonate`: `verify_jwt=true`;
- `erp-auditoria-bridge`: `verify_jwt=false` deliberadamente, con autenticación propia para browser y token/claim server-to-server para PostgreSQL;
- `erp-auditoria-metrics`: `verify_jwt=true`; la Edge valida sesión y el RPC limita los agregados a la organización autorizada.

No cambiar estos modos sin revisar su contrato completo. En particular, activar gateway JWT sobre el bridge rompería el dispatcher `pg_net` de base de datos.

## 10. Seguridad

- RLS habilitado en todas las tablas base de `erp_supply`.
- Browser RPC-only para datos operativos.
- Ningún `erp_x_*` disponible para `anon`.
- `SECURITY DEFINER` usa `search_path` controlado y autorización interna según función.
- Funciones sensibles de integración reservadas a `service_role`.
- CORS administrativo por allowlist.
- CSP, HSTS, anti-framing, nosniff, Referrer Policy y Permissions Policy en Vercel.
- Límite local de intentos de login como capa UX; la defensa principal pertenece a Supabase Auth.
- Archivos restringidos por tamaño/tipo en browser y Apps Script.

**Pendientes administrativos de plataforma:** Supabase Security Advisor continúa reportando `Leaked Password Protection` deshabilitado y GitHub aún debe aplicar ruleset/branch protection efectivo a `main`. El código no simula estos controles ni afirma que estén activos mientras la plataforma no lo confirme.

V11.30.1 añade además `.gitignore`, `.env.example`, escaneo del historial Git y `erp_x_security_definer_contract_check()` como control service-role-only.

## 11. Base de datos y migraciones

No editar producción manualmente para “arreglar un estado” si existe un RPC o transición. Toda modificación de esquema debe quedar en migración reproducible.

Migraciones recientes relevantes:

- 098–101: RLS/performance V11.27.
- 102–107: integración CRM → AuditoriaERP.
- 108: health check integral V11.30.
- 109: contrato observable de integración V11.30.
- 110: contrato observable de privilegios `SECURITY DEFINER` V11.30.1.

Antes de promover una migración: CI verde, revisión del SQL, aplicación controlada, health checks posteriores y verificación de Advisors.

## 12. Performance

No convertir automáticamente todas las recomendaciones del Advisor en índices. Las FKs sin índice y los índices sin uso deben evaluarse con volumen, cardinalidad, frecuencia de joins y `pg_stat_statements`; un índice también tiene costo de escritura y mantenimiento.

Durante la auditoría V11.30 los RPC principales medidos se mantuvieron en rangos operativos adecuados para el volumen actual.

## 13. PWA y releases

El service worker es network-first para recursos same-origin y usa cache identificada por release. Al promover versión debe actualizarse de forma coordinada:

- `assets/js/config.js`;
- `package.json` / `package-lock.json`;
- query strings de `index.html`;
- `service-worker.js`;
- invariantes de `.github/workflows/validate-crm.yml`;
- `scripts/validate.mjs`;
- `CHANGELOG.md`.

No hacer bumps parciales.

## 14. QA y despliegue

Todo cambio debe llegar a `main` mediante Pull Request con la CI canónica en verde. El gate incluye E2E autenticado desktop/móvil y análisis de seguridad. Vercel continúa configurado para desplegar Production únicamente desde `main`.

Después de un cambio de backend o integración, ejecutar los health checks y comprobar que no existan eventos de outbox fallidos/atascados.

## 15. Operación e incidentes

Consultar:

- `docs/AUDITORIA_INTEGRAL_2026-09-14.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/SECURITY.md`
- `docs/ARCHITECTURE.md`
- `docs/FUNCTIONAL_FLOWS.md`
- `docs/QA_RELEASE_CHECKLIST.md`
- `docs/DEPLOYMENT_VERCEL_SUPABASE.md`
- `docs/OPERATIONS_RUNBOOK.md`

El SQL histórico se conserva por trazabilidad. `supabase/production-migration-ledger.json` congela 27 migraciones históricas database-only; `docs/DISASTER_RECOVERY.md` define la ruta de recuperación vigente. No se retirará historia adicional hasta certificar un baseline source-only en una base vacía.
