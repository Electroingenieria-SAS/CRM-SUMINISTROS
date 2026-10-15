# CRM Suministros · Limpieza y tiempo de respuesta · Fase 1 (15/10/2026)

## Inventario comprobado antes de modificar
- Pantalla inicial: **8 scripts externos** declarados con `defer` en `index.html`, independientemente de la función visitada. Se conservan los dos servicios cargados al inicio (Supabase y Google Identity Services).
- Seis bibliotecas antes descargadas para todos: SheetJS, jsPDF, autotable, JsBarcode, qrcode-generator y ZXing.
- Manifiesto PWA anterior: **706** archivos JavaScript/CSS, **2.872.428 bytes (2,74 MiB) de fuente local**. Esta cifra es *inventario de fuente*, no tamaño comprimido transferido ni una medición de tiempo de carga.
- Trabajos repetidos: los observadores del DOM de Inventario y de la barra de Guía disparaban consultas después de cambios frecuentes, aunque fueran irrelevantes.

## Cambios delimitados
1. `index.html`: mantiene Supabase y Google Identity Services; retira seis cargas indiscriminadas y dos preconexiones que ya no aportan al arranque.
2. `integrations/documents/optional-vendors.js`: cargador reutilizable con URL fija, promesa compartida para peticiones concurrentes, verificación del global y posibilidad de reintentar.
3. Excel: historial, analítica, importación Siesa y despacho local usan el cargador de SheetJS existente cuando se necesita.
4. PDF: el historial de despachos locales obtiene jsPDF y autotable al exportar.
5. Inventario: código de barras y QR se cargan para etiquetas; ZXing solo se solicita si no existe el detector nativo al usar el escáner.
6. Los observadores de Inventario y Guía consolidan múltiples cambios del DOM para evitar inspecciones duplicadas.

## Funciones y datos expresamente conservados
- Autenticación, Supabase, Google Drive, pedidos, despacho nacional/local, datos históricos, cotizador TCC/ENVÍA/LOCAL y auditoría.
- Matriz CSV de 54 rutas y liquidación; sin migraciones SQL.
- Exportar Excel/PDF/CSV, impresión de etiquetas, cámara y lectura manual.
- Todos los archivos históricos y migraciones permanecen intactos. No se usa una búsqueda por nombre para declarar un archivo muerto.

## Validación y fase posterior
- Gates existentes de sintaxis, enlaces, arquitectura, seguridad, pruebas de dominio, PWA y Playwright.
- Prueba de navegador: ausencia de solicitudes de proveedores opcionales en login y descarga única al solicitar la función.
- Siguiente auditoría basada en métricas: inicialización de módulos ES, RPC simultáneos por pantalla, tamaño real transferido, trabajo principal de CPU, LCP/INP y alcance de precache offline. **No atribuir mejoras porcentuales sin medir antes/después**.
