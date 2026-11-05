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
  { id: 'discover', label: 'Découvrir', diamond: 1, mode: 'ouvrir', hint: 'Comprendre les utilisateurs et leur problème, sans présupposer la solution.' },
  { id: 'define', label: 'Définir', diamond: 1, mode: 'fermer', hint: 'Choisir le problème à résoudre et l\'objectif à atteindre.' },
  { id: 'develop', label: 'Développer', diamond: 2, mode: 'ouvrir', hint: 'Imaginer des solutions, les organiser, en tester plusieurs.' },
  { id: 'deliver', label: 'Livrer', diamond: 2, mode: 'fermer', hint: 'Découper, livrer par incréments, apprendre de chaque livraison.' },
];

/** Où chaque outil se range sur le double diamant (une ou plusieurs phases acceptées). */
export const TOOL_PHASES = {
  empathy: ['discover'],
  impact: ['define'],
  story: ['develop', 'deliver'],
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

export const BACKBONE_EXAMPLE = [
  'Rejoindre le service',
  'Proposer ou chercher un trajet',
  'Se mettre d\'accord',
  'Faire le trajet',
  'Après le trajet',
];

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
      'Découvrir : aller voir les utilisateurs, observer, interviewer.',
      'Définir : formuler le problème et l\'objectif à atteindre.',
      'Développer : imaginer plusieurs solutions, prototyper vite.',
      'Livrer : tester, découper, livrer par petits incréments, recommencer.',
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
      'Poser la colonne vertébrale : les grandes étapes du parcours, de gauche à droite.',
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
      'Choisissez Sophie ou Karim (on peut faire les deux, une carte chacun).',
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
      'Ajoutez les livrables, puis cochez ceux que vous retenez pour la story map.',
    ],
  },
  story: {
    duration: '40 min',
    steps: [
      'Posez la colonne vertébrale : les grandes étapes du parcours d\'un covoitureur.',
      'Glissez les livrables retenus sous les étapes, ajoutez les stories qui manquent.',
      'Rangez-les dans les versions : la première version doit traverser tout le parcours.',
      'Relisez la première version : peut-on vraiment covoiturer avec ?',
    ],
  },
  debrief: {
    duration: '20 min',
    steps: [
      'Rangez chaque outil sur le double diamant.',
      'Pour chaque situation, choisissez l\'outil le plus adapté.',
      'Notez ce que l\'équipe retient, puis gardez une trace de l\'atelier.',
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
  },
  {
    id: 'backlog',
    text: 'Le backlog compte 200 tickets ; plus personne ne voit ce qui constituerait une première version utile.',
    answer: 'story',
    why: 'La story map redonne la vue du parcours et permet de tracer une première version qui va de bout en bout.',
  },
  {
    id: 'sponsor',
    text: 'Le sponsor arrive avec quinze fonctionnalités « indispensables ». On ne sait pas lesquelles servent son objectif.',
    answer: 'impact',
    why: 'L\'impact map relie chaque fonctionnalité à un changement de comportement et à l\'objectif : celles qui ne s\'y rattachent pas sont discutables.',
  },
  {
    id: 'new-product',
    text: 'On démarre un produit sur un sujet que l\'équipe connaît mal, du problème jusqu\'à la première livraison.',
    answer: 'designThinking',
    why: 'Tout le chemin est à parcourir : la démarche complète, où chaque outil trouve sa place.',
  },
  {
    id: 'release',
    text: 'Il faut découper un gros sujet en incréments livrables pour les prochains sprints.',
    answer: 'story',
    why: 'Les lignes de version de la story map servent exactement à ça.',
  },
  {
    id: 'two-profiles',
    text: 'Deux profils d\'utilisateurs semblent avoir des attentes opposées, et l\'équipe se dispute sur « ce que veulent les utilisateurs ».',
    answer: 'empathy',
    why: 'Une empathy map par profil, construite à partir de faits, remplace les opinions par une vision partagée.',
  },
  {
    id: 'kpi',
    text: 'La direction fixe un objectif chiffré : -20 % d\'appels au support d\'ici l\'été. Que pourrait-on faire ?',
    answer: 'impact',
    why: 'Un objectif mesurable est le point de départ d\'une impact map : qui appelle, quel comportement changer, quoi livrer.',
  },
  {
    id: 'wrong-problem',
    text: 'Après une démo, on se rend compte que la solution, bien faite, ne résout pas le bon problème.',
    answer: 'designThinking',
    why: 'Signe qu\'on a sauté le premier diamant : revenir à Découvrir et Définir avant de développer davantage.',
  },
];
