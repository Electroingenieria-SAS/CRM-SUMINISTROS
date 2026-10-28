# CRM Suministros — APK interno para Android

Aplicación Android instalable **con firma digital**, paquete `co.com.electroingenieria.crmsuministros`, conectada al dominio oficial `https://crm-suministros-amber.vercel.app/`.

## Tecnología y compatibilidad
Se usa **Trusted Web Activity (TWA)** con Android Browser Helper y motor Chromium del dispositivo. Es un APK real que se instala por archivo, sin Google Play ni el diálogo de instalación de PWA; el contenido del CRM sigue siendo web y necesita conexión para los procesos de negocio. La autenticación de Google utiliza el navegador compatible, no un WebView embebido prohibido para OAuth. Cámara, archivos y permisos se gestionan por el navegador/Android; deben probarse en un equipo real de la empresa.

- Android 8.0+ (API 26); recomendado Chrome actualizado.
- El sitio y la APK deben verificar Digital Asset Links para quitar la barra de navegador: `https://crm-suministros-amber.vercel.app/.well-known/assetlinks.json`.
- Si falla la verificación, se abre una Custom Tab (el CRM sigue operativo).
- El APK no deshabilita ni evade Play Protect, políticas MDM ni restricciones del dispositivo; el administrador configura distribución interna aprobada.
- No contiene credenciales del CRM ni secretos de Supabase.
- Las actualizaciones web se publican en Vercel. Las actualizaciones del contenedor Android exigen APK firmado con **la misma clave** y `versionCode` incrementado.

## Construcción y custodia de la firma
La ejecución **manual** (`workflow_dispatch`) de la CI canónica `Validate CRM Suministros` incorpora el job `build-apk`, compila el APK y publica el artefacto `crm-suministros-android-apk`. No se reconstruye automáticamente en cada push para evitar cambios accidentales de firma.
Si el repositorio tiene los secretos `CRM_ANDROID_KEYSTORE_B64`, `CRM_ANDROID_KEYSTORE_PASSWORD` y `CRM_ANDROID_KEY_PASSWORD`, reutiliza la firma; si no, el primer build genera una **clave nueva** y adjunta `crm-android-signing-admin-backup` para que un administrador la conserve y configure secretos para los builds posteriores. **Nunca envíes el backup de firma a los empleados.** El backup está limitado a quien puede acceder a los artefactos del repositorio y debe migrarse a un almacén seguro.

Tras compilar, el artefacto de APK incluye un `assetlinks.json` con la huella SHA-256. El archivo debe instalarse en la ruta `.well-known/assetlinks.json` del origen antes de asegurar pantalla completa. Si se rota la firma, es necesario actualizar Digital Asset Links y reinstalar la aplicación.

## Instalación
1. Administrador descarga el archivo APK del artefacto de GitHub Actions, no el backup.
2. Distribuye el APK mediante canal interno autorizado y verifica su firma/sha256.
3. Usuario habilita instalación de esa fuente en Android si la política corporativa lo permite.
4. Abre CRM Suministros, inicia sesión y concede permisos de cámara/evidencias cuando corresponda.
5. Verifica inicio de sesión, registro, escáner, subida de foto y navegación en un dispositivo físico.
