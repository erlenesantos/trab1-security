
import { createPkcePair, generateState } from "./security.js";
import { setupDashboard } from "./ui-dashboard.js";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

const STORAGE = {
  verifier: "spotify_pkce_verifier",
  state: "spotify_auth_state",
  accessToken: "spotify_access_token",
  scope: "spotify_granted_scope",
  loginMode: "spotify_login_mode" 
};


function showView(viewId) {
  const views = ["view-welcome", "view-loading", "view-dashboard"];
  views.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === viewId) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}



 //Atualiza o badge de status na topbar
function setAuthStatus(text, type = "default") {
  const badge = document.getElementById("auth-status");
  const dot = document.getElementById("auth-status-dot");
  const textSpan = document.getElementById("auth-status-text");

  if (!badge) return;

  if (textSpan) {
    textSpan.textContent = text.toUpperCase();
  } else {
    badge.textContent = text.toUpperCase();
  }

  if (type === "authenticated") {
    badge.style.background = "rgba(22, 163, 74, 0.16)";
    badge.style.borderColor = "#16a34a";
    if (dot) {
      dot.style.backgroundColor = "#22c55e"; // verde
    }
  } else {
    badge.style.background = "rgba(15, 118, 110, 0.16)";
    badge.style.borderColor = "#374151";
    if (dot) {
      dot.style.backgroundColor = "#9ca3af"; 
    }
  }
}



function limparParametrosDaUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, document.title, url.toString());
}

function obterRedirectUri() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}


async function iniciarAutenticacao(loginMode) {
  if (!window.SPOTIFY_CLIENT_ID) {
    alert(
      "CLIENT_ID do Spotify não encontrado.\n" +
        "Verifique se o arquivo env.js foi gerado corretamente pelo GitHub Actions."
    );
    return;
  }

  try {
    const { codeVerifier, codeChallenge } = await createPkcePair();

    const state = generateState();

    let scope = "user-read-playback-state";
    if (loginMode === "manager") {
      scope = "user-read-playback-state user-modify-playback-state";
    }

    sessionStorage.setItem(STORAGE.verifier, codeVerifier);
    sessionStorage.setItem(STORAGE.state, state);
    sessionStorage.setItem(STORAGE.loginMode, loginMode);

    const redirectUri = obterRedirectUri();

    const params = new URLSearchParams({
      response_type: "code",
      client_id: window.SPOTIFY_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: scope,
      state: state,
      code_challenge_method: "S256",
      code_challenge: codeChallenge
    });

    window.location.href = `${AUTH_URL}?${params.toString()}`;
  } catch (err) {
    console.error("Erro ao iniciar autenticação:", err);
    alert("Não foi possível iniciar o processo de autenticação.");
  }
}





async function processarCallbackOAuth(code, returnedState) {
  const savedState = sessionStorage.getItem(STORAGE.state);
  const codeVerifier = sessionStorage.getItem(STORAGE.verifier);

  if (!codeVerifier || !savedState) {
    alert(
      "Dados de sessão ausentes.\n" +
        "Talvez o navegador tenha limpado o storage ou a aba foi fechada no meio do login."
    );
    showView("view-welcome");
    setAuthStatus("Desconectado");
    limparParametrosDaUrl();
    return;
  }

  if (savedState !== returnedState) {
    sessionStorage.removeItem(STORAGE.state);
    sessionStorage.removeItem(STORAGE.verifier);
    alert(
      "State inválido recebido do provedor.\n" +
        "Por segurança, o fluxo de login foi cancelado."
    );
    showView("view-welcome");
    setAuthStatus("Desconectado");
    limparParametrosDaUrl();
    return;
  }

  const redirectUri = obterRedirectUri();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: window.SPOTIFY_CLIENT_ID,
    code_verifier: codeVerifier
  });

  try {
    showView("view-loading");
    setAuthStatus("Conectando…");

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Falha ao trocar código por token:", response.status, text);
      alert(
        "Falha ao concluir autenticação com o Spotify.\n" +
          "Verifique a configuração do aplicativo e tente novamente."
      );
      showView("view-welcome");
      setAuthStatus("Desconectado");
      limparParametrosDaUrl();
      return;
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error("Resposta sem access_token:", data);
      alert("Resposta inesperada do servidor de token do Spotify.");
      showView("view-welcome");
      setAuthStatus("Desconectado");
      limparParametrosDaUrl();
      return;
    }

    sessionStorage.setItem(STORAGE.accessToken, data.access_token);
    if (data.scope) {
      sessionStorage.setItem(STORAGE.scope, data.scope);
    }

    sessionStorage.removeItem(STORAGE.verifier);
    sessionStorage.removeItem(STORAGE.state);

    limparParametrosDaUrl();

    setAuthStatus("Autenticado", "authenticated");
    showView("view-dashboard");
    setupDashboard({
      accessToken: data.access_token,
      scope: data.scope || "",
      loginMode: sessionStorage.getItem(STORAGE.loginMode) || "desconhecido"
    });
  } catch (err) {
    console.error("Erro ao processar callback OAuth:", err);
    alert("Ocorreu um erro inesperado ao concluir a autenticação.");
    showView("view-welcome");
    setAuthStatus("Desconectado");
    limparParametrosDaUrl();
  }
}


function existeSessaoAtiva() {
  const token = sessionStorage.getItem(STORAGE.accessToken);
  return Boolean(token);
}

function limparSessao() {
  Object.values(STORAGE).forEach((key) => {
    sessionStorage.removeItem(key);
  });
}


function logoutRemotoSpotify() {
  const logoutUrl = "https://accounts.spotify.com/en/logout";

  const popup = window.open(
    logoutUrl,
    "spotifyLogout",
    "width=700,height=500,top=40,left=40"
  );

  if (!popup) return;

  setTimeout(() => {
    try {
      popup.close();
    } catch (e) {
    }
  }, 2000);
}

function configurarLogout() {
  const btnLogout = document.getElementById("btn-logout");
  if (!btnLogout) return;

  btnLogout.addEventListener("click", () => {
    limparSessao();
    showView("view-welcome");
    setAuthStatus("Desconectado");

    logoutRemotoSpotify();
  });
}



function inicializar() {
  configurarLogout();

  const btnViewer = document.getElementById("btn-login-viewer");
  const btnManager = document.getElementById("btn-login-manager");

  if (btnViewer) {
    btnViewer.addEventListener("click", () => iniciarAutenticacao("viewer"));
  }
  if (btnManager) {
    btnManager.addEventListener("click", () => iniciarAutenticacao("manager"));
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  // Caso o usuário tenha negado permissão no Spotify
  if (error) {
    console.warn("Erro retornado pelo Spotify:", error);
    alert(
      "O Spotify retornou um erro: " +
        error +
        "\nSe você cancelou o login, basta tentar novamente."
    );
    limparParametrosDaUrl();
    showView("view-welcome");
    setAuthStatus("Desconectado");
    return;
  }

  // Se há code+state, estamos no callback do OAuth
  if (code && state) {
    processarCallbackOAuth(code, state);
    return;
  }

  // Sem code na url, ou é acesso inicial ou recarregamento
  if (existeSessaoAtiva()) {
    const token = sessionStorage.getItem(STORAGE.accessToken) || "";
    const scope = sessionStorage.getItem(STORAGE.scope) || "";
    const loginMode = sessionStorage.getItem(STORAGE.loginMode) || "desconhecido";

    setAuthStatus("Autenticado", "authenticated");
    showView("view-dashboard");
    setupDashboard({ accessToken: token, scope, loginMode });
  } else {
    showView("view-welcome");
    setAuthStatus("Desconectado");
  }
}

inicializar();
