<div align="center">

# 7–0 · World Cup Dream Team

**Draft legends across eras. Survive seven matches. Close it out 7–0.**

A fan-made clone of the viral browser game **[Sete a Zero (7a0)](https://7a0.com.br)** — roll real World Cup squads, draft an XI into a formation, then watch a live 7-match tournament play out. Win all seven unbeaten and you close it **7–0**.

[![CI](https://github.com/ar-nav0110/dream-xi-6e0c81/actions/workflows/ci.yml/badge.svg)](https://github.com/ar-nav0110/dream-xi-6e0c81/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Deploy: GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-2ea44f?logo=github)](https://ar-nav0110.github.io/dream-xi-6e0c81/)
[![Squads](https://img.shields.io/badge/squads-57-blue)](data.js)
[![PWA](https://img.shields.io/badge/PWA-installable-5a3fff)](manifest.json)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](#)
[![Made with](https://img.shields.io/badge/made%20with-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-orange)](#)

**▶ [Play it](https://ar-nav0110.github.io/dream-xi-6e0c81/)** &nbsp;·&nbsp; unlisted, link-only

</div>

---

## Gameplay

1. **Set up** — pick a formation (8 options), a tactical style (Defensive / Balanced / Attacking), and a mode:
   - **Classic** — player ratings shown.
   - **Almanac** — ratings hidden; pure World-Cup memory.
2. **Draft (11 rolls)** — each roll deals one real national squad (country + World Cup year). Take **one** player and place him in a compatible slot. A new squad is dealt for the next slot. Eleven rolls fill the XI.
3. **Swaps** — don't like the squad you rolled? Use a **swap** to change the country or year. **3 per run**, and they don't cost a pick.
4. **Position fit** — each slot only accepts compatible positions. Out-of-position players (`~`) lose rating; a #10 can't play fullback, only a keeper goes in goal.
5. **Simulate** — a live 7-match run plays out (3 group + Round of 16, QF, SF, Final): ticking 0'–90' clock, commentary feed (goals with real scorers, cards, chances), penalty shootouts.
6. **7–0** — win all seven and you've built a flawless dream team — the rarest, most shareable result. Stats (perfect runs, streak, best) save locally.

## Features

- **11-roll draft** across **57** real World Cup squads (1950–2026), with position eligibility (out-of-position `~` penalty) and **3 swaps**.
- **Difficulty** (Easy / Normal / Hard) shifts the whole opponent curve.
- **Chemistry** — same-nation / same-era links boost your XI (shown live in the OVR strip).
- **Classic / Almanac** modes (Almanac hides ratings; revealed on the result screen).
- **Live match sim** — 90' clock, commentary, cards, penalty shootouts, 3D parallax pitch.
- **Share** your run as a **generated image** (or text), plus **achievements**, **run history**, and saved stats.
- **Sound FX** (synth, mutable) and **installable PWA** (offline-capable).

## Tech

Pure static **HTML + CSS + vanilla JavaScript**. No build step, no framework, no backend, **zero dependencies**. Deploys to GitHub Pages as-is.

| File | Role |
|------|------|
| [`index.html`](index.html) | Markup: setup → draft → live sim → result screens |
| [`styles.css`](styles.css) | "Stadium Nocturne" theme — pitch, tokens, live scoreboard, responsive |
| [`game.js`](game.js) | Draft engine, position eligibility, tuned match-sim, tournament, stats |
| [`data.js`](data.js) | **48 national squads** (real players + positions + ratings), 8 formations, position metadata |
| [`tools/validate.js`](tools/validate.js) | CI data-integrity checks |

### How the match sim works

A tuned model decides each result from your XI's attack/defense (blended from line ratings + style), versus a rising opponent curve across the 7 rounds, with a per-match upset floor. Knockouts level at 90' go to penalties (which **advance you but count as a draw** — so a perfect **7–0** means seven wins in normal time). The on-screen 90-minute playout is theatre over that predetermined result. Calibrated so a flawless elite build hits 7–0 roughly half the time and weaker squads rarely do.

### Squad data

48 hand-curated national-team squads spanning **1950–2026** (Brazil 1958/1970/1982/2002, Argentina 1986/2022, France 1998/2018, Italy 1982/2006, Netherlands 1974, Hungary 1954, Morocco 2022, and more). Player names and positions are sourced from public records (Wikipedia World Cup squad pages); ratings are an author judgment on a consistent era-relative scale (74–99). For identification / historical reference only.

## Run locally

```bash
git clone https://github.com/ar-nav0110/dream-xi-6e0c81.git
cd dream-xi-6e0c81
python3 -m http.server 8000   # → http://localhost:8000
```

Or just open `index.html` in a browser.

## Deploy (link-only)

GitHub Pages on `*.github.io` is **public by URL** — there is no free server-side gate. "Link-only" here means: a non-obvious repo name, `robots: noindex`, and you only share the link with people you choose. See [SECURITY.md](SECURITY.md) for the full posture.

Settings → Pages → Source: `Deploy from a branch` → `main` / `/ (root)`.

## Tweak it

- **Add squads / players** → edit the `SQUADS` array in [`data.js`](data.js) (`{ n: name, p: position, r: rating }`). Run `node tools/validate.js` to check.
- **Difficulty** → `ROUNDS` opponent strengths in [`game.js`](game.js).
- **Sim pacing** → `MATCH_MS` in [`game.js`](game.js) (default 13000 ms ≈ 90').
- **Position rules** → `PLAYABLE` map in [`game.js`](game.js).

## License

[MIT](LICENSE). Unofficial, non-commercial fan tribute to *Sete a Zero* — not affiliated with or endorsed by the original. Trademarks belong to their respective owners.
