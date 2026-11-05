import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSONAS, EMPATHY_ZONES, TOOLS, TOOL_PHASES, PHASES, SITUATIONS, SITUATION_CHOICES, BRIEFS, STEPS, STEP_PHASES, PHONE_STEPS,
} from '../site/js/content.js';

const zoneIds = EMPATHY_ZONES.map((z) => z.id);

test('extraits d\'interview : identifiants uniques, zone suggérée connue', () => {
  const ids = new Set();
  for (const p of PERSONAS) {
    assert.match(p.id, /^[a-z]+$/);
    for (const e of p.extracts) {
      assert.ok(!ids.has(e.id), `doublon ${e.id}`);
      ids.add(e.id);
      assert.match(e.id, /^[a-z0-9]+$/);
      assert.ok(zoneIds.includes(e.zone), `${e.id} : ${e.zone}`);
    }
  }
});

test('chaque persona a au moins un extrait par zone', () => {
  for (const p of PERSONAS) {
    for (const z of zoneIds) assert.ok(p.extracts.some((e) => e.zone === z), `${p.id} : ${z}`);
  }
});

test('fiches-outil complètes', () => {
  for (const [id, t] of Object.entries(TOOLS)) {
    for (const field of ['name', 'oneLine', 'origin', 'why']) assert.ok(t[field], `${id}.${field}`);
    assert.equal(t.how.length, 4, `${id}.how`);
    assert.ok(t.when.length >= 2 && t.pitfalls.length >= 2, id);
  }
});

test('double diamant : chaque outil se range sur des phases connues', () => {
  const phaseIds = PHASES.map((p) => p.id);
  for (const [tool, phases] of Object.entries(TOOL_PHASES)) {
    assert.ok(TOOLS[tool], tool);
    for (const p of phases) assert.ok(phaseIds.includes(p), `${tool} : ${p}`);
  }
  for (const s of STEPS) assert.ok(Array.isArray(STEP_PHASES[s.id]), s.id);
});

test('situations : réponses possibles, chaque choix sert au moins une fois', () => {
  for (const s of SITUATIONS) {
    assert.ok(SITUATION_CHOICES.includes(s.answer), s.id);
    assert.ok(s.text && s.why, s.id);
  }
  for (const c of SITUATION_CHOICES) assert.ok(SITUATIONS.some((s) => s.answer === c), c);
});

test('chaque étape de travail a sa consigne', () => {
  for (const step of [...PHONE_STEPS, 'debrief']) assert.ok(BRIEFS[step]?.steps.length, step);
});
