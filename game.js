/* ============================================================
   game.js — 7-0 World Cup Dream Team engine
   Faithful to 7a0 / Sete a Zero:
   formation + style + mode chosen first → 11 rolls, one squad per
   roll, pick exactly one player into a compatible slot → 3 swaps
   (change country / year) reroll without costing a pick → simulate
   3 group + 4 knockout matches → win all 7 unbeaten = 7-0.
   ============================================================ */
(function () {
'use strict';

const $ = (id) => document.getElementById(id);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------------- persistent stats ---------------- */
const STORE = 'sete_a_zero_stats_v1';
let stats = { sevens: 0, streak: 0, best: 0 };
try { Object.assign(stats, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) {}
function saveStats() { try { localStorage.setItem(STORE, JSON.stringify(stats)); } catch (e) {} renderStats(); }
function renderStats() {
  $('statSevens').textContent = stats.sevens;
  $('statStreak').textContent = stats.streak;
  $('statBest').textContent = stats.best;
}

/* ---------------- game state ---------------- */
const TOTAL_ROLLS = 11;
let state = {
  formationKey: '4-3-3',
  styleIdx: 1,            // 0 def / 1 bal / 2 att
  mode: 'classic',        // classic | almanac
  slots: [],              // {role,x,y, player|null}
  pool: null,             // squad dealt for the current roll
  selPool: null,          // selected pool index
  rollNow: 1,             // current roll number (1..11)
  swaps: 3,               // swaps remaining
  picks: 0,               // players placed so far
};

/* ---------------- position eligibility ----------------
   Each natural position fills its own slot (0 penalty) plus RELATED
   slots (marked ~, rating penalty). Far roles disallowed entirely —
   a #10 can't play fullback, only a keeper plays in goal. */
const PLAYABLE = {
  GK:  ['GK'],
  CB:  ['CB', 'RB', 'LB', 'DM'],
  RB:  ['RB', 'RWB', 'RM', 'CB'],
  LB:  ['LB', 'LWB', 'LM', 'CB'],
  RWB: ['RWB', 'RB', 'RM', 'RW'],
  LWB: ['LWB', 'LB', 'LM', 'LW'],
  DM:  ['DM', 'CM', 'CB'],
  CM:  ['CM', 'DM', 'CAM'],
  CAM: ['CAM', 'CM', 'RW', 'LW', 'ST'],
  RM:  ['RM', 'RW', 'RB', 'RWB', 'CM'],
  LM:  ['LM', 'LW', 'LB', 'LWB', 'CM'],
  RW:  ['RW', 'RM', 'ST', 'CAM', 'LW'],
  LW:  ['LW', 'LM', 'ST', 'CAM', 'RW'],
  ST:  ['ST', 'CF', 'CAM', 'RW', 'LW'],
  CF:  ['CF', 'ST', 'CAM'],
};
function isEligible(naturalPos, slotRole) {
  const list = PLAYABLE[naturalPos];
  return !!list && list.indexOf(slotRole) !== -1;
}

/* ---------------- position fit / penalty ---------------- */
function penalty(natural, role) {
  if (natural === role) return 0;
  const a = POS_META[natural], b = POS_META[role];
  if (!a || !b) return 0;
  const aGK = a.line === 0, bGK = b.line === 0;
  if (aGK !== bGK) return 40;
  const lineDiff = Math.abs(a.line - b.line);
  let side = 0;
  if (a.side !== b.side) side = (a.side === 'C' || b.side === 'C') ? 3 : 6;
  return lineDiff * 10 + side;
}
function effRating(player, role) {
  const pen = penalty(player.p, role);
  return { eff: Math.max(30, player.r - pen), pen };
}

/* ---------------- screen routing ---------------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

/* =====================================================
   SETUP SCREEN
   ===================================================== */
function initSetupControls() {
  const f = $('selFormation');
  f.innerHTML = Object.keys(FORMATIONS).map(k => `<option value="${k}">${k}</option>`).join('');
  f.value = state.formationKey;
  const s = $('selStyle');
  s.innerHTML = STYLES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  s.value = state.styleIdx;
  $('selMode').value = state.mode;
}
function buildSlots() {
  state.slots = FORMATIONS[state.formationKey].map(sl => ({ role: sl.role, x: sl.x, y: sl.y, player: null }));
}
function startDraft() {
  state.formationKey = $('selFormation').value;
  state.styleIdx = +$('selStyle').value;
  state.mode = $('selMode').value;
  buildSlots();
  state.picks = 0; state.rollNow = 1; state.swaps = 3; state.selPool = null;
  $('setupChip').textContent = `${state.formationKey} · ${STYLES[state.styleIdx]} · ${state.mode === 'almanac' ? 'Almanac' : 'Classic'}`;
  $('poolDone').hidden = true;
  $('poolList').hidden = false;
  $('btnSimulate').disabled = true;
  dealRoll();
  renderPitch();
  updateOverall();
  updateMeta();
  show('screen-draft');
}

/* =====================================================
   DRAFT — roll / swap / place
   ===================================================== */
function openRoles() { return state.slots.filter(s => !s.player).map(s => s.role); }
function squadFitsOpen(squad) {
  const open = openRoles();
  return squad.players.some(p => open.some(r => isEligible(p.p, r)));
}
function dealRoll() {
  // pick a squad that can fill at least one still-open slot (no dead ends)
  let sq, tries = 0;
  do { sq = rnd(SQUADS); tries++; } while (!squadFitsOpen(sq) && tries < 50);
  state.pool = sq;
  state.selPool = null;
  renderPool();
  markTargets();
}
function swapCountry() {
  if (state.swaps <= 0) return;
  const yr = state.pool.year;
  let pool = SQUADS.filter(s => s.year === yr && s.country !== state.pool.country && squadFitsOpen(s));
  if (!pool.length) pool = SQUADS.filter(s => s !== state.pool && squadFitsOpen(s));
  if (!pool.length) { toast('No other squad fits the open slots'); return; }
  state.pool = rnd(pool); state.swaps--; state.selPool = null;
  updateMeta(); renderPool(); markTargets();
}
function swapYear() {
  if (state.swaps <= 0) return;
  const ct = state.pool.country;
  let pool = SQUADS.filter(s => s.country === ct && s.year !== state.pool.year && squadFitsOpen(s));
  if (!pool.length) pool = SQUADS.filter(s => s !== state.pool && squadFitsOpen(s));
  if (!pool.length) { toast('No other squad fits the open slots'); return; }
  state.pool = rnd(pool); state.swaps--; state.selPool = null;
  updateMeta(); renderPool(); markTargets();
}
function updateMeta() {
  $('rollNow').textContent = Math.min(state.rollNow, TOTAL_ROLLS);
  $('swapsLeft').textContent = state.swaps;
  $('skipsA').textContent = state.swaps;
  $('skipsB').textContent = state.swaps;
  const none = state.swaps <= 0;
  $('btnSwapCountry').disabled = none;
  $('btnSwapYear').disabled = none;
}

/* --- pitch --- */
function shortName(n) {
  const parts = n.split(' ');
  if (parts.length === 1) return n;
  const last = parts[parts.length - 1];
  return last.length <= 12 ? last : n;
}
function renderPitch() {
  const pitch = $('pitch');
  pitch.innerHTML = '<div class="circle"></div><div class="boxN"></div><div class="boxS"></div>';
  state.slots.forEach((sl, i) => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.style.left = sl.x + '%';
    el.style.top = (100 - sl.y) + '%';
    let inner;
    if (sl.player) {
      const { eff, pen } = effRating(sl.player, sl.role);
      if (pen > 0) el.classList.add('oop');
      el.classList.add('filled');
      const mark = pen > 0 ? '<span class="oop-mark">~</span>' : '';
      const discTxt = state.mode === 'almanac' ? sl.player.p : eff;
      inner =
        `<div class="disc">${discTxt}</div>
         <div class="pname">${shortName(sl.player.n)}${mark}</div>`;
    } else {
      inner = `<div class="disc empty">${sl.role}</div>`;
    }
    el.innerHTML = inner;
    el.addEventListener('click', () => onSlotClick(i));
    pitch.appendChild(el);
  });
}

/* --- pool (current rolled squad) --- */
function isPlaced(player) { return state.slots.some(s => s.player === player); }
function renderPool() {
  if (!state.pool) return;
  $('poolTeam').innerHTML = `${state.pool.flag} ${state.pool.country}<span class="yr">${state.pool.year}</span>`;
  const list = $('poolList');
  list.innerHTML = '';
  [...state.pool.players].sort((a, b) => b.r - a.r).forEach((p) => {
    const idx = state.pool.players.indexOf(p);
    const card = document.createElement('div');
    card.className = 'pcard';
    if (state.selPool === idx) card.classList.add('selected');
    const fitsOpen = state.slots.some(s => !s.player && isEligible(p.p, s.role));
    if (!fitsOpen) card.classList.add('incompatible');
    const fits = (PLAYABLE[p.p] || []).join(' ');
    const rt = state.mode === 'almanac' ? '<span class="rt hidden">•</span>' : `<span class="rt r${p.r}">${p.r}</span>`;
    card.innerHTML =
      `<span class="pos ${p.p}">${p.p}</span>
       <span class="nm">${p.n}<span class="fits">${fits}</span></span>
       ${rt}`;
    card.addEventListener('click', () => onPoolClick(idx));
    list.appendChild(card);
  });
}
function onPoolClick(idx) {
  state.selPool = (state.selPool === idx) ? null : idx;
  renderPool();
  markTargets();
}
function markTargets() {
  const want = state.selPool != null ? state.pool.players[state.selPool] : null;
  let elig = 0;
  document.querySelectorAll('.slot').forEach((el, i) => {
    const sl = state.slots[i];
    const ok = !!want && !sl.player && isEligible(want.p, sl.role);
    el.classList.toggle('target', ok);
    if (ok) elig++;
  });
  if (!want) $('poolHint').textContent = `Roll ${Math.min(state.rollNow, TOTAL_ROLLS)}/11 — tap a player, then a glowing slot. (~ = out of position)`;
  else if (elig) $('poolHint').textContent = `Place ${want.n} (${want.p}) — ${elig} slot${elig > 1 ? 's' : ''} fit him.`;
  else $('poolHint').textContent = `No open slot fits a ${want.p}. Pick another player or swap the squad.`;
}
function onSlotClick(i) {
  const slot = state.slots[i];
  if (slot.player) { toast('Placed players are locked — Restart to redo'); return; }
  if (state.selPool == null) { toast('Pick a player first'); return; }
  const player = state.pool.players[state.selPool];
  if (!isEligible(player.p, slot.role)) { toast(`${shortName(player.n)} (${player.p}) can't play ${slot.role}`); return; }
  slot.player = player;
  state.selPool = null;
  state.picks++;
  renderPitch();
  updateOverall();
  if (state.picks >= TOTAL_ROLLS) { draftComplete(); }
  else { state.rollNow++; dealRoll(); updateMeta(); }
}
function draftComplete() {
  $('poolList').hidden = true;
  $('poolDone').hidden = false;
  $('poolHint').textContent = 'Starting XI complete.';
  $('btnSwapCountry').disabled = true;
  $('btnSwapYear').disabled = true;
  $('btnSimulate').disabled = false;
  document.querySelectorAll('.slot').forEach(el => el.classList.remove('target'));
  $('rollNow').textContent = TOTAL_ROLLS;
}

/* --- overall ratings --- */
function lineScores() {
  const def = [], mid = [], att = []; let gk = 0;
  state.slots.forEach(sl => {
    if (!sl.player) return;
    const { eff } = effRating(sl.player, sl.role);
    const line = POS_META[sl.role].line;
    if (line === 0) gk = eff;
    else if (line === 1) def.push(eff);
    else if (line === 2) mid.push(eff);
    else att.push(eff);
  });
  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const avgDef = avg(def), avgMid = avg(mid), avgAtt = avg(att);
  const defScore = gk * 0.30 + avgDef * 0.70;
  return { gk, defScore, midScore: avgMid, attScore: avgAtt };
}
function powers() {
  const L = lineScores();
  const sAtt = [-4, 0, 4][state.styleIdx];
  const sDef = [4, 0, -4][state.styleIdx];
  const attack = L.attScore * 0.62 + L.midScore * 0.38 + sAtt;
  const defense = L.defScore * 0.62 + L.midScore * 0.38 + sDef;
  const filled = state.slots.filter(s => s.player);
  const ovr = filled.length
    ? Math.round(filled.reduce((s, sl) => s + effRating(sl.player, sl.role).eff, 0) / filled.length)
    : 0;
  return { attack, defense, ovr, L };
}
function updateOverall() {
  const filled = state.slots.filter(s => s.player).length;
  if (state.mode === 'almanac') { ['ovrTeam', 'ovrAtt', 'ovrMid', 'ovrDef'].forEach(id => $(id).textContent = '?'); return; }
  if (!filled) { ['ovrTeam', 'ovrAtt', 'ovrMid', 'ovrDef'].forEach(id => $(id).textContent = '–'); return; }
  const p = powers();
  $('ovrTeam').textContent = p.ovr;
  $('ovrAtt').textContent = Math.round(p.attack);
  $('ovrMid').textContent = Math.round(p.L.midScore);
  $('ovrDef').textContent = Math.round(p.defense);
}

/* =====================================================
   SIMULATION
   ===================================================== */
const OPP_POOL = [
  { n: 'Nigeria', f: '🇳🇬' }, { n: 'Japan', f: '🇯🇵' }, { n: 'Mexico', f: '🇲🇽' },
  { n: 'USA', f: '🇺🇸' }, { n: 'Ghana', f: '🇬🇭' }, { n: 'Sweden', f: '🇸🇪' },
  { n: 'Poland', f: '🇵🇱' }, { n: 'Senegal', f: '🇸🇳' }, { n: 'Switzerland', f: '🇨🇭' },
  { n: 'Morocco', f: '🇲🇦' }, { n: 'Denmark', f: '🇩🇰' }, { n: 'Serbia', f: '🇷🇸' },
  { n: 'South Korea', f: '🇰🇷' }, { n: 'Ecuador', f: '🇪🇨' }, { n: 'Australia', f: '🇦🇺' },
  { n: 'Cameroon', f: '🇨🇲' }, { n: 'Chile', f: '🇨🇱' }, { n: 'Turkey', f: '🇹🇷' },
];
const ROUNDS = [
  { label: 'Group Match 1', str: 74, ko: false },
  { label: 'Group Match 2', str: 76, ko: false },
  { label: 'Group Match 3', str: 78, ko: false },
  { label: 'Round of 16', str: 81, ko: true },
  { label: 'Quarter-final', str: 83, ko: true },
  { label: 'Semi-final', str: 85, ko: true },
  { label: 'Final', str: 87, ko: true },
];

let sim = null;

function buildFixtures() {
  const opps = [...OPP_POOL].sort(() => Math.random() - 0.5);
  return ROUNDS.map((r, i) => ({ ...r, opp: opps[i] }));
}
function startSim() {
  sim = {
    me: powers(), fixtures: buildFixtures(), idx: 0,
    eliminated: false, elimRound: null,
    wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, results: [],
    cur: null, anim: null, advT: null,
  };
  show('screen-sim');
  runMatch(0);
}

/* ---- decide the real result (tuned model) ---- */
function computeMatch(fx) {
  const { attack, defense } = sim.me;
  let expFor = (attack - fx.str) / 6 + 1.3;
  let expAg = (fx.str - defense) / 6 + 1.15;
  let gf = clamp(Math.round(Math.max(0, expFor + (Math.random() - 0.5) * 1.5)), 0, 7);
  let ga = clamp(Math.round(Math.max(0, expAg + (Math.random() - 0.5) * 1.5)), 0, 7);
  if (gf > ga && Math.random() < 0.10) ga = gf;  // upset floor

  let outcome, penText = '', eliminated = false, pens = null;
  if (gf > ga) outcome = 'win';
  else if (gf < ga) { outcome = 'loss'; if (fx.ko) eliminated = true; }
  else {
    if (fx.ko) {
      const pWin = clamp(0.5 + (attack - fx.str) / 55, 0.25, 0.8);
      const adv = Math.random() < pWin;
      pens = makeShootout(adv);
      if (adv) { outcome = 'draw'; penText = `(advanced on penalties ${pens.us}–${pens.them})`; }
      else { outcome = 'loss'; penText = `(lost on penalties ${pens.us}–${pens.them})`; eliminated = true; }
    } else outcome = 'draw';
  }
  return { gf, ga, outcome, penText, eliminated, pens };
}
function makeShootout(usWins) {
  const margins = [[5, 4], [5, 3], [4, 3], [4, 2], [3, 2], [4, 1]];
  const [w, l] = rnd(margins);
  const mk = (score) => {
    const a = [false, false, false, false, false];
    const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
    let s = score; for (const i of order) { if (s > 0) { a[i] = true; s--; } }
    return a;
  };
  return usWins
    ? { us: w, them: l, usArr: mk(w), themArr: mk(l) }
    : { us: l, them: w, usArr: mk(l), themArr: mk(w) };
}

/* ---- match-event timeline ---- */
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function lineupPlayers() { return state.slots.filter(s => s.player).map(s => ({ p: s.player, role: s.role })); }
function weightedScorer(list) {
  const wts = list.map(o => ({ o, w: [0.04, 0.7, 2, 5][POS_META[o.role].line] }));
  let tot = wts.reduce((s, x) => s + x.w, 0), r = Math.random() * tot;
  for (const x of wts) { r -= x.w; if (r <= 0) return shortName(x.o.p.n); }
  return shortName(list[0].p.n);
}
function randPlayer(list) { return shortName(rnd(list).p.n); }
function buildEvents(fx, m) {
  const us = lineupPlayers(), ev = [];
  for (let k = 0; k < m.gf; k++) ev.push({ min: rint(2, 90), type: 'goal', side: 'us', who: weightedScorer(us) });
  for (let k = 0; k < m.ga; k++) ev.push({ min: rint(2, 90), type: 'goal', side: 'them', who: fx.opp.n });
  const cards = rint(0, 4);
  for (let k = 0; k < cards; k++) {
    const ours = Math.random() < 0.5;
    ev.push({ min: rint(12, 89), type: Math.random() < 0.12 ? 'red' : 'yellow', side: ours ? 'us' : 'them', who: ours ? randPlayer(us) : fx.opp.n });
  }
  const chances = rint(1, 3);
  for (let k = 0; k < chances; k++) {
    const ours = Math.random() < 0.55;
    ev.push({ min: rint(5, 88), type: 'chance', side: ours ? 'us' : 'them', who: ours ? randPlayer(us) : fx.opp.n });
  }
  ev.sort((a, b) => a.min - b.min || (a.type === 'goal' ? -1 : 1));
  return ev;
}

/* ---- live playback ---- */
const MATCH_MS = 13000;
function cancelAnim() {
  if (!sim) return;
  if (sim.anim) { if (sim.anim.raf) cancelAnimationFrame(sim.anim.raf); if (sim.anim.pt) clearTimeout(sim.anim.pt); }
  if (sim.advT) clearTimeout(sim.advT);
}
function runMatch(i) {
  cancelAnim();
  sim.idx = i;
  const fx = sim.fixtures[i];
  const m = computeMatch(fx);
  sim.cur = { fx, m, events: buildEvents(fx, m), shown: 0, us: 0, them: 0, htShown: false, ended: false };

  $('simRound').textContent = fx.label;
  $('simCount').textContent = `Match ${i + 1} / 7`;
  $('sbThem').textContent = fx.opp.n;
  $('sbThemFlag').textContent = fx.opp.f;
  $('sbScore').textContent = '0 – 0';
  $('simClock').textContent = "0’";
  $('simBar').style.width = '0%';
  $('simFeed').innerHTML = '';
  addFeed({ type: 'kick', min: 0 }, fx);
  setControls('playing');

  const start = Date.now();
  sim.anim = {};
  const loop = () => {
    const t = Math.min(1, (Date.now() - start) / MATCH_MS);
    const minute = Math.floor(t * 90);
    $('simClock').textContent = minute + "’";
    $('simBar').style.width = (t * 100) + '%';
    if (!sim.cur.htShown && minute >= 45) { sim.cur.htShown = true; addFeed({ type: 'half', min: 45 }, fx); }
    while (sim.cur.shown < sim.cur.events.length && sim.cur.events[sim.cur.shown].min <= minute) {
      revealEvent(sim.cur.events[sim.cur.shown], fx); sim.cur.shown++;
    }
    if (t >= 1) endMatchAnim();
    else sim.anim.raf = requestAnimationFrame(loop);
  };
  sim.anim.raf = requestAnimationFrame(loop);
}
function revealEvent(ev, fx) {
  if (ev.type === 'goal') {
    if (ev.side === 'us') sim.cur.us++; else sim.cur.them++;
    $('sbScore').textContent = `${sim.cur.us} – ${sim.cur.them}`;
    const sb = document.querySelector('.scoreboard');
    if (sb) { sb.classList.remove('goal-flash'); void sb.offsetWidth; sb.classList.add('goal-flash'); }
  }
  addFeed(ev, fx);
}
function endMatchAnim() {
  cancelAnim();
  const { fx, m } = sim.cur;
  while (sim.cur.shown < sim.cur.events.length) { revealEvent(sim.cur.events[sim.cur.shown], fx); sim.cur.shown++; }
  $('simClock').textContent = "90’"; $('simBar').style.width = '100%';
  sim.cur.us = m.gf; sim.cur.them = m.ga; $('sbScore').textContent = `${m.gf} – ${m.ga}`;
  addFeed({ type: 'ft', min: 90 }, fx);
  sim.anim = {};
  if (m.pens) runPens(m.pens, () => postMatch(m));
  else postMatch(m);
}
function runPens(pens, cb) {
  addFeed({ type: 'penhead' }, sim.cur.fx);
  const seq = [];
  for (let k = 0; k < 5; k++) { seq.push(['us', pens.usArr[k]]); seq.push(['them', pens.themArr[k]]); }
  let k = 0;
  const step = () => {
    if (k >= seq.length) {
      addFeed({ type: 'penend', pens }, sim.cur.fx);
      sim.anim.pt = setTimeout(cb, 600); return;
    }
    const [side, scored] = seq[k++];
    addFeed({ type: 'pen', side, scored }, sim.cur.fx);
    sim.anim.pt = setTimeout(step, 430);
  };
  sim.anim.pt = setTimeout(step, 550);
}
function postMatch(m) {
  if (sim.cur.ended) return;
  sim.cur.ended = true;
  if (m.outcome === 'win') sim.wins++;
  else if (m.outcome === 'draw') sim.draws++;
  else sim.losses++;
  sim.gf += m.gf; sim.ga += m.ga;
  sim.results.push({ fx: sim.cur.fx, gf: m.gf, ga: m.ga, outcome: m.outcome, penText: m.penText });
  if (m.eliminated) { sim.eliminated = true; sim.elimRound = sim.cur.fx.label; }

  const last = sim.idx >= sim.fixtures.length - 1;
  if (sim.eliminated || last) setControls('finished');
  else { setControls('between'); sim.advT = setTimeout(() => runMatch(sim.idx + 1), 2600); }
}
function skipMatch() { cancelAnim(); endMatchAnim(); }
function skipAll() {
  cancelAnim();
  if (sim.cur && !sim.cur.ended) {
    const m = sim.cur.m;
    sim.cur.ended = true;
    if (m.outcome === 'win') sim.wins++; else if (m.outcome === 'draw') sim.draws++; else sim.losses++;
    sim.gf += m.gf; sim.ga += m.ga;
    sim.results.push({ fx: sim.cur.fx, gf: m.gf, ga: m.ga, outcome: m.outcome, penText: m.penText });
    if (m.eliminated) { sim.eliminated = true; sim.elimRound = sim.cur.fx.label; }
  }
  let i = sim.idx + 1;
  while (!sim.eliminated && i < sim.fixtures.length) {
    const fx = sim.fixtures[i], m = computeMatch(fx);
    if (m.outcome === 'win') sim.wins++; else if (m.outcome === 'draw') sim.draws++; else sim.losses++;
    sim.gf += m.gf; sim.ga += m.ga;
    sim.results.push({ fx, gf: m.gf, ga: m.ga, outcome: m.outcome, penText: m.penText });
    if (m.eliminated) { sim.eliminated = true; sim.elimRound = fx.label; }
    sim.idx = i; i++;
  }
  finishSim();
}
function setControls(stage) {
  const c = $('simControls'); c.innerHTML = '';
  const mk = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = txt; b.onclick = fn; c.appendChild(b); };
  if (stage === 'playing') { mk('Skip match ⏭', 'ghost', skipMatch); mk('Skip to result', 'ghost sm', skipAll); }
  else if (stage === 'between') { mk('Next match ▶', 'primary big', () => runMatch(sim.idx + 1)); mk('Skip to result', 'ghost', skipAll); }
  else { mk('See result ▶', 'primary big', finishSim); }
}

/* ---- commentary feed rendering ---- */
function feedHTML(ev, fx) {
  const team = (side) => side === 'us' ? 'Your XI' : (fx ? fx.opp.n : 'Opponent');
  let ic = '•', tx = '', cls = '';
  switch (ev.type) {
    case 'kick': ic = '🟢'; tx = `Kick-off — ${fx.label}.`; break;
    case 'half': ic = '⏸'; tx = 'Half-time.'; break;
    case 'ft': ic = '🔔'; tx = 'Full-time.'; break;
    case 'goal':
      ic = '⚽'; cls = ev.side === 'us' ? 'g-us' : 'g-them';
      tx = ev.side === 'us' ? `<b>GOAL!</b> ${ev.who} scores for Your XI!` : `${team('them')} score — ${ev.who}.`;
      break;
    case 'yellow': ic = '🟨'; tx = `Yellow card — ${ev.who} (${team(ev.side)}).`; break;
    case 'red': ic = '🟥'; cls = 'red'; tx = `<b>RED CARD!</b> ${ev.who} (${team(ev.side)}) is off.`; break;
    case 'chance': ic = '🔸'; tx = `Chance! ${ev.who} (${team(ev.side)}) goes close.`; break;
    case 'penhead': ic = '🥅'; cls = 'penhead'; tx = '<b>Penalty shootout</b>'; break;
    case 'pen': ic = ev.scored ? '✅' : '❌'; tx = `${team(ev.side)} — ${ev.scored ? 'scores' : 'misses'}.`; break;
    case 'penend': ic = '🏁'; cls = 'penhead'; tx = `Shootout: <b>${ev.pens.us}–${ev.pens.them}</b>.`; break;
  }
  const min = (ev.min || ev.min === 0) && ['goal', 'yellow', 'red', 'chance', 'kick', 'half', 'ft'].includes(ev.type)
    ? `<span class="fe-min">${ev.min}’</span>` : `<span class="fe-min"></span>`;
  return `${min}<span class="fe-ic">${ic}</span><span class="fe-tx ${cls}">${tx}</span>`;
}
function addFeed(ev, fx) {
  const feed = $('simFeed');
  const div = document.createElement('div');
  div.className = 'fe fe-' + ev.type;
  div.innerHTML = feedHTML(ev, fx);
  feed.insertBefore(div, feed.firstChild);
}

/* =====================================================
   RESULT
   ===================================================== */
function finishSim() {
  cancelAnim();
  const champion = !sim.eliminated && sim.results.length >= sim.fixtures.length;
  const flawless = champion && sim.wins === 7 && sim.losses === 0 && sim.draws === 0;

  const badge = $('resultBadge'), headline = $('resultHeadline'), subEl = $('resultSub');

  if (flawless) {
    badge.textContent = '7–0'; badge.classList.remove('fail');
    headline.textContent = 'FLAWLESS CHAMPIONS';
    subEl.textContent = `Seven matches, seven wins, ${sim.gf} scored, ${sim.ga} conceded. The rarest result in the game.`;
    stats.sevens++; stats.streak++; stats.best = Math.max(stats.best, stats.streak);
    saveStats(); confetti();
  } else if (champion) {
    badge.textContent = '🏆'; badge.classList.remove('fail');
    headline.textContent = 'World Champions';
    subEl.textContent = `You lifted the cup — ${sim.wins}W ${sim.draws}D ${sim.losses}L. The perfect 7–0 slipped away. Re-draft and chase it.`;
    stats.streak = 0; saveStats();
  } else {
    badge.textContent = roundShort(sim.elimRound); badge.classList.add('fail');
    headline.textContent = 'Knocked out';
    subEl.textContent = `Eliminated in the ${sim.elimRound}. Re-draft and go again.`;
    stats.streak = 0; saveStats();
  }

  $('resultRecord').innerHTML =
    `Record: <b>${sim.wins}W</b> · ${sim.draws}D · <b>${sim.losses}L</b> &nbsp;|&nbsp; Goals <b>${sim.gf}</b>–<b>${sim.ga}</b>`;

  $('resultScores').innerHTML = sim.results.map(r =>
    `<div class="rs-line ${r.outcome[0]}">
       <span class="rs-round">${r.fx.label}</span>
       <span>vs ${r.fx.opp.f} ${r.fx.opp.n} ${r.penText}</span>
       <span class="rs-sc">${r.gf}–${r.ga}</span>
     </div>`).join('');

  show('screen-result');
}
function roundShort(label) {
  if (!label) return 'OUT';
  if (label.startsWith('Round')) return 'R16';
  if (label.startsWith('Quarter')) return 'QF';
  if (label.startsWith('Semi')) return 'SF';
  if (label === 'Final') return 'RU';
  return 'OUT';
}
function shareText() {
  const champion = !sim.eliminated && sim.results.length >= sim.fixtures.length;
  const flawless = champion && sim.wins === 7 && sim.losses === 0 && sim.draws === 0;
  const head = flawless ? '7–0 🏆 FLAWLESS' : champion ? '🏆 CHAMPIONS' : `OUT · ${roundShort(sim.elimRound)}`;
  const lines = sim.results.map(r => {
    const ico = r.outcome === 'win' ? '🟢' : r.outcome === 'draw' ? '🟡' : '🔴';
    return `${ico} ${r.gf}-${r.ga} ${r.fx.opp.f}`;
  }).join('\n');
  return `7–0 Dream Team — ${head}\n${state.formationKey} · ${STYLES[state.styleIdx]} · OVR ${sim.me.ovr}\n${lines}\nplay: ${location.href}`;
}

/* =====================================================
   confetti + toast
   ===================================================== */
function confetti() {
  const c = document.createElement('div'); c.id = 'confetti';
  document.body.appendChild(c);
  const cols = ['#ffd24a', '#36d57d', '#fff', '#3aa0ff', '#ff6b6b'];
  for (let i = 0; i < 120; i++) {
    const p = document.createElement('div'); p.className = 'conf';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = rnd(cols);
    p.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
    p.style.animationDelay = (Math.random() * 0.6) + 's';
    c.appendChild(p);
  }
  setTimeout(() => c.remove(), 4200);
}
let toastT;
function toast(msg) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1700);
}

/* =====================================================
   wire up
   ===================================================== */
function toSetup() { cancelAnim(); show('screen-setup'); }

function init() {
  renderStats();
  initSetupControls();
  buildSlots();

  $('btnStartDraft').addEventListener('click', startDraft);
  $('btnSwapCountry').addEventListener('click', swapCountry);
  $('btnSwapYear').addEventListener('click', swapYear);
  $('btnRestart').addEventListener('click', toSetup);
  $('btnSimulate').addEventListener('click', () => { if (!state.slots.some(s => !s.player)) startSim(); });
  $('btnShare').addEventListener('click', () => {
    const txt = shareText();
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Result copied!'), () => toast('Copy failed'));
    else toast('Copy not supported');
  });
  $('btnPlayAgain').addEventListener('click', toSetup);
  $('brandHome').addEventListener('click', toSetup);
}

document.addEventListener('DOMContentLoaded', init);
})();
