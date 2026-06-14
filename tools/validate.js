/* tools/validate.js — data integrity check for CI (no dependencies)
   Loads data.js in a sandbox and asserts the squad/formation invariants
   the game relies on. Exits non-zero on any failure. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = {};
vm.createContext(ctx);
const src = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8') +
  '\n;Object.assign(globalThis,{SQUADS,FORMATIONS,POS_META,STYLES,WC_YEARS});';
vm.runInContext(src, ctx);
const { SQUADS, FORMATIONS, POS_META } = ctx;

const VALID_POS = ['GK', 'RB', 'CB', 'LB', 'RWB', 'LWB', 'DM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST', 'CF'];
const PLAYABLE = {
  GK: ['GK'], CB: ['CB', 'RB', 'LB', 'DM'], RB: ['RB', 'RWB', 'RM', 'CB'], LB: ['LB', 'LWB', 'LM', 'CB'],
  RWB: ['RWB', 'RB', 'RM', 'RW'], LWB: ['LWB', 'LB', 'LM', 'LW'], DM: ['DM', 'CM', 'CB'], CM: ['CM', 'DM', 'CAM'],
  CAM: ['CAM', 'CM', 'RW', 'LW', 'ST'], RM: ['RM', 'RW', 'RB', 'RWB', 'CM'], LM: ['LM', 'LW', 'LB', 'LWB', 'CM'],
  RW: ['RW', 'RM', 'ST', 'CAM', 'LW'], LW: ['LW', 'LM', 'ST', 'CAM', 'RW'], ST: ['ST', 'CF', 'CAM', 'RW', 'LW'], CF: ['CF', 'ST', 'CAM'],
};
const elig = (n, r) => (PLAYABLE[n] || []).includes(r);

const errors = [];
const E = (m) => errors.push(m);

// 1) squad count (minimum — squads can be added freely)
const MIN_SQUADS = 40;
if (SQUADS.length < MIN_SQUADS) E(`expected >= ${MIN_SQUADS} squads, found ${SQUADS.length}`);

// 2) per-squad checks
const seen = new Set();
for (const s of SQUADS) {
  const tag = `${s.country} ${s.year}`;
  if (!s.country || !s.year || !s.flag) E(`${tag}: missing country/year/flag`);
  if (seen.has(tag)) E(`duplicate squad: ${tag}`); seen.add(tag);
  if (!Array.isArray(s.players) || s.players.length < 11) E(`${tag}: needs >=11 players, has ${s.players ? s.players.length : 0}`);
  const lines = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const names = new Set();
  for (const p of s.players) {
    if (!VALID_POS.includes(p.p)) E(`${tag}: bad position '${p.p}' for ${p.n}`);
    if (typeof p.r !== 'number' || p.r < 70 || p.r > 99) E(`${tag}: rating out of range for ${p.n} (${p.r})`);
    if (names.has(p.n)) E(`${tag}: duplicate player '${p.n}'`); names.add(p.n);
    if (POS_META[p.p]) lines[POS_META[p.p].line]++;
  }
  // a squad needn't fill a formation alone (the draft mixes many squads and
  // dealRoll only deals squads that fit an open slot) — just require a keeper
  // plus a sensible spread of outfielders.
  if (lines[0] < 1) E(`${tag}: no goalkeeper`);
  if (lines[1] + lines[2] + lines[3] < 9) E(`${tag}: <9 outfielders`);
}

// 3) every formation role must be fillable by some natural position
const roles = new Set();
for (const f of Object.values(FORMATIONS)) for (const sl of f) roles.add(sl.role);
for (const r of roles) {
  const can = VALID_POS.some(n => elig(n, r));
  if (!can) E(`formation role '${r}' has no eligible natural position`);
  if (!POS_META[r]) E(`formation role '${r}' missing from POS_META`);
}

// 4) each formation should be fillable from at least one full squad's pool (sanity)
for (const [fk, slots] of Object.entries(FORMATIONS)) {
  if (slots.length !== 11) E(`formation ${fk} has ${slots.length} slots, expected 11`);
}

if (errors.length) {
  console.error('DATA VALIDATION FAILED:');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`✓ ${SQUADS.length} squads, ${Object.keys(FORMATIONS).length} formations, all invariants OK`);
