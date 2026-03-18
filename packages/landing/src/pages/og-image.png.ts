import { Resvg } from '@resvg/resvg-js';
import type { APIRoute } from 'astro';
import satori from 'satori';

const GOLD = '#C49A2B';
const NAVY = '#0B1A2E';
const CREAM = '#F5F0E8';
const SLATE = 'rgba(139,156,175,0.75)';

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

// WheelMark SVG — same math as WheelMark.astro
const cx = 32;
const cy = 32;
const angles = [0, 45, 90, 135, 180, 225, 270, 315];
function toRad(deg: number) {
  return ((deg - 90) * Math.PI) / 180;
}
function p(r: number, deg: number) {
  const rad = toRad(deg);
  return `${(cx + r * Math.cos(rad)).toFixed(1)},${(cy + r * Math.sin(rad)).toFixed(1)}`;
}
const spokesD = angles.map((a) => `M${p(8, a)} L${p(22, a)}`).join(' ');
const handlesD = angles.map((a) => `M${p(19, a)} L${p(31, a)}`).join(' ');

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
  // Helm center: right=60+220=280 from right → x=920, y=95+220=315
  const helmCx = 920;
  const helmCy = 315;

  return h('div', {
    style: {
      width: '1200px',
      height: '630px',
      background: `radial-gradient(ellipse at 77% 50%, rgba(196,154,43,0.11) 0%, transparent 52%), ${NAVY}`,
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
    },
    children: [
      // Concentric rings — radar effect, centered on helm
      ...[580, 460, 350].map((d) =>
        h('div', {
          style: {
            position: 'absolute',
            left: `${helmCx - d / 2}px`,
            top: `${helmCy - d / 2}px`,
            width: `${d}px`,
            height: `${d}px`,
            borderRadius: '50%',
            border: `1px solid rgba(196,154,43,${d === 580 ? 0.07 : d === 460 ? 0.1 : 0.13})`,
          },
        })
      ),
      // Vertical separator line
      h('div', {
        style: {
          position: 'absolute',
          left: '640px',
          top: '60px',
          width: '1px',
          height: '510px',
          background: `linear-gradient(to bottom, transparent, rgba(196,154,43,0.25) 25%, rgba(196,154,43,0.25) 75%, transparent)`,
        },
      }),
      // Left accent bar
      h('div', {
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          backgroundColor: GOLD,
          opacity: 0.6,
        },
      }),
      // Bottom accent line
      h('div', {
        style: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: GOLD,
          opacity: 0.3,
        },
      }),
      // Helm — right side, prominent
      h('div', {
        style: {
          position: 'absolute',
          right: '60px',
          top: '95px',
          width: '440px',
          height: '440px',
          opacity: 0.22,
          display: 'flex',
        },
        children: [
          h('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            viewBox: '0 0 64 64',
            width: '440',
            height: '440',
            children: [
              h('path', {
                d: spokesD,
                fill: 'none',
                stroke: GOLD,
                strokeWidth: '2',
                strokeLinecap: 'round',
              }),
              h('circle', {
                cx: '32',
                cy: '32',
                r: '22',
                fill: 'none',
                stroke: GOLD,
                strokeWidth: '3',
              }),
              h('circle', {
                cx: '32',
                cy: '32',
                r: '12',
                fill: 'none',
                stroke: GOLD,
                strokeWidth: '2',
              }),
              h('circle', {
                cx: '32',
                cy: '32',
                r: '6.5',
                fill: 'none',
                stroke: GOLD,
                strokeWidth: '1.5',
              }),
              h('circle', { cx: '32', cy: '32', r: '3', fill: GOLD }),
              h('path', {
                d: handlesD,
                fill: 'none',
                stroke: GOLD,
                strokeWidth: '4',
                strokeLinecap: 'round',
              }),
            ],
          }),
        ],
      }),
      // Content
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 96px',
          width: '680px',
        },
        children: [
          // Brand row: small helm + label
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '32px',
            },
            children: [
              h('svg', {
                xmlns: 'http://www.w3.org/2000/svg',
                viewBox: '0 0 64 64',
                width: '48',
                height: '48',
                children: [
                  h('path', {
                    d: spokesD,
                    fill: 'none',
                    stroke: GOLD,
                    strokeWidth: '2',
                    strokeLinecap: 'round',
                  }),
                  h('circle', {
                    cx: '32',
                    cy: '32',
                    r: '22',
                    fill: 'none',
                    stroke: GOLD,
                    strokeWidth: '3',
                  }),
                  h('circle', {
                    cx: '32',
                    cy: '32',
                    r: '12',
                    fill: 'none',
                    stroke: GOLD,
                    strokeWidth: '2',
                  }),
                  h('circle', {
                    cx: '32',
                    cy: '32',
                    r: '6.5',
                    fill: 'none',
                    stroke: GOLD,
                    strokeWidth: '1.5',
                  }),
                  h('circle', { cx: '32', cy: '32', r: '3', fill: GOLD }),
                  h('path', {
                    d: handlesD,
                    fill: 'none',
                    stroke: GOLD,
                    strokeWidth: '4',
                    strokeLinecap: 'round',
                  }),
                ],
              }),
              h('div', {
                style: {
                  fontFamily: 'Vollkorn SC',
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: '3px',
                  color: GOLD,
                },
                children: 'Tmonier',
              }),
              h('div', {
                style: {
                  fontFamily: 'Vollkorn',
                  fontSize: 16,
                  fontWeight: 700,
                  fontStyle: 'italic',
                  color: `rgba(196,154,43,0.5)`,
                  letterSpacing: '0.5px',
                  marginTop: '6px',
                },
                children: 'You keep the helm.',
              }),
            ],
          }),
          // Name
          h('div', {
            style: {
              fontFamily: 'Vollkorn',
              fontWeight: 700,
              fontSize: 68,
              color: CREAM,
              lineHeight: 1.1,
              marginBottom: '20px',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            },
            children: 'Damien Meur',
          }),
          // Divider
          h('div', {
            style: {
              width: '64px',
              height: '2px',
              backgroundColor: GOLD,
              marginBottom: '24px',
              opacity: 0.7,
            },
          }),
          // Role
          h('div', {
            style: {
              fontFamily: 'JetBrains Mono',
              fontSize: 22,
              fontWeight: 500,
              color: SLATE,
              marginBottom: '10px',
            },
            children: 'Senior Fullstack Engineer',
          }),
          // Location
          h('div', {
            style: {
              fontFamily: 'JetBrains Mono',
              fontSize: 16,
              fontWeight: 500,
              color: `rgba(196,154,43,0.55)`,
              letterSpacing: '2px',
            },
            children: 'Freelance · Brussels',
          }),
        ],
      }),
    ],
  });
}

export const GET: APIRoute = async () => {
  const [vollkornSC, vollkorn, jetbrainsMono] = await Promise.all([
    fetchFont('Vollkorn SC', 900),
    fetchFont('Vollkorn', 700),
    fetchFont('JetBrains Mono', 500),
  ]);

  // biome-ignore lint/suspicious/noExplicitAny: Satori accepts our VNode structure
  const svg = await satori(buildTree() as any, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Vollkorn SC', data: vollkornSC, weight: 900, style: 'normal' },
      { name: 'Vollkorn', data: vollkorn, weight: 700, style: 'normal' },
      { name: 'JetBrains Mono', data: jetbrainsMono, weight: 500, style: 'normal' },
    ],
  });

  const png = new Resvg(svg).render().asPng();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
