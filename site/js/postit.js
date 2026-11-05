// Page participant (téléphone) : écrire des post-its pour l'étape en cours de l'atelier.
// Pas de compte : un prénom, mémorisé dans le navigateur. Chacun ne voit que ses propres post-its.

import { firebaseConfig } from './firebase-config.js?v=__VERSION__';
import { readMeta, notePayload, flattenNotes, isSessionId, PHONE_ZONES, MAX_PHONE_TEXT } from './session-core.js?v=__VERSION__';
import { STEPS, PHONE_STEPS, EMPATHY_ZONES, IMPACT_LEVELS } from './content.js?v=__VERSION__';
import { personaById, MAX_AUTHOR } from './core.js?v=__VERSION__';
import { $, esc, load, save, toast, announce, setupTheme } from './shared.js?v=__VERSION__';

const AUTHOR_KEY = 'atelier-produit.author';
const main = $('#main');
const sid = new URLSearchParams(location.search).get('atelier');

let store = null;
let meta = null;
let mine = [];
let author = load(AUTHOR_KEY) ?? '';
let editingName = !author;
const draft = { text: '', zone: '' };
let sending = false;

const ZONE_INFO = {
  ...Object.fromEntries(EMPATHY_ZONES.map((z) => [z.id, { label: z.label, hint: z.question }])),
  ...Object.fromEntries(IMPACT_LEVELS.filter((l) => l.id !== 'goal').map((l) => [l.id, { label: l.name.replace(/s$/, ''), hint: l.question }])),
  story: { label: 'Story', hint: 'Ce que l\'utilisateur peut faire.' },
};
const HUES = { says: 205, thinks: 265, does: 150, feels: 330, pains: 6, gains: 44, actor: 205, impact: 28, deliverable: 150, story: 48 };
const PROMPTS = {
  empathy: (p) => `Qu'avez-vous compris de ${p.name} ? Une idée par post-it.`,
  impact: () => 'Un acteur, un changement de comportement ou un livrable : l\'animateur le placera dans l\'arbre.',
  story: () => 'Une story : ce qu\'un covoitureur pourrait faire avec l\'appli.',
};

function message(title, text) {
  main.innerHTML = `<section class="pcard"><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}</section>`;
}

function render() {
  if (editingName) { renderName(); return; }
  if (!meta) return;
  const step = meta.step;
  const stepInfo = STEPS.find((s) => s.id === step);
  const open = PHONE_STEPS.includes(step) && !meta.closed;
  const zones = PHONE_ZONES[step] ?? [];
  if (!zones.includes(draft.zone)) draft.zone = zones.length === 1 ? zones[0] : '';
  const persona = personaById(meta.persona);

  let body;
  if (meta.closed) {
    body = '<p class="lede">Les envois sont fermés pour le moment. Gardez cette page ouverte.</p>';
  } else if (!open) {
    body = `<p class="lede">${step === 'frame' ? 'L\'atelier n\'a pas encore commencé. Gardez cette page ouverte : elle suivra l\'écran.' : 'Pas de post-it à cette étape : suivez ce qui se passe à l\'écran.'}</p>`;
  } else {
    body = `
      ${step === 'empathy' && persona ? `<p class="pfor" style="--h:${persona.hue}"><span class="avatar avatar--sm" style="--h:${persona.hue}" aria-hidden="true">${esc(persona.name[0])}</span>Carte de <strong>${esc(persona.name)}</strong>, ${esc(persona.role.toLowerCase())}</p>` : ''}
      <p class="hint">${esc(PROMPTS[step](persona))}</p>
      <form class="pform" id="pform">
        ${zones.length > 1 ? `<fieldset class="pzones"><legend class="field-label">Où va ce post-it ?</legend>
          ${zones.map((z) => `<label class="pzone" style="--h:${HUES[z]}"><input type="radio" name="zone" value="${z}" ${draft.zone === z ? 'checked' : ''} required>
            <span><strong>${esc(ZONE_INFO[z].label)}</strong><small>${esc(ZONE_INFO[z].hint)}</small></span></label>`).join('')}
        </fieldset>` : ''}
        <label class="field-wrap"><span class="field-label">Votre post-it</span>
          <textarea class="field pnote" name="text" rows="3" maxlength="${MAX_PHONE_TEXT}" required style="--h:${HUES[draft.zone] ?? 48}">${esc(draft.text)}</textarea>
          <span class="pcount" id="pcount">${draft.text.length} / ${MAX_PHONE_TEXT}</span></label>
        <button type="submit" class="btn btn-primary btn-block" ${sending ? 'disabled' : ''}>${sending ? 'Envoi…' : 'Envoyer sur l\'écran'}</button>
      </form>`;
  }

  const recent = [...mine].reverse();
  main.innerHTML = `
    <section class="pcard">
      <p class="kicker">Étape en cours</p>
      <h1>${esc(stepInfo?.label ?? '')}</h1>
      ${body}
    </section>
    ${recent.length ? `<section class="pmine">
      <h2>Mes post-its envoyés <span class="count">${recent.length}</span></h2>
      <ul>${recent.map((n) => `<li class="pmine-item" style="--h:${HUES[n.zone] ?? 48}"><span>${esc(n.text)}</span><small>${esc(STEPS.find((s) => s.id === n.step)?.label ?? '')} · ${esc(ZONE_INFO[n.zone]?.label ?? '')}</small></li>`).join('')}</ul>
    </section>` : ''}
    <p class="pwho">Envoyé en tant que <strong>${esc(author)}</strong> · <button type="button" class="link-btn" data-rename>changer</button></p>`;
}

function renderName() {
  main.innerHTML = `<section class="pcard">
    <p class="kicker">Atelier Produit</p>
    <h1>Bienvenue !</h1>
    <p>Vos post-its apparaîtront sur l'écran de l'atelier, avec votre prénom.</p>
    <form class="pform" id="nameform">
      <label class="field-wrap"><span class="field-label">Votre prénom</span>
        <input class="field" name="author" maxlength="${MAX_AUTHOR}" autocomplete="given-name" required value="${esc(author)}"></label>
      <button type="submit" class="btn btn-primary btn-block">C'est parti</button>
    </form>
  </section>`;
  main.querySelector('input').focus();
}

main.addEventListener('input', (e) => {
  if (e.target.name === 'text') {
    draft.text = e.target.value;
    const c = $('#pcount');
    if (c) c.textContent = `${draft.text.length} / ${MAX_PHONE_TEXT}`;
  }
});

main.addEventListener('change', (e) => {
  if (e.target.name === 'zone') {
    draft.zone = e.target.value;
    $('.pnote', main)?.style.setProperty('--h', HUES[draft.zone] ?? 48);
  }
});

main.addEventListener('click', (e) => {
  if (e.target.closest('[data-rename]')) { editingName = true; render(); }
});

main.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.target.id === 'nameform') {
    const value = e.target.elements.author.value.replace(/\s+/g, ' ').trim().slice(0, MAX_AUTHOR);
    if (!value) return;
    author = value;
    save(AUTHOR_KEY, author);
    editingName = false;
    render();
    return;
  }
  if (e.target.id !== 'pform' || sending) return;
  const payload = notePayload({ author, step: meta.step, zone: draft.zone, persona: meta.persona, text: draft.text });
  if (!payload) { toast(draft.zone ? 'Écrivez quelque chose avant d\'envoyer.' : 'Choisissez où va ce post-it.'); return; }
  sending = true;
  render();
  try {
    await store.sendNote(sid, payload);
    draft.text = '';
    toast('Envoyé sur l\'écran !');
    announce('Post-it envoyé');
  } catch {
    toast('Envoi refusé : l\'étape a peut-être changé, ou les envois sont fermés.');
  }
  sending = false;
  render();
  $('.pnote', main)?.focus();
});

async function startPage() {
  setupTheme($('#theme-toggle'));
  if (!isSessionId(sid)) { message('Lien incomplet', 'Scannez à nouveau le QR code affiché à l\'écran.'); return; }
  if (!firebaseConfig) { message('Envoi non configuré', 'L\'envoi de post-its depuis les téléphones n\'est pas activé pour cet outil.'); return; }
  try {
    const { createStore } = await import('./store.js?v=__VERSION__');
    store = createStore();
    await store.start();
    const first = readMeta(await store.getMeta(sid));
    if (!first) { message('Atelier introuvable', 'Il est peut-être terminé. Demandez le lien à l\'animateur.'); return; }
    meta = first;
    render();
    store.onMeta(sid, (raw) => {
      const next = readMeta(raw);
      if (!next) { message('Atelier terminé', 'Merci pour votre participation !'); meta = null; return; }
      const changed = !meta || next.step !== meta.step || next.closed !== meta.closed || next.persona !== meta.persona;
      meta = next;
      if (changed && !main.contains(document.activeElement)) render();
      else if (changed) { const t = draft.text; render(); draft.text = t; }
    });
    store.onMyNotes(sid, (tree) => {
      mine = flattenNotes({ me: tree });
      if (!editingName && meta) {
        const focused = document.activeElement?.name === 'text';
        render();
        if (focused) $('.pnote', main)?.focus();
      }
    });
  } catch {
    message('Connexion impossible', 'Le réseau bloque peut-être la connexion (VPN de l\'entreprise ?). Essayez en 4G ou sur un autre Wi-Fi.');
  }
}

startPage();
