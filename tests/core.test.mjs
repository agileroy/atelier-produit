import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newState, setStep, addNote, moveNote, moveBlocker, removeNote, notesIn, childrenOf, placesFor,
  availableExtracts, placeExtract, unplaceExtract, compareEmpathy, emptyZones,
  toggleKeep, keptDeliverables, importDeliverable, deliverablePath,
  useBackboneExample, mvpGaps, setPlacement, checkPlacement, answerSituation, situationScore, situationVerdict,
  mergeRemote, reportText, serialize, parseSaved, encodePlace, decodePlace, nextStep, prevStep,
} from '../site/js/core.js';
import { PERSONAS, BACKBONE_EXAMPLE, SITUATIONS } from '../site/js/content.js';

/** Petit arbre d'impact : un objectif, un acteur, un impact, un livrable. */
function impactTree(goalText = '-20 % d\'autosolistes') {
  const s = newState();
  const goal = addNote(s, { b: 'goal' }, goalText);
  const actor = addNote(s, { b: 'actor', parent: goal.id }, 'Karim');
  const impact = addNote(s, { b: 'impact', parent: actor.id }, 'Trouve un trajet sans demander');
  const deliv = addNote(s, { b: 'deliverable', parent: impact.id }, 'Liste des trajets par équipe');
  return { s, goal, actor, impact, deliv };
}

test('état initial : étape « cadre », rien sur les tableaux', () => {
  const s = newState();
  assert.equal(s.step, 'frame');
  assert.deepEqual(s.visited, ['frame']);
  assert.equal(s.notes.length, 0);
});

test('étapes : navigation et étapes visitées', () => {
  const s = newState();
  assert.equal(setStep(s, 'impact'), true);
  assert.deepEqual(s.visited, ['frame', 'impact']);
  assert.equal(setStep(s, 'nope'), false);
  assert.equal(nextStep('frame'), 'empathy');
  assert.equal(nextStep('debrief'), null);
  assert.equal(prevStep('frame'), null);
});

test('emplacements : encodage réversible', () => {
  for (const p of [
    { b: 'empathy', persona: 'karim', zone: 'pains' }, { b: 'tray', step: 'story' }, { b: 'goal' }, { b: 'actor', parent: 'abcd1234' },
    { b: 'impact', parent: 'abcd1234' }, { b: 'deliverable', parent: 'abcd1234' }, { b: 'backbone' },
    { b: 'story', col: 'abcd1234', lane: 'mvp' },
  ]) assert.deepEqual(decodePlace(encodePlace(p)), p);
  assert.equal(decodePlace('n\'importe quoi'), null);
});

test('post-its : texte nettoyé, vide refusé, emplacement inexistant refusé', () => {
  const s = newState();
  const n = addNote(s, { b: 'empathy', persona: 'sophie', zone: 'says' }, '  Bonjour   tout  le monde ');
  assert.equal(n.text, 'Bonjour tout le monde');
  assert.equal(addNote(s, { b: 'empathy', persona: 'sophie', zone: 'says' }, '   '), null);
  assert.equal(addNote(s, { b: 'impact', parent: 'inconnu1' }, 'x'), null);
  assert.equal(addNote(s, { b: 'empathy', persona: 'bob', zone: 'says' }, 'x'), null);
});

test('déplacement : ordre conservé et insertion avant un post-it', () => {
  const s = newState();
  const zone = { b: 'empathy', persona: 'sophie', zone: 'does' };
  const a = addNote(s, zone, 'A');
  const b = addNote(s, zone, 'B');
  const c = addNote(s, { b: 'empathy', persona: 'sophie', zone: 'says' }, 'C');
  assert.equal(moveNote(s, c.id, zone, a.id).ok, true);
  assert.deepEqual(notesIn(s, zone).map((n) => n.text), ['C', 'A', 'B']);
  moveNote(s, c.id, zone);
  assert.deepEqual(notesIn(s, zone).map((n) => n.text), ['A', 'B', 'C']);
});

test('déplacement : jamais d\'une étape à l\'autre', () => {
  const s = newState();
  const n = addNote(s, { b: 'empathy', persona: 'sophie', zone: 'says' }, 'x');
  assert.equal(moveBlocker(s, n.id, { b: 'goal' }), 'family');
  assert.equal(moveNote(s, n.id, { b: 'backbone' }).ok, false);
});

test('impact map : un nœud qui a des enfants ne change pas de niveau', () => {
  const { s, goal, actor, impact, deliv } = impactTree();
  assert.equal(moveBlocker(s, actor.id, { b: 'tray', step: 'impact' }), 'children');
  assert.equal(moveBlocker(s, impact.id, { b: 'actor', parent: goal.id }), 'children');
  assert.equal(moveBlocker(s, goal.id, { b: 'tray', step: 'impact' }), 'children');
  assert.equal(moveBlocker(s, deliv.id, { b: 'actor', parent: goal.id }), null, 'un livrable seul peut devenir acteur');
  const other = addNote(s, { b: 'actor', parent: goal.id }, 'Sophie');
  assert.equal(moveNote(s, impact.id, { b: 'impact', parent: other.id }).ok, true, 'changer de parent est permis');
  assert.equal(childrenOf(s, other.id).length, 1);
});

test('impact map : supprimer un acteur emporte ses impacts et ses livrables', () => {
  const { s, actor } = impactTree();
  assert.equal(removeNote(s, actor.id), 3);
  assert.equal(s.notes.length, 1, 'l\'objectif reste');
});

test('impact map : plusieurs objectifs, chacun son arbre', () => {
  const { s, goal } = impactTree('Objectif A');
  const g2 = addNote(s, { b: 'goal' }, 'Objectif B');
  const a2 = addNote(s, { b: 'actor', parent: g2.id }, 'RH');
  assert.equal(notesIn(s, { b: 'goal' }).length, 2);
  assert.equal(notesIn(s, { b: 'actor', parent: g2.id })[0].id, a2.id);
  assert.equal(removeNote(s, goal.id), 4, 'un objectif emporte tout son arbre');
  assert.equal(addNote(s, { b: 'actor', parent: 'inconnu1' }, 'x'), null, 'pas d\'acteur sans objectif');
  const text = reportText(s);
  assert.ok(text.includes('Objectif : Objectif B') && text.includes('- RH'));
});

test('story map : supprimer une étape renvoie ses stories dans le bac', () => {
  const s = newState();
  useBackboneExample(s);
  const col = notesIn(s, { b: 'backbone' })[0];
  addNote(s, { b: 'story', col: col.id, lane: 'mvp' }, 'S\'inscrire avec son badge');
  assert.equal(removeNote(s, col.id), 1);
  assert.deepEqual(notesIn(s, { b: 'tray', step: 'story' }).map((n) => n.text), ['S\'inscrire avec son badge']);
});

test('menu « déplacer vers » : seulement les emplacements de la même étape', () => {
  const { s, deliv } = impactTree();
  const places = placesFor(s, deliv.id).map((p) => p.place.b);
  assert.ok(places.includes('deliverable'));
  assert.ok(places.every((b) => ['tray', 'goal', 'actor', 'impact', 'deliverable'].includes(b)));
});

test('empathy map : un extrait posé quitte la pioche, et y revient', () => {
  const s = newState();
  const total = PERSONAS[0].extracts.length;
  const note = placeExtract(s, 's1', 'thinks');
  assert.equal(availableExtracts(s, 'sophie').length, total - 1);
  placeExtract(s, 's1', 'says');
  assert.equal(s.notes.length, 1, 'reposer un extrait le déplace');
  assert.equal(note.place.zone, 'says');
  assert.equal(unplaceExtract(s, note.id), true);
  assert.equal(availableExtracts(s, 'sophie').length, total);
});

test('empathy map : comparaison avec la proposition et zones vides', () => {
  const s = newState();
  placeExtract(s, 's1', 'says');
  placeExtract(s, 's5', 'feels');
  const c = compareEmpathy(s, 'sophie');
  assert.equal(c.placed, 2);
  assert.equal(c.matching, 1);
  assert.equal(c.items.find((i) => !i.ok).expected, 'pains');
  assert.deepEqual(emptyZones(s, 'sophie'), ['thinks', 'does', 'pains', 'gains']);
  assert.equal(emptyZones(s, 'karim').length, 6);
});

test('impact → story : les livrables retenus s\'importent une seule fois', () => {
  const { s, deliv } = impactTree();
  assert.equal(keptDeliverables(s).length, 0);
  toggleKeep(s, deliv.id);
  assert.equal(keptDeliverables(s)[0].imported, false);
  useBackboneExample(s);
  const col = notesIn(s, { b: 'backbone' })[1];
  const copy = importDeliverable(s, deliv.id, { b: 'story', col: col.id, lane: 'mvp' });
  assert.equal(copy.text, deliv.text);
  assert.equal(keptDeliverables(s)[0].imported, true);
  importDeliverable(s, deliv.id, { b: 'story', col: col.id, lane: 'r2' });
  assert.equal(s.notes.filter((n) => n.from === `deliverable:${deliv.id}`).length, 1);
  assert.deepEqual(deliverablePath(s, deliv.id), ['-20 % d\'autosolistes', 'Karim', 'Trouve un trajet sans demander', 'Liste des trajets par équipe']);
});

test('story map : colonne vertébrale d\'exemple, première version trouée', () => {
  const s = newState();
  assert.equal(useBackboneExample(s), BACKBONE_EXAMPLE.length);
  assert.equal(useBackboneExample(s), 0, 'pas deux fois');
  assert.equal(mvpGaps(s).length, BACKBONE_EXAMPLE.length);
  const col = notesIn(s, { b: 'backbone' })[0];
  addNote(s, { b: 'story', col: col.id, lane: 'mvp' }, 'x');
  assert.equal(mvpGaps(s).length, BACKBONE_EXAMPLE.length - 1);
});

test('débrief : rangement sur le double diamant', () => {
  const s = newState();
  setPlacement(s, 'empathy', 'discover');
  setPlacement(s, 'impact', 'deliver');
  setPlacement(s, 'story', 'deliver');
  assert.deepEqual(checkPlacement(s), { empathy: true, impact: false, story: true });
  setPlacement(s, 'story', null);
  assert.equal(checkPlacement(s).story, null);
  assert.equal(setPlacement(s, 'story', 'mars'), false);
});

test('débrief : situations', () => {
  const s = newState();
  answerSituation(s, SITUATIONS[0].id, SITUATIONS[0].answer);
  answerSituation(s, SITUATIONS[1].id, 'designThinking');
  assert.equal(answerSituation(s, 'inconnue', 'story'), false);
  assert.deepEqual(situationScore(s), { answered: 2, correct: 1, defensible: 0, points: 1, total: SITUATIONS.length });
  answerSituation(s, 'adoption', 'designThinking'); // défendable
  assert.deepEqual(situationScore(s), { answered: 2, correct: 0, defensible: 1, points: 0.5, total: SITUATIONS.length });
  const v = situationVerdict(SITUATIONS[0], 'story');
  assert.equal(v.level, 'wrong');
  assert.ok(v.text.length > 20, 'une explication propre au mauvais choix');
});

test('téléphones : chaque post-it n\'est ajouté qu\'une fois, au bon endroit', () => {
  const s = newState();
  s.persona = 'karim';
  const remote = [
    { rid: 'aaaaaaaaaaaa', author: 'Léa', step: 'empathy', zone: 'pains', persona: 'sophie', text: 'Peur des détours' },
    { rid: 'bbbbbbbbbbbb', author: 'Tom', step: 'impact', zone: 'actor', persona: '', text: 'Les RH' },
    { rid: 'cccccccccccc', author: 'Tom', step: 'story', zone: 'story', persona: '', text: 'Voir les trajets' },
  ];
  assert.equal(mergeRemote(s, remote).length, 3);
  assert.equal(mergeRemote(s, remote).length, 0);
  assert.equal(notesIn(s, { b: 'empathy', persona: 'sophie', zone: 'pains' })[0].author, 'Léa');
  assert.equal(notesIn(s, { b: 'tray', step: 'impact' })[0].kind, 'actor');
  assert.equal(notesIn(s, { b: 'tray', step: 'story' }).length, 1);
});

test('compte rendu : contient les trois tableaux et le débrief', () => {
  const { s, deliv } = impactTree('Objectif X');
  toggleKeep(s, deliv.id);
  placeExtract(s, 'k1', 'says');
  s.debrief.takeaways = 'On refera une empathy map au prochain sujet.';
  const text = reportText(s, '2026-11-05');
  for (const part of ['EMPATHY MAP', 'Karim', 'Objectif : Objectif X', '[retenu]', 'STORY MAP', 'On refera']) {
    assert.ok(text.includes(part), part);
  }
});

test('fichier : aller-retour fidèle, fichier étranger refusé', () => {
  const { s, deliv } = impactTree();
  toggleKeep(s, deliv.id);
  placeExtract(s, 's3', 'does');
  setStep(s, 'story');
  setPlacement(s, 'empathy', 'discover');
  s.session = { sid: 'x', key: 'y' };
  const file = JSON.parse(JSON.stringify(serialize(s)));
  assert.equal(file.state.session, undefined, 'la clé de séance ne part pas dans le fichier');
  const back = parseSaved(file);
  assert.deepEqual(back.notes, s.notes);
  assert.equal(back.step, 'story');
  assert.equal(back.debrief.placement.empathy, 'discover');
  assert.throws(() => parseSaved({ app: 'moving-motivators', state: {} }));
});

test('fichier abîmé : orphelins rangés dans le bac, doublons et intrus écartés', () => {
  const file = {
    app: 'atelier-produit',
    state: {
      step: 'mars',
      notes: [
        { id: 'abcd0001', text: 'Impact orphelin', place: { b: 'impact', parent: 'zzzz9999' } },
        { id: 'abcd0002', text: 'Story orpheline', place: { b: 'story', col: 'zzzz9999', lane: 'mvp' } },
        { id: 'abcd0003', text: 'Extrait', place: { b: 'empathy', persona: 'sophie', zone: 'says' }, from: 'extract:s1' },
        { id: 'abcd0004', text: 'Extrait bis', place: { b: 'empathy', persona: 'sophie', zone: 'feels' }, from: 'extract:s1' },
        { id: 'abcd0005', text: 'Zone inconnue', place: { b: 'empathy', persona: 'sophie', zone: 'dreams' } },
        { id: 'BAD ID', text: 'x', place: { b: 'goal' } },
        { id: 'abcd0006', text: '<img src=x onerror=alert(1)>', place: { b: 'goal' } },
      ],
    },
  };
  const s = parseSaved(file);
  assert.equal(s.step, 'frame');
  assert.deepEqual(s.notes.map((n) => [n.id, n.place.b]), [
    ['abcd0001', 'tray'], ['abcd0002', 'tray'], ['abcd0003', 'empathy'], ['abcd0006', 'goal'],
  ]);
});

test('ancien atelier (un seul objectif) : l\'objectif devient un post-it et garde ses acteurs', () => {
  const s = parseSaved({
    app: 'atelier-produit',
    state: {
      goal: 'Réduire les autosolistes',
      notes: [
        { id: 'abcd0001', text: 'Karim', place: { b: 'actor' } },
        { id: 'abcd0002', text: 'Trouve un trajet', place: { b: 'impact', parent: 'abcd0001' } },
      ],
    },
  });
  const goals = notesIn(s, { b: 'goal' });
  assert.equal(goals.length, 1);
  assert.equal(goals[0].text, 'Réduire les autosolistes');
  assert.equal(notesIn(s, { b: 'actor', parent: goals[0].id })[0].text, 'Karim');
  assert.equal(notesIn(s, { b: 'impact', parent: 'abcd0001' }).length, 1);
});
