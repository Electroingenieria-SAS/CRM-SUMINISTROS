# Despliegue y salud de integración

Este documento registra el mecanismo esperado de publicación del CRM Suministros.

## Flujo esperado

1. Los cambios se validan mediante GitHub Actions.
2. `main` representa la versión candidata a producción.
3. Vercel debe detectar cada push a `main` y crear un deployment asociado al commit.
4. El alias productivo es `crm-suministros-amber.vercel.app`.

## Verificación de integración

El 4 de septiembre de 2026 se realizó una prueba de reconexión GitHub → Vercel después de restaurar el repositorio y cambiar su visibilidad a pública. Este commit sirve como prueba controlada del webhook de despliegue automático.
