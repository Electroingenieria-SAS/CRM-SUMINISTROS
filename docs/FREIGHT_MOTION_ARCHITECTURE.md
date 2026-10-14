# CRM Suministros — sistema Motion para Fletes (2026-10-14)

## Objetivo y límites
Extensión progresiva sobre la SPA ESM existente; nunca transforma tarifas, RPC, RLS ni pedidos.
La fuente institucional permanece en Century Gothic, azul/blanco y acentos amarillos.
La distribución es local bajo assets/js/shared/motion; el navegador NO depende de NPM/CDN ni bare imports.

## Dependencias reproducibles
| Dependencia | Versión bloqueada | Licencia | Uso | Distribución |
| --- | --- | --- | --- | --- |
| motion | 14.2.0 | MIT | Entradas sutiles de tarjetas y precio final, motion/mini | vendor-motion.js |
| @formkit/auto-animate | 0.10.0 | MIT | Inserción/eliminación/duplicación de materiales; solo su contenedor | vendor-auto-animate.js |
| @floating-ui/dom | 1.8.0 | MIT | Tooltips de precios; posicionamiento con flip/shift/offset | vendor-floating-ui.js |
| esbuild (solo desarrollo) | 0.25.12 | MIT | Empaquetado ESM autocontenido, sin cambiar el framework | No se sirve en navegador |

El build se produce con npm ci y npm run motion:bundle. Su salida se versiona y está dentro
del precache con integridad por revisión. La procedencia y licencias se documentan
en el lockfile y los paquetes originales MIT, conservando avisos en los bundles.

## Matriz de auditoría dirigida
| Componente | Fuente original | Animación previa | Acción / nueva experiencia | Dependencia | Riesgo |
| --- | --- | --- | --- | --- | --- |
| Tarjetas TCC/ENVÍA | quote-view, measurement-view | freight-fade-in CSS | Entrada escalonada solo con resultado confirmado y reveal del valor final; conservar texto accesible | Motion mini | bajo |
| Lista de materiales | quote-lines | transiciones CSS | Reordenación de hijos inmediatos con AutoAnimate, desactivar ante movimiento reducido | AutoAnimate | medio |
| Ayuda del precio | measurement-view | nada | Tooltip accesible de fuente, posicionado solo mientras está abierto | Floating UI | bajo |
| Historial | quote-history-view | tabla estática | conservar paginación y filtros reales por página; panel contextual en vez de cambiar cotización | CSS/HTML dialog | bajo |
| Vínculo de pedido | quote-controller | window.prompt | diálogo validado, estados, permisos y feedback claros | HTML dialog | medio |
| Encabezados CRM | cards-page-head | hover CSS | conservar; no crear duplicación de efectos | nativo | bajo |
| Modales comunes | process-dialogs-modal-overlay | popupEnterV1190 | conservar entrada útil; añadir reducción de movimiento transversal | nativo | bajo |
| Jornada | planner-layout | crm-rise | conservar estados y cronómetros; suprimir solo movimiento decorativo en modo reducido | nativo | bajo |
| PACO | panel-layout-paco-bot-3 | transiciones propias | conservar identidad y transiciones; no sumar animaciones redundantes | nativo | bajo |

## Contratos
- Motion: createMotionKit(root) mantiene animaciones asociadas al contenedor, cancela al recrear la vista.
- Materiales: inicialización UNA vez sobre [data-quote-materials]; no observar body/document.
- Floating: autoUpdate solamente con tooltip visible; libera al cerrar, Escape, cambio de foco o reconstrucción.
- Precios: los números COP proceden directamente de commercialEstimate; no contar desde cero ni crear importes ficticios.
- Historial: búsqueda/CSV limitados explícitamente a registros de la página obtenida de la RPC actual.
- Detalle: HTML dialog con Escape y trap de foco nativo; la referencia se consulta sin modificar pedidos.
- Guardar/vincular requiere los permisos preexistentes, y la vinculación solo ocurre tras confirmación.
- prefers-reduced-motion: tarjetas sin desplazamientos ni animación de precios; todo sigue operando.
- CSP: solo ESM local desde self, sin eval ni scripts remotos nuevos.

## Validación de liberación
Ejecución necesaria en cada PR: npm run validate, npm run pwa:check, E2E de fletes,
escaneo de secretos, CodeQL, dependencias, publicación GitHub Pages en main.
No subir a producción si una verificación obligatoria falla.

El empaquetador registra bytes de cada vendor. Los límites globales siguen en 3 MiB / 750 activos,
sin incremento. Las nuevas reglas de estilo están en quote-motion.css para evitar archivos CSS
mayores de 300 líneas. Los módulos compartidos existentes se conservan sin refactor masivo.
