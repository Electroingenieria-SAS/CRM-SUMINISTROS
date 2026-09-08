# CRM Suministros — Matriz Responsive V11.19.0

## Propósito

V11.19.0 establece un único contrato adaptativo para todo CRM Suministros. El objetivo no es reducir proporcionalmente una interfaz de escritorio, sino reorganizar navegación, densidad, formularios, datos, acciones y superficies según el espacio y el tipo de interacción disponible.

La lógica de negocio de los módulos permanece sin cambios. La reconstrucción se concentra en el shell global, comportamiento del viewport, navegación, tablas, formularios, modales, drawers y patrones visuales compartidos.

## Familias de viewport

| Familia | Referencias mínimas de validación | Comportamiento esperado |
| --- | --- | --- |
| Teléfono muy compacto | 320×568, 360×640 | Una columna, dock inferior, drawer, tablas simples en tarjetas, modales a pantalla completa |
| Teléfono estándar | 375×667, 390×844, 412×915 | Tipografía legible, controles táctiles ≥44 px, safe areas, sin scroll horizontal de página |
| Teléfono grande | 430×932 | Aprovechamiento de ancho sin regresar al layout desktop |
| Teléfono horizontal | 740–932 × 320–430 | Header/dock compactos y máximo espacio vertical para tareas |
| Tablet | 768×1024, 820×1180 | Drawer, grids de 1–2 columnas, formularios fluidos, tablas según complejidad |
| PC antiguo / pantalla compacta | 1024×768, 1152×864 | Sidebar convertida a drawer para recuperar ancho operativo |
| Portátil compacto | 1280×720, 1366×768 | Densidad reducida sin pérdida de información, modales contenidos |
| Portátil estándar | 1440×900, 1536×864 | Layout completo con gutters adaptativos |
| Escritorio | 1920×1080 | Uso equilibrado del espacio, contenido central hasta 1920 px |
| Wide / alta resolución | 2560×1440 y superiores | Mayor gutter y aire visual sin estirar indefinidamente textos/tablas |

## Motores objetivo

- Safari iOS / WebKit.
- Chrome Android / Blink.
- Chrome desktop.
- Microsoft Edge / Chromium.
- Firefox desktop.
- Safari macOS.

Se mantienen fallbacks para motores sin `100dvh` y sin `backdrop-filter`.

## Contrato de navegación

- Más de 1180 px: navegación lateral de escritorio.
- Hasta 1180 px: navegación lateral se convierte en drawer accesible.
- Hasta 720 px: se añade dock inferior persistente con accesos principales, búsqueda y menú completo.
- El drawer conserva bloqueo del contenido (`inert` cuando está disponible), foco inicial, trampa de foco y cierre mediante Escape/backdrop.
- El título del módulo actual permanece visible en el header móvil.

## Contrato de datos

El runtime V11.19.0 clasifica dinámicamente las tablas:

- Tablas simples (hasta 6 columnas, sin `rowspan`/`colspan` estructural): modo `cards` en teléfono. Cada celda recibe su etiqueta de columna mediante `data-rf-label`.
- Tablas complejas/BI: modo `scroll`. Conservan estructura tabular y reciben un contenedor horizontal accesible con etiqueta para lector de pantalla.
- La página completa nunca debe adquirir scroll horizontal por una tabla.

## Formularios y teclado móvil

- Inputs, selects y textareas móviles usan al menos 16 px para impedir zoom automático no deseado en Safari iOS.
- `visualViewport` detecta reducción del viewport por teclado virtual.
- Cuando el teclado está abierto se retiran temporalmente elementos flotantes que compiten por espacio (dock y launcher de Paco).
- Modales móviles usan `100dvh` cuando está disponible y `100vh` como fallback.
- Safe areas se respetan en header, footer, drawer y superficies a pantalla completa.

## Criterios de aceptación global

1. No existe scroll horizontal del documento en los viewports de la matriz.
2. La navegación principal es alcanzable y cerrable con teclado y touch.
3. Ningún CTA primario queda fuera del viewport o debajo del teclado móvil.
4. Los controles táctiles compartidos conservan área operable mínima de 44 px.
5. Textos críticos no dependen de `hover` para ser entendidos.
6. Los estados hover que desplazan tarjetas se desactivan en dispositivos `pointer: coarse`.
7. Modales/drawers conservan scroll interno y no desplazan el documento subyacente.
8. Tablas simples son legibles sin zoom en teléfono; tablas complejas conservan todas sus columnas mediante scroll controlado.
9. La interfaz responde a orientación portrait/landscape sin recargar la aplicación.
10. `prefers-reduced-motion` elimina transiciones no esenciales.
11. Paco Bot y toasts se posicionan por encima del dock móvil y no cubren controles primarios.
12. El login se reorganiza a una sola columna en tablet/teléfono.
13. A 1024×768 el sidebar no consume permanentemente el área de trabajo.
14. A 1366×768 se reduce volumen ornamental antes que tamaño de texto funcional.
15. En 1920/2560 px el contenido mantiene longitud y densidad controladas en vez de estirarse sin límite.

## Componentes reconstruidos por la foundation

- Shell global y navegación.
- Drawer lateral y backdrop.
- Dock de navegación móvil.
- Header y título contextual móvil.
- Búsqueda móvil.
- Gutter y densidad del workspace.
- Page headers y barras de acciones.
- Grids compartidos.
- Toolbars y filtros.
- Tablas dinámicas.
- Formularios y controles táctiles.
- Modales, wizards y drawers.
- Paginación.
- Toasts.
- Integración espacial con Paco Bot.
- Adaptación al teclado virtual y safe areas.

## Política de implementación

`assets/css/responsive-foundation-v11190.css` es la capa responsive canónica y se carga después de los estilos de módulos.

`assets/js/modules/responsive-foundation-v11190.js` es el runtime adaptativo responsable del contrato de viewport y de normalizar contenido generado dinámicamente.

Los nuevos módulos deben reutilizar estos patrones y evitar introducir breakpoints locales salvo cuando el componente tenga una necesidad funcional exclusiva que no pueda expresarse con el contrato global.
