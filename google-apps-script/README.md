# Puente institucional de Drive

El código comparte el namespace global de Apps Script. `doGet`, `doPost` y
`probarConfiguracion` conservan sus nombres y el contrato de versión 3.5.1.
No utiliza ES Modules ni dependencias Node en ejecución.

Para actualizar el proyecto institucional existente, cargar **todos** los `.gs`
de esta carpeta con sus nombres. Reemplazar el antiguo archivo `Code.gs` solo
cuando los archivos nuevos estén preparados; no conservar ambas implementaciones,
porque declararían las mismas funciones dos veces.

Revisar `Settings.gs` conservando los valores operativos existentes. Ejecutar
`probarConfiguracion` como propietario institucional. Actualizar la versión del
**despliegue existente** conservando su URL `/exec`, ejecución como propietario
 y acceso «Cualquier persona». La autorización de cada operación sigue dependiendo
 de la sesión ERP validada en Supabase y los archivos permanecen privados.

El refactor fue probado con servicios simulados, sin escrituras externas.
**PENDIENTE EXTERNO — publicación en el proyecto Apps Script:** esta sesión no
 dispone de una operación conectada para cargar fuentes y actualizar su despliegue.
La versión productiva anterior sigue siendo compatible con el frontend.
