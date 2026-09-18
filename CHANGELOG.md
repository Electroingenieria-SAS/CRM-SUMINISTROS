# Changelog

## 11.31.2 — 2026-09-18

### Gestión rápida
- El popup `simple-process-modal` deja de heredar el ancho genérico de 680 px y usa hasta **1120 px** en desktop.
- El ancho se limita a `calc(100vw - 80px)` para conservar contexto visual alrededor del modal.
- La cabecera blanca conserva el acento azul y corrige **Gestión rápida**, número de pedido y cliente/etapa a tonos azules legibles.
- Los cinco estados operativos se distribuyen en cinco columnas en desktop y tres columnas en tamaños intermedios.
- Se ajustan resumen, flujo, acción recomendada, acciones secundarias y footer para aprovechar el nuevo ancho sin aumentar innecesariamente la altura.
- La regla queda aislada a `simple-process-modal`; el resto de popups conserva su ancho base de 680 px.
- CI protege el ancho, los colores y el aislamiento del popup.
- Caché PWA rotada para distribuir inmediatamente la corrección.

## 11.31.1 — 2026-09-18

### Corrección visual
- Se encapsula la regla de botones `danger` de Administración para impedir que sobrescriba botones de otros módulos.
- **Reportar no entrega** recupera texto blanco sobre fondo rojo en Pedidos enviados.
- Se añade una validación de CI para impedir que vuelva a aparecer un selector global `.btn-danger,.btn.danger`.
- Se rota la caché PWA para que los clientes reciban inmediatamente el CSS corregido.

## 11.31.0 — 2026-09-18

### Entrega y satisfacción
- Nueva confirmación independiente **Entregado con satisfacción** posterior a la entrega logística.
- Distancia recorrida por pedido con fuente verificable del kilometraje.
- Despachos locales/nacionales exigen distancia mayor que cero al confirmar satisfacción.
- Se conserva `DELIVERED` como estado logístico; la satisfacción se registra en campos y eventos separados.
- Nuevos hitos `DELIVERED_SATISFIED` / `DELIVERY_REVIEW_UPDATED`.

### Tiempos y analítica
- Tránsito: salida → entrega logística.
- Tiempo hasta satisfacción: salida → confirmación del cliente.
- Confirmación post-entrega: entrega → satisfacción.
- Pedidos enviados muestra recorrido y estado de satisfacción.
- Analítica → Entregas incorpora satisfacción, distancia total/promedio y tiempos post-entrega.
- Exportación de Entregas incorpora distancia, receptor, satisfacción y duraciones.

### Seguridad / compatibilidad
- Cambio aditivo: no reabre pedidos cerrados ni modifica el flujo existente de evidencia/cierre.
- RPC de satisfacción valida rol, propiedad comercial, entrega previa y ausencia de novedad abierta.
- Sin acceso `anon`; ejecución explícita para `authenticated`.

## 11.30.2 — 2026-09-18

### CSP y estilos runtime
- Externalizados seis bloques CSS que antes se inyectaban mediante `createElement("style")`.
- Los estilos de Guías, Recepción e Inventario se cargan como recursos CSS same-origin conservando el orden runtime.
- `style-src` general deja de usar `'unsafe-inline'`; la excepción temporal queda limitada a `style-src-attr` para porcentajes/medidas visuales realmente dinámicas.
- CI prohíbe volver a introducir elementos `<style>` desde JavaScript o ampliar nuevamente `style-src 'unsafe-inline'`.
- PWA precachea los seis fragmentos CSS runtime.

### Release
- Versión **V11.30.2**, build **2026-09-18.02**.
- Sin cambios de lógica de negocio, permisos, RPC ni datos operativos.

## 11.30.1 — 2026-09-18

### Seguridad y gobierno
- Añadidos `.gitignore` y `.env.example` canónicos para impedir que secretos/local artifacts entren al repositorio.
- Nuevo `npm run security:history`: revisa el historial Git completo mediante `fetch-depth: 0` y falla ante patrones compatibles con claves privadas o credenciales.
- El scanner del árbol actual exige dependencias CDN versionadas, prohíbe `unsafe-eval` y valida el hash CSP del bootstrap inline de Speed Insights.
- Nueva migración 110 con `erp_x_security_definer_contract_check()`, service-role-only, para vigilar ejecución anónima, guardas y wrappers auditados.
- Política formal de gobierno de ramas y flujo PR → CI → squash merge → verificación post-merge.

### CI/CD
- Playwright desktop/móvil deja de limitarse a PR/manual y se ejecuta también después de cada push a `main`.
- Release, PWA y artefacto desplegable sincronizados como V11.30.1 / build 2026-09-18.01.
- Cache PWA rotada desde V11.30.0 a `crm-suministros-v11-30-1-20260918-01`.

### Plataforma pendiente
- GitHub ruleset/branch protection para `main` debe activarse a nivel plataforma.
- Supabase Auth mantiene pendientes Leaked Password Protection, rate limiting real y anti-bot.
- `style-src 'unsafe-inline'` se conserva temporalmente por estilos inline/dinámicos heredados; su retirada requiere migración visual controlada.

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
