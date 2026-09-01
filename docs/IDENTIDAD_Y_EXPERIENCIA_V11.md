# Identidad y experiencia V11

## Nombre oficial

El producto se presenta desde V11 como **CRM Suministros**, una plataforma de Electroingeniería S.A.S. que combina relación comercial, información operativa, trazabilidad de pedidos y gestión de suministros.

No debe mostrarse al usuario como “ERP”, “ERP EI” o “ERP Electroingeniería”. La terminología heredada puede permanecer únicamente en contratos técnicos que todavía dependan de ella, por ejemplo RPC `erp_x_*`, eventos `erp:*` y rutas de almacenamiento históricas.

## Principios visuales

- Azul, amarillo y blanco como paleta principal.
- Century Gothic como primera opción tipográfica institucional.
- Texto base legible, botones táctiles de mínimo 44 px e iconos sólidos con contraste alto.
- Contenido dentro de tarjetas y botones con ajuste de línea; ningún rótulo debe desbordar su contenedor.
- Navegación clara y consistente, con estados activos visibles.
- Animaciones breves que orientan y no bloquean la interacción.
- Respeto por `prefers-reduced-motion`.
- Áreas seguras de iOS y controles cómodos para Android.

## Jornada y actividades

La experiencia V11 organiza el módulo en tres vistas:

1. **Mi jornada:** agenda, cronómetro, actividades rápidas, evidencias e historial del día.
2. **Cronograma:** planificación semanal, calendario mensual, asignación y capacidad del equipo.
3. **Indicadores:** carga, ocupación, resultados y revisiones.

Los flujos de iniciar, pausar, reanudar, finalizar, adjuntar evidencia, asignar, repetir y cancelar conservan sus contratos de API. La renovación modifica presentación y usabilidad sin sustituir las validaciones del servidor.

## Compatibilidad

El cambio de nombre no altera el proyecto Supabase `hezjxcxxcjlpmyalftam`, los nombres de RPC ni los registros existentes. Cualquier futura migración de identificadores técnicos requiere inventario de dependencias, alias transitorios, pruebas por rol y plan de reversión.
