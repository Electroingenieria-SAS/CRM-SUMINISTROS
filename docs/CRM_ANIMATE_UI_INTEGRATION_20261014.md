# CRM Suministros — sistema visual e interacciones 2026-10-14

## Arquitectura
La aplicación es una SPA con ESM nativo, no React. Animate UI publica componentes React
con Motion, Radix y Tailwind, por lo cual esos archivos JSX no se pueden incrustar directamente
sin introducir un segundo framework y un sistema de estados paralelo. Las interacciones se
reproducen mediante primitivas nativas verificables, conservando el diseño empresarial azul,
Century Gothic, PWA y compatibilidad con el código existente.

## Implementación real y alcance

| Referencia solicitada | Implementación en el CRM | Alcance |
| --- | --- | --- |
| Anime.js | animejs 4.5.0 fijado, empaquetado como vendor-anime.js ESM local | Transiciones de pestañas e indicadores |
| Motion | motion/mini 14.2.0, empaquetado | Tarjetas de TCC y ENVÍA, revelado de precios |
| AutoAnimate | @formkit/auto-animate 0.10.0 | Inserción y duplicado de materiales |
| Floating UI | @floating-ui/dom 1.8.0 | Ayuda contextual de precios, flip/shift |
| Animated Tabs / Fade / Auto Height | Pestañas nativas, fade de contenido y detalles desplegables | Cotizador e interacciones compartidas |
| Ripple / Liquid Button / Shine | Sistema compartido en crm-visual-system.js y crm-animate-experience.css | Botones del CRM sin introducir componentes React |
| Sliding / Counting Number | Transición de indicadores ya calculados, sin animar el valor contable | Resumen de mercancía e historial |
| Radix Sheet | dialog nativo con panel lateral y bloqueo de foco | Detalles de cotizaciones |
| Copy Button | Botón de copiar folio con respuesta de éxito | Detalle del historial |
| Progress | Estilos y estados de carga compartidos preexistentes, conservados | Módulos actuales |
| Notification List | Toasts existentes con transición de entrada, sin duplicar avisos | Módulos actuales |
| Icons | Iconografía corporativa existente, estados e indicadores gráficos | Módulos actuales |

**No se insertaron literalmente todos los componentes de Animate UI.** Algunos son
alternativos o inapropiados para un CRM empresarial (efectos visuales pesados, fondos animados,
duplicados de navegación). Se han usado patrones pertinentes y compatibles. Si posteriormente
se desea incorporar literalmente un componente React, requiere una migración controlada
de ese módulo, revisión de CSP y accesibilidad y pruebas de rendimiento.

## Correcciones funcionales
- Un único municipio buscable y seleccionable. La lista usa ARIA combobox/listbox,
  teclado, ratón y contrato `destinationKey` existente.
- TCC y ENVÍA son botones principales visibles; `carrier` se sincroniza siempre
  con el estado que se guarda.
- Valor declarado en COP visible junto a la transportadora, no oculto en detalles.
- Ambos motores se comparan, pero cada guía y cada cotización siguen vinculadas
  solo con su transportadora.
- Se mantiene el historial: paginación real, filtros por página, CSV, detalle y
  vinculación sin modificar pedidos.

## Control de calidad
- No modificar esquemas SQL, tarifas históricas, RPC, login, RLS ni protección de secretos.
- `prefers-reduced-motion`: ningún efecto decorativo imprescindible para completar tareas.
- No cargar bibliotecas desde CDN; solo bundle local MIT, versiones bloqueadas en lockfile.
- Mantener integridad PWA y presupuesto de 3 MiB / 750 archivos.
- Pruebas de contrato y E2E sobre 375, 768, 1024 y 1440 px, además de gates de seguridad.
- La interfaz debe comunicar el valor final de las transportadoras, sin inventar cifras
  ni alterar el cálculo al animar.
