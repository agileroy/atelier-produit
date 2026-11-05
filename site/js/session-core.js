// Séance téléphones : logique pure (identifiants, post-its et quiz échangés avec Firebase).
// Testée avec Node.js (tests/session-core.test.mjs). Les règles de database.rules.json appliquent
// les mêmes contraintes côté base (branche atelierProduit).

import { STEP_IDS, PERSONA_IDS, ZONE_IDS, IMPACT_KINDS, MAX_AUTHOR, TOOL_IDS, PHASE_IDS, newId, situationVerdict } from './core.js?v=__VERSION__';
import { PHONE_STEPS, SITUATIONS, SITUATION_CHOICES, TOOL_PHASES } from './content.js?v=__VERSION__';

export const MAX_PHONE_TEXT = 140;
export const isSessionId = (v) => typeof v === 'string' && /^[a-z0-9]{12}$/.test(v);
export const isKey = (v) => typeof v === 'string' && /^[a-z0-9]{24}$/.test(v);
export { newId };

/** Zones qu'un téléphone peut choisir à chaque étape. */
export const PHONE_ZONES = {
  empathy: ZONE_IDS,
  impact: IMPACT_KINDS,
  story: ['story'],
};

/** Fiche d'une séance, prête à écrire (createdAt est ajouté par le magasin). */
export function metaFor({ title, step, persona }) {
  return {
    title: String(title ?? '').trim().slice(0, 80) || 'Atelier Produit',
    step: STEP_IDS.includes(step) ? step : 'frame',
    persona: PERSONA_IDS.includes(persona) ? persona : PERSONA_IDS[0],
    closed: false,
    quiz: 'off',
  };
}

/** États du quiz individuel : fermé, ouvert aux réponses, réponses révélées. */
export const QUIZ_STATES = ['off', 'open', 'revealed'];

/** Lecture prudente d'une fiche venue de la base. */
export function readMeta(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string') return null;
  return {
    title: raw.title,
    step: STEP_IDS.includes(raw.step) ? raw.step : 'frame',
    persona: PERSONA_IDS.includes(raw.persona) ? raw.persona : PERSONA_IDS[0],
    closed: raw.closed === true,
    quiz: QUIZ_STATES.includes(raw.quiz) ? raw.quiz : 'off',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : null,
  };
}

/**
 * Post-it prêt à écrire (createdAt est ajouté par le magasin), ou null s'il n'est pas valide :
 * l'étape doit accepter les post-its, la zone doit appartenir à l'étape, texte et prénom non vides.
 */
export function notePayload({ author, step, zone, persona, text }) {
  const a = String(author ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_AUTHOR);
  const t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PHONE_TEXT);
  if (!a || !t || !PHONE_STEPS.includes(step) || !PHONE_ZONES[step].includes(zone)) return null;
  return {
    author: a,
    step,
    zone,
    persona: step === 'empathy' && PERSONA_IDS.includes(persona) ? persona : '',
    text: t,
  };
}

/**
 * Aplatit l'arbre notes/{uid}/{noteId} lu dans la base en une liste de post-its valides,
 * triés par date d'envoi : [{ rid, uid, author, step, zone, persona, text, createdAt }].
 */
export function flattenNotes(tree) {
  const out = [];
  for (const [uid, notes] of Object.entries(tree ?? {})) {
    for (const [rid, raw] of Object.entries(notes ?? {})) {
      if (!/^[a-z0-9]{12}$/.test(rid)) continue;
      const payload = notePayload(raw ?? {});
      if (!payload) continue;
      out.push({ rid, uid, ...payload, createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0 });
    }
  }
  return out.sort((x, y) => x.createdAt - y.createdAt || x.rid.localeCompare(y.rid));
}

/** Adresse de la page participant pour une séance. */
export function participantUrl(base, sid) {
  const url = new URL('postit.html', base);
  url.search = `?atelier=${sid}`;
  return url.href;
}

/* ---------- Quiz individuel (débrief) ---------- */

const cleanAuthor = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_AUTHOR);

/** Nombre de réponses attendues : un rangement par outil, un choix par situation. */
export const QUIZ_QUESTIONS = TOOL_IDS.length + SITUATIONS.length;
export const QUIZ_MAX = QUIZ_QUESTIONS;

/** Combien de réponses sont données dans un brouillon. */
export function quizProgress({ placement = {}, answers = {} } = {}) {
  return TOOL_IDS.filter((t) => PHASE_IDS.includes(placement[t])).length
    + SITUATIONS.filter((s) => SITUATION_CHOICES.includes(answers[s.id])).length;
}

/** Réponses prêtes à écrire (submittedAt est ajouté par le magasin), ou null si incomplètes. */
export function quizPayload({ author, placement = {}, answers = {} }) {
  const a = cleanAuthor(author);
  if (!a || quizProgress({ placement, answers }) !== QUIZ_QUESTIONS) return null;
  return {
    author: a,
    placement: Object.fromEntries(TOOL_IDS.map((t) => [t, placement[t]])),
    answers: Object.fromEntries(SITUATIONS.map((s) => [s.id, answers[s.id]])),
  };
}

/**
 * Score d'une copie : 1 point par outil bien rangé, 1 point par situation (½ si défendable).
 * Renvoie le détail pour la correction personnalisée.
 */
export function quizScore(entry) {
  const tools = TOOL_IDS.map((t) => ({ tool: t, phase: entry.placement[t], ok: TOOL_PHASES[t].includes(entry.placement[t]) }));
  const situations = SITUATIONS.map((s) => ({ id: s.id, choice: entry.answers[s.id], ...situationVerdict(s, entry.answers[s.id]) }));
  const points = tools.filter((t) => t.ok).length + situations.reduce((sum, v) => sum + v.points, 0);
  return { tools, situations, points, max: QUIZ_MAX };
}

/** Copies lues dans la base (quiz/{uid}), valides et notées, dans l'ordre de validation. */
export function readQuizEntries(tree) {
  const out = [];
  for (const [uid, raw] of Object.entries(tree ?? {})) {
    const payload = quizPayload(raw ?? {});
    if (!payload) continue;
    const submittedAt = typeof raw.submittedAt === 'number' ? raw.submittedAt : 0;
    out.push({ uid, ...payload, submittedAt, score: quizScore(payload) });
  }
  return out.sort((x, y) => x.submittedAt - y.submittedAt || x.uid.localeCompare(y.uid));
}

/** Podium : les trois meilleurs scores ; à égalité, le premier à avoir validé passe devant. */
export function podium(entries, size = 3) {
  return [...entries]
    .sort((x, y) => y.score.points - x.score.points || x.submittedAt - y.submittedAt || x.uid.localeCompare(y.uid))
    .slice(0, size)
    .map((e, i) => ({ rank: i + 1, author: e.author, points: e.score.points }));
}

/** Statistiques du groupe : moyenne, et pour chaque question la répartition des réponses. */
export function quizStats(entries) {
  const n = entries.length;
  const average = n ? entries.reduce((sum, e) => sum + e.score.points, 0) / n : 0;
  const tools = Object.fromEntries(TOOL_IDS.map((t) => [t, Object.fromEntries(PHASE_IDS.map((p) => [p, entries.filter((e) => e.placement[t] === p).length]))]));
  const situations = Object.fromEntries(SITUATIONS.map((s) => [s.id, Object.fromEntries(SITUATION_CHOICES.map((c) => [c, entries.filter((e) => e.answers[s.id] === c).length]))]));
  // La situation la moins réussie : la plus intéressante à discuter.
  let hardest = null;
  if (n) {
    for (const s of SITUATIONS) {
      const rate = situations[s.id][s.answer] / n;
      if (!hardest || rate < hardest.rate) hardest = { id: s.id, rate };
    }
  }
  return { count: n, average, tools, situations, hardest };
}
