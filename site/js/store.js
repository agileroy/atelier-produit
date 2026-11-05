// Seul module qui parle à Firebase. Connexion anonyme ; les règles de sécurité
// (database.rules.json, branche atelierProduit) appliquent les mêmes contraintes côté base :
// - un participant n'écrit que ses propres post-its, une seule fois, pendant l'étape en cours ;
// - seuls les animateurs (navigateurs qui présentent la clé de la séance) lisent tous les post-its ;
// - chacun n'écrit qu'une copie de quiz, une seule fois, pendant que le quiz est ouvert.
// Chargé à la demande (import dynamique) : sans réseau ni configuration, l'atelier marche quand même.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getDatabase, ref, onValue, get, set, update, remove, serverTimestamp, onDisconnect,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js?v=__VERSION__';
import { newId, newCode, metaFor, DEFAULT_PERSONAS } from './session-core.js?v=__VERSION__';

/** Branche de la base réservée à cet outil. */
const ROOT = 'atelierProduit';

export function createStore() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const at = (path) => ref(db, `${ROOT}/${path}`);
  let uid = null;

  /** Connexion : reprend la session anonyme du navigateur, sinon en ouvre une. Échoue après 12 s. */
  function start() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 12000);
      const stop = onAuthStateChanged(auth, (user) => {
        if (user) {
          clearTimeout(timer);
          stop();
          uid = user.uid;
          resolve(uid);
        } else {
          signInAnonymously(auth).catch((e) => { clearTimeout(timer); reject(e); });
        }
      }, reject);
    });
  }

  /**
   * Crée une séance et réserve son code court ; ce navigateur en devient l'animateur.
   * Renvoie { sid, key, code }. Un code déjà pris est refusé par la base : on en tire un autre.
   */
  async function createSession(fields) {
    for (let attempt = 0; ; attempt++) {
      const sid = newId(12);
      const key = newId(24);
      const code = newCode();
      try {
        await update(ref(db, ROOT), {
          [`keys/${sid}`]: key,
          [`sessions/${sid}/meta`]: { ...metaFor({ ...fields, code }), createdAt: serverTimestamp() },
          [`sessions/${sid}/owners/${uid}`]: key,
          [`codes/${code}`]: sid,
          [`sessions/${sid}/boards/g1/state/persona`]: DEFAULT_PERSONAS.g1,
          [`sessions/${sid}/boards/g2/state/persona`]: DEFAULT_PERSONAS.g2,
        });
        return { sid, key, code };
      } catch (e) {
        if (attempt >= 4) throw e;
      }
    }
  }

  /** Donne un code court à une séance qui n'en a pas (ouverte avant leur arrivée). */
  async function assignCode(sid) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      try {
        await update(ref(db, ROOT), { [`codes/${code}`]: sid, [`sessions/${sid}/meta/code`]: code });
        return code;
      } catch { /* code déjà pris : on en tire un autre */ }
    }
    return null;
  }

  /** Séance correspondant à un code court, ou null. */
  const resolveCode = (code) => get(at(`codes/${code}`)).then((s) => s.val()).catch(() => null);

  /** Rejoint une séance comme animateur avec sa clé (sans effet si c'est déjà le cas). */
  const claimOwner = (sid, key) => set(at(`sessions/${sid}/owners/${uid}`), key);

  const getMeta = (sid) => get(at(`sessions/${sid}/meta`)).then((s) => s.val());
  const onMeta = (sid, cb, onError) => onValue(at(`sessions/${sid}/meta`), (s) => cb(s.val()), onError);
  const setStep = (sid, step, persona) => update(at(`sessions/${sid}/meta`), { step, persona });
  const setClosed = (sid, closed) => set(at(`sessions/${sid}/meta/closed`), closed);

  /** Tous les post-its de la séance (animateur seulement) : arbre notes/{uid}/{noteId}. */
  const onNotes = (sid, cb, onError) => onValue(at(`sessions/${sid}/notes`), (s) => cb(s.val() ?? {}), onError);

  // ---- Quiz individuel
  const setQuiz = (sid, quiz) => set(at(`sessions/${sid}/meta/quiz`), quiz);
  /** Toutes les copies (animateur seulement) : arbre quiz/{uid}. */
  const onQuiz = (sid, cb, onError) => onValue(at(`sessions/${sid}/quiz`), (s) => cb(s.val() ?? {}), onError);
  const clearQuiz = (sid) => remove(at(`sessions/${sid}/quiz`));
  const submitQuiz = (sid, payload) => set(at(`sessions/${sid}/quiz/${uid}`), { ...payload, submittedAt: serverTimestamp() });
  const onMyQuiz = (sid, cb, onError) => onValue(at(`sessions/${sid}/quiz/${uid}`), (s) => cb(s.val()), onError);

  /** Supprime la séance, ses post-its, sa clé et son code. */
  const deleteSession = (sid, code) => update(ref(db, ROOT), {
    [`keys/${sid}`]: null, [`sessions/${sid}`]: null, ...(code ? { [`codes/${code}`]: null } : {}),
  });

  // ---- Groupes et tableaux partagés
  const setMeta = (sid, fields) => update(at(`sessions/${sid}/meta`), fields);
  /** Affectations (animateur seulement) : arbre members/{uid}/group. */
  const onMembers = (sid, cb, onError) => onValue(at(`sessions/${sid}/members`), (s) => cb(s.val() ?? {}), onError);
  /** Affecte des personnes à des groupes : { uid: 'g1' | 'g2' }. */
  const setMembers = (sid, map) => update(at(`sessions/${sid}/members`), Object.fromEntries(Object.entries(map).map(([u, g]) => [u, { group: g }])));
  const onMyMember = (sid, cb, onError) => onValue(at(`sessions/${sid}/members/${uid}`), (s) => cb(s.val()?.group ?? null), onError);
  /** Tableau d'un groupe : post-its et réglages ({ notes, state }). */
  const onBoard = (sid, g, cb, onError) => onValue(at(`sessions/${sid}/boards/${g}`), (s) => cb(s.val() ?? {}), onError);
  /** Écrit les différences d'un tableau ({ 'notes/{id}': enregistrement | null }). */
  const writeBoard = (sid, g, updates) => update(at(`sessions/${sid}/boards/${g}`), updates);
  const setBoardState = (sid, g, key, value) => set(at(`sessions/${sid}/boards/${g}/state/${key}`), value);
  /** Livrables étoilés, communs aux groupes (écrits par l'animateur) : { id: { text, group, order } }. */
  const setKept = (sid, map) => set(at(`sessions/${sid}/kept`), map);
  const onKept = (sid, cb, onError) => onValue(at(`sessions/${sid}/kept`), (s) => cb(s.val() ?? {}), onError);

  /** Présents (animateur seulement). */
  const onPresence = (sid, cb, onError) => onValue(at(`sessions/${sid}/presence`), (s) => cb(s.val() ?? {}), onError);

  // ---- Salle, côté participant
  /** Réserve un prénom dans la salle ; refusé (exception) s'il appartient déjà à quelqu'un d'autre. */
  async function claimName(sid, key) {
    const current = await get(at(`sessions/${sid}/names/${key}`)).then((s) => s.val()).catch(() => null);
    if (current === uid) return;
    await set(at(`sessions/${sid}/names/${key}`), uid);
  }
  const releaseName = (sid, key) => remove(at(`sessions/${sid}/names/${key}`)).catch(() => {});

  /**
   * Se déclarer présent : la ligne est retirée par la base à la déconnexion, et réécrite à chaque reconnexion.
   * Renvoie une fonction pour quitter.
   */
  function goOnline(sid, author) {
    const mine = at(`sessions/${sid}/presence/${uid}`);
    const stop = onValue(ref(db, '.info/connected'), (snap) => {
      if (snap.val() !== true) return;
      onDisconnect(mine).remove().then(() => set(mine, { author, at: serverTimestamp() })).catch(() => {});
    });
    return () => { stop(); remove(mine).catch(() => {}); };
  }

  // ---- Côté participant
  const sendNote = (sid, payload) => set(at(`sessions/${sid}/notes/${uid}/${newId(12)}`), { ...payload, createdAt: serverTimestamp() });
  const onMyNotes = (sid, cb, onError) => onValue(at(`sessions/${sid}/notes/${uid}`), (s) => cb(s.val() ?? {}), onError);

  return {
    start, createSession, claimOwner, getMeta, onMeta, setStep, setClosed, onNotes, deleteSession,
    sendNote, onMyNotes, setQuiz, onQuiz, clearQuiz, submitQuiz, onMyQuiz,
    resolveCode, assignCode, onPresence, claimName, releaseName, goOnline,
    setMeta, onMembers, setMembers, onMyMember, onBoard, writeBoard, setBoardState, setKept, onKept,
    get uid() { return uid; },
  };
}
