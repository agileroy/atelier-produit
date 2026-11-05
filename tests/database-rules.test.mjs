import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { metaFor, notePayload, PHONE_ZONES } from '../site/js/session-core.js';
import { STEP_IDS, PERSONA_IDS } from '../site/js/core.js';
import { PHONE_STEPS } from '../site/js/content.js';

const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
const branch = rules.atelierProduit;
const session = branch.sessions.$sid;
const note = session.notes.$uid.$nid;

test('projet dédié : le fichier ne contient que la branche atelierProduit, tout le reste est fermé', () => {
  assert.ok(branch);
  assert.deepEqual(Object.keys(rules).sort(), ['.read', '.write', 'atelierProduit']);
  assert.equal(rules['.read'], false);
  assert.equal(rules['.write'], false);
});

test('rien n\'est lisible en bloc : ni les clés, ni la liste des séances', () => {
  assert.equal(branch['.read'], undefined);
  assert.equal(branch.keys.$sid['.read'], undefined);
  assert.equal(branch.sessions['.read'], undefined);
  assert.equal(session['.read'], undefined);
});

test('un participant ne lit que ses post-its ; l\'animateur les lit tous', () => {
  assert.match(session.notes['.read'], /owners'\)\.child\(auth\.uid\)\.exists\(\)/);
  assert.equal(session.notes.$uid['.read'], 'auth != null && auth.uid === $uid');
});

test('un post-it s\'écrit une fois, par son auteur, pendant l\'étape en cours d\'une séance ouverte', () => {
  assert.match(note['.write'], /auth\.uid === \$uid/);
  assert.match(note['.write'], /!data\.exists\(\)/, 'pas de modification après envoi');
  assert.match(note['.write'], /meta\/closed'\)\.val\(\) === false/);
  assert.match(note['.write'], /meta\/step'\)\.val\(\) === newData\.child\('step'\)\.val\(\)/);
});

test('devenir animateur exige la clé de la séance', () => {
  assert.equal(session.owners.$uid['.write'], 'auth != null && auth.uid === $uid && newData.exists()');
  assert.match(session.owners.$uid['.validate'], /child\('keys'\)\.child\(\$sid\)\.val\(\)/);
});

test('chaque champ écrit par l\'application a sa règle de validation', () => {
  for (const field of Object.keys(metaFor({}))) assert.ok(session.meta[field]?.['.validate'], `meta/${field}`);
  for (const field of Object.keys(notePayload({ author: 'a', step: 'story', zone: 'story', text: 'x' }))) assert.ok(note[field]?.['.validate'], `notes/${field}`);
  assert.ok(note.createdAt['.validate']);
  assert.equal(note.$other['.validate'], false);
  assert.equal(session.meta.$other['.validate'], false);
});

test('les listes de valeurs des règles sont celles de l\'outil', () => {
  for (const s of STEP_IDS) assert.ok(session.meta.step['.validate'].includes(s), `meta/step : ${s}`);
  for (const p of PERSONA_IDS) {
    assert.ok(session.meta.persona['.validate'].includes(p), `meta/persona : ${p}`);
    assert.ok(note.persona['.validate'].includes(p), `notes/persona : ${p}`);
  }
  for (const step of PHONE_STEPS) {
    assert.ok(note.step['.validate'].includes(step), `notes/step : ${step}`);
    for (const zone of PHONE_ZONES[step]) assert.ok(note.zone['.validate'].includes(zone), `notes/zone : ${zone}`);
  }
});

test('quiz : chacun écrit sa copie une seule fois, pendant que le quiz est ouvert', () => {
  const quiz = session.quiz;
  assert.match(quiz['.read'], /owners'\)\.child\(auth\.uid\)\.exists\(\)/, 'l\'animateur lit toutes les copies');
  assert.equal(quiz.$uid['.read'], 'auth != null && auth.uid === $uid', 'un participant ne lit que la sienne');
  assert.match(quiz.$uid['.write'], /auth\.uid === \$uid && !data\.exists\(\)/);
  assert.match(quiz.$uid['.write'], /meta\/quiz'\)\.val\(\) === 'open'/);
  assert.match(quiz['.write'], /!newData\.exists\(\)/, 'l\'animateur peut seulement effacer les copies');
});

test('quiz : les valeurs acceptées par la base sont celles de l\'outil', async () => {
  const { SITUATIONS, SITUATION_CHOICES, PLACES, TOOL_PHASES } = await import('../site/js/content.js');
  const { QUIZ_STATES } = await import('../site/js/session-core.js');
  const c = session.quiz.$uid;
  for (const s of SITUATIONS) {
    assert.ok(c.answers[s.id], `réponse ${s.id}`);
    for (const ch of SITUATION_CHOICES) assert.ok(c.answers[s.id]['.validate'].includes(ch), `${s.id} : ${ch}`);
  }
  for (const t of Object.keys(TOOL_PHASES)) for (const p of PLACES) assert.ok(c.placement[t]['.validate'].includes(p.id), `${t} : ${p.id}`);
  for (const q of QUIZ_STATES) assert.ok(session.meta.quiz['.validate'].includes(q), q);
  assert.equal(c.$other['.validate'], false);
  assert.ok(c.submittedAt['.validate'].includes('now'));
});

test('salle : un code ne se réserve qu\'une fois et pointe vers la séance qui le porte', () => {
  const code = branch.codes.$code;
  assert.equal(code['.read'], 'auth != null', 'on lit un code précis…');
  assert.equal(branch.codes['.read'], undefined, '…mais pas la liste des codes');
  assert.match(code['.write'], /!data\.exists\(\) && newData\.exists\(\)/);
  assert.match(code['.validate'], /child\('meta'\)\.child\('code'\)\.val\(\) === \$code/);
  assert.match(session.meta.code['.validate'], /newData\.val\(\) === data\.val\(\)/, 'le code d\'une séance ne change pas');
});

test('salle : un prénom réservé appartient à celui qui l\'a pris', () => {
  const n = session.names.$key;
  assert.equal(n['.write'], 'auth != null && (!data.exists() || data.val() === auth.uid)', 'libre, ou déjà à soi (rechargement, libération)');
  assert.match(n['.validate'], /newData\.val\(\) === auth\.uid/, 'on ne réserve que pour soi');
});

test('salle : chacun écrit sa présence, seul l\'animateur voit la liste', () => {
  const pr = session.presence;
  assert.match(pr['.read'], /owners'\)\.child\(auth\.uid\)\.exists\(\)/);
  assert.equal(pr.$uid['.write'], 'auth != null && auth.uid === $uid');
  assert.equal(pr.$uid.$other['.validate'], false);
});
