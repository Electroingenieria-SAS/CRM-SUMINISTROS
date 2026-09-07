# Vercel deployment hold

Temporalmente, los despliegues automáticos de Vercel están desactivados en `vercel.json` mediante `git.deploymentEnabled: false`.

Motivo: integrar y revisar visualmente CRM Suministros V11.17.0 (Centro de Corte) en GitHub sin consumir cuota ni publicar producción.

Para liberar producción, reactivar explícitamente el despliegue de `main`, validar CI y ejecutar una única salida controlada.
