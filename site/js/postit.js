// Page participant (téléphone) : écrire des post-its pour l'étape en cours de l'atelier,
// puis répondre au quiz du débrief et recevoir sa correction personnalisée.
// Pas de compte : un prénom, mémorisé dans le navigateur. Chacun ne voit que ses propres post-its et sa copie.

import { firebaseConfig } from './firebase-config.js?v=__VERSION__';
import {
  readMeta, notePayload, flattenNotes, isSessionId, PHONE_ZONES, MAX_PHONE_TEXT,
  quizPayload, quizProgress, quizScore, QUIZ_QUESTIONS, QUIZ_MAX,
  nameKey, normalizeCode, isCode, CODE_LENGTH,
} from './session-core.js?v=__VERSION__';
import {
  STEPS, PHONE_STEPS, EMPATHY_ZONES, IMPACT_LEVELS, PHASES, PLACES, TOOL_PHASES, TOOLS, SITUATIONS, SITUATION_CHOICES, PLACEMENT_FEEDBACK,
} from './content.js?v=__VERSION__';
import { personaById, MAX_AUTHOR, TOOL_IDS } from './core.js?v=__VERSION__';
import { $, esc, load, save, toast, announce, setupTheme } from './shared.js?v=__VERSION__';

const AUTHOR_KEY = 'atelier-produit.author';
const main = $('#main');
const sid = new URLSearchParams(location.search).get('atelier');

let store = null;
let meta = null;
let mine = [];
let author = load(AUTHOR_KEY) ?? '';
let editingName = !author;
let nameError = '';
let leaveRoom = null; // retire la présence
const NAME_KEY = `atelier-produit.name.${sid}`; // clé du prénom réservé dans cette salle
const draft = { text: '', zone: '' };
let sending = false;

// Quiz : brouillon gardé dans le navigateur (un rechargement ne perd rien), copie envoyée lue dans la base.
const QUIZ_KEY = `atelier-produit.quiz.${sid}`;
const quizDraft = { placement: {}, answers: {}, ...(load(QUIZ_KEY) ?? {}) };
let myQuiz = null;
const CHOICE_LABELS = { empathy: 'Empathy map', impact: 'Impact mapping', story: 'Story mapping', designThinking: 'La démarche complète (Design Thinking)' };
const fmt = (n) => String(n).replace('.', ',');
const phaseLabel = (id) => PLACES.find((p) => p.id === id)?.label ?? '';
const inQuiz = () => meta?.step === 'debrief' && meta.quiz !== 'off';

const ZONE_INFO = {
  ...Object.fromEntries(EMPATHY_ZONES.map((z) => [z.id, { label: z.label, hint: z.question }])),
  ...Object.fromEntries(IMPACT_LEVELS.filter((l) => l.id !== 'goal').map((l) => [l.id, { label: l.name.replace(/s$/, ''), hint: l.question }])),
  story: { label: 'Story', hint: 'Ce que l\'utilisateur peut faire.' },
};
const HUES = { says: 205, thinks: 265, does: 150, feels: 330, pains: 6, gains: 44, actor: 205, impact: 28, deliverable: 150, story: 48 };
const PROMPTS = {
  empathy: (p) => `Qu'avez-vous compris de ${p.name} ? Une idée par post-it.`,
  impact: () => 'Un acteur, un changement de comportement ou un livrable : l\'animateur le placera dans l\'arbre.',
  story: () => 'Une story : ce qu\'un covoitureur pourrait faire avec l\'appli.',
};

function message(title, text) {
  main.innerHTML = `<section class="pcard"><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}</section>`;
}

function render() {
  if (editingName) { renderName(); return; }
  if (!meta) return;
  if (inQuiz()) { renderQuiz(); return; }
  const step = meta.step;
  const stepInfo = STEPS.find((s) => s.id === step);
  const open = PHONE_STEPS.includes(step) && !meta.closed;
  const zones = PHONE_ZONES[step] ?? [];
  if (!zones.includes(draft.zone)) draft.zone = zones.length === 1 ? zones[0] : '';
  const persona = personaById(meta.persona);

  let body;
  if (meta.closed) {
    body = '<p class="lede">Les envois sont fermés pour le moment. Gardez cette page ouverte.</p>';
  } else if (!open) {
    body = `<p class="lede">${step === 'frame' ? 'L\'atelier n\'a pas encore commencé. Gardez cette page ouverte : elle suivra l\'écran.' : 'Pas de post-it à cette étape : suivez ce qui se passe à l\'écran.'}</p>`;
  } else {
    body = `
      ${step === 'empathy' && persona ? `<p class="pfor" style="--h:${persona.hue}"><span class="avatar avatar--sm" style="--h:${persona.hue}" aria-hidden="true">${esc(persona.name[0])}</span><span>Carte de <strong>${esc(persona.name)}</strong>, ${esc(persona.role.toLowerCase())}</span></p>` : ''}
      <p class="hint">${esc(PROMPTS[step](persona))}</p>
      <form class="pform" id="pform">
        ${zones.length > 1 ? `<fieldset class="pzones"><legend class="field-label">Où va ce post-it ?</legend>
          ${zones.map((z) => `<label class="pzone" style="--h:${HUES[z]}"><input type="radio" name="zone" value="${z}" ${draft.zone === z ? 'checked' : ''} required>
            <span><strong>${esc(ZONE_INFO[z].label)}</strong><small>${esc(ZONE_INFO[z].hint)}</small></span></label>`).join('')}
        </fieldset>` : ''}
        <label class="field-wrap"><span class="field-label">Votre post-it</span>
          <textarea class="field pnote" name="text" rows="3" maxlength="${MAX_PHONE_TEXT}" required style="--h:${HUES[draft.zone] ?? 48}">${esc(draft.text)}</textarea>
          <span class="pcount" id="pcount">${draft.text.length} / ${MAX_PHONE_TEXT}</span></label>
        <button type="submit" class="btn btn-primary btn-block" ${sending ? 'disabled' : ''}>${sending ? 'Envoi…' : 'Envoyer sur l\'écran'}</button>
      </form>`;
  }

  const recent = [...mine].reverse();
  main.innerHTML = `
    <section class="pcard">
      <p class="kicker">Étape en cours</p>
      <h1>${esc(stepInfo?.label ?? '')}</h1>
      ${body}
    </section>
    ${recent.length ? `<section class="pmine">
      <h2>Mes post-its envoyés <span class="count">${recent.length}</span></h2>
      <ul>${recent.map((n) => `<li class="pmine-item" style="--h:${HUES[n.zone] ?? 48}"><span>${esc(n.text)}</span><small>${esc(STEPS.find((s) => s.id === n.step)?.label ?? '')} · ${esc(ZONE_INFO[n.zone]?.label ?? '')}</small></li>`).join('')}</ul>
    </section>` : ''}
    <p class="pwho">Envoyé en tant que <strong>${esc(author)}</strong> · <button type="button" class="link-btn" data-rename>changer</button></p>`;
}

/* ---------- Quiz ---------- */

function quizForm() {
  const done = quizProgress(quizDraft);
  return `<form class="pform pquiz" id="quizform">
    <div class="pprogress" aria-live="polite"><p><span id="qprogress">${done} / ${QUIZ_QUESTIONS}</span> réponses</p>
      <i><b id="qbar" style="width:${(done / QUIZ_QUESTIONS) * 100}%"></b></i></div>
    <h2 class="pq-title">1. Où se range chaque notion sur le double diamant ?</h2>
    ${TOOL_IDS.map((t) => `<fieldset class="pq">
      <legend><span class="tchip tchip--${t}">${esc(TOOLS[t].name)}</span></legend>
      <div class="pq-choices pq-choices--phases">${PLACES.map((p) => `<label class="pq-choice"><input type="radio" name="t:${t}" value="${p.id}" ${quizDraft.placement[t] === p.id ? 'checked' : ''}>
        <span><strong>${esc(p.label)}</strong><small>${esc(p.plain)}</small></span></label>`).join('')}</div>
    </fieldset>`).join('')}
    <h2 class="pq-title">2. Quel outil pour quelle situation ?</h2>
    ${SITUATIONS.map((x, k) => `<fieldset class="pq">
      <legend><span class="pq-n">${k + 1}</span>${esc(x.text)}</legend>
      <div class="pq-choices">${SITUATION_CHOICES.map((c) => `<label class="pq-choice"><input type="radio" name="s:${x.id}" value="${c}" ${quizDraft.answers[x.id] === c ? 'checked' : ''}>
        <span><strong>${esc(CHOICE_LABELS[c])}</strong></span></label>`).join('')}</div>
    </fieldset>`).join('')}
    <p class="hint">Une fois validées, vos réponses ne peuvent plus changer.</p>
    <button type="submit" class="btn btn-primary btn-block" id="qsubmit" ${done === QUIZ_QUESTIONS && !sending ? '' : 'disabled'}>${sending ? 'Envoi…' : 'Valider mes réponses'}</button>
  </form>`;
}

function quizCorrection() {
  const sc = quizScore(myQuiz);
  const verdictLabel = { right: 'Oui, c\'est le plus adapté.', ok: 'Défendable (½ point).', wrong: 'Pas le meilleur choix.' };
  return `<div class="pscore"><strong>${fmt(sc.points)}</strong> / ${QUIZ_MAX}<span>Votre score</span></div>
    <h2 class="pq-title">1. Les notions sur le double diamant</h2>
    <ul class="pcorr">${sc.tools.map((t) => `<li class="dresult ${t.ok ? 'is-right' : 'is-wrong'}">
      <p class="dresult-head"><span class="tchip tchip--${t.tool}">${esc(TOOLS[t.tool].name)}</span> <span>vous : <strong>${esc(phaseLabel(t.phase))}</strong></span></p>
      <p class="dresult-verdict">${t.ok ? 'Bien vu.' : `Sa place : ${esc(TOOL_PHASES[t.tool].map(phaseLabel).join(' et '))}.`}</p>
      <p>${esc(PLACEMENT_FEEDBACK[t.tool][t.phase])}</p>
    </li>`).join('')}</ul>
    <h2 class="pq-title">2. Les situations</h2>
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

function renderQuiz() {
  let body;
  if (meta.quiz === 'open' && !myQuiz) {
    body = `<p class="lede">Chacun répond dans son coin. Les réponses seront révélées ensemble, avec la correction et le podium.</p>${quizForm()}`;
  } else if (meta.quiz === 'open') {
    body = '<p class="pwait">C\'est envoyé ! Attendez que l\'animateur révèle les réponses : votre correction s\'affichera ici.</p>';
  } else if (myQuiz) {
    body = quizCorrection();
  } else {
    body = '<p class="lede">Les réponses sont révélées : regardez l\'écran.</p>';
  }
  main.innerHTML = `
    <section class="pcard">
      <p class="kicker">Débrief · quiz</p>
      <h1>${meta.quiz === 'revealed' && myQuiz ? 'Votre correction' : 'À vous de jouer'}</h1>
      ${body}
    </section>
    <p class="pwho">Vous jouez en tant que <strong>${esc(author)}</strong>${myQuiz ? '' : ' · <button type="button" class="link-btn" data-rename>changer</button>'}</p>`;
}

function updateQuizProgress() {
  const done = quizProgress(quizDraft);
  const p = $('#qprogress');
  if (p) p.textContent = `${done} / ${QUIZ_QUESTIONS}`;
  const bar = $('#qbar');
  if (bar) bar.style.width = `${(done / QUIZ_QUESTIONS) * 100}%`;
  const btn = $('#qsubmit');
  if (btn) btn.disabled = done !== QUIZ_QUESTIONS || sending;
}

/**
 * Réserve le prénom dans la salle (unique, accents et majuscules ignorés), libère l'ancien,
 * puis se déclare présent. Renvoie faux si le prénom est pris.
 */
async function takeName(value) {
  const key = nameKey(value);
  if (!key) { nameError = 'Utilisez au moins une lettre ou un chiffre.'; editingName = true; return false; }
  try {
    await store.claimName(sid, key);
  } catch {
    nameError = `« ${value} » est déjà pris dans cette salle : ajoutez une initiale (par exemple « ${value} ${'B'}. »).`;
    editingName = true;
    return false;
  }
  const previous = load(NAME_KEY);
  if (previous && previous !== key) store.releaseName(sid, previous);
  save(NAME_KEY, key);
  author = value;
  save(AUTHOR_KEY, author);
  nameError = '';
  editingName = false;
  leaveRoom?.();
  leaveRoom = store.goOnline(sid, author);
  return true;
}

function codeError(text) {
  const p = $('#code-error');
  if (p) { p.textContent = text; p.hidden = false; }
  $('input[name=code]', main)?.setAttribute('aria-invalid', 'true');
}

function renderJoin() {
  main.innerHTML = `<section class="pcard">
    <p class="kicker">Atelier Produit</p>
    <h1>Rejoindre un atelier</h1>
    <p>Saisissez le code affiché à l'écran, ou scannez le QR code.</p>
    <form class="pform" id="codeform">
      <label class="field-wrap"><span class="field-label">Code de l'atelier</span>
        <input class="field pcode" name="code" maxlength="${CODE_LENGTH + 2}" autocomplete="off" autocapitalize="characters" spellcheck="false" required inputmode="text" aria-describedby="code-error"></label>
      <p class="perror" id="code-error" role="alert" hidden></p>
      <button type="submit" class="btn btn-primary btn-block">Rejoindre</button>
    </form>
  </section>`;
  main.querySelector('input').focus();
}

function renderName() {
  main.innerHTML = `<section class="pcard">
    <p class="kicker">Atelier Produit</p>
    <h1>Bienvenue !</h1>
    <p>Vos post-its apparaîtront sur l'écran de l'atelier, avec votre prénom.</p>
    <form class="pform" id="nameform">
      <label class="field-wrap"><span class="field-label">Votre prénom</span>
        <input class="field" name="author" maxlength="${MAX_AUTHOR}" autocomplete="given-name" required value="${esc(author)}" ${nameError ? 'aria-invalid="true" aria-describedby="name-error"' : ''}></label>
      ${nameError ? `<p class="perror" id="name-error" role="alert">${esc(nameError)}</p>` : ''}
      <button type="submit" class="btn btn-primary btn-block">C'est parti</button>
    </form>
  </section>`;
  main.querySelector('input').focus();
}

main.addEventListener('input', (e) => {
  if (e.target.name === 'text') {
    draft.text = e.target.value;
    const c = $('#pcount');
    if (c) c.textContent = `${draft.text.length} / ${MAX_PHONE_TEXT}`;
  }
});

main.addEventListener('change', (e) => {
  const [kind, id] = String(e.target.name).split(':');
  if (kind === 't' || kind === 's') {
    (kind === 't' ? quizDraft.placement : quizDraft.answers)[id] = e.target.value;
    save(QUIZ_KEY, quizDraft);
    updateQuizProgress();
    return;
  }
  if (e.target.name === 'zone') {
    draft.zone = e.target.value;
    $('.pnote', main)?.style.setProperty('--h', HUES[draft.zone] ?? 48);
  }
});

main.addEventListener('click', (e) => {
  if (e.target.closest('[data-rename]')) { editingName = true; render(); }
});

main.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.target.id === 'nameform') {
    const value = e.target.elements.author.value.replace(/\s+/g, ' ').trim().slice(0, MAX_AUTHOR);
    if (!value) return;
    if (await takeName(value)) render();
    else { renderName(); }
    return;
  }
  if (e.target.id === 'codeform') {
    const code = normalizeCode(e.target.elements.code.value);
    if (!isCode(code)) { codeError(`Le code fait ${CODE_LENGTH} caractères, lettres et chiffres.`); return; }
    const found = await store.resolveCode(code);
    if (found) location.replace(`postit.html?atelier=${found}`);
    else codeError('Aucun atelier avec ce code. Vérifiez-le sur l\'écran.');
    return;
  }
  if (e.target.id === 'quizform') {
    if (sending) return;
    const payload = quizPayload({ author, ...quizDraft });
    if (!payload) { toast('Répondez à toutes les questions avant de valider.'); return; }
    sending = true;
    updateQuizProgress();
    try {
      await store.submitQuiz(sid, payload);
      toast('Réponses envoyées !');
      window.scrollTo({ top: 0 });
    } catch {
      toast('Envoi refusé : le quiz est peut-être fermé, ou vous avez déjà répondu.');
    }
    sending = false;
    updateQuizProgress();
    return;
  }
  if (e.target.id !== 'pform' || sending) return;
  const payload = notePayload({ author, step: meta.step, zone: draft.zone, persona: meta.persona, text: draft.text });
  if (!payload) { toast(draft.zone ? 'Écrivez quelque chose avant d\'envoyer.' : 'Choisissez où va ce post-it.'); return; }
  sending = true;
  render();
  try {
    await store.sendNote(sid, payload);
    draft.text = '';
    toast('Envoyé sur l\'écran !');
    announce('Post-it envoyé');
  } catch {
    toast('Envoi refusé : l\'étape a peut-être changé, ou les envois sont fermés.');
  }
  sending = false;
  render();
  $('.pnote', main)?.focus();
});

async function startPage() {
  setupTheme($('#theme-toggle'));
  if (!firebaseConfig) { message('Envoi non configuré', 'L\'envoi de post-its depuis les téléphones n\'est pas activé pour cet outil.'); return; }
  try {
    const { createStore } = await import('./store.js?v=__VERSION__');
    store = createStore();
    await store.start();
    if (!isSessionId(sid)) {
      // Pas de lien direct : on rejoint par le code court (?code=K7PM ou saisi).
      const code = normalizeCode(new URLSearchParams(location.search).get('code'));
      const found = isCode(code) ? await store.resolveCode(code) : null;
      if (found) { location.replace(`postit.html?atelier=${found}`); return; }
      renderJoin();
      if (code) codeError('Aucun atelier avec ce code. Vérifiez-le sur l\'écran.');
      return;
    }
    const first = readMeta(await store.getMeta(sid));
    if (!first) { message('Atelier introuvable', 'Il est peut-être terminé. Demandez le lien à l\'animateur.'); return; }
    meta = first;
    if (author) await takeName(author); // réserve le prénom mémorisé (ou demande d'en changer)
    render();
    store.onMeta(sid, (raw) => {
      const next = readMeta(raw);
      if (!next) { message('Atelier terminé', 'Merci pour votre participation !'); meta = null; return; }
      const changed = !meta || next.step !== meta.step || next.closed !== meta.closed || next.persona !== meta.persona || next.quiz !== meta.quiz;
      if (changed && next.quiz === 'revealed' && meta?.quiz !== 'revealed') window.scrollTo({ top: 0 });
      meta = next;
      if (changed && !main.contains(document.activeElement)) render();
      else if (changed) { const t = draft.text; render(); draft.text = t; }
    });
    store.onMyQuiz(sid, (raw) => {
      const payload = raw ? quizPayload(raw) : null;
      const changed = !!payload !== !!myQuiz;
      myQuiz = payload;
      if (changed && !editingName && meta && inQuiz()) render();
    });
    store.onMyNotes(sid, (tree) => {
      mine = flattenNotes({ me: tree });
      if (!editingName && meta && !inQuiz()) {
        const focused = document.activeElement?.name === 'text';
        render();
        if (focused) $('.pnote', main)?.focus();
      }
    });
  } catch {
    message('Connexion impossible', 'Le réseau bloque peut-être la connexion (VPN de l\'entreprise ?). Essayez en 4G ou sur un autre Wi-Fi.');
  }
}

startPage();
