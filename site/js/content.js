// Contenu pédagogique de l'atelier : le cas fil rouge, les personas et leurs extraits d'interview,
// les fiches-outil, les phases du double diamant et les situations du débrief.
// Données pures (aucun DOM) : importées par l'interface et par les tests.

/** Les étapes de l'atelier, dans l'ordre. */
export const STEPS = [
  { id: 'frame', label: 'Le cadre', short: 'Cadre' },
  { id: 'empathy', label: 'Empathy map', short: 'Empathy' },
  { id: 'impact', label: 'Impact mapping', short: 'Impact' },
  { id: 'story', label: 'Story mapping', short: 'Story' },
  { id: 'debrief', label: 'Débrief', short: 'Débrief' },
];

/** Étapes où l'on peut envoyer des post-its depuis un téléphone. */
export const PHONE_STEPS = ['empathy', 'impact', 'story'];

/* ---------- Le cas fil rouge ---------- */

export const CASE = {
  name: "Covoit'Boulot",
  tagline: 'Une appli de covoiturage entre collègues',
  context: [
    "Valmétal, 1 400 salariés, fabrique des pièces métalliques sur un site installé dans une zone d'activité, en périphérie de la ville.",
    "Le site est mal desservi : une ligne de bus, peu de passages, rien avant 6 h ni après 21 h. Neuf salariés sur dix viennent en voiture, presque toujours seuls.",
    "Le parking (900 places) est plein dès 8 h 15. Les gens se garent sur les bas-côtés, les amendes et les accrochages se multiplient, et les équipes postées en 2×8 ont du mal à venir sans voiture.",
  ],
  request: "La direction veut « une appli de covoiturage interne » et vous confie le sujet. Avant de foncer, l'équipe produit prend le temps de comprendre les utilisateurs, de clarifier l'objectif et de découper une première version utile.",
};

/* ---------- Le double diamant (Design Council, 2005) ---------- */

export const PHASES = [
  { id: 'discover', label: 'Découvrir', plain: 'Comprendre les personnes, leurs besoins et leurs difficultés', diamond: 1, mode: 'ouvrir' },
  { id: 'define', label: 'Définir', plain: 'Choisir le problème à résoudre', diamond: 1, mode: 'fermer' },
  { id: 'develop', label: 'Développer', plain: 'Explorer plusieurs solutions possibles', diamond: 2, mode: 'ouvrir' },
  { id: 'deliver', label: 'Livrer', plain: 'Essayer des solutions concrètes et les améliorer avec les utilisateurs', diamond: 2, mode: 'fermer' },
];

/** Au débrief, une notion peut aussi couvrir tout le double diamant (le Design Thinking). */
export const ALL_PLACE = { id: 'all', label: 'Tout le double diamant', plain: 'Toute la démarche, du problème à la livraison, avec les allers-retours' };
export const PLACES = [...PHASES, ALL_PLACE];

/** Le message du double diamant, et l'aller-retour entre les phases. */
export const DIAMOND_MESSAGE = 'On ouvre les possibilités, puis on fait des choix : d\'abord sur le problème, ensuite sur la solution.';
export const DIAMOND_LOOP = 'On revient en arrière selon ce qu\'on apprend : les diamants ne se parcourent pas une seule fois.';

/** Où chaque outil se range sur le double diamant (une ou plusieurs phases acceptées). */
export const TOOL_PHASES = {
  designThinking: ['all'],
  empathy: ['discover'],
  impact: ['define'],
  story: ['develop', 'deliver'],
};

/** Correction du rangement au débrief : pour chaque outil, une explication par phase choisie. */
export const PLACEMENT_FEEDBACK = {
  designThinking: {
    all: 'C\'est toute la démarche : les deux diamants, et les allers-retours entre eux. Les trois autres outils viennent s\'y ranger.',
    discover: 'C\'est là qu\'il commence, mais il ne s\'y arrête pas : le Design Thinking, c\'est toute la démarche, les deux diamants et les allers-retours.',
    define: 'Ce n\'est pas une phase parmi d\'autres : le Design Thinking, c\'est toute la démarche, les deux diamants et les allers-retours.',
    develop: 'Ce n\'est pas une phase parmi d\'autres : le Design Thinking, c\'est toute la démarche, les deux diamants et les allers-retours.',
    deliver: 'Il ne s\'arrête pas à la livraison : le Design Thinking, c\'est toute la démarche, les deux diamants et les allers-retours.',
  },
  empathy: {
    all: 'Elle ne couvre pas tout le chemin : elle sert au début, pour comprendre les personnes (Découvrir).',
    discover: 'On l\'utilise pour comprendre les personnes avant de chercher quoi que ce soit, à partir de ce qu\'on a vu et entendu.',
    define: 'Elle nourrit la définition du problème, mais elle ne choisit rien : elle rassemble ce qu\'on a appris. Elle sert juste avant, pour Découvrir.',
    develop: 'Elle ne produit aucune solution. Elle sert bien avant, pour comprendre les personnes : c\'est la phase Découvrir.',
    deliver: 'On ne livre pas une empathy map. On peut la compléter après un test, mais son rôle est de comprendre les personnes au départ : Découvrir.',
  },
  impact: {
    all: 'Elle ne couvre pas tout le chemin : elle cadre l\'objectif et les comportements à changer (Définir).',
    discover: 'Elle part d\'un objectif déjà choisi : elle n\'explore pas les besoins. Elle vient juste après, pour Définir l\'objectif et les comportements à changer.',
    define: 'Elle fixe le pourquoi (un objectif mesurable) et les comportements à changer : c\'est le choix du problème à résoudre.',
    develop: 'Ses livrables sont des pistes de solution, c\'est vrai. Mais son cœur, l\'objectif et les impacts, sert à cadrer le problème : Définir.',
    deliver: 'Elle ne découpe pas ce qu\'on livre. Elle sert avant, à choisir l\'objectif et les comportements à changer : Définir.',
  },
  story: {
    all: 'Elle ne couvre pas tout le chemin : elle organise et découpe la solution, dans le second diamant (Développer et Livrer).',
    discover: 'Elle suppose qu\'on sait déjà pour qui et pourquoi : elle organise des solutions. Elle arrive dans le second diamant, Développer et Livrer.',
    define: 'Elle ne choisit pas le problème, elle organise la solution le long du parcours. Elle vient dans le second diamant, Développer et Livrer.',
    develop: 'On y organise les solutions imaginées le long du parcours utilisateur. Elle sert aussi à Livrer, en découpant des versions.',
    deliver: 'Ses lignes de version découpent ce qu\'on livre et teste en premier. Elle sert aussi à Développer, en organisant les idées.',
  },
};

/** Phase mise en avant pour chaque étape (repère « vous êtes ici »). */
export const STEP_PHASES = {
  frame: [],
  empathy: ['discover'],
  impact: ['define'],
  story: ['develop', 'deliver'],
  debrief: ['discover', 'define', 'develop', 'deliver'],
};

/* ---------- Empathy map ---------- */

export const EMPATHY_ZONES = [
  { id: 'says', label: 'Dit', question: 'Qu\'est-ce qu\'il ou elle dit ? Les phrases entendues, mot pour mot.' },
  { id: 'thinks', label: 'Pense', question: 'Qu\'est-ce qu\'il ou elle pense sans forcément le dire ?' },
  { id: 'does', label: 'Fait', question: 'Qu\'est-ce qu\'on l\'a vu faire ? Les comportements observés.' },
  { id: 'feels', label: 'Ressent', question: 'Quelles émotions ? Ce qui l\'inquiète, l\'agace, le ou la réjouit.' },
  { id: 'pains', label: 'Douleurs', question: 'Frustrations, obstacles, peurs, risques.' },
  { id: 'gains', label: 'Gains', question: 'Ce qu\'il ou elle espère, ce qui ferait la différence.' },
];

export const PERSONAS = [
  {
    id: 'sophie',
    name: 'Sophie',
    age: 41,
    role: 'Gestionnaire paie',
    profile: 'Conductrice potentielle',
    facts: [
      'Horaires de bureau, 8 h 30 – 17 h, sauf en période de clôture de paie',
      'Habite à 22 km, dépose ses deux enfants à l\'école le matin',
      'Voiture familiale, 4 places libres',
    ],
    hue: 205,
    extracts: [
      { id: 's1', text: '« Je veux bien rendre service, mais je ne veux pas devenir le taxi de l\'atelier. »', zone: 'says' },
      { id: 's2', text: 'Se demande si elle osera dire non à un collègue qui lui demanderait un détour.', zone: 'thinks' },
      { id: 's3', text: 'Observé : arrive à 8 h 25 et tourne une dizaine de minutes pour trouver une place.', zone: 'does' },
      { id: 's4', text: '« Le soir je suis lessivée, la voiture c\'est mon sas de décompression. »', zone: 'feels' },
      { id: 's5', text: 'Se gare sur le bas-côté quand le parking est plein ; a déjà eu une amende.', zone: 'pains' },
      { id: 's6', text: '« Si ça me faisait économiser 80 € d\'essence par mois, je signe tout de suite. »', zone: 'gains' },
      { id: 's7', text: 'Observé : partage déjà un trajet le jeudi avec une voisine, sans application.', zone: 'does' },
      { id: 's8', text: 'Pense que les applis de covoiturage, « c\'est pour les étudiants qui partent en week-end ».', zone: 'thinks' },
      { id: 's9', text: 'Agacée dès qu\'on parle du parking : « Chaque matin, c\'est la loterie. »', zone: 'feels' },
      { id: 's10', text: 'Pendant la clôture de paie, elle part parfois à 19 h : ses horaires ne sont pas fixes.', zone: 'pains' },
    ],
  },
  {
    id: 'karim',
    name: 'Karim',
    age: 26,
    role: 'Opérateur de production',
    profile: 'Passager potentiel',
    facts: [
      'Travaille en 2×8 : semaine du matin (5 h – 13 h) ou de l\'après-midi (13 h – 21 h)',
      'Habite à 15 km, n\'a pas de voiture',
      'Prend le bus quand il peut, sinon se fait déposer',
    ],
    hue: 28,
    extracts: [
      { id: 'k1', text: '« Le bus de 4 h 20, si je le rate, je suis en retard, c\'est tout. »', zone: 'says' },
      { id: 'k2', text: 'Observé : se fait souvent déposer par un collègue du matin et lui laisse 5 € « pour l\'essence ».', zone: 'does' },
      { id: 'k3', text: 'Pense qu\'il dérange quand il demande à être déposé ; n\'ose pas demander deux fois de suite à la même personne.', zone: 'thinks' },
      { id: 'k4', text: 'Stressé la veille d\'un changement d\'équipe : il ne sait pas encore comment il viendra.', zone: 'feels' },
      { id: 'k5', text: 'Le dernier bus du soir passe à 20 h 40, avant la fin de son poste de l\'après-midi.', zone: 'pains' },
      { id: 'k6', text: '« Si je savais le dimanche comment je viens toute la semaine, ça changerait ma vie. »', zone: 'gains' },
      { id: 'k7', text: '« Je ne connais personne en dehors de mon équipe. »', zone: 'says' },
      { id: 'k8', text: 'Observé : vérifie trois fois les horaires du bus sur son téléphone avant de partir.', zone: 'does' },
      { id: 'k9', text: 'Content le jour où un collègue l\'a ramené : ils ont parlé foot tout le trajet.', zone: 'feels' },
      { id: 'k10', text: 'Les plannings d\'équipe ne sont publiés que cinq jours à l\'avance.', zone: 'pains' },
      { id: 'k11', text: 'Aimerait participer aux frais sans que ce soit « bizarre ».', zone: 'gains' },
    ],
  },
];

/* ---------- Impact mapping ---------- */

export const IMPACT_LEVELS = [
  { id: 'goal', label: 'Pourquoi ?', name: 'Objectif', question: 'Quel résultat mesurable vise-t-on ?' },
  { id: 'actor', label: 'Qui ?', name: 'Acteurs', question: 'Qui peut aider à l\'atteindre, ou l\'empêcher ?' },
  { id: 'impact', label: 'Comment ?', name: 'Impacts', question: 'Quel changement de comportement attend-on de cet acteur ?' },
  { id: 'deliverable', label: 'Quoi ?', name: 'Livrables', question: 'Qu\'est-ce qu\'on pourrait faire ou livrer pour provoquer ce changement ?' },
];

export const GOAL_EXAMPLE = 'Réduire de 20 % les voitures avec un seul occupant sur le parking, d\'ici 12 mois';

/* ---------- Story mapping ---------- */

export const STORY_LANES = [
  { id: 'mvp', label: 'Première version', hint: 'Le plus petit parcours de bout en bout qui rend service.' },
  { id: 'r2', label: 'Version suivante', hint: 'Ce qui rend le parcours plus confortable.' },
  { id: 'later', label: 'Plus tard', hint: 'Les bonnes idées qui peuvent attendre.' },
];

/* ---------- Le parcours (première ligne de la story map) ---------- */

/** Bien formuler une étape du parcours : la règle, un bon et un mauvais exemple. */
export const JOURNEY_RULES = [
  { title: 'Un verbe d\'action, du point de vue de la persona', good: 'Proposer son trajet', bad: 'Module de publication' },
  { title: 'Ce que fait la personne, pas l\'écran ni la fonction', good: 'Trouver un passager', bad: 'Écran de recherche' },
  { title: 'Une grande étape, pas un clic', good: 'Se mettre d\'accord', bad: 'Cliquer sur « Valider »', note: 'Les détails viendront dessous, en stories.' },
  { title: 'Dans l\'ordre, du déclencheur au résultat', good: 'De « pourquoi y pense-t-on ? » à « et après le trajet ? »' },
];

/** Une action du récit : courte, ce que fait la persona (bons et mauvais exemples). */
export const ACTION_EXAMPLES = {
  good: ['propose 2 places pour lundi', 'prévient qu\'elle a du retard'],
  bad: ['bouton « publier »', 'notifications push'],
};

/** Questions pour raconter le parcours ({name} : la persona du groupe). */
export const JOURNEY_QUESTIONS = [
  'Qu\'est-ce qui donne à {name} l\'envie d\'essayer ? À quel moment y pense-t-on ?',
  'Que fait {name} en premier ? Et ensuite ?',
  'Que se passe-t-il le jour du trajet ? Et si quelque chose change ?',
  'Et après le trajet ?',
];

/** Nombre d'étapes conseillé pour une colonne vertébrale lisible. */
export const JOURNEY_MIN = 4;
export const JOURNEY_MAX = 7;

/** Mots qui trahissent une étape vue du système plutôt que de la personne. */
export const SYSTEM_WORDS = ['écran', 'page', 'bouton', 'module', 'fonctionnalité', 'menu déroulant', 'formulaire', 'base de données', 'onglet', 'cliquer', 'clic', 'api'];

/** Parcours type par persona : réservé à l'animateur, pour dépanner un groupe bloqué. */
export const JOURNEY_EXAMPLES = {
  sophie: ['Proposer son trajet', 'Choisir ses passagers', 'Se mettre d\'accord sur le rendez-vous', 'Faire le trajet', 'Gérer un imprévu', 'Partager les frais'],
  karim: ['Connaître son planning', 'Trouver un conducteur', 'Réserver sa place', 'Retrouver le conducteur', 'Faire le trajet', 'Participer aux frais'],
};

/* ---------- Groupe simulé (séance à un seul groupe) ----------
   Quand l'équipe ne travaille qu'une persona, la restitution la compare au travail d'un groupe
   simulé sur l'autre persona : empathy map, impact map, parcours et story map. */

export const SIMULATED = {
  sophie: {
    impact: [
      { actor: 'Les salariés qui viennent seuls en voiture', impacts: [
        { text: 'Proposent leurs places libres sur leur trajet habituel', deliverables: [['Publier son trajet récurrent en une minute', true], ['Voir combien on économise par mois', false]] },
        { text: 'Acceptent un passager sans craindre le détour', deliverables: [['Fixer soi-même le point de rendez-vous', true], ['Pouvoir refuser une demande sans se justifier', false]] },
      ] },
      { actor: 'Le service RH', impacts: [
        { text: 'Fait connaître le covoiturage aux nouveaux arrivants', deliverables: [['Une présentation à l\'accueil des nouveaux', false]] },
      ] },
      { actor: 'La direction du site', impacts: [
        { text: 'Réserve les meilleures places aux voitures pleines', deliverables: [['Des places covoiturage près de l\'entrée', true]] },
      ] },
    ],
    story: [
      [['Publier son trajet du matin et du soir'], ['Répéter son trajet chaque semaine'], ['Indiquer ses horaires de clôture de paie']],
      [['Accepter ou refuser une demande'], ['Voir le service du passager'], []],
      [['Fixer le point de rendez-vous'], ['Discuter dans l\'appli'], ['Proposer un point sans détour']],
      [['Voir qui monte ce jour-là'], ['Prévenir d\'un retard en un clic'], ['Se garer sur les places covoiturage']],
      [['Annuler et prévenir ses passagers'], ['Proposer une solution de repli'], []],
      [['Voir le montant suggéré'], ['Suivre ses économies du mois'], ['Payer dans l\'appli']],
    ],
  },
  karim: {
    impact: [
      { actor: 'Les salariés en 2×8 sans voiture', impacts: [
        { text: 'Trouvent un trajet avant leur changement d\'équipe', deliverables: [['Chercher un trajet par équipe (matin ou après-midi)', true], ['Être prévenu quand un trajet correspond', false]] },
        { text: 'Osent demander une place plusieurs fois', deliverables: [['Réserver sans avoir à demander en direct', true]] },
      ] },
      { actor: 'Les chefs d\'équipe', impacts: [
        { text: 'Publient les plannings plus tôt', deliverables: [['Des plannings publiés deux semaines à l\'avance', false]] },
      ] },
      { actor: 'Les conducteurs du matin', impacts: [
        { text: 'Proposent leur trajet aux collègues de leur équipe', deliverables: [['Voir les collègues de son équipe qui habitent sur son trajet', true]] },
      ] },
    ],
    story: [
      [['Indiquer son équipe de la semaine'], ['Récupérer son planning automatiquement'], []],
      [['Voir les trajets de son équipe'], ['Être prévenu quand un trajet correspond'], ['Trouver ses trajets de la semaine d\'un coup']],
      [['Demander une place en un clic'], ['Réserver plusieurs jours d\'affilée'], []],
      [['Voir le point et l\'heure de rendez-vous'], ['Suivre l\'arrivée du conducteur'], []],
      [['Prévenir s\'il ne vient pas'], ['Noter le trajet'], []],
      [['Voir combien donner'], ['Payer sa part sans espèces'], []],
    ],
  },
};

/* ---------- Exemples (autre sujet, pour ne pas souffler la réponse du cas) ---------- */

export const EXAMPLE_CASE = {
  name: 'La cantine anti-gaspi',
  context: 'La cantine d\'une entreprise jette chaque jour près d\'un repas sur cinq : on cuisine sans savoir combien de personnes viendront.',
};

/** Une impact map complète : pourquoi → qui → comment → quoi. */
export const IMPACT_EXAMPLE = {
  goal: 'Réduire de 30 % les repas jetés à la cantine d\'ici 6 mois',
  actors: [
    {
      text: 'Les salariés qui déjeunent',
      impacts: [
        { text: 'Réservent leur repas la veille', deliverables: ['Réservation en deux clics depuis l\'intranet', 'Rappel la veille à 15 h'], kept: [0] },
        { text: 'Prennent une portion adaptée à leur faim', deliverables: ['Choix petite ou grande portion au self'], kept: [] },
      ],
    },
    {
      text: 'L\'équipe de cuisine',
      impacts: [
        { text: 'Ajuste les quantités chaque matin', deliverables: ['Nombre de réservations du jour affiché à 9 h'], kept: [0] },
      ],
    },
    {
      text: 'Les managers',
      impacts: [
        { text: 'Signalent les absences de leur équipe (déplacements, séminaires)', deliverables: ['Saisie des absences d\'équipe en une fois'], kept: [] },
      ],
    },
  ],
};

/** Une story map complète pour la même cantine : parcours et trois versions. */
/** De l'histoire au parcours : comment on obtient la colonne vertébrale de l'exemple. */
export const EXAMPLE_JOURNEY = {
  persona: 'Lucie, 34 ans, technicienne, déjeune à la cantine trois fois par semaine.',
  story: 'Mardi, en fin de matinée, Lucie [regarde le menu de demain] sur l\'intranet et [en parle avec ses collègues]. Le plat lui plaît : elle [réserve son repas] et [choisit une petite portion]. Le lendemain midi, elle [arrive à la cantine], [récupère son plateau] et [passe en caisse]. En sortant, elle [dit ce qu\'elle a pensé du plat].',
  steps: [
    { step: 'Découvrir le menu', actions: ['regarde le menu de demain', 'en parle avec ses collègues'] },
    { step: 'Réserver', actions: ['réserve son repas', 'choisit une petite portion'] },
    { step: 'Venir déjeuner', actions: ['arrive à la cantine', 'récupère son plateau', 'passe en caisse'] },
    { step: 'Donner son avis', actions: ['dit ce qu\'elle a pensé du plat'] },
  ],
};

export const STORY_EXAMPLE = {
  backbone: ['Découvrir le menu', 'Réserver', 'Venir déjeuner', 'Donner son avis'],
  lanes: {
    mvp: [['Voir le menu du lendemain'], ['Réserver un repas pour demain'], ['Être reconnu à la caisse'], ['Noter le repas (pouce haut ou bas)']],
    r2: [['Voir le menu de la semaine'], ['Choisir sa portion', 'Recevoir un rappel à 15 h'], ['Annuler jusqu\'à 9 h le jour même'], ['Commenter un plat']],
    later: [['Filtrer selon ses allergies'], ['Réserver toute la semaine d\'un coup'], ['Payer en ligne'], ['Proposer un plat']],
  },
};

/* ---------- Les fiches-outil ---------- */

export const TOOLS = {
  designThinking: {
    name: 'Design Thinking',
    oneLine: 'Une démarche pour résoudre un problème en partant des personnes qui le vivent.',
    origin: 'Popularisé par IDEO et la d.school de Stanford ; le double diamant est un modèle du Design Council britannique (2005).',
    why: 'Éviter de construire la mauvaise chose très bien. On ouvre d\'abord le problème avant de le refermer, puis on ouvre les solutions avant de les refermer.',
    when: [
      'Un nouveau produit, ou un sujet que l\'équipe connaît mal',
      'Une solution livrée qui ne résout pas le bon problème',
      'Des avis qui s\'opposent sans que personne n\'ait parlé aux utilisateurs',
    ],
    how: [
      'Découvrir : aller voir les personnes, comprendre leurs besoins et leurs difficultés.',
      'Définir : choisir le problème à résoudre et l\'objectif à atteindre.',
      'Développer : explorer plusieurs solutions possibles, prototyper vite.',
      'Livrer : essayer des solutions concrètes avec les utilisateurs, les améliorer, livrer par petits incréments.',
    ],
    pitfalls: [
      'Sauter le premier diamant parce que « on sait déjà ce qu\'il faut faire ».',
      'En faire un atelier ponctuel au lieu d\'une habitude d\'équipe.',
      'Croire que c\'est linéaire : on revient souvent en arrière, et c\'est normal.',
    ],
  },
  empathy: {
    name: 'Empathy map',
    oneLine: 'Un canevas pour se mettre à la place d\'un utilisateur précis et partager ce qu\'on sait de lui.',
    origin: 'Créée par Dave Gray (XPLANE), reprise dans Gamestorming.',
    why: 'Rendre visible ce que l\'équipe sait (et ne sait pas) d\'un utilisateur, à partir de faits plutôt que d\'opinions.',
    when: [
      'Après des interviews ou des observations, pour les synthétiser',
      'Pour aligner l\'équipe sur « pour qui on travaille »',
      'Pour repérer les zones où l\'on manque d\'informations',
    ],
    how: [
      'Choisir une personne ou un persona précis, avec son contexte.',
      'Remplir Dit, Pense, Fait, Ressent avec des faits observés ou entendus.',
      'En tirer les douleurs et les gains.',
      'Repérer les zones vides : ce sont les questions de la prochaine interview.',
    ],
    pitfalls: [
      'Remplir la carte avec ce qu\'on imagine, sans être allé voir personne.',
      'Mélanger plusieurs profils dans une seule carte.',
      'Confondre ce que la personne dit et ce qu\'elle fait : l\'écart est souvent la vraie information.',
    ],
  },
  impact: {
    name: 'Impact mapping',
    oneLine: 'Un arbre qui relie un objectif mesurable aux livrables, en passant par les acteurs et leurs changements de comportement.',
    origin: 'Proposé par Gojko Adzic (Impact Mapping, 2012).',
    why: 'Chaque fonctionnalité doit avoir une raison d\'exister : un livrable n\'a de valeur que s\'il change un comportement qui sert l\'objectif.',
    when: [
      'Une liste de fonctionnalités demandées sans objectif clair',
      'Pour prioriser : quels livrables servent vraiment le but ?',
      'Pour parler avec un sponsor en termes de résultats plutôt que de fonctionnalités',
    ],
    how: [
      'Pourquoi : écrire un objectif mesurable et daté.',
      'Qui : lister les acteurs qui peuvent aider ou freiner.',
      'Comment : pour chaque acteur, le changement de comportement attendu.',
      'Quoi : pour chaque changement, les livrables possibles. Puis choisir le chemin le plus court vers l\'objectif.',
    ],
    pitfalls: [
      'Un objectif qui est en fait une solution (« faire une appli »).',
      'Des impacts qui sont des fonctionnalités au lieu de comportements.',
      'Vouloir tout livrer : l\'arbre sert à choisir, pas à faire une liste.',
    ],
  },
  story: {
    name: 'Story mapping',
    oneLine: 'Une carte du parcours utilisateur, de gauche à droite, découpée en versions de haut en bas.',
    origin: 'Popularisé par Jeff Patton (User Story Mapping, 2014).',
    why: 'Remplacer un backlog plat par une vue d\'ensemble, et trouver la plus petite version qui rend service de bout en bout.',
    when: [
      'Un backlog devenu illisible',
      'Pour définir le contenu d\'une première version (MVP)',
      'Pour découper un gros sujet en incréments livrables',
    ],
    how: [
      'Raconter ce que vit l\'utilisateur avec le produit, action par action, puis regrouper ces actions en grandes étapes : c\'est la colonne vertébrale, de gauche à droite.',
      'Sous chaque étape, les stories : ce que l\'utilisateur peut faire.',
      'Trier verticalement : le plus important en haut.',
      'Tracer les lignes de version : la première doit traverser tout le parcours.',
    ],
    pitfalls: [
      'Une première version qui ne couvre qu\'une étape : on ne peut pas l\'utiliser de bout en bout.',
      'Une colonne vertébrale qui décrit le système au lieu de l\'utilisateur.',
      'Faire la carte une fois et ne plus jamais la mettre à jour.',
    ],
  },
};

/** Consignes de chaque étape, affichées dans l'encadré « À faire ». */
export const BRIEFS = {
  empathy: {
    duration: '25 min',
    steps: [
      'Lisez la fiche de votre persona (s\'il y a deux groupes, chacun a le sien : Sophie ou Karim).',
      'Faites glisser les extraits d\'interview dans les zones. Discutez des cas où vous hésitez.',
      'Ajoutez vos propres post-its : ce que vous en déduisez, ou ce qui vous manque.',
      'Comparez avec la proposition, puis repérez les zones vides.',
    ],
  },
  impact: {
    duration: '30 min',
    steps: [
      'Écrivez un objectif mesurable (combien, d\'ici quand).',
      'Ajoutez les acteurs : Sophie et Karim, mais aussi la direction, les RH, les chefs d\'équipe…',
      'Pour chaque acteur, quel changement de comportement aiderait l\'objectif ?',
      'Ajoutez les livrables. À la restitution, on choisit tous ensemble ceux qu\'on retient pour la story map.',
    ],
  },
  story: {
    duration: '50 min',
    steps: [
      'Racontez la semaine de votre persona avec l\'appli : chacun ajoute des actions courtes. Regroupez-les en 4 à 7 grandes étapes et validez : c\'est la première ligne de votre story map.',
      'Glissez les livrables retenus (les mêmes pour tous les groupes) sous les étapes, ajoutez les stories qui manquent.',
      'Rangez-les dans les versions : la première version doit traverser tout le parcours.',
      'Relisez la première version : peut-on vraiment covoiturer avec ? C\'est elle qu\'on fera tester aux utilisateurs pour apprendre.',
    ],
  },
  debrief: {
    duration: '20 min',
    steps: [
      'Lancez le quiz quand tout le monde est connecté.',
      'Chacun range les quatre notions sur le double diamant, puis choisit l\'outil adapté à huit situations.',
      'Révélez les réponses : correction sur chaque téléphone, podium et répartition à l\'écran.',
      'Discutez des situations les moins réussies, puis notez ce que l\'équipe retient.',
    ],
  },
};

/* ---------- Les situations du débrief ---------- */

/** Réponses possibles : un outil, ou la démarche complète. */
export const SITUATION_CHOICES = ['empathy', 'impact', 'story', 'designThinking'];

export const SITUATIONS = [
  {
    id: 'adoption',
    text: 'Une fonctionnalité livrée il y a trois mois n\'est presque pas utilisée, et personne ne sait pourquoi.',
    answer: 'empathy',
    why: 'On manque de compréhension des utilisateurs : aller les voir, puis synthétiser ce qu\'on apprend dans une empathy map.',
    others: {
      impact: { level: 'wrong', text: 'L\'impact map dirait quel comportement on attend. Mais ici on ne sait justement pas pourquoi les gens n\'utilisent pas la fonctionnalité : il faut d\'abord aller les comprendre.' },
      story: { level: 'wrong', text: 'Réorganiser le parcours suppose de savoir ce qui bloque. Sans comprendre les utilisateurs, on risque de redécouper la mauvaise chose.' },
      designThinking: { level: 'ok', text: 'Repartir dans la démarche est juste, mais c\'est large : le manque est précis, c\'est la compréhension des utilisateurs. On commence donc par l\'outil de Découvrir.' },
    },
  },
  {
    id: 'backlog',
    text: 'Le backlog compte 200 tickets ; plus personne ne voit ce qui constituerait une première version utile.',
    answer: 'story',
    why: 'La story map redonne la vue du parcours et permet de tracer une première version qui va de bout en bout.',
    others: {
      empathy: { level: 'wrong', text: 'Comprendre les utilisateurs ne trie pas 200 tickets. Le problème ici est l\'organisation de ce qu\'on va livrer.' },
      impact: { level: 'ok', text: 'Utile pour écarter les tickets qui ne servent aucun objectif. Mais pour voir une première version de bout en bout, il faut le parcours de la story map.' },
      designThinking: { level: 'wrong', text: 'Pas besoin de repartir de zéro : le contenu existe déjà, il faut l\'organiser et le découper.' },
    },
  },
  {
    id: 'sponsor',
    text: 'Le sponsor arrive avec quinze fonctionnalités « indispensables ». On ne sait pas lesquelles servent son objectif.',
    answer: 'impact',
    why: 'L\'impact map relie chaque fonctionnalité à un changement de comportement et à l\'objectif : celles qui ne s\'y rattachent pas sont discutables.',
    others: {
      empathy: { level: 'wrong', text: 'Comprendre les utilisateurs reste utile, mais la question est celle du sponsor : quelles fonctionnalités servent son objectif ? C\'est le lien objectif → livrables.' },
      story: { level: 'wrong', text: 'La story map organise des fonctionnalités dans un parcours, sans dire lesquelles servent l\'objectif. On finirait par organiser les quinze.' },
      designThinking: { level: 'wrong', text: 'Toute la démarche est disproportionnée : il s\'agit de relier des demandes à un objectif, ce que fait directement l\'impact map.' },
    },
  },
  {
    id: 'new-product',
    text: 'On démarre un produit sur un sujet que l\'équipe connaît mal, du problème jusqu\'à la première livraison.',
    answer: 'designThinking',
    why: 'Tout le chemin est à parcourir : la démarche complète, où chaque outil trouve sa place.',
    others: {
      empathy: { level: 'ok', text: 'C\'est bien le premier outil à sortir, mais il ne couvre que le début. Ici tout le chemin est à faire, du problème à la livraison.' },
      impact: { level: 'wrong', text: 'On connaît trop mal le sujet pour fixer un objectif et des comportements à changer. Il faut d\'abord découvrir.' },
      story: { level: 'wrong', text: 'Organiser des solutions alors qu\'on connaît mal le problème, c\'est sauter le premier diamant.' },
    },
  },
  {
    id: 'release',
    text: 'Il faut découper un gros sujet en incréments livrables pour les prochains sprints.',
    answer: 'story',
    why: 'Les lignes de version de la story map servent exactement à ça.',
    others: {
      empathy: { level: 'wrong', text: 'Comprendre les utilisateurs ne dit pas comment découper un gros sujet en livraisons.' },
      impact: { level: 'wrong', text: 'L\'impact map aide à choisir quoi faire, pas à découper ce qu\'on a choisi en incréments.' },
      designThinking: { level: 'wrong', text: 'Toute la démarche est disproportionnée : le besoin est précis, découper en versions.' },
    },
  },
  {
    id: 'two-profiles',
    text: 'Deux profils d\'utilisateurs semblent avoir des attentes opposées, et l\'équipe se dispute sur « ce que veulent les utilisateurs ».',
    answer: 'empathy',
    why: 'Une empathy map par profil, construite à partir de faits, remplace les opinions par une vision partagée.',
    others: {
      impact: { level: 'ok', text: 'Avec les deux profils comme acteurs de l\'arbre, on voit les comportements attendus de chacun. Mais la dispute porte sur ce que vivent les utilisateurs : des faits sur chaque profil la règlent mieux.' },
      story: { level: 'wrong', text: 'Le parcours ne tranche pas un désaccord sur qui sont les utilisateurs. Il faut d\'abord une vision partagée de chaque profil.' },
      designThinking: { level: 'wrong', text: 'Toute la démarche est disproportionnée : le manque est précis, une vision commune de chaque profil.' },
    },
  },
  {
    id: 'kpi',
    text: 'La direction fixe un objectif chiffré : -20 % d\'appels au support d\'ici l\'été. Que pourrait-on faire ?',
    answer: 'impact',
    why: 'Un objectif mesurable est le point de départ d\'une impact map : qui appelle, quel comportement changer, quoi livrer.',
    others: {
      empathy: { level: 'wrong', text: 'Comprendre qui appelle le support est utile, mais un objectif chiffré appelle un arbre : qui, quel comportement changer, quoi livrer.' },
      story: { level: 'wrong', text: 'On ne sait pas encore quoi construire : la story map organiserait des solutions qu\'on n\'a pas choisies.' },
      designThinking: { level: 'ok', text: 'Si le sujet est mal connu, oui. Mais avec un objectif chiffré déjà posé, l\'impact map est le point de départ direct.' },
    },
  },
  {
    id: 'wrong-problem',
    text: 'Après une démo, on se rend compte que la solution, bien faite, ne résout pas le bon problème.',
    answer: 'designThinking',
    why: 'Signe qu\'on a sauté le premier diamant : revenir à Découvrir et Définir avant de développer davantage.',
    others: {
      empathy: { level: 'ok', text: 'Retourner voir les utilisateurs est la bonne première étape. Mais le signal dit surtout qu\'on a sauté le premier diamant : c\'est toute la démarche qu\'il faut reprendre.' },
      impact: { level: 'wrong', text: 'Fixer un objectif sur un problème mal compris ne corrigera rien. Il faut d\'abord revenir à Découvrir.' },
      story: { level: 'wrong', text: 'Redécouper la solution ne sert à rien si elle ne résout pas le bon problème.' },
    },
  },
];
