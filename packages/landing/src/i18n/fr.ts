import type { SiteContent } from './types';

const fr: SiteContent = {
  meta: {
    title: 'vigie — Supervision IA Open Source · par Tmonier',
    description:
      'Superviseur local d\u2019agents IA pour ingénieurs. Visibilité en temps réel, détection de dérive, garde-fous de coûts, checkpoints & rollback.',
  },
  nav: {
    demo: 'Démo',
    openSource: 'Open source',
    faq: 'FAQ',
    github: 'GitHub',
  },
  hero: {
    pronunciation: '/vi.ʒi/',
    definition: 'le guetteur dans le nid de pie',
    tagline: 'L\u2019œil sur l\u2019horizon.',
    description:
      'Supervision open source d\u2019agents IA pour les \u00E9quipes qui livrent.<br/>Visibilit\u00E9 temps r\u00E9el, d\u00E9tection de d\u00E9rive, garde-fous de co\u00FBts.',
    ctaGithub: 'Voir sur GitHub',
    ctaWaitlist: 'Rejoindre la liste d\u2019attente',
  },
  toolsStrip: {
    label: 'Votre IA',
    comingSoon:
      'Bientôt\u00A0: OpenCode <span class="text-vigie-400/50">&#9679;</span> supporte la licence Copilot depuis jan. 2026 <span class="pl-2 text-cream-200/30">|</span><span class="pl-2">Codex, Aider, Cline & plus</span>',
  },
  demo: {
    terminal: {
      title: 'zsh — ~/projects/my-app',
      command: 'vigie start',
      daemonRunning: '✓ daemon actif sur localhost:4800',
      watching: 'surveillance de claude-code · tous les événements transmis au dashboard',
      localFirst: 'local-first — vos données ne quittent jamais votre machine',
    },
    sidebar: { agents: 'Agents', runs: 'Exécutions', settings: 'Paramètres' },
    main: {
      taskTitle: 'Rate-limit /api/users',
      badgeActive: '1 agent actif',
      contextLabel: 'contexte',
      contextAction: 'nouvelle fenêtre depuis le checkpoint',
      activityLabel: 'Activité',
    },
    actionPanel: {
      header: 'Agent en pause — boucle détectée',
      suggestedPromptLabel: 'Prompt suggéré',
      suggestedPrompt:
        '«\u00A0Les tests attendent un mock Redis — utilisez ioredis-mock dans le setup de test au lieu de vous connecter à une instance réelle.\u00A0»',
      btnRollback: 'Rollback #3',
      btnResume: 'Reprendre',
      btnStop: 'Arrêter l\u2019agent',
    },
    logs: [
      {
        time: '14:32:01',
        html: '<span class="text-cream-200">claude-code</span> · lecture de <span class="text-success">src/api/users.ts</span>',
        delay: 200,
      },
      {
        time: '14:33:12',
        html: '<span class="text-cream-200">claude-code</span> · création de <span class="text-success">src/middleware/rate-limit.ts</span>',
        delay: 350,
      },
      {
        time: '14:34:30',
        html: '<span class="text-cream-200">claude-code</span> · exécution de <span class="text-cream-50">npm test</span> — <span class="text-danger">3 échecs</span>',
        delay: 550,
      },
      {
        time: '14:35:15',
        html: '<span class="text-cream-200">claude-code</span> · édition de <span class="text-cream-50">src/middleware/rate-limit.ts</span>',
        delay: 250,
      },
      {
        time: '14:36:48',
        html: '<span class="text-cream-200">claude-code</span> · exécution de <span class="text-cream-50">npm test</span> — <span class="text-danger">3 échecs</span>',
        delay: 600,
      },
      {
        time: '14:37:02',
        html: '<span class="text-warning">⚠ dérive de scope · <span class="text-warning/70">l\u2019agent a modifié package.json — hors du périmètre déclaré</span></span>',
        delay: 400,
      },
      {
        time: '14:37:45',
        html: '<span class="text-warning">⚠ contexte 65% · <span class="text-warning/70">l\u2019agent risque de perdre les instructions initiales — envisagez un checkpoint</span></span>',
        delay: 300,
      },
      {
        time: '14:38:01',
        html: '<span class="text-cream-200">$ conseil coût · <span class="text-cream-200/70">cette tâche pourrait tourner sur <span class="text-cream-50">sonnet</span> — ~3x moins cher pour des résultats similaires</span></span>',
        delay: 200,
      },
      {
        time: '14:38:03',
        html: '<span class="text-warning">⚠ boucle détectée · <span class="text-warning/70">édition → test → échec → édition — 4 cycles en 6 min</span></span>',
        delay: 500,
      },
    ],
  },
  openSource: {
    heading: 'Gratuit & open source',
    licenseBadge: 'Licence MIT',
    headline: 'vigie est open source. Utilisez-le, forkez-le, livrez-le.',
    description:
      'Monitoring local, détection de boucles, dérive de scope, garde-fous de coûts, checkpoints & rollback. Pas de paywall, pas de tier premium, pas de vendor lock-in. Votre machine, vos données, vos règles.',
    ctaGithub: 'Voir sur GitHub',
    byoaHeadline: 'Aucune marge sur vos tokens IA — jamais.',
    byoaDescription: 'Votre abonnement IA. Votre machine. Zéro intermédiaire.',
    agplJoke: 'AGPL\u00A0? À l\u2019ère des agents, toute licence est MIT.',
  },
  waitlist: {
    heading1: 'L\u2019IA écrit le code.',
    heading2: 'L\u2019œil sur l\u2019horizon.',
    description: 'Soyez les premiers informés du lancement de la bêta. Mettez une étoile sur ',
    githubLinkText: 'GitHub',
    emailLabel: 'Adresse email',
    emailPlaceholder: 'votre@email.com',
    ctaSubmit: 'Réserver ma place',
    ctaLoading: 'Envoi en cours\u2026',
    successMessage: '✓ Vous êtes sur la liste. On vous contacte dès l\u2019ouverture de la bêta.',
    errorMessage: 'Oups\u00A0! Quelque chose s\u2019est mal passé, réessayez',
    errorRateLimit: 'Trop d\u2019inscriptions, réessayez dans un instant',
    backButton: '← Retour',
    footerText:
      'Places limitées — pas de spam, juste votre invitation à l\u2019ouverture de la bêta.',
  },
  faq: {
    pageLabel: 'Questions & réponses',
    pageHeading: 'Foire aux questions',
    pageDescription:
      'Tout ce qu\u2019il faut savoir sur vigie — de la prise en main à la confidentialité et la licence.',
    categories: [
      {
        title: 'Prise en main',
        items: [
          {
            question: 'Qu\u2019est-ce que vigie\u00A0?',
            answer:
              'vigie est un daemon de monitoring local pour Claude Code. Il surveille chaque fichier modifié, chaque commande, chaque dollar dépensé. Il détecte les boucles, les dérives de scope et la surcharge de contexte avant qu\u2019elles ne vous coûtent du temps. Les checkpoints permettent de revenir en arrière avant tout déploiement.',
          },
          {
            question: 'Comment ça fonctionne\u00A0?',
            answer:
              'Lancez vigie start dans votre projet. Un daemon léger spawn Claude Code, capture chaque événement — éditions de fichiers, commandes shell, consommation de tokens — et les diffuse vers un dashboard temps réel. Aucun code ne quitte votre machine.',
          },
          {
            question: 'Que signifie «\u00A0local-first\u00A0»\u00A0?',
            answer:
              'Le daemon tourne entièrement sur votre machine. Il observe les métadonnées de session — fichiers touchés, commandes exécutées, nombre de tokens — mais ne lit ni ne stocke jamais votre code source. Le dashboard se connecte via un websocket local et ne fait que diffuser la sortie des commandes — votre code reste chez vous.',
          },
          {
            question: 'Comment installer vigie\u00A0?',
            answer:
              'vigie est actuellement en bêta privée. Inscrivez-vous sur la liste d\u2019attente pour un accès anticipé — vous recevrez les instructions d\u2019installation dès l\u2019ouverture de la bêta. L\u2019installation se fait en une seule commande.',
          },
          {
            question: 'Quels outils IA vigie supporte-t-il\u00A0?',
            answer:
              'Claude Code au lancement. OpenCode (qui supporte les licences Copilot), Codex CLI, Aider et Cline sont sur la roadmap. L\u2019architecture est agnostique par conception — si votre outil a un CLI, vigie peut le surveiller.',
          },
          {
            question: 'Quels sont les prérequis système\u00A0?',
            answer:
              'macOS ou Linux (Windows via WSL). Git installé. Claude Code comme CLI IA. Le daemon est léger et tourne en arrière-plan avec un minimum de CPU et de mémoire.',
          },
        ],
      },
      {
        title: 'Fonctionnalités',
        items: [
          {
            question: 'Que surveille vigie en temps réel\u00A0?',
            answer:
              'Chaque fichier lu, créé ou modifié. Chaque commande shell. La consommation de tokens, le pourcentage de fenêtre de contexte et le coût en cours. Le tout diffusé en direct dans votre dashboard.',
          },
          {
            question: 'Qu\u2019est-ce que la détection de boucle\u00A0?',
            answer:
              'vigie détecte les cycles édition\u2009→\u2009test\u2009→\u2009échec\u2009→\u2009édition où l\u2019agent répète le même pattern. Il signale la boucle dans le dashboard et suggère un prompt pour aider l\u2019agent à en sortir.',
          },
          {
            question: 'Qu\u2019est-ce que la dérive de scope\u00A0?',
            answer:
              'Quand votre agent commence à toucher des fichiers en dehors du périmètre déclaré pour la tâche, vigie le signale immédiatement. Vous voyez exactement quels fichiers ont été accédés hors scope pour corriger le tir avant que l\u2019agent ne dérive davantage.',
          },
          {
            question: 'Comment fonctionne le monitoring de fenêtre de contexte\u00A0?',
            answer:
              'Une jauge en direct montre la consommation de la fenêtre de contexte. À 65%+, vigie avertit que l\u2019agent risque de perdre les instructions initiales et suggère d\u2019ouvrir une nouvelle fenêtre depuis le dernier checkpoint.',
          },
          {
            question: 'Que sont les checkpoints & rollback\u00A0?',
            answer:
              'Les checkpoints sont des portes de validation qui prennent un snapshot de l\u2019état du projet. Si quelque chose tourne mal, vous revenez au dernier état stable et reprenez avec juste le contexte nécessaire — sans reprompting.',
          },
          {
            question: 'Peut-on surveiller plusieurs agents en parallèle\u00A0?',
            answer:
              'Oui. vigie supporte le monitoring de plusieurs agents simultanés, chacun avec son propre flux d\u2019activité dans le dashboard.',
          },
          {
            question: 'Comment fonctionne la conscience des coûts\u00A0?',
            answer:
              'Un compteur de coûts en direct suit les dépenses en temps réel. vigie suggère quand un modèle moins cher suffirait pour la tâche en cours. Vous pouvez définir des garde-fous budgétaires qui mettent la session en pause avant de dépasser un seuil.',
          },
        ],
      },
      {
        title: 'Licence & open source',
        items: [
          {
            question: 'vigie est-il vraiment gratuit\u00A0?',
            answer:
              'Oui. vigie est open source sous licence MIT. Toutes les fonctionnalités — monitoring, détection de boucle, dérive de scope, checkpoints, rollback, garde-fous de coûts — sont gratuites et le resteront. Pas de paywall, pas de tier premium.',
          },
          {
            question: 'Que signifie BYOA (Bring Your Own AI)\u00A0?',
            answer:
              'vigie ne touche jamais à vos tokens IA. Vous payez Claude (ou tout fournisseur supporté) directement à leurs tarifs standard. vigie est une couche de monitoring — pas de frais cachés par token et pas de vendor lock-in.',
          },
          {
            question: 'Pourquoi MIT et pas AGPL\u00A0?',
            answer:
              'À l\u2019ère des agents, toute licence est MIT. Les agents clonent, forkent et livrent du code plus vite qu\u2019aucune équipe compliance ne peut vérifier des headers. Nous avons choisi la licence qui correspond à la façon dont le logiciel est réellement construit aujourd\u2019hui — zéro friction, zéro piège.',
          },
          {
            question: 'Puis-je utiliser vigie dans mon entreprise\u00A0?',
            answer:
              'Oui. La licence MIT signifie que vous pouvez utiliser, modifier et distribuer vigie librement — à des fins commerciales ou non. Pas de CLA, pas de contributor agreement requis.',
          },
          {
            question: 'Qui construit vigie\u00A0?',
            answer:
              'vigie est construit par Tmonier SRL, une société de consulting freelance fondée par Damien Meur. Ceux qui tiennent la barre sont aussi ceux qui veillent.',
          },
        ],
      },
      {
        title: 'Confidentialité & sécurité',
        items: [
          {
            question: 'vigie accède-t-il à mon code source\u00A0?',
            answer:
              'Non. vigie observe uniquement les métadonnées de session — nombre de fichiers modifiés, consommation de tokens, pourcentage de fenêtre de contexte, durée de session. Il ne lit, n\u2019analyse et ne stocke jamais votre code source.',
          },
          {
            question: 'Quelles données vigie collecte-t-il\u00A0?',
            answer:
              'Nombre de tokens, pourcentages d\u2019utilisation de la fenêtre de contexte, durées de session, nombre de fichiers modifiés (pas leur contenu) et événements de checkpoint. Jamais le contenu des fichiers, les diffs, les prompts ou les réponses IA.',
          },
          {
            question: 'vigie est-il conforme au RGPD\u00A0?',
            answer:
              'Oui. vigie est local-first — vos données restent sur votre machine. Pour les fonctionnalités du dashboard hébergé, toutes les données sont traitées dans une infrastructure basée en UE.',
          },
          {
            question: 'Peut-on héberger vigie soi-même\u00A0?',
            answer:
              'Oui — c\u2019est open source. Clonez le repo, déployez sur votre propre infrastructure. Contrôle total sur la résidence des données, les politiques d\u2019accès et les intégrations.',
          },
          {
            question: 'vigie fonctionne-t-il avec des modèles locaux\u00A0?',
            answer:
              'Le support d\u2019Ollama est sur notre roadmap. Une fois disponible, vous pourrez lancer des sessions de coding entièrement privées où tout reste sur votre machine.',
          },
        ],
      },
      {
        title: 'Comparaison',
        items: [
          {
            question: 'En quoi vigie diffère de Claude Code seul\u00A0?',
            answer:
              'Claude Code vous donne la sortie brute de l\u2019agent. vigie ajoute un dashboard temps réel, la détection de boucle, les alertes de dérive de scope, le monitoring de fenêtre de contexte, le suivi des coûts, les checkpoints & rollback, et des prompts suggérés pour débloquer votre agent. C\u2019est la couche de visibilité qui rend Claude Code prévisible.',
          },
          {
            question: 'vigie remplace-t-il mon IDE ou mon terminal\u00A0?',
            answer:
              'Non. vigie est une couche de monitoring additive qui tourne à côté de vos outils existants. Vous continuez à utiliser votre IDE, votre terminal et Claude Code exactement comme avant. vigie surveille et alerte, c\u2019est tout.',
          },
        ],
      },
    ],
  },
  footer: {
    builtBy: 'Construit par',
    tagline: 'consulting freelance pour les équipes qui livrent avec l\u2019IA.',
    legal: 'Tmonier SRL · Bruxelles, Belgique',
  },
};

export default fr;
