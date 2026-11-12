import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newState, setStep, addNote, moveNote, moveBlocker, removeNote, notesIn, childrenOf, placesFor,
  availableExtracts, placeExtract, unplaceExtract, compareEmpathy, emptyZones,
  toggleKeep, keptDeliverables, importDeliverable, deliverablePath,
  allActions, looseActions, actionsOf, stepsWithoutDeliverable, recitTree, moveInRecit, addToRecit, BRANCH_RE, getNote, SORT_LANE,
  useJourneyExample, journeyNotes, journeyHints, simulatedNotes,
  mvpGaps, setPlacement, checkPlacement, answerSituation, situationScore, situationVerdict,
  mergeRemote, reportText, serialize, parseSaved, sanitize, encodePlace, decodePlace, nextStep, prevStep,
} from '../site/js/core.js';
import { PERSONAS, JOURNEY_EXAMPLES, SIMULATED, SITUATIONS } from '../site/js/content.js';

const BACKBONE_EXAMPLE = JOURNEY_EXAMPLES.sophie;
/** Pose le parcours type de Sophie et le valide : il devient la colonne vertébrale. */
const useBackboneExample = (s) => useJourneyExample(s, 'sophie');

/** Petit arbre d'impact : un objectif, un acteur, un impact, un livrable. */
function impactTree(goalText = '-20 % d\'autosolistes') {
  const s = newState();
  const goal = addNote(s, { b: 'goal' }, goalText);
  const actor = addNote(s, { b: 'actor', parent: goal.id }, 'Karim');
  const impact = addNote(s, { b: 'impact', parent: actor.id }, 'Trouve un trajet sans demander');
  const deliv = addNote(s, { b: 'deliverable', parent: impact.id }, 'Liste des trajets par équipe');
  return { s, goal, actor, impact, deliv };
}

test('état initial : étape « accueil », rien sur les tableaux', () => {
  const s = newState();
  assert.equal(s.step, 'welcome');
  assert.deepEqual(s.visited, ['welcome']);
  assert.equal(s.notes.length, 0);
});

test('étapes : navigation et étapes visitées', () => {
  const s = newState();
  assert.equal(setStep(s, 'impact'), true);
  assert.deepEqual(s.visited, ['welcome', 'impact']);
  assert.equal(setStep(s, 'nope'), false);
  assert.equal(nextStep('welcome'), 'frame');
  assert.equal(nextStep('frame'), 'empathy');
  assert.equal(nextStep('debrief'), 'merci');
  assert.equal(nextStep('merci'), null);
  assert.equal(prevStep('welcome'), null);
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
  assert.equal(useBackboneExample(s), BACKBONE_EXAMPLE.length, 'une deuxième fois : remplace, sans doublon');
  assert.equal(notesIn(s, { b: 'backbone' }).length, BACKBONE_EXAMPLE.length);
  assert.equal(mvpGaps(s).length, BACKBONE_EXAMPLE.length);
  const col = notesIn(s, { b: 'backbone' })[0];
  addNote(s, { b: 'story', col: col.id, lane: 'mvp' }, 'x');
  assert.equal(mvpGaps(s).length, BACKBONE_EXAMPLE.length - 1);
});

test('parcours : les étapes sont directement la colonne vertébrale ; ancien format relu', () => {
  const s = newState();
  addNote(s, { b: 'backbone' }, 'Chercher un trajet');
  const col = addNote(s, { b: 'backbone' }, 'Réserver sa place');
  assert.deepEqual(journeyNotes(s).map((n) => n.text), ['Chercher un trajet', 'Réserver sa place']);
  addNote(s, { b: 'story', col: col.id, lane: 'mvp' }, 'Demander une place');
  // Une étape enregistrée à l'ancien format (« journey ») se relit comme une étape de la colonne.
  const tree = Object.fromEntries(s.notes.map((n, i) => [n.id, noteRecord(n, i)]));
  tree[col.id].place = 'journey';
  const back = recordsToNotes(tree);
  assert.equal(back.find((n) => n.id === col.id).place.b, 'backbone');
  assert.equal(back.find((n) => n.text === 'Demander une place').place.col, col.id);
});

test('récit : une action regroupée devient une story « à trier » de son étape ; secours de l\'animateur', () => {
  const s = newState();
  const a1 = addNote(s, { b: 'action' }, 'entend parler de l\'appli', { author: 'Léa' });
  const a2 = addNote(s, { b: 'action' }, 'installe l\'appli');
  const a3 = addNote(s, { b: 'action' }, 'voit ses économies');
  const step = addNote(s, { b: 'backbone' }, 'Rejoindre le service');
  const sort = { b: 'story', col: step.id, lane: SORT_LANE };
  assert.equal(a1.act, true);
  assert.equal(moveNote(s, a2.id, sort).ok, true);
  assert.equal(moveNote(s, a1.id, sort).ok, true);
  assert.equal(moveNote(s, a1.id, { b: 'backbone' }).ok, false, 'une action ne devient pas une étape');
  assert.equal(moveNote(s, step.id, { b: 'action' }).ok, false, 'une étape ne devient pas une action');
  const story = addNote(s, { b: 'story', col: step.id, lane: 'mvp' }, 'Une story');
  assert.equal(moveNote(s, story.id, { b: 'action' }).ok, false, 'une story ajoutée sur la carte ne va pas dans le récit');
  // Regrouper ne change pas l'ordre du récit.
  assert.deepEqual(allActions(s).map((n) => n.id), [a1.id, a2.id, a3.id]);
  assert.deepEqual(actionsOf(s, step.id).map((n) => n.id), [a1.id, a2.id]);
  assert.deepEqual(notesIn(s, sort).map((n) => n.id), [a1.id, a2.id]);
  assert.equal(moveNote(s, a1.id, { b: 'story', col: step.id, lane: 'mvp' }).ok, true, 'puis elle se range dans une version');
  assert.deepEqual(actionsOf(s, step.id).map((n) => n.id), [a1.id, a2.id]);
  assert.deepEqual(looseActions(s).map((n) => n.id), [a3.id]);
  assert.deepEqual(placesFor(s, a3.id).map((p) => p.label).slice(0, 2), ['Récit : pas encore regroupée', 'Rejoindre le service · À trier']);
  const back = recordsToNotes(Object.fromEntries(s.notes.map((n, i) => [n.id, noteRecord(n, i)])));
  assert.equal(back.filter((n) => n.act).length, 3);
  // Secours : les étapes du groupe sont remplacées, les actions reviennent en vrac, les stories au bac.
  assert.equal(useJourneyExample(s, 'karim'), JOURNEY_EXAMPLES.karim.length);
  assert.deepEqual(journeyNotes(s).map((n) => n.text), JOURNEY_EXAMPLES.karim);
  assert.equal(looseActions(s).length, 3);
  assert.equal(notesIn(s, { b: 'tray', step: 'story' }).length, 1);
  assert.equal(allActions(s).length, 3);
});

test('récit en branches : parallèle, suite de branche, branches imbriquées', () => {
  const s = newState();
  const [a, b, c, d, t1, t2, z] = ['paie', 'reçoit la confirmation', 'annule', 'note', 'test 1', 'test 2', 'fin'].map((t) => addNote(s, { b: 'action' }, t));
  const shape = () => {
    const show = (items) => items.map((it) => (it.note ? it.note.text : `[${it.branches.map((br) => show(br.items).join(' > ')).join(' | ')}]`));
    return show(recitTree(s)).join(' > ');
  };
  // La flèche ∥ : « annule » en parallèle de « reçoit la confirmation ».
  assert.equal(moveInRecit(s, c.id, { after: true }), true);
  assert.equal(shape(), 'paie > [reçoit la confirmation | annule] > note > test 1 > test 2 > fin');
  const block = recitTree(s)[1];
  // Chaque branche a sa suite.
  moveInRecit(s, t1.id, { suite: block.branches[0].path });
  moveInRecit(s, t2.id, { suite: block.branches[1].path });
  assert.equal(shape(), 'paie > [reçoit la confirmation > test 1 | annule > test 2] > note > fin');
  // Lâcher sur une action qui ouvre une branche : une branche de plus dans ce bloc.
  moveInRecit(s, d.id, { onto: b.id });
  assert.equal(shape(), 'paie > [reçoit la confirmation > test 1 | annule > test 2 | note] > fin');
  // Lâcher sur une action au milieu d'une branche : un bloc dans la branche.
  moveInRecit(s, d.id, { onto: t2.id });
  assert.equal(shape(), 'paie > [reçoit la confirmation > test 1 | annule > [test 2 | note]] > fin');
  // Les chemins passent par la base et reviennent identiques.
  const back = recordsToNotes(Object.fromEntries(s.notes.map((n, i) => [n.id, noteRecord(n, i)])));
  assert.deepEqual(back.map((n) => n.br ?? ''), s.notes.map((n) => n.br ?? ''));
  assert.ok(s.notes.filter((n) => n.br).every((n) => BRANCH_RE.test(n.br)));
  // Supprimer une branche : le bloc qui n'a plus qu'une branche redevient une suite.
  removeNote(s, d.id);
  assert.equal(shape(), 'paie > [reçoit la confirmation > test 1 | annule > test 2] > fin');
  removeNote(s, c.id); removeNote(s, t2.id);
  assert.equal(shape(), 'paie > reçoit la confirmation > test 1 > fin');
  assert.ok(allActions(s).every((n) => !n.br));
  // Remettre sur la ligne principale, à un endroit précis.
  moveInRecit(s, z.id, { seq: '', beforeId: b.id });
  assert.equal(shape(), 'paie > fin > reçoit la confirmation > test 1');
  // Une nouvelle branche par « + Branche », avec la composition d'un bloc à 3 branches.
  moveInRecit(s, z.id, { after: true });
  const blk = recitTree(s)[0];
  assert.equal(blk.branches.length, 2);
  const n3 = addToRecit(s, { b: 'action' }, 'autre cas', {}, { branch: blk.block, path: '' });
  assert.equal(recitTree(s)[0].branches.length, 3);
  assert.equal(n3.act, true);
  assert.equal(a.br, blk.branches[0].path);
});

test('récit : ancien format (parallèle, action regroupée) relu', () => {
  const old = sanitize({ notes: [
    { id: 'step0001', text: 'Proposer', place: { b: 'backbone' } },
    { id: 'act00001', text: 'publie', place: { b: 'action', parent: 'step0001' } },
    { id: 'act00002', text: 'fixe son prix', place: { b: 'action' }, par: true },
    { id: 'act00003', text: 'orpheline', place: { b: 'action', parent: 'nope0001' } },
  ] });
  assert.deepEqual(old.notes.map((n) => [n.id, encodePlace(n.place), !!n.act]), [
    ['step0001', 'backbone', false], ['act00001', 'story|step0001|sort', true], ['act00002', 'action', true], ['act00003', 'action', true],
  ]);
  const tree = recitTree(old);
  assert.equal(tree.length, 2);
  assert.deepEqual(tree[0].branches.map((b) => b.items[0].note.text), ['publie', 'fixe son prix']);
  assert.ok(old.notes.every((n) => n.par === undefined));
});

test('story map : étapes sans livrable de l\'impact map', () => {
  const { s, deliv } = impactTree();
  addNote(s, { b: 'backbone' }, 'Chercher un trajet');
  addNote(s, { b: 'backbone' }, 'Faire le trajet');
  const [c1, c2] = notesIn(s, { b: 'backbone' });
  addNote(s, { b: 'story', col: c2.id, lane: 'mvp' }, 'Une story maison');
  assert.deepEqual(stepsWithoutDeliverable(s).map((c) => c.id), [c1.id, c2.id]);
  importDeliverable(s, deliv.id, { b: 'story', col: c1.id, lane: 'mvp' });
  assert.deepEqual(stepsWithoutDeliverable(s).map((c) => c.id), [c2.id]);
});

test('parcours : conseils de formulation', () => {
  const h = journeyHints(['Proposer son trajet', 'Écran de recherche', 'Se mettre d\'accord', 'Cliquer sur valider le bouton', 'Faire le trajet']);
  assert.equal(h.tooFew, false);
  assert.equal(h.tooMany, false);
  assert.deepEqual(h.notVerb, ['Écran de recherche']);
  assert.deepEqual(h.system, ['Écran de recherche', 'Cliquer sur valider le bouton']);
  assert.equal(journeyHints(['Réserver']).tooFew, true);
  assert.equal(journeyHints(Array(8).fill('Partir')).tooMany, true);
  for (const p of Object.keys(JOURNEY_EXAMPLES)) {
    const ex = journeyHints(JOURNEY_EXAMPLES[p]);
    assert.deepEqual([ex.tooFew, ex.tooMany, ex.notVerb.length, ex.system.length], [false, false, 0, 0], `parcours type ${p} exemplaire`);
  }
});

test('groupe simulé : un tableau complet et valide pour chaque persona', () => {
  for (const p of PERSONAS) {
    const notes = simulatedNotes(p.id);
    const tree = Object.fromEntries(notes.map((n, i) => [n.id, noteRecord(n, i)]));
    const back = recordsToNotes(tree);
    assert.equal(back.length, notes.length, `${p.id} : tout passe la validation`);
    assert.equal(back.filter((n) => n.place.b === 'empathy').length, p.extracts.length);
    assert.ok(back.filter((n) => n.place.b === 'deliverable' && n.keep).length >= 2);
    const s = { ...newState(), notes: back };
    assert.equal(notesIn(s, { b: 'backbone' }).length, SIMULATED[p.id].story.length);
    assert.equal(mvpGaps(s).length, 0, `${p.id} : première version de bout en bout`);
  }
});

test('débrief : rangement sur le double diamant', () => {
  const s = newState();
  setPlacement(s, 'empathy', 'discover');
  setPlacement(s, 'impact', 'deliver');
  setPlacement(s, 'story', 'deliver');
  setPlacement(s, 'designThinking', 'all');
  assert.deepEqual(checkPlacement(s), { designThinking: true, empathy: true, impact: false, story: true });
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
  const text = reportText(s, '2026-11-05');
  for (const part of ['EMPATHY MAP', 'Karim', 'Objectif : Objectif X', '[retenu]', 'STORY MAP']) {
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
  assert.equal(s.step, 'welcome');
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

import { boardUpdates, recordsToNotes, applyUpdates, noteRecord, updateNote } from '../site/js/core.js';

test('tableau partagé : seules les différences partent dans la base', () => {
  const s = newState();
  const a = addNote(s, { b: 'empathy', persona: 'sophie', zone: 'says' }, 'A');
  const b = addNote(s, { b: 'empathy', persona: 'sophie', zone: 'says' }, 'B');
  const before = structuredClone(s.notes);
  updateNote(s, a.id, 'A bis');
  let up = boardUpdates(before, s.notes);
  assert.deepEqual(Object.keys(up), [`notes/${a.id}`], 'un seul post-it modifié');
  const before2 = structuredClone(s.notes);
  removeNote(s, b.id);
  up = boardUpdates(before2, s.notes);
  assert.deepEqual(up, { [`notes/${b.id}`]: null });
  assert.deepEqual(boardUpdates(s.notes, s.notes), {}, 'rien à écrire si rien ne change');
});

test('tableau partagé : aller-retour base ↔ post-its fidèle, ordre compris', () => {
  const { s, goal, deliv } = impactTree('Objectif');
  toggleKeep(s, deliv.id);
  placeExtract(s, 's1', 'says');
  const x = addNote(s, { b: 'empathy', persona: 'sophie', zone: 'says' }, 'Avant', { author: 'Léa' });
  moveNote(s, x.id, { b: 'empathy', persona: 'sophie', zone: 'says' }, s.notes.find((n) => n.from === 'extract:s1').id);
  const tree = applyUpdates({}, boardUpdates([], s.notes));
  const back = recordsToNotes(tree);
  assert.deepEqual(back.map((n) => n.id), s.notes.map((n) => n.id));
  assert.equal(back.find((n) => n.id === deliv.id).keep, true);
  assert.equal(back.find((n) => n.id === x.id).author, 'Léa');
  assert.equal(notesIn({ notes: back }, { b: 'actor', parent: goal.id }).length, 1);
});

test('tableau partagé : deux personnes, deux post-its, aucune perte', () => {
  const s = newState();
  const z = { b: 'empathy', persona: 'karim', zone: 'pains' };
  addNote(s, z, 'Commun');
  const base = applyUpdates({}, boardUpdates([], s.notes));
  // Léa et Tom partent du même état et ajoutent chacun un post-it.
  const lea = { ...newState(), notes: recordsToNotes(base) };
  const tom = { ...newState(), notes: recordsToNotes(base) };
  const l0 = structuredClone(lea.notes); addNote(lea, z, 'De Léa');
  const t0 = structuredClone(tom.notes); addNote(tom, z, 'De Tom');
  const merged = applyUpdates(applyUpdates(base, boardUpdates(l0, lea.notes)), boardUpdates(t0, tom.notes));
  assert.deepEqual(recordsToNotes(merged).map((n) => n.text).sort(), ['Commun', 'De Léa', 'De Tom']);
});

test('tableau partagé : un enregistrement invalide est ignoré', () => {
  const notes = recordsToNotes({
    abcd0001: { text: 'ok', place: 'empathy|sophie|says', order: 0 },
    abcd0002: { text: 'zone inconnue', place: 'empathy|sophie|dreams', order: 1 },
    'pas un id': { text: 'x', place: 'goal', order: 2 },
    abcd0003: { text: '', place: 'goal', order: 3 },
  });
  assert.deepEqual(notes.map((n) => n.id), ['abcd0001']);
  assert.deepEqual(noteRecord(notes[0], 5), { text: 'ok', place: 'empathy|sophie|says', order: 5 });
});
