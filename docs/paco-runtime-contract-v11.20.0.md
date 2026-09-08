# Paco Assistant V11.20.0 — Runtime Contract

Este contrato complementa la auditoría de causa raíz y define los invariantes que deben mantenerse después de la reconstrucción.

## Invariantes

- Un solo instalador: `installPacoAssistant()`.
- Un solo root montado por sesión.
- Un solo launcher con `data-paco2-toggle`.
- Un único listener `click` que invoca `toggleOpen()`.
- El estado de apertura se representa únicamente con `is-open`.
- El panel cerrado debe computar `display:none`.
- El panel abierto debe computar `display:flex`.
- Ninguna otra hoja CSS puede declarar clases `paco2-*`.
- Ningún observer puede crear, destruir o reescribir Paco.
- Los eventos globales `paco:open` y `paco:close` son entradas públicas controladas al mismo estado.
- El Service Worker solo precachea el runtime V11.20.0.

## Verificación del clic

El pipeline esperado es:

`launcher click -> toggleOpen() -> setOpen(true) -> root.is-open -> panel display:flex`

El cierre es:

`launcher/close -> setOpen(false) -> root sin is-open -> panel display:none`

La ausencia de `opacity-only hiding` es obligatoria para impedir superficies invisibles que intercepten el puntero.
