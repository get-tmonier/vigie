import type { SiteContent } from './types';

const en: SiteContent = {
  meta: {
    title: 'Tmonier — Senior Fullstack Engineer · Freelance · Brussels',
    description:
      'Damien Meur — Senior Fullstack Engineer available for freelance missions. TypeScript, React, Node.js, Effect-TS, PostgreSQL. Based in Brussels.',
    keywords:
      'freelance developer, senior fullstack engineer, TypeScript, React, Node.js, Brussels, Belgium, consultant',
  },
  nav: {
    approach: 'Approach',
    stack: 'Stack',
    experience: 'Experience',
    projects: 'Projects',
    vigie: 'Vigie',
    contact: 'Contact',
  },
  hero: {
    fullName: 'Damien Meur',
    tagline: 'You Keep The Helm.',
    name: 'Tmonier',
    oneLiner: 'Senior Fullstack Engineer · Freelance · Brussels',
    ctaPrimary: 'Get in touch',
    ctaSecondary: 'See my work',
  },
  origin: {
    pronunciation: '/ti.m\u0254.nje/',
    grammar: '',
    alt: 'alt. Timonier',
    definition:
      'The helmsman \u2014 the one who reads the wind, holds the course, and keeps the ship on track.',
  },
  approach: {
    label: 'Approach',
    title: 'How I work',
    pitch:
      'I embed in your team, understand your domain, and ship production-ready code. No hand-off friction — I take features from architecture to deployment, with clean code and clear communication at every step.',
    cards: [
      {
        title: 'Architecture & Clarity',
        description:
          'I help you make solid technical choices. Data modelling, API contracts, system design \u2014 I bring the expertise so your team can move fast with confidence.',
      },
      {
        title: 'End-to-End Delivery',
        description:
          'From requirements to production, I deliver complete features. You stay in control of the roadmap \u2014 I make sure what ships is clean, tested, and shipped on time.',
      },
      {
        title: 'Your Stack, Your Team',
        description:
          'I adapt to your tools, your processes, and your people \u2014 but I value pair programming over solo silos, pair reviews over async back-and-forth. Direct collaboration is where the best work happens.',
      },
    ],
  },
  stack: {
    label: 'Stack & Practices',
    title: 'How I Build',
    terminalTitle: 'zsh — ~/stack',
    command: 'cat stack.yml',
    categories: [
      {
        name: 'languages',
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
        name: 'data',
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
        name: 'tooling',
        items: [
          { name: 'Git', years: 10 },
          { name: 'Docker', years: 6 },
        ],
      },
    ],
    practices: [
      {
        title: 'Clean Architecture',
        description:
          'Hexagonal architecture, dependency injection, clear boundaries between domain and infrastructure. Code that\u2019s easy to test, extend, and hand off.',
        tags: ['Hexagonal', 'DDD', 'DI', 'Clean Code'],
      },
      {
        title: 'Quality-Driven',
        description:
          'BDD and TDD aren\u2019t buzzwords \u2014 they\u2019re how I make sure what I ship actually works. Tests document intent, catch regressions, and give your team confidence to change things. Pair reviews over async back-and-forth.',
        tags: ['BDD', 'TDD', 'Pair Review', 'QA Minded'],
      },
      {
        title: 'Product Thinking',
        description:
          'I take the time to understand your domain deeply before writing a line of code. Good engineering starts with the right questions, not the fastest keyboard.',
        tags: ['Domain Analysis', 'FSD', 'Pragmatism'],
      },
      {
        title: 'AI-Augmented',
        description:
          'I use Claude Code and AI coding tools daily \u2014 not as a crutch, but as a multiplier. I know how to prompt, review, and steer AI output to ship faster without sacrificing quality.',
        tags: ['AI Workflows', 'Prompt Engineering'],
      },
    ],
  },
  experience: {
    label: 'Experience',
    title: 'Track Record',
    jobs: [
      {
        period: 'Apr 2022 \u2013 Apr 2026',
        company: 'Aware',
        role: 'Senior Full Stack Developer',
        location: 'Brussels',
        description:
          'Data-sharing platform for food industry groups and supermarket chains to exchange and process operational datasets across 4 European markets.',
        bullets: [
          'Developed React / Next.js frontends and TypeScript backend services with hexagonal architecture and Effect-TS',
          'Designed a Python ETL framework enabling the team to create and maintain 300+ bronze/silver/gold Medallion pipelines \u2014 clean architecture, dependency injection, and Pandera data quality checks',
          'Built an embedded DuckDB ETL system directly in the backend \u2014 with observability, DX-friendly tooling, and auto-refresh \u2014 reducing analytics load times by up to 100x across all application pages',
          'Mentored junior developers and fostered a culture of ownership, knowledge sharing, curiosity, and quality across the team',
          'Managed Azure cloud infrastructure; set up CI/CD on Azure DevOps with automated testing and Databricks deployment',
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
        period: 'Nov 2020 \u2013 Apr 2022',
        company: 'Proxyclick',
        role: 'Full Stack Web Developer',
        location: 'Brussels',
        description:
          'SaaS visitor management platform serving enterprise clients across 100+ countries.',
        bullets: [
          'Developed and maintained core platform features (Node.js, Express, Angular)',
          'Worked within a microservices architecture with inter-service communication via Apache Pulsar message broker',
          'Migrated frontend modules from AngularJS to Angular with TypeScript',
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
        period: '2020',
        company: 'Emisys',
        role: 'Full Stack Developer',
        location: 'Brussels',
        description: 'Event management application used by major Belgian festivals.',
        bullets: [
          'Developed ticketing and scheduling features',
          'Built with PHP and JavaScript, serving thousands of concurrent users during events',
        ],
        tags: ['PHP', 'JavaScript', 'PostgreSQL'],
      },
      {
        period: '2019 \u2013 2020',
        company: 'mPhase',
        role: 'Full Stack Developer',
        location: 'Montreal',
        description: 'Water treatment logistics tool for Montreal municipal operations.',
        bullets: [
          'Built the full application from scratch \u2014 Vue.js frontend, Node.js/Express API, MongoDB',
          'Designed geolocation-based routing and scheduling system',
        ],
        tags: ['Vue.js', 'Node.js', 'Express', 'MongoDB'],
      },
      {
        period: '2018 \u2013 2019',
        company: 'Extia \u2192 Taktik',
        role: 'Full Stack Developer',
        location: 'Brussels',
        description:
          'Software platform delivering personalized experiences through IPTV and digital signage solutions.',
        bullets: [
          'Built monitoring dashboards and alerting systems',
          'Developed backend services with Spring Boot and Kotlin',
          'Implemented Angular frontend with real-time data visualization',
        ],
        tags: ['Kotlin', 'Spring Boot', 'Angular', 'PostgreSQL'],
      },
      {
        period: '2018',
        company: 'Extia \u2192 Bewan',
        role: 'Full Stack Developer',
        location: 'Brussels',
        description:
          'CRM and event management platform for a digital transition expert in the hospitality industry.',
        bullets: [
          'Built CRM features and event management modules',
          'Developed frontend with vanilla JavaScript/jQuery and backend with PHP/Symfony',
        ],
        tags: ['JavaScript', 'jQuery', 'PHP', 'Symfony', 'PostgreSQL'],
      },
      {
        period: '2017 \u2013 2018',
        company: 'IoTFactory',
        role: 'Full Stack Developer',
        location: 'Brussels',
        description: 'Bluetooth/LoRa IoT gateway for on-site asset tracking.',
        bullets: [
          'Developed Python services on embedded devices for real-time device communication',
          'Built device management dashboard and monitoring tools',
          'Deployed and managed services on Kubernetes',
        ],
        tags: ['Python', 'IoT', 'Bluetooth', 'LoRa', 'Kubernetes'],
      },
    ],
    projectsLabel: 'Projects',
    projectsTitle: 'Side Projects',
    projects: [
      {
        period: '2026',
        name: 'Vigie (Tmonier)',
        type: 'Founder \u00b7 Solo',
        description:
          'Local-first AI agent supervision \u2014 real-time monitoring, loop detection, human-in-the-loop control over Claude Code. Built with Bun daemon, Hono + Effect-TS, TanStack Start, PostgreSQL.',
        tags: ['TypeScript', 'Effect-TS', 'Hono', 'React', 'Bun', 'PostgreSQL'],
        link: 'https://vigie.tmonier.com',
      },
      {
        period: '2016 \u2013 2018',
        name: 'Autonomous Bar',
        type: 'Collaborative project',
        description:
          'Full self-service bar system: orders, inventory, accounting, referral engine, RFID cards (IoT), photobooth, cocktail machine, real-time BI dashboards.',
        tags: ['PHP', 'Symfony', 'Python', 'C', 'IoT', 'QlikView'],
      },
    ],
  },
  education: {
    label: 'Education',
    title: 'Education & Languages',
    degree: 'Bachelor in Computer Science',
    school: 'Institut Paul Lambin, Brussels',
    period: '2015 \u2013 2018',
    distinction: 'Cum Laude',
    languagesTitle: 'Languages',
    languages: ['French (native)', 'English (fluent)', 'Dutch (intermediate)'],
  },
  flagship: {
    label: 'Flagship Project',
    title: 'Vigie',
    description:
      'A local-first supervision layer for AI coding agents. Real-time visibility into agent activity, loop & drift detection, token cost guardrails, checkpoints & rollback. Your AI writes the code \u2014 you keep the helm.',
    cta: 'Discover the project \u2192',
    terminalLines: [
      '$ vigie start',
      '\u2713 daemon running on localhost:4800',
      '  watching claude-code \u00b7 all events forwarded',
      '  local-first \u2014 your data never leaves your machine',
    ],
  },
  contact: {
    label: 'Contact',
    title: 'Let\u2019s work together',
    availability: 'Available May 2026 \u00b7 Remote or Brussels',
    email: 'damien.meur@tmonier.com',
    cta: 'Get in touch',
  },
  footer: {
    company: 'Tmonier \u00b7 Brussels, Belgium',
    tagline: 'You Keep The Helm.',
    copyright: '\u00a9 2026',
  },
  contactPage: {
    title: 'Contact \u2014 Tmonier',
    heading: 'Get in touch',
    subtitle:
      'A freelance mission, a technical question, or just want to say hi? I read every message and reply within 24 hours.',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email',
    emailPlaceholder: 'your@email.com',
    subjectLabel: 'Subject',
    subjectPlaceholder: 'Select a topic\u2026',
    subjectOptions: [
      { value: 'Freelance mission', label: 'Freelance mission' },
      { value: 'Technical consultation', label: 'Technical consultation' },
      { value: 'Vigie project', label: 'Vigie project' },
      { value: 'Other', label: 'Other' },
    ],
    messageLabel: 'Message',
    messagePlaceholder: 'Tell me about your project...',
    submit: 'Send message',
    altText: 'Or reach me directly at',
  },
};

export default en;
