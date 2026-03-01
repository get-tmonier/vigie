import { Resvg } from '@resvg/resvg-js';
import type { APIRoute } from 'astro';
import satori from 'satori';

const GOLD = '#C49A2B';
const NAVY = '#0B1A2E';
const CREAM = '#F5F0E8';
const SLATE = '#8B9CAF';

async function fetchFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
    { headers: { 'User-Agent': 'curl/7.54.0' } }
  ).then((r) => r.text());
  const url = css.match(/src: url\(([^)]+)\)/)?.[1];
  if (!url) throw new Error(`Font URL not found for ${family}:${weight}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

// biome-ignore lint/suspicious/noExplicitAny: Satori VNode
type VNode = { type: string; props: Record<string, any> };
// biome-ignore lint/suspicious/noExplicitAny: Satori VNode
function h(type: string, props: Record<string, any>): VNode {
  return { type, props };
}

const wheelChildren: VNode[] = [
  h('circle', { cx: '32', cy: '32', r: '27', fill: 'none', stroke: GOLD, strokeWidth: '2.5' }),
  h('circle', { cx: '32', cy: '32', r: '19', fill: 'none', stroke: GOLD, strokeWidth: '2' }),
  h('circle', { cx: '32', cy: '32', r: '5.5', fill: GOLD }),
  h('line', {
    x1: '32',
    y1: '27',
    x2: '32',
    y2: '7',
    stroke: GOLD,
    strokeWidth: '2.5',
    strokeLinecap: 'round',
  }),
  h('ellipse', { cx: '32', cy: '6', rx: '2.2', ry: '3', fill: GOLD }),
  h('line', {
    x1: '36.6',
    y1: '29.8',
    x2: '51.3',
    y2: '15.1',
    stroke: GOLD,
    strokeWidth: '2.5',
    strokeLinecap: 'round',
  }),
  h('ellipse', {
    cx: '52.6',
    cy: '13.8',
    rx: '2.2',
    ry: '3',
    transform: 'rotate(45 52.6 13.8)',
    fill: GOLD,
  }),
  h('line', {
    x1: '37',
    y1: '32',
    x2: '57',
    y2: '32',
    stroke: GOLD,
    strokeWidth: '2.5',
    strokeLinecap: 'round',
  }),
  h('ellipse', {
    cx: '58',
    cy: '32',
    rx: '2.2',
    ry: '3',
    transform: 'rotate(90 58 32)',
    fill: GOLD,
  }),
  h('line', {
    x1: '36.6',
    y1: '34.2',
    x2: '51.3',
    y2: '48.9',
    stroke: GOLD,
    strokeWidth: '2.5',
    strokeLinecap: 'round',
  }),
  h('ellipse', {
    cx: '52.6',
    cy: '50.2',
    rx: '2.2',
    ry: '3',
    transform: 'rotate(135 52.6 50.2)',
    fill: GOLD,
  }),
  h('line', {
    x1: '32',
    y1: '37',
    x2: '32',
    y2: '57',
    stroke: GOLD,
    strokeWidth: '2.5',
    strokeLinecap: 'round',
  }),
  h('ellipse', { cx: '32', cy: '58', rx: '2.2', ry: '3', fill: GOLD }),
  h('line', {
    x1: '27.4',
    y1: '34.2',
    x2: '12.7',
    y2: '48.9',
    stroke: GOLD,
    strokeWidth: '2.5',
    strokeLinecap: 'round',
  }),
  h('ellipse', {
    cx: '11.4',
    cy: '50.2',
    rx: '2.2',
    ry: '3',
    transform: 'rotate(45 11.4 50.2)',
    fill: GOLD,
  }),
  h('line', {
    x1: '27',
    y1: '32',
    x2: '7',
    y2: '32',
    stroke: GOLD,
    strokeWidth: '2.5',
    strokeLinecap: 'round',
  }),
  h('ellipse', { cx: '6', cy: '32', rx: '2.2', ry: '3', transform: 'rotate(90 6 32)', fill: GOLD }),
  h('line', {
    x1: '27.4',
    y1: '29.8',
    x2: '12.7',
    y2: '15.1',
    stroke: GOLD,
    strokeWidth: '2.5',
    strokeLinecap: 'round',
  }),
  h('ellipse', {
    cx: '11.4',
    cy: '13.8',
    rx: '2.2',
    ry: '3',
    transform: 'rotate(135 11.4 13.8)',
    fill: GOLD,
  }),
];

function pill(label: string): VNode {
  return h('span', {
    style: {
      fontFamily: 'JetBrains Mono',
      fontSize: 13,
      fontWeight: 500,
      color: 'rgba(245,240,232,0.5)',
      backgroundColor: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 4,
      padding: '6px 14px',
    },
    children: label,
  });
}

function buildTree(): VNode {
  return h('div', {
    style: {
      width: '1200px',
      height: '630px',
      backgroundColor: NAVY,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '72px 96px',
      position: 'relative',
      overflow: 'hidden',
    },
    children: [
      // Watermark wheel (right side)
      h('div', {
        style: {
          position: 'absolute',
          right: '80px',
          top: '145px',
          width: '340px',
          height: '340px',
          opacity: 0.07,
          display: 'flex',
        },
        children: [
          h('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            viewBox: '0 0 64 64',
            width: '340',
            height: '340',
            children: wheelChildren,
          }),
        ],
      }),
      // Brand row
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '36px',
        },
        children: [
          h('span', {
            style: {
              fontFamily: 'Vollkorn SC',
              fontWeight: 900,
              fontSize: 42,
              color: GOLD,
              letterSpacing: '3px',
            },
            children: 'Tmonier',
          }),
          h('span', {
            style: {
              fontFamily: 'JetBrains Mono',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: 'rgba(139,156,175,0.5)',
            },
            children: 'You hold the helm.',
          }),
        ],
      }),
      // Headline
      h('div', {
        style: { display: 'flex', flexDirection: 'column', marginBottom: '28px' },
        children: [
          h('div', {
            style: {
              fontFamily: 'Vollkorn SC',
              fontWeight: 900,
              fontSize: 86,
              color: CREAM,
              lineHeight: 1.0,
            },
            children: 'Your crew.',
          }),
          h('div', {
            style: {
              fontFamily: 'Vollkorn SC',
              fontWeight: 900,
              fontSize: 86,
              color: CREAM,
              lineHeight: 1.0,
            },
            children: 'Under your watch.',
          }),
        ],
      }),
      // Sub
      h('div', {
        style: {
          fontFamily: 'JetBrains Mono',
          fontSize: 18,
          fontWeight: 500,
          color: SLATE,
          lineHeight: 1.6,
          maxWidth: '560px',
          marginBottom: '48px',
        },
        children: 'You launched the agent. Now what? Tmonier shows you — in real time.',
      }),
      // Pills
      h('div', {
        style: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
        children: [
          'Real-time monitoring',
          'Human-in-the-loop',
          'Local-first',
          'Zero markup',
        ].map(pill),
      }),
      // URL
      h('div', {
        style: {
          position: 'absolute',
          bottom: '48px',
          left: '96px',
          fontFamily: 'JetBrains Mono',
          fontSize: 14,
          fontWeight: 500,
          color: 'rgba(196,154,43,0.4)',
          letterSpacing: '2px',
        },
        children: 'tmonier.com',
      }),
      // Bottom border accent
      h('div', {
        style: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: 'rgba(196,154,43,0.4)',
        },
      }),
    ],
  });
}

export const GET: APIRoute = async () => {
  const [vollkornSC, jetbrainsMono] = await Promise.all([
    fetchFont('Vollkorn SC', 900),
    fetchFont('JetBrains Mono', 500),
  ]);

  // biome-ignore lint/suspicious/noExplicitAny: Satori accepts our VNode structure
  const svg = await satori(buildTree() as any, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Vollkorn SC', data: vollkornSC, weight: 900, style: 'normal' },
      { name: 'JetBrains Mono', data: jetbrainsMono, weight: 500, style: 'normal' },
    ],
  });

  const png = new Resvg(svg).render().asPng();

  return new Response(png, {
    headers: { 'Content-Type': 'image/png' },
  });
};
