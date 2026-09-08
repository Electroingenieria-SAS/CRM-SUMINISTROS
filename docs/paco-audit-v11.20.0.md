# Auditoría técnica Paco Assistant — V11.20.0

## Objetivo

Eliminar la arquitectura acumulativa de Paco Bot y reconstruir el asistente con un único propietario de DOM, estado, eventos y estilos. La versión V11.20.0 no agrega una capa correctiva sobre V11.19.x: sustituye el subsistema anterior.

## Hallazgos de causa raíz

### 1. Colisión de estado visual y atributo `hidden`

En V11.19.3/V11.19.4 coexistían reglas CSS que forzaban `display:flex!important` sobre el panel y otras que intentaban ocultarlo con `[hidden]{display:none!important}`. La especificidad de los selectores podía dejar el panel visualmente transparente/cerrado pero presente en el árbol de hit-testing. Ese rectángulo podía interceptar el clic del launcher.

### 2. Multiplicidad de propietarios

El repositorio acumuló dos motores Paco, visibility guard, command center separado y cinco generaciones de runtime visual. Varios de ellos montaban, reescribían o vigilaban el mismo `#paco-bot` mediante listeners y observadores. Esto hacía imposible garantizar qué capa era la fuente de verdad.

### 3. CSS con responsabilidades mezcladas

Las hojas `paco-aesthetic-*` mezclaban la atmósfera global del CRM con geometría/visibilidad de Paco. V11.20.0 separa la estética general en `workspace-atmosphere-v11200.css` y deja `paco-assistant-v11200.css` como única hoja autorizada para el asistente.

### 4. PWA perpetuando runtimes antiguos

El Service Worker llegó a precachear motores y estilos Paco de generaciones distintas. V11.20.0 rota el cache y conserva únicamente el runtime canónico.

## Arquitectura V11.20.0

- `assets/js/modules/paco-assistant-v11200.js`: único motor.
- `assets/css/paco-assistant-v11200.css`: único contrato visual/geométrico.
- Namespace `paco2-*`: ningún CSS histórico puede afectar sus clases.
- Un único DOM de Paco.
- Un único estado de apertura: clase `is-open`.
- Un único listener del launcher.
- Sin `MutationObserver`.
- Sin visual bridge.
- Sin visibility guard.
- Sin command center paralelo.
- SVG de Paco renderizados directamente como `<img>`.

## Contrato de apertura

Estado cerrado:

- root visible únicamente para el launcher;
- `.paco2-panel { display:none!important; }`;
- el panel no participa en layout ni hit-testing.

Al hacer clic:

1. `data-paco2-toggle` ejecuta `toggleOpen()`;
2. `toggleOpen()` llama `setOpen(!isOpen())`;
3. `setOpen(true)` agrega `is-open` al root;
4. `#paco-bot.paco2-root.is-open .paco2-panel` cambia a `display:flex!important`;
5. no existe observer ni segundo listener que revierta el estado.

Segundo clic o botón cerrar:

- `setOpen(false)` elimina `is-open` y el panel vuelve a `display:none!important`.

## Componentes retirados

### JavaScript

- `paco-bot-v11180.js`
- `paco-bot-v11182.js`
- `paco-visibility-v11180.js`
- `paco-command-center-v11191.js`
- `paco-visual-v11183.js`
- `paco-visual-v11191.js`
- `paco-visual-v11192.js`
- `paco-visual-v11193.js`
- `paco-visual-v11194.js`

### CSS

- `paco-aesthetic-v11180.css`
- `paco-aesthetic-depth-v11180.css`
- `paco-chat-shell-v11193.css`
- `paco-enterprise-v11182.css`
- `paco-enterprise-v11183.css`
- `paco-enterprise-v11191.css`
- `paco-enterprise-v11192.css`

## PWA

Cache V11.20.0: `crm-suministros-v11-20-0-20260908-09`.

El precache conserva únicamente:

- `workspace-atmosphere-v11200.css`;
- `paco-assistant-v11200.css`;
- `paco-assistant-v11200.js`;
- SVG reales del personaje.

## Criterios de aceptación

La versión solo puede fusionarse si CI confirma:

1. sintaxis JavaScript válida en todo `assets/js`;
2. grafo estático sin imports/recursos faltantes;
3. identidad V11.20.0 / build 2026-09-08.09;
4. un solo runtime Paco en `main.js`;
5. ningún runtime Paco legado en `index.html` o Service Worker;
6. ningún `MutationObserver` en el asistente;
7. panel cerrado físicamente ausente de hit-testing;
8. panel abierto gobernado exclusivamente por `is-open`;
9. namespace `paco2-*` no utilizado por otra hoja CSS;
10. assets reales de Paco presentes y precacheados;
11. regresiones críticas de Inventario, Despachos, Flujo, Reportes, Histórico, Administración y Corte aún validadas.

## Resultado esperado

Paco V11.20.0 deja de ser una sucesión de hotfixes y pasa a ser un componente canónico aislado. Si el launcher es visible y el usuario hace clic, no existe dentro del subsistema Paco ninguna superficie invisible, observer, runtime secundario o regla CSS histórica capaz de impedir o revertir la apertura.