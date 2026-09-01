# Seguridad del ERP EI

## Modelo de confianza

El navegador se considera **no confiable**. Puede validar para UX, pero nunca decide permisos. La autorización final vive en Supabase: JWT válido, perfil activo, RPC, reglas de rol/ownership y RLS. La `publishable key` del navegador identifica el proyecto; no es un secreto. `service_role` es un secreto con privilegios elevados y solo puede existir en Supabase Edge Functions o un backend servidor.

## Matriz de los 20 controles solicitados

| # | Control | Estado de esta reconstrucción | Implementación / acción |
|---|---|---|---|
| 1 | Ocultar API keys | Parcial por diseño | Secret keys fuera del cliente; publishable key pública. `.env.example` sin valores secretos. |
| 2 | Eliminar secretos Git | Preparado | `.gitignore` + scanner. Al crear/mover repo ejecutar escaneo de historial y rotar cualquier secreto histórico. |
| 3 | Activar RLS | Verificado | Tablas públicas auditadas con RLS habilitado. Revisar policies tras cada migración. |
| 4 | Usar clave pública DB | Cumplido | Browser usa `sb_publishable_...`; `service_role` solo servidor. |
| 5 | Cifrar datos sensibles | Plataforma + diseño | TLS/HTTPS y cifrado de plataforma; para PII de alto riesgo usar Vault/pgcrypto según clasificación, no cifrado indiscriminado. |
| 6 | Forzar autenticación servidor | Cumplido en operaciones privilegiadas | Edge `verify_jwt=true`; RPC exige perfil/roles en backend. |
| 7 | Restringir registros | Cumplido / auditable | RLS + helpers de organización/rol/ownership. |
| 8 | Proteger cookies sesión | No aplica literalmente al SPA actual | Supabase browser persiste sesión del cliente; CSP/XSS reducen robo de token. Si se exige HttpOnly, migrar Auth a BFF/SSR server-side. |
| 9 | Bloquear manipulación de campos | Cumplido por arquitectura | Mutaciones pasan por RPC; backend decide campos, transición, ownership y versión. |
| 10 | Hashear contraseñas | Cumplido por Supabase Auth | Supabase Auth almacena hashes bcrypt; ERP nunca almacena contraseña en perfiles. |
| 11 | Máx. 10 intentos | Parcial + pendiente plataforma | Guard local 10/15 min; configurar límite real en Supabase Auth. |
| 12 | Protección bots | Pendiente plataforma | Activar Turnstile/hCaptcha en Supabase Auth. |
| 13 | Monitor DB | Preparado | Advisors + pg_stat_statements + logs/runbook. |
| 14 | Validar entradas | Reforzado | Validación UI, Edge y RPC; nunca confiar solo en navegador. |
| 15 | Escapar contenido usuario | Reforzado | `fmt.escape`, corrección de error sin escape, CSP. |
| 16 | Restringir uploads | Cumplido en dos capas | Máx 15 MB, allowlist de formatos, denylist activos/ejecutables, Apps Script replica control. |
| 17 | Limitar respuestas API | Existente / reforzar backend | Paginación y `maxPageSize=250`; RPC debe mantener topes independientemente del cliente. |
| 18 | Security headers | Preparado | `vercel.json`: CSP, HSTS, nosniff, anti-frame, Permissions/Referrer Policy. |
| 19 | HTTPS | Preparado | Vercel sirve TLS; HSTS y `upgrade-insecure-requests`. |
| 20 | Dependencias | Cumplido en proyecto | 0 dependencias npm locales; CDN Supabase pin exacto; `npm run security`. |

## Passwords

- Nueva contraseña administrativa: mínimo 12 caracteres.
- No registrar contraseñas en logs, eventos de auditoría, tablas ERP ni metadata.
- La Edge Function entrega la contraseña únicamente a Supabase Auth Admin API.
- Activar leaked-password protection si el plan lo soporta.
- Valorar MFA para Super Admin/Gerencia.

## Sesión

El SPA usa el cliente oficial Supabase. Esto implica almacenamiento de la sesión en el entorno del navegador en lugar de una cookie HttpOnly de un BFF propio. La mitigación actual se apoya en CSP, escape sistemático, no ejecución de HTML aportado por usuarios y reducción de dependencias. Si el requisito corporativo obliga a tokens inaccesibles a JavaScript, el cambio correcto es arquitectónico: backend-for-frontend/SSR con sesión gestionada en servidor, no “poner HttpOnly” sobre el SPA actual.

## CORS

`erp-admin-users` usa `ERP_ALLOWED_ORIGINS`. Antes de desplegar establecer, por ejemplo:

```text
ERP_ALLOWED_ORIGINS=https://erp.midominio.com,https://preview-autorizado.vercel.app
```

No usar `*` para una función que gestiona usuarios y contraseñas.

## Uploads

Permitidos: imágenes raster comunes, PDF, TXT/CSV y documentos Office requeridos por la operación. Bloqueados: HTML, SVG, JavaScript, ejecutables, scripts shell/PowerShell, instaladores y paquetes ejecutables. El tamaño máximo sigue siendo 15 MB.

El chequeo de extensión/MIME reduce riesgo pero no sustituye malware scanning. Para un nivel corporativo superior, insertar una etapa antivirus/Content Disarm & Reconstruction antes de hacer disponible el archivo.

## Git y secretos

Antes de subir al nuevo repositorio:

1. Ejecutar `npm run security`.
2. Ejecutar un escáner de historial como Gitleaks/TruffleHog en el repositorio una vez exista `.git`.
3. Si aparece un secreto histórico, **rotarlo**; borrar un commit no vuelve seguro un secreto ya expuesto.
4. Reescribir historia con `git filter-repo` solo después del backup y acuerdo del equipo.
5. Guardar secrets en Supabase/Vercel environment variables, nunca en commits.
