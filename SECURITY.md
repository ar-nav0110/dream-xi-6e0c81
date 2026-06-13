# Security Policy

## Overview

**7–0 Dream Team** is a 100% client-side static website (HTML + CSS + vanilla
JavaScript). It has **no backend, no database, no accounts, no API keys, and
makes no network requests** other than loading Google Fonts. All game state
(stats, streaks) is stored locally in the visitor's browser via
`localStorage`. There is no server to attack and no user data leaves the
device.

## Threat model & assessment

| Area | Assessment |
|------|-----------|
| **XSS (cross-site scripting)** | Low. The only data rendered into the DOM (player names, country names, ratings) is **hard-coded by the author** in `data.js` — there is no user-supplied free text. The only user inputs are three `<select>` dropdowns whose values are used as enum keys / parsed integers, never written to HTML. |
| **Injection / RCE** | None. No `eval`, no `Function()`, no `innerHTML` of dynamic user input, no template execution, no server. |
| **Data exposure** | None. No secrets, tokens, or credentials exist in the repo. No analytics or third-party trackers. |
| **Network / SSRF / CSRF** | None. `connect-src 'none'` — the app issues no `fetch`/XHR/WebSocket calls. There are no state-changing server requests. |
| **Clickjacking** | Mitigated via CSP `frame-ancestors 'none'`. |
| **Dependency supply chain** | Zero npm/runtime dependencies. Only external asset is Google Fonts (CSS + woff2), pinned in CSP to `fonts.googleapis.com` / `fonts.gstatic.com`. |
| **localStorage tampering** | A visitor can edit their own local stats; this only affects their own cosmetic counters and is parsed inside a `try/catch`. No trust is placed in stored values. |

## Hardening in place

- **Content-Security-Policy** (meta tag in `index.html`):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
  https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data:; connect-src 'none'; base-uri 'none';
  form-action 'none'; frame-ancestors 'none'; object-src 'none'`
  - `script-src 'self'` — no inline or remote scripts permitted.
  - `connect-src 'none'` — no data can be exfiltrated over the network.
- `referrer: no-referrer`.
- `robots: noindex, nofollow` — unlisted, not indexed by search engines.
- HTTPS enforced by GitHub Pages.
- MIT licensed; no telemetry.

> Note: `style-src` allows `'unsafe-inline'` because the UI sets element style
> properties (e.g. progress-bar width, token positions) from JavaScript. No
> inline `<script>` is allowed, which is the higher-risk vector.

## Reporting a vulnerability

This is a personal, non-commercial fan project. If you find a security issue,
please open a private report via the repository's **Security → Report a
vulnerability** tab (GitHub Security Advisories), or open an issue without
exploit details. There is no bounty.

## Scope notes

GitHub Pages on a `*.github.io` subdomain is **public by URL**. "Link-only"
here means the URL is unlisted and not indexed — it is not an authentication
boundary. Do not treat the site as private or place sensitive data in it.
