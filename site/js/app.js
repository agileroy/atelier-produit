// Écran de l'animateur : le parcours guidé en cinq étapes, projeté devant l'équipe.
// L'état vit dans le navigateur (localStorage) ; les post-its des téléphones arrivent par phones.js.

import {
  STEPS, CASE, PERSONAS, EMPATHY_ZONES, IMPACT_LEVELS, STORY_LANES, TOOLS, PHASES, PLACES, ALL_PLACE, TOOL_PHASES,
  STEP_PHASES, BRIEFS, SITUATIONS, SITUATION_CHOICES, PHONE_STEPS, DIAMOND_MESSAGE, DIAMOND_LOOP,
  PLACEMENT_FEEDBACK, EXAMPLE_CASE, IMPACT_EXAMPLE, STORY_EXAMPLE, EXAMPLE_JOURNEY,
  JOURNEY_RULES, JOURNEY_QUESTIONS, JOURNEY_MIN, JOURNEY_MAX,
} from './content.js?v=__VERSION__';
import {
  newState, setStep, nextStep, prevStep, stepIndex, addNote, updateNote, moveNote, moveBlocker, removeNote,
  notesIn, getNote, childrenOf, placesFor, encodePlace, decodePlace, samePlace, familyOf, placeLabel,
  availableExtracts, placeExtract, unplaceExtract, extractById, compareEmpathy, emptyZones, personaById,
  toggleKeep, keptDeliverables, importDeliverable, mvpGaps,
  useJourneyExample, validateJourney, reopenJourney, journeyNotes, journeyDone, journeyHints, simulatedNotes,
  setPlacement, checkPlacement, answerSituation, situationScore, situationVerdict, mergeRemote, reportText,
  boardUpdates, recordsToNotes,
  serialize, parseSaved, sanitize, toolName, TOOL_IDS, MAX_TEXT,
} from './core.js?v=__VERSION__';
import { $, $$, esc, toast, announce, copyText, load, save, setupTheme, downloadJson, today, qrSvg, ICONS } from './shared.js?v=__VERSION__';
import {
  podium, quizStats, waitingFor, QUIZ_MAX, groupIdsFor, groupName, DEFAULT_PERSONAS,
  TIMER_STEPS, stepDuration, timerLeft, timerRunning, startTimer, pauseTimer, resumeTimer, addTime, autoRestitution, formatClock,
} from './session-core.js?v=__VERSION__';
import { setupDnd } from './dnd.js?v=__VERSION__';
import { createPhones } from './phones.js?v=__VERSION__';

/** Animateur (index.html) ou participant (index.html?code=…) : même interface, droits différents. */
export const HOST = document.body.dataset.mode !== 'participant';
const STORE_KEY = HOST ? 'atelier-produit.state' : 'atelier-produit.participant';
const STEP_TOOL = { frame: 'designThinking', empathy: 'empathy', impact: 'impact', story: 'story', debrief: 'designThinking' };
const STEP_NUMBER = { empathy: 1, impact: 2, story: 3 };
const ZONE_HUES = { says: 205, thinks: 265, does: 150, feels: 330, pains: 6, gains: 44 };
const KIND_HUES = { goal: 262, actor: 205, impact: 28, deliverable: 150 };
const CHOICE_LABELS = { empathy: 'Empathy map', impact: 'Impact mapping', story: 'Story mapping', designThinking: 'La démarche complète (Design Thinking)' };

const main = $('#main');
let state = restore();
const ui = { selectedTool: null, info: null, frameTheory: true, quizEntries: [] };
let phones = null; // animateur : module Participants
const hooks = {}; // participant : vues fournies par participant.js (débrief, attente)

/* ---------- Tableaux partagés (un par groupe) ----------
   Dès que l'animateur ouvre la séance, ou pour un participant, les post-its ne vivent plus dans le
   navigateur : chaque groupe a son tableau dans la base. state.notes reflète le tableau affiché. */

const shared = {
  on: false,
  group: 'g1', // tableau affiché
  myGroup: null, // participant : son groupe
  groups: 2,
  restitution: false,
  boards: { g1: { notes: [], state: {} }, g2: { notes: [], state: {} }, sim: { notes: [], state: {} } },
  synced: { g1: [], g2: [] },
  kept: [], // livrables étoilés, communs : [{ id, text, group }]
  write: null, // (groupe, mises à jour) => Promise
  setState: null, // (groupe, clé, valeur) => Promise
  localNotes: null, // animateur : son tableau local, mis de côté pendant la séance
  lastKept: '',
};

/**
 * Peut-on modifier le tableau affiché ? L'animateur partout (sauf le groupe simulé) ; un participant
 * dans son groupe seulement, et plus pendant la restitution.
 */
const canEdit = () => !shared.on || (shared.group !== 'sim' && (HOST || (shared.group === shared.myGroup && !shared.restitution)));
const clone = (x) => structuredClone(x);
const groupPersona = (g) => shared.boards[g]?.state?.persona ?? DEFAULT_PERSONAS[g] ?? 'karim';
const otherPersona = (id) => (id === 'sophie' ? 'karim' : 'sophie');

/**
 * Séance à un seul groupe : un groupe simulé a travaillé l'autre persona. Son tableau, calculé ici
 * (jamais écrit dans la base), sert de point de comparaison à la restitution.
 */
function refreshSim() {
  const p = otherPersona(groupPersona('g1'));
  if (shared.boards.sim.state.persona === p) return;
  shared.boards.sim = { notes: simulatedNotes(p), state: { persona: p } };
  if (shared.group === 'sim') showGroup('sim');
}

/** Les tableaux qu'on peut afficher : les deux groupes, ou le groupe et le groupe simulé. */
function boardGroups() {
  if (shared.groups === 2) return ['g1', 'g2'];
  return HOST || shared.restitution ? ['g1', 'sim'] : ['g1'];
}
const boardLabel = (g) => `${g === 'sim' ? 'Groupe simulé' : shared.groups === 1 ? 'Votre groupe' : groupName(g)} · ${personaById(groupPersona(g))?.name ?? ''}`;

function simNotice() {
  const name = personaById(groupPersona('sim'))?.name ?? '';
  return `<p class="sim-notice">Groupe simulé : le travail d'un groupe imaginaire sur ${esc(name)}, pour comparer avec le vôtre. Lecture seule.</p>`;
}

function showGroup(g) {
  shared.group = g;
  state.notes = clone(shared.boards[g].notes);
  state.persona = groupPersona(g);
  state.compare = { [state.persona]: shared.boards[g].state?.compare === true };
}

/** Passe en tableaux partagés (l'animateur garde son tableau local de côté). */
export function enterShared({ write, setState, group = 'g1' }) {
  if (!shared.on && HOST) shared.localNotes = state.notes;
  shared.on = true;
  shared.write = write;
  shared.setState = setState;
  refreshSim();
  showGroup(group);
}

export function leaveShared() {
  if (!shared.on) return;
  shared.on = false;
  state.notes = shared.localNotes ?? [];
  shared.localNotes = null;
}

/** Un tableau a changé dans la base. */
export function receiveBoard(g, tree) {
  shared.boards[g] = { notes: recordsToNotes(tree?.notes), state: tree?.state ?? {} };
  shared.synced[g] = clone(shared.boards[g].notes);
  if (HOST) publishKept();
  if (g === 'g1') refreshSim();
  renderDock();
  if (shared.on && g === shared.group) {
    showGroup(g);
    render();
  }
}

/** Écrit dans la base ce qui a changé sur le tableau affiché. */
function flush() {
  if (!shared.on || !canEdit() || !shared.write) return;
  const g = shared.group;
  const updates = boardUpdates(shared.synced[g], state.notes);
  if (!Object.keys(updates).length) return;
  shared.synced[g] = clone(state.notes);
  shared.boards[g].notes = clone(state.notes);
  shared.write(g, updates).catch(() => toast('Modification non enregistrée : la connexion est peut-être coupée.'));
  if (HOST) publishKept();
}

/** Animateur : la liste commune des livrables étoilés, lue par tous les groupes à la story map. */
function publishKept() {
  if (!HOST || !shared.on || !phones?.live) return;
  const map = {};
  let order = 0;
  for (const g of groupIdsFor(shared.groups)) {
    for (const n of shared.boards[g].notes) if (n.place.b === 'deliverable' && n.keep) map[n.id] = { text: n.text, group: g, order: order++ };
  }
  const sig = JSON.stringify(map);
  if (sig === shared.lastKept) return;
  shared.lastKept = sig;
  phones.setKept(map).catch(() => {});
}

export function receiveKept(tree) {
  shared.kept = Object.entries(tree ?? {}).filter(([, v]) => v?.text).sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    .map(([id, v]) => ({ id, text: v.text, group: v.group }));
  if (shared.on && state.step === 'story') render();
}

/** Livrables étoilés à importer dans la story map, avec leur état d'import sur le tableau affiché. */
function keptForStory() {
  if (!shared.on) return keptDeliverables(state);
  const list = HOST
    ? groupIdsFor(shared.groups).flatMap((g) => shared.boards[g].notes.filter((n) => n.place.b === 'deliverable' && n.keep).map((n) => ({ id: n.id, text: n.text, group: g })))
    : shared.kept;
  return list.map((k) => ({ ...k, imported: state.notes.some((m) => m.from === `deliverable:${k.id}`) }));
}

function importKept(id, place, beforeId = null) {
  if (!shared.on) return importDeliverable(state, id, place, beforeId);
  const k = keptForStory().find((x) => x.id === id);
  return k ? importDeliverable(state, id, place, beforeId, { id, text: k.text, place: { b: 'deliverable' } }) : null;
}

function restore() {
  const saved = load(STORE_KEY);
  if (!saved) return newState();
  try { return saved.app ? parseSaved(saved) : sanitize(saved); } catch { return newState(); }
}

/* ---------- Cycle : modifier, mémoriser, redessiner ---------- */

function persist() {
  // Pendant une séance, le tableau vit dans la base : on ne garde en local que le tableau de l'animateur.
  save(STORE_KEY, serialize(shared.on ? { ...state, notes: shared.localNotes ?? [] } : state));
}

function commit({ focus } = {}) {
  flush();
  persist();
  render(focus);
  if (HOST) phones?.sync(state.step, state.persona);
}

/* ---------- Minuteur et « Nous avons terminé » ----------
   Un minuteur commun par étape d'atelier, piloté par l'animateur (dans la fiche de séance, à l'heure
   du serveur). À zéro, ou quand tous les groupes ont dit « Nous avons terminé », la restitution se
   lance toute seule, une fois par étape. */

const dock = $('#timer-dock');
let dockSig = '';
const timerNow = () => (HOST ? (phones?.now ?? Date.now()) : Date.now() + (shared.offset ?? 0));
const currentTimer = () => (HOST ? phones?.timer : shared.timer) ?? null;
const groupDone = (g, step = state.step) => shared.boards[g]?.state?.done?.[step] === true;

function dockVisible() {
  if (!shared.on || !TIMER_STEPS.includes(state.step)) return false;
  return HOST ? !!phones?.live : !!shared.myGroup && !hooks.screen?.();
}

function renderDock() {
  if (!dock) return;
  const show = dockVisible();
  dock.hidden = !show;
  if (!show) { dockSig = ''; return; }
  const step = state.step;
  const timer = currentTimer();
  const left = timerLeft(timer, step, timerNow());
  const total = stepDuration(step);
  const started = timer?.step === step;
  const running = timerRunning(timer, step);
  const status = shared.restitution ? 'Restitution' : started && left === 0 ? 'Temps écoulé' : running ? 'Temps restant' : started ? 'En pause' : 'Durée préconisée';
  let body;
  if (HOST) {
    const chips = groupIdsFor(shared.groups).map((g) => {
      const d = groupDone(g);
      return `<span class="td-group ${d ? 'is-done' : ''}">${d ? ICONS.check : ''}${esc(shared.groups === 1 ? 'Le groupe' : groupName(g))} ${d ? 'a terminé' : 'travaille'}</span>`;
    }).join('');
    body = `<div class="td-controls">
        ${running ? '<button type="button" class="td-btn" data-timer="pause">Pause</button>'
          : `<button type="button" class="td-btn td-btn--primary" data-timer="${started ? 'resume' : 'start'}">${started ? 'Reprendre' : 'Démarrer'}</button>`}
        <button type="button" class="td-btn" data-timer="plus" title="Ajouter 5 minutes">+5 min</button>
        ${started ? '<button type="button" class="td-btn td-btn--quiet" data-timer="reset" title="Revenir à la durée préconisée, minuteur arrêté">Remettre à zéro</button>' : ''}
      </div>
      <div class="td-groups">${chips}</div>`;
  } else if (shared.restitution) {
    body = '<p class="td-note">Place à la restitution : suivez l\'animateur.</p>';
  } else {
    const mine = groupDone(shared.myGroup);
    body = mine
      ? `<p class="td-note td-note--done">${ICONS.check} Votre groupe a terminé</p><button type="button" class="td-btn td-btn--quiet" data-timer="undone">Finalement, on continue</button>`
      : '<button type="button" class="td-btn td-btn--primary" data-timer="done">Nous avons terminé</button>';
  }
  const pct = total ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
  const sig = `${HOST}|${status}|${body}`;
  if (sig !== dockSig) {
    dockSig = sig;
    dock.innerHTML = `<div class="td-clock ${started && left === 0 ? 'is-over' : ''} ${running ? 'is-running' : ''}">
        <span class="td-status">${esc(status)}</span>
        <span class="td-time" aria-live="off"></span>
        <i class="td-bar"><b></b></i>
      </div>${body}`;
  }
  dock.querySelector('.td-time').textContent = formatClock(left);
  dock.querySelector('.td-bar b').style.width = `${pct}%`;
  dock.querySelector('.td-clock').classList.toggle('is-low', running && left > 0 && left <= 60000);
}

let autoBusy = false;
/** Animateur : lance la restitution à la fin du temps, ou quand tous les groupes ont terminé. */
async function checkAuto() {
  if (!HOST || !phones?.live || !shared.on || autoBusy) return;
  const step = state.step;
  const done = Object.fromEntries(groupIdsFor(shared.groups).map((g) => [g, groupDone(g)]));
  const why = autoRestitution({ timer: currentTimer(), step, now: timerNow(), restitution: shared.restitution, done, groups: shared.groups });
  if (!why) return;
  autoBusy = true;
  try {
    await phones.setTimer({ ...pauseTimer(currentTimer(), step, timerNow()), over: true });
    await phones.setRestitution(true);
    toast(why === 'time' ? 'Temps écoulé : place à la restitution.' : 'Tous les groupes ont terminé : place à la restitution.');
  } catch { /* nouvel essai à la prochaine seconde */ }
  autoBusy = false;
}

dock?.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-timer]');
  if (!b) return;
  const act = b.dataset.timer;
  const step = state.step;
  if (HOST) {
    const t = currentTimer();
    const now = timerNow();
    const over = t?.step === step && t.over ? { over: true } : {};
    const next = {
      start: () => startTimer(step, now),
      pause: () => pauseTimer(t, step, now),
      resume: () => resumeTimer(t, step, now),
      plus: () => addTime(t, step, 5 * 60000, now),
      reset: () => ({ step, left: stepDuration(step), ...over }),
    }[act]?.();
    if (next) await phones.setTimer(next).catch(() => toast('Minuteur non enregistré : la connexion est peut-être coupée.'));
    return;
  }
  if (act === 'done' || act === 'undone') {
    try {
      await hooks.setDone?.(act === 'done');
      if (act === 'done') announce('Votre groupe a terminé : l\'animateur est prévenu.');
    } catch {
      toast('Envoi impossible : la connexion est peut-être coupée.');
    }
  }
});

setInterval(() => { renderDock(); checkAuto(); }, 1000);

/** Rafraîchit le QR code en grand (pour les retardataires) s'il est affiché. */
function refreshJoinDialog() {
  if (HOST && $('#join').open) $('#join').innerHTML = joinDialogBody();
}

function joinDialogBody() {
  return `<div class="dialog-head"><h2 id="join-title">${ICONS.users} Rejoindre l'atelier</h2>
      <button type="button" class="icon-btn" data-close aria-label="Fermer" title="Fermer">${ICONS.close}</button></div>
    <div class="dialog-form join-big">
      <div class="join-big-qr">${qrSvg(phones.url, 'QR code pour rejoindre l\'atelier')}</div>
      <div class="join-big-info">
        ${shareBlock(true)}
        <p class="hint">Sur téléphone : scannez le QR code.</p>
        <p class="hint">${phones.presence.length} connecté${phones.presence.length > 1 ? 's' : ''}</p>
      </div>
    </div>`;
}

function showJoinDialog() {
  const d = $('#join');
  d.innerHTML = joinDialogBody();
  d.showModal();
  d.querySelector('[data-close]')?.focus();
}
// « Afficher en grand » depuis le panneau Participants.
$('#phones')?.addEventListener('click', (e) => {
  if (!e.target.closest('[data-big]')) return;
  $('#phones').close();
  showJoinDialog();
});
$('#join').addEventListener('click', (e) => {
  if (e.target === e.currentTarget || e.target.closest('[data-close]')) { e.currentTarget.close(); return; }
  if (e.target.closest('[data-act="copy-link"]')) actions['copy-link']();
});

function render(focus) {
  const active = document.activeElement;
  const keep = focus ?? (active && main.contains(active) ? focusKey(active) : null);
  const scroll = $$('.canvas-scroll').map((s) => s.scrollLeft);
  main.dataset.step = state.step;
  const screen = hooks.screen?.(); // participant : accueil, prénom, attente d'un groupe
  main.innerHTML = screen ?? views[state.step]();
  main.classList.toggle('is-readonly', !canEdit());
  $$('.canvas-scroll').forEach((s, i) => { if (scroll[i]) s.scrollLeft = scroll[i]; });
  renderStepper();
  refreshJoinDialog();
  renderDock();
  if (keep) main.querySelector(`[data-focus="${CSS.escape(keep)}"]`)?.focus({ preventScroll: true });
}

const focusKey = (el) => el.closest('[data-focus]')?.dataset.focus ?? null;

function go(step) {
  if (!HOST || !setStep(state, step)) return;
  ui.selectedTool = null;
  commit();
  window.scrollTo({ top: 0 });
  $('h1', main)?.focus({ preventScroll: true });
  announce(STEPS.find((s) => s.id === step).label);
}

/* ---------- En-tête : étapes ---------- */

function renderStepper() {
  $('#stepper').innerHTML = STEPS.map((s, i) => `<li><button type="button" data-go="${s.id}" ${s.id === state.step ? 'aria-current="step"' : ''} ${HOST ? '' : 'disabled'}>
      <span class="step-n">${state.visited.includes(s.id) && s.id !== state.step ? ICONS.check : i + 1}</span><span class="step-label">${esc(s.label)}</span>
    </button></li>`).join('');
}

$('#stepper').addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});

/* ---------- Éléments communs ---------- */

function stepHeader(step) {
  const tool = TOOLS[STEP_TOOL[step]];
  const n = STEP_NUMBER[step];
  const phases = STEP_PHASES[step].map((p) => PHASES.find((x) => x.id === p).label).join(' · ');
  const debrief = step === 'debrief';
  return `<header class="step-head">
    <div class="intro">
      <p class="kicker">${n ? `Étape ${n} · ` : ''}${esc(phases)}</p>
      <h1 tabindex="-1">${esc(debrief ? 'Débrief' : tool.name)}</h1>
      <p class="lede">${esc(debrief ? 'Un quiz individuel, chacun sur son ordinateur ou son téléphone, puis la révélation : chacun reçoit sa correction, l\'écran montre les bonnes réponses et le podium.' : tool.oneLine)}</p>
    </div>
    ${diamondMini(STEP_PHASES[step])}
  </header>
  ${debrief ? '' : theoryBlock(step)}
  ${briefBlock(step)}
  ${debrief ? '' : boardBar()}`;
}

/**
 * Au-dessus du tableau : quel groupe on regarde. L'animateur passe d'un groupe à l'autre et lance la
 * restitution ; pendant la restitution, chaque participant peut aussi regarder l'autre groupe.
 */
function boardBar() {
  if (!shared.on || state.step === 'frame') return '';
  const groups = boardGroups();
  const solo = shared.groups === 1;
  if (!HOST && !shared.restitution) {
    return solo ? '' : `<p class="board-bar board-bar--me">Vous travaillez dans le <strong>${esc(groupName(shared.myGroup))}</strong>. L'autre groupe découvrira votre tableau à la restitution.</p>`;
  }
  if (groups.length < 2) return '';
  const count = (g) => (HOST && g !== 'sim' && !solo ? ` <span class="count">${phones?.roster?.[g]?.length ?? 0}</span>` : '');
  const tabs = groups.map((g) => `<button type="button" role="tab" aria-selected="${g === shared.group}" data-group="${g}" data-focus="group:${g}">
      ${esc(boardLabel(g))}${count(g)}${!HOST && g === shared.myGroup ? ' <span class="board-you">vous</span>' : ''}</button>`).join('');
  const hostHint = shared.restitution
    ? `Les participants voient ${solo ? 'leur tableau et celui du groupe simulé' : 'les deux tableaux'}, en lecture seule : vous seul déplacez les post-its.`
    : solo ? `Un seul groupe : à la restitution, on compare son tableau à celui d'un groupe simulé qui a travaillé sur ${esc(personaById(groupPersona('sim'))?.name ?? '')}.`
      : 'Chaque groupe ne voit que son tableau. La restitution montre les deux à tous.';
  const partHint = shared.group === 'sim' ? 'le tableau du groupe simulé' : shared.group === shared.myGroup ? 'votre tableau' : 'le tableau de l\'autre groupe';
  return `<div class="board-bar">
    <div class="group-tabs" role="tablist" aria-label="Tableau affiché">${tabs}</div>
    ${HOST ? `<button type="button" class="btn ${shared.restitution ? 'btn-quiet' : 'btn-primary'} btn-small" data-act="restitution" data-focus="restitution">${shared.restitution ? 'Terminer la restitution' : 'Lancer la restitution'}</button>
      <p class="hint">${hostHint}</p>`
      : `<p class="hint">Restitution : ${partHint}, en lecture seule. L'animateur déplace les post-its.</p>`}
  </div>`;
}

/** La théorie de l'outil : dépliée au départ, repliée une fois qu'on passe à la pratique. */
function theoryBlock(step, { closable = true } = {}) {
  const t = TOOLS[STEP_TOOL[step]];
  const closed = step === 'frame' ? !ui.frameTheory : state.theoryClosed.includes(step);
  if (closed) {
    return `<section class="theory is-closed">
      <button type="button" class="theory-toggle" data-act="theory-open" data-focus="theory" aria-expanded="false">
        ${ICONS.book}<span><strong>La théorie : ${esc(t.name)}</strong> à quoi ça sert, quand l'utiliser, comment faire${step === 'impact' || step === 'story' ? ', et un exemple complet' : ''}</span><span class="theory-open">Revoir</span>
      </button>
    </section>`;
  }
  return `<section class="theory" aria-labelledby="theory-${step}">
    <div class="theory-head">
      <p class="kicker">${ICONS.book} La théorie</p>
      <h2 id="theory-${step}">${esc(t.name)}</h2>
    </div>
    <div class="theory-grid">
      <div class="theory-col">
        <h3>À quoi ça sert</h3><p>${esc(t.why)}</p>
        <h3>Quand l'utiliser</h3><ul>${t.when.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      </div>
      <div class="theory-col">
        <h3>Comment faire</h3><ol class="theory-how">${t.how.map((w) => `<li>${esc(w)}</li>`).join('')}</ol>
      </div>
      <div class="theory-col">
        <h3>Pièges classiques</h3><ul class="pitfalls">${t.pitfalls.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      </div>
    </div>
    ${step === 'impact' ? impactExample() : step === 'story' ? storyExample() : ''}
    <div class="theory-foot">
      <p class="theory-origin">${esc(t.origin)}</p>
      ${closable ? `<button type="button" class="btn btn-primary" data-act="theory-close" data-focus="theory">${step === 'frame' ? 'Replier la fiche' : 'Passer à la pratique'} ↓</button>` : ''}
    </div>
  </section>`;
}

function briefBlock(step) {
  const brief = BRIEFS[step];
  if (!brief) return '';
  return `<section class="brief" aria-label="À faire">
    <p class="brief-title">À faire <span>${esc(brief.duration)}</span></p>
    <ol>${brief.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
  </section>`;
}

/** Post-it en lecture seule (exemples). */
const staticNote = (text, hue, cls = '') => `<div class="note note--static ${cls}" style="--h:${hue}"><span class="note-text">${esc(text)}</span></div>`;

function exampleHead(title) {
  return `<div class="example-head"><p class="kicker">Exemple complet · ${esc(EXAMPLE_CASE.name)}</p><h3>${esc(title)}</h3><p class="hint">${esc(EXAMPLE_CASE.context)} Un autre sujet que le vôtre, exprès : regardez la forme, pas les réponses.</p></div>`;
}

function impactExample() {
  const ex = IMPACT_EXAMPLE;
  return `<div class="example">
    ${exampleHead('Une impact map, du pourquoi au quoi')}
    <div class="canvas-scroll canvas-scroll--example">
      <div class="imap">
        <div class="imap-head">${IMPACT_LEVELS.map((l) => `<div style="--h:${KIND_HUES[l.id]}"><strong>${esc(l.label)}</strong> ${esc(l.name)}</div>`).join('')}</div>
        <ul class="ilist ilist--goal"><li class="irow irow--goal">
          <div class="icell">${staticNote(ex.goal, KIND_HUES.goal, 'note--goal')}</div>
          <ul class="ilist ilist--actor">${ex.actors.map((a) => `<li class="irow irow--actor">
            <div class="icell">${staticNote(a.text, KIND_HUES.actor)}</div>
            <ul class="ilist ilist--impact">${a.impacts.map((i) => `<li class="irow irow--impact">
              <div class="icell">${staticNote(i.text, KIND_HUES.impact)}</div>
              <ul class="ilist ilist--deliv">${i.deliverables.map((d, k) => `<li class="deliv-item">${staticNote(d, KIND_HUES.deliverable, i.kept.includes(k) ? 'is-kept' : '')}${i.kept.includes(k) ? `<span class="keep-mark" title="Retenu">${ICONS.star}</span>` : ''}</li>`).join('')}</ul>
            </li>`).join('')}</ul>
          </li>`).join('')}</ul>
        </li></ul>
      </div>
    </div>
    <p class="hint">${ICONS.star} Les livrables étoilés sont ceux qu'on retient pour la première version : le chemin le plus court vers l'objectif.</p>
  </div>`;
}

function storyExample() {
  const ex = STORY_EXAMPLE;
  const ej = EXAMPLE_JOURNEY;
  const told = esc(ej.story).replace(/\[([^\]]+)\]/g, '<mark>$1</mark>');
  return `<div class="example">
    ${exampleHead('D\'abord le parcours : de l\'histoire aux grandes étapes')}
    <ol class="journey-how">
      <li><h4>1. On raconte</h4><p class="hint">${esc(ej.persona)}</p><p class="journey-told">${told}</p></li>
      <li><h4>2. On garde les actions</h4><ul class="journey-actions">${ej.steps.flatMap((x) => x.actions).map((a) => `<li>${esc(a)}</li>`).join('')}</ul></li>
      <li><h4>3. On regroupe en grandes étapes</h4>
        <div class="journey-groups">${ej.steps.map((x) => `<div>${staticNote(x.step, 48, 'note--backbone')}<small>${esc(x.actions.join(' · '))}</small></div>`).join('')}</div></li>
    </ol>
    <p class="hint">Les grandes étapes forment la colonne vertébrale ; les actions de détail reviennent dessous, en stories (« Choisir sa portion », « Être reconnu à la caisse »).</p>
  </div>
  <div class="example">
    ${exampleHead('Puis la story map, du parcours aux versions')}
    <div class="canvas-scroll canvas-scroll--example">
      <div class="smap smap--example">
        <div class="srow srow--backbone"><div class="slabel"><strong>Le parcours</strong></div>
          <div class="backbone">${ex.backbone.map((b) => `<div class="bcell">${staticNote(b, 48, 'note--backbone')}</div>`).join('')}</div></div>
        ${STORY_LANES.map((lane, i) => `${i ? '<div class="sline" aria-hidden="true"><span>ligne de version</span></div>' : ''}<div class="srow srow--lane srow--${lane.id}">
          <div class="slabel"><strong>${esc(lane.label)}</strong></div>
          <div class="lane">${ex.lanes[lane.id].map((cell) => `<div class="scell">${cell.map((t) => staticNote(t, 48)).join('')}</div>`).join('')}</div>
        </div>`).join('')}
      </div>
    </div>
    <p class="hint">La première version a au moins une story sous chaque étape : on peut déjà réserver et manger, même sans le confort des versions suivantes.</p>
  </div>`;
}

function stepNav() {
  if (!HOST) return '';
  const prev = prevStep(state.step);
  const next = nextStep(state.step);
  const label = (id) => STEPS.find((s) => s.id === id).label;
  return `<nav class="stepnav" aria-label="Étapes">
    ${prev ? `<button type="button" class="btn btn-quiet" data-go="${prev}">‹ ${esc(label(prev))}</button>` : '<span></span>'}
    ${next ? `<button type="button" class="btn btn-primary" data-go="${next}" data-focus="next">${state.step === 'frame' ? 'Commencer' : esc(label(next))} ›</button>` : ''}
  </nav>`;
}

/** Le double diamant en petit : repère « vous êtes ici ». */
function diamondMini(highlight) {
  const halves = {
    discover: '20,60 110,8 110,112', define: '110,8 200,60 110,112',
    develop: '220,60 310,8 310,112', deliver: '310,8 400,60 310,112',
  };
  return `<figure class="dmini" aria-label="Double diamant : ${esc(highlight.map((h) => PHASES.find((p) => p.id === h).label).join(', ') || 'vue d\'ensemble')}">
    <svg viewBox="0 0 420 120" aria-hidden="true">
      ${PHASES.map((p) => `<polygon points="${halves[p.id]}" class="${highlight.includes(p.id) ? 'is-on' : ''}"/>`).join('')}
    </svg>
    <figcaption>${PHASES.map((p) => `<span class="${highlight.includes(p.id) ? 'is-on' : ''}">${esc(p.label)}</span>`).join('')}</figcaption>
  </figure>`;
}

/**
 * Le double diamant en grand. Chaque phase est une case où se posent des outils :
 * à l'étape « cadre », ceux déjà vus ; au débrief, ceux que l'équipe y range (zone de dépôt).
 */
function diamondBoard({ chips, droppable = false, results = null }) {
  return `<div class="dwrap">
  <div class="dboard ${droppable ? 'dboard--drop' : ''}">
    <svg viewBox="0 0 800 340" aria-hidden="true" class="dboard-svg">
      <defs><marker id="dloop-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z"/></marker></defs>
      <polygon points="20,150 200,8 380,150 200,292"/>
      <polygon points="420,150 600,8 780,150 600,292"/>
      <line x1="200" y1="8" x2="200" y2="292"/><line x1="600" y1="8" x2="600" y2="292"/>
      <path class="dloop-path" d="M690 262 C 680 330, 120 330, 110 268" marker-end="url(#dloop-head)"/>
    </svg>
    ${PHASES.map((p) => `<div class="dphase dphase--${p.id}" ${droppable ? `data-drop="phase:${p.id}" data-axis="x"` : ''} ${droppable && ui.selectedTool ? `role="button" tabindex="0" data-place-tool="${p.id}" aria-label="Ranger ${esc(toolName(ui.selectedTool))} dans ${esc(p.label)}"` : ''}>
      <span class="dphase-head">
        <span class="dphase-label">${esc(p.label)}</span>
        <button type="button" class="dinfo" data-info="${p.id}" data-focus="info:${p.id}" data-nodrag aria-expanded="${ui.info === p.id}" aria-controls="dtip-${p.id}" aria-label="En savoir plus : ${esc(p.label)}">i</button>
        <span class="dtip ${ui.info === p.id ? 'is-open' : ''}" id="dtip-${p.id}" role="note">${esc(p.plain)}</span>
      </span>
      <span class="dphase-mode">${p.mode === 'ouvrir' ? '◁ on ouvre ▷' : '▷ on choisit ◁'}</span>
      <span class="dphase-chips">${(chips[p.id] ?? []).map((t) => toolChip(t, { draggable: droppable, result: results?.[t] })).join('')}</span>
    </div>`).join('')}
    <p class="dloop">↺ ${esc(DIAMOND_LOOP)}</p>
  </div>
  ${chips.all?.length ? `<div class="dall"><span class="dall-label"><strong>${esc(ALL_PLACE.label)}</strong> ${esc(ALL_PLACE.plain.toLowerCase())}</span>
    <span class="dphase-chips">${chips.all.map((t) => toolChip(t)).join('')}</span></div>` : ''}
  </div>`;
}

function toolChip(id, { draggable = false, result = null } = {}) {
  const r = result === true ? 'is-right' : result === false ? 'is-wrong' : '';
  const selected = ui.selectedTool === id ? 'is-selected' : '';
  if (!draggable) return `<span class="tchip tchip--${id}">${esc(toolName(id))}</span>`;
  return `<button type="button" class="tchip tchip--${id} ${r} ${selected}" data-drag="tool:${id}" data-select-tool="${id}" data-focus="tool:${id}" aria-pressed="${ui.selectedTool === id}">
    ${result === true ? ICONS.check : ''}${esc(toolName(id))}</button>`;
}

/** Un post-it. `opts.badge` : HTML ajouté en pied (comparaison, auteur…). */
function noteHtml(n, opts = {}) {
  const extract = n.from?.startsWith('extract:');
  const fromDeliv = n.from?.startsWith('deliverable:');
  let hue = 48;
  if (n.place.b === 'empathy') hue = ZONE_HUES[n.place.zone];
  else if (KIND_HUES[n.place.b]) hue = KIND_HUES[n.place.b];
  else if (n.place.b === 'tray' && n.kind) hue = KIND_HUES[n.kind];
  const kind = extract ? 'note--extract' : n.place.b === 'backbone' ? 'note--backbone' : '';
  const meta = [];
  if (n.author) meta.push(`<span class="note-author">${ICONS.phone}${esc(n.author)}</span>`);
  if (fromDeliv) meta.push('<span class="note-from" title="Venu de l\'impact map">↳ impact map</span>');
  if (n.place.b === 'tray' && n.kind) meta.push(`<span class="note-kind">${esc(IMPACT_LEVELS.find((l) => l.id === n.kind).name.replace(/s$/, ''))}</span>`);
  if (opts.badge) meta.push(opts.badge);
  return `<div class="note ${kind} ${opts.cls ?? ''}" style="--h:${hue}" data-drag="note:${n.id}" data-note="${n.id}" data-focus="note:${n.id}" role="button" tabindex="0"
      aria-label="${esc(n.text)}. Ouvrir pour modifier ou déplacer.">
    <span class="note-text">${esc(n.text)}</span>
    ${meta.length ? `<span class="note-meta">${meta.join('')}</span>` : ''}
  </div>`;
}

function addButton(place, label) {
  const key = encodePlace(place);
  return `<button type="button" class="add-btn" data-add="${esc(key)}" data-label="${esc(label)}" data-focus="add:${esc(key)}">${ICONS.plus}<span>${esc(label)}</span></button>`;
}

function trayHtml(step, title, hint) {
  const place = { b: 'tray', step };
  const list = notesIn(state, place);
  if (!list.length) return ''; // plus d'envoi depuis les téléphones : le bac ne sert qu'aux anciens ateliers
  return `<section class="tray ${list.length ? '' : 'is-empty'}" aria-label="${esc(title)}">
    <h2 class="tray-title">${esc(title)} ${list.length ? `<span class="count">${list.length}</span>` : ''}</h2>
    <p class="hint">${esc(hint)}</p>
    <div class="tray-list" data-drop="${encodePlace(place)}" data-axis="x">${list.map((n) => noteHtml(n)).join('')}</div>
  </section>`;
}

/* ---------- Étape « cadre » ---------- */

function viewFrame() {
  const chips = { all: ['designThinking'] };
  for (const tool of TOOL_IDS) {
    if (!state.visited.includes(tool)) continue;
    const phase = TOOL_PHASES[tool][0];
    (chips[phase] ??= []).push(tool);
  }
  const plan = [
    ['empathy', 'Pour qui ?', 'Comprendre deux futurs utilisateurs à partir d\'extraits d\'interview.'],
    ['impact', 'Pourquoi ?', 'Relier un objectif mesurable aux comportements à changer, puis aux livrables.'],
    ['story', 'Quoi, dans quel ordre ?', 'Raconter le parcours de la persona, en tirer la colonne vertébrale, puis tracer une première version utile.'],
    ['debrief', 'Quand utiliser quoi ?', 'Ranger les outils et s\'entraîner sur des situations réelles.'],
  ];
  return `
  <header class="intro intro--frame">
    <p class="kicker">Atelier Produit</p>
    <h1 tabindex="-1">Quatre techniques, un même fil rouge</h1>
    <p class="lede">Le Design Thinking donne la démarche ; l'empathy map, l'impact mapping et le story mapping en sont des outils. Pour voir comment ils s'enchaînent, on les applique l'un après l'autre sur le même cas.</p>
  </header>

  ${joinCard()}

  ${theoryBlock('frame')}

  <section class="frame-diamond">
    <div class="section-head">
      <h2>Le double diamant</h2>
    </div>
    <p class="diamond-message">${esc(DIAMOND_MESSAGE)}</p>
    <p class="hint">Au fil de l'atelier, chaque outil vient prendre sa place sur le diamant.</p>
    ${diamondBoard({ chips })}
  </section>

  <section class="practice-head">
    <p class="kicker">Place à la pratique</p>
    <h2>L'exercice : un cas fil rouge</h2>
    <p class="hint">On applique maintenant chaque outil, l'un après l'autre, au même cas.</p>
  </section>

  <section class="frame-grid">
    <article class="case">
      <p class="kicker">Le cas</p>
      <h2>${esc(CASE.name)} <span>${esc(CASE.tagline)}</span></h2>
      ${CASE.context.map((p) => `<p>${esc(p)}</p>`).join('')}
      <p class="case-request"><strong>La commande.</strong> ${esc(CASE.request)}</p>
    </article>
    <div class="personas">
      ${PERSONAS.map((p) => `<article class="persona-card" style="--h:${p.hue}">
        ${avatar(p)}
        <div><h3>${esc(p.name)}, ${p.age} ans</h3><p class="persona-role">${esc(p.role)} · ${esc(p.profile)}</p>
        <ul>${p.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>
      </article>`).join('')}
    </div>
  </section>


  <section>
    <h2 class="section-title">Le déroulé</h2>
    <ol class="plan">
      ${plan.map(([id, q, text], i) => {
        const step = STEPS.find((s) => s.id === id);
        return `<li><button type="button" class="plan-item" data-go="${id}" ${HOST ? '' : 'disabled'}>
          <span class="plan-n">${i + 1}</span>
          <span class="plan-body"><strong>${esc(step.label)}</strong> <em>${esc(q)}</em><span>${esc(text)}</span></span>
          <span class="plan-time">${esc(BRIEFS[id].duration)}</span>
        </button></li>`;
      }).join('')}
    </ol>
    ${HOST ? '' : '<p class="hint">L\'animateur fait avancer l\'atelier : cette page suit l\'écran commun.</p>'}
    <p class="hint">Environ 2 h 15. L'écran est projeté ; chacun peut aussi envoyer des post-its depuis son ordinateur ou son téléphone (bouton « Participants » en haut).</p>
  </section>

  ${stepNav()}`;
}

/**
 * Le lien à copier (ordinateurs, réunion à distance) et le code de la salle.
 * `big` : version projetée, en grand.
 */
function shareBlock(big = false) {
  const link = phones.shareUrl;
  return `<div class="share ${big ? 'share--big' : ''}">
    <p class="share-link"><button type="button" class="share-url" data-act="copy-link" title="Copier le lien">${esc(link.replace(/^https?:\/\//, ''))}</button>
      <button type="button" class="btn btn-primary btn-small" data-act="copy-link" data-focus="copy-link">${ICONS.link} Copier le lien</button></p>
    ${phones.code ? `<p class="share-code">Code de la salle : <span class="room-code"><strong>${esc(phones.code)}</strong></span></p>`
      : '<p class="share-code">Séance ouverte avant les codes courts : terminez-la puis rouvrez-la (bouton « Participants ») pour obtenir un lien plus court.</p>'}
  </div>`;
}

/** Rejoindre l'atelier : lien à copier et QR code, en évidence dès l'arrivée. */
function joinCard() {
  if (!HOST || !phones?.available) return '';
  if (!phones.live) {
    return `<section class="join join--off">
      <span class="join-icon">${ICONS.users}</span>
      <div><h2>Faire participer chacun</h2>
      <p class="hint">Chacun rejoint l'atelier depuis son ordinateur ou son téléphone, avec son prénom, et envoie ses post-its.</p></div>
      <button type="button" class="btn btn-primary" data-act="phones-show" data-focus="phones-show">Ouvrir l'atelier aux participants</button>
    </section>`;
  }
  const present = phones.presence;
  return `<section class="join">
    <div class="join-qr">${qrSvg(phones.url, 'QR code pour rejoindre l\'atelier')}</div>
    <div class="join-body"><p class="kicker">Rejoignez l'atelier</p>
      <h2>Ouvrez le lien, puis entrez votre prénom</h2>
      ${shareBlock()}
      <p class="hint">Sur téléphone : scannez le QR code. Gardez la page ouverte : elle suit l'écran.</p>
      <div class="join-present"><p><strong>${present.length}</strong> connecté${present.length > 1 ? 's' : ''}</p>
        ${present.length ? `<ul class="present">${present.map((p) => `<li>${esc(p.author)}</li>`).join('')}</ul>` : '<p class="hint">Les prénoms s\'afficheront ici à mesure que chacun rejoint.</p>'}</div>
    </div>
  </section>`;
}

function avatar(p, size = '') {
  return `<span class="avatar ${size}" style="--h:${p.hue}" aria-hidden="true">${esc(p.name[0])}</span>`;
}

/* ---------- Étape 1 : empathy map ---------- */

function viewEmpathy() {
  const persona = personaById(state.persona);
  const comparing = state.compare[persona.id] === true;
  const cmp = compareEmpathy(state, persona.id);
  const byNote = Object.fromEntries(cmp.items.map((i) => [i.noteId, i]));
  const pool = availableExtracts(state, persona.id);
  const zoneLabel = (id) => EMPATHY_ZONES.find((z) => z.id === id).label;
  const badge = (n) => {
    if (!comparing || !byNote[n.id]) return '';
    const c = byNote[n.id];
    return c.ok ? `<span class="cmp cmp--ok">${ICONS.check}comme la proposition</span>` : `<span class="cmp cmp--diff">proposé : ${esc(zoneLabel(c.expected))}</span>`;
  };
  const zone = (z) => {
    const place = { b: 'empathy', persona: persona.id, zone: z.id };
    const list = notesIn(state, place);
    return `<section class="ezone ezone--${z.id}" style="--h:${ZONE_HUES[z.id]}" aria-labelledby="z-${z.id}" data-drop="${encodePlace(place)}">
      <h2 id="z-${z.id}">${esc(z.label)} <span class="count">${list.length || ''}</span></h2>
      <p class="ezone-q">${esc(z.question)}</p>
      <div class="note-list">${list.map((n) => noteHtml(n, { badge: badge(n) })).join('')}</div>
      ${addButton(place, 'Ajouter')}
    </section>`;
  };
  const empty = emptyZones(state, persona.id).map(zoneLabel);
  return `
  ${stepHeader('empathy')}
  ${shared.on ? `<p class="persona-fixed">${avatar(persona, 'avatar--sm')} <span>${shared.group === 'sim' ? 'Groupe simulé : ' : shared.groups === 2 ? `${esc(groupName(shared.group))} : ` : ''}la carte de <strong>${esc(persona.name)}</strong>, ${esc(persona.profile.toLowerCase())}</span>${HOST && shared.groups === 1 && shared.group !== 'sim' ? ' <button type="button" class="link-btn" data-act="phones-show">Changer (Participants)</button>' : ''}</p>` : `<div class="persona-tabs" role="tablist" aria-label="Persona">
    ${PERSONAS.map((p) => {
      const count = state.notes.filter((n) => n.place.b === 'empathy' && n.place.persona === p.id).length;
      return `<button type="button" role="tab" aria-selected="${p.id === persona.id}" data-persona="${p.id}" data-focus="persona:${p.id}" style="--h:${p.hue}">
        ${avatar(p, 'avatar--sm')}<span><strong>${esc(p.name)}</strong> ${esc(p.profile.toLowerCase())}</span>${count ? `<span class="count">${count}</span>` : ''}</button>`;
    }).join('')}
  </div>`}
  <div class="empathy-layout">
    <div class="emap" role="tabpanel">
      ${zone(EMPATHY_ZONES[0])}
      <div class="emap-center">
        ${avatar(persona, 'avatar--lg')}
        <p class="emap-name">${esc(persona.name)}, ${persona.age} ans</p>
        <p class="emap-role">${esc(persona.role)}</p>
        <ul class="emap-facts">${persona.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      </div>
      ${zone(EMPATHY_ZONES[1])}
      ${zone(EMPATHY_ZONES[2])}
      ${zone(EMPATHY_ZONES[3])}
      <div class="emap-bottom">${zone(EMPATHY_ZONES[4])}${zone(EMPATHY_ZONES[5])}</div>
    </div>
    <aside class="pool" aria-labelledby="pool-title">
      <h2 id="pool-title">Extraits d'interview <span class="count">${pool.length}</span></h2>
      <p class="hint">Faites-les glisser dans la carte, ou touchez-en un pour choisir sa zone.</p>
      <div class="pool-list" data-drop="pool:${persona.id}">
        ${pool.map((e) => `<div class="note note--extract" data-drag="extract:${e.id}" data-extract="${e.id}" data-focus="extract:${e.id}" role="button" tabindex="0" aria-label="${esc(e.text)}. Choisir sa zone.">
          <span class="note-text">${esc(e.text)}</span></div>`).join('') || '<p class="pool-empty">Tous les extraits sont sur la carte.</p>'}
      </div>
    </aside>
  </div>
  <section class="checkpoint">
    <div>
      <h2>Et maintenant ?</h2>
      ${comparing
        ? `<p><strong>${cmp.matching} extrait${cmp.matching > 1 ? 's' : ''} sur ${cmp.placed}</strong> rangé${cmp.matching > 1 ? 's' : ''} comme la proposition${pool.length ? `, et ${pool.length} pas encore rangé${pool.length > 1 ? 's' : ''}` : ''}. La proposition complète est juste en dessous. Il n'y a pas de tri parfait : un écart est une bonne occasion de discuter (dire n'est pas penser, faire n'est pas dire).</p>`
        : HOST || !shared.on ? '<p>Une fois les extraits rangés, comparez avec une proposition de tri.</p>' : '<p>Rangez les extraits entre vous : l\'animateur dévoilera une proposition de tri au moment de la restitution.</p>'}
      ${empty.length ? `<p>Zones vides : <strong>${esc(empty.join(', '))}</strong>. Ce sont les questions de la prochaine interview.</p>` : '<p>Toutes les zones ont au moins un post-it.</p>'}
    </div>
    ${!shared.on || (HOST && shared.group !== 'sim') ? `<button type="button" class="btn ${comparing ? 'btn-quiet' : 'btn-primary'}" data-act="compare" data-focus="compare" ${cmp.placed || shared.on ? '' : 'disabled'}>
      ${comparing ? 'Masquer la proposition' : 'Comparer avec la proposition'}</button>` : ''}
  </section>
  ${comparing ? proposalHtml(persona) : ''}
  ${stepNav()}`;
}

/**
 * La proposition de tri complète : tous les extraits du persona dans leur zone proposée, avec où
 * le groupe les a rangés (ou pas encore). On voit aussi les choix pour les cartes non placées.
 */
function proposalHtml(persona) {
  const placed = new Map(state.notes.filter((n) => n.from?.startsWith('extract:') && n.place.b === 'empathy').map((n) => [n.from.slice(8), n.place.zone]));
  const zoneLabel = (id) => EMPATHY_ZONES.find((z) => z.id === id).label;
  const status = (e) => {
    const where = placed.get(e.id);
    if (where === e.zone) return `<span class="cmp cmp--ok">${ICONS.check}rangé ici</span>`;
    if (where) return `<span class="cmp cmp--diff">vous : ${esc(zoneLabel(where))}</span>`;
    return '<span class="cmp cmp--todo">pas encore rangé</span>';
  };
  return `<section class="proposal" aria-labelledby="proposal-title">
    <div class="section-head"><h2 id="proposal-title">La proposition de tri pour ${esc(persona.name)}</h2>
      <p class="hint">Une proposition, pas la vérité : tous les extraits, à l'endroit où on les rangerait.</p></div>
    <div class="proposal-grid">${EMPATHY_ZONES.map((z) => `<div class="proposal-zone" style="--h:${ZONE_HUES[z.id]}">
      <h3>${esc(z.label)}</h3>
      <ul>${persona.extracts.filter((e) => e.zone === z.id).map((e) => `<li><span class="proposal-text">${esc(e.text)}</span>${status(e)}</li>`).join('')}</ul>
    </div>`).join('')}</div>
  </section>`;
}

/* ---------- Étape 2 : impact mapping ---------- */

function viewImpact() {
  const goals = notesIn(state, { b: 'goal' });
  const inspiration = PERSONAS.map((p) => ({
    p,
    pains: notesIn(state, { b: 'empathy', persona: p.id, zone: 'pains' }),
    gains: notesIn(state, { b: 'empathy', persona: p.id, zone: 'gains' }),
  })).filter((x) => x.pains.length || x.gains.length);

  const delivItem = (d) => `<li class="deliv-item">${noteHtml(d, { cls: d.keep ? 'is-kept' : '' })}
    ${HOST || !shared.on ? `<button type="button" class="keep-btn" data-keep="${d.id}" data-focus="keep:${d.id}" aria-pressed="${!!d.keep}" title="${d.keep ? 'Retenu pour la story map' : 'Retenir pour la story map'}">
      ${ICONS.star}<span class="sr-only">${d.keep ? 'Retenu pour la story map' : 'Retenir pour la story map'}</span></button>`
      : d.keep ? `<span class="keep-mark" title="Retenu pour la story map">${ICONS.star}</span>` : ''}</li>`;

  const impactRow = (i) => `<li class="irow irow--impact">
    <div class="icell">${noteHtml(i)}</div>
    <ul class="ilist ilist--deliv" data-drop="${encodePlace({ b: 'deliverable', parent: i.id })}">
      ${notesIn(state, { b: 'deliverable', parent: i.id }).map(delivItem).join('')}
      <li>${addButton({ b: 'deliverable', parent: i.id }, 'Livrable')}</li>
    </ul>
  </li>`;

  const actorRow = (a) => `<li class="irow irow--actor">
    <div class="icell">${noteHtml(a)}</div>
    <ul class="ilist ilist--impact" data-drop="${encodePlace({ b: 'impact', parent: a.id })}">
      ${notesIn(state, { b: 'impact', parent: a.id }).map(impactRow).join('')}
      <li class="irow irow--add">${addButton({ b: 'impact', parent: a.id }, 'Impact')}</li>
    </ul>
  </li>`;

  const goalRow = (g) => `<li class="irow irow--goal">
    <div class="icell">${noteHtml(g, { cls: 'note--goal' })}</div>
    <ul class="ilist ilist--actor" data-drop="${encodePlace({ b: 'actor', parent: g.id })}">
      ${notesIn(state, { b: 'actor', parent: g.id }).map(actorRow).join('')}
      <li class="irow irow--add">${addButton({ b: 'actor', parent: g.id }, 'Acteur')}</li>
    </ul>
  </li>`;

  return `
  ${stepHeader('impact')}
  <div class="impact-layout">
    <div class="canvas">
      <div class="canvas-scroll">
        <div class="imap">
          <div class="imap-head">${IMPACT_LEVELS.map((l) => `<div style="--h:${KIND_HUES[l.id] ?? 262}"><strong>${esc(l.label)}</strong> ${esc(l.name)}<span>${esc(l.question)}</span></div>`).join('')}</div>
          <ul class="ilist ilist--goal" data-drop="goal">
            ${goals.map(goalRow).join('')}
            <li class="irow irow--add">${addButton({ b: 'goal' }, goals.length ? 'Autre objectif' : 'Objectif')}</li>
          </ul>
        </div>
      </div>
      <p class="hint">${ICONS.star} ${shared.on ? 'Les livrables retenus se choisissent tous ensemble, à la restitution : l\'animateur pose les étoiles. Ils serviront à tous les groupes pour la story map.' : 'Cochez l\'étoile des livrables que vous retenez : ils vous attendront dans la story map. Plusieurs objectifs ? Ajoutez-les avec « Autre objectif ».'}</p>
    </div>
    <aside class="side">
      ${trayHtml('impact', 'À placer', 'Glissez ces post-its dans l\'arbre.')}
      <section class="inspiration">
        <h2>Pour s'inspirer</h2>
        ${inspiration.length ? inspiration.map(({ p, pains, gains }) => `<div class="insp">
          <p class="insp-who">${avatar(p, 'avatar--xs')} ${esc(p.name)}</p>
          ${pains.length ? `<p class="insp-label">Douleurs</p><ul>${pains.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul>` : ''}
          ${gains.length ? `<p class="insp-label">Gains</p><ul>${gains.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul>` : ''}
        </div>`).join('') : '<p class="hint">Les douleurs et les gains des empathy maps s\'afficheront ici.</p>'}
      </section>
    </aside>
  </div>
  ${stepNav()}`;
}

/* ---------- Étape 3 : story mapping ---------- */

/** Premier temps de la story map : raconter le parcours de la persona, avant de le valider. */
function viewJourney() {
  const persona = personaById(state.persona) ?? PERSONAS[0];
  const steps = journeyNotes(state);
  const h = journeyHints(steps.map((n) => n.text));
  const tips = [];
  if (h.tooFew) tips.push(`<li>${steps.length ? `${steps.length} étape${steps.length > 1 ? 's' : ''} pour l'instant` : 'Pas encore d\'étape'} : visez ${JOURNEY_MIN} à ${JOURNEY_MAX} grandes étapes, du déclencheur au résultat.</li>`);
  if (h.tooMany) tips.push(`<li>${steps.length} étapes, c'est beaucoup : certaines sont peut-être des détails. Regroupez-les, ils reviendront en stories.</li>`);
  if (h.notVerb.length) tips.push(`<li>Ne commence${h.notVerb.length > 1 ? 'nt' : ''} pas par un verbe : <strong>${esc(h.notVerb.join(' · '))}</strong>. Que fait ${esc(persona.name)}, à ce moment-là ?</li>`);
  if (h.system.length) tips.push(`<li>Décri${h.system.length > 1 ? 'vent' : 't'} l'appli plutôt que ${esc(persona.name)} : <strong>${esc(h.system.join(' · '))}</strong>.</li>`);
  const ready = steps.length >= 2;
  return `
  ${stepHeader('story')}
  <section class="journey-intro">
    <p class="kicker">Temps 1 · Le parcours</p>
    <h2>Racontez le parcours de ${esc(persona.name)} avec l'appli</h2>
    <p>Avant de parler de fonctionnalités, on raconte ce que fait ${esc(persona.name)}, ${esc(persona.profile.toLowerCase())}, quand elle utilise le service, du début à la fin. Ces grandes étapes deviendront la première ligne de votre story map : la colonne vertébrale.</p>
    <div class="journey-guide">
      <div class="journey-persona" style="--h:${persona.hue}">${avatar(persona)}
        <div><strong>${esc(persona.name)}, ${persona.age} ans</strong><span>${esc(persona.role)} · ${esc(persona.profile)}</span>
        <ul>${persona.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div></div>
      <div class="journey-questions"><h3>Pour raconter</h3>
        <ol>${JOURNEY_QUESTIONS.map((q) => `<li>${esc(q.replaceAll('{name}', persona.name))}</li>`).join('')}</ol></div>
      <div class="journey-rules"><h3>Bien formuler une étape</h3>
        <ul>${JOURNEY_RULES.map((r) => `<li><strong>${esc(r.title)}</strong>
          <span class="jr-good">${ICONS.check} ${esc(r.good)}</span>${r.bad ? `<span class="jr-bad">✕ ${esc(r.bad)}</span>` : ''}${r.note ? `<small>${esc(r.note)}</small>` : ''}</li>`).join('')}</ul></div>
    </div>
  </section>

  <div class="canvas">
    <div class="canvas-scroll">
      <div class="journey" data-drop="journey" data-axis="x">
        ${steps.map((n, i) => `<div class="jcell"><span class="jn">${i + 1}</span>${noteHtml(n)}</div>`).join('')}
        <div class="jcell jcell--add">${addButton({ b: 'journey' }, 'Étape')}</div>
      </div>
    </div>
    <p class="hint">De gauche à droite, dans l'ordre où ${esc(persona.name)} les vit. Glissez une étape pour la déplacer.</p>
  </div>

  <section class="checkpoint">
    <div>
      <h2>Prêts à valider ?</h2>
      ${tips.length ? `<ul class="journey-tips">${tips.join('')}</ul>` : steps.length ? '<p>Le parcours se lit bien : des verbes, du point de vue de la persona, dans l\'ordre. Relisez-le à voix haute : raconte-t-il toute l\'histoire ?</p>' : ''}
      <p class="hint">Une fois validé, le parcours devient la première ligne de votre story map. Vous pourrez encore l'ajuster.</p>
      ${HOST && !steps.length ? `<p class="hint">Animateur : un groupe bloqué ? <button type="button" class="link-btn" data-act="journey-example" data-focus="journey-example">Proposer le parcours type de ${esc(persona.name)}</button></p>` : ''}
    </div>
    <button type="button" class="btn btn-primary" data-act="journey-validate" data-focus="journey-validate" ${ready ? '' : 'disabled'}>Valider le parcours ›</button>
  </section>
  ${stepNav()}`;
}

function viewStory() {
  if (!journeyDone(state) && shared.group !== 'sim') return viewJourney();
  const cols = notesIn(state, { b: 'backbone' });
  const kept = keptForStory();
  const gaps = mvpGaps(state);
  const cell = (c, lane) => {
    const place = { b: 'story', col: c.id, lane: lane.id };
    return `<div class="scell" data-drop="${encodePlace(place)}">${notesIn(state, place).map((n) => noteHtml(n)).join('')}${addButton(place, 'Story')}</div>`;
  };
  return `
  ${stepHeader('story')}
  ${shared.group === 'sim' ? simNotice() : `<div class="story-sources">
    <section class="kept">
      <h2>Livrables retenus <span class="count">${kept.length}</span></h2>
      ${kept.length
        ? `<p class="hint">Glissez-les sous une étape du parcours, ou cliquez sur l'un d'eux pour choisir où le placer.</p>
           <div class="kept-list">${kept.map((d) => `<button type="button" class="kchip ${d.imported ? 'is-imported' : ''}" data-drag="deliv:${d.id}" data-deliv="${d.id}" data-focus="deliv:${d.id}">
             ${d.imported ? ICONS.check : ''}${esc(d.text)}${shared.on && shared.groups === 2 && d.group ? ` <small>${esc(groupName(d.group))}</small>` : ''}</button>`).join('')}</div>`
        : HOST ? `<p class="hint">Aucun livrable retenu : cochez l'étoile des livrables dans <button type="button" class="link-btn" data-go="impact">l'impact map</button>.</p>`
          : '<p class="hint">Aucun livrable retenu pour l\'instant : ils sont choisis tous ensemble, à la fin de l\'impact mapping.</p>'}
    </section>
    ${trayHtml('story', 'À placer', 'Glissez ces post-its sous une étape du parcours.')}
  </div>`}

  <div class="canvas">
    <div class="canvas-scroll">
      <div class="smap" style="--cols:${cols.length}">
        <div class="srow srow--backbone">
          <div class="slabel"><strong>Le parcours</strong><span>De gauche à droite, les grandes étapes de ${esc(personaById(state.persona)?.name ?? 'l\'utilisateur')}.</span>
            ${canEdit() && shared.group !== 'sim' ? '<button type="button" class="link-btn" data-act="journey-reopen" data-focus="journey-reopen">Revenir au récit</button>' : ''}</div>
          <div class="backbone" data-drop="backbone" data-axis="x">
            ${cols.map((c) => `<div class="bcell">${noteHtml(c)}</div>`).join('')}
            <div class="bcell bcell--add">${addButton({ b: 'backbone' }, 'Étape')}
</div>
          </div>
        </div>
        ${cols.length ? STORY_LANES.map((lane, i) => `<div class="srow srow--lane srow--${lane.id}">
          <div class="slabel"><strong>${esc(lane.label)}</strong><span>${esc(lane.hint)}</span></div>
          <div class="lane">${cols.map((c) => cell(c, lane)).join('')}</div>
        </div>${i < STORY_LANES.length - 1 ? `<div class="sline" aria-hidden="true"><span>ligne de version</span></div>` : ''}`).join('') : ''}
      </div>
    </div>
  </div>
  ${cols.length ? `<section class="checkpoint">
    <div><h2>${esc(personaById(state.persona)?.name ?? '')} peut-${state.persona === 'karim' ? 'il' : 'elle'} covoiturer avec la première version ?</h2>
    ${gaps.length
      ? `<p>Étapes sans rien en première version : <strong>${esc(gaps.map((g) => g.text).join(', '))}</strong>. Une première version doit traverser tout le parcours, même de façon rudimentaire.</p>`
      : '<p>La première version traverse tout le parcours. Relisez-la : est-ce vraiment le minimum ? Que pourrait-on encore retirer ?</p>'}
      <p>Cette première version, c'est aussi un test : on la met entre les mains des utilisateurs pour apprendre, et ce qu'on apprend peut renvoyer au premier diamant.</p></div>
  </section>` : ''}
  ${stepNav()}`;
}

/* ---------- Étape 4 : débrief ---------- */

function viewDebrief() {
  if (!HOST) return `${stepHeader('debrief')}${hooks.debriefView?.() ?? ''}`;
  return `
  ${stepHeader('debrief')}
  ${quizPanel()}

  <section class="dsection debrief-end">
    <div class="takeaways">
      <h2>Ce que l'équipe retient</h2>
      <p class="hint">Quel outil essayer sur un vrai sujet ? Quand ? Qui s'en occupe ?</p>
      <label class="sr-only" for="takeaways">Ce que l'équipe retient</label>
      <textarea id="takeaways" class="field" rows="6" maxlength="4000" data-focus="takeaways" placeholder="Ex. : faire une story map du prochain sujet au lieu d'un backlog plat.">${esc(state.debrief.takeaways)}</textarea>
    </div>
    <div class="panel panel--export">
      <h2>Garder une trace</h2>
      <button type="button" class="btn btn-primary" data-act="copy" data-focus="copy">Copier le compte rendu</button>
      <button type="button" class="btn btn-quiet" data-act="print" data-focus="print">Imprimer ou PDF</button>
      <button type="button" class="btn btn-quiet" data-act="save" data-focus="save">Enregistrer l'atelier (.json)</button>
      <p class="hint">Le fichier se rouvre ici : <button type="button" class="link-btn" data-act="open" data-focus="open">reprendre un atelier enregistré</button>.</p>
      <p class="hint"><button type="button" class="link-btn link-btn--danger" data-act="reset" data-focus="reset">Recommencer un atelier vierge</button></p>
    </div>
  </section>
  ${stepNav()}`;
}

/* ---------- Débrief en quiz individuel ---------- */

/** Où en est le quiz : copies reçues sur les présents, et qui n'a pas encore validé. */
function quizProgressHtml(entries) {
  const present = phones.presence;
  const waiting = waitingFor(present, entries);
  const total = Math.max(present.length, entries.length);
  return `<p class="qcount"><strong>${entries.length}</strong>${total ? ` / ${total}` : ''} ont répondu</p>
    ${entries.length ? `<ul class="qnames">${entries.map((e) => `<li>${esc(e.author)}</li>`).join('')}</ul>` : ''}
    ${waiting.length ? `<p class="hint">En attente : ${waiting.map((p) => `<span class="qwaiting">${esc(p.author)}</span>`).join(' ')}</p>`
      : entries.length ? '<p class="qall">Tout le monde a répondu : vous pouvez révéler.</p>' : '<p class="hint">Les prénoms s\'afficheront ici au fil des validations.</p>'}`;
}

function quizPanel() {
  const entries = ui.quizEntries;
  const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  if (!phones.available) {
    return `<section class="dsection"><p>Le quiz individuel passe par la participation à distance, qui n'est pas configurée pour cet outil.</p></section>`;
  }
  if (!phones.live) {
    return `<section class="dsection qpanel">
      <h2>Ouvrez d'abord l'atelier aux participants</h2>
      <p class="hint">Chacun rejoint avec son prénom, répond au quiz sur son ordinateur ou son téléphone, puis vous révélez les réponses : chacun reçoit sa correction, l'écran affiche les bonnes réponses et le podium.</p>
      <button type="button" class="btn btn-primary" data-act="phones-show" data-focus="phones-show">Ouvrir l'atelier aux participants</button>
    </section>`;
  }
  const qr = `<div class="qjoin"><div class="join-qr">${qrSvg(phones.url, 'QR code pour rejoindre le quiz')}</div>
    <p class="hint">Pas encore connecté ?</p>
    ${shareBlock()}</div>`;

  if (phones.quiz !== 'revealed') {
    const open = phones.quiz === 'open';
    return `<section class="dsection qpanel">
      <div class="qstatus">
        <div>
          <p class="kicker">${open ? 'Quiz en cours' : 'Quiz prêt'}</p>
          <h2>${open ? 'Chacun répond de son côté' : 'Lancez le quiz quand tout le monde est connecté'}</h2>
          <p class="hint">${QUIZ_MAX} questions : ranger les quatre notions sur le double diamant (Design Thinking compris), puis huit situations. Un point par bonne réponse, un demi-point pour une réponse défendable.</p>
          ${open ? quizProgressHtml(entries) : `<p class="hint"><strong>${phones.presence.length}</strong> connecté${phones.presence.length > 1 ? 's' : ''}${phones.presence.length ? ` : ${esc(phones.presence.map((p) => p.author).join(', '))}` : ''}.</p>`}
          <div class="qactions">
            ${open
              ? `<button type="button" class="btn btn-primary" data-act="quiz-reveal" data-focus="quiz-reveal" ${entries.length ? '' : 'disabled'}>Révéler les réponses</button>
                 <button type="button" class="btn btn-quiet" data-act="quiz-stop" data-focus="quiz-stop">Arrêter le quiz</button>`
              : `<button type="button" class="btn btn-primary" data-act="quiz-start" data-focus="quiz-start">Lancer le quiz</button>`}
          </div>
        </div>
        ${qr}
      </div>
    </section>`;
  }

  // Révélation : podium, statistiques du groupe, bonnes réponses avec la répartition des réponses.
  const top = podium(entries);
  const stats = quizStats(entries);
  const medals = ['🥇', '🥈', '🥉'];
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const hardest = stats.hardest && SITUATIONS.findIndex((x) => x.id === stats.hardest.id);
  const chips = {};
  for (const tool of TOOL_IDS) for (const ph of TOOL_PHASES[tool]) (chips[ph] ??= []).push(tool);
  const pct = (n) => (stats.count ? Math.round((n / stats.count) * 100) : 0);
  const bars = (counts, labelOf, right) => `<ul class="qbars">${Object.entries(counts).map(([k, n]) => `<li class="${right.includes(k) ? 'is-right' : ''}">
      <span class="qbar-label">${esc(labelOf(k))}</span><span class="qbar"><b style="width:${pct(n)}%"></b></span><span class="qbar-n">${n}</span></li>`).join('')}</ul>`;

  return `<section class="dsection qpanel qreveal">
    <div class="podium" aria-label="Podium">
      ${order.map((p) => `<div class="podium-step podium-step--${p.rank}">
        <span class="podium-medal" aria-hidden="true">${medals[p.rank - 1]}</span>
        <strong class="podium-name">${esc(p.author)}</strong>
        <span class="podium-score">${fmt(p.points)} <small>/ ${QUIZ_MAX}</small></span>
        <span class="podium-block">${p.rank}</span>
      </div>`).join('')}
    </div>
    <p class="qsummary">${stats.count} participant${stats.count > 1 ? 's' : ''} · moyenne du groupe : <strong>${fmt(stats.average)} / ${QUIZ_MAX}</strong>.
      Chacun a reçu sa correction détaillée sur son écran.</p>
    ${hardest >= 0 && stats.hardest.rate < 1 ? `<p class="qhardest"><strong>À discuter :</strong> la situation ${hardest + 1} n'a eu que ${pct(stats.hardest.rate * stats.count)} % de réponses les plus adaptées.</p>` : ''}
    <div class="qactions">
      <button type="button" class="btn btn-quiet" data-act="quiz-replay" data-focus="quiz-replay">Rejouer (effacer les copies)</button>
      <button type="button" class="btn btn-quiet" data-act="quiz-stop" data-focus="quiz-stop">Fermer le quiz</button>
    </div>
  </section>

  <section class="dsection">
    <div class="dsection-head"><span class="dsection-n">1</span><div><h2>Les notions sur le double diamant</h2>
      <p class="hint">Les bonnes réponses, et où le groupe a rangé chaque notion.</p></div></div>
    ${diamondBoard({ chips })}
    <div class="qtools">${TOOL_IDS.map((t) => `<div class="qtool"><p>${toolChip(t)}</p>
      ${bars(stats.tools[t], (ph) => PLACES.find((x) => x.id === ph).label, TOOL_PHASES[t])}
      <p class="hint">${esc(PLACEMENT_FEEDBACK[t][TOOL_PHASES[t][0]])}</p></div>`).join('')}</div>
  </section>

  <section class="dsection">
    <div class="dsection-head"><span class="dsection-n">2</span><div><h2>Les situations</h2>
      <p class="hint">La réponse la plus adaptée, et la répartition des réponses du groupe.</p></div></div>
    <ol class="situations">${SITUATIONS.map((x, k) => {
      const defensible = Object.entries(x.others).filter(([, o]) => o.level === 'ok').map(([c]) => c);
      return `<li class="situation ${stats.hardest?.id === x.id ? 'is-hardest' : ''}">
        <p class="situation-text"><span class="situation-n">${k + 1}</span>${esc(x.text)}</p>
        ${bars(stats.situations[x.id], (c) => CHOICE_LABELS[c], [x.answer])}
        <div class="verdict verdict--right"><p><strong>${ICONS.check} ${esc(CHOICE_LABELS[x.answer])}.</strong> ${esc(x.why)}</p>
        ${defensible.length ? `<p><strong>Défendable :</strong> ${esc(defensible.map((c) => CHOICE_LABELS[c]).join(', '))}.</p>` : ''}</div>
      </li>`;
    }).join('')}</ol>
  </section>`;
}

const views = { frame: viewFrame, empathy: viewEmpathy, impact: viewImpact, story: viewStory, debrief: viewDebrief };

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.info && !document.querySelector('dialog[open]')) { ui.info = null; render(); }
});

/* ---------- Boîte de dialogue : écrire, modifier, ranger un post-it ---------- */

const editor = $('#editor');
let editing = null; // { mode: 'new'|'edit'|'extract', place?, id? }

function openDialog(html, ctx) {
  editing = ctx;
  editor.innerHTML = html;
  editor.showModal();
  editor.querySelector('textarea')?.focus();
}

function openNew(place, label) {
  const level = { goal: 'Objectif', actor: 'Acteur', impact: 'Impact', deliverable: 'Livrable', backbone: 'Étape du parcours', story: 'Story' }[place.b];
  const hints = {
    goal: 'Un résultat mesurable et daté : combien, d\'ici quand ? Pas une solution (« faire une appli »).',
    actor: 'Une personne ou un groupe qui peut aider à atteindre l\'objectif, ou le freiner.',
    impact: 'Un changement de comportement : « propose ses trajets », « ose demander »…',
    deliverable: 'Ce qu\'on pourrait livrer ou faire pour provoquer ce changement.',
    backbone: 'Une grande étape du parcours, vue par l\'utilisateur (un verbe).',
    story: 'Ce que l\'utilisateur peut faire, en quelques mots.',
  };
  const title = place.b === 'empathy' ? `Ajouter dans « ${EMPATHY_ZONES.find((z) => z.id === place.zone).label} »` : `Ajouter : ${level ?? label}`;
  const hint = place.b === 'empathy' ? EMPATHY_ZONES.find((z) => z.id === place.zone).question : hints[place.b] ?? '';
  openDialog(`<form method="dialog" class="dialog-form" data-form="note">
    <h2 id="editor-title">${esc(title)}</h2>
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    <label class="field-wrap"><span class="sr-only">Texte du post-it</span>
      <textarea class="field note-field" name="text" rows="3" maxlength="${MAX_TEXT}" required></textarea></label>
    <div class="dialog-actions">
      <button type="button" class="btn btn-quiet" data-cancel>Annuler</button>
      <button type="submit" class="btn btn-primary">Ajouter</button>
    </div>
  </form>`, { mode: 'new', place });
}

function openEdit(id) {
  const n = getNote(state, id);
  if (!n) return;
  const extract = n.from?.startsWith('extract:');
  const places = placesFor(state, id);
  const current = encodePlace(n.place);
  const blocked = childrenOf(state, id).length && n.place.b !== 'empathy';
  openDialog(`<form method="dialog" class="dialog-form" data-form="note">
    <h2 id="editor-title">${extract ? 'Extrait d\'interview' : 'Post-it'}</h2>
    ${n.author ? `<p class="hint">${ICONS.phone} Envoyé par ${esc(n.author)}</p>` : ''}
    <label class="field-wrap"><span class="field-label">Texte</span>
      <textarea class="field note-field" name="text" rows="3" maxlength="${MAX_TEXT}" required ${extract ? 'readonly' : ''}>${esc(n.text)}</textarea></label>
    <label class="field-wrap"><span class="field-label">Ranger dans</span>
      <select class="field" name="place">${places.map((p) => `<option value="${esc(encodePlace(p.place))}" ${encodePlace(p.place) === current ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></label>
    ${blocked ? '<p class="hint">Ce post-it a des post-its rattachés : il peut changer de place, pas de niveau.</p>' : ''}
    ${n.place.b === 'deliverable' && (HOST || !shared.on) ? `<label class="check"><input type="checkbox" name="keep" ${n.keep ? 'checked' : ''}> Retenu pour la story map</label>` : ''}
    <div class="dialog-actions">
      <button type="button" class="btn btn-danger" data-delete>${extract ? 'Remettre dans la pioche' : 'Supprimer'}</button>
      <span></span>
      <button type="button" class="btn btn-quiet" data-cancel>Annuler</button>
      <button type="submit" class="btn btn-primary">Enregistrer</button>
    </div>
  </form>`, { mode: 'edit', id });
}

/** Livrable retenu : choisir l'étape du parcours et la version où le placer. */
function openPlaceKept(id) {
  const k = keptForStory().find((x) => x.id === id);
  if (!k) return;
  const cols = notesIn(state, { b: 'backbone' });
  if (!cols.length) { toast('Posez d\'abord les étapes du parcours (« + Étape » ou « Partir du parcours type »).'); return; }
  openDialog(`<form method="dialog" class="dialog-form" data-form="place-kept">
    <h2 id="editor-title">Où placer ce livrable ?</h2>
    <p class="extract-quote extract-quote--plain">${esc(k.text)}</p>
    <label class="field-wrap"><span class="field-label">Étape du parcours</span>
      <select class="field" name="col">${cols.map((c) => `<option value="${c.id}">${esc(c.text)}</option>`).join('')}</select></label>
    <label class="field-wrap"><span class="field-label">Version</span>
      <select class="field" name="lane">${STORY_LANES.map((l) => `<option value="${l.id}">${esc(l.label)}</option>`).join('')}</select></label>
    <div class="dialog-actions"><span></span>
      <button type="button" class="btn btn-quiet" data-cancel>Annuler</button>
      <button type="submit" class="btn btn-primary">Placer</button></div>
  </form>`, { mode: 'place-kept', id });
}

function openExtract(extractId) {
  const e = extractById(extractId);
  if (!e) return;
  openDialog(`<div class="dialog-form">
    <h2 id="editor-title">Où ranger cet extrait ?</h2>
    <blockquote class="extract-quote">${esc(e.text)}</blockquote>
    <div class="zone-choices">${EMPATHY_ZONES.map((z) => `<button type="button" class="zone-choice" style="--h:${ZONE_HUES[z.id]}" data-zone="${z.id}"><strong>${esc(z.label)}</strong><span>${esc(z.question)}</span></button>`).join('')}</div>
    <div class="dialog-actions"><span></span><button type="button" class="btn btn-quiet" data-cancel>Annuler</button></div>
  </div>`, { mode: 'extract', id: extractId });
  editor.querySelector('.zone-choice')?.focus();
}

editor.addEventListener('click', (e) => {
  if (e.target === editor || e.target.closest('[data-cancel]')) { editor.close(); return; }
  if (e.target.closest('[data-delete]') && editing?.mode === 'edit') {
    const n = getNote(state, editing.id);
    if (!n) { editor.close(); return; }
    const kids = childrenOf(state, editing.id).length;
    if (n.place.b !== 'backbone' && kids && !confirm(`Supprimer aussi les ${kids} post-it${kids > 1 ? 's' : ''} rattaché${kids > 1 ? 's' : ''} ?`)) return;
    if (n.from?.startsWith('extract:')) unplaceExtract(state, n.id);
    else removeNote(state, n.id);
    editor.close();
    commit();
    announce('Post-it supprimé');
    return;
  }
  const zone = e.target.closest('[data-zone]');
  if (zone && editing?.mode === 'extract') {
    const note = placeExtract(state, editing.id, zone.dataset.zone);
    editor.close();
    commit();
    announce(`Extrait rangé dans ${EMPATHY_ZONES.find((z) => z.id === zone.dataset.zone).label}`);
    if (note) $(`[data-focus="extract:${availableExtracts(state, state.persona)[0]?.id}"]`, main)?.focus();
  }
});

editor.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const text = form.elements.text?.value ?? '';
  if (editing.mode === 'place-kept') {
    const place = { b: 'story', col: form.elements.col.value, lane: form.elements.lane.value };
    const note = importKept(editing.id, place);
    editor.close();
    if (note) { commit({ focus: `note:${note.id}` }); announce('Livrable placé dans la story map'); }
    return;
  }
  if (editing.mode === 'new') {
    const note = addNote(state, editing.place, text, hooks.author ? { author: hooks.author() } : {});
    editor.close();
    if (note) commit({ focus: `note:${note.id}` });
    return;
  }
  if (editing.mode === 'edit') {
    const n = getNote(state, editing.id);
    if (!n) { editor.close(); toast('Ce post-it vient d\'être supprimé par quelqu\'un du groupe.'); return; }
    if (!n.from?.startsWith('extract:')) updateNote(state, n.id, text);
    const place = decodePlace(form.elements.place?.value);
    if (place && !samePlace(place, n.place)) {
      const r = moveNote(state, n.id, place);
      if (!r.ok) toast(blockMessage(r.reason));
    }
    if (form.elements.keep && form.elements.keep.checked !== !!getNote(state, n.id)?.keep) toggleKeep(state, n.id);
    editor.close();
    commit({ focus: `note:${n.id}` });
  }
});

editor.addEventListener('close', () => {
  const ctx = editing;
  editing = null;
  if (ctx?.mode === 'new') $(`[data-focus="add:${CSS.escape(encodePlace(ctx.place))}"]`, main)?.focus();
});

function blockMessage(reason) {
  return reason === 'children'
    ? 'Ce post-it a des post-its rattachés : déplacez-les ou supprimez-les d\'abord.'
    : 'Ce post-it ne peut pas aller là.';
}

/* ---------- Clics dans la page ---------- */

const EDIT_TARGETS = '[data-add], [data-note], [data-extract], [data-keep], [data-deliv], [data-persona], [data-act="compare"], [data-act="journey-example"], [data-act="journey-validate"], [data-act="journey-reopen"]';

main.addEventListener('click', (e) => {
  const t = e.target;
  const groupTab = t.closest('[data-group]');
  if (groupTab) { showGroup(groupTab.dataset.group); render(`group:${groupTab.dataset.group}`); return; }
  if (!canEdit() && t.closest(EDIT_TARGETS)) {
    toast(shared.group === 'sim' ? 'Groupe simulé : lecture seule.' : shared.restitution ? 'Restitution : seul l\'animateur déplace les post-its.' : 'Lecture seule : c\'est le tableau de l\'autre groupe.');
    return;
  }
  const info = t.closest('[data-info]');
  if (info) {
    ui.info = ui.info === info.dataset.info ? null : info.dataset.info;
    render(`info:${info.dataset.info}`);
    return;
  }
  if (ui.info) { ui.info = null; $$('.dtip.is-open', main).forEach((d) => d.classList.remove('is-open')); $$('[data-info]', main).forEach((b) => b.setAttribute('aria-expanded', 'false')); }
  const goBtn = t.closest('[data-go]');
  if (goBtn) { go(goBtn.dataset.go); return; }

  const add = t.closest('[data-add]');
  if (add) { openNew(decodePlace(add.dataset.add), add.dataset.label); return; }

  const keepBtn = t.closest('[data-keep]');
  if (keepBtn) {
    toggleKeep(state, keepBtn.dataset.keep);
    commit();
    announce(getNote(state, keepBtn.dataset.keep)?.keep ? 'Livrable retenu pour la story map' : 'Livrable non retenu');
    return;
  }

  const note = t.closest('[data-note]');
  if (note) { openEdit(note.dataset.note); return; }

  const extract = t.closest('[data-extract]');
  if (extract) { openExtract(extract.dataset.extract); return; }

  const persona = t.closest('[data-persona]');
  if (persona) {
    if (shared.on) { shared.setState(shared.group, 'persona', persona.dataset.persona); return; }
    state.persona = persona.dataset.persona; commit(); return;
  }

  const deliv = t.closest('[data-deliv]');
  if (deliv) {
    openPlaceKept(deliv.dataset.deliv);
    return;
  }

  const select = t.closest('[data-select-tool]');
  if (select) {
    const tool = select.dataset.selectTool;
    ui.selectedTool = ui.selectedTool === tool ? null : tool;
    render(`tool:${tool}`);
    return;
  }

  const phase = t.closest('[data-place-tool]');
  if (phase && ui.selectedTool) { placeTool(ui.selectedTool, phase.dataset.placeTool); return; }

  const answer = t.closest('[data-answer]');
  if (answer) {
    answerSituation(state, answer.dataset.answer, answer.dataset.choice);
    commit();
    return;
  }

  const act = t.closest('[data-act]')?.dataset.act;
  if (act) actions[act]?.();
});

main.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][tabindex]')) {
    e.preventDefault();
    e.target.click();
  }
});

main.addEventListener('input', (e) => {
  if (e.target.id === 'takeaways') {
    state.debrief.takeaways = e.target.value.slice(0, 4000);
    persist();
  }
});

function placeTool(tool, phase) {
  setPlacement(state, tool, phase);
  ui.selectedTool = null;
  commit({ focus: `tool:${tool}` });
  announce(`${toolName(tool)} rangé dans ${PHASES.find((p) => p.id === phase).label}`);
}

const actions = {
  'theory-open'() {
    if (state.step === 'frame') ui.frameTheory = true;
    else state.theoryClosed = state.theoryClosed.filter((st) => st !== state.step);
    commit({ focus: 'theory' });
  },
  'theory-close'() {
    if (state.step === 'frame') { ui.frameTheory = false; render('theory'); return; }
    if (!state.theoryClosed.includes(state.step)) state.theoryClosed.push(state.step);
    commit();
    $('.brief', main)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'reset-answers'() { state.debrief.answers = {}; commit(); },
  'phones-show'() { phones.show(); },
  async 'copy-link'() {
    const ok = await copyText(phones.shareUrl);
    toast(ok ? 'Lien copié : collez-le dans le chat de la réunion.' : 'Copie impossible : sélectionnez le lien à la main.');
  },
  async 'quiz-start'() {
    await phones.clearQuiz();
    if (await phones.setQuiz('open')) announce('Quiz lancé');
  },
  async 'quiz-reveal'() {
    if (await phones.setQuiz('revealed')) announce('Réponses révélées');
  },
  async 'quiz-stop'() {
    if (!confirm('Fermer le quiz ? Les participants reviennent à l\'écran d\'attente.')) return;
    await phones.setQuiz('off');
  },
  async 'quiz-replay'() {
    if (!confirm('Effacer toutes les copies et relancer un quiz ?')) return;
    await phones.setQuiz('off');
    await phones.clearQuiz();
    await phones.setQuiz('open');
  },
  compare() {
    if ((!HOST || shared.group === 'sim') && shared.on) return;
    if (shared.on) { shared.setState(shared.group, 'compare', !state.compare[state.persona]); return; }
    state.compare[state.persona] = !state.compare[state.persona]; commit({ focus: 'compare' });
  },
  restitution() { phones?.setRestitution(!shared.restitution); },
  'journey-example'() {
    if (!HOST) return;
    useJourneyExample(state, state.persona);
    commit();
    announce('Parcours type posé : modifiez-le librement');
  },
  'journey-validate'() {
    const n = validateJourney(state);
    if (!n) return;
    commit();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Parcours validé : il devient la première ligne de votre story map.');
  },
  'journey-reopen'() {
    if (!confirm('Revenir au récit du parcours ? Les stories déjà posées restent attachées à leur étape.')) return;
    reopenJourney(state);
    commit();
  },
  check() { state.debrief.checked = true; commit({ focus: 'check' }); },
  async copy() {
    const text = reportBoards().map(({ title, notes }) => `${title ? `===== ${title.toUpperCase()} =====\n` : ''}${reportText({ ...state, notes }, today())}`).join('\n\n');
    const ok = await copyText(text + quizReportLines());
    toast(ok ? 'Compte rendu copié' : 'Copie impossible : utilisez l\'impression');
  },
  print() { printReport(); },
  save() { downloadJson(serialize(state), `atelier-produit-${today()}.json`); },
  open() { $('#file-input').click(); },
  reset() {
    if (!confirm('Effacer tout l\'atelier en cours et repartir de zéro ? (Pensez à l\'enregistrer avant.)')) return;
    const seen = state.seen;
    state = newState();
    state.seen = seen; // les post-its déjà reçus des téléphones ne reviennent pas
    commit();
    window.scrollTo({ top: 0 });
  },
};

$('#file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const parsed = parseSaved(JSON.parse(await file.text()));
    if (state.notes.length && !confirm('Remplacer l\'atelier en cours par celui du fichier ?')) return;
    parsed.seen = [...new Set([...state.seen, ...parsed.seen])];
    state = parsed;
    commit();
    toast('Atelier repris');
  } catch {
    toast('Ce fichier n\'est pas un atelier enregistré.');
  }
});

/* ---------- Glisser-déposer ---------- */

const splitKey = (key) => { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)]; };

function accepts(dragKey, dropKey) {
  if (!canEdit()) return false;
  const [type, id] = splitKey(dragKey);
  if (type === 'tool') return dropKey === 'tools' || dropKey.startsWith('phase:');
  if (type === 'extract') {
    const place = decodePlace(dropKey);
    return place?.b === 'empathy' && place.persona === extractById(id)?.persona;
  }
  if (type === 'deliv') return familyOf(decodePlace(dropKey)) === 'story' && decodePlace(dropKey).b !== 'backbone';
  if (type === 'note') {
    const n = getNote(state, id);
    if (!n) return false;
    if (dropKey.startsWith('pool:')) return !!n.from?.startsWith('extract:');
    const place = decodePlace(dropKey);
    return !!place && (samePlace(place, n.place) || !moveBlocker(state, id, place));
  }
  return false;
}

function onDrop(dragKey, dropKey, beforeKey) {
  const [type, id] = splitKey(dragKey);
  const beforeId = beforeKey?.startsWith('note:') ? beforeKey.slice(5) : null;
  if (type === 'tool') {
    if (dropKey === 'tools') { setPlacement(state, id, null); commit(); return; }
    placeTool(id, dropKey.slice(6));
    return;
  }
  if (type === 'extract') {
    const place = decodePlace(dropKey);
    placeExtract(state, id, place.zone, beforeId);
    commit();
    announce(`Extrait rangé dans ${placeLabel(state, place)}`);
    return;
  }
  if (type === 'deliv') {
    importKept(id, decodePlace(dropKey), beforeId);
    commit();
    return;
  }
  if (type === 'note') {
    if (dropKey.startsWith('pool:')) { unplaceExtract(state, id); commit(); announce('Extrait remis dans la pioche'); return; }
    const place = decodePlace(dropKey);
    const r = moveNote(state, id, place, beforeId);
    if (!r.ok) { toast(blockMessage(r.reason)); return; }
    commit({ focus: `note:${id}` });
    announce(`Post-it rangé : ${placeLabel(state, place)}`);
  }
}

setupDnd(main, { accepts, onDrop });

/* ---------- Impression ---------- */

/** Résultats du quiz pour le compte rendu (si le quiz a été joué). */
function quizReportLines() {
  const entries = ui.quizEntries;
  if (!entries.length) return '';
  const st = quizStats(entries);
  const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const top = podium(entries).map((p) => `${p.rank}. ${p.author} (${fmt(p.points)} / ${QUIZ_MAX})`).join(', ');
  return `\n\nQUIZ\n${st.count} participant${st.count > 1 ? 's' : ''}, moyenne ${fmt(st.average)} / ${QUIZ_MAX}. Podium : ${top}.`;
}

/** Les tableaux à mettre dans le compte rendu : un par groupe pendant une séance, sinon le tableau local. */
function reportBoards() {
  if (!shared.on) return [{ title: '', notes: state.notes }];
  return groupIdsFor(shared.groups).map((g) => ({ title: shared.groups === 2 ? groupName(g) : '', notes: shared.boards[g].notes }));
}

function buildReport() {
  const saved = state.notes;
  const sections = reportBoards().map(({ title, notes }) => {
    state.notes = notes;
    return `${title ? `<h2 class="pr-group">${esc(title)}</h2>` : ''}${boardReportHtml()}`;
  }).join('');
  state.notes = saved;
  $('#print-report').innerHTML = `
    <h1>Atelier Produit · ${esc(CASE.name)}</h1>
    <p class="muted">${esc(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
    ${sections}
    <h2>Débrief</h2>${quizReportLines() ? `<p class="pre">${esc(quizReportLines().trim().replace(/^QUIZ\n/, 'Quiz : '))}</p>` : ''}
    ${state.debrief.takeaways.trim() ? `<h3>Ce que l'équipe retient</h3><p class="pre">${esc(state.debrief.takeaways.trim())}</p>` : ''}`;
}

function boardReportHtml() {
  const list = (items) => (items.length ? `<ul>${items.map((n) => `<li>${esc(n.text)}${n.author ? ` <em>(${esc(n.author)})</em>` : ''}</li>`).join('')}</ul>` : '<p class="muted">—</p>');
  const empathy = PERSONAS.filter((p) => state.notes.some((n) => n.place.b === 'empathy' && n.place.persona === p.id)).map((p) => `
    <h3>${esc(p.name)}, ${esc(p.role.toLowerCase())}</h3>
    <div class="pr-grid">${EMPATHY_ZONES.map((z) => `<div><h4>${esc(z.label)}</h4>${list(notesIn(state, { b: 'empathy', persona: p.id, zone: z.id }))}</div>`).join('')}</div>`).join('') || '<p class="muted">Non remplie.</p>';
  const actorsHtml = (g) => notesIn(state, { b: 'actor', parent: g.id }).map((a) => `<li><strong>${esc(a.text)}</strong><ul>${notesIn(state, { b: 'impact', parent: a.id }).map((i) => `<li>${esc(i.text)}<ul>${notesIn(state, { b: 'deliverable', parent: i.id }).map((d) => `<li>${esc(d.text)}${d.keep ? ' ★' : ''}</li>`).join('')}</ul></li>`).join('')}</ul></li>`).join('');
  const tree = notesIn(state, { b: 'goal' }).map((g) => `<p><strong>Objectif :</strong> ${esc(g.text)}</p><ul>${actorsHtml(g)}</ul>`).join('') || '<p class="muted">Non remplie.</p>';
  const cols = notesIn(state, { b: 'backbone' });
  const story = cols.length ? `<table><thead><tr><th></th>${cols.map((c) => `<th>${esc(c.text)}</th>`).join('')}</tr></thead><tbody>
    ${STORY_LANES.map((l) => `<tr><th>${esc(l.label)}</th>${cols.map((c) => `<td>${notesIn(state, { b: 'story', col: c.id, lane: l.id }).map((n) => `<p>${esc(n.text)}</p>`).join('')}</td>`).join('')}</tr>`).join('')}
  </tbody></table>` : '<p class="muted">Non remplie.</p>';
  return `<h2>Empathy map</h2>${empathy}
    <h2>Impact map</h2>${tree}
    <h2>Story map</h2>${story}`;
}

function printReport() {
  buildReport();
  window.print();
}

/* ---------- Participants (animateur) ---------- */

let phonesSig = '';
function startHost() {
  phones = createPhones({
    onChange() {
      const sig = `${phones.live}|${phones.quiz}|${phones.url}|${phones.code}|${phones.groups}|${phones.restitution}|${phones.presence.map((p) => p.uid + p.author).join(',')}|${JSON.stringify(phones.members)}`;
      refreshJoinDialog();
      renderDock();
      if (sig === phonesSig) return;
      phonesSig = sig;
      shared.groups = phones.groups;
      shared.restitution = phones.restitution;
      if (shared.on && !boardGroups().includes(shared.group)) showGroup('g1');
      render();
    },
    onLive(live) {
      if (live && !shared.on) {
        enterShared({ write: (g, u) => phones.writeBoard(g, u), setState: (g, k, v) => phones.setBoardState(g, k, v) });
        render();
      } else if (!live && shared.on) {
        leaveShared();
        render();
      }
    },
    onBoard: receiveBoard,
    onQuiz(entries) {
      ui.quizEntries = entries;
      if (state.step === 'debrief') render();
    },
    button: $('#phones-btn'),
    dialog: $('#phones'),
    count: $('#phones-count'),
    current: () => ({ step: state.step, persona: state.persona }),
    onRemote() {},
  });
}

/* ---------- Démarrage ---------- */

/** Ce que participant.js pilote : étape, tableaux, vues propres au participant. */
export const api = {
  get state() { return state; },
  shared,
  hooks,
  render,
  enterShared,
  receiveBoard,
  receiveKept,
  showGroup,
  setStep(step) {
    if (step === state.step) return;
    setStep(state, step);
    persist();
    render();
    window.scrollTo({ top: 0 });
  },
};

setupTheme($('#theme-toggle'));
if (HOST) {
  startHost();
  render();
  phones.resume();
  window.addEventListener('beforeprint', buildReport);
  window.addEventListener('afterprint', () => { $('#print-report').innerHTML = ''; });
  // Un autre onglet a modifié l'atelier : on suit (hors séance).
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY || !e.newValue || shared.on) return;
    try { state = parseSaved(JSON.parse(e.newValue)); render(); } catch { /* ignoré */ }
  });
} else {
  import('./participant.js?v=__VERSION__').then((m) => m.startParticipant(api));
}
