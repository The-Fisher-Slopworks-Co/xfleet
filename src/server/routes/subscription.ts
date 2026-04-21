// src/server/routes/subscription.ts
import * as Users from "../../db/users";
import * as Configs from "../../db/configs";
import * as ExtSubLinks from "../../db/extSubLinks";
import { text } from "../http";
import type { Env } from "../env";

const IOS_URL = "https://apps.apple.com/en/app/v2raytun/id6476628951";
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.v2raytun.android";

function isBrowser(userAgent: string | null): boolean {
  return !!userAgent && userAgent.startsWith("Mozilla/");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function installPage(subUrl: string, username: string): string {
  const url = escapeHtml(subUrl);
  const user = escapeHtml(username);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>xfleet // install v2RayTun</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap">
<style>
  :root {
    --bg: oklch(0.12 0.02 155);
    --fg: oklch(0.88 0.18 155);
    --fg-dim: oklch(0.55 0.10 155);
    --fg-bright: oklch(0.88 0.22 155);
    --border: oklch(0.36 0.08 155 / 0.35);
    --primary: oklch(0.88 0.22 155);
    --panel: oklch(0.14 0.03 155);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
  body {
    font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-feature-settings: "calt" 1, "liga" 1;
    min-height: 100vh;
    font-size: 14px;
    line-height: 1.55;
  }
  body::after {
    content: "";
    position: fixed; inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0, 255, 159, 0.05) 3px);
    opacity: 0.4;
    z-index: 9999;
  }
  .hdr {
    border-bottom: 1px solid var(--border);
    padding: 8px 16px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13px;
  }
  .hdr .prompt { color: var(--primary); }
  .hdr .prompt .u { color: var(--fg-dim); }
  .caret::after {
    content: "▌";
    margin-left: 2px;
    animation: blink 1s step-end infinite;
  }
  @keyframes blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
  @media (prefers-reduced-motion) { .caret::after { animation: none; } }
  main { max-width: 760px; margin: 0 auto; padding: 32px 24px 64px; }
  .cmd { color: var(--fg-bright); font-weight: 500; font-size: 18px; margin: 0 0 24px; }
  .cmd .sigil { color: var(--primary); }
  section { border: 1px solid var(--border); padding: 20px 24px; margin-bottom: 20px; background: var(--panel); }
  section .tag { display: inline-block; color: var(--fg-dim); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }
  h2 { color: var(--primary); margin: 0 0 14px; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; }
  ol { padding-left: 22px; margin: 0; }
  li { margin-bottom: 10px; }
  li::marker { color: var(--fg-dim); }
  .btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  a.btn, button.btn {
    display: inline-block;
    border: 1px solid var(--border);
    padding: 6px 12px;
    color: var(--primary);
    background: transparent;
    text-decoration: none;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s, box-shadow 0.12s;
  }
  a.btn:hover, button.btn:hover {
    border-color: var(--primary);
    color: var(--fg-bright);
    box-shadow: 0 0 12px -2px var(--primary);
  }
  button.btn.active {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--bg);
    font-weight: 700;
    box-shadow: 0 0 14px -2px var(--primary);
  }
  button.btn.active:hover { color: var(--bg); }
  code.url {
    display: block;
    border: 1px dashed var(--border);
    padding: 10px 12px;
    margin-top: 6px;
    color: var(--fg-bright);
    word-break: break-all;
    font-size: 13px;
    background: rgba(0, 0, 0, 0.3);
    user-select: all;
  }
  kbd {
    display: inline-block;
    border: 1px solid var(--border);
    padding: 1px 6px;
    font: inherit;
    font-size: 12px;
    color: var(--fg-bright);
    background: rgba(0, 0, 0, 0.3);
  }
  .arrow { color: var(--fg-dim); }
  .lang-bar {
    display: flex; align-items: center; gap: 10px;
    border: 1px solid var(--border);
    padding: 10px 14px;
    margin-bottom: 20px;
    background: var(--panel);
  }
  .lang-bar .lbl { color: var(--fg-dim); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
  .lang-bar .spacer { flex: 1; }
  .lang-bar button.btn { padding: 8px 16px; font-size: 14px; letter-spacing: 0.04em; }
  section[hidden] { display: none; }
  ::selection { background: rgba(110, 255, 160, 0.35); color: var(--bg); }
</style>
</head>
<body>
  <header class="hdr">
    <div class="prompt"><span class="u">${user}@xfleet:</span>~/sub<span class="caret"></span></div>
    <div class="prompt">[ v2raytun ]</div>
  </header>
  <main>
    <h1 class="cmd"><span class="sigil">$</span> install v2raytun</h1>

    <div class="lang-bar" role="group" aria-label="language">
      <span class="lbl">// language</span>
      <span class="arrow">→</span>
      <button class="btn active" data-lang="ru" type="button">[ RU · Русский ]</button>
      <button class="btn" data-lang="en" type="button">[ EN · English ]</button>
    </div>

    <section lang="ru" data-section="ru">
      <span class="tag">// ru</span>
      <h2>установка v2RayTun</h2>
      <ol>
        <li>Установите приложение:
          <div class="btns">
            <a class="btn" href="${IOS_URL}">[ iOS · App Store ]</a>
            <a class="btn" href="${ANDROID_URL}">[ Android · Google Play ]</a>
          </div>
        </li>
        <li>Скопируйте ссылку:<code class="url">${url}</code></li>
        <li>Откройте приложение v2RayTun.</li>
        <li>Нажмите <kbd>+</kbd> в правом верхнем углу.</li>
        <li>Выберите <b>«Импорт из буфера обмена»</b>.</li>
      </ol>
    </section>

    <section lang="en" data-section="en" hidden>
      <span class="tag">// en</span>
      <h2>install v2RayTun</h2>
      <ol>
        <li>Install the app:
          <div class="btns">
            <a class="btn" href="${IOS_URL}">[ iOS · App Store ]</a>
            <a class="btn" href="${ANDROID_URL}">[ Android · Google Play ]</a>
          </div>
        </li>
        <li>Copy the link:<code class="url">${url}</code></li>
        <li>Open the v2RayTun app.</li>
        <li>Tap <kbd>+</kbd> in the top-right corner.</li>
        <li>Choose <b>"Import config from Clipboard"</b>.</li>
      </ol>
    </section>
  </main>
  <script>
    (function () {
      var btns = document.querySelectorAll('[data-lang]');
      var secs = document.querySelectorAll('[data-section]');
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          var lang = b.getAttribute('data-lang');
          btns.forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-lang') === lang); });
          secs.forEach(function (s) { s.hidden = s.getAttribute('data-section') !== lang; });
          document.documentElement.lang = lang;
        });
      });
    })();
  </script>
</body>
</html>
`;
}

export function subscriptionRoutes(env: Env) {
  return {
    "/sub/:token": {
      async GET(req: Request & { params: { token: string } }) {
        const user = await Users.getByToken(req.params.token);
        if (!user) return new Response("", { status: 404, headers: { "content-type": "text/plain" } });
        if (isBrowser(req.headers.get("user-agent"))) {
          const subUrl = `${env.publicBaseUrl}/sub/${req.params.token}`;
          return new Response(installPage(subUrl, user.username), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        const [configs, extLinks] = await Promise.all([
          Configs.listForUser(user.id),
          ExtSubLinks.listForUser(user.id),
        ]);
        const configLines = configs.map(c => {
          const base = `${c.config}#${c.server.name}`;
          return c.tag ? `${base}%20${encodeURIComponent(c.tag)}` : base;
        });
        const extLines = extLinks.map(l => {
          const fragment = l.label ? `${l.source_name} · ${l.label}` : l.source_name;
          return `${l.uri}#${encodeURIComponent(fragment)}`;
        });
        const body = [...configLines, ...extLines].join("\n");
        const title = `${env.profileTitle} - ${user.username}`;
        const headers = { "profile-title": `base64:${Buffer.from(title).toString("base64")}` };
        return text(body, { headers });
      },
    },
  };
}
