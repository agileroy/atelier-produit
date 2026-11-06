# Post-its depuis les téléphones

## Purpose
Permettre à chacun d'écrire des post-its sur son téléphone pendant que l'écran est projeté.

## Requirements

### Requirement: Séance ouverte par l'animateur
L'animateur SHALL ouvrir une séance qui affiche un QR code et un lien ; l'atelier SHALL rester utilisable sans Firebase.

### Requirement: Les téléphones suivent l'étape
Le participant SHALL ne pouvoir écrire que pour l'étape affichée à l'écran (empathy map : zone choisie, sur le persona affiché ; impact map : acteur, impact ou livrable ; story map : story), et la base SHALL refuser un post-it d'une autre étape ou d'une séance fermée.

### Requirement: Chaque post-it arrive une fois
Un post-it reçu SHALL être ajouté une seule fois au tableau, même après rechargement ou reprise d'un fichier.

### Requirement: Terminer la séance
Terminer la séance SHALL effacer la séance et ses post-its de la base, sans retirer ceux déjà reçus sur le tableau.

### Requirement: Quiz individuel du débrief
L'animateur SHALL pouvoir choisir, au débrief, entre le débrief en équipe à l'écran et un quiz individuel sur téléphone. Dans le quiz, chacun SHALL répondre aux onze questions (trois outils à ranger, huit situations) puis valider une seule fois ; la base SHALL refuser une copie incomplète, une seconde copie, ou une copie hors d'un quiz ouvert.

#### Scenario: Révélation
- **WHEN** l'animateur révèle les réponses
- **THEN** chaque téléphone affiche sa correction personnalisée et son score sur onze, et l'écran affiche le podium des trois meilleurs (à égalité, le premier à avoir validé passe devant), la moyenne du groupe, la situation la moins réussie, les bonnes réponses et la répartition des réponses

#### Scenario: Rejouer
- **WHEN** l'animateur choisit « Rejouer »
- **THEN** toutes les copies sont effacées et les téléphones reviennent au formulaire

### Requirement: Rejoindre dès l'arrivée
L'étape Cadre SHALL afficher, tout en haut, le QR code de la séance dès qu'elle est ouverte, pour que chacun rejoigne avec son prénom en arrivant. Le lien de la salle SHALL être l'adresse de l'atelier suivie du code (`…/atelier-produit/?code=XXXX`) : la page s'ouvre alors en mode participant.

### Requirement: Salle de la séance
Chaque séance SHALL avoir un code court de quatre caractères sans ambiguïté (ni 0, O, 1, I, L), réservé de façon unique dans la base, qui permet de rejoindre sans QR code. Un prénom SHALL être unique dans la salle (accents et majuscules ignorés) ; un prénom déjà pris est refusé avec une suggestion. Chaque participant SHALL apparaître dans la liste des présents de l'animateur tant que sa page est ouverte, et en disparaître à la déconnexion.

#### Scenario: Qui n'a pas encore répondu
- **WHEN** le quiz est ouvert
- **THEN** l'écran affiche le nombre de copies sur le nombre de présents, et les prénoms de ceux qui n'ont pas encore validé

### Requirement: Participer depuis un ordinateur
Les participants SHALL pouvoir rejoindre depuis un ordinateur aussi bien que depuis un téléphone : partout où un QR code est affiché, un lien copiable (page participant avec le code de la salle) SHALL l'accompagner. La page participant SHALL s'élargir sur grand écran, et Ctrl + Entrée (Cmd + Entrée sur Mac) SHALL envoyer un post-it.
