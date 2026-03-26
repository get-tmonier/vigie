import type { SiteContent } from './types';

const en: SiteContent = {
  meta: {
    title: 'vigie — Open-Source AI Agent Supervision · by Tmonier',
    description:
      'Local-first agent supervisor for software engineers. Real-time visibility, drift detection, token cost guardrails, checkpoints & rollback.',
  },
  nav: {
    demo: 'Demo',
    openSource: 'Open source',
    faq: 'FAQ',
    github: 'GitHub',
  },
  hero: {
    pronunciation: '/vi.ʒi/',
    definition: 'the lookout in the crow\u2019s nest',
    tagline: 'Eyes on the horizon.',
    description:
      'Open-source AI agent supervision for engineers who ship.<br/>Real-time visibility, drift detection, cost guardrails.',
    ctaGithub: 'View on GitHub',
    ctaWaitlist: 'Join the waitlist',
  },
  toolsStrip: {
    label: 'Your AI',
    comingSoon:
      'Coming soon: OpenCode <span class="text-vigie-400/50">&#9679;</span> supports Copilot license since Jan 2026 <span class="pl-2 text-cream-200/30">|</span><span class="pl-2">Codex, Aider, Cline & more</span>',
  },
  openSource: {
    heading: 'Free & open source',
    licenseBadge: 'MIT License',
    headline: 'vigie is open source. Use it, fork it, ship it.',
    description:
      'Local-first monitoring, loop detection, scope drift, cost guardrails, checkpoints & rollback. No paywall, no premium tier, no vendor lock-in. Your machine, your data, your rules.',
    ctaGithub: 'View on GitHub',
    byoaHeadline: 'No AI token markup \u2014 ever.',
    byoaDescription: 'Your AI subscription. Your machine. Zero middlemen.',
    agplJoke: 'AGPL\u00A0? In the agent era, every license is MIT.',
  },
  waitlist: {
    heading1: 'AI writes the code.',
    heading2: 'Eyes on the horizon.',
    description: 'Be the first to know when the beta drops. Star us on ',
    githubLinkText: 'GitHub',
    emailLabel: 'Email address',
    emailPlaceholder: 'your@email.com',
    ctaSubmit: 'Claim your spot',
    ctaLoading: 'Sending\u2026',
    successMessage: '\u2713 You\u2019re on the list. We\u2019ll be in touch when the beta opens.',
    errorMessage: 'Oops! Something went wrong, please try again',
    errorRateLimit: 'Too many signups, please try again in a little while',
    backButton: '\u2190 Back',
    footerText: 'Limited spots \u2014 no spam, just your invite when the beta opens.',
  },
  faq: {
    pageLabel: 'Questions & answers',
    pageHeading: 'Frequently asked questions',
    pageDescription:
      'Everything you need to know about vigie \u2014 from getting started to privacy and licensing.',
    categories: [
      {
        title: 'Getting started',
        items: [
          {
            question: 'What is vigie?',
            answer:
              'vigie is a local-first monitoring daemon for Claude Code. It watches every file change, every command, every dollar spent. It catches loops, scope drift, and context bloat before they waste your time. Checkpoints let you roll back before anything ships.',
          },
          {
            question: 'How does it work?',
            answer:
              'Run vigie start in your project. A lightweight daemon spawns Claude Code, captures every event \u2014 file edits, shell commands, token usage \u2014 and streams them to a real-time dashboard. No code leaves your machine.',
          },
          {
            question: 'What does \u201Clocal-first\u201D mean?',
            answer:
              'The daemon runs entirely on your machine. It observes session metadata \u2014 files touched, commands run, token counts \u2014 but never reads or stores your source code. The dashboard connects via a local websocket and just streams command output \u2014 your codebase stays on your machine.',
          },
          {
            question: 'How do I install vigie?',
            answer:
              'vigie is currently in private beta. Join the waitlist to get early access \u2014 you\u2019ll receive install instructions as soon as the beta opens. Installation is a single command.',
          },
          {
            question: 'Which AI tools does vigie support?',
            answer:
              'Claude Code at launch. OpenCode (which supports Copilot licenses), Codex CLI, Aider, and Cline are on the roadmap. The architecture is CLI-agnostic by design \u2014 if your tool has a CLI, vigie can monitor it.',
          },
          {
            question: 'What are the system requirements?',
            answer:
              'macOS or Linux (Windows via WSL). Git installed. Claude Code as your AI CLI. The daemon is lightweight and runs in the background with minimal CPU and memory overhead.',
          },
        ],
      },
      {
        title: 'Features',
        items: [
          {
            question: 'What does vigie monitor in real time?',
            answer:
              'Every file read, created, or edited. Every shell command. Token usage, context window percentage, and running cost. All streamed live to your dashboard as events happen.',
          },
          {
            question: 'What is loop detection?',
            answer:
              'vigie detects edit\u2009\u2192\u2009test\u2009\u2192\u2009fail\u2009\u2192\u2009edit cycles where the agent is stuck repeating the same pattern. It flags the loop in your dashboard and suggests a prompt to help the agent break out.',
          },
          {
            question: 'What is scope drift?',
            answer:
              'When your agent starts touching files outside the scope you declared for the task, vigie flags it immediately. You see exactly which files were accessed outside scope so you can course-correct before the agent goes further off track.',
          },
          {
            question: 'How does context window monitoring work?',
            answer:
              'A live gauge shows how much of the context window is consumed. At 65%+ vigie warns that the agent may start losing early instructions and suggests opening a fresh window from your last checkpoint.',
          },
          {
            question: 'What are checkpoints & rollback?',
            answer:
              'Checkpoints are approval gates that snapshot your project state. If something goes wrong, you roll back to the last clean state and resume with just the necessary context \u2014 no reprompting needed.',
          },
          {
            question: 'Can I monitor multiple agents at once?',
            answer:
              'Yes. vigie supports monitoring multiple concurrent agents, each with its own activity stream in the dashboard.',
          },
          {
            question: 'How does cost awareness work?',
            answer:
              'A live cost counter tracks spending in real time. vigie hints when a cheaper model would suffice for the current task. You can set budget guardrails that pause the session before exceeding a threshold.',
          },
        ],
      },
      {
        title: 'License & open source',
        items: [
          {
            question: 'Is vigie really free?',
            answer:
              'Yes. vigie is open source under the MIT license. All features \u2014 monitoring, loop detection, scope drift, checkpoints, rollback, cost guardrails \u2014 are free and always will be. No paywall, no premium tier.',
          },
          {
            question: 'What does BYOA (Bring Your Own AI) mean?',
            answer:
              'vigie never touches your AI tokens. You pay Claude (or any supported provider) directly at their standard rates. vigie is a monitoring layer \u2014 there\u2019s no hidden per-token fee and no vendor lock-in.',
          },
          {
            question: 'Why MIT and not AGPL?',
            answer:
              'In the agent era, every license is MIT. Agents clone, fork, and ship code faster than any compliance team can review headers. We chose the license that matches how software is actually built today \u2014 no friction, no gotchas.',
          },
          {
            question: 'Can I use vigie in my company?',
            answer:
              'Yes. MIT license means you can use, modify, and distribute vigie freely \u2014 commercially or otherwise. No CLA, no contributor agreement required.',
          },
          {
            question: 'Who builds vigie?',
            answer:
              'vigie is built by Tmonier SRL, a freelance software consultancy founded by Damien Meur. The same people who steer the ship also keep watch.',
          },
        ],
      },
      {
        title: 'Privacy & security',
        items: [
          {
            question: 'Does vigie access my source code?',
            answer:
              'No. vigie observes session metadata only \u2014 file-change counts, token usage, context window percentage, session duration. It never reads, parses, or stores your source code.',
          },
          {
            question: 'What data does vigie collect?',
            answer:
              'Token counts, context window utilisation percentages, session durations, file-change counts (not contents), and checkpoint events. Never file contents, diffs, prompts, or AI responses.',
          },
          {
            question: 'Is vigie GDPR compliant?',
            answer:
              'Yes. vigie is local-first \u2014 your data stays on your machine. For hosted dashboard features, all data is processed in EU-based infrastructure.',
          },
          {
            question: 'Can I self-host vigie?',
            answer:
              'Yes \u2014 it\u2019s open source. Clone the repo, deploy on your own infrastructure. Full control over data residency, access policies, and integrations.',
          },
          {
            question: 'Does vigie work with local models?',
            answer:
              'Ollama support is on our roadmap. Once available, you\u2019ll be able to run fully private coding sessions where everything stays on your machine.',
          },
        ],
      },
      {
        title: 'How it compares',
        items: [
          {
            question: 'How is vigie different from just using Claude Code?',
            answer:
              'Claude Code gives you raw agent output. vigie adds a real-time dashboard, loop detection, scope drift alerts, context window monitoring, cost tracking, checkpoints & rollback, and suggested prompts to unblock your agent. It\u2019s the visibility layer that makes Claude Code predictable.',
          },
          {
            question: 'Does vigie replace my IDE or terminal?',
            answer:
              'No. vigie is an additive monitoring layer that runs alongside your existing tools. You keep using your IDE, terminal, and Claude Code exactly as before. vigie just watches and alerts.',
          },
        ],
      },
    ],
  },
  footer: {
    builtBy: 'Built by',
    tagline: 'freelance software consulting for teams that ship with AI.',
    legal: 'Tmonier SRL \u00B7 Brussels, Belgium',
  },
};

export default en;
