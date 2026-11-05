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
