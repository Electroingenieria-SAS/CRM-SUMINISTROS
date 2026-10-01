// Shared Apps Script namespace; external entry points retain their names.
function validateErpSession_(accessToken) {
  const url =
    SETTINGS.SUPABASE_URL.replace(/\/$/, '') +
    '/rest/v1/rpc/erp_x_session';

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: '{}',
    muteHttpExceptions: true,
    headers: {
      apikey: SETTINGS.SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + accessToken
    }
  });

  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      status === 401 || status === 403
        ? 'La sesión del ERP venció o el usuario no está autorizado.'
        : 'No fue posible validar la sesión del ERP.'
    );
  }

  let session;
  try {
    session = JSON.parse(body || '{}');
  } catch (error) {
    throw new Error('Supabase devolvió una sesión inválida.');
  }

  if (!session.profile || !session.profile.id) {
    throw new Error('El usuario no tiene un perfil operativo activo.');
  }

  return session;
}
