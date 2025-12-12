# Trabalho 1 de Segurança

Aplicação web em JavaScript puro que demonstra o fluxo OAuth 2.0 Authorization Code com PKCE usando a API do Spotify

🔗 **Demo (GitHub Pages):**  
https://erlenesantos.github.io/trab1-security/

## Estrutura do projeto

- `index.html` – única página da SPA (tela inicial, loading e dashboard)
- `css/app.css` – estilos e layout
- `js/security.js` – geração de PKCE (`code_verifier` / `code_challenge`) e `state`
- `js/oauth-flow.js` – fluxo OAuth (login, callback, troca de código por token, sessão e logout)
- `js/spotify-client.js` – chamadas à Web API do Spotify
- `js/ui-dashboard.js` – lógica da interface (Viewer/Manager, logs, mensagens)
- `.github/workflows/deploy.yml` – deploy automático para o GitHub Pages (gera `env.js` com o `SPOTIFY_CLIENT_ID`)
