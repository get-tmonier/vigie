// Radar mark geometry — single source of truth for all SVG renderings
export const radar = {
  viewBox: '0 0 64 64',
  cx: 32,
  cy: 32,
  outerR: 24,
  middleR: 16,
  innerR: 8,
  centerR: 3.5,
  rays: [
    { x1: 32, y1: 8, x2: 32, y2: 2 },
    { x1: 52.8, y1: 20, x2: 57.4, y2: 16.4 },
    { x1: 52.8, y1: 44, x2: 57.4, y2: 47.6 },
  ],
  gradient: { start: '#4ECFB0', end: '#178A6A' },
} as const;

export const colors = {
  navy900: '#0A1628',
  navy800: '#0F2035',
  navy700: '#162D4A',
  navy600: '#1E3A5F',
  brass400: '#D4AA3C',
  cream50: '#FDF8F0',
  cream100: '#F5EDE0',
  cream200: '#E8DCC8',
  vigie50: '#E8F8F5',
  vigie100: '#B2EBE0',
  vigie200: '#7DDDC8',
  vigie300: '#4ECFB0',
  vigie400: '#26C09A',
  vigie500: '#1FA882',
  vigie600: '#178A6A',
  vigie700: '#106B52',
  vigie800: '#094D3B',
  warning: '#F0A030',
  danger: '#E24B4A',
  success: '#26C09A',
  idle: '#162D4A',
} as const;

export const fonts = {
  display: '"Instrument Serif", serif',
  body: '"DM Sans", sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;
