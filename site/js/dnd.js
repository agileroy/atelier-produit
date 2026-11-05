// Glisser-déposer à la souris, au stylet et au doigt (Pointer Events).
// Un élément [data-drag="…"] se dépose sur une zone [data-drop="…"]. Au doigt, il faut un appui long
// (pour garder le défilement) ; un simple clic reste un clic (les éléments sont aussi des boutons).

const THRESHOLD = 6;
const LONG_PRESS = 260;

/**
 * root : conteneur écouté. Options :
 * - accepts(dragKey, dropKey) : vrai si la zone accepte cet élément (zone surlignée) ;
 * - onDrop(dragKey, dropKey, beforeKey) : dépôt (beforeKey : élément [data-drag] devant lequel insérer, ou null).
 */
export function setupDnd(root, { accepts, onDrop }) {
  let drag = null;
  let suppressClick = false;

  const scrollers = () => [...document.querySelectorAll('.canvas-scroll')];

  function start(e) {
    const el = drag.el;
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.add('dnd-ghost');
    ghost.removeAttribute('id');
    ghost.style.width = `${rect.width}px`;
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.dx = e.clientX - rect.left;
    drag.dy = e.clientY - rect.top;
    drag.active = true;
    el.classList.add('is-dragging');
    document.body.classList.add('is-grabbing');
    for (const zone of root.querySelectorAll('[data-drop]')) {
      if (accepts(drag.key, zone.dataset.drop)) zone.classList.add('drop-ok');
    }
    move(e);
  }

  function targetAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const zone = hit?.closest('[data-drop]');
    if (!zone || !root.contains(zone) || !accepts(drag.key, zone.dataset.drop)) return { zone: null, before: null };
    // Insertion : premier élément de la zone dont le milieu est après le pointeur.
    const horizontal = zone.dataset.axis === 'x';
    // Les éléments de cette zone (pas ceux d'une zone imbriquée), dans l'ordre d'affichage.
    const items = [...zone.querySelectorAll('[data-drag]')].filter((i) => i !== drag.el && i.parentElement.closest('[data-drop]') === zone);
    let before = null;
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (horizontal ? x < r.left + r.width / 2 : y < r.top + r.height / 2) { before = item; break; }
    }
    return { zone, before };
  }

  function move(e) {
    drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px) rotate(-2deg)`;
    const { zone, before } = targetAt(e.clientX, e.clientY);
    if (zone !== drag.zone) {
      drag.zone?.classList.remove('drop-hover');
      zone?.classList.add('drop-hover');
      drag.zone = zone;
    }
    if (before !== drag.before) {
      drag.before?.classList.remove('drop-before');
      before?.classList.add('drop-before');
      drag.before = before;
    }
    autoScroll(e);
  }

  function autoScroll(e) {
    const edge = 48;
    for (const s of scrollers()) {
      const r = s.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) continue;
      if (e.clientX > r.right - edge) s.scrollLeft += 14;
      else if (e.clientX < r.left + edge) s.scrollLeft -= 14;
    }
    if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 14);
    else if (e.clientY < edge + 60) window.scrollBy(0, -14);
  }

  function end(commit) {
    if (!drag) return;
    clearTimeout(drag.timer);
    if (drag.active) {
      const { key, zone, before } = drag;
      drag.ghost.remove();
      drag.el.classList.remove('is-dragging');
      drag.zone?.classList.remove('drop-hover');
      drag.before?.classList.remove('drop-before');
      for (const z of root.querySelectorAll('.drop-ok')) z.classList.remove('drop-ok');
      document.body.classList.remove('is-grabbing');
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      drag = null;
      if (commit && zone) onDrop(key, zone.dataset.drop, before?.dataset.drag ?? null);
      return;
    }
    drag = null;
  }

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    const el = e.target.closest('[data-drag]');
    if (!el || !root.contains(el) || e.target.closest('[data-nodrag], input, textarea, select')) return;
    drag = { el, key: el.dataset.drag, x: e.clientX, y: e.clientY, active: false, touch: e.pointerType === 'touch', ready: e.pointerType !== 'touch' };
    if (drag.touch) {
      drag.timer = setTimeout(() => {
        if (!drag) return;
        drag.ready = true;
        el.classList.add('is-pressed');
        navigator.vibrate?.(15);
      }, LONG_PRESS);
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.active) { e.preventDefault(); move(e); return; }
    const far = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > THRESHOLD;
    if (!far) return;
    if (!drag.ready) { clearTimeout(drag.timer); drag = null; return; } // le doigt fait défiler
    drag.el.classList.remove('is-pressed');
    start(e);
  }, { passive: false });

  // Pendant un glisser au doigt, la page ne défile pas.
  window.addEventListener('touchmove', (e) => { if (drag?.ready) e.preventDefault(); }, { passive: false });
  window.addEventListener('pointerup', () => { drag?.el.classList.remove('is-pressed'); end(true); });
  window.addEventListener('pointercancel', () => { drag?.el.classList.remove('is-pressed'); end(false); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag?.active) end(false); });
  root.addEventListener('contextmenu', (e) => { if (drag?.touch) e.preventDefault(); });
  root.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}
