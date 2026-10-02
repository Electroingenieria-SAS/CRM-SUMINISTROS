# Despliegue y salud de integración

## Flujo productivo objetivo

1. Todo cambio se desarrolla en una rama distinta de `main`.
2. Se abre Pull Request contra `main`.
3. GitHub Actions ejecuta **Validate CRM Suministros**.
4. El PR solo debe fusionarse con la validación en verde.
5. El método recomendado es **squash merge**.
6. Vercel mantiene el auto-deploy de Git deshabilitado en operación normal.
7. Para una promoción controlada sin `VERCEL_TOKEN`, se abre una ventana versionada (`release/vercel-production-window.json`) que habilita temporalmente únicamente `main`.
8. Tras el merge, la misma CI vuelve a ejecutar validaciones y smoke desktop/móvil sobre el SHA productivo.
9. Se confirma que Vercel publica el SHA de `main`, queda `READY` y sirve la revisión PWA esperada; inmediatamente después se cierra la ventana y `main` vuelve a `false`.

## Protección requerida de main

La configuración de GitHub debe mantener:

- Pull Request obligatorio para cambios normales;
- check requerido: **Validate CRM Suministros**;
- bloqueo de force-push;
- bloqueo de eliminación de `main`;
- conversaciones/revisiones resueltas antes del merge cuando existan;
- squash merge como método preferido.

La protección es un control de plataforma: no puede sustituirse con un archivo del repositorio. La CI post-merge es una defensa adicional, no un reemplazo del ruleset.

## Vercel

Contrato actual:

- proyecto: `crm-suministros`;
- rama Production: `main`;
- operación normal: `deploymentEnabled.main = false` y `deploymentEnabled.* = false`;
- ventana controlada: solo `main` puede pasar temporalmente a `true`, acompañada por `release/vercel-production-window.json` y PR verde;
- el deploy directo por GitHub Actions requiere `VERCEL_TOKEN`; si el secreto no está configurado, la ventana controlada es el mecanismo de promoción auditado;
- dominio estable: `crm-suministros-amber.vercel.app`.

Una ventana de producción debe cerrarse inmediatamente después de verificar el deployment. El estado final aceptado del repositorio vuelve a ser `main: false` y `*: false`.

El deployment se considera válido únicamente si:

- el SHA de Vercel coincide con el HEAD fusionado de `main`;
- el estado es `READY`;
- `assets/js/config.js`, `index.html` y `service-worker.js` muestran la misma versión/build;
- no aparecen errores runtime nuevos;
- la PWA sirve el cache correspondiente al release.

## CI V11.30.1

La CI canónica valida en PR, push a `main` y ejecución manual:

- sintaxis JavaScript;
- grafo ES Modules;
- scanner de seguridad del árbol actual;
- scanner de secretos del historial Git completo;
- arquitectura canónica;
- contrato CRM → AuditoriaERP;
- invariantes de release y PWA;
- Playwright desktop y mobile;
- artefacto desplegable.

El checkout usa `fetch-depth: 0` para que el análisis histórico sea real y no se limite al commit actual.

## Base de datos / Supabase

Cambios DDL deben quedar en migración reproducible. Antes de dar por cerrado un release con migraciones:

1. CI verde;
2. revisión del SQL;
3. aplicación controlada;
4. ejecución de health checks;
5. ejecución de Security/Performance Advisors;
6. verificación de integraciones y colas;
7. comprobación de errores runtime.

No modificar datos operativos directamente para resolver un estado si existe un RPC o transición canónica.

## Rollback

Vercel permite seleccionar un deployment productivo anterior como candidato de rollback. Un rollback de frontend no revierte automáticamente migraciones Supabase; por eso las migraciones deben diseñarse de forma compatible/no destructiva o disponer de un procedimiento explícito de reversión.
