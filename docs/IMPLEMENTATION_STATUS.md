# Estado de implementación

## Release candidata — V11.34.3 · 2026-09-23

CRM Suministros mantiene la línea productiva V11.31.2. La candidata V11.33.0 acumula el hardening V11.32.0 y añade el nuevo cronograma laboral. **No se ha promovido esta candidata a Vercel ni se ha aplicado la migración 115 en Supabase productivo.**

## Backend sincronizado V11.34.3

Las migraciones 115, 116 y 117 fueron aplicadas al proyecto Supabase productivo el 23/09/2026 para evitar divergencia entre la candidata Pages y PostgREST. Se verificó exposición autenticada de `erp_x_work_manager_queue`, `erp_x_work_review_time` y `erp_x_work_start`. El frontend sigue sin promoción a Vercel.

## Mi jornada V11.34.3

- Flujo simplificado: elegir → iniciar → trabajar → finalizar con foto, sin aprobación previa para auxiliares ni otros roles autorizados por catálogo.
- Rediseño visual V11.34.3: encabezado guiado de tres pasos, taxonomía **Categoría → Subcategoría → Actividad**, selección sin inicio automático y confirmación explícita antes del cronómetro.
- Cronómetro reconstruido como consola compacta: actividad, tiempo activo, semáforo y acciones en un único bloque equilibrado.
- Se retiró la grilla plana V11.34.2 y sus estilos obsoletos; no queda como implementación paralela.
- Sin captura manual de duración ni causa de desviación en el cierre normal.
- Semáforo por tiempo activo: verde <45 min, amarillo 45–60 min, rojo >60 min.
- Las actividades rojas se envían a revisión posterior mediante `erp_x_work_review_time`; el jefe no aprueba antes de iniciar.
- Foto final obligatoria para actividades; BEFORE_AFTER mantiene foto antes y después.
- La evidencia continúa en Google Drive mediante el Apps Script institucional (`uploadWorkEvidence` / `submitToBridge`).
- El catálogo operativo elimina el cálculo de percentiles en cada apertura de Mi jornada para reducir consumo de Supabase Free.
- Migraciones 116, 117 y 118 versionadas y aplicadas a Supabase productivo el 23/09/2026.
- Migración 118 restaura `uiCategory`, `uiCategoryLabel` y `uiSubcategory` en el catálogo operativo sin reintroducir medianas/P80.
- La migración 117 redefine `erp_x_work_start` para permitir inicio directo, elimina el flujo de aprobación previa de Mi jornada y crea una única cola gerencial de excepciones > 60 min.
- Las solicitudes `SELF_PROPOSED` antiguas que permanezcan DRAFT/PENDING se cancelarán como flujo legado al promover la migración 117.

## Cronograma laboral V11.33.0

- Día laboral por segmentos reales del calendario institucional.
- Semana limitada a lunes–viernes.
- Mes laboral de cinco columnas, sin fines de semana.
- Festivos visibles como no laborables y excluidos de capacidad.
- Estado de persona Disponible/Ocupado/En pausa con actividad actual.
- Etiquetas de actividad normalizadas por estado.
- Cálculo de capacidad basado en calendario real.
- `workforce-planner-v11330.js` separa render y reglas de calendario de `workforce.js`.
- `workCatalog()` pasa a carga bajo demanda.
- El calendario se cachea en cliente; tras promover la migración 115 podrá llegar en la misma llamada `erp_x_work_planner`.
- La migración 115 añade una guardia de escritura que impide publicar actividades fuera de jornada.

## Hardening heredado de V11.32.0

## Arquitectura vigente

- SPA HTML/CSS/ES Modules en Vercel.
- Supabase Auth para identidad.
- Browser RPC-only para datos operativos; sin DML directo a `erp_supply`.
- Edge Functions para administración e integraciones privilegiadas.
- Google Apps Script para Drive institucional.
- PWA network-first con cache por release.
- CI única en `.github/workflows/validate-crm.yml`.

## Verificación productiva previa a V11.32.0

Auditoría del 23/09/2026 sobre V11.31.2:

- Vercel Production READY sobre SHA `e4c47a15b6095828dfaa5fa3fe505cd97467bcea`;
- Supabase `hezjxcxxcjlpmyalftam` ACTIVE_HEALTHY;
- 75 tablas base en `erp_supply`;
- 0 privilegios DML directos para `anon` o `authenticated`;
- 0 RPC `erp_x_*` ejecutables por `anon`;
- 0 `SECURITY DEFINER` auditados sin `search_path` controlado;
- 0 funciones autenticadas fuera del contrato de guardas V11.30.1;
- 0 triggers de usuario deshabilitados;
- 0 índices inválidos;
- outbox CRM → AuditoriaERP sin eventos atascados en la verificación ejecutada.

## Cambios V11.32.0

### E2E y CI

- Playwright autenticado es gate obligatorio, no `skip`.
- Recorre módulos críticos en Chromium desktop y emulación móvil.
- Test específico protege la barrera XSS de HTML reutilizable.
- CodeQL `security-extended`.
- Dependency Review.
- TruffleHog para secretos verificados.
- Scanner histórico propio.
- Dependabot para GitHub Actions y npm.
- `npm audit --audit-level=high`.
- Actions actualizadas a runtime Node 24.

### Impersonación

Nueva tabla `erp_supply.admin_impersonation_sessions`.

La sesión registra:

- Super Admin original;
- perfil/identidad efectiva;
- motivo;
- origen;
- inicio, última actividad, expiración y cierre.

El cliente aislado propaga `x-erp-impersonation-session`. Un trigger de auditoría solo acepta el identificador cuando coincide con `auth.uid()` del perfil objetivo y la sesión continúa vigente.

### Métricas AuditoriaERP

`erp-auditoria-metrics` pasa de público a autenticado.

- `verify_jwt=true`;
- sin CORS `*`;
- sin `service_role` dentro de la Edge Function;
- perfil y permisos requeridos;
- resultados filtrados por `organization_id`;
- `Cache-Control: no-store`.

### XSS

`core/ui.js` establece una frontera común de sanitización para HTML estructurado de modales/wizard/task panels. El control elimina tags ejecutables, handlers `on*`, `srcdoc`, URLs activas y estilos ejecutables conocidos antes de insertar HTML reutilizable.

### Administración

Se inició refactor progresivo, sin reescribir toda la consola de una vez:

- `admin-user-verification-v11320.js` es propietario de impersonación/verificación;
- `admin-view-helpers-v11320.js` contiene helpers visuales reutilizables;
- `admin.js` queda como composición ligera;
- `admin-center-v11160.js` conserva temporalmente la lógica restante hasta nuevas extracciones con pruebas.

## Reproducibilidad y DR

La auditoría encontró historia de base aplicada fuera de Git.

- El antiguo `sql/00_INSTALL_ALL.sql` existió hasta V11.5 y fue retirado en V11.21.
- No representa el esquema actual y no se reintroduce como instalador.
- `supabase/production-migration-ledger.json` congela 27 migraciones históricas database-only.
- `npm run db:ledger` impide aumentar silenciosamente esa deuda.
- `docs/DISASTER_RECOVERY.md` define DR operativo y el requisito para certificar un baseline source-only.

Una reconstrucción desde PostgreSQL completamente vacío **todavía no está certificada**. Cerrarla exige generar/probar un baseline contra una base desechable y llevar el debt budget a cero.

## Pendientes administrativos de plataforma

Estos controles no pueden activarse desde los scopes actuales de los conectores utilizados por esta sesión:

- GitHub: ruleset/branch protection real de `main`.
- Supabase Auth: Leaked Password Protection.

El código y la documentación los tratan como requisitos; no se marcan como cumplidos hasta que GitHub/Supabase lo confirmen.

## Advisors no tratados masivamente

No se crean/borran índices ni se cambian 148 funciones `SECURITY DEFINER` o policies RLS únicamente para reducir contadores de Advisor.

La decisión se mantiene:

- FKs/índices: intervenir con evidencia de hot path.
- RLS sin policy: compatible con deny-by-default cuando no hay DML de cliente.
- `SECURITY DEFINER`: evaluar autorización real, `search_path` y grants, no el nombre del lint aislado.

## Regla de cambio

Todo cambio de código pasa por rama → PR → CI. Todo DDL nuevo debe existir como migración antes de producción. Mientras `main` no tenga ruleset de plataforma, el equipo debe evitar cualquier escritura directa y verificar manualmente el SHA que se promueve.
