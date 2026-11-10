// Écran de l'animateur : le parcours guidé en cinq étapes, projeté devant l'équipe.
// L'état vit dans le navigateur (localStorage) ; les post-its des téléphones arrivent par phones.js.

import {
  STEPS, WELCOME, CASE, PERSONAS, EMPATHY_ZONES, IMPACT_LEVELS, STORY_LANES, TOOLS, PHASES, PLACES, ALL_PLACE, TOOL_PHASES,
  STEP_PHASES, BRIEFS, SITUATIONS, SITUATION_CHOICES, PHONE_STEPS, DIAMOND_MESSAGE, DIAMOND_LOOP,
  PLACEMENT_FEEDBACK, EXAMPLE_CASE, EMPATHY_EXAMPLE, IMPACT_EXAMPLE, STEP_LINKS, BRAVO, STORY_EXAMPLE, EXAMPLE_JOURNEY,
  JOURNEY_RULES, JOURNEY_QUESTIONS, JOURNEY_MIN, JOURNEY_MAX, ACTION_EXAMPLES,
} from './content.js?v=__VERSION__';
import {
  newState, setStep, nextStep, prevStep, stepIndex, addNote, updateNote, moveNote, moveBlocker, removeNote,
  SORT_LANE, notesIn, getNote, childrenOf, placesFor, encodePlace, decodePlace, samePlace, familyOf, placeLabel,
  availableExtracts, placeExtract, unplaceExtract, extractById, compareEmpathy, emptyZones, personaById,
  toggleKeep, keptDeliverables, importDeliverable, mvpGaps,
  useJourneyExample, journeyNotes, journeyHints, simulatedNotes,
  allActions, looseActions, actionsOf, stepsWithoutDeliverable,
  setPlacement, checkPlacement, answerSituation, situationScore, situationVerdict, mergeRemote, reportText,
  boardUpdates, recordsToNotes,
  serialize, parseSaved, sanitize, toolName, TOOL_IDS, MAX_TEXT,
} from './core.js?v=__VERSION__';
import { createRoti, rotiJoinUrl, rotiHostUrl } from './roti.js?v=__VERSION__';
import { $, $$, esc, toast, announce, copyText, load, save, setupTheme, downloadJson, today, qrSvg, ICONS } from './shared.js?v=__VERSION__';
import {
  podium, quizStats, waitingFor, QUIZ_MAX, groupIdsFor, groupName, DEFAULT_PERSONAS,
  TIMER_STEPS, stepDuration, QUIZ_DURATION, timerLeft, timerRunning, startTimer, pauseTimer, resumeTimer, addTime, formatClock,
} from './session-core.js?v=__VERSION__';
import { setupDnd } from './dnd.js?v=__VERSION__';
import { createPhones } from './phones.js?v=__VERSION__';

/** Animateur (index.html) ou participant (index.html?code=…) : même interface, droits différents. */
export const HOST = document.body.dataset.mode !== 'participant';
const STORE_KEY = HOST ? 'atelier-produit.state' : 'atelier-produit.participant';
const STEP_TOOL = { frame: 'designThinking', empathy: 'empathy', impact: 'impact', story: 'story', debrief: 'designThinking' };
/** Numéro de l'étape dans la barre du haut. */
const STEP_NUMBER = Object.fromEntries(STEPS.map((x, i) => [x.id, i + 1]));
const ZONE_HUES = { says: 205, thinks: 265, does: 150, feels: 330, pains: 6, gains: 44 };
const KIND_HUES = { goal: 262, actor: 205, impact: 28, deliverable: 150 };
const CHOICE_LABELS = { empathy: 'Empathy map', impact: 'Impact mapping', story: 'Story mapping', designThinking: 'La démarche complète (Design Thinking)' };

const main = $('#main');
let state = restore();
const ui = { selectedTool: null, info: null, theoryOpen: new Set(), frameFolded: false, caseOpen: {}, exampleOpen: {}, scrolled: {}, quizEntries: [], actionDraft: '', storyStage: 'recit' };
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
const canEdit = () => !shared.on || (shared.group !== 'sim' && (HOST || (shared.group === shared.myGroup && !shared.restitution && !myGroupDone() && !timeUp())));
/** Temps écoulé à l'étape : les tableaux des groupes sont verrouillés jusqu'à la restitution. */
function timeUp() {
  const t = HOST ? phones?.timer : shared.timer;
  return !!t && t.step === state.step && TIMER_STEPS.includes(state.step) && timerLeft(t, state.step, HOST ? (phones?.now ?? Date.now()) : Date.now() + (shared.offset ?? 0)) === 0;
}
/** Le groupe du participant a dit « Nous avons terminé » pour l'étape : son tableau est verrouillé. */
const myGroupDone = () => shared.boards[shared.myGroup]?.state?.done?.[state.step] === true;
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

/**
 * Story map : les trois temps (raconter, regrouper, la story map). Chacun y navigue librement, de son
 * côté ; pendant la restitution, tout le monde est sur la story map.
 */
function storyStage() {
  if (shared.group === 'sim' || (shared.on && shared.restitution)) return 'map';
  return ui.storyStage;
}
function setStoryStage(stage) {
  ui.storyStage = stage;
  render();
  main.querySelector('.jstages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

/**
 * Livrables étoilés à importer dans la story map : ceux de la persona du tableau affiché
 * (chaque groupe garde sa persona), avec leur état d'import sur ce tableau.
 */
function keptForStory() {
  if (!shared.on) return keptDeliverables(state);
  const g = shared.group;
  const list = HOST
    ? (shared.boards[g]?.notes ?? []).filter((n) => n.place.b === 'deliverable' && n.keep).map((n) => ({ id: n.id, text: n.text, group: g }))
    : shared.kept.filter((k) => k.group === g);
  return list.map((k) => ({ ...k, imported: state.notes.some((m) => m.from === `deliverable:${k.id}`) }));
}

/** Livrables étoilés par groupe (ou sur le tableau local) : il en faut au moins 2 par persona. */
const KEPT_MIN = 2;
function keptCounts() {
  const count = (notes) => notes.filter((n) => n.place.b === 'deliverable' && n.keep).length;
  if (!shared.on) return [{ g: null, name: personaById(state.persona)?.name ?? '', n: count(state.notes) }];
  return groupIdsFor(shared.groups).map((g) => ({ g, name: personaById(groupPersona(g))?.name ?? '', n: count(shared.boards[g]?.notes ?? []) }));
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
  return HOST ? !!phones?.live : !!shared.myGroup && !hooks.screen?.() && exerciseOn();
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
      <div class="td-groups">${chips}</div>
      ${!shared.restitution && (timeUp() || groupIdsFor(shared.groups).every((g) => groupDone(g))) ? `<button type="button" class="td-btn td-btn--primary" data-timer="restitution">${timeUp() ? 'Temps écoulé' : 'Tout le monde a terminé'} : lancer la restitution</button>` : ''}`;
  } else if (shared.restitution) {
    body = '<p class="td-note">Place à la restitution : suivez l\'animateur.</p>';
  } else if (timeUp()) {
    body = '<p class="td-note">Temps écoulé : votre tableau est verrouillé, l\'animateur va lancer la restitution.</p>';
  } else {
    const mine = groupDone(shared.myGroup);
    body = mine
      ? `<p class="td-note td-note--done">${ICONS.check} Votre groupe a terminé · en attente de la restitution</p><button type="button" class="td-btn td-btn--quiet" data-timer="undone">Finalement, on continue</button>`
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

let lockedBefore = null;
/** À zéro, le verrouillage s'applique sans attendre une autre mise à jour. */
function checkLock() {
  if (!shared.on) return;
  const locked = timeUp();
  if (lockedBefore !== null && locked !== lockedBefore) render();
  lockedBefore = locked;
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
    if (act === 'restitution') { if (TIMER_STEPS.includes(state.step)) phones.setMetaFlag('restituted', state.step).catch(() => {}); await phones.setRestitution(true).catch(() => toast('Restitution non lancée : la connexion est peut-être coupée.')); return; }
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

let quizClosing = false;
/** Quiz : compte à rebours chez l'animateur ; quelques secondes après zéro (le temps que les copies arrivent), on révèle. */
function quizTick() {
  if (!HOST || !phones?.live || phones.quiz !== 'open' || !phones.quizEndsAt) return;
  const left = Math.max(0, phones.quizEndsAt - phones.now);
  const clock = main.querySelector('#host-qclock');
  if (clock) clock.textContent = formatClock(left);
  if (left === 0 && phones.now >= phones.quizEndsAt + 4000 && !quizClosing) {
    quizClosing = true;
    actions['quiz-reveal']().finally(() => { quizClosing = false; });
  }
}

setInterval(() => { renderDock(); checkLock(); quizTick(); }, 1000);

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
  const draft = main.querySelector('#action-input');
  const caret = draft && draft === active ? draft.selectionStart : null;
  if (draft) ui.actionDraft = draft.value;
  const screen = hooks.screen?.(); // participant : accueil, prénom, attente d'un groupe
  main.innerHTML = screen ?? views[state.step]();
  main.classList.toggle('is-readonly', !canEdit());
  $$('.canvas-scroll').forEach((s, i) => { if (scroll[i]) s.scrollLeft = scroll[i]; });
  renderStepper();
  refreshJoinDialog();
  renderDock();
  if (keep) main.querySelector(`[data-focus="${CSS.escape(keep)}"]`)?.focus({ preventScroll: true });
  if (shared.on && ['empathy', 'impact', 'story'].includes(state.step)) {
    const key = `${state.step}:${exerciseOn() ? 'exercise' : practiceOn() ? 'case' : 'theory'}`;
    if (!ui.scrolled[key] && key.endsWith('case')) main.querySelector('.case-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!ui.scrolled[key] && key.endsWith('exercise') && (ui.scrolled[`${state.step}:case`] || ui.scrolled[`${state.step}:theory`])) main.querySelector('.brief')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    ui.scrolled[key] = true;
  }
  const input = main.querySelector('#action-input');
  if (input && caret !== null && document.activeElement === input) input.setSelectionRange(caret, caret);
}

const focusKey = (el) => el.closest('[data-focus]')?.dataset.focus ?? null;

function go(step) {
  if (!HOST) return;
  const idx = (x) => STEPS.findIndex((st) => st.id === x);
  if (phones?.live && TIMER_STEPS.includes(state.step) && idx(step) > idx(state.step) && !phones.restituted?.[state.step] && !shared.restitution) {
    toast('Lancez d\'abord la restitution de cette étape, puis passez à la suite.');
    return;
  }
  if (step === 'story' && state.step !== 'story') {
    const missing = keptCounts().filter((k) => k.n < KEPT_MIN);
    if (missing.length) {
      toast(`Avant le story mapping, étoilez au moins ${KEPT_MIN} livrables par persona : ${missing.map((k) => `${k.name} ${k.n}/${KEPT_MIN}`).join(', ')}.`);
      return;
    }
  }
  if (!setStep(state, step)) return;
  ui.selectedTool = null;
  commit();
  window.scrollTo({ top: 0 });
  $('h1', main)?.focus({ preventScroll: true });
  announce(STEPS.find((s) => s.id === step).label);
}

/* ---------- En-tête : étapes ---------- */

/** Étape déjà atteinte (ou en cours) : son nom se révèle ; les suivantes restent anonymes. */
function stepRevealed(id) {
  const idx = (x) => STEPS.findIndex((s) => s.id === x);
  return idx(id) <= idx(state.step) || state.visited.includes(id);
}

function renderStepper() {
  $('#stepper').innerHTML = STEPS.map((s, i) => `<li><button type="button" data-go="${s.id}" ${s.id === state.step ? 'aria-current="step"' : ''} ${HOST ? '' : 'disabled'}>
      <span class="step-n">${state.visited.includes(s.id) && s.id !== state.step ? ICONS.check : i + 1}</span><span class="step-label">${esc(stepRevealed(s.id) ? s.label : `Étape ${i + 1}`)}</span>
    </button></li>`).join('');
}

$('#stepper').addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});

/* ---------- Éléments communs ---------- */

/**
 * La pratique est-elle lancée pour cette étape ? En arrivant, seule la théorie s'affiche ;
 * l'animateur lance la pratique pour tous (« Passer à la pratique »). Le débrief n'a pas de théorie.
 */
function practiceOn(step = state.step) {
  if (['debrief', 'welcome', 'frame', 'bravo'].includes(step)) return true;
  if (shared.on && !HOST) return shared.practice?.[step] === true;
  return state.practice.includes(step) || phones?.practice?.[step] === true;
}

/**
 * L'exercice est-il lancé ? Pour l'empathy map, l'animateur montre d'abord le cas fil rouge
 * (« Passer à la pratique »), puis lance l'exercice (consigne, carte, minuteur). Ailleurs, c'est la pratique.
 */
function exerciseOn(step = state.step) {
  if (step !== 'empathy') return practiceOn(step);
  if (!practiceOn(step)) return false;
  if (shared.on && !HOST) return shared.exercise?.[step] === true;
  return state.exercise.includes(step) || phones?.exercise?.[step] === true;
}

/** Exemple de la cantine : replié jusqu'à ce que l'animateur le dévoile, puis chacun le replie chez soi. */
function exampleRevealed(step) {
  if (shared.on && !HOST) return shared.examples?.[step] === true;
  return state.examples.includes(step) || phones?.examples?.[step] === true;
}
function exampleBlock(step, html) {
  if (!exampleRevealed(step)) {
    return HOST || !shared.on
      ? `<div class="example-gate"><p>${ICONS.book} Un exemple complet, sur un autre sujet : à montrer une fois la théorie présentée.</p>
          <button type="button" class="btn btn-primary btn-small" data-act="example-show" data-focus="example">Afficher l'exemple${shared.on ? ' pour tous' : ''}</button></div>`
      : '<div class="example-gate"><p>L\'exemple sera montré après la théorie.</p></div>';
  }
  const open = ui.exampleOpen[step] ?? true;
  if (!open) {
    return `<div class="example-gate"><p>${ICONS.book} Exemple complet : ${esc(EXAMPLE_CASE.name)}.</p>
      <button type="button" class="btn btn-quiet btn-small" data-act="example-toggle" data-focus="example">Revoir l'exemple</button></div>`;
  }
  return `${html}<div class="example-foot"><button type="button" class="btn btn-quiet btn-small" data-act="example-toggle" data-focus="example">Replier l'exemple ↑</button></div>`;
}

/** Le fil entre les étapes : d'où l'on repart, à quoi ça servira. */
function stepLink(step) {
  const l = STEP_LINKS[step];
  if (!l) return '';
  return `<section class="step-link" aria-label="Le fil de l'atelier">
    <p><span class="step-link-tag">On repart de</span>${esc(l.from)}</p>
    <p><span class="step-link-tag step-link-tag--to">Ça servira</span>${esc(l.to)}</p>
  </section>`;
}

/** Tant que la pratique n'est pas lancée : ce que voient l'animateur et les participants sous la théorie. */
function practiceGate(step) {
  return `<section class="practice-gate">
    ${HOST || !shared.on
      ? `<p>Présentez la théorie, puis lancez la pratique pour tout le monde${TIMER_STEPS.includes(step) && phones?.live ? ' : le minuteur démarre en même temps' : ''}.</p>
        <button type="button" class="btn btn-primary" data-act="practice-start" data-focus="practice-start">Passer à la pratique ↓</button>`
      : '<p>Un peu de patience : quelques minutes de théorie, puis on passe à la pratique.</p>'}
  </section>
  ${HOST ? stepNav() : ''}`;
}

function stepHeader(step) {
  const withCase = step === 'empathy' && practiceOn(step);
  const tool = TOOLS[STEP_TOOL[step]];
  const n = STEP_NUMBER[step];
  const phases = STEP_PHASES[step].map((p) => PHASES.find((x) => x.id === p).label).join(' · ');
  const debrief = step === 'debrief';
  return `<header class="step-head">
    <div class="intro">
      <p class="kicker">${n ? `Étape ${n} · ` : ''}${esc(phases)}</p>
      <h1 tabindex="-1">${esc(debrief ? 'Débrief' : tool.name)}</h1>
      <p class="lede">${esc(debrief ? 'Un quiz individuel, chacun sur son ordinateur ou son téléphone, puis la révélation : chacun reçoit sa correction, et l\'écran montre les bonnes réponses.' : tool.oneLine)}</p>
    </div>
    <div class="step-head-art">${stepArt(step)}${diamondMini(STEP_PHASES[step])}</div>
  </header>
  ${debrief ? '' : theoryBlock(step)}
  ${withCase ? caseBlock() : ''}
  ${exerciseOn(step) ? briefBlock(step) + stepLink(step) : ''}
  ${debrief ? '' : boardBar()}`;
}

/**
 * Au-dessus du tableau : quel groupe on regarde. L'animateur passe d'un groupe à l'autre et lance la
 * restitution ; pendant la restitution, chaque participant peut aussi regarder l'autre groupe.
 */
function boardBar() {
  if (!shared.on || ['frame', 'welcome', 'bravo'].includes(state.step)) return '';
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
    ${HOST ? `${shared.restitution || exerciseOn() ? `<button type="button" class="btn ${shared.restitution ? 'btn-quiet' : 'btn-primary'} btn-small" data-act="restitution" data-focus="restitution">${shared.restitution ? 'Terminer la restitution' : 'Lancer la restitution'}</button>` : ''}
      <p class="hint">${hostHint}</p>`
      : `<p class="hint">Restitution : ${partHint}, en lecture seule. L'animateur déplace les post-its.</p>`}
  </div>`;
}

/** La théorie de l'outil : dépliée au départ, repliée une fois qu'on passe à la pratique. */
function theoryBlock(step, { closable = true, extra = '' } = {}) {
  const t = TOOLS[STEP_TOOL[step]];
  // Pratique lancée : la théorie se replie, chacun peut la rouvrir (chez soi). Le Cadre n'est que
  // de la théorie : ouvert d'abord, chacun le replie s'il veut.
  const closed = step === 'frame' ? ui.frameFolded : practiceOn(step) && !ui.theoryOpen.has(step);
  if (closed) {
    return `<section class="theory is-closed">
      <button type="button" class="theory-toggle" data-act="theory-open" data-focus="theory" aria-expanded="false">
        ${ICONS.book}<span><strong>La théorie : ${esc(t.name)}</strong> ${step === 'frame' ? 'et le double diamant' : `à quoi ça sert, quand l'utiliser, comment faire${['empathy', 'impact', 'story'].includes(step) ? ', et un exemple complet' : ''}`}</span><span class="theory-open">Revoir</span>
      </button>
    </section>`;
  }
  return `<section class="theory" aria-labelledby="theory-${step}">
    <div class="theory-head">
      <p class="kicker">${ICONS.book} La théorie</p>
      <h2 id="theory-${step}">${esc(t.name)}</h2>
    </div>
    <div class="theory-grid">
      <div class="theory-col theory-col--why">
        <span class="welcome-icon">${WELCOME_ICONS.goal}</span>
        <h3>À quoi ça sert</h3><p>${esc(t.why)}</p>
        <h3>Quand l'utiliser</h3><ul>${t.when.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      </div>
      <div class="theory-col theory-col--how">
        <span class="welcome-icon">${WELCOME_ICONS.format}</span>
        <h3>Comment faire</h3><ol class="theory-how">${t.how.map((w) => `<li>${esc(w)}</li>`).join('')}</ol>
      </div>
      <div class="theory-col theory-col--pitfalls">
        <span class="welcome-icon">${WELCOME_ICONS.warn}</span>
        <h3>Pièges classiques</h3><ul class="pitfalls">${t.pitfalls.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      </div>
    </div>
    ${step === 'empathy' ? exampleBlock(step, empathyExample()) : step === 'impact' ? exampleBlock(step, impactExample()) : step === 'story' ? exampleBlock(step, storyExample()) : ''}
    ${extra}
    <div class="theory-foot">
      <p class="theory-origin">${esc(t.origin)}</p>
      ${closable && (practiceOn(step) || step === 'frame') ? '<button type="button" class="btn btn-quiet" data-act="theory-close" data-focus="theory">Replier la théorie ↑</button>' : ''}
    </div>
  </section>`;
}

function briefBlock(step) {
  const brief = BRIEFS[step];
  if (!brief) return '';
  return `<section class="brief" aria-label="À faire">
    <p class="brief-title"><span class="welcome-icon">${WELCOME_ICONS.clock}</span>À faire <span class="brief-time">${esc(brief.duration)}</span></p>
    <ol>${brief.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
  </section>`;
}

/** Post-it en lecture seule (exemples). */
const staticNote = (text, hue, cls = '') => `<div class="note note--static ${cls}" style="--h:${hue}"><span class="note-text">${esc(text)}</span></div>`;

function exampleHead(title) {
  return `<div class="example-head"><p class="kicker">Exemple complet · ${esc(EXAMPLE_CASE.name)}</p><h3>${esc(title)}</h3><p class="hint">${esc(EXAMPLE_CASE.context)} Un autre sujet que le vôtre, exprès : regardez la forme, pas les réponses.</p></div>`;
}

function empathyExample() {
  const ex = EMPATHY_EXAMPLE;
  const lucie = { name: 'Lucie', hue: 20 };
  // Même présentation que la carte de l'exercice, en lecture seule.
  const zone = (z) => `<section class="ezone ezone--${z.id}" style="--h:${ZONE_HUES[z.id]}">
      <h2>${esc(z.label)}</h2><p class="ezone-q">${esc(z.question)}</p>
      <div class="note-list">${(ex.zones[z.id] ?? []).map((t) => staticNote(t, ZONE_HUES[z.id])).join('')}</div>
    </section>`;
  return `<div class="example">
    ${exampleHead('Une empathy map remplie')}
    <p class="hint">On range ce qu'on a entendu et observé, sans interpréter trop vite.</p>
    <div class="emap emap--example">
      ${zone(EMPATHY_ZONES[0])}
      <div class="emap-center">
        ${avatar(lucie, 'avatar--lg')}
        <p class="emap-name">Lucie, 34 ans</p>
        <p class="emap-role">Technicienne, déjeune à la cantine trois fois par semaine</p>
      </div>
      ${zone(EMPATHY_ZONES[1])}
      ${zone(EMPATHY_ZONES[2])}
      ${zone(EMPATHY_ZONES[3])}
      <div class="emap-bottom">${zone(EMPATHY_ZONES[4])}${zone(EMPATHY_ZONES[5])}</div>
    </div>
  </div>`;
}

function impactExample() {
  const ex = IMPACT_EXAMPLE;
  return `<div class="example">
    ${exampleHead('Une impact map, du pourquoi au quoi')}
    <div class="example-from">
      <p class="step-link-tag">On repart de l'empathy map de Lucie</p>
      <div class="example-from-grid">
        <div><strong>Ses douleurs</strong><ul>${EMPATHY_EXAMPLE.zones.pains.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><strong>Ses gains</strong><ul>${EMPATHY_EXAMPLE.zones.gains.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
      <p class="hint">Les impacts cherchent à soulager ces douleurs ou à apporter ces gains.</p>
    </div>
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
    <p class="star-explain">${ICONS.star} <span><strong>L'étoile, c'est le lien avec la suite.</strong> Les livrables étoilés sont ceux qu'on retient : le chemin le plus court vers l'objectif. Ce sont eux, et eux seuls, qu'on emporte à l'étape suivante pour construire le produit. Les autres restent des idées.</span></p>
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
    <p class="hint">Les grandes étapes forment la colonne vertébrale. Les stories, elles, viennent de ce qu'on a décidé de livrer (les livrables de l'impact map), rangées sous ces étapes ; les actions du récit servent à vérifier qu'aucune étape n'est oubliée.</p>
  </div>
  <div class="example">
    ${exampleHead('Puis la story map, du parcours aux versions')}
    <div class="example-from">
      <p class="step-link-tag">On repart des livrables étoilés de l'impact map de la cantine</p>
      <ul class="example-kept">${IMPACT_EXAMPLE.actors.flatMap((ac) => ac.impacts.flatMap((i) => i.deliverables.filter((d, k) => i.kept.includes(k)))).map((d) => `<li>${ICONS.star} ${esc(d)}</li>`).join('')}</ul>
      <p class="hint">On les place sous l'étape du parcours où ils aident Lucie, puis on les range dans des versions.</p>
    </div>
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
  const label = (id) => (stepRevealed(id) ? STEPS.find((s) => s.id === id).label : 'Étape suivante');
  return `<nav class="stepnav" aria-label="Étapes">
    ${prev ? `<button type="button" class="btn btn-quiet" data-go="${prev}">‹ ${esc(label(prev))}</button>` : '<span></span>'}
    ${next ? `<button type="button" class="btn btn-primary" data-go="${next}" data-focus="next">${state.step === 'welcome' ? 'Commencer' : esc(label(next))} ›</button>` : ''}
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
  else if (n.place.b === 'action') hue = 205;
  else if (n.place.b === 'tray' && n.kind) hue = KIND_HUES[n.kind];
  const kind = extract ? 'note--extract' : ['backbone', 'journey'].includes(n.place.b) ? 'note--backbone' : '';
  const meta = [];
  if (n.author) meta.push(`<span class="note-author">${ICONS.phone}${esc(n.author)}</span>`);
  if (fromDeliv) meta.push('<span class="note-from" title="Venu de l\'impact map">↳ impact map</span>');
  if (n.place.b === 'tray' && n.kind) meta.push(`<span class="note-kind">${esc(IMPACT_LEVELS.find((l) => l.id === n.kind).name.replace(/s$/, ''))}</span>`);
  if (opts.badge) meta.push(opts.badge);
  const del = canEdit() ? `<button type="button" class="note-x" data-del="${n.id}" data-nodrag title="${extract ? 'Remettre dans la pioche' : 'Supprimer'}" aria-label="${extract ? 'Remettre dans la pioche' : 'Supprimer'} : ${esc(n.text)}">×</button>` : '';
  return `<div class="note ${kind} ${opts.cls ?? ''}" style="--h:${hue}" data-drag="note:${n.id}" data-note="${n.id}" data-focus="note:${n.id}" role="button" tabindex="0"
      aria-label="${esc(n.text)}. Ouvrir pour modifier ou déplacer.">
    ${del}<span class="note-text">${esc(n.text)}</span>
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

/* ---------- Direction artistique : petits post-its illustrés, comme à l'accueil ---------- */

/** Un post-it dessiné (x, y : centre ; r : rotation ; h : teinte). */
function artNote(x, y, r, h, w = 34, ht = 30, star = false) {
  return `<g transform="translate(${x} ${y}) rotate(${r})" filter="url(#ashadow)">
    <rect class="wa-note" x="${-w / 2}" y="${-ht / 2}" width="${w}" height="${ht}" rx="3" style="--h:${h}"/>
    <path class="wa-line" d="M${-w / 2 + 7} -3 h${w - 16} M${-w / 2 + 7} 5 h${w - 22}"/>
    ${star ? `<path class="wa-star" d="M${w / 2 - 6} ${-ht / 2 - 2} l2 4 4.4.6-3.2 3 .8 4.4-4-2.1-4 2.1.8-4.4-3.2-3 4.4-.6z"/>` : ''}</g>`;
}
const artDefs = '<defs><filter id="ashadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".18"/></filter></defs>';

/** Illustration d'en-tête de chaque étape. */
function stepArt(step) {
  const svg = (label, body) => `<svg class="step-art" viewBox="0 0 300 170" role="img" aria-label="${esc(label)}">${artDefs}${body}</svg>`;
  if (step === 'frame') {
    return svg('Le double diamant et ses post-its', `<path class="wa-diamond" d="M10 85 L80 15 L150 85 L80 155 Z M150 85 L220 15 L290 85 L220 155 Z"/><path class="wa-axis" d="M10 85 H290"/>
      ${[[50, 60, -6, 205], [96, 96, 5, 330], [64, 116, 4, 150], [190, 56, -5, 44], [236, 100, 6, 265], [200, 118, -3, 6]].map((n) => artNote(...n)).join('')}`);
  }
  if (step === 'empathy') {
    return svg('Une carte d\'empathie : quatre zones autour de la persona', `<rect class="wa-panel" x="20" y="10" width="260" height="150" rx="12"/>
      <path class="wa-axis" d="M150 10 V160 M20 85 H280"/>
      <circle class="wa-head" cx="150" cy="85" r="22"/><circle class="wa-face" cx="150" cy="80" r="7"/><path class="wa-face" d="M138 97 q12 -12 24 0"/>
      ${[[62, 42, -5, 205], [104, 50, 4, 205], [196, 42, 6, 330], [238, 50, -4, 330], [62, 122, 3, 150], [106, 128, -5, 150], [198, 122, -4, 44], [240, 128, 5, 44]].map((n) => artNote(...n)).join('')}`);
  }
  if (step === 'impact') {
    return svg('Une impact map : objectif, acteurs, impacts, livrables', `<path class="wa-branch" d="M48 85 C80 85 80 45 108 45 M48 85 C80 85 80 125 108 125 M128 45 C160 45 160 30 188 30 M128 45 C160 45 160 62 188 62 M128 125 C160 125 160 112 188 112 M128 125 C160 125 160 142 188 142 M208 30 H246 M208 62 H246 M208 112 H246 M208 142 H246"/>
      ${artNote(34, 85, 0, 6, 40, 36)}${artNote(118, 45, -3, 205)}${artNote(118, 125, 3, 205)}${artNote(198, 30, 2, 150, 30, 24)}${artNote(198, 62, -2, 150, 30, 24)}${artNote(198, 112, 3, 150, 30, 24)}${artNote(198, 142, -3, 150, 30, 24)}
      ${artNote(262, 30, -4, 44, 30, 24, true)}${artNote(262, 62, 3, 44, 30, 24)}${artNote(262, 112, 4, 44, 30, 24, true)}${artNote(262, 142, -2, 44, 30, 24)}`);
  }
  if (step === 'story') {
    return svg('Une story map : le parcours en haut, les versions dessous', `${[0, 1, 2, 3].map((i) => artNote(55 + i * 64, 28, i % 2 ? 2 : -2, 230, 50, 28)).join('')}
      ${[[55, 72, 3, 44], [119, 70, -3, 44], [183, 74, 2, 44], [247, 71, -2, 44], [55, 128, -3, 150], [183, 130, 4, 150], [247, 126, -2, 330]].map((n) => artNote(...n)).join('')}
      <path class="wa-version" d="M15 99 H290"/>`);
  }
  return svg('Une ampoule et des post-its', `<circle class="wa-head" cx="150" cy="70" r="42"/><path class="wa-face" d="M136 112 h28 M138 122 h24 M143 132 h14"/>
    <path class="wa-face" d="M150 50 v22 M140 62 l10 10 10-10"/>
    ${artNote(60, 50, -8, 205)}${artNote(244, 46, 7, 330)}${artNote(70, 120, 5, 150)}${artNote(234, 118, -6, 44)}`);
}

/** Illustration de l'accueil : des post-its qui s'organisent en double diamant. */
function welcomeArt() {
  const notes = [
    [70, 70, -8, 205], [112, 118, 6, 330], [62, 150, 4, 150], [150, 74, -4, 44],
    [214, 98, 7, 265], [196, 150, -6, 6], [300, 66, 5, 44], [344, 120, -7, 150],
    [292, 160, 3, 205], [404, 84, -5, 330], [440, 140, 6, 265], [380, 172, -3, 6],
  ];
  return `<svg class="welcome-art" viewBox="0 0 520 250" role="img" aria-label="Des post-its colorés qui s'organisent en double diamant">
    <defs><filter id="wshadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".18"/></filter></defs>
    <path class="wa-diamond" d="M20 125 L135 20 L250 125 L135 230 Z M250 125 L380 20 L500 125 L380 230 Z"/>
    <path class="wa-axis" d="M20 125 H500"/>
    ${notes.map(([x, y, r, h], i) => `<g transform="translate(${x} ${y}) rotate(${r})" filter="url(#wshadow)">
      <rect class="wa-note" x="-22" y="-20" width="44" height="40" rx="4" style="--h:${h}"/>
      <path class="wa-line" d="M-13 -6 h${18 + (i % 3) * 4} M-13 3 h${12 + (i % 4) * 4}"/></g>`).join('')}
    <text class="wa-label" x="78" y="244">Découvrir</text><text class="wa-label" x="188" y="244">Définir</text>
    <text class="wa-label" x="310" y="244">Développer</text><text class="wa-label" x="430" y="244">Livrer</text>
  </svg>`;
}

const WELCOME_ICONS = {
  goal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>',
  format: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><path d="M16 14v5M13.5 16.5h5"/></svg>',
  rules: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11l4-4 3 3 4-4"/><path d="M3 20h18"/><path d="M5 16l3-3 3 3 5-5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

/** Accueil : le but, le format, les règles, et rejoindre. Pas de théorie ici. */
function viewWelcome() {
  return `
  <header class="welcome-hero">
    <div class="welcome-hero-text">
      <p class="kicker">Bienvenue</p>
      <h1 tabindex="-1">Atelier Produit</h1>
      <p class="lede">Découvrir quelques techniques produit en les pratiquant, en équipe, sur un même cas fil rouge.</p>
    </div>
    ${welcomeArt()}
  </header>

  ${joinCard()}

  <section class="welcome-grid">
    ${WELCOME.blocks.map((blk) => `<article class="welcome-card welcome-card--${blk.id}">
      <span class="welcome-icon">${WELCOME_ICONS[blk.id] ?? ''}</span>
      <h2>${esc(blk.title)}</h2>
      ${blk.text ? `<p>${esc(blk.text)}</p>` : ''}
      ${blk.items ? `<ul>${blk.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </article>`).join('')}
  </section>
  ${HOST ? '' : '<p class="hint">L\'animateur fait avancer l\'atelier : cette page suit l\'écran commun.</p>'}
  ${stepNav()}`;
}

/* ---------- Bravo ! La conclusion de l'exercice, avant le débrief ---------- */

/** Ce que chaque groupe a produit (les tableaux qu'on peut lire d'ici). */
function bravoGroups() {
  const sum = (notes, personaId, label) => {
    const goals = notes.filter((n) => n.place.b === 'goal').map((n) => n.text);
    const kept = notes.filter((n) => n.place.b === 'deliverable' && n.keep).map((n) => n.text);
    const mvp = notes.filter((n) => n.place.b === 'story' && n.place.lane === 'mvp').map((n) => n.text);
    const cols = notes.filter((n) => n.place.b === 'backbone').length;
    return { persona: personaById(personaId), label, goals, kept, mvp, cols, count: notes.length };
  };
  if (!shared.on) return [sum(state.notes, state.persona, '')];
  const ids = HOST ? groupIdsFor(shared.groups) : [shared.myGroup].filter(Boolean);
  return ids.map((g) => sum(shared.boards[g]?.notes ?? [], groupPersona(g), shared.groups === 2 ? groupName(g) : ''))
    .filter((x) => x.count);
}

function confetti() {
  const colors = [205, 330, 150, 44, 265, 6];
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 36 }, (_, i) => {
    const left = (i * 37) % 100;
    const delay = ((i * 0.37) % 3).toFixed(2);
    const dur = (3.2 + ((i * 0.53) % 2.4)).toFixed(2);
    return `<i style="--h:${colors[i % colors.length]};left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s;--r:${(i * 47) % 360}deg"></i>`;
  }).join('')}</div>`;
}

function viewBravo() {
  const groups = bravoGroups();
  const total = groups.reduce((n, g) => n + g.count, 0);
  const stats = [
    [total, `post-it${total > 1 ? 's' : ''}`],
    [groups.reduce((n, g) => n + g.cols, 0), 'étapes de parcours'],
    [groups.reduce((n, g) => n + g.kept.length, 0), 'livrables retenus'],
    [groups.reduce((n, g) => n + g.mvp.length, 0), 'stories en première version'],
  ].filter(([n]) => n > 0);
  return `
  <header class="bravo-hero">
    ${confetti()}
    <svg class="bravo-art" viewBox="0 0 200 160" aria-hidden="true">${artDefs}
      <path class="bravo-cup" d="M60 30 h80 v26 a40 40 0 0 1 -80 0z"/><path class="bravo-cup-ear" d="M60 40 h-16 a16 16 0 0 0 16 24 M140 40 h16 a16 16 0 0 1 -16 24"/>
      <rect class="bravo-cup" x="92" y="94" width="16" height="22"/><rect class="bravo-cup" x="70" y="116" width="60" height="12" rx="3"/>
      <path class="wa-star" d="M100 38 l5.5 11 12 1.7-8.7 8.5 2 12-10.8-5.7-10.8 5.7 2-12-8.7-8.5 12-1.7z"/>
      ${artNote(30, 120, -10, 205, 30, 26)}${artNote(170, 118, 9, 330, 30, 26)}${artNote(26, 40, 8, 150, 26, 22)}${artNote(174, 36, -8, 44, 26, 22)}
    </svg>
    <p class="kicker">Mission accomplie</p>
    <h1 tabindex="-1">${esc(BRAVO.title)}</h1>
    ${BRAVO.story.map((x) => `<p class="lede">${esc(x)}</p>`).join('')}
  </header>

  ${stats.length ? `<section class="bravo-stats">${stats.map(([n, l]) => `<div><strong>${n}</strong><span>${esc(l)}</span></div>`).join('')}</section>` : ''}

  <section class="bravo-path">
    ${BRAVO.path.map((x, i) => `<article class="welcome-card bravo-step bravo-step--${i}">
      <span class="bravo-n">${i + 1}</span>
      <h2>${esc(x.label)}</h2><p>${esc(x.text)}</p>
    </article>`).join('')}
  </section>

  ${groups.length ? `<section class="bravo-work">
    <h2>Ce que vous avez construit</h2>
    <div class="bravo-groups">${groups.map((g) => `<article class="bravo-group" style="--h:${g.persona?.hue ?? 205}">
      <header>${g.persona ? avatar(g.persona) : ''}<div><strong>${g.label ? `${esc(g.label)} · ` : ''}${esc(g.persona?.name ?? '')}</strong><span>${esc(g.persona?.profile ?? '')}</span></div></header>
      ${g.goals.length ? `<p class="bravo-label">L'objectif</p><p class="bravo-goal">${esc(g.goals[0])}</p>` : ''}
      ${g.kept.length ? `<p class="bravo-label">Les livrables retenus</p><ul class="example-kept">${g.kept.map((k) => `<li>${ICONS.star} ${esc(k)}</li>`).join('')}</ul>` : ''}
      ${g.mvp.length ? `<p class="bravo-label">La première version</p><ul class="bravo-mvp">${g.mvp.slice(0, 6).map((k) => `<li>${esc(k)}</li>`).join('')}${g.mvp.length > 6 ? `<li>et ${g.mvp.length - 6} de plus</li>` : ''}</ul>` : ''}
    </article>`).join('')}</div>
  </section>` : ''}
  ${HOST ? '' : '<p class="hint">L\'animateur fait avancer l\'atelier : cette page suit l\'écran commun.</p>'}
  ${stepNav()}`;
}

/** Le cadre : la théorie seulement, le Design Thinking et le double diamant (replié avec elle). */
function viewFrame() {
  const chips = { all: ['designThinking'] };
  for (const tool of TOOL_IDS) {
    if (!state.visited.includes(tool)) continue;
    const phase = TOOL_PHASES[tool][0];
    (chips[phase] ??= []).push(tool);
  }
  const diamond = `<section class="frame-diamond">
    <div class="section-head"><h3>Le double diamant</h3></div>
    <p class="diamond-message">${esc(DIAMOND_MESSAGE)}</p>
    <p class="hint">Au fil de l'atelier, chaque outil vient prendre sa place sur le diamant.</p>
    ${diamondBoard({ chips })}
  </section>`;
  return `
  <header class="step-head">
    <div class="intro">
      <p class="kicker">Le cadre</p>
      <h1 tabindex="-1">Le Design Thinking et le double diamant</h1>
      <p class="lede">Le Design Thinking donne la démarche ; les outils qu'on va pratiquer s'y rangent.</p>
    </div>
    <div class="step-head-art">${stepArt('frame')}</div>
  </header>

  ${theoryBlock('frame', { extra: diamond })}
  ${stepNav()}`;
}

/** Le cas fil rouge : présenté au début de la pratique de l'empathy map, repliable ensuite. */
const caseOpen = () => ui.caseOpen[state.step] ?? true;
function caseBlock() {
  if (!caseOpen()) {
    return `<section class="case-mini"><button type="button" class="theory-toggle" data-act="case-toggle" data-focus="case" aria-expanded="false">
      ${ICONS.users}<span><strong>Le cas : ${esc(CASE.name)}</strong> ${esc(CASE.tagline)} · ${PERSONAS.map((p) => esc(p.name)).join(' et ')}</span><span class="theory-open">Revoir</span></button></section>`;
  }
  return `<section class="case-block" aria-labelledby="case-title">
    <div class="frame-grid">
      <article class="case">
        <p class="kicker">Le cas fil rouge</p>
        <h2 id="case-title">${esc(CASE.name)} <span>${esc(CASE.tagline)}</span></h2>
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
    </div>
    <div class="case-foot"><button type="button" class="btn btn-quiet" data-act="case-toggle" data-focus="case">Replier le cas ↑</button></div>
  </section>`;
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
  if (!practiceOn('empathy')) return stepHeader('empathy') + practiceGate('empathy');
  if (!exerciseOn('empathy')) {
    return `${stepHeader('empathy')}
    <section class="practice-gate">
      ${HOST || !shared.on
        ? `<p>Lisez le cas ensemble, puis lancez l'exercice${phones?.live ? ' : la carte apparaît chez tous et le minuteur démarre' : ''}.</p>
          <button type="button" class="btn btn-primary" data-act="exercise-start" data-focus="exercise-start">Lancer l'exercice ↓</button>`
        : '<p>Prenez le temps de lire le cas : l\'animateur lance l\'exercice juste après.</p>'}
    </section>
    ${HOST ? stepNav() : ''}`;
  }
  const persona = personaById(state.persona);
  // En séance, la proposition ne se dévoile qu'à la restitution : d'abord le choix du groupe, ensuite la discussion.
  const comparing = state.compare[persona.id] === true && (!shared.on || shared.restitution);
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
    ${!shared.on || (HOST && shared.group !== 'sim' && shared.restitution) ? `<button type="button" class="btn ${comparing ? 'btn-quiet' : 'btn-primary'}" data-act="compare" data-focus="compare" ${cmp.placed || shared.on ? '' : 'disabled'}>
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
  if (!practiceOn('impact')) return stepHeader('impact') + practiceGate('impact');
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
      <p class="hint">${ICONS.star} ${shared.on ? 'Les livrables retenus se choisissent tous ensemble, à la restitution : l\'animateur pose les étoiles, au moins 2 par persona. Ils partent à l\'étape suivante.' : 'Cochez l\'étoile des livrables que vous retenez : ils vous attendront à l\'étape suivante. Plusieurs objectifs ? Ajoutez-les avec « Autre objectif ».'}</p>
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

/* ---------- Story map, avant le parcours validé : raconter, puis regrouper ---------- */

const pronoun = (p) => (p.id === 'karim' ? 'il' : 'elle');

/** Animateur : débloquer un groupe avec les étapes types de sa persona, à tout moment du parcours. */
function journeyRescue() {
  if (!HOST || shared.group === 'sim') return '';
  const name = personaById(state.persona)?.name ?? '';
  return `<p class="jrescue">Animateur : groupe bloqué ? <button type="button" class="link-btn" data-act="journey-example" data-focus="journey-example">Proposer les étapes types de ${esc(name)}</button></p>`;
}

function journeyStages(active) {
  const items = [['recit', '1. On raconte'], ['regroup', '2. On regroupe en étapes'], ['link', '3. On relie aux livrables'], ['map', '4. On découpe en versions']];
  const locked = shared.on && shared.restitution;
  return `<ol class="jstages" aria-label="Les trois temps de la story map">${items.map(([id, label]) => `<li>
    <button type="button" class="${id === active ? 'is-on' : ''}" data-stage="${id}" ${id === active ? 'aria-current="step"' : ''} ${locked && id !== active ? 'disabled' : ''}>${esc(label)}</button></li>`).join('')}</ol>
    ${locked ? '<p class="hint">Restitution : tout le monde regarde la story map.</p>' : ''}`;
}

function personaTip(persona) {
  return `<div class="jtip"><strong>${esc(persona.name)}, ${persona.age} ans · ${esc(persona.profile.toLowerCase())}</strong>
    <ul>${persona.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
}

/** Temps 1 : chacun ajoute des actions courtes, comme elles viennent. */
function viewRecit() {
  const persona = personaById(state.persona) ?? PERSONAS[0];
  const all = allActions(state);
  const acts = all.filter((n) => !n.place.parent);
  const grouped = all.length - acts.length;
  const stepName = (n) => getNote(state, n.place.parent)?.text ?? '';
  // Les actions déjà regroupées restent visibles dans le récit (elles se déplacent au regroupement).
  const shown = all.map((n) => (n.place.parent
    ? `<div class="note note--action is-grouped" style="--h:205" title="Regroupée sous « ${esc(stepName(n))} » : elle se déplace au regroupement"><span class="note-text">${esc(n.text)}</span><span class="note-meta">→ ${esc(stepName(n))}</span></div>`
    : noteHtml(n, { cls: 'note--action' })));
  const authors = [...new Set(allActions(state).map((n) => n.author).filter(Boolean))];
  return `
  ${stepHeader('story')}
  ${journeyStages('recit')}
  ${journeyRescue()}
  <section class="jhead">
    <p class="kicker">Temps 1 · On raconte</p>
    <h2>Racontez la semaine de ${esc(persona.name)} avec l'appli</h2>
    <p>Chacun ajoute des actions, en même temps, comme elles viennent : <strong>${esc(persona.name)} + un verbe</strong>, ce qu'${pronoun(persona)} fait, du moment où ${pronoun(persona)} découvre l'appli jusqu'après le trajet. On ne cherche pas encore les grandes étapes.</p>
  </section>
  <div class="jtips">
    <div class="jtip"><strong>Pour raconter</strong><ul>${JOURNEY_QUESTIONS.map((q) => `<li>${esc(q.replaceAll('{name}', persona.name))}</li>`).join('')}</ul></div>
    <div class="jtip"><strong>Une action</strong><ul class="jexamples">
      ${(ACTION_EXAMPLES.good[persona.id] ?? []).map((x) => `<li class="jr-good">${ICONS.check} ${esc(persona.name)} ${esc(x)}</li>`).join('')}
      ${ACTION_EXAMPLES.bad.map((x) => `<li class="jr-bad">✕ ${esc(x)}</li>`).join('')}</ul></div>
    ${personaTip(persona)}
  </div>
  <section class="recit" aria-labelledby="recit-title">
    <div class="recit-head"><h3 id="recit-title">Le récit de ${esc(persona.name)}</h3>
      <span>${all.length} action${all.length > 1 ? 's' : ''}${authors.length ? ` · ${esc(authors.join(', '))}` : ''}${grouped ? ` · ${grouped} déjà regroupée${grouped > 1 ? 's' : ''}` : ''}</span></div>
    <div class="recit-flow" data-drop="action" data-axis="wrap">
      ${shown.join('<span class="recit-arrow" aria-hidden="true">→</span>')}
      ${all.length ? '' : '<p class="hint">Les actions s\'afficheront ici, dans l\'ordre du récit.</p>'}
    </div>
    ${canEdit() ? `<form class="composer" id="action-form" autocomplete="off">
      <label class="composer-who" for="action-input">${esc(persona.name)}…</label>
      <input class="composer-input" id="action-input" name="action" maxlength="${MAX_TEXT}" data-focus="action-input" placeholder="${esc(ACTION_EXAMPLES.good[persona.id]?.[0] ?? '')}" value="${esc(ui.actionDraft ?? '')}">
      <button type="submit" class="btn btn-primary btn-small">Ajouter ↵</button>
    </form>
    <p class="hint">Entrée pour ajouter, dans l'ordre du récit. Glissez une action pour la remettre au bon endroit, cliquez dessus pour la corriger.</p>` : ''}
  </section>
  <section class="checkpoint">
    <div><h2>On a fait le tour ?</h2>
      <p>Relisez le récit à voix haute, du début à la fin : manque-t-il un moment ? Un imprévu ? Et après le trajet ?</p></div>
    <button type="button" class="btn btn-primary" data-act="journey-next" data-focus="journey-next" ${acts.length + grouped >= 2 ? '' : 'disabled'}>Passer au regroupement ›</button>
  </section>
  ${stepNav()}`;
}

/** Temps 2 : regrouper les actions sous des grandes étapes, puis valider le parcours. */
function viewRegroup() {
  const persona = personaById(state.persona) ?? PERSONAS[0];
  const steps = journeyNotes(state);
  const loose = looseActions(state);
  const h = journeyHints(steps.map((n) => n.text));
  const tips = [];
  if (h.tooFew) tips.push(`${steps.length ? `${steps.length} étape${steps.length > 1 ? 's' : ''} pour l'instant` : 'Pas encore d\'étape'} : visez ${JOURNEY_MIN} à ${JOURNEY_MAX} grandes étapes.`);
  else if (h.tooMany) tips.push(`${steps.length} étapes, c'est beaucoup : certaines sont peut-être des détails à regrouper.`);
  else tips.push(`${steps.length} étapes : dans la cible (${JOURNEY_MIN} à ${JOURNEY_MAX}).`);
  if (loose.length) tips.push(`${loose.length} action${loose.length > 1 ? 's ne sont' : ' n\'est'} sous aucune étape : il manque peut-être une étape ?`);
  if (h.notVerb.length) tips.push(`Ne commence${h.notVerb.length > 1 ? 'nt' : ''} pas par un verbe : <strong>${esc(h.notVerb.join(' · '))}</strong>.`);
  if (h.system.length) tips.push(`Décri${h.system.length > 1 ? 'vent' : 't'} l'appli plutôt que ${esc(persona.name)} : <strong>${esc(h.system.join(' · '))}</strong>.`);
  if (steps.length && !h.notVerb.length && !h.system.length) tips.push('Les étapes commencent toutes par un verbe, du point de vue de la persona.');
  return `
  ${stepHeader('story')}
  ${journeyStages('regroup')}
  ${journeyRescue()}
  <section class="jhead">
    <p class="kicker">Temps 2 · On regroupe</p>
    <h2>Regroupez les actions en grandes étapes</h2>
    <p>Créez une étape, puis glissez dessous les actions qui vont ensemble. Visez ${JOURNEY_MIN} à ${JOURNEY_MAX} étapes, dans l'ordre où ${esc(persona.name)} les vit.</p>
  </section>
  <div class="jtips">
    <div class="jtip jtip--wide"><strong>Bien formuler une étape</strong><ul>${JOURNEY_RULES.map((r) => `<li><span>${esc(r.title)}</span>
      <span class="jr-good">${ICONS.check} ${esc(r.good)}</span>${r.bad ? `<span class="jr-bad">✕ ${esc(r.bad)}</span>` : ''}</li>`).join('')}</ul></div>
    ${personaTip(persona)}
  </div>
  <section class="groupage" aria-label="Regroupement">
    <div class="canvas-scroll">
      <div class="jcols" data-drop="backbone" data-axis="x">
        ${steps.map((st) => `<div class="jcol">${noteHtml(st)}
          <div class="jcol-acts" data-drop="${encodePlace({ b: 'action', parent: st.id })}">${actionsOf(state, st.id).map((n) => noteHtml(n, { cls: 'note--action' })).join('')}</div>
        </div>`).join('')}
        <div class="jcol jcol--add">${addButton({ b: 'backbone' }, 'Étape')}</div>
      </div>
    </div>
    <div class="loose">
      <p><strong>Pas encore regroupées (${loose.length})</strong>${loose.length ? ' · glissez-les sous une étape, ou créez l\'étape qui manque' : ' · tout est rangé'}</p>
      <div class="recit-flow" data-drop="action" data-axis="wrap">${loose.map((n) => noteHtml(n, { cls: 'note--action' })).join('')}</div>
    </div>
  </section>
  <section class="checkpoint">
    <div>
      <h2>Prêts à relier les livrables ?</h2>
      <ul class="journey-tips">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>
      <p class="hint">Vos étapes forment la première ligne de la story map ; les actions restent dessous, pour mémoire. On peut revenir ici à tout moment.
        <button type="button" class="link-btn" data-act="journey-back" data-focus="journey-back">‹ Revenir au récit</button></p>
    </div>
    <button type="button" class="btn btn-primary" data-act="journey-validate" data-focus="journey-validate">Relier aux livrables ›</button>
  </section>
  ${stepNav()}`;
}

function viewJourney() {
  return storyStage() === 'regroup' ? viewRegroup() : viewRecit();
}

/** Les livrables retenus à l'impact mapping, à relier au parcours (temps 3). */
function keptSection(kept, toPlace) {
  return `<section class="kept" data-drop="kept">
      <h2>Vos livrables retenus <span class="count">${toPlace.length}</span></h2>
      ${toPlace.length
        ? `<p class="hint">Ce que vous avez décidé de livrer à l'impact mapping. Glissez chacun sous l'étape où il aide ${esc(personaById(state.persona)?.name ?? 'la persona')}, ou cliquez dessus pour choisir. Un livrable placé quitte cette liste ; glissez-le ici pour l'y remettre.</p>
           <div class="kept-list">${toPlace.map((d) => `<button type="button" class="kchip" data-drag="deliv:${d.id}" data-deliv="${d.id}" data-focus="deliv:${d.id}">${esc(d.text)}</button>`).join('')}</div>`
        : kept.length ? '<p class="hint">Tous vos livrables retenus sont reliés au parcours. Glissez-en un ici pour le retirer.</p>'
        : HOST ? `<p class="hint">Aucun livrable retenu : cochez l'étoile des livrables dans <button type="button" class="link-btn" data-go="impact">l'impact map</button>.</p>`
          : '<p class="hint">Aucun livrable retenu pour l\'instant : ils sont choisis tous ensemble, à la fin de l\'impact mapping.</p>'}
    </section>`;
}

/** Temps 3 : relier les livrables retenus aux étapes du parcours. */
function viewLink() {
  const persona = personaById(state.persona) ?? PERSONAS[0];
  const cols = notesIn(state, { b: 'backbone' });
  const kept = keptForStory();
  const toPlace = kept.filter((d) => !d.imported);
  const noDeliv = stepsWithoutDeliverable(state);
  return `
  ${stepHeader('story')}
  ${journeyStages('link')}
  <section class="jhead">
    <p class="kicker">Temps 3 · On relie aux livrables</p>
    <h2>À quel moment du parcours vos livrables aident-ils ${esc(persona.name)} ?</h2>
    <p>Les actions disent ce que vit ${esc(persona.name)} ; les livrables, ce qu'on construit pour l'aider. Placez chaque livrable sous l'étape où il sert. Si une étape n'a rien, ajoutez la story qui manque.</p>
  </section>
  <div class="story-sources">
    ${keptSection(kept, toPlace)}
    ${trayHtml('story', 'À placer', 'Glissez ces post-its sous une étape du parcours.')}
  </div>
  ${cols.length ? `<section class="groupage" aria-label="Livrables par étape">
    <div class="canvas-scroll">
      <div class="lcols">
        ${cols.map((c) => {
          const place = { b: 'story', col: c.id, lane: SORT_LANE };
          return `<div class="lcol">
            <div class="note note--backbone note--static" style="--h:48"><span class="note-text">${esc(c.text)}</span></div>
            <div class="lcol-acts">${actionsOf(state, c.id).map((x) => `<span>${esc(x.text)}</span>`).join('') || '<span class="hint">Pas d\'action rangée ici.</span>'}</div>
            <div class="lcol-drop" data-drop="${encodePlace(place)}">${notesIn(state, place).map((n) => noteHtml(n)).join('')}${addButton(place, 'Story')}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </section>` : `<p class="hint">Pas encore d'étapes : <button type="button" class="link-btn" data-stage="regroup">regroupez d'abord les actions</button>.</p>`}
  <section class="checkpoint">
    <div><h2>Chaque étape est-elle couverte ?</h2>
      ${noDeliv.length && cols.length
        ? `<p>Rien sous <strong>${esc(noDeliv.map((c) => c.text).join(', '))}</strong> venant de l'impact map : faut-il y ajouter une story ? Ou est-ce un oubli de l'impact map ? C'est l'aller-retour du double diamant.</p>`
        : cols.length ? '<p>Chaque étape a au moins un livrable. Reste à découper en versions.</p>' : ''}
      ${toPlace.length ? `<p class="hint">${toPlace.length} livrable${toPlace.length > 1 ? 's' : ''} pas encore relié${toPlace.length > 1 ? 's' : ''} au parcours.</p>` : ''}
    </div>
    <button type="button" class="btn btn-primary" data-act="journey-cut" data-focus="journey-cut">Découper en versions ›</button>
  </section>
  ${stepNav()}`;
}

function viewStory() {
  if (!practiceOn('story')) return stepHeader('story') + practiceGate('story');
  if (storyStage() === 'link') return viewLink();
  if (storyStage() !== 'map') return viewJourney();
  const cols = notesIn(state, { b: 'backbone' });
  const kept = keptForStory();
  const gaps = mvpGaps(state);
  const toPlace = kept.filter((d) => !d.imported);
  const sorting = cols.some((c) => notesIn(state, { b: 'story', col: c.id, lane: SORT_LANE }).length);
  const cell = (c, lane) => {
    const place = { b: 'story', col: c.id, lane: lane.id };
    return `<div class="scell" data-drop="${encodePlace(place)}">${notesIn(state, place).map((n) => noteHtml(n)).join('')}${addButton(place, 'Story')}</div>`;
  };
  return `
  ${stepHeader('story')}
  ${shared.group === 'sim' ? simNotice() : `${journeyStages('map')}
  <section class="jhead">
    <p class="kicker">Temps 4 · On découpe en versions</p>
    <h2>Rangez chaque story dans une version</h2>
    <p>La première version doit traverser tout le parcours, même de façon rudimentaire. Ce qui peut attendre descend sous la ligne de version.</p>
    ${toPlace.length ? `<p class="hint">${toPlace.length} livrable${toPlace.length > 1 ? 's' : ''} retenu${toPlace.length > 1 ? 's' : ''} pas encore relié${toPlace.length > 1 ? 's' : ''} au parcours : <button type="button" class="link-btn" data-stage="link">revenir au temps 3</button>.</p>` : ''}
  </section>`}

  <div class="canvas">
    <div class="canvas-scroll">
      <div class="smap" style="--cols:${cols.length}">
        <div class="srow srow--backbone">
          <div class="slabel"><strong>Le parcours</strong><span>De gauche à droite, les grandes étapes de ${esc(personaById(state.persona)?.name ?? 'l\'utilisateur')}.</span>
</div>
          <div class="backbone" data-drop="backbone" data-axis="x">
            ${cols.map((c) => `<div class="bcell">${noteHtml(c)}</div>`).join('')}
            <div class="bcell bcell--add">${addButton({ b: 'backbone' }, 'Étape')}
</div>
          </div>
        </div>
        ${cols.length && (sorting || shared.group !== 'sim') ? `<div class="srow srow--lane srow--sort">
          <div class="slabel"><strong>À découper</strong><span>Reliés au parcours au temps 3 : glissez-les dans une version.</span></div>
          <div class="lane">${cols.map((c) => cell(c, { id: SORT_LANE })).join('')}</div>
        </div>` : ''}
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
      ${sorting && shared.group !== 'sim' ? '<p>Des stories attendent encore dans « À découper » : rangez-les dans une version.</p>' : ''}
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

/** ROTI de fin d'atelier : lien à copier et QR code (participants et animateur). */
function rotiBlock(code) {
  const link = rotiJoinUrl(code);
  return `<div class="roti-share">
    <div class="join-qr">${qrSvg(link, 'QR code pour donner son avis (ROTI)')}</div>
    <div class="roti-text">
      <p class="share-link"><a class="btn btn-primary" href="${esc(link)}" target="_blank" rel="noopener">Donner mon avis ↗</a>
        <button type="button" class="btn btn-quiet btn-small" data-copy-roti="${esc(code)}">${ICONS.link} Copier le lien</button></p>
      <p class="share-code"><a class="share-url" href="${esc(link)}" target="_blank" rel="noopener">${esc(link.replace(/^https?:\/\//, ''))}</a></p>
      <p class="share-code">Code du ROTI : <span class="room-code"><strong>${esc(code)}</strong></span></p>
    </div>
  </div>`;
}

document.addEventListener('click', (e) => {
  const roti = e.target.closest('[data-copy-roti]');
  if (roti) copyText(rotiJoinUrl(roti.dataset.copyRoti)).then((ok) => toast(ok ? 'Lien du ROTI copié.' : 'Copie impossible : sélectionnez le lien à la main.'));
});

function rotiPanel() {
  const code = phones?.roti;
  return `<section class="dsection roti-panel">
    <div class="dsection-head"><span class="dsection-n">★</span><div><h2>Le ROTI de l'atelier</h2>
      <p class="hint">Le temps passé valait-il le coup ? Chacun note l'atelier de 1 à 5, sans prénom.</p></div></div>
    ${code ? `${rotiBlock(code)}
      <p class="hint">Les participants voient ce lien et ce QR code sur leur écran.
        <a class="link-btn" href="${esc(rotiHostUrl(code))}" target="_blank" rel="noopener">Ouvrir la vue animateur du ROTI ↗</a> (votes en direct, puis « Révéler »).</p>`
      : `<button type="button" class="btn btn-primary" data-act="roti-create" data-focus="roti-create">Créer le ROTI et l'envoyer aux participants</button>
      <p class="hint">Une salle est créée dans l'outil ROTI ; ce navigateur en devient l'animateur et la retrouve dans « Mes ROTI ».</p>`}
  </section>`;
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
      <p class="hint">Chacun rejoint avec son prénom, répond au quiz sur son ordinateur ou son téléphone, puis vous révélez les réponses : chacun reçoit sa correction, et l'écran affiche les bonnes réponses.</p>
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
          <p class="kicker">${open ? `Quiz en cours${phones.quizEndsAt ? ` · <span class="pq-clock" id="host-qclock">${formatClock(Math.max(0, phones.quizEndsAt - phones.now))}</span>` : ''}` : 'Quiz prêt'}</p>
          <h2>${open ? 'Chacun répond de son côté' : 'Lancez le quiz quand tout le monde est connecté'}</h2>
          <p class="hint">${QUIZ_MAX} questions en 3 minutes : ranger les quatre notions sur le double diamant (Design Thinking compris), puis huit situations. Un point par bonne réponse, un demi-point pour une réponse défendable. À la fin du temps, les copies partent telles quelles et les réponses sont révélées.</p>
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
    ${stats.hardest && hardest >= 0 && stats.hardest.rate < 1 ? `<p class="qhardest"><strong>À discuter :</strong> la situation ${hardest + 1} n'a eu que ${pct(stats.hardest.rate * stats.count)} % de réponses les plus adaptées.</p>` : ''}
    <div class="qactions">
      <button type="button" class="btn btn-quiet" data-act="quiz-replay" data-focus="quiz-replay">Rejouer (effacer les copies)</button>
      <button type="button" class="btn btn-quiet" data-act="quiz-stop" data-focus="quiz-stop">Fermer le quiz</button>
    </div>
  </section>

  ${rotiPanel()}

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

const views = { welcome: viewWelcome, bravo: viewBravo, frame: viewFrame, empathy: viewEmpathy, impact: viewImpact, story: viewStory, debrief: viewDebrief };

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
  if (!cols.length) { toast('Regroupez d\'abord les actions en étapes (temps 2).'); return; }
  openDialog(`<form method="dialog" class="dialog-form" data-form="place-kept">
    <h2 id="editor-title">Où placer ce livrable ?</h2>
    <p class="extract-quote extract-quote--plain">${esc(k.text)}</p>
    <label class="field-wrap"><span class="field-label">Étape du parcours</span>
      <select class="field" name="col">${cols.map((c) => `<option value="${c.id}">${esc(c.text)}</option>`).join('')}</select></label>
    <label class="field-wrap"><span class="field-label">Version</span>
      <select class="field" name="lane">${[{ id: SORT_LANE, label: 'À découper (on choisira la version au temps 4)' }, ...STORY_LANES].map((l) => `<option value="${l.id}">${esc(l.label)}</option>`).join('')}</select></label>
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
  if (!editing) { editor.close(); return; }
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
  // L'évènement « close » arrive après coup : si une nouvelle fenêtre s'est déjà ouverte, on la laisse.
  if (editor.open) return;
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

const EDIT_TARGETS = '[data-add], [data-note], [data-extract], [data-keep], [data-deliv], [data-persona], [data-act="compare"], [data-act="journey-example"]';

/**
 * Suppression en un clic (croix du post-it). Un post-it simple part tout de suite, avec « Annuler » ;
 * une carte qui en porte d'autres demande d'abord une confirmation. Un extrait retourne dans la pioche.
 */
/** Le minuteur de l'étape démarre la première fois (sauf s'il tourne déjà). */
function startStepTimer(step, first) {
  const t = phones.timer;
  if (first && TIMER_STEPS.includes(step) && !(t && t.step === step)) phones.setTimer(startTimer(step, phones.now)).catch(() => {});
}

function deleteNote(id) {
  const n = getNote(state, id);
  if (!n || !canEdit()) return;
  if (n.from?.startsWith('extract:')) { unplaceExtract(state, id); commit(); announce('Extrait remis dans la pioche'); return; }
  const kids = childrenOf(state, id).length;
  if (kids && !confirm(`Supprimer « ${n.text} » ? ${['backbone', 'journey'].includes(n.place.b)
    ? `Ses ${kids} post-it${kids > 1 ? 's' : ''} ne sont pas perdus : les actions retournent dans « Pas encore regroupées », les stories dans le bac.`
    : `Les ${kids} post-it${kids > 1 ? 's' : ''} rattachés seront supprimés aussi.`}`)) return;
  const before = clone(state.notes);
  removeNote(state, id);
  const kept = new Map(state.notes.map((x) => [x.id, x]));
  const removed = before.map((x, i) => ({ x, i })).filter(({ x }) => !kept.has(x.id));
  const moved = before.filter((x) => kept.has(x.id) && encodePlace(x.place) !== encodePlace(kept.get(x.id).place));
  commit();
  undoToast(removed.length > 1 ? `${removed.length} post-its supprimés.` : 'Post-it supprimé.', () => {
    for (const { x, i } of removed) if (!getNote(state, x.id)) state.notes.splice(Math.min(i, state.notes.length), 0, clone(x));
    for (const x of moved) { const cur = getNote(state, x.id); if (cur) cur.place = x.place; }
    commit();
    announce('Suppression annulée');
  });
}

/** Message avec un bouton « Annuler », quelques secondes. */
function undoToast(message, onUndo) {
  const el = $('#toast');
  clearTimeout(toast.timer);
  el.innerHTML = `<span>${esc(message)}</span> <button type="button" class="toast-undo">Annuler</button>`;
  el.hidden = false;
  const btn = el.querySelector('.toast-undo');
  btn.addEventListener('click', () => { el.hidden = true; onUndo(); }, { once: true });
  toast.timer = setTimeout(() => { el.hidden = true; }, 6000);
}

main.addEventListener('click', (e) => {
  const delBtn = e.target.closest('[data-del]');
  if (delBtn) { e.stopPropagation(); deleteNote(delBtn.dataset.del); return; }
  const stage = e.target.closest('[data-stage]');
  if (stage && !stage.disabled) { setStoryStage(stage.dataset.stage); return; }
  const t = e.target;
  const groupTab = t.closest('[data-group]');
  if (groupTab) { showGroup(groupTab.dataset.group); render(`group:${groupTab.dataset.group}`); return; }
  if (!canEdit() && t.closest(EDIT_TARGETS)) {
    toast(shared.group === 'sim' ? 'Groupe simulé : lecture seule.' : !HOST && !shared.restitution && timeUp() ? 'Temps écoulé : on attend la restitution.' : !HOST && !shared.restitution && myGroupDone() ? 'Votre groupe a terminé : « Finalement, on continue » pour modifier encore.' : shared.restitution ? 'Restitution : seul l\'animateur déplace les post-its.' : 'Lecture seule : c\'est le tableau de l\'autre groupe.');
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

// Récit : ajouter une action (le champ reste ouvert pour enchaîner).
main.addEventListener('submit', (e) => {
  if (e.target.id !== 'action-form') return;
  e.preventDefault();
  const input = e.target.elements.action;
  const text = input.value;
  if (!canEdit() || !text.trim()) return;
  const note = addNote(state, { b: 'action' }, text, hooks.author ? { author: hooks.author() } : {});
  if (!note) return;
  input.value = '';
  ui.actionDraft = '';
  commit({ focus: 'action-input' });
  announce('Action ajoutée au récit');
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
  'theory-open'() { if (state.step === 'frame') ui.frameFolded = false; else ui.theoryOpen.add(state.step); render('theory'); },
  'theory-close'() { if (state.step === 'frame') ui.frameFolded = true; else ui.theoryOpen.delete(state.step); render('theory'); },
  'case-toggle'() { ui.caseOpen[state.step] = !caseOpen(); render('case'); },
  /** Animateur : lance la pratique pour tous ; la première fois, le minuteur de l'étape démarre (empathy : à l'exercice). */
  'practice-start'() {
    if (!HOST) return;
    const step = state.step;
    const first = !practiceOn(step);
    if (!state.practice.includes(step)) state.practice.push(step);
    ui.theoryOpen.delete(step);
    if (phones?.live) {
      phones.setPractice(step).catch(() => toast('Pratique non lancée chez les participants : la connexion est peut-être coupée.'));
      if (step !== 'empathy') startStepTimer(step, first);
    }
    commit();
  },
  /** Empathy : après la lecture du cas, l'exercice (consigne, carte, minuteur) pour tous. */
  'exercise-start'() {
    if (!HOST) return;
    const step = state.step;
    const first = !exerciseOn(step);
    if (!state.exercise.includes(step)) state.exercise.push(step);
    if (phones?.live) {
      phones.setMetaFlag('exercise', step).catch(() => toast('Exercice non lancé chez les participants : la connexion est peut-être coupée.'));
      startStepTimer(step, first);
    }
    commit();
  },
  'example-show'() {
    if (!HOST && shared.on) return;
    const step = state.step;
    if (!state.examples.includes(step)) state.examples.push(step);
    ui.exampleOpen[step] = true;
    if (phones?.live) phones.setMetaFlag('examples', step).catch(() => {});
    commit({ focus: 'example' });
  },
  'example-toggle'() {
    const step = state.step;
    ui.exampleOpen[step] = !(ui.exampleOpen[step] ?? true);
    render('example');
  },
  'reset-answers'() { state.debrief.answers = {}; commit(); },
  'phones-show'() { phones.show(); },
  async 'roti-create'() {
    if (!HOST || !phones?.live || phones.roti) return;
    const btn = main.querySelector('[data-act="roti-create"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Création du ROTI…'; }
    try {
      const code = await createRoti(`Atelier Produit · ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date())}`);
      await phones.setRoti(code);
      toast('ROTI créé : le lien est sur l\'écran des participants.');
    } catch {
      toast('ROTI injoignable : vérifiez le réseau (le VPN de l\'entreprise peut le bloquer), puis réessayez.');
      render();
    }
  },
  async 'copy-link'() {
    const ok = await copyText(phones.shareUrl);
    toast(ok ? 'Lien copié : collez-le dans le chat de la réunion.' : 'Copie impossible : sélectionnez le lien à la main.');
  },
  async 'quiz-start'() {
    await phones.clearQuiz();
    await phones.setQuizEnd(phones.now + QUIZ_DURATION).catch(() => {});
    if (await phones.setQuiz('open')) announce('Quiz lancé : 3 minutes');
  },
  /** Révéler : fin du quiz (à la main ou à la fin du temps), puis le ROTI part tout seul. */
  async 'quiz-reveal'() {
    if (!(await phones.setQuiz('revealed'))) return;
    announce('Réponses révélées');
    if (!phones.roti) actions['roti-create']();
  },
  async 'quiz-stop'() {
    if (!confirm('Fermer le quiz ? Les participants reviennent à l\'écran d\'attente.')) return;
    await phones.setQuiz('off');
  },
  async 'quiz-replay'() {
    if (!confirm('Effacer toutes les copies et relancer un quiz ?')) return;
    await phones.setQuiz('off');
    await phones.clearQuiz();
    await phones.setQuizEnd(phones.now + QUIZ_DURATION).catch(() => {});
    await phones.setQuiz('open');
  },
  compare() {
    if ((!HOST || shared.group === 'sim' || !shared.restitution) && shared.on) return;
    if (shared.on) { shared.setState(shared.group, 'compare', !state.compare[state.persona]); return; }
    state.compare[state.persona] = !state.compare[state.persona]; commit({ focus: 'compare' });
  },
  restitution() {
    if (!shared.restitution && !exerciseOn()) { toast('Lancez d\'abord l\'exercice.'); return; }
    if (!shared.restitution && TIMER_STEPS.includes(state.step)) phones?.setMetaFlag('restituted', state.step).catch(() => {});
    phones?.setRestitution(!shared.restitution);
  },
  'journey-example'() {
    if (!HOST) return;
    const name = personaById(state.persona)?.name ?? '';
    const n = journeyNotes(state).length;
    if (n && !confirm(`Remplacer les ${n} étape${n > 1 ? 's' : ''} du groupe par les étapes types de ${name} ? Leurs actions retournent dans « Pas encore regroupées ».`)) return;
    useJourneyExample(state, state.persona);
    ui.storyStage = 'regroup';
    commit();
    announce('Étapes types posées : le groupe y range ses actions');
  },
  'journey-next'() { setStoryStage('regroup'); },
  'journey-back'() { setStoryStage('recit'); },
  'journey-validate'() { setStoryStage('link'); },
  'journey-cut'() { setStoryStage('map'); },
  'journey-reopen'() { setStoryStage('link'); },
  check() { state.debrief.checked = true; commit({ focus: 'check' }); },
  async copy() {
    const text = reportBoards().map(({ title, notes }) => `${title ? `===== ${title.toUpperCase()} =====\n` : ''}${reportText({ ...state, notes }, today())}`).join('\n\n');
    const ok = await copyText(text + quizReportLines());
    toast(ok ? 'Compte rendu copié' : 'Copie impossible : utilisez l\'impression');
  },
  print() { printReport(); },
  save() { downloadJson(serialize(state), `atelier-produit-${today()}.json`); },
  open() { $('#file-input').click(); },
  async reset() {
    const live = !!phones?.live;
    if (!confirm(`Effacer tout l'atelier en cours et repartir de zéro ?${live ? ' La séance en ligne est terminée et effacée : un nouveau code sera créé.' : ''} (Pensez à l'enregistrer avant.)`)) return;
    if (live) await phones.end({ ask: false });
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
  // Quiz (participant, sur ordinateur) : une notion se dépose sur une zone du double diamant.
  if (dragKey.startsWith('qtool:')) return dropKey.startsWith('qzone:');
  if (!canEdit()) return false;
  const [type, id] = splitKey(dragKey);
  if (type === 'tool') return dropKey === 'tools' || dropKey.startsWith('phase:');
  if (type === 'extract') {
    const place = decodePlace(dropKey);
    return place?.b === 'empathy' && place.persona === extractById(id)?.persona;
  }
  if (type === 'deliv') return ['story', 'tray'].includes(decodePlace(dropKey)?.b);
  if (type === 'note') {
    const n = getNote(state, id);
    if (!n) return false;
    if (dropKey === 'kept') return !!n.from?.startsWith('deliverable:');
    if (dropKey.startsWith('pool:')) return !!n.from?.startsWith('extract:');
    const place = decodePlace(dropKey);
    return !!place && (samePlace(place, n.place) || !moveBlocker(state, id, place));
  }
  return false;
}

function onDrop(dragKey, dropKey, beforeKey) {
  if (dragKey.startsWith('qtool:')) { hooks.placeQuizTool?.(dragKey.slice(6), dropKey.slice(6)); return; }
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
    if (dropKey === 'kept') { removeNote(state, id); commit(); announce('Livrable remis dans la liste des livrables retenus'); return; }
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
      const sig = `${phones.live}|${phones.quiz}|${phones.url}|${phones.code}|${phones.groups}|${phones.restitution}|${phones.roti}|${JSON.stringify(phones.practice)}|${phones.presence.map((p) => p.uid + p.author).join(',')}|${JSON.stringify(phones.members)}`;
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
  rotiBlock,
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
