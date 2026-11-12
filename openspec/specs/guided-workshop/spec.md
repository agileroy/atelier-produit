# Atelier guidé

## Purpose
Faire découvrir quatre techniques produit en les enchaînant sur un même cas, avec un repère constant sur le double diamant.

## Requirements

### Requirement: Les étapes dans l'ordre du double diamant
L'atelier SHALL proposer les étapes Accueil, Cadre, Empathy map, Impact mapping, Story mapping, Bravo !, Débrief et Merci !, accessibles à tout moment depuis l'en-tête.

#### Scenario: Le double diamant se remplit
- **WHEN** une étape outil a été visitée
- **THEN** l'outil apparaît sur sa phase du double diamant de l'étape Cadre

### Requirement: Double diamant lisible par des néophytes
Le double diamant SHALL garder les noms officiels des phases (Découvrir, Définir, Développer, Livrer), chacun accompagné d'une phrase explicative en langage simple, révélée à la demande (icône « i », au survol, au clic ou au toucher), de l'indication « on ouvre » ou « on choisit », du message « on ouvre les possibilités, puis on fait des choix : d'abord sur le problème, ensuite sur la solution », et d'une flèche de retour indiquant qu'on revient en arrière selon ce qu'on apprend.

#### Scenario: La première version est un test
- **WHEN** l'équipe relit la première version de la story map
- **THEN** l'outil rappelle qu'elle sert aussi à tester auprès des utilisateurs et peut renvoyer au premier diamant

### Requirement: Accueil
L'atelier SHALL commencer par une étape « Accueil », sans théorie ni minuteur : le but de l'atelier, le format (théorie puis pratique en groupe, restitutions), la durée totale, les règles du jeu et la carte pour rejoindre. Elle ne dit rien du débrief ni du quiz. L'accueil SHALL être illustré (post-its en double diamant, cartes colorées). L'étape suivante, « Le cadre », n'est que de la théorie : le Design Thinking avec le double diamant à l'intérieur du bloc théorique (replier la théorie replie le diamant). Le cas fil rouge (Covoit'Boulot, Sophie et Karim) SHALL être présenté au début de la pratique de l'empathy map seulement, repliable : « Passer à la pratique » montre le cas (la page s'y place pour tous), puis « Lancer l'exercice » (animateur) affiche la consigne et la carte et démarre le minuteur.

### Requirement: La théorie avant la pratique
Chaque étape d'outil (empathy, impact, story) SHALL d'abord n'afficher que la théorie de l'outil (à quoi ça sert, quand l'utiliser, comment faire, pièges, origine). Seul l'animateur SHALL pouvoir cliquer sur « Passer à la pratique » : la pratique (consigne « À faire » et tableaux) s'ouvre alors pour tous, et la théorie se replie en une ligne que chacun peut rouvrir puis replier. Le premier clic SHALL démarrer le minuteur de l'étape (empathy, impact, story) ; rouvrir et replier la théorie ensuite n'y touche pas.

### Requirement: Exemples dévoilés par l'animateur
Les exemples complets (la cantine) SHALL être repliés pour tous jusqu'à ce que l'animateur les affiche, une fois la théorie présentée ; ensuite, chacun les replie ou les rouvre chez lui sans effet sur les autres. L'empathy map d'exemple SHALL avoir la même présentation que la carte de l'exercice. L'impact map d'exemple SHALL rappeler les douleurs et les gains de la persona d'exemple et expliquer l'étoile (ce qu'on emporte à l'étape suivante) ; la story map d'exemple SHALL rappeler les livrables étoilés dont elle repart.

### Requirement: Le fil entre les étapes
Chaque étape d'outil SHALL afficher, avec la consigne, d'où l'on repart (les étapes passées peuvent être nommées) et à quoi servira le travail (les étapes à venir sont désignées par leur numéro dans la barre du haut, jamais par leur nom).

### Requirement: Restitution avant la suite
En séance, l'animateur SHALL ne pouvoir passer à une étape suivante qu'après avoir lancé au moins une fois la restitution de l'étape en cours (empathy, impact, story).

### Requirement: Partir du problème, pas de la solution demandée
Le cas SHALL présenter l'appli de covoiturage comme la solution demandée par la direction, et le rôle de l'équipe comme la vérification qu'elle répond au bon problème (télétravail, vélo, navette, horaires… sont d'autres réponses possibles). L'objectif d'exemple SHALL porter sur le problème (le nombre de voitures sur le parking), la consigne de l'impact mapping SHALL inviter à des livrables hors appli, et l'impact map du groupe simulé en contient (non étoilés : ils ne passent pas par la story map de l'appli). La page Bravo SHALL rappeler que l'appli n'était peut-être pas la meilleure réponse.

### Requirement: Bravo
Une étape « Bravo ! », entre la story map et le débrief, SHALL conclure l'exercice de façon festive : le lancement réussi de Covoit'Boulot, le chemin parcouru en trois temps, quelques chiffres et ce que chaque groupe a construit (persona, objectif, livrables retenus, première version).

### Requirement: Merci !
La dernière étape, « Merci ! », après le débrief (on vote au quiz avant), SHALL remercier les participants pour leur attention et leur implication, illustrée dans le même style que le reste du parcours, et les inciter à donner leur avis par le ROTI (note et commentaire écrit), créé à l'arrivée sur la page (voir phone-postits). Une petite carte « Pour aller plus loin » cite les sources des outils. Pas de tour de table ni de mention de podium.

### Requirement: Ne pas dévoiler la suite
La barre d'étapes et la navigation SHALL ne nommer que les étapes déjà atteintes ; les suivantes s'affichent « Étape N » (« Étape suivante »). Il n'y a pas de déroulé détaillé des étapes à venir.

#### Scenario: Page d'accueil dans le même ordre
- **WHEN** on ouvre l'étape Cadre
- **THEN** elle montre la théorie du Design Thinking, double diamant compris, sans partie pratique

#### Scenario: Exemple complet sur un autre sujet
- **WHEN** la théorie de l'impact mapping ou du story mapping est dépliée
- **THEN** elle montre un exemple complet en lecture seule sur un autre sujet que le cas (la cantine anti-gaspi) : objectif → acteurs → impacts → livrables, ou parcours et trois versions

### Requirement: Débrief
Le débrief SHALL se faire uniquement en quiz individuel sur téléphone (voir phone-postits). Il porte sur le rangement de quatre notions sur le double diamant (le Design Thinking, qui couvre tout le double diamant, et les trois outils) et sur huit situations ; chaque choix reçoit une explication propre. Le compte rendu SHALL inclure les résultats du quiz. Il n'y a plus de bloc « Ce que l'équipe retient » : les retours passent par le ROTI de la page « Merci ! ».

### Requirement: Rejoindre à toute étape
Tant que la séance est ouverte, le bouton « Participants » de l'en-tête SHALL afficher le code de la salle à chaque étape ; son panneau SHALL proposer « Afficher en grand » : le QR code, l'adresse courte et le code, sans les commandes d'administration de la séance.
