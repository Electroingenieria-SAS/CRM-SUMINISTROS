# Checklist de despliegue — Paco Assistant V11.20.0

- [ ] CI JavaScript syntax verde.
- [ ] CI static dependency graph verde.
- [ ] Contrato V11.20.0 verde.
- [ ] `main.js` importa únicamente `paco-assistant-v11200.js`.
- [ ] `index.html` carga únicamente `paco-assistant-v11200.css` para Paco.
- [ ] `workspace-atmosphere-v11200.css` conserva la atmósfera global sin selectores Paco.
- [ ] Service Worker rotado a `crm-suministros-v11-20-0-20260908-09`.
- [ ] Sin archivos de runtime/CSS Paco anteriores en la rama de release.
- [ ] Merge a `main` únicamente después de CI.
- [ ] Vercel Production `READY` sobre el commit V11.20.0.
- [ ] `index.html` de Production referencia `main.js?v=11.20.0`.
- [ ] CSS V11.20.0 accesible en Production.
- [ ] Service Worker de Production contiene cache V11.20.0.
- [ ] Smoke test autenticado manual: primer clic abre; segundo clic cierra; botón × cierra; herramientas abren; navegación no deja superficies invisibles.
