// Shared Apps Script namespace; external entry points retain their names.
function normalizeOrigin_(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  const match = input.match(/^(https?:\/\/[^\/?#]+)/i);
  return match
    ? match[1].toLowerCase().replace(/\/$/, '')
    : '';
}

function isAllowedOrigin_(origin) {
  const normalized = normalizeOrigin_(origin);
  return SETTINGS.ALLOWED_ORIGINS.some(function(allowedOrigin) {
    return normalizeOrigin_(allowedOrigin) === normalized;
  });
}
