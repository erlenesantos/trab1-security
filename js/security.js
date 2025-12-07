
const PKCE_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";


function randomString(length, charset = PKCE_CHARSET) {
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error("Web Crypto API não disponível neste navegador.");
  }

  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  let result = "";
  for (let i = 0; i < randomValues.length; i++) {
    const idx = randomValues[i] % charset.length;
    result += charset.charAt(idx);
  }
  return result;
}


function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  let base64 = btoa(binary);

  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


async function sha256ToBase64Url(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(hashBuffer);
}


export async function createPkcePair() {
  const codeVerifier = randomString(64); // tamanho comum e seguro
  const codeChallenge = await sha256ToBase64Url(codeVerifier);

  return { codeVerifier, codeChallenge };
}


export function generateState() {
  return randomString(32);
}
