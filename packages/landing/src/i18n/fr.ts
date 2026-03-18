import type { SiteContent } from './types';

const fr: SiteContent = {
  meta: {
    title: 'Tmonier — Ing\u00e9nieur Fullstack Senior \u00b7 Freelance \u00b7 Bruxelles',
    description:
      'Damien Meur — Ing\u00e9nieur Fullstack Senior disponible pour des missions freelance. TypeScript, React, Node.js, Effect-TS, PostgreSQL. Bas\u00e9 \u00e0 Bruxelles.',
    keywords:
      'd\u00e9veloppeur freelance, ing\u00e9nieur fullstack senior, TypeScript, React, Node.js, Bruxelles, Belgique, consultant',
  },
  nav: {
    approach: 'Approche',
    about: 'À propos de moi',
    stack: 'Stack',
    experience: 'Exp\u00e9rience',
    projects: 'Projets',
    vigie: 'Vigie',
    contact: 'Contact',
  },
  hero: {
    fullName: 'Damien Meur',
    tagline: 'You Keep The Helm.',
    name: 'Tmonier',
    oneLiner: 'Ing\u00e9nieur Fullstack Senior \u00b7 Freelance \u00b7 Bruxelles',
    ctaPrimary: 'Me contacter',
    ctaSecondary: 'Voir mon travail',
  },
  origin: {
    pronunciation: '/ti.m\u0254.nje/',
    grammar: '',
    alt: 'alt. Timonier',
    definition:
      'Le timonier \u2014 celui qui lit le vent, tient le cap et garde le navire sur sa route.',
  },
  approach: {
    label: 'Approche',
    title: 'Comment je travaille',
    pitch:
      'Je m\u2019int\u00e8gre \u00e0 votre \u00e9quipe, comprends votre domaine et livre du code production-ready. Pas de friction de handoff \u2014 je prends les features de l\u2019architecture au d\u00e9ploiement, avec du code propre et une communication claire \u00e0 chaque \u00e9tape.',
    cards: [
      {
        title: 'Architecture & Clart\u00e9',
        description:
          'Je vous aide \u00e0 faire les bons choix techniques. Mod\u00e8le de donn\u00e9es, contrats d\u2019API, design syst\u00e8me \u2014 j\u2019apporte l\u2019expertise pour que votre \u00e9quipe avance vite en confiance.',
      },
      {
        title: 'Livraison bout en bout',
        description:
          'Des requirements \u00e0 la production, je livre des features compl\u00e8tes. Vous gardez le contr\u00f4le de la roadmap \u2014 je m\u2019assure que ce qui part en prod est propre, test\u00e9 et livr\u00e9 dans les temps.',
      },
      {
        title: 'Votre Stack, Votre \u00c9quipe',
        description:
          'Je m\u2019adapte \u00e0 vos outils, vos processus et vos \u00e9quipes \u2014 mais je privil\u00e9gie le pair programming aux silos, la pair review aux aller-retours asynchrones. La collaboration directe, c\u2019est l\u00e0 que le meilleur travail se fait.',
      },
    ],
  },
  about: {
    label: 'À propos',
    title: 'Derrière le clavier',
    paragraphs: [
      "Moi c'est Damien — un curieux bricoleur depuis l'époque où je démontais tout ce qui avait un circuit imprimé à la maison (pardon, Maman). {{age}} ans, marié à l'extraordinaire Clara qui supporte mes nuits de codage, et papa fier de Basile qui me bat déjà aux jeux de société.",
      "Ce qui me passionne, c'est le craft. Proche de la communauté SoCraTes Belgium, je crois que du bon logiciel c'est du design propre, des boucles de feedback courtes, et la discipline de toujours apprendre. TDD, pair programming, refactoring continu — c'est ce qui me permet de dormir tranquille en sachant que mon code ne réveillera personne à 3h du mat'.",
      "L'arrivée de l'IA dans le dev ? Fascinant — mais quand des agents écrivent du code sans supervision, ça dérape vite. Fenêtre de contexte, logique hallucinée, érosion de la qualité. C'est pour ça que j'ai créé Vigie : plus nos outils deviennent puissants, plus on a besoin de contrôle. Quand je ne code pas, vous me trouverez en train de perdre à Terraforming Mars ou à explorer la dernière techno du moment.",
    ],
    photoAlt: 'Damien Meur — Ingénieur Fullstack Senior',
    tags: [
      'Software Craft',
      'SoCraTes Belgium',
      'Jeux de société',
      "Passionné d'IA",
      'Bidouilleur curieux',
    ],
  },
  stack: {
    label: 'Stack & M\u00e9thodes',
    title: 'Comment je construis',
    terminalTitle: 'zsh — ~/stack',
    command: 'cat stack.yml',
    categories: [
      {
        name: 'langages',
        items: [
          { name: 'TypeScript/JS', years: 10 },
          { name: 'Python', years: 5 },
          { name: 'PHP', years: 3 },
          { name: 'Kotlin', years: 1 },
        ],
      },
      {
        name: 'frontend',
        items: [
          { name: 'React', years: 6 },
          { name: 'Next.js', years: 4 },
          { name: 'Angular', years: 3 },
          { name: 'Vue', years: 2 },
          { name: 'Tailwind', years: 4 },
        ],
      },
      {
        name: 'backend',
        items: [
          { name: 'Node.js', years: 8 },
          { name: 'Effect-TS', years: 4 },
          { name: 'Hono', years: 1 },
          { name: 'Fastify', years: 4 },
          { name: 'Express', years: 6 },
          { name: 'Symfony', years: 3 },
          { name: 'Apache Pulsar', years: 2 },
          { name: 'Bun', years: 1 },
        ],
      },
      {
        name: 'donn\u00e9es',
        items: [
          { name: 'PostgreSQL', years: 6 },
          { name: 'SQL Server', years: 4 },
          { name: 'MongoDB', years: 1 },
          { name: 'Delta Lake', years: 1 },
          { name: 'PySpark', years: 1 },
          { name: 'DuckDB', years: 1 },
          { name: 'Elasticsearch', years: 1 },
        ],
      },
      {
        name: 'cloud',
        items: [
          { name: 'Azure', years: 4 },
          { name: 'Databricks', years: 1 },
          { name: 'Cloudflare', years: 2 },
          { name: 'GitHub Actions', years: 4 },
          { name: 'CI/CD', years: 8 },
          { name: 'Kubernetes', years: 2 },
        ],
      },
      {
        name: 'outillage',
        items: [
          { name: 'Git', years: 10 },
          { name: 'Docker', years: 6 },
        ],
      },
    ],
    practices: [
      {
        title: 'Architecture propre',
        description:
          'Architecture hexagonale, injection de d\u00e9pendances, fronti\u00e8res claires entre domaine et infrastructure. Du code facile \u00e0 tester, \u00e9tendre et transmettre.',
        tags: ['Hexagonal', 'DDD', 'DI', 'Clean Code'],
      },
      {
        title: 'Qualit\u00e9 d\u2019abord',
        description:
          'BDD et TDD ne sont pas des buzzwords \u2014 c\u2019est comme \u00e7a que je m\u2019assure que ce que je livre fonctionne vraiment. Les tests documentent l\u2019intention, attrapent les r\u00e9gressions et donnent confiance pour faire \u00e9voluer le code. Pair review plut\u00f4t qu\u2019aller-retours asynchrones.',
        tags: ['BDD', 'TDD', 'Pair Review', 'QA Minded'],
      },
      {
        title: 'Pens\u00e9e produit',
        description:
          'Je prends le temps de comprendre votre domaine en profondeur avant d\u2019\u00e9crire une ligne de code. Le bon engineering commence par les bonnes questions, pas le clavier le plus rapide.',
        tags: ['Analyse domaine', 'FSD', 'Pragmatisme'],
      },
      {
        title: 'Augment\u00e9 par l\u2019IA',
        description:
          'J\u2019utilise Claude Code et les outils de coding IA au quotidien \u2014 pas comme une b\u00e9quille, mais comme un multiplicateur. Je sais prompter, reviewer et piloter l\u2019output IA pour livrer plus vite sans sacrifier la qualit\u00e9.',
        tags: ['AI Workflows', 'Prompt Engineering'],
      },
    ],
  },
  experience: {
    label: 'Exp\u00e9rience',
    title: 'Parcours',
    jobs: [
      {
        period: 'Avr 2022 \u2013 Avr 2026',
        company: 'Aware',
        role: 'Senior Full Stack Developer',
        location: 'Bruxelles',
        description:
          'Plateforme de partage de données pour groupes agroalimentaires et chaînes de supermarchés, traitant des datasets opérationnels sur 4 marchés européens.',
        bullets: [
          'Développement de frontends React / Next.js et services backend TypeScript avec **architecture hexagonale** et Effect-TS',
          "Conception d'un framework ETL Python permettant à l'équipe de créer et maintenir 300+ pipelines Medallion bronze/silver/gold — **architecture propre**, injection de dépendances, contrôles qualité Pandera",
          "Mise en place d'un système ETL DuckDB embarqué directement dans le backend — avec **observabilité**, tooling DX-friendly et auto-refresh — réduisant les temps de chargement des analytics jusqu'à un facteur 100× sur toutes les pages de l'application",
          "**Mentorat de développeurs** et promotion d'une culture d'ownership, de partage de connaissances, de curiosité et de qualité au sein de l'équipe",
          "Gestion de l'infrastructure cloud Azure ; mise en place du **CI/CD** sur Azure DevOps avec tests automatisés et déploiement Databricks",
        ],
        tags: [
          'TypeScript',
          'React',
          'Next.js',
          'Effect-TS',
          'Fastify',
          'Python',
          'DuckDB',
          'SQL Server',
          'Azure',
          'Databricks',
          'PySpark',
        ],
      },
      {
        period: 'Nov 2020 \u2013 Avr 2022',
        company: 'Proxyclick',
        role: 'Full Stack Web Developer',
        location: 'Bruxelles',
        description:
          'Plateforme SaaS de gestion des visiteurs pour clients entreprise dans 100+ pays.',
        bullets: [
          'Développement et maintenance des fonctionnalités core (Node.js, Express, Angular)',
          "Travail au sein d'une **architecture microservices** avec communication inter-services via le broker Apache Pulsar",
          'Migration de modules frontend d\u2019AngularJS vers Angular avec TypeScript',
        ],
        tags: [
          'Angular',
          'TypeScript',
          'Node.js',
          'Express',
          'PostgreSQL',
          'Apache Pulsar',
          'Microservices',
        ],
      },
      {
        period: 'Avr 2020 \u2013 Oct 2020',
        company: 'Emisys',
        role: 'Full Stack Developer',
        location: 'Bruxelles',
        description:
          'Application de gestion d\u2019\u00e9v\u00e9nements utilis\u00e9e par les grands festivals belges.',
        bullets: [
          'D\u00e9veloppement de fonctionnalit\u00e9s de billetterie et planning',
          "Construit en PHP et JavaScript, servant **des milliers d'utilisateurs simultanés** pendant les événements",
        ],
        tags: ['PHP', 'JavaScript', 'PostgreSQL'],
      },
      {
        period: 'Sep 2019 \u2013 Avr 2020',
        company: 'mPhase',
        role: 'Full Stack Developer',
        location: 'Montr\u00e9al',
        description:
          'Outil logistique de traitement des eaux pour les op\u00e9rations municipales de Montr\u00e9al.',
        bullets: [
          "Construction de l'application complète from scratch — frontend Vue.js, API Node.js/Express, MongoDB",
          'Conception du **système de routage et planification géolocalisé**',
        ],
        tags: ['Vue.js', 'Node.js', 'Express', 'MongoDB'],
      },
      {
        period: 'Nov 2018 \u2013 Ao\u00fbt 2019',
        company: 'Extia',
        missionAt: 'Taktik',
        role: 'Full Stack Developer',
        location: 'Bruxelles',
        description:
          'Plateforme logicielle d\u2019exp\u00e9riences personnalis\u00e9es via IPTV et affichage digital.',
        bullets: [
          'Construction de dashboards de monitoring et syst\u00e8mes d\u2019alerting',
          'D\u00e9veloppement de services backend avec Spring Boot et Kotlin',
          'Implémentation du frontend Angular avec **visualisation de données temps réel**',
        ],
        tags: ['Kotlin', 'Spring Boot', 'Angular', 'PostgreSQL'],
      },
      {
        period: 'Juil 2018 \u2013 Nov 2018',
        company: 'Extia',
        missionAt: 'Bewan',
        role: 'Full Stack Developer',
        location: 'Bruxelles',
        description:
          'Plateforme CRM et gestion d\u2019\u00e9v\u00e9nements pour un expert en transition digitale dans l\u2019horeca.',
        bullets: [
          'Construction de fonctionnalit\u00e9s CRM et modules de gestion d\u2019\u00e9v\u00e9nements',
          'D\u00e9veloppement frontend en JavaScript vanilla/jQuery et backend PHP/Symfony',
        ],
        tags: ['JavaScript', 'jQuery', 'PHP', 'Symfony', 'PostgreSQL'],
      },
      {
        period: 'D\u00e9c 2017 \u2013 Juil 2018',
        company: 'IoTFactory',
        role: 'Full Stack Developer',
        location: 'Bruxelles',
        description: 'Gateway IoT Bluetooth/LoRa pour le tracking d\u2019assets sur site.',
        bullets: [
          'D\u00e9veloppement de services Python sur devices embarqu\u00e9s pour la communication temps r\u00e9el',
          'Construction du dashboard de gestion des devices et outils de monitoring',
          'D\u00e9ploiement et gestion des services sur Kubernetes',
        ],
        tags: ['Python', 'IoT', 'Bluetooth', 'LoRa', 'Kubernetes'],
      },
    ],
    projectsLabel: 'Projets',
    projectsTitle: 'Projets perso',
    projects: [
      {
        period: '2026',
        name: 'Vigie (Tmonier)',
        type: 'Fondateur \u00b7 Solo',
        description:
          'Supervision local-first d\u2019agents IA \u2014 monitoring temps r\u00e9el, d\u00e9tection de boucles, contr\u00f4le human-in-the-loop sur Claude Code. Bun daemon, Hono + Effect-TS, TanStack Start, PostgreSQL.',
        tags: ['TypeScript', 'Effect-TS', 'Hono', 'React', 'Bun', 'PostgreSQL'],
        link: 'https://vigie.tmonier.com',
      },
      {
        period: '2016 \u2013 2018',
        name: 'Autonomous Bar',
        type: 'Projet collaboratif',
        description:
          'Syst\u00e8me de bar en self-service complet : commandes, inventaire, comptabilit\u00e9, parrainage, cartes RFID (IoT), photobooth, machine \u00e0 cocktails, dashboards BI temps r\u00e9el.',
        tags: ['PHP', 'Symfony', 'Python', 'C', 'IoT', 'QlikView'],
      },
    ],
  },
  education: {
    label: 'Formation',
    title: 'Formation & Langues',
    degree: 'Bachelier en Informatique',
    school: 'Institut Paul Lambin, Bruxelles',
    period: '2015 \u2013 2018',
    distinction: 'Cum Laude',
    languagesTitle: 'Langues',
    languages: [
      'Fran\u00e7ais (langue maternelle)',
      'Anglais (courant)',
      'N\u00e9erlandais (interm\u00e9diaire)',
    ],
  },
  flagship: {
    label: 'Projet Phare',
    title: 'Vigie',
    description:
      'Une couche de supervision local-first pour les agents de coding IA. Visibilit\u00e9 temps r\u00e9el sur l\u2019activit\u00e9 de l\u2019agent, d\u00e9tection de boucles et de d\u00e9rives, garde-fous sur les co\u00fbts de tokens, checkpoints & rollback. Votre IA \u00e9crit le code \u2014 vous gardez la barre.',
    cta: 'D\u00e9couvrir le projet \u2192',
    terminalLines: [
      '$ vigie start',
      '\u2713 daemon running on localhost:4800',
      '  watching claude-code \u00b7 all events forwarded',
      '  local-first \u2014 vos donn\u00e9es ne quittent jamais votre machine',
    ],
  },
  contact: {
    label: 'Contact',
    title: 'Travaillons ensemble',
    availability: 'Disponible mai 2026 \u00b7 Remote ou Bruxelles',
    email: 'damien.meur@tmonier.com',
    phone: '+32 475 39 55 16',
    cta: 'Me contacter',
  },
  footer: {
    company: 'Tmonier \u00b7 Bruxelles, Belgique',
    tagline: 'You Keep The Helm.',
    copyright: '\u00a9 2026',
  },
  contactPage: {
    title: 'Contact \u2014 Tmonier',
    heading: 'Me contacter',
    subtitle:
      'Une mission freelance, une question technique, ou simplement envie de dire bonjour\u00a0? Je lis chaque message et r\u00e9ponds sous 24 heures.',
    nameLabel: 'Nom',
    namePlaceholder: 'Votre nom',
    emailLabel: 'Email',
    emailPlaceholder: 'votre@email.com',
    subjectLabel: 'Sujet',
    subjectPlaceholder: 'Choisir un sujet\u2026',
    subjectOptions: [
      { value: 'Mission freelance', label: 'Mission freelance' },
      { value: 'Consultation technique', label: 'Consultation technique' },
      { value: 'Projet Vigie', label: 'Projet Vigie' },
      { value: 'Autre', label: 'Autre' },
    ],
    messageLabel: 'Message',
    messagePlaceholder: 'Parlez-moi de votre projet...',
    submit: 'Envoyer le message',
    altText: 'Ou contactez-moi directement \u00e0',
  },
};

export default fr;
