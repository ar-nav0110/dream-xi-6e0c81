# 7–0 · World Cup Dream Team

A fan-made clone of **Sete a Zero (7a0)** — roll real World Cup squads, draft an XI across eras, set a formation + tactic, then simulate 7 matches. Win all seven unbeaten and you close it **7–0**.

Pure static site — HTML/CSS/JS, no build step, no backend, no accounts. Stats save in the browser (`localStorage`).

## Files
- `index.html` — screens (draw → build → sim → result)
- `styles.css` — pitch + UI, mobile-responsive
- `game.js` — draft loop, out-of-position penalty, match sim, tournament, stats, share
- `data.js` — 29 legendary national squads + 8 formations + position metadata

## Play locally
Open `index.html` in a browser. Or serve it:
```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy to GitHub Pages (link-only)

> GitHub Pages on `*.github.io` is **public by URL** — anyone with the link can open it. There is no free server-side login. "Link-only" here = unlisted: hard-to-guess repo name, not indexed (the page already sends `<meta name="robots" content="noindex,nofollow">`), and you only share the link with people you choose.

1. Create a **new GitHub repo** with a non-obvious name, e.g. `dt-7x0-a9f3`. Keep it **public** (Pages needs public on free tier) — obscurity is the privacy here.
2. Push these files to the repo root:
   ```bash
   git init
   git add .
   git commit -m "7-0 dream team game"
   git branch -M main
   git remote add origin https://github.com/<you>/dt-7x0-a9f3.git
   git push -u origin main
   ```
3. Repo **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / `/ (root)` → Save.
4. Wait ~1 min. Your link: `https://<you>.github.io/dt-7x0-a9f3/`
5. Share that link only with players you want.

### Want a real password gate instead?
Plain GitHub Pages can't truly gate access (all files are downloadable). A client-side passcode only deters casual visitors. For genuine access control, host on **Cloudflare Pages** (free) and add **Cloudflare Access**, or use Netlify/Vercel password protection. Ask and I'll wire one up.

## Tweak the game
- **Add squads / players** → edit the `SQUADS` array in `data.js` (`{ n: name, p: position, r: rating }`).
- **Difficulty** → `ROUNDS` strengths in `game.js` (higher = harder, rarer 7–0).
- **Position penalties** → `penalty()` in `game.js`.
