# Changelog

## 11.30.0 — 2026-09-14

### Producción y release
- Normalizada la identidad de release en `CONFIG`, `package.json`, `package-lock.json`, `index.html`, PWA, CI y artefactos de despliegue.
- Cache PWA rotada desde el release canónico V11.27.0 hacia V11.30.0 sin alterar la estrategia network-first.
- La CI conserva un único composition root, cuatro familias CSS canónicas, grafo ES Modules sin huérfanos y smoke de shell en escritorio/móvil.

### Integridad y observabilidad
- `erp_x_health_check()` ampliado a 21 canarios y corregido el canario de Shipping para validar el snapshot de Ventas en `erp_x_shipping_send_to_closure()`.
- Añadido `erp_x_auditoria_erp_contract_check()` service-role-only para vigilar fuente, outbox, idempotencia, RPC privados, trigger/dispatcher y cola de CRM → AuditoriaERP.
- Auditoría productiva: 21/21 health checks OK, sin pedidos finalizados con tareas activas, sin saldos negativos y sin eventos de integración fallidos/atascados.

### Integración AuditoriaERP
- Añadido contrato estático no destructivo en CI: las novedades de Recepción deben conservar destino `recepciones`, escritura humana, idempotencia, dispatcher server-to-server y fallback autenticado.
- `supabase/config.toml` documenta los cuatro modos `verify_jwt` productivos para evitar drift de despliegue.
- El bridge continúa llevando novedad, información levantada, verificación y observación general al módulo Recepción de AuditoriaERP.

### Seguridad
- Se mantiene RLS en todo `erp_supply` y ningún `erp_x_*` es ejecutable por `anon`.
- Las funciones privadas de integración conservan acceso `service_role` únicamente donde corresponde.
- Leaked Password Protection de Supabase Auth permanece como ajuste de plataforma pendiente; no existe una mutación Auth segura disponible en el conector utilizado para este release.

## 10.33.1 Security Rebuild — 2026-09-01

### Seguridad
- Verificado proyecto Supabase `hezjxcxxcjlpmyalftam`.
- Migración 074 aplicada: cierre de `anon` en RPC privilegiados detectados, optimización RLS de perfiles y eliminación de índice duplicado.
- Scanner local de secretos y `.gitignore` reforzado.
- Edge Function administrativa con CORS por allowlist, respuestas `no-store` y contraseña mínima de 12 caracteres.
- Logs de API sin payloads sensibles.
- Allowlist de archivos y bloqueo de formatos activos/ejecutables en navegador y Apps Script.
- Cabeceras Vercel: CSP, HSTS, nosniff, anti-framing, Referrer/Permissions Policy y HTTPS upgrade.
- Bloqueo local adicional tras 10 fallos de login; el rate limit real de servidor/CAPTCHA queda como configuración de Supabase Auth.

### Funcionalidad y estabilidad
- Eliminados módulos QA/Sandbox obsoletos que hacían fallar el gate V10.33.1.
- Eliminada Edge Function `erp-e2e-bot` local no desplegada.
- Runtime validado: 39 JS, 0 contratos ES Modules rotos.
- Smoke HTTP: `/`, `assets/js/main.js` y fallback SPA responden 200.
- Invariantes DB auditados sin inconsistencias críticas en pedidos/tareas/ítems/sesiones abiertas.

### UX
- Mejoras conservadoras de foco, accesibilidad, controles móviles, estados inválidos y reduced-motion.
- Dependencia Supabase CDN fijada a versión exacta.

### Documentación
- README reconstruido.
- Auditoría integral, arquitectura, seguridad, flujos, despliegue, operación, QA release, backlog del Advisor y limpieza/deprecación documentados.
- Retirada documentación V10.x/QA antigua supersedida.
