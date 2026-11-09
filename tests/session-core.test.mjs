import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metaFor, readMeta, notePayload, flattenNotes, participantUrl, isSessionId, isKey, newId, PHONE_ZONES } from '../site/js/session-core.js';
import { PHONE_STEPS } from '../site/js/content.js';

test('identifiants de séance et clés', () => {
  assert.ok(isSessionId(newId(12)));
  assert.ok(isKey(newId(24)));
  assert.equal(isSessionId('ABC'), false);
});

test('fiche de séance : valeurs bornées', () => {
  assert.deepEqual(metaFor({ title: '  Atelier  ', step: 'impact', persona: 'karim' }), { title: 'Atelier', step: 'impact', persona: 'karim', closed: false, quiz: 'off', groups: 2, restitution: false });
  assert.deepEqual(metaFor({ step: 'lune', persona: 'bob' }), { title: 'Atelier Produit', step: 'frame', persona: 'sophie', closed: false, quiz: 'off', groups: 2, restitution: false });
  assert.equal(readMeta(null), null);
  assert.equal(readMeta({ title: 'x', step: 'story', closed: true }).closed, true);
});

test('post-it de téléphone : zone propre à l\'étape, texte et prénom obligatoires', () => {
  assert.deepEqual(notePayload({ author: ' Léa ', step: 'empathy', zone: 'pains', persona: 'karim', text: ' Peur  des détours ' }),
    { author: 'Léa', step: 'empathy', zone: 'pains', persona: 'karim', text: 'Peur des détours' });
  assert.equal(notePayload({ author: 'Léa', step: 'impact', zone: 'pains', text: 'x' }), null, 'zone d\'une autre étape');
  assert.equal(notePayload({ author: 'Léa', step: 'debrief', zone: 'story', text: 'x' }), null, 'étape sans post-it');
  assert.equal(notePayload({ author: '', step: 'story', zone: 'story', text: 'x' }), null);
  assert.equal(notePayload({ author: 'Léa', step: 'story', zone: 'story', text: '   ' }), null);
  assert.equal(notePayload({ author: 'Léa', step: 'story', zone: 'story', persona: 'karim', text: 'x' }).persona, '', 'persona réservé à l\'empathy map');
  assert.equal(notePayload({ author: 'Léa', step: 'story', zone: 'story', text: 'x'.repeat(300) }).text.length, 140);
});

test('toutes les étapes à téléphone ont leurs zones', () => {
  for (const step of PHONE_STEPS) assert.ok(PHONE_ZONES[step]?.length, step);
});

test('lecture de la base : post-its valides, triés par date', () => {
  const list = flattenNotes({
    u1: {
      bbbbbbbbbbbb: { author: 'Tom', step: 'story', zone: 'story', persona: '', text: 'Deux', createdAt: 20 },
      'pas-un-id': { author: 'Tom', step: 'story', zone: 'story', persona: '', text: 'Intrus', createdAt: 5 },
    },
    u2: {
      aaaaaaaaaaaa: { author: 'Léa', step: 'empathy', zone: 'gains', persona: 'sophie', text: 'Un', createdAt: 10 },
      cccccccccccc: { author: 'Léa', step: 'empathy', zone: 'nope', persona: 'sophie', text: 'Invalide', createdAt: 1 },
    },
  });
  assert.deepEqual(list.map((n) => [n.rid, n.uid, n.text]), [['aaaaaaaaaaaa', 'u2', 'Un'], ['bbbbbbbbbbbb', 'u1', 'Deux']]);
  assert.deepEqual(flattenNotes(null), []);
});

test('adresse participant', () => {
  assert.equal(participantUrl('https://agileroy.github.io/atelier-produit/', 'abcabcabcabc'), 'https://agileroy.github.io/atelier-produit/?atelier=abcabcabcabc');
  assert.equal(participantUrl('https://agileroy.github.io/atelier-produit/index.html?x=1', 'abcabcabcabc'), 'https://agileroy.github.io/atelier-produit/?atelier=abcabcabcabc');
});

import { quizPayload, quizProgress, quizScore, readQuizEntries, podium, quizStats, QUIZ_MAX } from '../site/js/session-core.js';
import { SITUATIONS } from '../site/js/content.js';

const perfect = {
  placement: { designThinking: 'all', empathy: 'discover', impact: 'define', story: 'deliver' },
  answers: Object.fromEntries(SITUATIONS.map((s) => [s.id, s.answer])),
};

test('quiz : une copie incomplète ne part pas', () => {
  assert.equal(quizPayload({ author: 'Léa', placement: {}, answers: {} }), null);
  assert.equal(quizProgress({ placement: { empathy: 'discover' }, answers: {} }), 1);
  assert.equal(quizPayload({ author: '', ...perfect }), null);
  assert.ok(quizPayload({ author: 'Léa', ...perfect }));
});

test('quiz : note sur 12, demi-point pour une réponse défendable', () => {
  assert.equal(QUIZ_MAX, 12, 'quatre notions à ranger et huit situations');
  assert.equal(quizScore(perfect).points, QUIZ_MAX);
  const one = structuredClone(perfect);
  one.placement.impact = 'deliver';
  one.answers.adoption = 'designThinking'; // défendable
  one.answers.backlog = 'empathy'; // faux
  const s = quizScore(one);
  assert.equal(s.points, QUIZ_MAX - 1 - 0.5 - 1);
  assert.equal(s.tools.find((t) => t.tool === 'impact').ok, false);
  assert.equal(s.situations.find((x) => x.id === 'adoption').level, 'ok');
});

test('quiz : podium à trois, égalité départagée par l\'ordre de validation', () => {
  const low = structuredClone(perfect); low.answers.backlog = 'empathy';
  const entries = readQuizEntries({
    u1: { author: 'Tom', ...low, submittedAt: 10 },
    u2: { author: 'Léa', ...perfect, submittedAt: 30 },
    u3: { author: 'Sam', ...perfect, submittedAt: 20 },
    u4: { author: 'Max', ...low, submittedAt: 5 },
    u5: { author: 'Bob', placement: {}, answers: {}, submittedAt: 1 },
  });
  assert.equal(entries.length, 4, 'copie incomplète ignorée');
  assert.deepEqual(podium(entries).map((p) => p.author), ['Sam', 'Léa', 'Max']);
  const stats = quizStats(entries);
  assert.equal(stats.count, 4);
  assert.equal(stats.situations.backlog.empathy, 2);
  assert.equal(stats.hardest.id, 'backlog');
  assert.equal(stats.average, (12 + 12 + 11 + 11) / 4);
});

import { newCode, isCode, normalizeCode, nameKey, readPresence, waitingFor, CODE_ALPHABET } from '../site/js/session-core.js';

test('salle : code court lisible, sans caractère ambigu', () => {
  for (let i = 0; i < 50; i++) assert.ok(isCode(newCode()));
  for (const c of '0O1IL') assert.ok(!CODE_ALPHABET.includes(c), c);
  assert.equal(normalizeCode(' k7-pm '), 'K7PM');
  assert.equal(isCode('K7P'), false);
  assert.equal(metaFor({ code: 'K7PM' }).code, 'K7PM');
  assert.equal(metaFor({ code: 'nope' }).code, undefined, 'pas de champ vide envoyé à la base');
});

test('salle : un prénom, une clé (accents et casse ignorés)', () => {
  assert.equal(nameKey('Thomas'), nameKey(' THOMAS '));
  assert.equal(nameKey('Élodie'), 'elodie');
  assert.notEqual(nameKey('Thomas B.'), nameKey('Thomas'));
  assert.equal(nameKey('!!!'), '');
});

test('salle : présents et copies en attente', () => {
  const presence = readPresence({ u2: { author: 'Tom', at: 20 }, u1: { author: 'Léa', at: 10 }, u3: { author: '', at: 5 } });
  assert.deepEqual(presence.map((p) => p.author), ['Léa', 'Tom']);
  assert.deepEqual(waitingFor(presence, [{ uid: 'u1' }]).map((p) => p.author), ['Tom']);
});

import { shareLink } from '../site/js/session-core.js';

test('lien court à partager : la page participant avec le code', () => {
  assert.equal(shareLink('https://agileroy.github.io/atelier-produit/', 'QVZS'), 'https://agileroy.github.io/atelier-produit/?code=QVZS');
  assert.equal(shareLink('https://agileroy.github.io/atelier-produit/index.html', 'QVZS'), 'https://agileroy.github.io/atelier-produit/?code=QVZS');
  assert.equal(shareLink('http://localhost:8765/index.html', 'K7PM'), 'http://localhost:8765/?code=K7PM');
});

import { assignNewcomers, shuffleGroups, roster, readMembers, groupIdsFor, DEFAULT_PERSONAS } from '../site/js/session-core.js';

const people = (n) => Array.from({ length: n }, (_, i) => ({ uid: `u${i}`, author: `P${i}`, at: i }));
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('groupes : un ou deux, un persona chacun', () => {
  assert.deepEqual(groupIdsFor(1), ['g1']);
  assert.deepEqual(groupIdsFor(2), ['g1', 'g2']);
  assert.deepEqual(groupIdsFor(5), ['g1'], 'jamais plus de deux');
  assert.notEqual(DEFAULT_PERSONAS.g1, DEFAULT_PERSONAS.g2);
});

test('groupes : les arrivants vont dans le groupe le moins rempli', () => {
  const pres = people(5);
  const members = { u0: 'g1', u1: 'g1', u2: 'g2' };
  const out = assignNewcomers(members, pres, 2, seeded());
  assert.deepEqual(Object.keys(out).sort(), ['u3', 'u4'], 'seuls les nouveaux sont affectés');
  const r = roster({ ...members, ...out }, pres, 2);
  assert.ok(Math.abs(r.g1.length - r.g2.length) <= 1, 'équilibré');
  assert.deepEqual(assignNewcomers({ u0: 'g2' }, people(1), 1), { u0: 'g1' }, 'passage à un seul groupe : tout le monde en g1');
});

test('groupes : nouvelle répartition au hasard, équilibrée', () => {
  for (let seed = 1; seed < 20; seed++) {
    const map = shuffleGroups(people(7), 2, seeded(seed));
    const n1 = Object.values(map).filter((g) => g === 'g1').length;
    assert.ok(n1 === 3 || n1 === 4, `seed ${seed} : ${n1}`);
  }
  assert.deepEqual(readMembers({ a: { group: 'g2' }, b: { group: 'g9' }, c: null }), { a: 'g2' });
});

test('minuteur : durée préconisée, pause, reprise, temps ajouté', async () => {
  const sc = await import('../site/js/session-core.js');
  const { stepDuration, startTimer, pauseTimer, resumeTimer, addTime, timerLeft, timerRunning, readTimer, formatClock } = sc;
  assert.equal(stepDuration('empathy'), 25 * 60000);
  assert.equal(stepDuration('frame'), 0);
  assert.equal(timerLeft(null, 'impact', 0), 30 * 60000, 'pas démarré : durée pleine');
  let t = startTimer('empathy', 1000);
  assert.ok(timerRunning(t, 'empathy'));
  assert.equal(timerLeft(t, 'empathy', 61000), 24 * 60000);
  assert.equal(timerLeft(t, 'impact', 61000), 30 * 60000, 'minuteur d\'une autre étape ignoré');
  t = pauseTimer(t, 'empathy', 61000);
  assert.deepEqual(t, { step: 'empathy', left: 24 * 60000 });
  assert.equal(timerLeft(t, 'empathy', 10 ** 9), 24 * 60000, 'en pause, le temps ne file pas');
  t = addTime(t, 'empathy', 5 * 60000, 0);
  assert.equal(t.left, 29 * 60000);
  t = resumeTimer(t, 'empathy', 100);
  assert.equal(t.endsAt, 100 + 29 * 60000);
  assert.equal(timerLeft(t, 'empathy', 10 ** 9), 0);
  assert.deepEqual(readTimer({ step: 'story', left: -1 }), null);
  assert.deepEqual(readTimer({ step: 'story', endsAt: 5, over: true, x: 1 }), { step: 'story', endsAt: 5, over: true });
  assert.equal(formatClock(25 * 60000), '25:00');
  assert.equal(formatClock(59500), '1:00');
  assert.equal(formatClock(3725000), '1:02:05');
});


test('ROTI : code lu dans la fiche de séance seulement s\'il est valide', async () => {
  const { readMeta } = await import('../site/js/session-core.js');
  assert.equal(readMeta({ title: 'A', step: 'debrief', roti: 'QVZS' }).roti, 'QVZS');
  assert.equal(readMeta({ title: 'A', step: 'debrief', roti: 'QVZI' }).roti, null, 'pas de I, L ni O');
  assert.equal(readMeta({ title: 'A', step: 'debrief' }).roti, null);
});
