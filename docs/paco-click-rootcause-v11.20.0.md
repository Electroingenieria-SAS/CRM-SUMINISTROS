# Paco Assistant V11.20.0 — Causa raíz del clic

## Síntoma observado

El launcher era visible, pero al hacer clic el panel no se abría.

## Causa raíz confirmada en V11.19.x

El subsistema anterior permitía que el panel permaneciera en el árbol de hit-testing aunque estuviera conceptualmente cerrado. Las reglas de visibilidad se repartían entre varias hojas CSS y varios runtimes JavaScript. La combinación de `display:flex!important`, `[hidden]`, observers y controladores paralelos hacía posible que una superficie transparente quedara sobre el propio launcher y absorbiera el puntero.

## Corrección arquitectónica

V11.20.0 elimina todas las capas anteriores y usa un solo contrato:

- cerrado: `.paco2-panel{display:none!important}`;
- abierto: `.paco2-root.is-open .paco2-panel{display:flex!important}`;
- clic: un único listener en `[data-paco2-toggle]`;
- estado: una única clase `is-open`;
- sin observers ni bridges.

## Aceptación

La versión se considera corregida solo después de que el build V11.20.0 esté en Production y un smoke test autenticado confirme:

1. launcher visible;
2. primer clic abre el panel;
3. segundo clic vuelve a cerrar;
4. botón × cierra;
5. el panel cerrado no intercepta clics;
6. navegación entre módulos no desmonta Paco;
7. herramientas y compositor siguen funcionando.
