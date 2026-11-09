// ROTI de fin d'atelier : on crée une salle dans l'outil ROTI (https://agileroy.github.io/roti/),
// avec son propre module et sa propre base. Les deux outils sont servis par le même site : le
// navigateur de l'animateur devient l'animateur de la salle ROTI (vue « ?animer=CODE ») et la
// retrouve dans « Mes ROTI ». L'atelier ne garde que le code, pour l'afficher aux participants.

export const ROTI_URL = 'https://agileroy.github.io/roti/';
export const rotiJoinUrl = (code) => `${ROTI_URL}?salle=${encodeURIComponent(code)}`;
export const rotiHostUrl = (code) => `${ROTI_URL}?animer=${encodeURIComponent(code)}`;
/** Même règle que l'outil ROTI : 4 lettres, sans I, L ni O. */
export const isRotiCode = (code) => typeof code === 'string' && /^[A-HJKMNP-Z]{4}$/.test(code);

let storePromise = null;

/** Le module du ROTI, chargé une seule fois (son application Firebase est celle du ROTI). */
function rotiStore() {
  storePromise ??= (async () => {
    const at = (file) => new URL(`js/${file}`, ROTI_URL).href;
    const [{ firebaseConfig }, { createFirebaseDb }, { createRotiStore }] = await Promise.all([
      import(at('firebase-config.js')), import(at('firebase-db.js')), import(at('roti-store.js')),
    ]);
    const db = createFirebaseDb(firebaseConfig);
    await db.start();
    return createRotiStore(db);
  })();
  storePromise.catch(() => { storePromise = null; });
  return storePromise;
}

/** Crée la salle ROTI et l'ajoute à « Mes ROTI » de ce navigateur. Renvoie son code. */
export async function createRoti(title) {
  const store = await rotiStore();
  const { code, createdAt } = await store.createRoom(title);
  try {
    const list = JSON.parse(localStorage.getItem('roti.mine') || '[]');
    const rest = Array.isArray(list) ? list.filter((e) => e?.code !== code) : [];
    localStorage.setItem('roti.mine', JSON.stringify([{ code, createdAt }, ...rest]));
  } catch { /* liste « Mes ROTI » indisponible : la salle existe quand même */ }
  return code;
}
