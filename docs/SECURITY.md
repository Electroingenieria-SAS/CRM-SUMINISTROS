# Seguridad del CRM Suministros

## Modelo de confianza

El navegador se considera **no confiable**. Puede validar para UX, pero nunca decide permisos. La autorización final vive en Supabase: JWT válido, perfil activo, RPC, reglas de rol/ownership y RLS. La `publishable key` del navegador identifica el proyecto y no es un secreto. `service_role`, secret keys, JWT signing secrets y credenciales de integración son exclusivamente server-side.

## Matriz de controles

| # | Control | Estado V11.32.0 | Implementación / criterio |
|---|---|---|---|
| 1 | Separar claves públicas y privadas | Cumplido | Browser usa únicamente `sb_publishable_...`; secretos permanecen fuera del frontend. |
| 2 | Evitar secretos en Git | Reforzado | Scanner local/histórico + TruffleHog de secretos verificados + CodeQL/Dependency Review. |
| 3 | RLS | Verificado | Todas las tablas base de `erp_supply` tienen RLS habilitado. |
| 4 | Cero RPC ERP para `anon` | Verificado | Health check productivo y migración 108. |
| 5 | SECURITY DEFINER gobernado | Reforzado | Auditoría explícita de funciones autenticadas y health contract service-role-only V11.30.1. |
| 6 | Auth server-side en operaciones privilegiadas | Cumplido | Edge administrativas con JWT y autorización interna de RPC. |
| 7 | Restricción por rol/ownership | Cumplido / auditable | `require_profile`, roles, permisos de módulo, organización y ownership. |
| 8 | Protección de sesión SPA | Mitigado por arquitectura | PKCE/autorefresh, CSP y escape. HttpOnly requeriría BFF/SSR. |
| 9 | Bloqueo de manipulación de campos | Cumplido | Mutaciones de negocio pasan por RPC; el backend decide campos y transición. |
| 10 | Contraseñas | Cumplido por Supabase Auth | El CRM no almacena contraseñas ni hashes propios. |
| 11 | Rate limiting de Auth | Pendiente de plataforma | El guard local es UX; el límite real debe configurarse en Supabase Auth. |
| 12 | Protección anti-bot | Pendiente de plataforma | Activar CAPTCHA/Turnstile/hCaptcha según soporte del proyecto. |
| 13 | Leaked Password Protection | Pendiente de plataforma | El Security Advisor sigue reportándola deshabilitada. |
| 14 | Monitorización de DB | Cumplido | Advisors, health checks, `pg_stat_statements`, logs y runbook. |
| 15 | Validación de entradas | Reforzado | Validación en UI, Edge y RPC. |
| 16 | Escape de contenido | Reforzado | Escape de salida + `sanitizeHtml()` en primitivas reutilizables + CSP. |
| 17 | Uploads | Cumplido en dos capas | Máx. 15 MB, allowlist y denylist en browser y Apps Script. |
| 18 | Security headers | Reforzado | HSTS, CSP, nosniff, anti-frame, Referrer Policy, Permissions Policy. |
| 19 | Dependencias | Reforzado | CDN versionada + Dependency Review + npm audit + Dependabot. |
| 20 | Historial y gobernanza Git | Parcial | PR/CI formalizados; ruleset real de `main` sigue pendiente a nivel GitHub. |

## Contraseñas y autenticación

- Nueva contraseña administrativa: mínimo 12 caracteres.
- No registrar contraseñas en logs, auditoría, metadata ni tablas operativas.
- La Edge Function administrativa entrega credenciales únicamente a Supabase Auth Admin API.
- **Leaked Password Protection**, rate limiting real y anti-bot son controles de plataforma; no deben simularse desde SQL o JavaScript.
- Para perfiles críticos se recomienda MFA cuando se formalice la política corporativa de autenticación.

## SECURITY DEFINER

Supabase Security Advisor marca funciones `SECURITY DEFINER` ejecutables por `authenticated`. Esto no implica vulnerabilidad por sí mismo: el CRM usa RPC privilegiados intencionalmente.

Contrato obligatorio:

1. cero ejecución para `anon`;
2. `search_path` explícito/controlado;
3. autorización interna o delegación a un núcleo que la aplique;
4. funciones de secretos/integración privadas reservadas a `service_role`;
5. wrappers históricos auditados por nombre y destino.

V11.30.1 añade `public.erp_x_security_definer_contract_check()`, accesible solo por `service_role`, para detectar nuevas funciones autenticadas que salgan del contrato de guardas/wrappers aprobado.

## Sesión

El SPA usa el cliente oficial Supabase con PKCE, persistencia de sesión y refresh automático. La sesión permanece accesible al runtime JavaScript del navegador; por tanto, una política que exija cookies HttpOnly requeriría migrar la autenticación a BFF/SSR. No existe una modificación local equivalente que convierta el SPA actual en HttpOnly sin cambiar la arquitectura.

## CORS

`erp-admin-users`, `erp-admin-impersonate` y `erp-auditoria-metrics` usan allowlist de origen. `erp-auditoria-metrics` exige JWT desde V11.32.0 y no puede volver a CORS wildcard. El bridge de AuditoriaERP conserva autenticación propia porque recibe tráfico server-to-server desde PostgreSQL.

## CSP y dependencias

- `unsafe-eval` está prohibido por CI.
- `style-src` general ya no permite `'unsafe-inline'` desde V11.30.2.
- Las dependencias jsDelivr/unpkg/SheetJS deben estar fijadas a versión exacta.
- Google Identity Services se consume desde su endpoint oficial, que no ofrece una URL de release inmutable equivalente.
- El bootstrap inline de Vercel Speed Insights queda autorizado mediante hash CSP específico.
- Se externalizaron los bloques `<style>` runtime a recursos CSS same-origin. La única excepción restante es `style-src-attr 'unsafe-inline'`, limitada a valores visuales dinámicos (porcentajes, anchos y variables CSS calculadas). Su eliminación completa requiere reemplazar esos atributos por clases/estructuras equivalentes.

## Uploads

Permitidos: imágenes raster comunes, PDF, TXT/CSV y documentos Office necesarios para la operación. Bloqueados: HTML, SVG activo, JavaScript, ejecutables, shell/PowerShell, instaladores y paquetes ejecutables. El tamaño máximo continúa en 15 MB.

El control de extensión/MIME reduce riesgo, pero no sustituye un antivirus o Content Disarm & Reconstruction si la organización adopta un nivel superior de protección documental.

## Git y secretos

La CI ejecuta:

1. `npm run security` sobre el árbol actual;
2. `npm run security:history` sobre el historial Git completo;
3. validación de arquitectura, integración y release;
4. smoke browser desktop/móvil.

Si el scanner histórico detecta un secreto real:

1. rotar/revocar la credencial;
2. identificar alcance y consumidores;
3. verificar que la nueva credencial quede en Vault/secret store;
4. solo después evaluar reescritura de historia con un procedimiento controlado.

Nunca asumir que borrar un commit vuelve segura una credencial ya expuesta.

## Gobierno de cambios

Consultar `docs/REPOSITORY_GOVERNANCE.md`. El objetivo operativo es que `main` quede protegido por ruleset/branch protection, exija `Validate CRM Suministros`, bloquee force-push y bloquee eliminación.


## Impersonación administrativa

V11.32.0 registra cada verificación privilegiada como una sesión con actor original, actor efectivo, motivo y expiración. El identificador viaja en el header `x-erp-impersonation-session`, pero PostgreSQL solo lo acepta si corresponde al `auth.uid()` efectivo y continúa vigente. Los eventos insertados en `system_audit` se enriquecen con ambos actores.

## Métricas internas

`erp-auditoria-metrics` no es un endpoint público. La Edge valida JWT y el RPC de usuario restringe los agregados por `organization_id` y permiso de Reportes/Auditoría/Super Admin.
