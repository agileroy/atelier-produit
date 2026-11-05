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
Le double diamant SHALL garder les noms officiels des phases (Découvrir, Définir, Développer, Livrer), chacun accompagné d'un verbe simple et d'une phrase (Explorer, Cadrer, Imaginer, Tester), de l'indication « on ouvre » ou « on choisit », du message « on ouvre les possibilités, puis on fait des choix : d'abord sur le problème, ensuite sur la solution », et d'une flèche de retour indiquant qu'on revient en arrière selon ce qu'on apprend.

#### Scenario: La première version est un test
- **WHEN** l'équipe relit la première version de la story map
- **THEN** l'outil rappelle qu'elle sert aussi à tester auprès des utilisateurs et peut renvoyer au premier diamant

### Requirement: Fiche-outil et consigne
Chaque étape outil SHALL afficher une consigne « À faire » avec sa durée et donner accès à une fiche-outil (à quoi ça sert, quand, comment, pièges, origine), dans un panneau qui ne bloque pas le tableau.

### Requirement: Débrief
Le débrief SHALL permettre de ranger les trois outils sur les phases du double diamant avec vérification, de choisir l'outil adapté à huit situations avec explication, et de noter ce que l'équipe retient.
