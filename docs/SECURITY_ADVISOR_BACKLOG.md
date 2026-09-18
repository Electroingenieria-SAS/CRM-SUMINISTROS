# CRM Suministros · Security Advisor Backlog · 2026-09-18

Este documento separa advertencias que requieren acción real de aquellas que son coherentes con la arquitectura RPC-only del CRM. No se corrigen Advisors mediante permisos amplios, índices masivos o cambios destructivos sin evidencia.

## Estado verificado

### RLS / acceso anónimo

- Tablas base de `erp_supply`: RLS habilitado.
- RPC `public.erp_x_*` ejecutables por `anon`: **0**.
- Tablas internas con RLS sin policies: el Advisor mantiene avisos INFO; en este esquema son mayoritariamente **deny-by-default deliberado** porque el browser usa RPC y no acceso directo a tablas.

### SECURITY DEFINER

El Advisor reporta **147 funciones SECURITY DEFINER ejecutables por `authenticated`**. La auditoría del 18 de septiembre encontró:

- **0** ejecutables por `anon`;
- 140 con patrones directos de identidad/autorización detectables;
- 7 helpers/wrappers históricos que no contienen la guarda en el wrapper pero delegan en funciones auditadas:
  - `erp_can_read_case`;
  - `erp_case_id_visible`;
  - `erp_current_exact_role`;
  - `erp_current_firebase_uid`;
  - `erp_x_admin_save_profile`;
  - `erp_x_create_physical_receipt`;
  - `erp_x_resolve_cut_requirement`.

V11.30.1 añade `erp_x_security_definer_contract_check()` para detectar cambios en esta frontera. Este health contract es exclusivo de `service_role`.

**Criterio:** no convertir funciones masivamente a `SECURITY INVOKER`; revisar función por función y mover helpers internos a `erp_supply` cuando exista una mejora clara sin romper contratos.

## Pendientes de plataforma

### 1. Supabase Auth · Leaked Password Protection

Estado: **WARN / pendiente**.

El Advisor confirma que está deshabilitada. Debe activarse desde la configuración Auth/Management API autorizada. No existe un equivalente SQL seguro y no se debe simular en el frontend.

### 2. Supabase Auth · rate limiting y anti-bot

Estado: **pendiente**.

El guard local de intentos solo mejora UX. La defensa real requiere límites server-side y CAPTCHA/Turnstile/hCaptcha según las opciones del proyecto.

### 3. GitHub · protección de main

Estado: **pendiente de configuración administrativa**.

Objetivo:

- Pull Request obligatorio;
- check requerido **Validate CRM Suministros**;
- bloquear force-push;
- bloquear eliminación de `main`;
- squash merge como método preferido.

La CI V11.30.1 ejecuta nuevamente Playwright después del merge, pero esto es defensa adicional y no reemplaza branch protection.

## Performance Advisor

Última lectura: **127 foreign keys sin índice** y **74 índices sin uso registrado**.

No se aplican cambios masivos.

Criterio para crear un índice:

1. la FK/columna participa en un join/filtro real de un flujo caliente;
2. `EXPLAIN (ANALYZE, BUFFERS)` evidencia costo relevante;
3. `pg_stat_statements` confirma frecuencia/latencia;
4. se valora write amplification y tamaño;
5. se mide antes/después.

Criterio para retirar un índice:

1. ventana estadística representativa;
2. cero dependencia de constraint/índice único;
3. no pertenece a una funcionalidad estacional o recién desplegada;
4. prueba de planes antes/después;
5. rollback definido.

Por tanto, estos dos avisos permanecen **informativos** hasta que existan datos que justifiquen una intervención.

## Deuda técnica controlada

### CSP · estilos inline

Estado V11.30.2: **mitigación estructural aplicada**.

- Los seis bloques CSS creados desde JavaScript fueron externalizados a recursos same-origin.
- `style-src` general ya no contiene `'unsafe-inline'`.
- La excepción está confinada a `style-src-attr 'unsafe-inline'` por valores visuales dinámicos de progreso, porcentajes y variables calculadas.
- CI impide reintroducir `createElement("style")` o ampliar nuevamente la directiva general.

Pendiente de hardening futuro: sustituir los atributos dinámicos por clases/estructuras equivalentes para retirar también `style-src-attr 'unsafe-inline'`.

### Dependencias externas

Las dependencias CDN versionables están fijadas y la CI bloquea `latest/next`. Google Identity Services continúa usando el endpoint oficial dinámico. La incorporación de SRI o self-host debe evaluarse proveedor por proveedor; no se aplicará un hash incorrecto que bloquee producción.
