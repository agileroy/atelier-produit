// Post-its envoyés depuis les téléphones : logique pure (identifiants, données échangées avec Firebase).
// Testée avec Node.js (tests/session-core.test.mjs). Les règles de database.rules.json appliquent
// les mêmes contraintes côté base (branche atelierProduit).

import { STEP_IDS, PERSONA_IDS, ZONE_IDS, IMPACT_KINDS, MAX_AUTHOR, newId } from './core.js?v=__VERSION__';
import { PHONE_STEPS } from './content.js?v=__VERSION__';

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
  };
}

/** Lecture prudente d'une fiche venue de la base. */
export function readMeta(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string') return null;
  return {
    title: raw.title,
    step: STEP_IDS.includes(raw.step) ? raw.step : 'frame',
    persona: PERSONA_IDS.includes(raw.persona) ? raw.persona : PERSONA_IDS[0],
    closed: raw.closed === true,
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
