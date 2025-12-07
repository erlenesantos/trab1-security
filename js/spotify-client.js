
const ACCESS_TOKEN_KEY = "spotify_access_token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

function getAccessToken() {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    throw new Error(
      "Nenhum access_token encontrado. É necessário autenticar antes de chamar a API."
    );
  }
  return token;
}

function buildAuthHeaders() {
  const token = getAccessToken();
  return {
    Authorization: `Bearer ${token}`
  };
}


async function requestJson(method, endpoint, body = null) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${SPOTIFY_API_BASE}${endpoint}`;

  const headers = buildAuthHeaders();
  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const options = {
    method,
    headers
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    let rawText = "";
    try {
      rawText = await response.text();
    } catch {
      rawText = "";
    }

    let json = null;
    if (rawText) {
      try {
        json = JSON.parse(rawText);
      } catch {
        // Se não for json, ignora (json fica null mesmo)
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
      rawText: rawText || null
    };
  } catch (err) {
    console.error("Erro de rede ao chamar a API do Spotify:", err);
    return {
      ok: false,
      status: 0,
      json: null,
      rawText: String(err?.message || err)
    };
  }
}

// Funções usadas pela dashboard

export async function getPlayerStatus() {
  return requestJson("GET", "/me/player");
}

export async function getCurrentTrack() {
  return requestJson("GET", "/me/player/currently-playing");
}

export async function startPlayback() {
  // Sem body: retoma o que estava tocando
  return requestJson("PUT", "/me/player/play", null);
}

export async function pausePlayback() {
  return requestJson("PUT", "/me/player/pause");
}

export async function skipToNextTrack() {
  return requestJson("POST", "/me/player/next");
}
