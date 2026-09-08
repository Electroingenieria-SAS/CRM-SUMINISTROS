# Smoke test Production — Paco Assistant V11.20.0

Después del merge a `main` y de que Vercel marque el deployment como `READY`:

1. Iniciar sesión con un perfil operativo válido.
2. Confirmar que el launcher de Paco es visible en la esquina inferior derecha.
3. Hacer un clic: el panel debe abrirse inmediatamente.
4. Verificar que el launcher cambia a estado abierto y que el panel permite interacción.
5. Hacer clic nuevamente en el launcher: el panel debe cerrarse.
6. Abrir y cerrar con el botón ×.
7. Abrir Herramientas y volver al chat.
8. Navegar a Pedidos, Inventario y Flujo y tiempos; Paco debe conservarse montado.
9. Cerrar Paco y hacer clic sobre la zona donde estaba el panel: la interfaz inferior debe recibir el clic, demostrando que no queda una superficie transparente.
10. Confirmar en Production `main.js?v=11.20.0`, CSS V11.20.0 y cache PWA V11.20.0.
