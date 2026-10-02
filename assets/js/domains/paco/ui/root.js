import { VERSION, STYLE_ID, ASSETS } from "../paco-config.js";
import { paco } from "../paco-state.js";
import { esc, moduleLabel } from "../context/profile-context.js";

export function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;
  link.rel="stylesheet";
  link.href="./assets/runtime-css/paco-operational-v11370.css?v=11.37.4";
  document.head.appendChild(link);
}

export function renderRoot(){
  return `<div id="paco-bot" class="paco2-root paco-op-root" data-paco-version="${VERSION}" hidden>
    <button type="button" class="paco2-launcher paco-op-launcher" aria-label="Abrir PACO" aria-expanded="false" data-paco-toggle>
      <span class="paco-op-launcher-glyph" aria-hidden="true">⚡</span>
      <span class="paco-op-badge" data-paco-badge hidden>0</span>
      <span class="paco2-launcher-dot" aria-hidden="true"></span>
    </button>
    <section class="paco2-panel paco-op-panel" role="dialog" aria-label="PACO, asistente operativo del CRM">
      <header class="paco2-head paco-op-head">
        <div class="paco-op-avatar-wrap">
          <img class="paco2-head-face" src="${ASSETS.idle}" alt="" aria-hidden="true" data-paco-face>
          <span class="paco-op-presence" aria-hidden="true"></span>
        </div>
        <div class="paco2-head-copy">
          <span>Asistente operativo</span>
          <strong>PACO</strong>
          <small><span class="paco-op-online-text">Activo ahora</span> · <span data-paco-context>${esc(moduleLabel())}</span></small>
        </div>
        <button type="button" class="paco-op-voice ${paco.voiceEnabled?"is-on":""}" data-paco-voice aria-label="Activar o silenciar voz" title="Voz en español latino"><span data-paco-voice-icon>${paco.voiceEnabled?"🔊":"🔇"}</span></button>
        <button type="button" class="paco2-close" data-paco-close aria-label="Cerrar PACO">×</button>
      </header>
      <section class="paco-op-control-card" aria-label="Controles rápidos de PACO">
        <div class="paco-op-control-head">
          <div class="paco-op-status-copy">
            <span class="paco2-online"></span>
            <div>
              <strong>Conectado al CRM</strong>
              <span data-paco-monitor-status>Monitoreo activo · resumen cada 30 min</span>
            </div>
          </div>
          <span class="paco-op-control-kicker">Controles</span>
        </div>
        <div class="paco-op-control-grid">
          <label class="paco-op-voice-picker" title="Voces latinoamericanas disponibles en este dispositivo">
            <span class="paco-op-control-label">Voz del asistente</span>
            <select data-paco-voice-select aria-label="Seleccionar voz de PACO"></select>
          </label>
          <button type="button" class="paco-op-control-button" data-paco-test-voice>
            <span class="paco-op-control-icon" aria-hidden="true">🔊</span>
            <span><b>Probar voz</b><small>Escuchar a PACO</small></span>
          </button>
          <button type="button" class="paco-op-control-button" data-paco-summary-now>
            <span class="paco-op-control-icon" aria-hidden="true">◎</span>
            <span><b>Resumen ahora</b><small>Estado operativo</small></span>
          </button>
          <button type="button" class="paco-op-control-button" data-paco-restart>
            <span class="paco-op-control-icon" aria-hidden="true">↻</span>
            <span><b>Reiniciar</b><small>Nueva consulta</small></span>
          </button>
        </div>
      </section>
      <div class="paco2-messages paco-op-messages" data-paco-messages aria-live="polite"></div>
      <div class="paco-op-quick-wrap" data-paco-quick-wrap>
        <button type="button" class="paco-op-quick-fab" data-paco-quick-toggle aria-expanded="false" aria-controls="paco-quick-menu">
          <span aria-hidden="true">⚡</span><b>Accesos</b>
        </button>
        <section id="paco-quick-menu" class="paco-op-quick-menu" data-paco-quick-menu hidden aria-label="Accesos rápidos de PACO">
          <header class="paco-op-quick-menu-head">
            <div><small>PACO</small><strong>Acciones rápidas</strong></div>
            <button type="button" data-paco-quick-close aria-label="Cerrar accesos rápidos">×</button>
          </header>
          <div class="paco2-quick paco-op-quick" data-paco-quick></div>
        </section>
      </div>
      <form class="paco2-composer paco-op-composer" data-paco-form>
        <div class="paco-op-input-shell">
          <textarea rows="1" maxlength="500" data-paco-input aria-label="Escribe a PACO" placeholder="Mensaje a PACO…"></textarea>
        </div>
        <button type="submit" class="paco2-send" data-paco-send aria-label="Enviar mensaje">➜</button>
      </form>
      <div class="paco2-safe-note">PACO usa los datos y permisos reales de tu sesión.</div>
    </section>
    <div class="paco-op-toast-stack" data-paco-toast-stack aria-live="assertive"></div>
  </div>`;
}
