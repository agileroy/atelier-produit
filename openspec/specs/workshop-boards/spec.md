# Tableaux manipulables

## Purpose
Manipuler des post-its sur les trois canevas, à la souris, au doigt ou au clavier.

## Requirements

### Requirement: Un post-it reste dans son étape
Un post-it SHALL pouvoir être déplacé, réordonné, modifié ou supprimé, mais jamais déplacé vers le tableau d'une autre étape. Toute la surface d'une zone (titre et bouton « + » compris) SHALL accepter le dépôt.

### Requirement: Empathy map à partir d'extraits
Chaque persona SHALL avoir sa carte en six zones et une pioche d'extraits d'interview ; un extrait posé quitte la pioche et peut y revenir. La comparaison avec la proposition de tri SHALL indiquer, pour chaque extrait posé, s'il est rangé comme la proposition, et montrer tous les extraits à l'endroit proposé, y compris ceux qui ne sont pas encore rangés ; l'outil SHALL signaler les zones vides. En séance partagée, la proposition et les écarts SHALL rester cachés jusqu'à la restitution ; seul l'animateur SHALL pouvoir les dévoiler, pendant la restitution, puis ajuster les post-its selon la discussion.

### Requirement: Arbre d'impact cohérent
L'impact map SHALL accepter plusieurs objectifs (un par sous-groupe, par exemple), chacun avec ses acteurs ; un ancien atelier à objectif unique SHALL être repris avec cet objectif en post-it. Un objectif, un acteur ou un impact qui a des post-its rattachés SHALL ne pas changer de niveau ; sa suppression SHALL emporter ses post-its rattachés après confirmation.

#### Scenario: Livrable retenu
- **WHEN** l'étoile d'un livrable est cochée
- **THEN** il est proposé à l'étape Story mapping, et ne s'y importe qu'une fois

### Requirement: Minuteur et fin d'exercice
Pendant une séance, les étapes Empathy map, Impact mapping et Story mapping SHALL afficher à tous un minuteur commun, réglé sur la durée préconisée de l'étape et calé sur l'heure du serveur. Seul l'animateur SHALL pouvoir le démarrer, le mettre en pause, le reprendre, ajouter cinq minutes ou le remettre à zéro. Chaque groupe SHALL pouvoir signaler « Nous avons terminé » : son tableau est alors verrouillé, seul « Finalement, on continue » reste actif. L'animateur voit où en est chaque groupe ; quand tous ont terminé, il SHALL lancer lui-même la restitution. La restitution SHALL se lancer toute seule quand le minuteur arrive à zéro, une seule fois par étape.

### Requirement: Le parcours avant la story map
La story map SHALL se faire en trois temps. 1. On raconte : chacun ajoute en même temps des actions courtes de la persona (« Sophie + un verbe »), chacune étant un enregistrement séparé (aucun conflit d'écriture), guidé par des questions et des exemples ; un brouillon en cours de saisie SHALL survivre aux mises à jour des autres. 2. On regroupe : le groupe crée les grandes étapes et glisse les actions dessous ; l'outil SHALL signaler les actions non regroupées, le nombre d'étapes (4 à 7), les étapes sans verbe ou qui décrivent le système. 3. Valider le parcours SHALL en faire la colonne vertébrale de la story map du groupe ; les actions restent affichées sous leur étape « pour mémoire » et ne deviennent pas des stories. Les stories SHALL venir des livrables retenus à l'impact mapping ; l'outil SHALL signaler les étapes sans livrable, comme invitation à ajouter une story ou à compléter l'impact map. On SHALL pouvoir revenir du regroupement au récit, et de la story map au regroupement, sans rien perdre. Les étapes types d'une persona SHALL n'être proposées qu'à l'animateur, pour dépanner.

#### Scenario: Conducteur et passager
- **WHEN** deux groupes travaillent Sophie et Karim
- **THEN** chacun obtient un parcours différent (conductrice, passager), comparé à la restitution

### Requirement: Première version de bout en bout
La story map SHALL signaler les étapes du parcours sans story en première version. Supprimer une étape du parcours SHALL renvoyer ses stories dans le bac.

### Requirement: Tableaux partagés par groupe
Pendant une séance, chaque participant SHALL travailler sur les mêmes canevas que l'animateur, en temps réel avec son groupe. Les participants SHALL être répartis au hasard, de façon équilibrée, en un ou deux groupes ; seul l'animateur SHALL pouvoir changer le nombre de groupes ou déplacer quelqu'un. Chaque groupe SHALL ne voir que son tableau ; pendant la restitution, lancée par l'animateur, chacun SHALL pouvoir voir l'autre tableau en lecture seule. La restitution se referme au changement d'étape.

#### Scenario: Persona par groupe
- **WHEN** il y a deux groupes
- **THEN** le groupe 1 travaille sur Sophie et le groupe 2 sur Karim

#### Scenario: Un seul groupe
- **WHEN** il n'y a qu'un groupe
- **THEN** l'animateur choisit sa persona dans le panneau Participants, elle reste la même à toutes les étapes, et la restitution compare le tableau du groupe à celui d'un groupe simulé sur l'autre persona (empathy map, impact map, parcours et story map, en lecture seule, jamais écrits dans la base)

#### Scenario: Livrables retenus en commun
- **WHEN** l'animateur étoile des livrables, à la restitution de l'impact mapping
- **THEN** la liste des livrables étoilés, tous groupes confondus, est proposée à chaque groupe pour sa story map

#### Scenario: Deux personnes, deux post-its
- **WHEN** deux membres d'un groupe modifient deux post-its différents en même temps
- **THEN** aucune modification n'est perdue (chaque post-it est un enregistrement séparé)
