
import {
  getPlayerStatus,
  getCurrentTrack,
  startPlayback,
  pausePlayback,
  skipToNextTrack
} from "./spotify-client.js";


function limparSessaoEForcarRelogin() {
  const keys = [
    "spotify_access_token",
    "spotify_granted_scope",
    "spotify_login_mode",
    "spotify_pkce_verifier",
    "spotify_auth_state"
  ];

  keys.forEach((k) => sessionStorage.removeItem(k));

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  window.location.href = url.toString();
}


function appendLog(message) {
  const logEl = document.getElementById("log-area");
  if (!logEl) return;

  const now = new Date();
  const timestamp = now.toLocaleTimeString("pt-BR", { hour12: false });

  const current = logEl.textContent || "";
  const formatted = `[${timestamp}] ${message}`.trim();

  logEl.textContent = current
    ? current.replace(/\s+$/g, "") + "\n" + formatted + "\n"
    : formatted + "\n";
}


function handleApiFailure(endpointLabel, result) {
  const status = result?.status;
  let base = `Falha ao chamar ${endpointLabel}.`;

  if (status) {
    base += ` Status HTTP: ${status}.`;
  }

  if (status === 401) {
    base +=
      " Possível token inválido ou expirado. Tente refazer o login no Spotify.";
  } else if (status === 403) {
    base +=
      " Acesso negado (403). Talvez este usuário não tenha o escopo necessário, não tenha um player ativo ou não seja usuário Premium.";
  } else if (status === 404) {
    base +=
      " Recurso não encontrado (404). Em APIs de player isso costuma indicar ausência de dispositivo ativo.";
  } else if (status === 0) {
    base +=
      " Erro de rede (status 0). Verifique sua conexão ou bloqueios de extensões.";
  }

  appendLog(base);

  if (result?.json?.error?.message) {
    appendLog("Detalhes retornados pelo Spotify:");
    appendLog(result.json.error.message);
  } else if (result?.rawText) {
    appendLog("Resposta bruta do Spotify:");
    appendLog(result.rawText);
  }

  // Comportamento para 401: força relogin
  if (status === 401) {
    alert(base + "\n\nVocê será redirecionado para fazer login novamente.");
    limparSessaoEForcarRelogin();
    return;
  }

  alert(base);
}

 //Determina o texto de "modo" com base no escopo concedido.

function computeModeFromScope(scopeString, fallbackMode) {
  const scope = scopeString || "";

  const hasRead = scope.includes("user-read-playback-state");
  const hasControl = scope.includes("user-modify-playback-state");

  if (hasControl) return "Modo Controle (Manager)";
  if (hasRead) return "Modo Leitura (Viewer)";

  // fallback para algum modo que o oauth-flow tenha guardado
  if (fallbackMode === "manager") return "Modo Controle (Manager)";
  if (fallbackMode === "viewer") return "Modo Leitura (Viewer)";

  return "Modo não identificado (escopos insuficientes)";
}


function configurarVisibilidadePorEscopo(scopeString) {
  const scope = scopeString || "";
  const viewerArea = document.getElementById("viewer-area");
  const managerArea = document.getElementById("manager-area");

  const hasRead = scope.includes("user-read-playback-state");
  const hasControl = scope.includes("user-modify-playback-state");

  if (viewerArea) {
    viewerArea.classList.toggle("hidden", !hasRead);
  }
  if (managerArea) {
    managerArea.classList.toggle("hidden", !hasControl);
  }
}


function formatPlayerStatus(data) {
  if (!data) {
    return "Nenhuma informação de player disponível.";
  }

  const device = data.device || {};
  const track = data.item || {};

  const linhas = [];

  linhas.push("=== Dispositivo ===");
  linhas.push(`Nome:    ${device.name || "N/D"}`);
  linhas.push(`Tipo:    ${device.type || "N/D"}`);
  linhas.push(`Ativo:   ${device.is_active ? "Sim" : "Não"}`);
  if (typeof device.volume_percent === "number") {
    linhas.push(`Volume:  ${device.volume_percent}%`);
  }

  linhas.push("");
  linhas.push("=== Reprodução ===");
  linhas.push(`Tocando: ${data.is_playing ? "Sim" : "Não"}`);

  if (track && track.name) {
    const artistas = (track.artists || []).map((a) => a.name).join(", ");
    linhas.push("");
    linhas.push("=== Faixa atual ===");
    linhas.push(`Nome:    ${track.name}`);
    linhas.push(`Artista: ${artistas || "N/D"}`);
    linhas.push(`Álbum:   ${track.album?.name || "N/D"}`);
  }

  return linhas.join("\n");
}


function formatCurrentTrack(data) {
  if (!data || !data.item) {
    return "Nenhuma faixa em reprodução no momento.";
  }

  const track = data.item;
  const artistas = (track.artists || []).map((a) => a.name).join(", ");
  const duracaoSeg = Math.floor(track.duration_ms / 1000);
  const posicaoSeg = Math.floor((data.progress_ms || 0) / 1000);

  const linhas = [];
  linhas.push(`Música:   ${track.name || "N/D"}`);
  linhas.push(`Artista:  ${artistas || "N/D"}`);
  linhas.push(`Álbum:    ${track.album?.name || "N/D"}`);
  linhas.push("");
  linhas.push(`Duração:  ${duracaoSeg}s`);
  linhas.push(`Progresso:${posicaoSeg}s`);
  linhas.push("");
  linhas.push(`Tocando:  ${data.is_playing ? "Sim" : "Não"}`);

  if (track.preview_url) {
    linhas.push("");
    linhas.push(`Preview:  ${track.preview_url}`);
  }

  return linhas.join("\n");
}

 // Configura os handlers dos botões do dashboard, ehchamada toda vez que a dashboard é montada.
function bindDashboardButtons() {
  const btnFetchPlayer = document.getElementById("btn-fetch-player");
  const btnCurrentTrack = document.getElementById("btn-current-track");
  const btnPlay = document.getElementById("btn-play");
  const btnPause = document.getElementById("btn-pause");
  const btnNext = document.getElementById("btn-next");

  // Status geral do player
  if (btnFetchPlayer) {
    btnFetchPlayer.onclick = async () => {
      appendLog("Solicitando status do player ao Spotify…");
      try {
        const result = await getPlayerStatus();
        if (!result.ok) {
          return handleApiFailure("GET /me/player", result);
        }
        const formatted = formatPlayerStatus(result.json);
        const pre = document.getElementById("player-info");
        if (pre) pre.textContent = formatted;
        appendLog("Status do player atualizado com sucesso.");
      } catch (err) {
        console.error(err);
        alert("Erro inesperado ao consultar o player.");
        appendLog("Erro inesperado ao consultar o player.");
      }
    };
  }

  // Faixa atual (Viewer)
  if (btnCurrentTrack) {
    btnCurrentTrack.onclick = async () => {
      appendLog("Consultando faixa em reprodução…");
      try {
        const result = await getCurrentTrack();
        if (!result.ok) {
          return handleApiFailure("GET /me/player/currently-playing", result);
        }
        const formatted = formatCurrentTrack(result.json);
        const pre = document.getElementById("current-track");
        if (pre) pre.textContent = formatted;
        appendLog("Informações da faixa atual atualizadas.");
      } catch (err) {
        console.error(err);
        alert("Erro inesperado ao consultar a faixa atual.");
        appendLog("Erro inesperado ao consultar a faixa atual.");
      }
    };
  }

  // Controles (Manager)
  if (btnPlay) {
    btnPlay.onclick = async () => {
      appendLog("Enviando comando de play/retomar reprodução…");
      try {
        const result = await startPlayback();
        if (!result.ok) {
          return handleApiFailure("PUT /me/player/play", result);
        }
        appendLog("Comando de play enviado com sucesso.");
        alert("Reprodução iniciada/retomada (se houver dispositivo ativo).");
      } catch (err) {
        console.error(err);
        alert("Erro inesperado ao enviar comando de play.");
        appendLog("Erro inesperado ao enviar comando de play.");
      }
    };
  }

  if (btnPause) {
    btnPause.onclick = async () => {
      appendLog("Enviando comando de pause…");
      try {
        const result = await pausePlayback();
        if (!result.ok) {
          return handleApiFailure("PUT /me/player/pause", result);
        }
        appendLog("Comando de pause enviado com sucesso.");
        alert("Reprodução pausada (se houver dispositivo ativo).");
      } catch (err) {
        console.error(err);
        alert("Erro inesperado ao enviar comando de pause.");
        appendLog("Erro inesperado ao enviar comando de pause.");
      }
    };
  }

  if (btnNext) {
    btnNext.onclick = async () => {
      appendLog("Enviando comando para próxima faixa…");
      try {
        const result = await skipToNextTrack();
        if (!result.ok) {
          return handleApiFailure("POST /me/player/next", result);
        }
        appendLog("Comando de próxima faixa enviado com sucesso.");
        alert("Avançou para a próxima faixa (se houver dispositivo ativo).");
      } catch (err) {
        console.error(err);
        alert("Erro inesperado ao enviar comando de próxima faixa.");
        appendLog("Erro inesperado ao enviar comando de próxima faixa.");
      }
    }; 
  }
}
// Função principal chamada pelo oauth-flow.js, após a autenticação ou quando há sessão ativa.
export function setupDashboard({ accessToken, scope, loginMode }) {
  // Atualiza textos básicos
  const modeLabel = document.getElementById("granted-mode");
  const scopesLabel = document.getElementById("granted-scopes");

  if (modeLabel) {
    modeLabel.textContent = computeModeFromScope(scope, loginMode);
  }

  if (scopesLabel) {
    scopesLabel.textContent = scope
      ? `Escopos concedidos: ${scope}`
      : "Nenhum escopo informado pelo provedor.";
  }

  configurarVisibilidadePorEscopo(scope);

  bindDashboardButtons();

  appendLog("Dashboard inicializada. Pronto para interagir com a API do Spotify.");
  appendLog(`Modo atual: ${computeModeFromScope(scope, loginMode)}.`);
}
