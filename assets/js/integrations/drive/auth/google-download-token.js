import { CONFIG } from "../../../config.js";

export function requireGsi() {
  if (!window.google?.accounts?.oauth2) {
    throw new Error("El servicio de lectura de PDF no está disponible. Recarga la página e inténtalo nuevamente.");
  }
}

export async function downloadToken() {
  if (driveOAuthState.accessToken) return driveOAuthState.accessToken;
  requireGsi();

  return new Promise((resolve, reject) => {
    driveOAuthState.tokenClient = driveOAuthState.tokenClient || google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.drive.clientId,
      scope: CONFIG.drive.scope,
      callback: response => response.error
        ? reject(new Error(response.error))
        : resolve(driveOAuthState.accessToken = response.access_token)
    });
    driveOAuthState.tokenClient.requestAccessToken({prompt: ""});
  });
}

export const driveOAuthState={
tokenClient:undefined,
accessToken:undefined
};
