# Continuación ENVÍA — checkpoint

Base recuperada: main b0a507daa6443a9b9bd1c9e1e4d3390b956d4c9e, PR #116 fusionado, CI y producción verificados en esta sesión. Rama: feat/freight-envia-20261013. Entrada única: #/freight_quotes.

Hecho: pedido desacoplado; cotizador independiente; persistencia en erp_supply.freight_quotes; RPC public.erp_x_freight_quote_{catalog,calculate,save,list,link}; políticas erp_supply.freight_quote_policies; catálogo TCC erp_supply.freight_tariff_{editions,rows}; RLS/RBAC; costos observados y evaluación predicho-real. Motor TCC y matriz no requieren nueva importación.

SQL comprobado al recuperar: 30107 rutas, 30086 precios, 21 NULL; checksum CSV 4478d37ecde4f01a41dfaff2b460a5b0fa6fa35b4c1f9d416456173a06d53715.
Migraciones aplicadas: freight_quotes_catalog 20261013185631; freight_quotes_api 20261013185644; freight_quote_evaluation 20261013190055; freight_quote_input_visibility 20261013190347.

Hecho fase 2: 25 reglas ENVÍA versionadas, 33/33 fixtures decimales, resolución territorial, motor/RPC común, comparativa y snapshots independientes, guardado/historial/duplicación, restricciones de bultos, regresiones SQL y 216 tests. Pendiente: PR/CI y despliegue del frontend.
No confirmado por fuente: origen contractual ENVÍA, divisor 5000, varios bultos y >100 kg. Se conservarán como supuestos visibles, nunca precio oficial. Alias de presentación controlado ENVÍA/COLVANES respaldado por https://envia.co/contacto/ y https://envia.co/servicios/. Se conserva COLVANES en predicciones históricas y no se renombra ninguna guía.

Plan: tests primero → decimal exacto y cobertura → esquema aditivo/reglas → fachada común y guardado → UI común → SQL real/33 casos/regresión TCC → revisión → un checkpoint final de CI → despliegue y prueba pública. Copias originales conservadas sin cambios en data/freight/envia/ y docs/freight/envia-spec.md.

Migraciones ENVÍA aplicadas: envia_reference_rules 20261013194052; envia_reference_engine 20261013194055; freight_quotes_multi_carrier 20261013194057. Las copias canónicas 20261013220000/220100/220200 se ordenan después de TCC; equivalencias registradas sin reescribir historial.

Verificación: npm run validate (216/216); navegador 9/9 (cotizadores, pedidos, responsive y flujos existentes); seis scripts SQL reales PASS, transacciones revertidas. Caquetá 22 kg base 37.967 + 13.300 = 51.267, original 51.266 conservado en fixtures. TCC Cali→Tuluá continúa 22.872 y ENVÍA 23.900 en snapshots separados.

Rollback del frontend: promover el despliegue del merge b0a507daa6443a9b9bd1c9e1e4d3390b956d4c9e. Esquema aditivo compatible con TCC: conservar datos/snapshots; desactivar reglas/edición ENVÍA si se requiere suspender la referencia. No borrar tarifas ni guías ni modificar carrier_cost.
