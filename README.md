# Atelier Produit

Atelier guidé pour découvrir les techniques produit sur un même cas fil rouge : **Design Thinking** (le cadre, avec le double diamant), **empathy map**, **impact mapping** et **story mapping**, puis un débrief pour apprendre à choisir le bon outil.

**Ouvrir l'outil :** https://agileroy.github.io/atelier-produit/

## Déroulé (environ 2 h)

L'écran de l'animateur est projeté ; l'équipe manipule ensemble (glisser-déposer à la souris, appui long au doigt, ou clic sur un post-it pour le modifier et le ranger).

0. **Le cadre** : le cas *Covoit'Boulot* (une appli de covoiturage entre collègues pour une usine mal desservie), deux personas (Sophie, conductrice potentielle ; Karim, passager potentiel) et le double diamant, où chaque outil vient prendre sa place au fil de l'atelier.
1. **Empathy map** (25 min) : on range des extraits d'interview dans les six zones (dit, pense, fait, ressent, douleurs, gains), on ajoute ses propres post-its, puis on compare avec une proposition de tri. L'outil signale les zones vides.
2. **Impact mapping** (30 min) : objectif mesurable → acteurs → impacts (changements de comportement) → livrables. Les douleurs et gains des empathy maps restent visibles pour s'inspirer. On coche l'étoile des livrables retenus.
3. **Story mapping** (40 min) : colonne vertébrale du parcours (ou parcours type), livrables retenus glissés sous les étapes, trois lignes de version. L'outil signale les étapes sans rien en première version.
4. **Débrief** (20 min) : ranger les outils sur le double diamant (avec vérification), huit situations réelles où choisir l'outil adapté (avec explication), ce que l'équipe retient, puis compte rendu copié, impression / PDF ou fichier `.json` (rouvrable ensuite).

Chaque étape a sa **fiche-outil** (à quoi ça sert, quand l'utiliser, comment faire, pièges, origine) et son encadré « À faire ». L'atelier en cours est mémorisé dans le navigateur.

## Post-its depuis les téléphones

Bouton **Téléphones** : l'animateur ouvre une séance et affiche un QR code. Chacun écrit ses post-its sur son téléphone (prénom seulement, pas de compte) pour l'étape en cours ; ils arrivent sur l'écran projeté :

- empathy map : dans la zone choisie, sur la carte du persona affiché ;
- impact map et story map : dans le bac « À placer », que l'animateur range dans l'arbre ou la carte.

Les téléphones suivent l'étape affichée à l'écran. L'animateur peut fermer les envois, puis **terminer la séance** : la base est effacée, les post-its reçus restent sur le tableau.

Le VPN de l'entreprise (proxy Zscaler) bloque Firebase : ouvrir l'écran animateur hors VPN, les participants depuis leur téléphone. Sans Firebase, l'atelier fonctionne normalement, sans les téléphones.

### Mise en place (une fois)

Comme pour les autres outils, un projet Firebase dédié :

1. Créer le projet `atelier-produit-vleroy` dans la console Firebase (offre gratuite).
2. **Authentication** → activer la connexion **anonyme** ; dans *Paramètres → Domaines autorisés*, ajouter `agileroy.github.io`.
3. **Realtime Database** → créer la base (région `europe-west1`), en mode verrouillé.
4. **Paramètres du projet** → ajouter une application Web et copier sa configuration dans `site/js/firebase-config.js` (à la place de `null`).
5. Règles : créer un compte de service (rôle *Firebase Realtime Database Admin*) et mettre sa clé JSON dans le secret GitHub `FIREBASE_SERVICE_ACCOUNT` ; les règles sont alors publiées à chaque push. À défaut, coller `database.rules.json` dans l'onglet *Règles* de la console.

## Confidentialité

- Le tableau de l'animateur reste dans son navigateur (localStorage) ; rien ne part sans le bouton Téléphones.
- Séance téléphones : seuls les post-its envoyés vont dans Firebase. Les règles garantissent que chacun n'écrit que ses propres post-its, une seule fois, pendant l'étape en cours d'une séance ouverte ; qu'un participant ne lit que les siens ; que seuls les navigateurs qui présentent la clé de la séance (l'animateur) les lisent tous.

## Architecture

Site statique (HTML/CSS/JavaScript, sans build) publié sur GitHub Pages.

- `site/js/content.js` : contenu pédagogique (cas, personas, extraits d'interview, fiches-outil, situations) ;
- `site/js/core.js` : logique métier pure (post-its et emplacements, règles de déplacement, débrief, fusion des post-its reçus, compte rendu, fichiers enregistrés), testée avec Node.js ;
- `site/js/session-core.js` : logique pure de la séance téléphones (données échangées avec Firebase) ;
- `site/js/store.js` : seul module qui parle à Firebase, chargé à la demande ;
- `site/js/app.js` : écran animateur ; `site/js/dnd.js` : glisser-déposer ; `site/js/phones.js` : panneau Téléphones ; `site/js/participant.js` : mode participant (même page, ouverte avec `?code=`) ;
- `site/vendor/` : générateur de QR code `qrcode-generator` 1.4.4 (licence MIT) ;
- `database.rules.json` : règles de sécurité du projet Firebase `atelier-produit-vleroy`, limitées à la branche `atelierProduit`.

## Développement

```sh
npm test                                          # tests de la logique métier, du contenu et des règles
python3 -m http.server 8765 --directory site      # puis http://localhost:8765
```

Chaque push sur `main` lance les tests, publie les règles de la base puis publie `site/` sur GitHub Pages ; un test en échec bloque les deux publications.

## Méthode

Le projet suit le développement piloté par les spécifications avec [OpenSpec](https://github.com/Fission-AI/OpenSpec) : `openspec/specs/` décrit le comportement attendu, `openspec/changes/` les changements en cours. Commandes Claude Code : `/opsx:explore`, `/opsx:propose`, `/opsx:apply`, `/opsx:archive`.
