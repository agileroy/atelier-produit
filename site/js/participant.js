// Page participant (index.html?code=… ou ?atelier=…) : l'atelier complet, sur le tableau de son groupe.
// Ce module gère l'arrivée (code, prénom unique, présence), suit l'étape choisie par l'animateur,
// branche le tableau du groupe (et celui de l'autre groupe pendant la restitution) et le quiz du débrief.
// L'interface des étapes est celle de app.js, en mode participant.

import { firebaseConfig } from './firebase-config.js?v=__VERSION__';
import {
  readMeta, isSessionId, quizPayload, quizProgress, quizScore, QUIZ_QUESTIONS, QUIZ_MAX, formatClock,
  nameKey, normalizeCode, isCode, CODE_LENGTH, groupName,
} from './session-core.js?v=__VERSION__';
import { TOOLS, TOOL_PHASES, PLACES, SITUATIONS, SITUATION_CHOICES, PLACEMENT_FEEDBACK } from './content.js?v=__VERSION__';
import { MAX_AUTHOR, TOOL_IDS } from './core.js?v=__VERSION__';
import { $, esc, load, save, toast, announce } from './shared.js?v=__VERSION__';

const AUTHOR_KEY = 'atelier-produit.author';
const CHOICE_LABELS = { empathy: 'Empathy map', impact: 'Impact mapping', story: 'Story mapping', designThinking: 'La démarche complète (Design Thinking)', none: 'pas de réponse' };
const BOARD_STEPS = ['empathy', 'impact', 'story'];
const fmt = (n) => String(n).replace('.', ',');
const phaseLabel = (id) => (id === 'develop' || id === 'deliver' ? 'Développer et livrer' : PLACES.find((p) => p.id === id)?.label ?? 'pas de réponse');
/**
 * Les zones du quiz : le second losange (développer, livrer) ne fait qu'une zone, la story map
 * couvrant les deux phases. Elle s'enregistre « develop ».
 */
const QUIZ_ZONES = [
  ...PLACES.filter((p) => ['discover', 'define'].includes(p.id)),
  { id: 'develop', label: 'Développer et livrer', plain: 'Explorer des solutions, puis les essayer et les améliorer avec les utilisateurs', wide: true },
];
const QUIZ_CHOICES = [...QUIZ_ZONES, PLACES.find((p) => p.id === 'all')];

export async function startParticipant(api) {
  const { hooks, shared } = api;
  const main = $('#main');
  const sid = new URLSearchParams(location.search).get('atelier');
  const NAME_KEY = `atelier-produit.name.${sid}`;
  const QUIZ_KEY = `atelier-produit.quiz.${sid}`;

  let store = null;
  let meta = null;
  let phase = 'loading'; // loading | join | message | name | ready
  let note = { title: '', text: '' };
  let author = load(AUTHOR_KEY) ?? '';
  let nameError = '';
  let leaveRoom = null;
  let boardUnsubs = {};
  const quizDraft = { placement: {}, answers: {}, ...(load(QUIZ_KEY) ?? {}) };
  let myQuiz = null;
  let sending = false;
  let autoSent = false; // copie envoyée toute seule à la fin du temps
  /** Ordre des notions propre à chacun (mélangé une fois, gardé au rechargement). */
  const toolOrder = (() => {
    const saved = load('atelier-produit.quiz-order');
    if (Array.isArray(saved) && saved.length === TOOL_IDS.length && TOOL_IDS.every((t) => saved.includes(t))) return saved;
    const order = [...TOOL_IDS];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    save('atelier-produit.quiz-order', order);
    return order;
  })();
  /** Sur ordinateur : les notions se déposent sur le schéma du double diamant (téléphone : liste à cocher). */
  const wideQuiz = () => matchMedia('(min-width: 760px) and (pointer: fine)').matches;
  let pickedTool = null; // notion choisie au clic, en attendant une zone
  const qchip = (t) => `<button type="button" class="qchip tchip tchip--${t} ${pickedTool === t ? 'is-picked' : ''}" data-drag="qtool:${t}" data-qtool="${t}" aria-pressed="${pickedTool === t}">
      ${esc(TOOLS[t].name)}</button>`;
  function diamondQuiz() {
    const at = (zone) => toolOrder.filter((t) => (quizDraft.placement[t] === 'deliver' ? 'develop' : quizDraft.placement[t] ?? '') === zone);
    const loose = toolOrder.filter((t) => !PLACES.some((p) => p.id === quizDraft.placement[t]));
    const phase = (p) => `<div class="qzone qzone--${p.id} ${p.wide ? 'qzone--wide' : ''}" data-qzone="${p.id}" data-drop="qzone:${p.id}"><strong>${esc(p.label)}</strong><small>${esc(p.plain)}</small>
      <div class="qzone-chips">${at(p.id).map(qchip).join('')}</div></div>`;
    const all = PLACES.find((p) => p.id === 'all');
    return `<div class="qdiamond" id="qt-diamond">
      <p class="hint">Glissez chaque notion à sa place (ou cliquez sur une notion, puis sur une zone). Le grand cadre, c'est tout le double diamant.</p>
      <div class="qtray" data-qzone="" data-drop="qzone:">${loose.length ? loose.map(qchip).join('') : '<span class="hint">Toutes les notions sont placées.</span>'}</div>
      <div class="qzone qzone--all qall" data-qzone="all" data-drop="qzone:all">
        <div class="qall-head"><strong>${esc(all.label)}</strong><small>${esc(all.plain)}</small><div class="qzone-chips">${at('all').map(qchip).join('')}</div></div>
        <div class="qphases">
          <svg class="qphases-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0.5 50 L25 1 L49.5 50 L25 99 Z M50.5 50 L75 1 L99.5 50 L75 99 Z"/></svg>
          ${QUIZ_ZONES.map(phase).join('')}</div>
      </div>
    </div>`;
  }
  function placeTool(t, zone) {
    if (!toolOrder.includes(t)) return;
    if (zone) quizDraft.placement[t] = zone; else delete quizDraft.placement[t];
    pickedTool = null;
    save(QUIZ_KEY, quizDraft);
    api.render();
  }

  /** Ce qui manque : les notions à placer (par leur nom), les situations (numérotées de 1 à 8). */
  const listFr = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} et ${items.at(-1)}` : String(items[0]));
  function missingMessage() {
    const tools = toolOrder.filter((t) => !PLACES.some((pl) => pl.id === quizDraft.placement[t])).map((t) => TOOLS[t].name);
    const sits = SITUATIONS.map((x, i) => (SITUATION_CHOICES.includes(quizDraft.answers[x.id]) ? 0 : i + 1)).filter(Boolean);
    const parts = [];
    if (tools.length) parts.push(`à placer ${listFr(tools)} sur le double diamant`);
    if (sits.length) parts.push(`à répondre ${sits.length > 1 ? 'aux situations' : 'à la situation'} ${listFr(sits)}`);
    return parts.length ? `Il vous reste ${parts.join(', et ')} avant de pouvoir valider.` : '';
  }
  const quizLeft = () => (meta?.quizEndsAt ? Math.max(0, meta.quizEndsAt - (Date.now() + (shared.offset ?? 0))) : null);

  /* ---------- Écrans avant le tableau ---------- */

  hooks.author = () => author;
  hooks.screen = () => {
    if (phase === 'loading') return card('Connexion…', '');
    if (phase === 'message') return card(note.title, note.text);
    if (phase === 'join') return joinScreen();
    if (phase === 'name') return nameScreen();
    // Prêt : il faut un groupe pour travailler sur un tableau.
    if (BOARD_STEPS.includes(meta?.step) && !shared.myGroup) {
      return card('Un instant…', 'L\'animateur vous place dans un groupe. Le tableau s\'affichera tout seul.');
    }
    return null;
  };
  hooks.debriefView = debriefView;
  /** « Nous avons terminé » (ou on reprend) pour son groupe, à l'étape en cours. */
  hooks.setDone = (done) => (shared.myGroup ? store.setDone(sid, shared.myGroup, api.state.step, done) : Promise.reject(new Error('no-group')));

  const card = (title, text) => `<section class="pcard pcard--center"><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}</section>`;

  function joinScreen() {
    return `<section class="pcard pcard--center">
      <p class="kicker">Atelier Produit</p>
      <h1>Rejoindre un atelier</h1>
      <p>Saisissez le code affiché à l'écran.</p>
      <form class="pform" id="codeform">
        <label class="field-wrap"><span class="field-label">Code de l'atelier</span>
          <input class="field pcode" name="code" maxlength="${CODE_LENGTH + 2}" autocomplete="off" autocapitalize="characters" spellcheck="false" required aria-describedby="code-error"></label>
        <p class="perror" id="code-error" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary btn-block">Rejoindre</button>
      </form>
    </section>`;
  }

  function nameScreen() {
    return `<section class="pcard pcard--center">
      <p class="kicker">Atelier Produit</p>
      <h1>Bienvenue !</h1>
      <p>Vous allez travailler en groupe sur les tableaux de l'atelier. Votre prénom s'affichera sur vos post-its.</p>
      <form class="pform" id="nameform">
        <label class="field-wrap"><span class="field-label">Votre prénom</span>
          <input class="field" name="author" maxlength="${MAX_AUTHOR}" autocomplete="given-name" required value="${esc(author)}" ${nameError ? 'aria-invalid="true" aria-describedby="name-error"' : ''}></label>
        ${nameError ? `<p class="perror" id="name-error" role="alert">${esc(nameError)}</p>` : ''}
        <button type="submit" class="btn btn-primary btn-block">C'est parti</button>
      </form>
    </section>`;
  }

  function show(newPhase, extra) {
    phase = newPhase;
    if (extra) note = extra;
    api.render();
    main.querySelector('input:not([type=radio])')?.focus();
  }

  /* ---------- Quiz du débrief ---------- */

  function debriefView() {
    if (!meta || meta.quiz === 'off') {
      return '<section class="pcard"><p class="lede">Le débrief commence : suivez l\'écran commun.</p></section>';
    }
    let body;
    if (meta.quiz === 'open' && !myQuiz) {
      body = `<p class="lede">Chacun répond de son côté. Les réponses seront révélées ensemble, avec la correction et le podium.</p>${quizForm()}`;
    } else if (meta.quiz === 'open') {
      body = '<p class="pwait">C\'est envoyé ! Attendez que l\'animateur révèle les réponses : votre correction s\'affichera ici.</p>';
    } else if (myQuiz) {
      body = quizCorrection();
    } else {
      body = '<p class="lede">Les réponses sont révélées : regardez l\'écran commun.</p>';
    }
    return `<section class="pcard pquiz-card">
      <p class="kicker">Débrief · quiz</p>
      <h2 class="pquiz-title">${meta.quiz === 'revealed' && myQuiz ? 'Votre correction' : 'À vous de jouer'}</h2>
      ${body}
    </section>`;
  }

  function quizForm() {
    const done = quizProgress(quizDraft);
    return `<form class="pform pquiz" id="quizform">
      <div class="pprogress" aria-live="polite"><p><span id="qprogress">${done} / ${QUIZ_QUESTIONS}</span> réponses${quizLeft() !== null ? ` · <span class="pq-clock" id="qclock">${formatClock(quizLeft())}</span>` : ''}</p>
        <i><b id="qbar" style="width:${(done / QUIZ_QUESTIONS) * 100}%"></b></i></div>
      <h3 class="pq-title">Le double diamant <span class="pq-points">4 points</span></h3>
      <p class="hint">Où se range chaque notion ? Un point par notion bien placée.</p>
      ${wideQuiz() ? diamondQuiz() : toolOrder.map((t) => `<fieldset class="pq" id="qt-${t}">
        <legend><span class="tchip tchip--${t}">${esc(TOOLS[t].name)}</span></legend>
        <div class="pq-choices pq-choices--phases">${QUIZ_CHOICES.map((p) => `<label class="pq-choice"><input type="radio" name="t:${t}" value="${p.id}" ${(quizDraft.placement[t] === 'deliver' ? 'develop' : quizDraft.placement[t]) === p.id ? 'checked' : ''}>
          <span><strong>${esc(p.label)}</strong><small>${esc(p.plain)}</small></span></label>`).join('')}</div>
      </fieldset>`).join('')}
      <h3 class="pq-title">Les situations <span class="pq-points">8 points</span></h3>
      <p class="hint">Quel outil pour quelle situation ?</p>
      ${SITUATIONS.map((x, k) => `<fieldset class="pq" id="qs${k + 1}">
        <legend><span class="pq-n">${k + 1}</span>${esc(x.text)}</legend>
        <div class="pq-choices">${SITUATION_CHOICES.map((c) => `<label class="pq-choice"><input type="radio" name="s:${x.id}" value="${c}" ${quizDraft.answers[x.id] === c ? 'checked' : ''}>
          <span><strong>${esc(CHOICE_LABELS[c])}</strong></span></label>`).join('')}</div>
      </fieldset>`).join('')}
      <p class="hint">Une fois validées, vos réponses ne peuvent plus changer. À la fin du temps, ce que vous avez coché est envoyé tout seul.</p>
      <p class="pq-missing" id="qmissing" role="alert" hidden></p>
      <button type="submit" class="btn btn-primary btn-block" id="qsubmit" ${sending ? 'disabled' : ''}>${sending ? 'Envoi…' : 'Valider mes réponses'}</button>
    </form>`;
  }

  function quizCorrection() {
    const sc = quizScore(myQuiz);
    const verdictLabel = { right: 'Oui, c\'est le plus adapté.', ok: 'Défendable (½ point).', wrong: 'Pas le meilleur choix.' };
    return `<div class="pscore"><strong>${fmt(sc.points)}</strong> / ${QUIZ_MAX}<span>Votre score</span></div>
      <h3 class="pq-title">Le double diamant</h3>
      <ul class="pcorr">${sc.tools.map((t) => `<li class="dresult ${t.ok ? 'is-right' : 'is-wrong'}">
        <p class="dresult-head"><span class="tchip tchip--${t.tool}">${esc(TOOLS[t.tool].name)}</span> <span>vous : <strong>${esc(phaseLabel(t.phase))}</strong></span></p>
        <p class="dresult-verdict">${t.ok ? 'Bien vu.' : `Sa place : ${esc([...new Set(TOOL_PHASES[t.tool].map(phaseLabel))].join(' et '))}.`}</p>
        ${PLACEMENT_FEEDBACK[t.tool][t.phase] ? `<p>${esc(PLACEMENT_FEEDBACK[t.tool][t.phase])}</p>` : ''}
      </li>`).join('')}</ul>
      <h3 class="pq-title">Les situations</h3>
      <ol class="pcorr">${sc.situations.map((v, k) => {
        const x = SITUATIONS.find((y) => y.id === v.id);
        const best = v.level === 'right' ? '' : `<p><strong>Le plus adapté : ${esc(CHOICE_LABELS[x.answer])}.</strong> ${esc(x.why)}</p>`;
        return `<li class="situation is-${v.level}">
          <p class="situation-text"><span class="situation-n">${k + 1}</span>${esc(x.text)}</p>
          <p class="pyou">Votre réponse : <strong>${esc(CHOICE_LABELS[v.choice])}</strong></p>
          <div class="verdict verdict--${v.level}"><p><strong>${verdictLabel[v.level]}</strong> ${esc(v.text)}</p>${best}</div>
        </li>`;
      }).join('')}</ol>`;
  }

  function updateQuizProgress() {
    const done = quizProgress(quizDraft);
    const p = $('#qprogress');
    if (p) p.textContent = `${done} / ${QUIZ_QUESTIONS}`;
    const bar = $('#qbar');
    if (bar) bar.style.width = `${(done / QUIZ_QUESTIONS) * 100}%`;
    const btn = $('#qsubmit');
    if (btn) btn.disabled = sending;
    const miss = $('#qmissing');
    if (miss && !miss.hidden) {
      const msg = missingMessage();
      miss.hidden = !msg;
      if (msg) miss.textContent = msg;
    }
  }

  /** Envoie la copie : complète (bouton), ou telle quelle à la fin du temps (les manques comptent zéro). */
  async function sendQuiz({ partial = false } = {}) {
    if (sending) return;
    const payload = quizPayload({ author, ...quizDraft }, { partial });
    if (!payload) {
      const miss = $('#qmissing');
      if (miss) { miss.hidden = false; miss.textContent = missingMessage(); }
      return;
    }
    sending = true;
    updateQuizProgress();
    try {
      await store.submitQuiz(sid, payload);
      toast(partial ? 'Temps écoulé : vos réponses ont été envoyées.' : 'Réponses envoyées !');
      window.scrollTo({ top: 0 });
    } catch {
      if (!partial) toast('Envoi refusé : le quiz est peut-être fermé, ou vous avez déjà répondu.');
    }
    sending = false;
    updateQuizProgress();
  }

  // Compte à rebours du quiz ; à zéro, la copie part toute seule.
  setInterval(() => {
    if (meta?.quiz !== 'open' || myQuiz) return;
    const left = quizLeft();
    if (left === null) return;
    const clock = $('#qclock');
    if (clock) { clock.textContent = formatClock(left); clock.classList.toggle('is-low', left <= 30000); }
    if (left === 0 && !autoSent && author) { autoSent = true; sendQuiz({ partial: true }); }
  }, 1000);

  /* ---------- Saisies (code, prénom, quiz) ---------- */

  // Quiz sur ordinateur : glisser une notion sur le diamant (glisser-déposer de l'atelier), ou cliquer la notion puis la zone.
  hooks.placeQuizTool = (t, zone) => placeTool(t, zone);
  main.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-qtool]');
    if (chip) { e.preventDefault(); pickedTool = pickedTool === chip.dataset.qtool ? null : chip.dataset.qtool; api.render(); return; }
    const zone = e.target.closest('[data-qzone]');
    if (zone && pickedTool) placeTool(pickedTool, zone.dataset.qzone);
  });

  main.addEventListener('change', (e) => {
    const [kind, id] = String(e.target.name).split(':');
    if (kind !== 't' && kind !== 's') return;
    (kind === 't' ? quizDraft.placement : quizDraft.answers)[id] = e.target.value;
    save(QUIZ_KEY, quizDraft);
    updateQuizProgress();
  });

  main.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!['codeform', 'nameform', 'quizform'].includes(form.id)) return;
    e.preventDefault();
    if (form.id === 'codeform') {
      const code = normalizeCode(form.elements.code.value);
      const fail = (text) => { const p = $('#code-error'); p.textContent = text; p.hidden = false; };
      if (!isCode(code)) { fail(`Le code fait ${CODE_LENGTH} caractères, lettres et chiffres.`); return; }
      const found = await store.resolveCode(code);
      if (found) location.replace(`./?atelier=${found}`);
      else fail('Aucun atelier avec ce code. Vérifiez-le sur l\'écran.');
      return;
    }
    if (form.id === 'nameform') {
      const value = form.elements.author.value.replace(/\s+/g, ' ').trim().slice(0, MAX_AUTHOR);
      if (!value) return;
      if (await takeName(value)) enterRoom();
      else show('name');
      return;
    }
    sendQuiz();
  });

  /** Réserve le prénom (unique dans la salle), libère l'ancien et se déclare présent. */
  async function takeName(value) {
    const key = nameKey(value);
    if (!key) { nameError = 'Utilisez au moins une lettre ou un chiffre.'; return false; }
    try {
      await store.claimName(sid, key);
    } catch {
      nameError = `« ${value} » est déjà pris dans cette salle : ajoutez une initiale (par exemple « ${value} B. »).`;
      return false;
    }
    const previous = load(NAME_KEY);
    if (previous && previous !== key) store.releaseName(sid, previous);
    save(NAME_KEY, key);
    author = value;
    save(AUTHOR_KEY, author);
    nameError = '';
    leaveRoom?.();
    leaveRoom = store.goOnline(sid, author);
    return true;
  }

  /* ---------- Dans la salle : étape, groupe, tableaux, quiz ---------- */

  function badge() {
    const el = $('#me-badge');
    if (!el) return;
    el.hidden = false;
    el.innerHTML = `<strong>${esc(author)}</strong>${shared.myGroup && shared.groups === 2 ? ` · ${esc(groupName(shared.myGroup))}` : ''}`;
  }

  function watchBoard(g) {
    if (boardUnsubs[g]) return;
    boardUnsubs[g] = store.onBoard(sid, g, (tree) => api.receiveBoard(g, tree), () => {});
  }
  function unwatchBoard(g) {
    boardUnsubs[g]?.();
    delete boardUnsubs[g];
  }
  /** Pendant la restitution, on peut aussi regarder le tableau de l'autre groupe. */
  function syncBoards() {
    if (shared.group === 'sim' && !shared.restitution && shared.myGroup) api.showGroup(shared.myGroup);
    for (const g of ['g1', 'g2']) {
      const needed = g === shared.myGroup || (shared.restitution && shared.groups === 2);
      if (needed) watchBoard(g);
      else {
        unwatchBoard(g);
        if (shared.group === g && shared.myGroup) api.showGroup(shared.myGroup);
      }
    }
  }

  function enterRoom() {
    phase = 'ready';
    badge();
    api.render();
    store.onMyMember(sid, (g) => {
      if (g === shared.myGroup) return;
      shared.myGroup = g;
      badge();
      if (!g) { api.render(); return; }
      if (!shared.on) {
        api.enterShared({ write: (grp, u) => store.writeBoard(sid, grp, u), setState: (grp, k, v) => store.setBoardState(sid, grp, k, v), group: g });
      } else {
        api.showGroup(g);
      }
      syncBoards();
      api.render();
      announce(`Vous êtes dans le ${groupName(g)}`);
    });
    store.onKept(sid, (tree) => api.receiveKept(tree), () => {});
    store.onMyQuiz(sid, (raw) => {
      const payload = raw ? quizPayload(raw, { partial: true }) : null;
      const changed = !!payload !== !!myQuiz;
      myQuiz = payload;
      if (changed && meta?.step === 'debrief') api.render();
    });
  }

  /* ---------- Démarrage ---------- */

  api.render();
  if (!firebaseConfig) { show('message', { title: 'Participation non configurée', text: 'La participation à distance n\'est pas activée pour cet outil.' }); return; }
  try {
    const { createStore } = await import('./store.js?v=__VERSION__');
    store = createStore();
    await store.start();
    if (!isSessionId(sid)) {
      // Pas de lien direct : on rejoint par le code court (?code=QVZS, ou saisi).
      const code = normalizeCode(new URLSearchParams(location.search).get('code'));
      const found = isCode(code) ? await store.resolveCode(code) : null;
      if (found) { location.replace(`./?atelier=${found}`); return; }
      show('join');
      if (code) { const p = $('#code-error'); p.textContent = 'Aucun atelier avec ce code. Vérifiez-le sur l\'écran.'; p.hidden = false; }
      return;
    }
    meta = readMeta(await store.getMeta(sid));
    if (!meta) { show('message', { title: 'Atelier introuvable', text: 'Il est peut-être terminé. Demandez le lien à l\'animateur.' }); return; }
    shared.groups = meta.groups;
    shared.restitution = meta.restitution;
    shared.timer = meta.timer;
    shared.practice = meta.practice;
    shared.roti = meta.roti;
    shared.examples = meta.examples;
    shared.exercise = meta.exercise;
    store.onServerOffset((ms) => { shared.offset = ms; });
    api.setStep(meta.step);
    store.onMeta(sid, (raw) => {
      const next = readMeta(raw);
      if (!next) { show('message', { title: 'Atelier terminé', text: 'Merci pour votre participation !' }); return; }
      const quizChanged = next.quiz !== meta?.quiz;
      const revealed = next.quiz === 'revealed' && meta?.quiz !== 'revealed';
      meta = next;
      shared.groups = next.groups;
      shared.timer = next.timer;
      shared.practice = next.practice;
      shared.roti = next.roti;
      shared.examples = next.examples;
      shared.exercise = next.exercise;
      shared.restitution = next.restitution;
      if (phase !== 'ready') return;
      syncBoards();
      badge();
      if (next.step !== api.state.step) api.setStep(next.step);
      else api.render();
      if (revealed) window.scrollTo({ top: 0 });
      if (quizChanged && next.step === 'debrief') updateQuizProgress();
    });
    if (author && await takeName(author)) enterRoom();
    else show('name');
  } catch {
    show('message', { title: 'Connexion impossible', text: 'Le réseau bloque peut-être la connexion (VPN de l\'entreprise ?). Essayez hors VPN, ou depuis votre téléphone en 4G.' });
  }
}
