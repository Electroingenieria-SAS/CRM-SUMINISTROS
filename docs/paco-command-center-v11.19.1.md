# Paco Bot Command Center · V11.19.1

## Objetivo

Evolucionar Paco Bot sin sacrificar legibilidad ni seguridad: panel más alto, launcher circular visible al lado izquierdo cuando el chat está abierto, animación de rodado y un centro de herramientas de diagnóstico/consulta gobernado por los permisos de la sesión.

## Geometría

- Ancho objetivo de panel: 500 px.
- Alto objetivo: hasta 760 px, limitado siempre por el viewport real.
- Launcher abierto: circular, 68 px, acoplado al lado inferior izquierdo del panel.
- Separación: 16 px.
- Distancia de rodado: ancho real del panel + separación, limitada por el viewport.
- Movimiento: giro hacia la izquierda + trazo de movimiento; respeta `prefers-reduced-motion`.

## Centro de herramientas

Las herramientas son de lectura/diagnóstico o navegación; las mutaciones siguen en los flujos nativos del CRM.

- Mi acceso: roles y capacidades visibles.
- Pedidos a revisar: señales de SLA, bloqueo o ausencia de responsable entre pedidos visibles.
- Excepciones: resumen real del centro de excepciones.
- Mi jornada: consulta del día actual.
- Inventario: salud de reservas.
- Flujo y tiempos: acceso al análisis VSM.
- Analítica: acceso al Intelligence Center.
- Último error: último `erp:rpc-error` de la sesión.
- Salud del CRM: `api.health()` únicamente para perfiles administrativos.
- Usuarios y permisos: acceso a Administración cuando corresponde.
- Auditoría: trazabilidad.
- Actualizar vista: solicita refresco del módulo actual.

## Seguridad

Paco Command Center no contiene credenciales privilegiadas, no fuerza etapas, no escribe SQL y no ejecuta cambios de negocio por fuera de los controles existentes. Las herramientas visibles se filtran mediante `can()` y roles de la sesión actual.

## Responsive

La capa se carga después de Responsive Foundation V11.19.0. En móvil el panel ocupa una hoja segura respetando `safe-area`, dock inferior y teclado; el launcher permanece separado del panel cuando hay espacio disponible.
