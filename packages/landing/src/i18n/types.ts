export interface SiteContent {
  meta: { title: string; description: string };
  nav: { demo: string; openSource: string; faq: string; github: string };
  hero: {
    pronunciation: string;
    definition: string;
    tagline: string;
    description: string;
    ctaGithub: string;
    ctaWaitlist: string;
  };
  toolsStrip: {
    label: string;
    comingSoon: string;
  };
  demo: {
    terminal: {
      title: string;
      command: string;
      daemonRunning: string;
      watching: string;
      localFirst: string;
    };
    sidebar: { agents: string; runs: string; settings: string };
    main: {
      taskTitle: string;
      badgeActive: string;
      contextLabel: string;
      contextAction: string;
      activityLabel: string;
    };
    actionPanel: {
      header: string;
      suggestedPromptLabel: string;
      suggestedPrompt: string;
      btnRollback: string;
      btnResume: string;
      btnStop: string;
    };
    logs: Array<{ time: string; html: string; delay: number }>;
  };
  openSource: {
    heading: string;
    licenseBadge: string;
    headline: string;
    description: string;
    ctaGithub: string;
    byoaHeadline: string;
    byoaDescription: string;
    agplJoke: string;
  };
  waitlist: {
    heading1: string;
    heading2: string;
    description: string;
    githubLinkText: string;
    emailLabel: string;
    emailPlaceholder: string;
    ctaSubmit: string;
    ctaLoading: string;
    successMessage: string;
    errorMessage: string;
    errorRateLimit: string;
    backButton: string;
    footerText: string;
  };
  faq: {
    pageLabel: string;
    pageHeading: string;
    pageDescription: string;
    categories: Array<{
      title: string;
      items: Array<{ question: string; answer: string }>;
    }>;
  };
  footer: {
    builtBy: string;
    tagline: string;
    legal: string;
  };
}
