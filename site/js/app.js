// Écran de l'animateur : le parcours guidé en cinq étapes, projeté devant l'équipe.
// L'état vit dans le navigateur (localStorage) ; les post-its des téléphones arrivent par phones.js.

import {
  STEPS, CASE, PERSONAS, EMPATHY_ZONES, IMPACT_LEVELS, STORY_LANES, TOOLS, PHASES, TOOL_PHASES,
  STEP_PHASES, BRIEFS, SITUATIONS, SITUATION_CHOICES, PHONE_STEPS, DIAMOND_MESSAGE, DIAMOND_LOOP,
  PLACEMENT_FEEDBACK, EXAMPLE_CASE, IMPACT_EXAMPLE, STORY_EXAMPLE,
} from './content.js?v=__VERSION__';
import {
  newState, setStep, nextStep, prevStep, stepIndex, addNote, updateNote, moveNote, moveBlocker, removeNote,
  notesIn, getNote, childrenOf, placesFor, encodePlace, decodePlace, samePlace, familyOf, placeLabel,
  availableExtracts, placeExtract, unplaceExtract, extractById, compareEmpathy, emptyZones, personaById,
  toggleKeep, keptDeliverables, importDeliverable, useBackboneExample, mvpGaps,
  setPlacement, checkPlacement, answerSituation, situationScore, situationVerdict, mergeRemote, reportText,
  serialize, parseSaved, sanitize, toolName, TOOL_IDS, MAX_TEXT,
} from './core.js?v=__VERSION__';
import { $, $$, esc, toast, announce, copyText, load, save, setupTheme, downloadJson, today, qrSvg, ICONS } from './shared.js?v=__VERSION__';
import { podium, quizStats, QUIZ_MAX } from './session-core.js?v=__VERSION__';
import { setupDnd } from './dnd.js?v=__VERSION__';
import { createPhones } from './phones.js?v=__VERSION__';

const STORE_KEY = 'atelier-produit.state';
const STEP_TOOL = { frame: 'designThinking', empathy: 'empathy', impact: 'impact', story: 'story', debrief: 'designThinking' };
const STEP_NUMBER = { empathy: 1, impact: 2, story: 3 };
const ZONE_HUES = { says: 205, thinks: 265, does: 150, feels: 330, pains: 6, gains: 44 };
const KIND_HUES = { goal: 262, actor: 205, impact: 28, deliverable: 150 };
const CHOICE_LABELS = { empathy: 'Empathy map', impact: 'Impact mapping', story: 'Story mapping', designThinking: 'La démarche complète (Design Thinking)' };

const main = $('#main');
let state = restore();
const ui = { selectedTool: null, info: null, frameTheory: false, quizEntries: [] };

function restore() {
  const saved = load(STORE_KEY);
  if (!saved) return newState();
  try { return saved.app ? parseSaved(saved) : sanitize(saved); } catch { return newState(); }
}

/* ---------- Cycle : modifier, mémoriser, redessiner ---------- */

function persist() {
  save(STORE_KEY, serialize(state));
}

function commit({ focus } = {}) {
  persist();
  render(focus);
  phones.sync(state.step, state.persona);
}

function render(focus) {
  const active = document.activeElement;
  const keep = focus ?? (active && main.contains(active) ? focusKey(active) : null);
  const scroll = $$('.canvas-scroll').map((s) => s.scrollLeft);
  main.dataset.step = state.step;
  main.innerHTML = views[state.step]();
  $$('.canvas-scroll').forEach((s, i) => { if (scroll[i]) s.scrollLeft = scroll[i]; });
  renderStepper();
  if (keep) main.querySelector(`[data-focus="${CSS.escape(keep)}"]`)?.focus({ preventScroll: true });
}

const focusKey = (el) => el.closest('[data-focus]')?.dataset.focus ?? null;

function go(step) {
  if (!setStep(state, step)) return;
  ui.selectedTool = null;
  commit();
  window.scrollTo({ top: 0 });
  $('h1', main)?.focus({ preventScroll: true });
  announce(STEPS.find((s) => s.id === step).label);
}

/* ---------- En-tête : étapes ---------- */

function renderStepper() {
  $('#stepper').innerHTML = STEPS.map((s, i) => `<li><button type="button" data-go="${s.id}" ${s.id === state.step ? 'aria-current="step"' : ''}>
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
      <p class="lede">${esc(debrief ? 'On range les outils, on s\'entraîne à choisir le bon, et on garde une trace.' : tool.oneLine)}</p>
    </div>
    ${diamondMini(STEP_PHASES[step])}
  </header>
  ${debrief ? '' : theoryBlock(step)}
  ${briefBlock(step)}`;
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
  return `<div class="example">
    ${exampleHead('Une story map, du parcours aux versions')}
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
        <button type="button" class="dinfo" data-info="${p.id}" data-focus="info:${p.id}" data-nodrag aria-expanded="${ui.info === p.id}" aria-controls="dtip-${p.id}" aria-label="En savoir plus : ${esc(p.label)}" >i</button>
      </span>
      <span class="dtip ${ui.info === p.id ? 'is-open' : ''}" id="dtip-${p.id}" role="note">${esc(p.plain)}</span>
      <span class="dphase-mode">${p.mode === 'ouvrir' ? '◁ on ouvre ▷' : '▷ on choisit ◁'}</span>
      <span class="dphase-chips">${(chips[p.id] ?? []).map((t) => toolChip(t, { draggable: droppable, result: results?.[t] })).join('')}</span>
    </div>`).join('')}
    <p class="dloop">↺ ${esc(DIAMOND_LOOP)}</p>
  </div>
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
  return `<section class="tray ${list.length ? '' : 'is-empty'}" aria-label="${esc(title)}">
    <h2 class="tray-title">${esc(title)} ${list.length ? `<span class="count">${list.length}</span>` : ''}</h2>
    <p class="hint">${esc(hint)}</p>
    <div class="tray-list" data-drop="${encodePlace(place)}" data-axis="x">${list.map((n) => noteHtml(n)).join('')}</div>
  </section>`;
}

/* ---------- Étape « cadre » ---------- */

function viewFrame() {
  const chips = {};
  for (const tool of TOOL_IDS) {
    if (!state.visited.includes(tool)) continue;
    const phase = TOOL_PHASES[tool][0];
    (chips[phase] ??= []).push(tool);
  }
  const plan = [
    ['empathy', 'Pour qui ?', 'Comprendre deux futurs utilisateurs à partir d\'extraits d\'interview.'],
    ['impact', 'Pourquoi ?', 'Relier un objectif mesurable aux comportements à changer, puis aux livrables.'],
    ['story', 'Quoi, dans quel ordre ?', 'Organiser le parcours et tracer une première version utile.'],
    ['debrief', 'Quand utiliser quoi ?', 'Ranger les outils et s\'entraîner sur des situations réelles.'],
  ];
  return `
  <header class="intro intro--frame">
    <p class="kicker">Atelier Produit</p>
    <h1 tabindex="-1">Quatre techniques, un même fil rouge</h1>
    <p class="lede">Le Design Thinking donne la démarche ; l'empathy map, l'impact mapping et le story mapping en sont des outils. Pour voir comment ils s'enchaînent, on les applique l'un après l'autre sur le même cas.</p>
  </header>

  ${joinCard()}

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

  <section class="frame-diamond">
    <div class="section-head">
      <h2>Le double diamant</h2>
    </div>
    <p class="diamond-message">${esc(DIAMOND_MESSAGE)}</p>
    <p class="hint">Au fil de l'atelier, chaque outil vient prendre sa place sur le diamant.</p>
    ${diamondBoard({ chips })}
  </section>
  ${theoryBlock('frame')}

  <section>
    <h2 class="section-title">Le déroulé</h2>
    <ol class="plan">
      ${plan.map(([id, q, text], i) => {
        const step = STEPS.find((s) => s.id === id);
        return `<li><button type="button" class="plan-item" data-go="${id}">
          <span class="plan-n">${i + 1}</span>
          <span class="plan-body"><strong>${esc(step.label)}</strong> <em>${esc(q)}</em><span>${esc(text)}</span></span>
          <span class="plan-time">${esc(BRIEFS[id].duration)}</span>
        </button></li>`;
      }).join('')}
    </ol>
    <p class="hint">Environ deux heures. L'écran est projeté ; chacun peut aussi envoyer des post-its depuis son téléphone (bouton « Téléphones » en haut).</p>
  </section>
  ${stepNav()}`;
}

/** Rejoindre sur téléphone : le QR code en évidence dès l'arrivée. */
function joinCard() {
  if (!phones.available) return '';
  if (!phones.live) {
    return `<section class="join join--off">
      <span class="join-icon">${ICONS.phone}</span>
      <div><h2>Les téléphones, pour participer</h2>
      <p class="hint">Chacun rejoint l'atelier avec son prénom : il pourra envoyer des post-its, puis jouer au quiz final.</p></div>
      <button type="button" class="btn btn-primary" data-act="phones-show" data-focus="phones-show">Ouvrir l'atelier aux téléphones</button>
    </section>`;
  }
  return `<section class="join">
    <div class="join-qr">${qrSvg(phones.url, 'QR code pour rejoindre l\'atelier')}</div>
    <div><p class="kicker">Rejoignez l'atelier</p>
      <h2>Scannez, puis entrez votre prénom</h2>
      <p class="hint">Gardez la page ouverte : elle suit l'écran, pour les post-its puis pour le quiz final.</p>
      <p class="join-url">${esc(phones.url.replace(/^https?:\/\//, ''))}</p></div>
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
  <div class="persona-tabs" role="tablist" aria-label="Persona">
    ${PERSONAS.map((p) => {
      const count = state.notes.filter((n) => n.place.b === 'empathy' && n.place.persona === p.id).length;
      return `<button type="button" role="tab" aria-selected="${p.id === persona.id}" data-persona="${p.id}" data-focus="persona:${p.id}" style="--h:${p.hue}">
        ${avatar(p, 'avatar--sm')}<span><strong>${esc(p.name)}</strong> ${esc(p.profile.toLowerCase())}</span>${count ? `<span class="count">${count}</span>` : ''}</button>`;
    }).join('')}
  </div>
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
        ? `<p><strong>${cmp.matching} extrait${cmp.matching > 1 ? 's' : ''} sur ${cmp.placed}</strong> rangé${cmp.matching > 1 ? 's' : ''} comme la proposition. Il n'y a pas de tri parfait : un écart est une bonne occasion de discuter (dire n'est pas penser, faire n'est pas dire).</p>`
        : '<p>Une fois les extraits rangés, comparez avec une proposition de tri.</p>'}
      ${empty.length ? `<p>Zones vides : <strong>${esc(empty.join(', '))}</strong>. Ce sont les questions de la prochaine interview.</p>` : '<p>Toutes les zones ont au moins un post-it.</p>'}
    </div>
    <button type="button" class="btn ${comparing ? 'btn-quiet' : 'btn-primary'}" data-act="compare" data-focus="compare" ${cmp.placed ? '' : 'disabled'}>
      ${comparing ? 'Masquer la proposition' : 'Comparer avec la proposition'}</button>
  </section>
  ${stepNav()}`;
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
    <button type="button" class="keep-btn" data-keep="${d.id}" data-focus="keep:${d.id}" aria-pressed="${!!d.keep}" title="${d.keep ? 'Retenu pour la story map' : 'Retenir pour la story map'}">
      ${ICONS.star}<span class="sr-only">${d.keep ? 'Retenu pour la story map' : 'Retenir pour la story map'}</span></button></li>`;

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
      <p class="hint">${ICONS.star} Cochez l'étoile des livrables que vous retenez : ils vous attendront dans la story map. Plusieurs sous-groupes ? Chacun peut poser son propre objectif avec « Autre objectif ».</p>
    </div>
    <aside class="side">
      ${trayHtml('impact', 'À placer', 'Les post-its des téléphones arrivent ici. Glissez-les dans l\'arbre.')}
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

function viewStory() {
  const cols = notesIn(state, { b: 'backbone' });
  const kept = keptDeliverables(state);
  const gaps = mvpGaps(state);
  const cell = (c, lane) => {
    const place = { b: 'story', col: c.id, lane: lane.id };
    return `<div class="scell" data-drop="${encodePlace(place)}">${notesIn(state, place).map((n) => noteHtml(n)).join('')}${addButton(place, 'Story')}</div>`;
  };
  return `
  ${stepHeader('story')}
  <div class="story-sources">
    <section class="kept">
      <h2>Livrables retenus <span class="count">${kept.length}</span></h2>
      ${kept.length
        ? `<p class="hint">Glissez-les sous une étape du parcours (ou touchez-en un pour l'envoyer dans le bac).</p>
           <div class="kept-list">${kept.map((d) => `<button type="button" class="kchip ${d.imported ? 'is-imported' : ''}" data-drag="deliv:${d.id}" data-deliv="${d.id}" data-focus="deliv:${d.id}">
             ${d.imported ? ICONS.check : ''}${esc(d.text)}</button>`).join('')}</div>`
        : `<p class="hint">Aucun livrable retenu : cochez l'étoile des livrables dans <button type="button" class="link-btn" data-go="impact">l'impact map</button>.</p>`}
    </section>
    ${trayHtml('story', 'À placer', 'Post-its des téléphones et stories en attente.')}
  </div>

  <div class="canvas">
    <div class="canvas-scroll">
      <div class="smap" style="--cols:${cols.length}">
        <div class="srow srow--backbone">
          <div class="slabel"><strong>Le parcours</strong><span>De gauche à droite, les grandes étapes de l'utilisateur.</span></div>
          <div class="backbone" data-drop="backbone" data-axis="x">
            ${cols.map((c) => `<div class="bcell">${noteHtml(c)}</div>`).join('')}
            <div class="bcell bcell--add">${addButton({ b: 'backbone' }, 'Étape')}
              ${cols.length ? '' : '<button type="button" class="link-btn" data-act="backbone-example" data-focus="backbone-example">Partir du parcours type</button>'}</div>
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
    <div><h2>Peut-on covoiturer avec la première version ?</h2>
    ${gaps.length
      ? `<p>Étapes sans rien en première version : <strong>${esc(gaps.map((g) => g.text).join(', '))}</strong>. Une première version doit traverser tout le parcours, même de façon rudimentaire.</p>`
      : '<p>La première version traverse tout le parcours. Relisez-la : est-ce vraiment le minimum ? Que pourrait-on encore retirer ?</p>'}
      <p>Cette première version, c'est aussi un test : on la met entre les mains des utilisateurs pour apprendre, et ce qu'on apprend peut renvoyer au premier diamant.</p></div>
  </section>` : ''}
  ${stepNav()}`;
}

/* ---------- Étape 4 : débrief ---------- */

function viewDebrief() {
  const placement = state.debrief.placement;
  const results = state.debrief.checked ? checkPlacement(state) : null;
  const chips = {};
  for (const tool of TOOL_IDS) if (placement[tool]) (chips[placement[tool]] ??= []).push(tool);
  const loose = TOOL_IDS.filter((t) => !placement[t]);
  const score = situationScore(state);
  const allPlaced = loose.length === 0;
  const rightCount = results ? TOOL_IDS.filter((t) => results[t]).length : 0;
  const phaseLabel = (id) => PHASES.find((p) => p.id === id).label;
  const fmt = (n) => String(n).replace('.', ',');

  const resultCard = (tool) => {
    const ok = results[tool];
    const phase = placement[tool];
    const best = TOOL_PHASES[tool].map(phaseLabel).join(' et ');
    return `<li class="dresult ${ok ? 'is-right' : 'is-wrong'}">
      <p class="dresult-head">${toolChip(tool)} <span>rangé dans <strong>${esc(phaseLabel(phase))}</strong></span></p>
      <p class="dresult-verdict">${ok ? `${ICONS.check} Bien vu.` : `Pas tout à fait : sa place est ${esc(best)}.`}</p>
      <p>${esc(PLACEMENT_FEEDBACK[tool][phase])}</p>
    </li>`;
  };

  const verdictHtml = (s, answer) => {
    const v = situationVerdict(s, answer);
    const best = `<strong>Le plus adapté : ${esc(CHOICE_LABELS[s.answer])}.</strong> ${esc(s.why)}`;
    if (v.level === 'right') return `<div class="verdict verdict--right" role="status"><p><strong>${ICONS.check} Oui, c'est le plus adapté.</strong> ${esc(s.why)}</p></div>`;
    if (v.level === 'ok') return `<div class="verdict verdict--ok" role="status"><p><strong>Défendable (½ point).</strong> ${esc(v.text)}</p><p>${best}</p></div>`;
    return `<div class="verdict verdict--wrong" role="status"><p><strong>Pas le meilleur choix.</strong> ${esc(v.text)}</p><p>${best}</p></div>`;
  };

  const quizMode = state.debrief.mode === 'quiz';
  const modeSwitch = `<div class="mode-switch" role="radiogroup" aria-label="Déroulé du débrief">
    <button type="button" role="radio" aria-checked="${!quizMode}" data-mode="team" data-focus="mode:team"><strong>En équipe, à l'écran</strong><span>On répond ensemble, l'animateur manipule.</span></button>
    <button type="button" role="radio" aria-checked="${quizMode}" data-mode="quiz" data-focus="mode:quiz"><strong>Quiz individuel sur téléphone</strong><span>Chacun répond dans son coin, puis révélation et podium.</span></button>
  </div>`;

  return `
  ${stepHeader('debrief')}
  ${modeSwitch}
  ${quizMode ? quizPanel() : `
  <section class="dsection">
    <div class="dsection-head">
      <span class="dsection-n">1</span>
      <div><h2>Ranger les outils sur le double diamant</h2>
      <p class="hint">Où chaque outil sert-il le plus ? Glissez-le sur sa phase, ou touchez un outil puis une phase. Les icônes « i » rappellent le sens de chaque phase.</p></div>
      ${results ? `<p class="score">${rightCount} / ${TOOL_IDS.length}</p>` : ''}
    </div>
    <div class="tool-tray" data-drop="tools" data-axis="x">
      <span class="tool-tray-label">À ranger</span>
      ${loose.map((t) => toolChip(t, { draggable: true })).join('') || '<span class="hint">Tous les outils sont rangés : vérifiez quand l\'équipe est d\'accord.</span>'}
    </div>
    ${diamondBoard({ chips, droppable: true, results })}
    <div class="dcheck">
      <button type="button" class="btn btn-primary" data-act="check" data-focus="check" ${allPlaced ? '' : 'disabled'}>${results ? 'Vérifier à nouveau' : 'Vérifier'}</button>
      ${allPlaced ? '' : `<p class="hint">Encore ${loose.length} outil${loose.length > 1 ? 's' : ''} à ranger.</p>`}
    </div>
    ${results ? `<ul class="dresults">${TOOL_IDS.map(resultCard).join('')}</ul>
      <p class="dsummary">${rightCount === TOOL_IDS.length ? 'Tout est à sa place. ' : ''}Et le Design Thinking ? Ce n'est pas un outil de plus : c'est tout le chemin, avec les allers-retours.</p>` : ''}
  </section>

  <section class="dsection">
    <div class="dsection-head">
      <span class="dsection-n">2</span>
      <div><h2>Quel outil pour quelle situation ?</h2>
      <p class="hint">Huit situations réelles. Un point pour le choix le plus adapté, un demi-point pour un choix défendable.</p></div>
      ${score.answered ? `<p class="score">${fmt(score.points)} <small>/ ${score.answered}</small></p>` : ''}
    </div>
    <ol class="situations">
      ${SITUATIONS.map((s, k) => {
        const answer = state.debrief.answers[s.id];
        const v = answer ? situationVerdict(s, answer) : null;
        return `<li class="situation ${v ? `is-${v.level}` : ''}">
          <p class="situation-text"><span class="situation-n">${k + 1}</span>${esc(s.text)}</p>
          <div class="choices" role="group" aria-label="Outil le plus adapté">
            ${SITUATION_CHOICES.map((c) => {
              const cls = answer === c ? `is-chosen is-${v.level}` : answer && c === s.answer ? 'is-answer' : '';
              return `<button type="button" class="choice ${cls}" data-answer="${s.id}" data-choice="${c}" data-focus="answer:${s.id}:${c}" aria-pressed="${answer === c}">${esc(CHOICE_LABELS[c])}</button>`;
            }).join('')}
          </div>
          ${answer ? verdictHtml(s, answer) : ''}
        </li>`;
      }).join('')}
    </ol>
    ${score.answered ? '<p class="hint"><button type="button" class="link-btn" data-act="reset-answers" data-focus="reset-answers">Effacer les réponses</button></p>' : ''}
  </section>`}

  <section class="dsection debrief-end">
    <div class="takeaways">
      <h2>${quizMode ? '' : '3. '}Ce que l'équipe retient</h2>
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

function quizPanel() {
  const entries = ui.quizEntries;
  const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  if (!phones.available) {
    return `<section class="dsection"><p>Le quiz individuel passe par les téléphones, qui ne sont pas configurés pour cet outil. Utilisez le débrief en équipe.</p></section>`;
  }
  if (!phones.live) {
    return `<section class="dsection qpanel">
      <h2>Ouvrez d'abord l'atelier aux téléphones</h2>
      <p class="hint">Chacun rejoint avec son prénom, répond au quiz sur son téléphone, puis vous révélez les réponses : chacun reçoit sa correction, l'écran affiche les bonnes réponses et le podium.</p>
      <button type="button" class="btn btn-primary" data-act="phones-show" data-focus="phones-show">Ouvrir l'atelier aux téléphones</button>
    </section>`;
  }
  const qr = `<div class="qjoin"><div class="join-qr">${qrSvg(phones.url, 'QR code pour rejoindre le quiz')}</div><p class="hint">Pas encore connecté ? Scannez.</p></div>`;

  if (phones.quiz !== 'revealed') {
    const open = phones.quiz === 'open';
    return `<section class="dsection qpanel">
      <div class="qstatus">
        <div>
          <p class="kicker">${open ? 'Quiz en cours' : 'Quiz prêt'}</p>
          <h2>${open ? 'Chacun répond sur son téléphone' : 'Lancez le quiz quand tout le monde est connecté'}</h2>
          <p class="hint">${QUIZ_MAX} questions : ranger les trois outils sur le double diamant, puis huit situations. Un point par bonne réponse, un demi-point pour une réponse défendable.</p>
          ${open ? `<p class="qcount"><strong>${entries.length}</strong> copie${entries.length > 1 ? 's' : ''} reçue${entries.length > 1 ? 's' : ''}</p>
            ${entries.length ? `<ul class="qnames">${entries.map((e) => `<li>${esc(e.author)}</li>`).join('')}</ul>` : '<p class="hint">Les prénoms s\'afficheront ici au fil des validations.</p>'}` : ''}
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
      Chacun a reçu sa correction détaillée sur son téléphone.</p>
    ${hardest >= 0 && stats.hardest.rate < 1 ? `<p class="qhardest"><strong>À discuter :</strong> la situation ${hardest + 1} n'a eu que ${pct(stats.hardest.rate * stats.count)} % de réponses les plus adaptées.</p>` : ''}
    <div class="qactions">
      <button type="button" class="btn btn-quiet" data-act="quiz-replay" data-focus="quiz-replay">Rejouer (effacer les copies)</button>
      <button type="button" class="btn btn-quiet" data-act="quiz-stop" data-focus="quiz-stop">Fermer le quiz</button>
    </div>
  </section>

  <section class="dsection">
    <div class="dsection-head"><span class="dsection-n">1</span><div><h2>Les outils sur le double diamant</h2>
      <p class="hint">Les bonnes réponses, et où le groupe a rangé chaque outil.</p></div></div>
    ${diamondBoard({ chips })}
    <div class="qtools">${TOOL_IDS.map((t) => `<div class="qtool"><p>${toolChip(t)}</p>
      ${bars(stats.tools[t], (ph) => PHASES.find((x) => x.id === ph).label, TOOL_PHASES[t])}
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
    ${n.place.b === 'deliverable' ? `<label class="check"><input type="checkbox" name="keep" ${n.keep ? 'checked' : ''}> Retenu pour la story map</label>` : ''}
    <div class="dialog-actions">
      <button type="button" class="btn btn-danger" data-delete>${extract ? 'Remettre dans la pioche' : 'Supprimer'}</button>
      <span></span>
      <button type="button" class="btn btn-quiet" data-cancel>Annuler</button>
      <button type="submit" class="btn btn-primary">Enregistrer</button>
    </div>
  </form>`, { mode: 'edit', id });
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
  const text = form.elements.text.value;
  if (editing.mode === 'new') {
    const note = addNote(state, editing.place, text);
    editor.close();
    if (note) commit({ focus: `note:${note.id}` });
    return;
  }
  if (editing.mode === 'edit') {
    const n = getNote(state, editing.id);
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

main.addEventListener('click', (e) => {
  const t = e.target;
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
  if (persona) { state.persona = persona.dataset.persona; commit(); return; }

  const deliv = t.closest('[data-deliv]');
  if (deliv) {
    const copy = importDeliverable(state, deliv.dataset.deliv, { b: 'tray', step: 'story' });
    if (copy) { commit(); announce('Livrable ajouté au bac à placer'); }
    return;
  }

  const modeBtn = t.closest('[data-mode]');
  if (modeBtn) { state.debrief.mode = modeBtn.dataset.mode; commit({ focus: `mode:${modeBtn.dataset.mode}` }); return; }

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
  async 'quiz-start'() {
    await phones.clearQuiz();
    if (await phones.setQuiz('open')) announce('Quiz lancé sur les téléphones');
  },
  async 'quiz-reveal'() {
    if (await phones.setQuiz('revealed')) announce('Réponses révélées');
  },
  async 'quiz-stop'() {
    if (!confirm('Fermer le quiz ? Les téléphones reviennent à l\'écran d\'attente.')) return;
    await phones.setQuiz('off');
  },
  async 'quiz-replay'() {
    if (!confirm('Effacer toutes les copies et relancer un quiz ?')) return;
    await phones.setQuiz('off');
    await phones.clearQuiz();
    await phones.setQuiz('open');
  },
  compare() { state.compare[state.persona] = !state.compare[state.persona]; commit({ focus: 'compare' }); },
  'backbone-example'() { useBackboneExample(state); commit(); announce('Parcours type posé : modifiez-le librement'); },
  check() { state.debrief.checked = true; commit({ focus: 'check' }); },
  async copy() {
    const ok = await copyText(reportText(state, today()));
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
    importDeliverable(state, id, decodePlace(dropKey), beforeId);
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

function buildReport() {
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
  const score = situationScore(state);
  $('#print-report').innerHTML = `
    <h1>Atelier Produit · ${esc(CASE.name)}</h1>
    <p class="muted">${esc(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
    <h2>Empathy map</h2>${empathy}
    <h2>Impact map</h2>${tree}
    <h2>Story map</h2>${story}
    <h2>Débrief</h2><p>Situations : ${score.correct} bonne${score.correct > 1 ? 's' : ''} réponse${score.correct > 1 ? 's' : ''} sur ${score.answered}.</p>
    ${state.debrief.takeaways.trim() ? `<h3>Ce que l'équipe retient</h3><p class="pre">${esc(state.debrief.takeaways.trim())}</p>` : ''}`;
}

function printReport() {
  buildReport();
  window.print();
}

/* ---------- Téléphones ---------- */

let phonesSig = '';
const phones = createPhones({
  onChange() {
    const sig = `${phones.live}|${phones.quiz}|${phones.url}`;
    if (sig === phonesSig) return;
    phonesSig = sig;
    if (state.step === 'frame' || state.step === 'debrief') render();
  },
  onQuiz(entries) {
    ui.quizEntries = entries;
    if (state.step === 'debrief' && state.debrief.mode === 'quiz') render();
  },
  button: $('#phones-btn'),
  dialog: $('#phones'),
  count: $('#phones-count'),
  current: () => ({ step: state.step, persona: state.persona }),
  onRemote(list) {
    const added = mergeRemote(state, list);
    if (!added.length) { persist(); return; }
    commit();
    const names = [...new Set(added.map((n) => n.author).filter(Boolean))];
    toast(`${added.length} post-it${added.length > 1 ? 's' : ''} reçu${added.length > 1 ? 's' : ''}${names.length ? ` (${names.slice(0, 3).join(', ')})` : ''}`);
    if (!PHONE_STEPS.includes(state.step)) return;
    for (const n of added) main.querySelector(`[data-note="${n.id}"]`)?.classList.add('is-new');
  },
});

/* ---------- Démarrage ---------- */

setupTheme($('#theme-toggle'));
render();
phones.resume();
window.addEventListener('beforeprint', buildReport);
window.addEventListener('afterprint', () => { $('#print-report').innerHTML = ''; });
// Un autre onglet a modifié l'atelier : on suit.
window.addEventListener('storage', (e) => {
  if (e.key !== STORE_KEY || !e.newValue) return;
  try { state = parseSaved(JSON.parse(e.newValue)); render(); } catch { /* ignoré */ }
});
