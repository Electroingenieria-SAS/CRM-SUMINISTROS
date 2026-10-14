# Cotizador premium V3 · control 503 y validación (2026-10-14)

## Diagnóstico y alcance
Las capturas muestran una consola que informa `Failed to load resource: 503`, pero no muestran
la URL, dominio, método ni respuesta de la solicitud fallida. No se debe atribuir la causa a
GitHub Pages, un CDN o Supabase sin esa evidencia. El sitio está desplegado en GitHub Pages
desde main y los controles de CI de la versión anterior estaban aprobados. El proyecto
Supabase del CRM se encuentra en estado ACTIVE_HEALTHY según el panel de proyectos,
pero la consulta de logs de API no pudo completarse debido a un error en el backend
de registros. **La causa del 503 no está definitivamente identificada.**

## Mitigación implementada
- `api.freightQuoteCatalog` y `api.freightQuoteList` reintentan una vez solo ante
  errores 503/504/pool temporal. Espera limitada a 650 ms.
- Guardar, vincular pedidos y otras mutaciones no se reintentan automáticamente.
- Un aviso del cotizador informa de fallas transitorias y permite reconsultar
  manualmente la ruta o el catálogo/historial. No vuelve a enviar un pedido.
- Se mantienen todas las autorizaciones, cálculos, fuentes y datos históricos.

## Identificación futura del recurso 503
En DevTools del navegador, filtrar Network por estado 503 y registrar método,
dominio, ruta y hora (sin incluir tokens, apikey, cookies ni parámetros sensibles).
Separar: recurso estático del CDN / GitHub Pages / Vercel, solicitud a Supabase
REST/RPC, o servicio de terceros. Revisar la ventana correspondiente en los registros
del proveedor con evidencia de request ID antes de intervenir infraestructura.

## Diseño
Se sustituyó el encabezado disperso por un hero compacto, se integraron las
pestañas en una barra, y se elevaron las tarjetas de TCC, ENVÍA, historial y
componentes compartidos mediante nuevos estilos de contraste, jerarquía
monetaria, color institucional y disposición responsive. Mantener
`prefers-reduced-motion` y WCAG AA en las acciones principales.

## Comprobaciones de liberación
- Node contracts: tarjetas, header, historia y reintentos exclusivamente read-only.
- Playwright: viewport 375/768/1024/1440, visual de precios y recuperación 503.
- CI habitual (validate, CodeQL, secretos, cadena de suministro, authenticated-E2E).
- GitHub Pages únicamente tras pasar todos los checks y fusionar PR.
