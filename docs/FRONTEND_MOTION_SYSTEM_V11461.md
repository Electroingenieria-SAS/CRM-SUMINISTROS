# CRM Suministros · Sistema modular de movimiento V11.46.1

## Alcance y decisiones

Intervención exclusiva en \`Electroingenieria-SAS/CRM-SUMINISTROS\`, sin cambiar el modelo tarifario, RPC, RLS, la creación de pedidos ni los datos históricos. Animate UI es inspiración estética; ningún componente se copió. Se conservan JavaScript ES Modules, cuatro familias CSS canónicas y la SPA existente.

## Auditoría dirigida

| Componente | Fuente existente | Comportamiento anterior | Intervención | Dependencia | Riesgo/decisión |
| --- | --- | --- | --- | --- | --- |
| Pestañas del cotizador | \`quote-view.js\`, \`quotes-enterprise.css\` | Cambio abrupto con borde activo | Indicador activo, revelado moderado sin remontar formularios | Motion mini y CSS | Bajo, mejorar |
| Lista de mercancía | \`quote-lines.js\` | Inserción/eliminación instantánea | Animar los hijos directos del contenedor | AutoAnimate | Medio, preservar inputs |
| Precios TCC/ENVÍA | \`measurement-view.js\` | Total legible pero estático | Revelado de los importes definitivos sin mostrar cifras ficticias | Motion mini | Bajo, conservar valores |
| Referencia técnica | \`measurement-view.js\` | Texto extenso | Ayuda contextual posicionada | Floating UI | Bajo, cerrar y liberar observador |
| Tarjetas de comparación | \`quote-view.js\` | Tarjetas estáticas | Entrada breve, hover moderado y selector de empresa | Motion mini y CSS | Bajo, conservar reglas |
| Historial | \`quote-history-view.js\` | Tabla paginada por RPC | Reorganización visual y contenedor animado | AutoAnimate | Medio, filtro de página explícito |
| Ver cotización | \`quote-controller.js\` | Saltaba al formulario | Panel de detalles modal accesible | CSS nativo | Medio, reemplazar |
| Vincular pedido | \`quote-controller.js\` | \`window.prompt()\` | Diálogo con validación y estado asincrónico | CSS nativo | Medio, mantener autorización RPC |
| Modales compartidos | \`process-dialogs-modal*.css\` | \`popupEnterV1190\`, pasos guiados | Conservados: entrada/salida actualmente adecuadas | CSS nativo | Alto, no duplicar |
| Drawers compartidos | \`record-details.css\` | \`drawerIn\` de 200 ms | Curva suavizada a 240 ms | CSS nativo | Bajo, mejora puntual |
| Jornada | \`planner-layout.css\` | \`crm-rise\` de 340 ms | Entrada de 270 ms, sin tocar cronómetros | CSS nativo | Bajo, mejora puntual |
| PACO | \`panel-layout-paco-bot-3.css\` | Transiciones propias y escritura | Conservadas por identidad funcional | CSS existente | Alto, conservar |
| Progreso global | \`progress-overlay.css\` | Estados/animaciones operativas | Conservado sin porcentajes simulados | CSS existente | Alto, conservar |

## Dependencias fijadas

| Nombre | Versión | Licencia | Uso | Distribución |
| --- | --- | --- | --- | --- |
| \`motion\` | 13.4.0 | MIT | Revelado de resultados, paneles y pequeñas transiciones | \`motion/mini\` incluido en ESM local |
| \`@formkit/auto-animate\` | 0.10.0 | MIT | Cambios de materiales e historial | ESM local |
| \`@floating-ui/dom\` | 1.8.0 | MIT | Posicionamiento de ayuda contextual | ESM local |
| \`esbuild\` | 0.25.12 | MIT | Compilar únicamente entradas de proveedor reproducibles | Dependencia de desarrollo, no enviada al navegador |

Entrada: \`scripts/vendor/ui-animations-entry.js\`.
Paquete generado: \`assets/js/vendor/ui-animations.js\` (aprox. 32 KB sin compresión).
Compilación: \`npm ci && npm run vendor:build\`.
Control determinista: \`npm run vendor:check\`.
Sólo se carga al abrir Cotización de fletes. No existen imports bare al navegador, \`@latest\`, scripts inyectados ni cambios permisivos de CSP.
Los avisos de licencia de las dependencias deben mantenerse en el lockfile y esta documentación; si se redistribuye el bundle fuera de este repositorio deben adjuntarse las licencias MIT originales.

## API de animaciones reutilizable

\`assets/js/core/animation/motion-tokens.js\` define duraciones y la preferencia de movimiento reducido.
\`assets/js/core/animation/ui-motion.js\` carga el proveedor de forma diferida y expone \`animationVendor()\`, \`revealElement()\` y \`enhanceList()\`.
\`assets/js/core/animation/freight-effects.js\` consume la abstracción y sólo inicializa observadores en la pantalla de fletes. Al abandonar esa vista, limpia posicionadores flotantes, animaciones, observadores y listeners.

Las cantidades mostradas corresponden siempre al resultado real recibido del backend. En el primer cálculo se revela el texto final, sin conteos ficticios desde cero ni estados de progreso porcentuales.

## Historial, permisos y seguridad

La RPC \`erp_x_freight_quote_list(p_page)\` devuelve una página de registros y un total. **El buscador, el orden y la exportación CSV sólo afectan la página cargada**. No se declara búsqueda global ni se descargan todos los registros.

Ver abre un panel lateral con detalles reales, materiales y fuente. Vincular utiliza un formulario con validación, no \`window.prompt()\`. Se conserva el chequeo \`freight_quotes.canUpdate\`, el RPC \`erp_x_freight_quote_link\` y la prohibición de alterar pedidos por consultar/duplicar. El panel admite Escape, restauración de foco y bloqueo reversible del scroll.

El CSV incluye protección contra fórmulas y conserva la trazabilidad de la página exportada. No se modificaron los datos de las guías ni la calibración de TCC/ENVÍA.

## Verificación y publicación

Los gates de Actions revisan sintaxis, grafo ESM, \`vendor:check\`, contratos, auditoría de seguridad, CodeQL, tests unitarios, Playwright responsive y E2E autenticado, \`pwa:check\` y presupuesto original de 3 MiB / 750 archivos.
\`scripts/ci/package-frontend.sh\` prepara el artefacto estático; \`deploy-pages\` publica GitHub Pages desde \`main\` **sólo después** del éxito de los jobs obligatorios.
Vercel mantiene el despliegue automático deshabilitado por \`vercel.json\`: su despliegue se realiza separadamente tras la recuperación de cuota y comprobación de \`READY\`.

## Criterios adicionales

No se amplían los límites de recursos. No se crean dashboards de métricas inventadas. Si una animación no se puede inicializar, el formulario y los resultados siguen funcionando. Ninguna transición debe alterar permisos ni decisiones del motor matemático.
