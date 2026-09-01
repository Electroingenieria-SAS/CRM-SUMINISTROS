# Recepción V11.5

## Recepción de mercancía
Proceso independiente de bodega para recibir compras o devoluciones e ingresar existencias al sistema.

- Puede crearse sin pedido/PVE.
- Puede enlazarse opcionalmente con un PVE/orden de compra para precargar datos.
- Si se enlaza con un PVE, al guardar marca **Mercancía OK**.
- Nunca cambia etapa, estado, responsable, ruta ni cierre del pedido.
- Solo las cantidades aceptadas ingresan a inventario/lote.
- Genera REC/DEV, consecutivo, QR, código de barras, novedades y verificación.

## Recepción de pedido
Proceso propio del workflow del pedido.

- Valida la información comercial/logística del pedido.
- Relaciona materiales Siesa y responsables de Alistamiento/Corte.
- Al confirmar, sí continúa el workflow hacia Alistamiento.

## Workflow de pedidos
Desde V11.5 el flujo es:

`COMPRAS → RECEPCION_PEDIDO → ALISTAMIENTO`

`RECEPCION_MERCANCIA` queda retirado del workflow de pedidos y se conserva únicamente como código legado de compatibilidad.
