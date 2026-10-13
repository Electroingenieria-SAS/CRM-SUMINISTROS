# Cotización por material — peso / volumen

Base: main 7564b1e0dc8ac9c7c288a9cac31bb611e4f571b4. Rama feat/freight-material-measurements-20261013. Entrada #/freight_quotes.

El vendedor escribe un nombre y escoge Peso o Volumen. Un solo campo aparece, en kg o m³. Agregar material repite la tarjeta. Alternar conserva ambas medidas del mismo material; ingresar ambas permite comparar el envío completo sin pedir dimensiones ni bultos. Los valores son totales del material registrado, no pesos unitarios multiplicados automáticamente.

Cada transportadora presenta una estimación por peso y otra por volumen. Si ambas medidas están completas, se selecciona la mayor base cobrable, con preferencia por peso en empate. Si solo una está completa, se muestra su base disponible, condicionada a verificación de la transportadora. Si hay materiales mezclados y ninguna base contiene todos, ambos resultados indican cobertura parcial y solo se permite borrador. Nunca se suman kg y m³ ni se omite la minoría de materiales para fabricar una cotización total.

La base TCC permanece histórica 2023–2024. El volumen se convierte con el factor de la política TCC, 400 kg/m³; recargo de $50/kg conserva sus dos disparadores, incluso si gana la otra medida. La estimación ENVÍA mantiene exactamente la matriz aportada, divisor supuesto 5000 (200 kg/m³), mínimos, variable fija, half-up y márgenes. No se sustituyen cifras aportadas por tarifas web de otro origen/servicio. La tarjeta advierte sobre origen/factor no confirmados y extrapolación >100 kg. Predicción estadística usa solamente peso real completo; el volumen equivalente nunca se registra como peso físico ni como costo real de guía.

Investigación pública del 13/10/2026:
- TCC: https://tcc.com.co/courier/paqueteria/formas-de-pago-y-tarifas/ publica 400 kg/m³ y cobro por mayor peso, no un precio universal en COP/m³. El sitio actual redirige a https://tcc.com.co/envios-nacionales/. No se obtuvo una matriz terrestre 2026 verificable para sustituir la fuente histórica.
- ENVÍA: https://hub.envia.co/TablaTarifa/TablaTarifa.aspx indica vigencia desde 01/01/2026; consulta CALI → MEDELLIN-ANTIOQUIA, CONTADO devuelve mercancía terrestre $1.213 por kilo, cubrimiento NACIONAL. Es evidencia de una ruta/servicio, no tarifa por m³ para todas las rutas ni tarifa del contrato suministrado.
- https://envia.co/servicios distingue mercancía terrestre y servicio internacional. El factor 200 publicado en internacional no confirma automáticamente mercancía terrestre. Se conserva el supuesto del modelo original y su aviso, en lugar de modificarlo sin contrato.

Compatibilidad: cálculo v2 se selecciona por measurementVersion=2. El contrato anterior se conserva en freight_quote_legacy_calculate; snapshots antiguos permanecen intactos. Duplicar una cotización antigua exige confirmar las medidas por material, sin repartir bultos arbitrariamente. Save/list/link, RLS y RBAC se reutilizan. No se modifica Crear pedido, guías, carrier_cost ni datos de entrenamiento.

Migraciones aplicadas: freight_material_measurements 20261013202454, freight_material_surcharge 20261013202651. Archivos canónicos posteriores a las fases anteriores y equivalencias registradas en ledger. Se mantienen los registros aplicados sin reescribir su SQL.

Pruebas: red→green de formulario y conservación de medidas; red→green SQL de RPC v2 y recargo TCC cruzado; equivalencia ENVÍA 25 reglas × seis límites (150 comparaciones de base, total, margen y rangos); 33 fixtures originales; guardado/snapshots, solo peso, solo volumen, datos parciales y rechazo de negativos. Regresiones SQL TCC, permisos y creación de pedido sin cotización PASS. Navegador: alternar, agregar, comparar, invalidar, guardar y duplicar, ancho 375/768/1024/1440.

Rollback: promover el despliegue del merge 7564b1e0dc8ac9c7c288a9cac31bb611e4f571b4. Backend conserva API anterior; no borrar cotizaciones ni datos de tarifas.
