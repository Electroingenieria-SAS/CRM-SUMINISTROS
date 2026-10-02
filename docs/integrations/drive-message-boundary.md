# Callback institucional de Drive

El receptor está en `assets/js/integrations/drive/bridge/post-message-request.js`.
Acepta el origen exacto de la implementación configurada y exige que el emisor
pertenezca al iframe creado para esa solicitud. Conserva la correlación por
`requestId`/`uploadId` y libera listeners, formulario, iframe y timeout al terminar.

## Evidencia del despliegue vigente

El 01/10/2026 se abrió en Chrome el endpoint `/exec` de `CONFIG.drive.bridgeUrl`.
El DOM mostró esta jerarquía:

- Documento exterior: `https://script.google.com`.
- `iframe#sandboxFrame`: origen
  `https://n-bxf2muk7rmihub4iuwdqznurqcm6ax6w26p5jdy-0lu-script.googleusercontent.com`;
  ruta `/userCodeAppPanel`, con `allow-same-origin` y `allow-scripts`.
- Dentro del sandbox: `iframe#userHtmlFrame`, ruta relativa `/blank`.

`google-apps-script/Responses.gs` envía el mensaje a `window.top` y `window.parent`.
Por eso el receptor admite descendientes del iframe de la solicitud; exigir solo
`event.source === iframe.contentWindow` impediría el callback anidado.
No se permiten hosts Google arbitrarios, puertos alternativos ni otras ventanas.

## Cambio de implementación

Al cambiar la implementación de Apps Script, comprobar su origen exacto y
jerarquía antes de actualizar la lista permitida. No ampliar a
`*.googleusercontent.com` ni desactivar la comprobación de origen/emisor.
La inspección del DOM no certifica una carga autenticada de archivos. Las pruebas
Node ejercitan aceptación/rechazo; el smoke de navegador usa un callback sintético
con tres frames y orígenes reales separados, sin escribir datos en Drive.
