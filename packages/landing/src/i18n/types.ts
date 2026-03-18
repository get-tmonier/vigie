export interface SiteContent {
  meta: {
    title: string;
    description: string;
    keywords: string;
  };
  nav: {
    approach: string;
    about: string;
    stack: string;
    experience: string;
    projects: string;
    vigie: string;
    contact: string;
  };
  hero: {
    fullName: string;
    tagline: string;
    name: string;
    oneLiner: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  origin: {
    pronunciation: string;
    grammar: string;
    alt: string;
    definition: string;
  };
  approach: {
    label: string;
    title: string;
    pitch: string;
    cards: {
      title: string;
      description: string;
    }[];
  };
  about: {
    label: string;
    title: string;
    paragraphs: string[];
    photoAlt: string;
    tags: string[];
  };
  stack: {
    label: string;
    title: string;
    terminalTitle: string;
    command: string;
    categories: {
      name: string;
      items: { name: string; years: number }[];
    }[];
    practices: {
      title: string;
      description: string;
      tags: string[];
    }[];
  };
  experience: {
    label: string;
    title: string;
    badgeEmployee: string;
    badgeInternship: string;
    badgeFounder: string;
    jobs: {
      period: string;
      company: string;
      missionAt?: string;
      type?: 'employee' | 'internship' | 'founder';
      role: string;
      location: string;
      description: string;
      bullets: string[];
      tags: string[];
    }[];
    references: string;
    projectsLabel: string;
    projectsTitle: string;
    projects: {
      period: string;
      name: string;
      builtAt?: string;
      type: string;
      description: string;
      tags: string[];
      link?: string;
    }[];
  };
  education: {
    label: string;
    title: string;
    degree: string;
    specialisation: string;
    school: string;
    period: string;
    distinction: string;
    languagesTitle: string;
    languages: string[];
  };
  flagship: {
    label: string;
    title: string;
    description: string;
    cta: string;
    terminalLines: string[];
  };
  contact: {
    label: string;
    title: string;
    availability: string;
    email: string;
    phone: string;
    cta: string;
  };
  footer: {
    company: string;
    tagline: string;
    copyright: string;
  };
  contactPage: {
    title: string;
    heading: string;
    subtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    subjectLabel: string;
    subjectPlaceholder: string;
    subjectOptions: { value: string; label: string }[];
    messageLabel: string;
    messagePlaceholder: string;
    submit: string;
    altText: string;
  };
}
