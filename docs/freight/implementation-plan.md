# Cotización de fletes: implementación

Spec: implementation-spec.md y TCC-model.md, aprobados mediante la instrucción de ejecución del usuario.
Objetivo: módulo independiente y persistente, pedido sin consultas de flete, catálogo TCC histórico íntegro.
Arquitectura: SPA modular existente, RPC PostgreSQL con RBAC/RLS, CSV solo en backend.
Ejecución: en esta sesión, rama feat/freight-quotes-tcc-20261013 desde f6335ef8405f6438dd053d29f9d228e362dd7d1d.

1. Pruebas del CSV, fórmula y desacople. Interfaces: parseTariffs(text), calculateTccReference(rate,packages,declaredValue). Ejecutar node --test scripts/tests/freight-quotes.test.mjs en rojo y verde.
2. Catálogo, reglas versionadas, cálculo backend, búsquedas acotadas, guardar/listar/vincular cotizaciones. Migración aditiva con require_profile/current_org_id/can_access_module. Validar SQL, RLS, idempotencia y conteos efectivos.
3. Navegación freight_quotes, formulario de rutas geográficas y bultos, materiales Siesa/manual, historial/duplicar/vincular. Prediction snapshot independiente, costo real únicamente desde guía. Retirar estimador y sus listeners del wizard y confirmación.
4. Validación completa npm run validate, E2E y responsive, importar CSV controlado, publicar PR y comprobar CI. No merge con checks rojos.

Revisión: origen Tuluá sin equivalencia Cali, destinos homónimos, 21 NULL, estado histórico sin precio oficial, entrada editada tras cálculo invalida snapshot, no atribuir a cotizaciones costos observados, acceso entre organizaciones.
ENVÍA: pendiente exclusivamente del prompt de Claude, adaptador independiente preparado.
