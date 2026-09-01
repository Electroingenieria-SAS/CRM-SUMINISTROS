# Despliegue — Supabase + Vercel + Drive

## 1. Preflight

```bash
npm install
npm run validate
npm run security
npm run serve
```

`npm install` no descarga dependencias de runtime del proyecto actual; existe para validar el lockfile y scripts NPM.

## 2. Supabase

Proyecto correcto: `hezjxcxxcjlpmyalftam`.

Antes de producción:

- ejecutar migraciones pendientes en staging/branch;
- revisar Security Advisor y Performance Advisor;
- verificar RLS/policies;
- activar leaked password protection si disponible;
- configurar Auth rate limits;
- activar CAPTCHA/Turnstile;
- verificar SSL enforcement;
- definir backup/PITR según criticidad;
- configurar secretos de Edge Function.

Secrets necesarios para `erp-admin-users`:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY o publishable compatible según entorno
ERP_ALLOWED_ORIGINS
```

Nunca copiar `SUPABASE_SERVICE_ROLE_KEY` a `assets/js/config.js`.

## 3. Edge Function

Desplegar `erp-admin-users` con JWT verification habilitada. Comprobar OPTIONS desde el dominio autorizado y confirmar que un origen no permitido recibe 403/no recibe CORS allow-origin.

## 4. Google Apps Script

Actualizar `SETTINGS.ALLOWED_ORIGINS` con el dominio definitivo. Desplegar nueva versión del Web App. Ejecuta como la cuenta institucional propietaria de Drive. El acceso externo al Web App no equivale a acceso a archivos: cada POST valida origen y sesión ERP.

## 5. Vercel

Importar el nuevo repo. Como el proyecto es estático, no requiere framework. `vercel.json` aporta rewrite SPA y security headers.

Después de obtener dominio definitivo:

- añadirlo a `ERP_ALLOWED_ORIGINS` de Supabase Edge;
- añadirlo a Apps Script `ALLOWED_ORIGINS`;
- revisar CSP si se agregan integraciones externas;
- confirmar HTTPS/HSTS.

## 6. Prueba post-deploy

1. Login válido e inválido.
2. Logout y sesión vencida.
3. Acceso por cada rol.
4. Crear pedido de cada tipo/ruta relevante.
5. Recorrer flujo hasta cierre.
6. Probar rechazo/errores/espera/novedad.
7. Upload permitido y archivo bloqueado.
8. Admin: crear, editar, cambiar password, desactivar y eliminar usuario no propio.
9. Auditoría: comprobar que no pueda mutar.
10. DevTools: 0 errores JS, CSP limpia, sin payloads/contraseñas en console/network response innecesaria.
