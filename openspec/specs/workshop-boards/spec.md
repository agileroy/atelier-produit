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
Pendant une séance, les étapes Empathy map, Impact mapping et Story mapping SHALL afficher à tous un minuteur commun, réglé sur la durée préconisée de l'étape et calé sur l'heure du serveur. Seul l'animateur SHALL pouvoir le démarrer, le mettre en pause, le reprendre, ajouter cinq minutes ou le remettre à zéro. Chaque groupe SHALL pouvoir signaler « Nous avons terminé » : son tableau est alors verrouillé, seul « Finalement, on continue » reste actif. L'animateur voit où en est chaque groupe ; quand tous ont terminé, il SHALL lancer lui-même la restitution. La restitution SHALL ne pouvoir être lancée qu'une fois la pratique de l'étape lancée. Quand le minuteur arrive à zéro, les tableaux des groupes SHALL se verrouiller jusqu'à ce que l'animateur lance la restitution (ou ajoute du temps) ; la restitution n'est jamais lancée automatiquement.

### Requirement: Livrables retenus par persona
Les livrables étoilés SHALL se choisir tous ensemble, à la restitution de l'impact mapping : au moins 2 par persona (par groupe), sans quoi l'animateur ne peut pas passer au story mapping. Avec un seul groupe, seules les étoiles de sa persona sont demandées (le groupe simulé a déjà les siennes). Dans la story map, chaque groupe SHALL ne voir que les livrables retenus de sa persona ; un livrable placé quitte la liste « Livrables retenus », et le glisser sur cette liste le retire de la story map.

### Requirement: Le parcours avant la story map
La story map SHALL se faire en quatre temps (35 minutes), entre lesquels chacun navigue librement, de son côté, tant que la restitution n'est pas lancée ; la restitution ramène tout le monde sur la story map. 1. On raconte : chacun ajoute en même temps des actions courtes de la persona (« Sophie + un verbe »), chacune étant un enregistrement séparé ; un brouillon en cours de saisie SHALL survivre aux mises à jour des autres ; les actions déjà regroupées restent visibles avec leur étape. 2. On regroupe : le groupe crée les grandes étapes et glisse les actions dessous ; l'outil SHALL signaler les actions non regroupées, le nombre d'étapes (4 à 7), les étapes sans verbe ou qui décrivent le système. 3. On relie aux livrables : chaque étape s'affiche avec ses actions (le besoin) ; on glisse sous elle les livrables retenus à l'impact mapping qui y aident (la réponse), dans une ligne « À découper » ; l'outil SHALL signaler les étapes sans livrable (story à ajouter, ou oubli de l'impact map). 4. On découpe en versions : les étapes du regroupement sont directement la colonne vertébrale (pas de validation) ; on range les stories de « À découper » dans les versions. Le bouton de secours « Proposer les étapes types » SHALL être visible de l'animateur seul, à tout moment : après confirmation, il remplace les étapes du groupe par celles de sa persona ; les actions retournent dans « Pas encore regroupées », les stories dans le bac.

### Requirement: Supprimer un post-it en un clic
Chaque post-it modifiable SHALL porter une croix : un post-it simple est supprimé tout de suite, avec « Annuler » quelques secondes ; une carte qui en porte d'autres demande d'abord une confirmation ; un extrait d'interview retourne dans la pioche. Les boutons d'ajout (« + Story »…) SHALL rester visibles, même dans une case déjà remplie.

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
