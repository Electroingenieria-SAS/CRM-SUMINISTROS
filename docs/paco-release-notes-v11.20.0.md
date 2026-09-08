# CRM Suministros V11.20.0 — Paco Assistant

V11.20.0 reemplaza el subsistema Paco V11.18–V11.19 por una implementación única y aislada.

Principales cambios:

- motor único `paco-assistant-v11200.js`;
- CSS único `paco-assistant-v11200.css`;
- namespace `paco2-*`;
- estado único `is-open`;
- panel cerrado fuera de hit-testing mediante `display:none`;
- herramientas, diagnósticos y ayuda incorporados en el mismo motor;
- SVG reales renderizados directamente;
- retiro de motores, guards, visual bridges y shells anteriores;
- separación de la estética global a `workspace-atmosphere-v11200.css`;
- rotación PWA a cache V11.20.0;
- contrato CI específico contra regresiones de Paco.
