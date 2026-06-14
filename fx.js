/* ============================================================
   fx.js — presentation-only flourishes layered on top of game.js.
   Touches NOTHING in game state; pure DOM/CSS reactions.
     1. Pointer/scroll parallax  → drives --par-x / --par-y (root)
        consumed by .pitch (3D tilt) and .flood (backdrop drift).
     2. Holographic player cards → moving foil sheen (--mx/--my) plus
        a subtle pointer tilt that reads like a physical FC card.
   Respects prefers-reduced-motion and skips heavy work on touch.
   ============================================================ */
(function () {
'use strict';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
const fine = matchMedia('(pointer:fine)').matches;

/* ---------- 1. PARALLAX ----------
   Pointer position → target offset in [-0.5, 0.5]; eased toward each
   frame so motion feels weighted, not twitchy. */
let tx = 0, ty = 0, cx = 0, cy = 0, running = false;

function loop() {
  cx += (tx - cx) * 0.08;
  cy += (ty - cy) * 0.08;
  root.style.setProperty('--par-x', cx.toFixed(4));
  root.style.setProperty('--par-y', cy.toFixed(4));
  if (Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005) {
    requestAnimationFrame(loop);
  } else { running = false; }
}
function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

if (!reduce && fine) {
  window.addEventListener('pointermove', (e) => {
    tx = e.clientX / innerWidth - 0.5;
    ty = e.clientY / innerHeight - 0.5;
    kick();
  }, { passive: true });
} else if (!reduce) {
  // coarse pointer / touch: let scroll nudge the backdrop a touch
  window.addEventListener('scroll', () => {
    const max = Math.max(1, document.body.scrollHeight - innerHeight);
    ty = (scrollY / max - 0.5);
    kick();
  }, { passive: true });
}

/* ---------- 2. HOLOGRAPHIC CARDS ----------
   Cards are re-created every roll, so we delegate on the stable
   #poolList container. */
const pool = document.getElementById('poolList');
if (pool && !reduce) {
  // Once the pack-opening flip finishes, drop the animation so inline
  // tilt transforms can take over (animation fill otherwise wins).
  pool.addEventListener('animationend', (e) => {
    const card = e.target;
    if (card.classList && card.classList.contains('pcard')) card.style.animation = 'none';
  });

  let active = null;
  const tilt = (card, e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1
    const py = (e.clientY - r.top) / r.height;   // 0..1
    // move the holographic sheen toward the cursor
    card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    // selected cards keep their CSS lift — don't fight it with a tilt
    if (card.classList.contains('selected')) return;
    const rx = (0.5 - py) * 14;   // tilt up/down
    const ry = (px - 0.5) * 16;   // tilt left/right
    card.style.transform = `perspective(640px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(6px)`;
  };
  const reset = (card) => {
    if (!card) return;
    card.style.transform = '';
    card.style.removeProperty('--mx');
    card.style.removeProperty('--my');
  };

  if (fine) {
    pool.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.pcard');
      if (card !== active) { reset(active); active = card; }
      if (card) tilt(card, e);
    }, { passive: true });
    pool.addEventListener('pointerleave', () => { reset(active); active = null; }, { passive: true });
  }
}

})();
