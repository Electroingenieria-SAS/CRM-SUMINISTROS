# Gobierno del repositorio y seguridad de cambios

## Objetivo

Este documento define el contrato operativo para que CRM Suministros mantenga una sola línea productiva verificable, reduzca deuda de ramas y evite que cambios de seguridad o release lleguen a producción sin validación.

## Rama productiva

- `main` es la única rama que Vercel puede desplegar automáticamente a Production.
- Todo cambio funcional, de seguridad, base de datos, integración o release debe ingresar mediante Pull Request.
- El check **Validate CRM Suministros** debe finalizar correctamente antes del merge.
- No se deben permitir force-push ni eliminación de `main`.
- El método preferido de integración es **squash merge** para mantener trazabilidad clara.

> **Estado verificado 23/09/2026:** GitHub continúa reportando `main` sin protección y sin rulesets. La configuración requerida es un control administrativo de plataforma pendiente; hasta activarlo, esta política es obligatoria por proceso pero no está forzada por GitHub.

## Ciclo de ramas

Clasificación:

- `feature/*`: desarrollo funcional.
- `fix/*`: corrección puntual.
- `hardening/*`: seguridad, plataforma o confiabilidad.
- `docs/*`: documentación.
- `backup/*`: excepcional; requiere fecha y motivo.

Política de cierre:

1. Una rama fusionada y sin commits exclusivos debe eliminarse.
2. Ramas `__tmp_*`, `*-temp`, `preview-*` y equivalentes no deben conservarse después de la validación.
3. Ramas de backup deben tener fecha y una justificación en issue/PR.
4. `gh-pages` y ramas técnicas controladas por automatización se excluyen de la limpieza manual.
5. No eliminar ramas con commits no fusionados sin revisar su propósito y propietario.

## Historial y secretos

La CI combina scanner propio, historial Git completo, TruffleHog, CodeQL, Dependency Review, npm audit y Dependabot. El scanner propio cubre:

- claves privadas;
- Supabase secret keys;
- JWT de service role;
- tokens GitHub;
- API keys Google;
- access keys AWS.

Un hallazgo histórico se considera incidente de credencial: primero se rota/revoca el secreto y después, si corresponde, se reescribe la historia.

## SECURITY DEFINER

Las funciones `SECURITY DEFINER` no se consideran inseguras por sí mismas, pero deben conservar:

- `search_path` explícito;
- autorización interna o delegación a un núcleo que la aplique;
- cero ejecución para `anon`;
- acceso `service_role` exclusivo cuando la función manipula secretos o integración privada.

La función `public.erp_x_security_definer_contract_check()` verifica este contrato desde V11.30.1.

## Dependencias y CSP

- Dependencias CDN deben permanecer fijadas a versión exacta cuando el proveedor lo permita.
- No se permite `unsafe-eval`.
- El bootstrap inline de Speed Insights se autoriza con hash CSP específico, no con `unsafe-inline` en `script-src`.
- `style-src` general no permite `'unsafe-inline'`; la única compatibilidad restante está confinada a `style-src-attr` para valores visuales dinámicos.\n- El E2E autenticado desktop/móvil es un release gate y requiere `ERP_QA_EMAIL` + `ERP_QA_PASSWORD`.\n- Todo DDL nuevo debe existir primero en `supabase/migrations/` y pasar el ledger de procedencia.
