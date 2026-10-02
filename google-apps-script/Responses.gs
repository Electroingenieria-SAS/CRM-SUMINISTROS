// Shared Apps Script namespace; external entry points retain their names.
function callbackPage_(request, data) {
  const requestedOrigin = normalizeOrigin_(
    request && request.origin ? request.origin : ''
  );

  const targetOrigin = requestedOrigin || '*';

  const response = {
    source: 'ERP_EI_DRIVE_BRIDGE',
    version: SETTINGS.VERSION,
    requestId:
      request && (request.requestId || request.uploadId)
        ? (request.requestId || request.uploadId)
        : null,
    uploadId:
      request && (request.uploadId || request.requestId)
        ? (request.uploadId || request.requestId)
        : null
  };

  Object.keys(data || {}).forEach(function(key) {
    response[key] = data[key];
  });

  const json = JSON.stringify(response)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  const scriptBody =
    '(function(){' +
      'var message=' + json + ';' +
      'var origin=' + JSON.stringify(targetOrigin) + ';' +
      'var targets=[];' +
      'try{if(window.top&&window.top!==window){targets.push(window.top);}}catch(e){}' +
      'try{if(window.parent&&window.parent!==window&&targets.indexOf(window.parent)===-1){targets.push(window.parent);}}catch(e){}' +
      'for(var i=0;i<targets.length;i++){try{targets[i].postMessage(message,origin);}catch(e){}}' +
    '})();';

  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>' + scriptBody + '</scr' + 'ipt>' +
    '</body></html>'
  ).setXFrameOptionsMode(
    HtmlService.XFrameOptionsMode.ALLOWALL
  );
}

function safeError_(error) {
  const message = String(
    error && error.message
      ? error.message
      : error || 'No fue posible cargar el archivo.'
  );

  if (/Exception|DriveApp|UrlFetch|Utilities|ScriptError/i.test(message)) {
    return 'No fue posible completar la carga institucional. Revisa la configuración del puente de Drive.';
  }

  return message.slice(0, 240);
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
