// Côté animateur : ouvrir l'atelier aux téléphones (QR code), suivre l'étape en cours dans la base
// et recevoir les post-its envoyés. Firebase n'est chargé qu'à la demande (store.js, import dynamique).

import { firebaseConfig } from './firebase-config.js?v=__VERSION__';
import { readMeta, flattenNotes, participantUrl, isSessionId, isKey, readQuizEntries, readPresence } from './session-core.js?v=__VERSION__';
import { STEPS, PHONE_STEPS } from './content.js?v=__VERSION__';
import { personaById } from './core.js?v=__VERSION__';
import { esc, load, save, qrSvg, copyText, toast, ICONS } from './shared.js?v=__VERSION__';

const SESSION_KEY = 'atelier-produit.session';

export function createPhones({ button, dialog, count, current, onRemote, onChange = () => {}, onQuiz = () => {} }) {
  let store = null;
  let status = firebaseConfig ? 'idle' : 'off'; // off | idle | connecting | live | error
  let session = null; // { sid, key }
  let meta = null;
  let notes = [];
  let quizEntries = [];
  let presence = [];
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
      paint(true);
    }, () => {}));
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

  function forget(message) {
    stop();
    session = null;
    meta = null;
    notes = [];
    presence = [];
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

  /** L'animateur a changé d'étape ou de persona : les téléphones suivent. */
  function sync(step, persona) {
    if (status !== 'live' || !meta) return;
    const key = `${step}|${persona}`;
    if (key === lastSent && meta.step === step && meta.persona === persona) return;
    lastSent = key;
    store.setStep(session.sid, step, persona).catch(() => { lastSent = ''; });
  }

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
    button.classList.toggle('is-live', live);
    count.hidden = !live || !presence.length;
    count.textContent = presence.length;
    button.title = live
      ? `${presence.length} connecté${presence.length > 1 ? 's' : ''} · ${notes.length} post-it${notes.length > 1 ? 's' : ''} reçu${notes.length > 1 ? 's' : ''}`
      : 'Envoyer des post-its depuis les téléphones';
    if (dialog.open) dialog.innerHTML = body();
    onChange();
  }

  function body() {
    const head = `<div class="dialog-head"><h2 id="phones-title">${ICONS.phone} Post-its depuis les téléphones</h2>
      <button type="button" class="icon-btn" data-close aria-label="Fermer" title="Fermer">${ICONS.close}</button></div>`;
    if (status === 'off') {
      return `${head}<div class="dialog-form">
        <p>L'envoi depuis les téléphones n'est pas encore configuré pour cet outil.</p>
        <p class="hint">L'atelier fonctionne très bien sans : on écrit les post-its directement sur l'écran projeté. Pour l'activer, il faut un projet Firebase (voir le README du dépôt).</p>
      </div>`;
    }
    if (status === 'idle' || status === 'connecting') {
      return `${head}<div class="dialog-form">
        <p>Chacun scanne un QR code et écrit ses post-its sur son téléphone. Ils arrivent sur cet écran, à l'étape en cours.</p>
        <ul class="hint-list">
          <li>Pas de compte : un prénom suffit.</li>
          <li>Seuls les post-its envoyés passent par la base, effacée quand vous terminez la séance.</li>
          <li>Le VPN de l'entreprise bloque Firebase : ouvrez cette page hors VPN, et les participants depuis leur téléphone.</li>
        </ul>
        <div class="dialog-actions"><span></span>
          <button type="button" class="btn btn-primary" data-open-session ${status === 'connecting' ? 'disabled' : ''}>${status === 'connecting' ? 'Connexion…' : 'Ouvrir l\'atelier aux téléphones'}</button></div>
      </div>`;
    }
    if (status === 'error') {
      return `${head}<div class="dialog-form">
        <p><strong>Connexion impossible.</strong> Le réseau bloque peut-être Firebase (VPN de l'entreprise ?).</p>
        <p class="hint">L'atelier continue de fonctionner sans les téléphones.</p>
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
      <div class="qr-wrap">${qrSvg(url, 'QR code pour envoyer des post-its')}</div>
      <div class="phones-info">
        <p class="phones-url"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ''))}</a>
          <button type="button" class="btn btn-quiet btn-small" data-copy-url>Copier le lien</button></p>
        ${meta?.code ? `<p class="room-code">Code <strong>${esc(meta.code)}</strong></p>` : ''}
        <p class="phones-stat"><strong>${presence.length}</strong> connecté${presence.length > 1 ? 's' : ''} · ${notes.length} post-it${notes.length > 1 ? 's' : ''} reçu${notes.length > 1 ? 's' : ''}</p>
        ${presence.length ? `<ul class="present">${presence.map((p) => `<li>${esc(p.author)}</li>`).join('')}</ul>` : ''}
        <p class="hint">Les téléphones suivent l'étape affichée : <strong>${esc(stepLabel)}</strong>${step === 'empathy' && meta ? ` (carte de ${esc(personaById(meta.persona)?.name ?? '')})` : ''}.
          ${phoneStep ? '' : 'Pas de post-it à cette étape.'}</p>
        <label class="check"><input type="checkbox" data-closed ${meta?.closed ? 'checked' : ''}> Fermer les envois</label>
        <div class="dialog-actions"><button type="button" class="btn btn-danger" data-end>Terminer la séance</button></div>
      </div>
    </div>`;
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
    else if (e.target.closest('[data-copy-url]')) {
      const ok = await copyText(participantUrl(location.href, session.sid));
      toast(ok ? 'Lien copié' : 'Copie impossible');
    }
  });
  dialog.addEventListener('change', (e) => {
    if (e.target.matches('[data-closed]')) setClosed(e.target.checked);
  });

  return {
    resume, sync, show, setQuiz, clearQuiz,
    get live() { return status === 'live'; },
    get available() { return status !== 'off'; },
    get quiz() { return meta?.quiz ?? 'off'; },
    get url() { return session ? participantUrl(location.href, session.sid) : ''; },
    get people() { return new Set(notes.map((n) => n.uid)).size; },
    get presence() { return presence; },
    get code() { return meta?.code ?? ''; },
    get joinUrl() { return new URL('postit.html', location.href).href; },
  };
}
