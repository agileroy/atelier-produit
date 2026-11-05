// Seul module qui parle à Firebase. Connexion anonyme ; les règles de sécurité
// (database.rules.json, branche atelierProduit) appliquent les mêmes contraintes côté base :
// - un participant n'écrit que ses propres post-its, une seule fois, pendant l'étape en cours ;
// - seuls les animateurs (navigateurs qui présentent la clé de la séance) lisent tous les post-its ;
// - chacun n'écrit qu'une copie de quiz, une seule fois, pendant que le quiz est ouvert.
// Chargé à la demande (import dynamique) : sans réseau ni configuration, l'atelier marche quand même.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getDatabase, ref, onValue, get, set, update, remove, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js?v=__VERSION__';
import { newId, metaFor } from './session-core.js?v=__VERSION__';

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

  /** Crée une séance ; ce navigateur en devient l'animateur. Renvoie { sid, key }. */
  async function createSession(fields) {
    const sid = newId(12);
    const key = newId(24);
    await update(ref(db, ROOT), {
      [`keys/${sid}`]: key,
      [`sessions/${sid}/meta`]: { ...metaFor(fields), createdAt: serverTimestamp() },
      [`sessions/${sid}/owners/${uid}`]: key,
    });
    return { sid, key };
  }

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

  /** Supprime la séance, ses post-its et sa clé. */
  const deleteSession = (sid) => update(ref(db, ROOT), { [`keys/${sid}`]: null, [`sessions/${sid}`]: null });

  // ---- Côté participant
  const sendNote = (sid, payload) => set(at(`sessions/${sid}/notes/${uid}/${newId(12)}`), { ...payload, createdAt: serverTimestamp() });
  const onMyNotes = (sid, cb, onError) => onValue(at(`sessions/${sid}/notes/${uid}`), (s) => cb(s.val() ?? {}), onError);

  return {
    start, createSession, claimOwner, getMeta, onMeta, setStep, setClosed, onNotes, deleteSession,
    sendNote, onMyNotes, setQuiz, onQuiz, clearQuiz, submitQuiz, onMyQuiz,
    get uid() { return uid; },
  };
}
