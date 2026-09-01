# ERP EI — Electroingeniería S.A.S.

> Línea base auditada: **V10.33.1 — Security Rebuild 2026-09-01**  
> Supabase objetivo: **hezjxcxxcjlpmyalftam**  
> Estado del paquete: validación estática y hardening inicial completados; requiere campaña E2E autenticada por rol y cierre de settings de plataforma antes de declarar producción definitiva.

## 1. Qué es

ERP EI es el sistema interno de trazabilidad de pedidos, suministros y operación de Electroingeniería S.A.S. Centraliza el ciclo desde Ventas hasta el cierre de entrega, con Cartera, Caja, Compras, Recepción, Alistamiento, Corte, Facturación, Despacho, inventario, aprobaciones, auditoría y gestión de actividades del personal.

El sistema está pensado para que una transición de negocio **no dependa de que un botón cambie un estado en el navegador**. El frontend solicita una acción; PostgreSQL/Supabase valida identidad, rol, ownership, versión y reglas del flujo antes de aceptar la mutación.

## 2. Arquitectura

```text
Usuario
  │
  ▼
SPA HTML/CSS/ES Modules
  │
  ├── Supabase Auth ─────── sesión JWT
  │
  ├── public.erp_x_* RPC ── lógica de negocio / erp_supply
  │
  ├── erp-admin-users ───── Edge Function JWT + service_role server-only
  │
  └── Google Apps Script ── Drive institucional + validación de sesión
```

Más detalle: `docs/ARCHITECTURE.md`.

## 3. Estado de la auditoría 2026-09-01

Se verificó el proyecto Supabase `hezjxcxxcjlpmyalftam` en estado saludable. La base auditada contiene 33 perfiles ERP y 32 usuarios Auth; no existen links Auth rotos. Los invariantes revisados de pedidos/tareas no presentan inconsistencias estructurales.

El validador del repositorio ahora termina correctamente:

```text
VALIDACIÓN V10.33.1 CORRECTA
39 archivos JavaScript de producción revisados
ENLACE ES MODULES CORRECTO · 39 archivos · 0 contratos rotos
SECURITY CHECK CORRECTO · 0 secretos privados detectados
```

Informe completo: `docs/AUDITORIA_INTEGRAL_2026-09-01.md`.

## 4. Módulos

### Inicio y comercial

- Centro de operaciones / dashboard.
- Pedidos.
- Ventas.
- Crédito.

### Suministros

- Cartera.
- Caja.
- Compras.
- Recepción de mercancía y del pedido.
- Alistamiento.
- Corte.
- Facturación.
- Despachos y entregas.

### Personas

- Jornada y actividades / Workforce.

### Control

- Inventario.
- Excepciones y aprobaciones.
- VSM / tiempos.
- Analítica y reportes.
- Histórico.
- Auditoría.
- Administración.

Detalle de transiciones: `docs/FUNCTIONAL_FLOWS.md`.

## 5. Estructura del repositorio

```text
assets/
  css/app.css                 Sistema visual
  js/main.js                  Boot/router
  js/config.js                Configuración PÚBLICA del cliente
  js/core/                    UI, layout, router, state, format
  js/modules/                 Pantallas y flujos de negocio
  js/services/                RPC, Auth, Drive, PDF, materiales

docs/                         Arquitectura, seguridad, QA, despliegue, runbook
supabase/
  functions/erp-admin-users/  Administración Auth server-side
  migrations/                 Migraciones canónicas recientes
sql/                          Bootstrap/migraciones históricas; no borrar sin squash probado
google-apps-script/           Puente Drive institucional
scripts/                      Validadores y servidor local
templates/                    Plantillas importación
index.html
service-worker.js
vercel.json
```

## 6. Requisitos locales

- Node.js 20+ recomendado.
- Navegador moderno con ES Modules.
- Acceso de red a Supabase/Google según el módulo probado.

No existe una dependencia npm de framework/build en esta reconstrucción. El servidor local usa `node:http`.

## 7. Instalar y ejecutar

```bash
npm install
npm run validate
npm run serve
```

Abrir `http://127.0.0.1:4173`.

Para ejecutar únicamente el escáner de seguridad:

```bash
npm run security
```

## 8. Configuración

### Browser

`assets/js/config.js` contiene únicamente valores que pueden llegar al navegador, incluida la Supabase publishable key. **Una publishable key no sustituye autorización:** cualquier protección real de registros debe permanecer en RLS/RPC.

Nunca añadir aquí:

- `service_role`
- `sb_secret_...`
- JWT signing secrets
- private keys
- passwords

### Servidor / Edge

Variables requeridas por la Edge Function:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
ERP_ALLOWED_ORIGINS
```

Usar `.env.example` como guía, nunca como archivo de secretos reales.

## 9. Seguridad

La reconstrucción incluye:

- RLS verificado en tablas públicas auditadas.
- RPC como acceso productivo desde browser.
- Edge Function con JWT para Auth Admin.
- CORS administrativo por allowlist.
- password administrativo mínimo 12.
- 10 intentos locales/15 min como capa UX; el rate limit real debe configurarse en Supabase Auth.
- scanner de secretos.
- logs browser sin payload/password.
- escape de contenido dinámico corregido.
- upload <=15 MB y allowlist/denylist en browser + Apps Script.
- CSP/HSTS/security headers para Vercel.
- CDN Supabase fijada a versión exacta.
- 0 dependencias npm de terceros del proyecto.

Leer obligatoriamente `docs/SECURITY.md` antes de producción.

## 10. Contraseñas

ERP EI no implementa hashing casero. Las contraseñas pertenecen a Supabase Auth y Supabase almacena el hash server-side. La aplicación nunca debe guardar contraseñas en `profiles`, auditoría, metadata ni logs.

La protección contra contraseñas filtradas debe habilitarse en los settings de Auth del proyecto cuando el plan lo permita.

## 11. Roles

El acceso visible y la capacidad de ejecutar una acción son conceptos distintos. Ocultar un botón mejora UX; la autorización definitiva debe seguir fallando en backend si un usuario intenta llamar el RPC manualmente.

Auditoría es un perfil de solo lectura operativo. Super Admin concentra administración de cuentas, pero no debe poder eliminar su propia cuenta desde la consola.

## 12. Drive y archivos

El Apps Script institucional:

1. recibe POST del ERP;
2. valida el origen exacto;
3. valida JWT llamando `erp_x_session`;
4. valida contexto, tamaño y tipo del archivo;
5. carga al Drive institucional;
6. devuelve metadata, no credenciales.

Formatos activos/ejecutables como HTML, SVG, JavaScript, EXE, MSI, BAT, PowerShell, shell, JAR, APK e ISO se rechazan. Tamaño máximo: 15 MB.

## 13. Base de datos y migraciones

No editar producción manualmente para “arreglar un estado” si existe una transición/RPC. Toda modificación de esquema debe quedar en migración reproducible.

La migración `074_security_performance_hardening_v10_33_1.sql` fue aplicada el **1 de septiembre de 2026** al proyecto verificado `hezjxcxxcjlpmyalftam`. Permanece versionada para instalaciones nuevas y trazabilidad; no debe ejecutarse manualmente otra vez si ya figura en el historial de migraciones del entorno.

Antes de aplicar:

1. backup/branch;
2. ejecutar migraciones;
3. `npm run validate`;
4. Security Advisor;
5. Performance Advisor;
6. smoke/E2E.

## 14. Performance

La aplicación pagina consultas con tamaños razonables y configura `maxPageSize=250`. El Advisor detectó varias FKs sin índice. No deben indexarse todas ciegamente. Revisar `pg_stat_statements`, frecuencia de joins, cardinalidad y costo de escritura antes de añadir índices.

## 15. UI/UX

El sistema visual utiliza Century Gothic y la familia Refined Workspaces. Esta reconstrucción añadió foco visible, targets táctiles más seguros en móvil, inputs de tamaño usable y respeto a `prefers-reduced-motion`. Los cambios fueron deliberadamente conservadores para no romper los flujos mientras se hace la auditoría funcional.

La siguiente etapa visual debe realizarse sobre un entorno autenticado de staging y capturas de cada módulo, no solo sobre el login.

## 16. QA antes de release

No liberar con solo “se ve bien”. Ejecutar `docs/QA_RELEASE_CHECKLIST.md`, incluyendo usuarios de QA por rol. Deben probarse happy path, permisos denegados, concurrencia, sesión vencida, archivos inválidos y todos los desvíos del flujo.

## 17. Deploy

Guía completa: `docs/DEPLOYMENT_VERCEL_SUPABASE.md`.

Puntos críticos después de crear el nuevo repo/dominio:

- configurar dominio exacto en Edge `ERP_ALLOWED_ORIGINS`;
- configurar el mismo dominio en Apps Script;
- configurar secrets solo en Supabase/Vercel;
- activar Auth rate limits + CAPTCHA;
- escanear **historia Git**;
- revisar CSP en navegador real;
- ejecutar QA por rol.

## 18. Operación e incidentes

Consultar `docs/OPERATIONS_RUNBOOK.md` para monitoreo, Auth, flujo, secretos y recuperación.

## 19. Archivos históricos

Se eliminaron módulos QA/Sandbox incompatibles con producción. El SQL histórico grande se conserva por ahora porque aún puede ser necesario para reconstrucción desde cero. El paso correcto futuro es un **schema squash** probado en una base vacía; solo después se elimina historial redundante.

## 20. Definición de “listo para producción”

Una build se considera candidata final cuando:

- validadores verdes;
- E2E por rol verde;
- settings Auth cerrados;
- Security Advisor revisado;
- no hay secretos privados ni en working tree ni en Git history;
- migraciones reproducibles;
- backup/restore definidos;
- CORS/CSP ajustados al dominio final;
- pruebas de flujo completo sin inconsistencias.

---

Documentos clave: `docs/AUDITORIA_INTEGRAL_2026-09-01.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md`, `docs/FUNCTIONAL_FLOWS.md`, `docs/QA_RELEASE_CHECKLIST.md`, `docs/DEPLOYMENT_VERCEL_SUPABASE.md`, `docs/OPERATIONS_RUNBOOK.md`.
