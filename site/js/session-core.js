// Séance téléphones : logique pure (identifiants, post-its et quiz échangés avec Firebase).
// Testée avec Node.js (tests/session-core.test.mjs). Les règles de database.rules.json appliquent
// les mêmes contraintes côté base (branche atelierProduit).

import { STEP_IDS, PERSONA_IDS, ZONE_IDS, IMPACT_KINDS, MAX_AUTHOR, TOOL_IDS, PLACE_IDS, newId, situationVerdict } from './core.js?v=__VERSION__';
import { PHONE_STEPS, SITUATIONS, SITUATION_CHOICES, TOOL_PHASES, BRIEFS } from './content.js?v=__VERSION__';

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
export function metaFor({ title, step, persona, code, groups }) {
  return {
    ...(isCode(code) ? { code } : {}),
    title: String(title ?? '').trim().slice(0, 80) || 'Atelier Produit',
    step: STEP_IDS.includes(step) ? step : 'frame',
    persona: PERSONA_IDS.includes(persona) ? persona : PERSONA_IDS[0],
    closed: false,
    quiz: 'off',
    groups: groups === 1 ? 1 : 2,
    restitution: false,
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
    code: isCode(raw.code) ? raw.code : '',
    groups: raw.groups === 1 ? 1 : 2,
    restitution: raw.restitution === true,
    timer: readTimer(raw.timer),
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

/**
 * Lien court à partager : l'adresse de l'atelier avec le code de la salle.
 * La page voit le code et s'ouvre en mode participant.
 */
export function shareLink(base, code) {
  const url = new URL('./', base);
  url.search = `?code=${code}`;
  return url.href;
}

/** Adresse participant pour une séance. */
export function participantUrl(base, sid) {
  const url = new URL('./', base);
  url.search = `?atelier=${sid}`;
  return url.href;
}

/* ---------- Quiz individuel (débrief) ---------- */

const cleanAuthor = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_AUTHOR);

/** Nombre de réponses attendues : un rangement par notion (Design Thinking et trois outils), un choix par situation. */
export const QUIZ_QUESTIONS = TOOL_IDS.length + SITUATIONS.length;
export const QUIZ_MAX = QUIZ_QUESTIONS;

/** Combien de réponses sont données dans un brouillon. */
export function quizProgress({ placement = {}, answers = {} } = {}) {
  return TOOL_IDS.filter((t) => PLACE_IDS.includes(placement[t])).length
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
  const tools = Object.fromEntries(TOOL_IDS.map((t) => [t, Object.fromEntries(PLACE_IDS.map((p) => [p, entries.filter((e) => e.placement[t] === p).length]))]));
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

/* ---------- Salle : code court, prénoms uniques, présence ---------- */

/** Alphabet du code de salle : sans caractères ambigus (0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;
export const isCode = (v) => typeof v === 'string' && new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(v);

export function newCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Code saisi par un participant : majuscules, sans espaces ni tirets. */
export function normalizeCode(input) {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

/**
 * Clé d'unicité d'un prénom dans la salle : sans accents, minuscules, lettres et chiffres seulement.
 * « Thomas », « thomas » et « THOMAS » se confondent ; « Thomas B. » est différent.
 */
export function nameKey(name) {
  return String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
}

/** Présents lus dans la base (presence/{uid}), par ordre d'arrivée. */
export function readPresence(tree) {
  return Object.entries(tree ?? {})
    .map(([uid, raw]) => ({ uid, author: cleanAuthor(raw?.author), at: typeof raw?.at === 'number' ? raw.at : 0 }))
    .filter((p) => p.author)
    .sort((x, y) => x.at - y.at || x.uid.localeCompare(y.uid));
}

/** Présents qui n'ont pas encore rendu leur copie. */
export function waitingFor(presence, entries) {
  const done = new Set(entries.map((e) => e.uid));
  return presence.filter((p) => !done.has(p.uid));
}

/* ---------- Groupes (1 ou 2), gérés par l'animateur ---------- */

export const GROUP_IDS = ['g1', 'g2'];
export const MAX_GROUPS = 2;
export const groupIdsFor = (count) => GROUP_IDS.slice(0, count === 2 ? 2 : 1);
export const groupName = (g) => `Groupe ${GROUP_IDS.indexOf(g) + 1}`;
/** Un persona par groupe : Sophie pour le groupe 1, Karim pour le groupe 2. */
export const DEFAULT_PERSONAS = { g1: PERSONA_IDS[0], g2: PERSONA_IDS[1] };

/** Affectations lues dans la base : { uid: 'g1' | 'g2' }. */
export function readMembers(tree) {
  return Object.fromEntries(Object.entries(tree ?? {}).filter(([, v]) => GROUP_IDS.includes(v?.group)).map(([uid, v]) => [uid, v.group]));
}

const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];

/**
 * Place les présents sans groupe (ou dans un groupe qui n'existe plus) : dans le groupe le moins
 * rempli, au hasard en cas d'égalité. Renvoie seulement les affectations à écrire : { uid: groupe }.
 */
export function assignNewcomers(members, presence, count, random = Math.random) {
  const groups = groupIdsFor(count);
  const size = Object.fromEntries(groups.map((g) => [g, 0]));
  for (const p of presence) if (groups.includes(members[p.uid])) size[members[p.uid]]++;
  const out = {};
  for (const p of presence) {
    if (groups.includes(members[p.uid])) continue;
    const min = Math.min(...groups.map((g) => size[g]));
    const g = pick(groups.filter((x) => size[x] === min), random);
    out[p.uid] = g;
    size[g]++;
  }
  return out;
}

/** Nouvelle répartition au hasard de tous les présents, équilibrée. */
export function shuffleGroups(presence, count, random = Math.random) {
  const groups = groupIdsFor(count);
  const order = presence.map((p) => [random(), p.uid]).sort((a, b) => a[0] - b[0]).map(([, uid]) => uid);
  const offset = Math.floor(random() * groups.length);
  return Object.fromEntries(order.map((uid, i) => [uid, groups[(i + offset) % groups.length]]));
}

/** Composition des groupes : { g1: [{ uid, author }], g2: [...] }, sans les absents. */
export function roster(members, presence, count) {
  const out = Object.fromEntries(groupIdsFor(count).map((g) => [g, []]));
  for (const p of presence) if (out[members[p.uid]]) out[members[p.uid]].push(p);
  return out;
}

/* ---------- Minuteur des étapes d'atelier ----------
   Dans la fiche de séance : { step, endsAt } quand il tourne (heure du serveur, en ms),
   { step, left } quand il est en pause (ms restantes). over: true conservé pour compatibilité.
   À zéro, les tableaux des groupes se verrouillent ; l'animateur lance lui-même la restitution. */

export const TIMER_STEPS = ['empathy', 'impact', 'story'];
const MAX_TIMER = 3 * 3600 * 1000;

/** Durée préconisée d'une étape, en ms (d'après la consigne « À faire »). */
export function stepDuration(step) {
  const min = parseInt(BRIEFS[step]?.duration ?? '', 10);
  return TIMER_STEPS.includes(step) && min > 0 ? min * 60000 : 0;
}

export function readTimer(raw) {
  if (!raw || typeof raw !== 'object' || !TIMER_STEPS.includes(raw.step)) return null;
  const t = { step: raw.step };
  if (typeof raw.endsAt === 'number' && raw.endsAt > 0) t.endsAt = raw.endsAt;
  else if (typeof raw.left === 'number' && raw.left >= 0 && raw.left <= MAX_TIMER) t.left = raw.left;
  else return null;
  if (raw.over === true) t.over = true;
  return t;
}

/** Temps restant (ms) du minuteur de cette étape ; la durée préconisée s'il n'a pas démarré. */
export function timerLeft(timer, step, now) {
  if (!timer || timer.step !== step) return stepDuration(step);
  if (timer.endsAt) return Math.max(0, timer.endsAt - now);
  return timer.left;
}

export const timerRunning = (timer, step) => !!timer && timer.step === step && !!timer.endsAt;

export function startTimer(step, now) {
  return { step, endsAt: now + stepDuration(step) };
}
export function pauseTimer(timer, step, now) {
  return { step, left: timerLeft(timer, step, now), ...(timer?.over ? { over: true } : {}) };
}
export function resumeTimer(timer, step, now) {
  return { step, endsAt: now + timerLeft(timer, step, now), ...(timer?.over ? { over: true } : {}) };
}
/** Ajoute (ou retire) du temps, en gardant l'état (en cours ou en pause). */
export function addTime(timer, step, ms, now) {
  const left = Math.min(MAX_TIMER, Math.max(0, timerLeft(timer, step, now) + ms));
  const over = timer?.step === step && timer.over ? { over: true } : {};
  return timerRunning(timer, step) ? { step, endsAt: now + left, ...over } : { step, left, ...over };
}

/** 12:05, ou 1:02:05 au-delà d'une heure. */
export function formatClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
