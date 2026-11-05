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
  assert.deepEqual(metaFor({ title: '  Atelier  ', step: 'impact', persona: 'karim' }), { title: 'Atelier', step: 'impact', persona: 'karim', closed: false });
  assert.deepEqual(metaFor({ step: 'lune', persona: 'bob' }), { title: 'Atelier Produit', step: 'frame', persona: 'sophie', closed: false });
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
  assert.equal(participantUrl('https://agileroy.github.io/atelier-produit/', 'abcabcabcabc'), 'https://agileroy.github.io/atelier-produit/postit.html?atelier=abcabcabcabc');
  assert.equal(participantUrl('https://agileroy.github.io/atelier-produit/index.html?x=1', 'abcabcabcabc'), 'https://agileroy.github.io/atelier-produit/postit.html?atelier=abcabcabcabc');
});
