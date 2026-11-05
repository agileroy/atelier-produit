# Atelier guidé

## Purpose
Faire découvrir quatre techniques produit en les enchaînant sur un même cas, avec un repère constant sur le double diamant.

## Requirements

### Requirement: Cinq étapes dans l'ordre du double diamant
L'atelier SHALL proposer les étapes Cadre, Empathy map, Impact mapping, Story mapping et Débrief, accessibles à tout moment depuis l'en-tête.

#### Scenario: Le double diamant se remplit
- **WHEN** une étape outil a été visitée
- **THEN** l'outil apparaît sur sa phase du double diamant de l'étape Cadre

### Requirement: Double diamant lisible par des néophytes
Le double diamant SHALL garder les noms officiels des phases (Découvrir, Définir, Développer, Livrer), chacun accompagné d'une phrase explicative en langage simple, révélée à la demande (icône « i », au survol, au clic ou au toucher), de l'indication « on ouvre » ou « on choisit », du message « on ouvre les possibilités, puis on fait des choix : d'abord sur le problème, ensuite sur la solution », et d'une flèche de retour indiquant qu'on revient en arrière selon ce qu'on apprend.

#### Scenario: La première version est un test
- **WHEN** l'équipe relit la première version de la story map
- **THEN** l'outil rappelle qu'elle sert aussi à tester auprès des utilisateurs et peut renvoyer au premier diamant

### Requirement: La théorie avant la pratique
Chaque étape outil SHALL commencer par la théorie de l'outil (à quoi ça sert, quand l'utiliser, comment faire, pièges, origine), dépliée par défaut, puis afficher la consigne « À faire » avec sa durée. Le bouton « Passer à la pratique » SHALL replier la théorie en une ligne, rouvrable à tout moment, et l'état replié SHALL être mémorisé par étape.

#### Scenario: Exemple complet sur un autre sujet
- **WHEN** la théorie de l'impact mapping ou du story mapping est dépliée
- **THEN** elle montre un exemple complet en lecture seule sur un autre sujet que le cas (la cantine anti-gaspi) : objectif → acteurs → impacts → livrables, ou parcours et trois versions

### Requirement: Débrief
Le débrief SHALL permettre de ranger les trois outils sur les phases du double diamant, puis de vérifier : chaque outil reçoit une correction propre à la phase choisie. Pour huit situations, choisir l'outil le plus adapté SHALL rapporter un point, un choix défendable un demi-point, et chaque choix SHALL recevoir une explication propre (pourquoi ce choix, puis le plus adapté). L'équipe SHALL pouvoir noter ce qu'elle retient.
