# Despliegue y salud de integración

Este documento registra el mecanismo esperado de publicación del CRM Suministros.

## Flujo esperado

1. Los cambios se validan mediante GitHub Actions.
2. `main` representa la versión candidata a producción.
3. Vercel debe detectar cada push a `main` y crear un deployment asociado al commit.
4. El alias productivo es `crm-suministros-amber.vercel.app`.

## Verificación de integración

El 4 de septiembre de 2026 se realizó una prueba de reconexión GitHub → Vercel después de restaurar el repositorio y cambiar su visibilidad a pública.

Resultado de la prueba:

- Push de control a `main`: `c9f34980f7e7c5207a0f8fe8c77a6a5a424b190e`.
- GitHub Actions: validación completa exitosa.
- Vercel: deployment automático de producción generado desde ese mismo commit.
- Alias productivo: versión `11.8.2`, build `2026-09-04.3`.

La integración GitHub → Vercel se considera restablecida mientras nuevos pushes a `main` sigan generando deployments asociados al SHA correspondiente.

## Protección recomendada de `main`

Mientras el mantenimiento del CRM continúe realizando commits directos a `main`, la protección debe ser compatible con ese flujo:

- Proteger `main` contra borrado.
- No permitir force-push.
- Mantener habilitado GitHub Actions.
- No exigir Pull Request obligatorio mientras se mantenga el flujo de edición directa.
- No exigir status checks como condición previa al push directo; el workflow actual los ejecuta inmediatamente después de cada push.

Si más adelante se adopta un flujo obligatorio por Pull Request, se recomienda entonces exigir el check `Validate CRM Suministros` antes de fusionar.
