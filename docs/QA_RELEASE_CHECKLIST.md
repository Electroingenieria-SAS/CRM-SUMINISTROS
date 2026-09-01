# QA Release Checklist

## Gate automático

- [ ] `npm run validate`
- [ ] `npm run security`
- [ ] 0 módulos QA/Sandbox en runtime
- [ ] 0 acceso directo `.from()` desde frontend
- [ ] 0 secretos privados detectados

## Auth y roles

Para cada rol productivo crear/usar usuario de QA controlado y verificar menú visible, acciones permitidas y acciones denegadas. Especial atención a Super Admin, Auditoría, Ventas, Cartera, Caja, Compras, Recepción, Coordinación, Auxiliar de logística, Corte y Despacho.

## CRUD administrativo

- [ ] listar usuarios
- [ ] crear usuario + Auth + perfil + roles
- [ ] impedir usuario activo sin rol
- [ ] cambiar nombre/email/roles
- [ ] cambiar contraseña >= 12
- [ ] desactivar/reactivar
- [ ] impedir autoeliminación Super Admin
- [ ] eliminar cuenta y conservar auditoría
- [ ] probar rollback ante fallo Auth/DB

## Pedidos

- [ ] creación e idempotencia
- [ ] datos cliente/dirección
- [ ] ítems y cantidades
- [ ] rutas PVC/PVP/PVN relevantes
- [ ] compra sí/no
- [ ] toma/asignación
- [ ] espera/bloqueo/reanudación
- [ ] concurrencia con `expected_version`

## Recepción / Picking / Corte

- [ ] recepción completa/parcial
- [ ] issue y resolución
- [ ] picking precheck
- [ ] faltante/reserva
- [ ] corte agrupado por referencia
- [ ] pausa/reanudación corte
- [ ] impedir cierre sin evidencia
- [ ] evidencia final y liberación

## Facturación / Shipping

- [ ] factura PDF
- [ ] retorno a Caja cuando aplica
- [ ] guía nacional
- [ ] ubicación/evidencia
- [ ] no entrega
- [ ] cierre final

## Files

- [ ] JPG/PNG/PDF permitido
- [ ] Office requerido permitido
- [ ] >15 MB rechazado
- [ ] `.html`, `.svg`, `.js`, `.exe`, `.ps1` rechazados
- [ ] origen Drive no autorizado rechazado
- [ ] JWT inválido rechazado

## Seguridad navegador

- [ ] CSP sin violaciones necesarias
- [ ] iframe embedding bloqueado
- [ ] HTTPS/HSTS
- [ ] no password/payload sensible en console
- [ ] contenido usuario mostrado como texto escapado
- [ ] rate limit Auth y CAPTCHA verificados en plataforma
