# Tableaux manipulables

## Purpose
Manipuler des post-its sur les trois canevas, à la souris, au doigt ou au clavier.

## Requirements

### Requirement: Un post-it reste dans son étape
Un post-it SHALL pouvoir être déplacé, réordonné, modifié ou supprimé, mais jamais déplacé vers le tableau d'une autre étape. Toute la surface d'une zone (titre et bouton « + » compris) SHALL accepter le dépôt.

### Requirement: Empathy map à partir d'extraits
Chaque persona SHALL avoir sa carte en six zones et une pioche d'extraits d'interview ; un extrait posé quitte la pioche et peut y revenir. La comparaison avec la proposition de tri SHALL indiquer, pour chaque extrait posé, s'il est rangé comme la proposition, et montrer tous les extraits à l'endroit proposé, y compris ceux qui ne sont pas encore rangés ; l'outil SHALL signaler les zones vides. En séance partagée, seul l'animateur SHALL pouvoir dévoiler la proposition (contrôlé aussi par les règles de la base), en général à la restitution.

### Requirement: Arbre d'impact cohérent
L'impact map SHALL accepter plusieurs objectifs (un par sous-groupe, par exemple), chacun avec ses acteurs ; un ancien atelier à objectif unique SHALL être repris avec cet objectif en post-it. Un objectif, un acteur ou un impact qui a des post-its rattachés SHALL ne pas changer de niveau ; sa suppression SHALL emporter ses post-its rattachés après confirmation.

#### Scenario: Livrable retenu
- **WHEN** l'étoile d'un livrable est cochée
- **THEN** il est proposé à l'étape Story mapping, et ne s'y importe qu'une fois

### Requirement: Le parcours avant la story map
La story map SHALL commencer par un temps « Raconter le parcours » : le groupe écrit, dans l'ordre, les grandes étapes que vit sa persona avec le produit, guidé par des questions et des règles de formulation (un verbe, du point de vue de la persona, pas d'écran ni de fonctionnalité, une grande étape et non un clic, 4 à 7 étapes). L'outil SHALL signaler, à titre d'indice, les étapes qui ne commencent pas par un verbe ou qui décrivent le système. Valider le parcours SHALL en faire la colonne vertébrale de la story map du groupe ; on SHALL pouvoir revenir au récit sans perdre les stories. Le parcours type d'une persona SHALL n'être proposé qu'à l'animateur, pour dépanner. La théorie SHALL montrer sur l'exemple de la cantine comment on passe d'une histoire racontée aux grandes étapes.

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
