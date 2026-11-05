# Tableaux manipulables

## Purpose
Manipuler des post-its sur les trois canevas, à la souris, au doigt ou au clavier.

## Requirements

### Requirement: Un post-it reste dans son étape
Un post-it SHALL pouvoir être déplacé, réordonné, modifié ou supprimé, mais jamais déplacé vers le tableau d'une autre étape.

### Requirement: Empathy map à partir d'extraits
Chaque persona SHALL avoir sa carte en six zones et une pioche d'extraits d'interview ; un extrait posé quitte la pioche et peut y revenir. La comparaison avec la proposition de tri SHALL indiquer, pour chaque extrait posé, s'il est rangé comme la proposition, et l'outil SHALL signaler les zones vides.

### Requirement: Arbre d'impact cohérent
Un acteur ou un impact qui a des post-its rattachés SHALL ne pas changer de niveau ; sa suppression SHALL emporter ses post-its rattachés après confirmation.

#### Scenario: Livrable retenu
- **WHEN** l'étoile d'un livrable est cochée
- **THEN** il est proposé à l'étape Story mapping, et ne s'y importe qu'une fois

### Requirement: Première version de bout en bout
La story map SHALL signaler les étapes du parcours sans story en première version. Supprimer une étape du parcours SHALL renvoyer ses stories dans le bac.
