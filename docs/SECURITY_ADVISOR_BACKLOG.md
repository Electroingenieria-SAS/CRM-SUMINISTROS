# ERP EI · Security Advisor Backlog · 2026-09-01

Este documento registra advertencias que **no deben corregirse con borrados o revocaciones masivas** porque forman parte de la API del ERP o requieren una decisión arquitectónica.

## Resuelto en esta reconstrucción

- Acceso `anon` a los RPC `SECURITY DEFINER` identificados por Advisor: **0 restante** tras migración 074.
- Índice duplicado `idx_financial_validations_order_type_v1033`: eliminado.
- `profiles_read_v8`: `auth.uid()` estabilizado mediante `(select auth.uid())`.

## Pendiente prioritario

### 1. Reducir la superficie `SECURITY DEFINER`

El ERP usa RPC públicos como fachada de negocio. Que un RPC autenticado sea `SECURITY DEFINER` no implica por sí mismo una vulnerabilidad, pero obliga a que la función haga autorización interna antes de leer o mutar datos. La familia actual `erp_x_*` debe revisarse función por función contra una matriz de roles/acciones.

Plan recomendado:

1. inventariar RPC realmente llamados por `assets/js/services/api.js`;
2. clasificar cada RPC como lectura, escritura, administrativa o helper;
3. mover helpers internos a un esquema no expuesto (`private`/`erp_supply`) cuando sea viable;
4. cambiar a `SECURITY INVOKER` donde RLS pueda expresar correctamente la autorización;
5. mantener `SECURITY DEFINER` solo donde exista justificación y validación explícita de actor/rol/organización;
6. revocar `EXECUTE` a `anon` y a roles que no lo necesiten;
7. fijar `search_path` en toda función privilegiada.

### 2. Funciones con `search_path` mutable

Advisor señala helpers en `public` y `erp_supply` cuyo `search_path` no está fijado. Deben migrarse gradualmente a `SET search_path = pg_catalog, public, erp_supply` —o el mínimo necesario— después de verificar dependencias y nombres no cualificados.

No se aplicó un `ALTER FUNCTION ... SET search_path` masivo porque una función que dependa de resolución implícita de objetos puede cambiar de comportamiento si se modifica sin prueba.

### 3. Familias legacy `erp_v9_*`

Son candidatas fuertes a deprecación. El runtime V10.33.1 usa `erp_x_*`; sin embargo, antes de eliminarlas se debe confirmar que no haya integraciones externas, scripts administrativos o clientes anteriores consumiéndolas.

### 4. RLS habilitado sin políticas en `erp_supply`

Muchas tablas internas tienen RLS activo y cero políticas. Esto produce un aviso INFO, pero en un esquema interno puede ser una estrategia *deny by default*: el cliente no accede directamente y la lógica pasa por RPC controlados. No se deben crear políticas permisivas solo para silenciar el Advisor.

### 5. Auth: leaked-password protection

El Advisor confirma que la protección contra contraseñas filtradas está deshabilitada. Debe activarse en Auth si el plan de Supabase lo soporta y reforzarse con longitud/complejidad, MFA para privilegios y reautenticación para cambios sensibles.

### 6. Rate limiting y CAPTCHA

El bloqueo de 10 intentos añadido en el frontend es una defensa secundaria de UX y **no sustituye** un límite de servidor. Configurar en Supabase Auth el límite acordado y CAPTCHA/Turnstile para login/reset. Para acciones administrativas de la Edge Function, añadir un rate limiter persistente/edge si la exposición y el volumen lo justifican.

## Performance

El Advisor lista numerosas FK sin índices. Antes de indexar masivamente:

- revisar `pg_stat_statements` y consultas más costosas;
- priorizar columnas FK usadas en joins/filtros de flujos calientes;
- medir write amplification y tamaño del índice;
- crear índices concurrentemente en producción cuando corresponda;
- reevaluar Advisor y latencias después de cada lote.

Los índices marcados como “unused” tampoco deben borrarse de inmediato: primero validar un período representativo de estadísticas y ventanas de operación.
