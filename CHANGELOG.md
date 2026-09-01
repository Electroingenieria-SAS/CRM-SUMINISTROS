# Changelog

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
