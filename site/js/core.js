// Logique métier de l'atelier : état, post-its et leurs emplacements, règles de déplacement,
// débrief, fusion des post-its venus des téléphones, compte rendu et fichiers enregistrés.
// Logique pure (ni DOM ni Firebase), testée avec Node.js.

import {
  STEPS, PERSONAS, EMPATHY_ZONES, STORY_LANES, JOURNEY_EXAMPLES, JOURNEY_MIN, JOURNEY_MAX, SYSTEM_WORDS, SIMULATED, GOAL_EXAMPLE, TOOL_PHASES, PHASES, PLACES,
  SITUATIONS, SITUATION_CHOICES, TOOLS, CASE, IMPACT_LEVELS,
} from './content.js?v=__VERSION__';

export const APP_ID = 'atelier-produit';
export const FORMAT_VERSION = 1;
export const MAX_TEXT = 200;
export const MAX_AUTHOR = 30;

export const STEP_IDS = STEPS.map((s) => s.id);
export const PERSONA_IDS = PERSONAS.map((p) => p.id);
export const ZONE_IDS = EMPATHY_ZONES.map((z) => z.id);
/** « À découper » : les livrables reliés au parcours (temps 3), pas encore rangés dans une version. */
export const SORT_LANE = 'sort';
export const LANE_IDS = [...STORY_LANES.map((l) => l.id), SORT_LANE];
export const IMPACT_KINDS = ['actor', 'impact', 'deliverable'];
export const TOOL_IDS = Object.keys(TOOL_PHASES);
export const PHASE_IDS = PHASES.map((p) => p.id);
/** Où ranger une notion au débrief : une des quatre phases, ou tout le double diamant. */
export const PLACE_IDS = PLACES.map((p) => p.id);
export const JOURNEY_STAGES = ['recit', 'regroup'];

const ID_RE = /^[a-z0-9]{4,24}$/;

/** Identifiant aléatoire en minuscules et chiffres. */
export function newId(length = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

const cleanText = (value, max = MAX_TEXT) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function newState() {
  return {
    version: FORMAT_VERSION,
    step: 'welcome',
    visited: ['welcome'],
    persona: PERSONA_IDS[0],
    notes: [],
    compare: {},
    journey: 'recit', // story map, avant le parcours validé : 'recit' (on raconte) ou 'regroup' (on regroupe)
    theoryClosed: [],
    practice: [], // étapes dont l'animateur a lancé la pratique (avant : la théorie seule)
    exercise: [], // empathy : exercice lancé (après la lecture du cas)
    examples: [], // exemples dévoilés par l'animateur
    debrief: { mode: 'team', placement: {}, checked: false, answers: {}, takeaways: '' },
    seen: [],
  };
}

/* ---------- Étapes ---------- */

export function setStep(state, step) {
  if (!STEP_IDS.includes(step)) return false;
  state.step = step;
  if (!state.visited.includes(step)) state.visited.push(step);
  return true;
}

export const stepIndex = (step) => STEP_IDS.indexOf(step);
export const nextStep = (step) => STEP_IDS[stepIndex(step) + 1] ?? null;
export const prevStep = (step) => STEP_IDS[stepIndex(step) - 1] ?? null;

/* ---------- Emplacements ----------
   Un post-it est toujours rangé à un emplacement (place) :
   { b: 'empathy', persona, zone }      zone d'une empathy map
   { b: 'tray', step: 'impact'|'story' } bac « à placer » d'une étape
   { b: 'goal' }                        objectif de l'impact map
   { b: 'actor', parent: goalId }       acteur sous un objectif
   { b: 'impact', parent: actorId }     impact sous un acteur
   { b: 'deliverable', parent: impactId } livrable sous un impact
   { b: 'action' }                      action du récit, pas encore regroupée
   { b: 'action', parent: stepId }      action regroupée sous une étape du parcours
   { b: 'journey' }                     étape du parcours, en cours de regroupement (avant validation)
   { b: 'backbone' }                    étape de la colonne vertébrale de la story map
   { b: 'story', col: backboneId, lane } story sous une étape, dans une version */

export function encodePlace(p) {
  switch (p.b) {
    case 'empathy': return `empathy|${p.persona}|${p.zone}`;
    case 'tray': return `tray|${p.step}`;
    case 'goal': return 'goal';
    case 'actor': return `actor|${p.parent}`;
    case 'impact': return `impact|${p.parent}`;
    case 'deliverable': return `deliverable|${p.parent}`;
    case 'action': return p.parent ? `action|${p.parent}` : 'action';
    case 'journey': return 'journey';
    case 'backbone': return 'backbone';
    case 'story': return `story|${p.col}|${p.lane}`;
    default: return '';
  }
}

export function decodePlace(key) {
  const [b, a, c] = String(key ?? '').split('|');
  switch (b) {
    case 'empathy': return { b, persona: a, zone: c };
    case 'tray': return { b, step: a };
    case 'goal': return { b };
    case 'actor': return { b, parent: a };
    case 'impact': return { b, parent: a };
    case 'deliverable': return { b, parent: a };
    case 'action': return a ? { b, parent: a } : { b };
    case 'journey': return { b: 'backbone' }; // ancien format : une étape en cours de regroupement
    case 'backbone': return { b };
    case 'story': return { b, col: a, lane: c };
    default: return null;
  }
}

export const samePlace = (p, q) => !!p && !!q && encodePlace(p) === encodePlace(q);

/** Famille d'un emplacement : un post-it ne change jamais de famille (d'étape). */
export function familyOf(p) {
  if (!p) return null;
  if (p.b === 'empathy') return 'empathy';
  if (p.b === 'tray') return p.step;
  if (['goal', 'actor', 'impact', 'deliverable'].includes(p.b)) return 'impact';
  if (p.b === 'action') return 'recit';
  if (p.b === 'journey') return 'journey';
  if (['backbone', 'story'].includes(p.b)) return 'story';
  return null;
}

/** Vrai si l'emplacement existe dans cet état (parent présent, valeurs connues). */
export function placeExists(state, p) {
  if (!p) return false;
  const parentIs = (id, b) => state.notes.some((n) => n.id === id && n.place.b === b);
  switch (p.b) {
    case 'empathy': return PERSONA_IDS.includes(p.persona) && ZONE_IDS.includes(p.zone);
    case 'tray': return p.step === 'impact' || p.step === 'story';
    case 'goal':
    case 'journey':
    case 'backbone': return true;
    case 'action': return !p.parent || parentIs(p.parent, 'journey') || parentIs(p.parent, 'backbone');
    case 'actor': return parentIs(p.parent, 'goal');
    case 'impact': return parentIs(p.parent, 'actor');
    case 'deliverable': return parentIs(p.parent, 'impact');
    case 'story': return LANE_IDS.includes(p.lane) && (parentIs(p.col, 'backbone') || parentIs(p.col, 'journey'));
    default: return false;
  }
}

/* ---------- Post-its ---------- */

export const getNote = (state, id) => state.notes.find((n) => n.id === id) ?? null;
export const notesIn = (state, place) => state.notes.filter((n) => samePlace(n.place, place));

/** Enfants directs d'un post-it (impacts d'un acteur, livrables d'un impact, stories d'une étape). */
export function childrenOf(state, id) {
  return state.notes.filter((n) => (n.place.parent === id && ['actor', 'impact', 'deliverable', 'action'].includes(n.place.b)) || (n.place.b === 'story' && n.place.col === id));
}

export function addNote(state, place, text, extra = {}) {
  const value = cleanText(text);
  if (!value || !placeExists(state, place)) return null;
  const note = { id: newId(), text: value, place: { ...place } };
  if (extra.from) note.from = String(extra.from);
  if (extra.author) note.author = cleanText(extra.author, MAX_AUTHOR);
  if (extra.rid) note.rid = String(extra.rid);
  if (extra.kind && IMPACT_KINDS.includes(extra.kind)) note.kind = extra.kind;
  state.notes.push(note);
  return note;
}

export function updateNote(state, id, text) {
  const note = getNote(state, id);
  const value = cleanText(text);
  if (!note || !value) return false;
  note.text = value;
  return true;
}

/**
 * Peut-on ranger ce post-it à cet emplacement ? Renvoie null si oui, sinon la raison :
 * 'missing' (post-it ou emplacement inconnu), 'family' (autre étape), 'children' (il a des enfants
 * et changerait de niveau).
 */
export function moveBlocker(state, id, place) {
  const note = getNote(state, id);
  if (!note || !placeExists(state, place)) return 'missing';
  if (familyOf(note.place) !== familyOf(place)) return 'family';
  if (note.place.b !== place.b && childrenOf(state, id).length) return 'children';
  if (place.parent === id || place.col === id) return 'children';
  return null;
}

/** Range le post-it à l'emplacement, avant `beforeId` s'il y est, sinon à la fin. */
export function moveNote(state, id, place, beforeId = null) {
  const reason = moveBlocker(state, id, place);
  if (reason) return { ok: false, reason };
  const index = state.notes.findIndex((n) => n.id === id);
  const [note] = state.notes.splice(index, 1);
  note.place = { ...place };
  if (place.b !== 'tray') delete note.kind;
  const before = beforeId && beforeId !== id ? state.notes.findIndex((n) => n.id === beforeId && samePlace(n.place, place)) : -1;
  if (before >= 0) state.notes.splice(before, 0, note);
  else state.notes.push(note);
  return { ok: true };
}

/**
 * Supprime un post-it. Un acteur emporte ses impacts et leurs livrables ; un impact ses livrables ;
 * les stories d'une étape supprimée retournent dans le bac de la story map. Renvoie le nombre supprimé.
 */
export function removeNote(state, id) {
  const note = getNote(state, id);
  if (!note) return 0;
  const doomed = new Set([id]);
  if (note.place.b === 'backbone' || note.place.b === 'journey') {
    // Les actions regroupées retournent dans le récit, les stories dans le bac.
    for (const child of childrenOf(state, id)) child.place = child.place.b === 'action' ? { b: 'action' } : { b: 'tray', step: 'story' };
  } else {
    const stack = [id];
    while (stack.length) {
      const current = stack.pop();
      for (const child of childrenOf(state, current)) {
        if (!doomed.has(child.id)) { doomed.add(child.id); stack.push(child.id); }
      }
    }
  }
  state.notes = state.notes.filter((n) => !doomed.has(n.id));
  return doomed.size;
}

/** Emplacements proposés pour ranger un post-it (menu « Déplacer vers »), avec leur libellé. */
export function placesFor(state, id) {
  const note = getNote(state, id);
  if (!note) return [];
  const family = familyOf(note.place);
  const out = [];
  const label = (n) => (n.text.length > 40 ? `${n.text.slice(0, 39)}…` : n.text);
  if (family === 'empathy') {
    for (const z of EMPATHY_ZONES) out.push({ place: { b: 'empathy', persona: note.place.persona, zone: z.id }, label: z.label });
  } else if (family === 'impact') {
    out.push({ place: { b: 'tray', step: 'impact' }, label: 'Bac « à placer »' });
    out.push({ place: { b: 'goal' }, label: 'Objectif' });
    for (const g of notesIn(state, { b: 'goal' })) out.push({ place: { b: 'actor', parent: g.id }, label: `Acteur de « ${label(g)} »` });
    for (const a of state.notes.filter((n) => n.place.b === 'actor')) out.push({ place: { b: 'impact', parent: a.id }, label: `Impact de « ${label(a)} »` });
    for (const i of state.notes.filter((n) => n.place.b === 'impact')) out.push({ place: { b: 'deliverable', parent: i.id }, label: `Livrable de « ${label(i)} »` });
  } else if (family === 'journey') {
    out.push({ place: { b: 'journey' }, label: 'Étape du parcours' });
  } else if (family === 'recit') {
    out.push({ place: { b: 'action' }, label: 'Pas encore regroupée' });
    for (const st of notesIn(state, { b: 'backbone' })) out.push({ place: { b: 'action', parent: st.id }, label: `Sous « ${label(st)} »` });
  } else if (family === 'story') {
    out.push({ place: { b: 'tray', step: 'story' }, label: 'Bac « à placer »' });
    out.push({ place: { b: 'backbone' }, label: 'Étape du parcours' });
    for (const col of notesIn(state, { b: 'backbone' })) {
      for (const lane of STORY_LANES) out.push({ place: { b: 'story', col: col.id, lane: lane.id }, label: `${label(col)} · ${lane.label}` });
    }
  }
  return out.filter((o) => !moveBlocker(state, id, o.place) || samePlace(o.place, note.place));
}

/* ---------- Empathy map ---------- */

export const personaById = (id) => PERSONAS.find((p) => p.id === id) ?? null;

export function extractById(id) {
  for (const p of PERSONAS) {
    const e = p.extracts.find((x) => x.id === id);
    if (e) return { ...e, persona: p.id };
  }
  return null;
}

/** Extraits d'interview pas encore posés sur la carte de ce persona. */
export function availableExtracts(state, personaId) {
  const persona = personaById(personaId);
  if (!persona) return [];
  const used = new Set(state.notes.filter((n) => n.from?.startsWith('extract:')).map((n) => n.from.slice(8)));
  return persona.extracts.filter((e) => !used.has(e.id));
}

/** Pose un extrait d'interview dans une zone (ou le déplace s'il est déjà posé). */
export function placeExtract(state, extractId, zone, beforeId = null) {
  const extract = extractById(extractId);
  if (!extract || !ZONE_IDS.includes(zone)) return null;
  const place = { b: 'empathy', persona: extract.persona, zone };
  const existing = state.notes.find((n) => n.from === `extract:${extractId}`);
  if (existing) {
    moveNote(state, existing.id, place, beforeId);
    return existing;
  }
  const note = addNote(state, place, extract.text, { from: `extract:${extractId}` });
  if (note && beforeId) moveNote(state, note.id, place, beforeId);
  return note;
}

/** Remet un extrait dans la pioche (supprime son post-it). */
export function unplaceExtract(state, noteId) {
  const note = getNote(state, noteId);
  if (!note?.from?.startsWith('extract:')) return false;
  removeNote(state, noteId);
  return true;
}

/** Comparaison avec la proposition de tri : pour chaque extrait posé, la zone suggérée. */
export function compareEmpathy(state, personaId) {
  const items = state.notes
    .filter((n) => n.place.b === 'empathy' && n.place.persona === personaId && n.from?.startsWith('extract:'))
    .map((n) => {
      const extract = extractById(n.from.slice(8));
      return { noteId: n.id, zone: n.place.zone, expected: extract?.zone ?? null, ok: extract?.zone === n.place.zone };
    });
  return { items, placed: items.length, matching: items.filter((i) => i.ok).length };
}

/** Zones sans aucun post-it sur la carte d'un persona. */
export function emptyZones(state, personaId) {
  return ZONE_IDS.filter((z) => !notesIn(state, { b: 'empathy', persona: personaId, zone: z }).length);
}

/* ---------- Impact mapping ---------- */

export function toggleKeep(state, id) {
  const note = getNote(state, id);
  if (!note || note.place.b !== 'deliverable') return false;
  if (note.keep) delete note.keep;
  else note.keep = true;
  return true;
}

/** Livrables retenus pour la story map, avec leur état d'import. */
export function keptDeliverables(state) {
  return state.notes
    .filter((n) => n.place.b === 'deliverable' && n.keep)
    .map((n) => ({ ...n, imported: state.notes.some((m) => m.from === `deliverable:${n.id}`) }));
}

/** Copie un livrable retenu dans la story map (bac, étape ou case). */
export function importDeliverable(state, deliverableId, place, beforeId = null, external = null) {
  const source = external ?? getNote(state, deliverableId);
  if (!source || source.place.b !== 'deliverable' || familyOf(place) !== 'story') return null;
  const existing = state.notes.find((n) => n.from === `deliverable:${deliverableId}`);
  if (existing) {
    const moved = moveNote(state, existing.id, place, beforeId);
    return moved.ok ? existing : null;
  }
  const note = addNote(state, place, source.text, { from: `deliverable:${deliverableId}` });
  if (note && beforeId) moveNote(state, note.id, place, beforeId);
  return note;
}

/** Fil d'un livrable : objectif → acteur → impact → livrable (textes). */
export function deliverablePath(state, id) {
  const d = getNote(state, id);
  const impact = d && getNote(state, d.place.parent);
  const actor = impact && getNote(state, impact.place.parent);
  const goal = actor && getNote(state, actor.place.parent);
  return [goal?.text, actor?.text, impact?.text, d?.text].filter(Boolean);
}

/* ---------- Story mapping ---------- */

/** Les grandes étapes du parcours : ce sont directement les colonnes de la story map. */
export const journeyNotes = (state) => notesIn(state, { b: 'backbone' });
/** Les actions du récit : toutes, pas encore regroupées, ou regroupées sous une étape. */
export const allActions = (state) => state.notes.filter((n) => n.place.b === 'action');
export const looseActions = (state) => notesIn(state, { b: 'action' });
export const actionsOf = (state, stepId) => notesIn(state, { b: 'action', parent: stepId });

/** Étapes du parcours sous lesquelles aucun livrable de l'impact map n'a été rangé. */
export function stepsWithoutDeliverable(state) {
  const cols = notesIn(state, { b: 'backbone' });
  return cols.filter((c) => !state.notes.some((n) => n.place.b === 'story' && n.place.col === c.id && n.from?.startsWith('deliverable:')));
}

/**
 * Bouton de secours de l'animateur : remplace les étapes du groupe par les étapes types de la
 * persona. Les actions retournent dans « Pas encore regroupées », les stories dans le bac.
 */
export function useJourneyExample(state, personaId) {
  const list = JOURNEY_EXAMPLES[personaId] ?? [];
  for (const st of journeyNotes(state)) removeNote(state, st.id);
  for (const text of list) addNote(state, { b: 'backbone' }, text, { from: 'example' });
  return list.length;
}

/**
 * Conseils de formulation sur un parcours : trop court, trop long, étapes qui ne commencent pas
 * par un verbe à l'infinitif, ou qui décrivent le système. Ce sont des indices, pas des erreurs.
 */
export function journeyHints(texts) {
  const words = (t) => t.toLowerCase().replace(/[«»"'’.,;:!?()]/g, ' ').split(/\s+/).filter(Boolean);
  // Infinitif : terminaison -er, -ir, -re, -oir (éventuellement précédé de « se », « s' »).
  const isVerb = (t) => {
    const w = words(t);
    const first = ['se', 's', 'ne'].includes(w[0]) ? w[1] : w[0];
    return /^[a-zàâçéèêëîïôûùüÿœ-]+(er|ir|re|oir)$/.test(first ?? '');
  };
  const systemy = (t) => {
    const low = ` ${words(t).join(' ')} `;
    return SYSTEM_WORDS.some((w) => low.includes(` ${w} `));
  };
  return {
    count: texts.length,
    tooFew: texts.length < JOURNEY_MIN,
    tooMany: texts.length > JOURNEY_MAX,
    notVerb: texts.filter((t) => !isVerb(t)),
    system: texts.filter(systemy),
  };
}

/** Tableau d'un groupe simulé sur une persona : empathy map, impact map, parcours et story map. */
export function simulatedNotes(personaId) {
  const sim = SIMULATED[personaId];
  const persona = PERSONAS.find((p) => p.id === personaId);
  if (!sim || !persona) return [];
  let k = 0;
  const id = () => `sim${personaId.slice(0, 1)}${String(++k).padStart(3, '0')}`;
  const notes = [];
  const push = (text, place, extra = {}) => { const n = { id: id(), text, place, ...extra }; notes.push(n); return n; };
  for (const e of persona.extracts) push(e.text, { b: 'empathy', persona: personaId, zone: e.zone }, { from: `extract:${e.id}` });
  const goal = push(GOAL_EXAMPLE, { b: 'goal' });
  for (const a of sim.impact) {
    const actor = push(a.actor, { b: 'actor', parent: goal.id });
    for (const i of a.impacts) {
      const impact = push(i.text, { b: 'impact', parent: actor.id });
      for (const [text, keep] of i.deliverables) push(text, { b: 'deliverable', parent: impact.id }, keep ? { keep: true } : {});
    }
  }
  const cols = JOURNEY_EXAMPLES[personaId].map((text) => push(text, { b: 'backbone' }));
  sim.story.forEach((lanes, c) => {
    lanes.forEach((texts, l) => {
      for (const text of texts) push(text, { b: 'story', col: cols[c].id, lane: LANE_IDS[l] });
    });
  });
  return notes;
}

/** La première version traverse-t-elle tout le parcours ? Étapes sans story en première version. */
export function mvpGaps(state) {
  const cols = notesIn(state, { b: 'backbone' });
  return cols.filter((c) => !notesIn(state, { b: 'story', col: c.id, lane: 'mvp' }).length);
}

/* ---------- Débrief ---------- */

export function setPlacement(state, tool, phase) {
  if (!TOOL_IDS.includes(tool)) return false;
  if (phase === null) delete state.debrief.placement[tool];
  else if (PLACE_IDS.includes(phase)) state.debrief.placement[tool] = phase;
  else return false;
  state.debrief.checked = false;
  return true;
}

/** Résultat du rangement sur le double diamant : true, false, ou null si l'outil n'est pas posé. */
export function checkPlacement(state) {
  const out = {};
  for (const tool of TOOL_IDS) {
    const phase = state.debrief.placement[tool];
    out[tool] = phase ? TOOL_PHASES[tool].includes(phase) : null;
  }
  return out;
}

export function answerSituation(state, situationId, choice) {
  if (!SITUATIONS.some((s) => s.id === situationId) || !SITUATION_CHOICES.includes(choice)) return false;
  state.debrief.answers[situationId] = choice;
  return true;
}

/**
 * Verdict d'une réponse : 'right' (le plus adapté), 'ok' (défendable, demi-point) ou 'wrong',
 * avec l'explication propre au choix fait.
 */
export function situationVerdict(situation, choice) {
  if (choice === situation.answer) return { level: 'right', text: situation.why, points: 1 };
  const other = situation.others?.[choice];
  if (other?.level === 'ok') return { level: 'ok', text: other.text, points: 0.5 };
  return { level: 'wrong', text: other?.text ?? '', points: 0 };
}

export function situationScore(state) {
  const answered = SITUATIONS.filter((s) => state.debrief.answers[s.id]);
  const verdicts = answered.map((s) => situationVerdict(s, state.debrief.answers[s.id]));
  return {
    answered: answered.length,
    correct: verdicts.filter((v) => v.level === 'right').length,
    defensible: verdicts.filter((v) => v.level === 'ok').length,
    points: verdicts.reduce((sum, v) => sum + v.points, 0),
    total: SITUATIONS.length,
  };
}

/* ---------- Post-its venus des téléphones ---------- */

/**
 * Ajoute au tableau les post-its envoyés depuis les téléphones et pas encore vus.
 * remote : [{ rid, author, step, zone, persona, text }]. Renvoie les post-its ajoutés.
 */
export function mergeRemote(state, remote) {
  const seen = new Set(state.seen);
  const added = [];
  for (const r of remote) {
    if (!r?.rid || seen.has(r.rid)) continue;
    seen.add(r.rid);
    state.seen.push(r.rid);
    const extra = { author: r.author, rid: r.rid, from: 'phone' };
    let note = null;
    if (r.step === 'empathy') {
      const persona = PERSONA_IDS.includes(r.persona) ? r.persona : state.persona;
      const zone = ZONE_IDS.includes(r.zone) ? r.zone : 'says';
      note = addNote(state, { b: 'empathy', persona, zone }, r.text, extra);
    } else if (r.step === 'impact') {
      note = addNote(state, { b: 'tray', step: 'impact' }, r.text, { ...extra, kind: r.zone });
    } else if (r.step === 'story') {
      note = addNote(state, { b: 'tray', step: 'story' }, r.text, extra);
    }
    if (note) added.push(note);
  }
  return added;
}

/* ---------- Compte rendu ---------- */

export function reportText(state, date = '') {
  const lines = [`Atelier Produit · ${CASE.name}${date ? ` · ${date}` : ''}`, ''];
  const bullet = (n) => `- ${n.text}${n.author ? ` (${n.author})` : ''}`;

  lines.push('EMPATHY MAP');
  for (const p of PERSONAS) {
    const any = state.notes.some((n) => n.place.b === 'empathy' && n.place.persona === p.id);
    if (!any) continue;
    lines.push('', `${p.name}, ${p.role.toLowerCase()} (${p.profile.toLowerCase()})`);
    for (const z of EMPATHY_ZONES) {
      const list = notesIn(state, { b: 'empathy', persona: p.id, zone: z.id });
      if (list.length) lines.push(`${z.label} :`, ...list.map(bullet));
    }
  }
  if (!state.notes.some((n) => n.place.b === 'empathy')) lines.push('(non remplie)');

  lines.push('', 'IMPACT MAP');
  const goals = notesIn(state, { b: 'goal' });
  if (!goals.length) lines.push('(non remplie)');
  for (const g of goals) {
    lines.push(`Objectif : ${g.text}`);
    for (const a of notesIn(state, { b: 'actor', parent: g.id })) {
      lines.push(`- ${a.text}`);
      for (const i of notesIn(state, { b: 'impact', parent: a.id })) {
        lines.push(`  - ${i.text}`);
        for (const d of notesIn(state, { b: 'deliverable', parent: i.id })) lines.push(`    - ${d.text}${d.keep ? ' [retenu]' : ''}`);
      }
    }
  }

  lines.push('', 'STORY MAP');
  const cols = notesIn(state, { b: 'backbone' });
  if (!cols.length) lines.push('(non remplie)');
  for (const lane of STORY_LANES) {
    const rows = cols.map((c) => ({ c, list: notesIn(state, { b: 'story', col: c.id, lane: lane.id }) })).filter((r) => r.list.length);
    if (!rows.length) continue;
    lines.push(`${lane.label} :`);
    for (const r of rows) lines.push(`- ${r.c.text} : ${r.list.map((n) => n.text).join(' ; ')}`);
  }

  lines.push('', 'DÉBRIEF');
  if (state.debrief.takeaways.trim()) lines.push('Ce que l\'équipe retient :', state.debrief.takeaways.trim());
  return lines.join('\n');
}

/* ---------- Fichier enregistré et état mémorisé ---------- */

export function serialize(state, savedAt = new Date().toISOString()) {
  const { session, ...rest } = state;
  return { app: APP_ID, version: FORMAT_VERSION, savedAt, state: structuredClone(rest) };
}

/**
 * Relit un état (fichier enregistré ou navigateur) en ne gardant que ce qui est valide.
 * Lève une erreur si ce n'est pas un fichier de l'atelier.
 */
export function parseSaved(data) {
  const raw = data?.app === APP_ID ? data.state : null;
  if (!raw || typeof raw !== 'object') throw new Error('not-a-workshop-file');
  return sanitize(raw);
}

export function sanitize(raw) {
  const state = newState();
  if (STEP_IDS.includes(raw.step)) state.step = raw.step;
  if (Array.isArray(raw.visited)) state.visited = STEP_IDS.filter((s) => raw.visited.includes(s) || s === state.step);
  if (!state.visited.includes('welcome')) state.visited.unshift('welcome');
  if (PERSONA_IDS.includes(raw.persona)) state.persona = raw.persona;

  // Post-its : on garde les valides, en plusieurs passes pour que les parents passent avant les enfants.
  let rawNotes = (Array.isArray(raw.notes) ? raw.notes : []).filter((n) => n && typeof n === 'object');
  // Anciens ateliers : un seul objectif (raw.goal) et des acteurs sans parent.
  const loose = rawNotes.filter((n) => n.place?.b === 'actor' && !n.place.parent);
  const oldGoal = cleanText(raw.goal);
  if ((oldGoal || loose.length) && !rawNotes.some((n) => n.place?.b === 'goal')) {
    const gid = newId();
    rawNotes = [{ id: gid, text: oldGoal || 'Objectif à définir', place: { b: 'goal' } }, ...rawNotes];
    for (const n of loose) n.place = { b: 'actor', parent: gid };
  }
  const pending = rawNotes.filter((n) => ID_RE.test(n.id) && cleanText(n.text) && decodePlace(encodePlace(n.place ?? {})));
  const ids = new Set();
  const order = new Map(pending.map((n, i) => [n, i]));
  for (const pass of [['empathy', 'tray', 'goal', 'journey', 'backbone'], ['actor', 'action'], ['impact'], ['deliverable', 'story']]) {
    for (const n of pending) {
      if (!pass.includes(n.place.b) || ids.has(n.id)) continue;
      let place = decodePlace(encodePlace(n.place));
      if (!placeExists(state, place)) {
        const family = familyOf(place);
        if (family === 'impact' || family === 'story') place = { b: 'tray', step: family };
        else if (family === 'recit') place = { b: 'action' };
        else continue;
      }
      const note = { id: n.id, text: cleanText(n.text), place };
      if (typeof n.from === 'string' && /^(extract:[a-z0-9]+|deliverable:[a-z0-9]+|phone|example)$/.test(n.from)) note.from = n.from;
      if (n.author) note.author = cleanText(n.author, MAX_AUTHOR);
      if (typeof n.rid === 'string' && ID_RE.test(n.rid)) note.rid = n.rid;
      if (place.b === 'tray' && IMPACT_KINDS.includes(n.kind)) note.kind = n.kind;
      if (place.b === 'deliverable' && n.keep === true) note.keep = true;
      note.order = order.get(n);
      state.notes.push(note);
      ids.add(n.id);
    }
  }
  // Ordre d'origine conservé (les passes ne servent qu'à vérifier les parents).
  state.notes.sort((x, y) => x.order - y.order);
  for (const n of state.notes) delete n.order;
  // Un extrait ne peut être posé qu'une fois.
  const extracts = new Set();
  state.notes = state.notes.filter((n) => {
    if (!n.from?.startsWith('extract:')) return true;
    const e = extractById(n.from.slice(8));
    if (!e || extracts.has(e.id) || n.place.b !== 'empathy' || n.place.persona !== e.persona) return false;
    extracts.add(e.id);
    return true;
  });

  if (JOURNEY_STAGES.includes(raw.journey)) state.journey = raw.journey;
  if (Array.isArray(raw.practice)) state.practice = STEP_IDS.filter((st) => raw.practice.includes(st));
  if (Array.isArray(raw.exercise)) state.exercise = STEP_IDS.filter((st) => raw.exercise.includes(st));
  if (Array.isArray(raw.examples)) state.examples = STEP_IDS.filter((st) => raw.examples.includes(st));
  if (Array.isArray(raw.theoryClosed)) state.theoryClosed = STEP_IDS.filter((st) => raw.theoryClosed.includes(st));
  if (raw.compare && typeof raw.compare === 'object') {
    for (const p of PERSONA_IDS) if (raw.compare[p] === true) state.compare[p] = true;
  }
  const d = raw.debrief ?? {};
  for (const tool of TOOL_IDS) if (PLACE_IDS.includes(d.placement?.[tool])) state.debrief.placement[tool] = d.placement[tool];
  state.debrief.checked = d.checked === true;
  state.debrief.mode = d.mode === 'quiz' ? 'quiz' : 'team';
  for (const s of SITUATIONS) if (SITUATION_CHOICES.includes(d.answers?.[s.id])) state.debrief.answers[s.id] = d.answers[s.id];
  state.debrief.takeaways = String(d.takeaways ?? '').slice(0, 4000);
  if (Array.isArray(raw.seen)) state.seen = raw.seen.filter((r) => typeof r === 'string' && ID_RE.test(r)).slice(-2000);
  return state;
}

/** Libellé lisible d'un emplacement (annonces d'accessibilité, menus). */
export function placeLabel(state, place) {
  switch (place.b) {
    case 'empathy': return EMPATHY_ZONES.find((z) => z.id === place.zone)?.label ?? '';
    case 'tray': return 'bac à placer';
    case 'goal': return 'objectifs';
    case 'actor': return `acteurs de « ${getNote(state, place.parent)?.text ?? ''} »`;
    case 'impact': return `impacts de « ${getNote(state, place.parent)?.text ?? ''} »`;
    case 'deliverable': return `livrables de « ${getNote(state, place.parent)?.text ?? ''} »`;
    case 'journey': return 'parcours';
    case 'action': return place.parent ? `actions de « ${getNote(state, place.parent)?.text ?? ''} »` : 'récit';
    case 'backbone': return 'colonne vertébrale';
    case 'story': return `${getNote(state, place.col)?.text ?? ''}, ${STORY_LANES.find((l) => l.id === place.lane)?.label ?? ''}`;
    default: return '';
  }
}

export const toolName = (id) => TOOLS[id]?.name ?? id;

/* ---------- Tableaux partagés (un par groupe) ----------
   Dans la base, chaque post-it est un enregistrement séparé (notes/{id}) : deux personnes qui
   travaillent sur deux post-its différents ne s'écrasent jamais. L'ordre d'affichage est un nombre. */

const RECORD_FROM = /^(extract:[a-z0-9]+|deliverable:[a-z0-9]+|phone|example)$/;

/** Un post-it prêt à écrire dans la base. */
export function noteRecord(n, order) {
  const r = { text: n.text, place: encodePlace(n.place), order };
  if (n.from) r.from = n.from;
  if (n.author) r.author = n.author;
  if (n.kind) r.kind = n.kind;
  if (n.keep) r.keep = true;
  return r;
}

/** Les enregistrements de la base, relus en post-its valides, dans l'ordre. */
export function recordsToNotes(tree) {
  const rows = Object.entries(tree ?? {})
    .filter(([id, r]) => ID_RE.test(id) && r && typeof r === 'object')
    .sort(([a, x], [b, y]) => (Number(x.order) || 0) - (Number(y.order) || 0) || a.localeCompare(b))
    .map(([id, r]) => ({
      id, text: r.text, place: decodePlace(r.place) ?? {}, from: typeof r.from === 'string' && RECORD_FROM.test(r.from) ? r.from : undefined,
      author: r.author, kind: r.kind, keep: r.keep === true,
    }));
  return sanitize({ notes: rows }).notes;
}

/**
 * Ce qu'il faut écrire dans la base pour passer de `before` à `after` :
 * { 'notes/{id}': enregistrement | null }, seulement pour les post-its ajoutés, modifiés ou supprimés.
 */
export function boardUpdates(before, after) {
  const prev = new Map(before.map((n, i) => [n.id, JSON.stringify(noteRecord(n, i))]));
  const out = {};
  after.forEach((n, i) => {
    const rec = noteRecord(n, i);
    if (prev.get(n.id) !== JSON.stringify(rec)) out[`notes/${n.id}`] = rec;
    prev.delete(n.id);
  });
  for (const id of prev.keys()) out[`notes/${id}`] = null;
  return out;
}

/** Fusionne des mises à jour dans un arbre d'enregistrements (simulation locale de la base). */
export function applyUpdates(tree, updates) {
  const next = { ...(tree ?? {}) };
  for (const [path, value] of Object.entries(updates)) {
    const id = path.slice(6);
    if (value === null) delete next[id];
    else next[id] = value;
  }
  return next;
}
