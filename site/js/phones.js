// Côté animateur : ouvrir l'atelier aux téléphones (QR code), suivre l'étape en cours dans la base
// et recevoir les post-its envoyés. Firebase n'est chargé qu'à la demande (store.js, import dynamique).

import { firebaseConfig } from './firebase-config.js?v=__VERSION__';
import {
  readMeta, flattenNotes, participantUrl, shareLink, isSessionId, isKey, readQuizEntries, readPresence,
  readMembers, assignNewcomers, shuffleGroups, roster, groupIdsFor, groupName, GROUP_IDS, DEFAULT_PERSONAS,
} from './session-core.js?v=__VERSION__';
import { STEPS, PHONE_STEPS } from './content.js?v=__VERSION__';
import { personaById } from './core.js?v=__VERSION__';
import { esc, load, save, qrSvg, copyText, toast, ICONS } from './shared.js?v=__VERSION__';

const SESSION_KEY = 'atelier-produit.session';

export function createPhones({ button, dialog, count, current, onRemote, onChange = () => {}, onQuiz = () => {}, onBoard = () => {}, onLive = () => {} }) {
  let store = null;
  let status = firebaseConfig ? 'idle' : 'off'; // off | idle | connecting | live | error
  let session = null; // { sid, key }
  let meta = null;
  let notes = [];
  let quizEntries = [];
  let presence = [];
  let members = {};
  let assigning = false;
  let unsubs = [];
  let lastSent = '';

  async function getStore() {
    if (!store) {
      const { createStore } = await import('./store.js?v=__VERSION__');
      store = createStore();
      await store.start();
    }
    return store;
  }

  function stop() {
    for (const u of unsubs) u();
    unsubs = [];
  }

  function listen() {
    stop();
    unsubs.push(store.onMeta(session.sid, (raw) => {
      meta = readMeta(raw);
      if (!meta) { forget('La séance n\'existe plus dans la base.'); return; }
      sync(...Object.values(current()));
      paint();
    }, () => { status = 'error'; paint(); }));
    unsubs.push(store.onPresence(session.sid, (tree) => {
      presence = readPresence(tree);
      autoAssign();
      paint(true);
    }, () => {}));
    unsubs.push(store.onMembers(session.sid, (tree) => {
      members = readMembers(tree);
      autoAssign();
      paint(true);
    }, () => {}));
    for (const g of GROUP_IDS) {
      unsubs.push(store.onBoard(session.sid, g, (tree) => onBoard(g, tree), () => {}));
    }
    unsubs.push(store.onQuiz(session.sid, (tree) => {
      quizEntries = readQuizEntries(tree);
      onQuiz(quizEntries);
    }, () => {}));
    unsubs.push(store.onNotes(session.sid, (tree) => {
      notes = flattenNotes(tree);
      onRemote(notes);
      paint();
    }, () => { status = 'error'; paint(); }));
  }

  /** Les nouveaux arrivants sont répartis au hasard, dans le groupe le moins rempli. */
  function autoAssign() {
    if (!meta || assigning) return;
    const todo = assignNewcomers(members, presence, meta.groups);
    if (!Object.keys(todo).length) return;
    assigning = true;
    store.setMembers(session.sid, todo).catch(() => {}).finally(() => { assigning = false; });
  }

  function forget(message) {
    stop();
    session = null;
    meta = null;
    notes = [];
    presence = [];
    members = {};
    quizEntries = [];
    onQuiz(quizEntries);
    lastSent = '';
    save(SESSION_KEY, null);
    status = firebaseConfig ? 'idle' : 'off';
    if (message) toast(message);
    paint();
  }

  /** Reprend la séance mémorisée au chargement de la page. */
  async function resume() {
    const saved = load(SESSION_KEY);
    if (!firebaseConfig || !isSessionId(saved?.sid) || !isKey(saved?.key)) { paint(); return; }
    session = saved;
    status = 'connecting';
    paint();
    try {
      await getStore();
      await store.claimOwner(session.sid, session.key);
      if (!(await store.getMeta(session.sid))) { forget(); return; }
      status = 'live';
      listen();
    } catch {
      status = 'error';
    }
    paint();
  }

  async function open() {
    status = 'connecting';
    paint();
    try {
      await getStore();
      const { step, persona } = current();
      session = await store.createSession({ title: 'Atelier Produit', step, persona });
      save(SESSION_KEY, session);
      lastSent = `${step}|${persona}`;
      status = 'live';
      listen();
    } catch {
      status = 'error';
    }
    paint();
  }

  /** L'animateur a changé d'étape : les participants suivent, et la restitution se referme. */
  function sync(step, persona) {
    if (status !== 'live' || !meta) return;
    const key = `${step}|${persona}`;
    if (key === lastSent && meta.step === step && meta.persona === persona) return;
    const stepChanged = meta.step !== step;
    lastSent = key;
    store.setMeta(session.sid, { step, persona, ...(stepChanged ? { restitution: false } : {}) }).catch(() => { lastSent = ''; });
  }

  // ---- Groupes (animateur seulement)
  async function setGroups(n) {
    if (status !== 'live') return;
    await store.setMeta(session.sid, { groups: n });
    if (n === 1) {
      const moves = Object.fromEntries(Object.entries(members).filter(([, g]) => g !== 'g1').map(([u]) => [u, 'g1']));
      if (Object.keys(moves).length) await store.setMembers(session.sid, moves);
    } else {
      await store.setMembers(session.sid, shuffleGroups(presence, 2));
    }
  }
  const shuffle = () => (status === 'live' ? store.setMembers(session.sid, shuffleGroups(presence, meta.groups)) : null);
  const moveMember = (uid, g) => store.setMembers(session.sid, { [uid]: g });
  const setRestitution = (on) => store.setMeta(session.sid, { restitution: on });
  const writeBoard = (g, updates) => store.writeBoard(session.sid, g, updates);
  const setBoardState = (g, key, value) => store.setBoardState(session.sid, g, key, value);
  const setKept = (map) => store.setKept(session.sid, map);

  /** Quiz du débrief : 'open' (les téléphones répondent), 'revealed' (correction pour tous), 'off'. */
  async function setQuiz(mode) {
    if (status !== 'live') return false;
    try { await store.setQuiz(session.sid, mode); return true; } catch { toast('Action impossible pour le moment.'); return false; }
  }

  /** Efface toutes les copies (pour rejouer). */
  async function clearQuiz() {
    if (status !== 'live') return;
    try { await store.clearQuiz(session.sid); } catch { toast('Effacement impossible pour le moment.'); }
  }

  async function setClosed(closed) {
    try { await store.setClosed(session.sid, closed); } catch { toast('Action impossible pour le moment.'); }
  }

  async function end() {
    if (!confirm('Terminer la séance ? Les post-its déjà reçus restent sur le tableau ; ils sont effacés de la base.')) return;
    try {
      await store.deleteSession(session.sid, meta?.code);
      forget('Séance terminée, base nettoyée.');
    } catch {
      toast('Suppression impossible pour le moment.');
    }
  }

  /* ---------- Affichage ---------- */

  function paint() {
    const live = status === 'live';
    onLive(live);
    button.classList.toggle('is-live', live);
    count.hidden = !live || !presence.length;
    count.textContent = presence.length;
    button.title = live
      ? `${presence.length} connecté${presence.length > 1 ? 's' : ''} · ${notes.length} post-it${notes.length > 1 ? 's' : ''} reçu${notes.length > 1 ? 's' : ''}`
      : 'Faire participer depuis un ordinateur ou un téléphone';
    if (dialog.open) dialog.innerHTML = body();
    onChange();
  }

  const this_share = () => (meta?.code ? shareLink(location.href, meta.code) : participantUrl(location.href, session.sid));

  function body() {
    const head = `<div class="dialog-head"><h2 id="phones-title">${ICONS.users} Participants</h2>
      <button type="button" class="icon-btn" data-close aria-label="Fermer" title="Fermer">${ICONS.close}</button></div>`;
    if (status === 'off') {
      return `${head}<div class="dialog-form">
        <p>La participation à distance n'est pas encore configurée pour cet outil.</p>
        <p class="hint">L'atelier fonctionne très bien sans : on écrit les post-its directement sur l'écran projeté. Pour l'activer, il faut un projet Firebase (voir le README du dépôt).</p>
      </div>`;
    }
    if (status === 'idle' || status === 'connecting') {
      return `${head}<div class="dialog-form">
        <p>Chacun rejoint depuis son ordinateur ou son téléphone, avec un lien à copier ou un QR code, puis écrit ses post-its. Ils arrivent sur cet écran, à l'étape en cours.</p>
        <ul class="hint-list">
          <li>Pas de compte : un prénom suffit.</li>
          <li>Seuls les post-its envoyés passent par la base, effacée quand vous terminez la séance.</li>
          <li>Le VPN de l'entreprise bloque Firebase : l'animateur et les participants doivent être hors VPN (ou rejoindre depuis leur téléphone).</li>
        </ul>
        <div class="dialog-actions"><span></span>
          <button type="button" class="btn btn-primary" data-open-session ${status === 'connecting' ? 'disabled' : ''}>${status === 'connecting' ? 'Connexion…' : 'Ouvrir l\'atelier aux participants'}</button></div>
      </div>`;
    }
    if (status === 'error') {
      return `${head}<div class="dialog-form">
        <p><strong>Connexion impossible.</strong> Le réseau bloque peut-être Firebase (VPN de l'entreprise ?).</p>
        <p class="hint">L'atelier continue de fonctionner sans participation à distance.</p>
        <div class="dialog-actions">
          ${session ? '<button type="button" class="btn btn-danger" data-forget>Oublier cette séance</button>' : '<span></span>'}
          <button type="button" class="btn btn-primary" data-retry>Réessayer</button></div>
      </div>`;
    }
    const url = participantUrl(location.href, session.sid);
    const step = meta?.step ?? current().step;
    const stepLabel = STEPS.find((s) => s.id === step)?.label ?? '';
    const phoneStep = PHONE_STEPS.includes(step);
    return `${head}<div class="dialog-form phones-live">
      <div class="qr-wrap">${qrSvg(this_share(), 'QR code pour rejoindre l\'atelier')}</div>
      <div class="phones-info">
        <p class="phones-url"><a href="${esc(this_share())}" target="_blank" rel="noopener">${esc(this_share().replace(/^https?:\/\//, ''))}</a>
          <button type="button" class="btn btn-primary btn-small" data-copy-url>${ICONS.link} Copier le lien</button></p>
        ${meta?.code ? `<p class="room-code">Code <strong>${esc(meta.code)}</strong></p>` : ''}
        <p class="phones-stat"><strong>${presence.length}</strong> connecté${presence.length > 1 ? 's' : ''}</p>
        <p class="hint">Les participants suivent l'étape affichée : <strong>${esc(stepLabel)}</strong>.</p>
        <div class="dialog-actions"><button type="button" class="btn btn-danger" data-end>Terminer la séance</button></div>
      </div>
      ${groupsPanel()}
    </div>`;
  }

  /** Les groupes : un ou deux, composition, déplacer quelqu'un, nouvelle répartition au hasard. */
  function groupsPanel() {
    const n = meta?.groups ?? 2;
    const r = roster(members, presence, n);
    const waiting = presence.filter((p) => !groupIdsFor(n).includes(members[p.uid]));
    return `<section class="groups-panel" aria-labelledby="groups-title">
      <div class="groups-head">
        <h3 id="groups-title">Groupes</h3>
        <div class="seg" role="radiogroup" aria-label="Nombre de groupes">
          <button type="button" role="radio" aria-checked="${n === 1}" data-groups="1">1 groupe</button>
          <button type="button" role="radio" aria-checked="${n === 2}" data-groups="2">2 groupes</button>
        </div>
        ${n === 2 ? '<button type="button" class="btn btn-quiet btn-small" data-shuffle>Répartir au hasard</button>' : ''}
      </div>
      <div class="groups-grid groups-grid--${n}">
        ${groupIdsFor(n).map((g) => `<div class="group-col">
          <p class="group-name">${esc(groupName(g))} <span class="count">${r[g].length}</span></p>
          <ul>${r[g].map((p) => `<li>${esc(p.author)}${n === 2 ? `<button type="button" class="link-btn" data-move="${esc(p.uid)}" data-to="${g === 'g1' ? 'g2' : 'g1'}" title="Passer dans l'autre groupe">→ ${esc(groupName(g === 'g1' ? 'g2' : 'g1'))}</button>` : ''}</li>`).join('') || '<li class="hint">Personne pour l\'instant</li>'}</ul>
        </div>`).join('')}
      </div>
      ${waiting.length ? `<p class="hint">En cours d'affectation : ${esc(waiting.map((p) => p.author).join(', '))}</p>` : ''}
      <p class="hint">Les nouveaux arrivants rejoignent le groupe le moins rempli. Chaque groupe ne voit que son tableau, jusqu'à la restitution.</p>
    </section>`;
  }

  function show() {
    dialog.innerHTML = body();
    dialog.showModal();
    dialog.querySelector('[data-open-session], [data-copy-url], [data-close]')?.focus();
  }
  button.addEventListener('click', show);

  dialog.addEventListener('click', async (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) { dialog.close(); return; }
    if (e.target.closest('[data-open-session]')) open();
    else if (e.target.closest('[data-retry]')) (session ? resume() : open());
    else if (e.target.closest('[data-forget]')) forget();
    else if (e.target.closest('[data-end]')) end();
    else if (e.target.closest('[data-groups]')) {
      const n = Number(e.target.closest('[data-groups]').dataset.groups);
      if (n !== (meta?.groups ?? 2)) await setGroups(n);
    } else if (e.target.closest('[data-shuffle]')) {
      if (confirm('Répartir à nouveau tout le monde au hasard ? Chacun changera peut-être de groupe.')) await shuffle();
    } else if (e.target.closest('[data-move]')) {
      const b = e.target.closest('[data-move]');
      await moveMember(b.dataset.move, b.dataset.to);
    } else if (e.target.closest('[data-copy-url]')) {
      const ok = await copyText(this_share());
      toast(ok ? 'Lien copié : collez-le dans le chat de la réunion.' : 'Copie impossible');
    }
  });
  dialog.addEventListener('change', (e) => {
    if (e.target.matches('[data-closed]')) setClosed(e.target.checked);
  });

  return {
    resume, sync, show, setQuiz, clearQuiz,
    setGroups, shuffle, moveMember, setRestitution, writeBoard, setBoardState, setKept,
    get groups() { return meta?.groups ?? 2; },
    get restitution() { return meta?.restitution === true; },
    get members() { return members; },
    get roster() { return roster(members, presence, meta?.groups ?? 2); },
    get live() { return status === 'live'; },
    get available() { return status !== 'off'; },
    get quiz() { return meta?.quiz ?? 'off'; },
    /** Le lien du QR code : le lien court quand la salle a un code (QR moins dense). */
    get url() { return session ? this_share() : ''; },
    get people() { return new Set(notes.map((n) => n.uid)).size; },
    get presence() { return presence; },
    get code() { return meta?.code ?? ''; },
    get joinUrl() { return new URL('postit.html', location.href).href; },
    /** Lien à coller dans le chat de la réunion : la page participant avec le code de la salle. */
    get shareUrl() { return session ? this_share() : ''; },
    get hasCode() { return !!meta?.code; },
  };
}
