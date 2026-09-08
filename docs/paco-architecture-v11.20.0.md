# Arquitectura canónica — Paco Assistant V11.20.0

## Propiedad del componente

`assets/js/modules/paco-assistant-v11200.js` es el único propietario de montaje, estado, eventos, mensajes, herramientas y expresiones visuales de Paco.

`assets/css/paco-assistant-v11200.css` es el único propietario de geometría, visibilidad, responsive y animaciones del asistente.

## Estado

La apertura no se replica en atributos, observers o runtimes secundarios. `is-open` es la única fuente de verdad.

## DOM

El root se monta una sola vez después de cargar el contexto autenticado. Cambiar de módulo solo actualiza el contexto del asistente; no remonta el componente.

## Integración

Entradas públicas:

- evento `paco:open`;
- evento `paco:close`.

Salidas relevantes:

- navegación por router;
- evento `erp:open-order`;
- evento `erp:refresh`.

Todas las consultas usan servicios existentes del CRM y respetan los permisos de la sesión.

## Regla de evolución

Cambios futuros deben modificar el módulo y/o CSS canónicos. No se deben crear `paco-visual-*`, visibility guards, bridges, command centers paralelos ni hojas de hotfix superpuestas.
