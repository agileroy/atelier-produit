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
