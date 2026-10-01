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
