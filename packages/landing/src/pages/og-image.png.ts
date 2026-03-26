import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import { colors, fonts, radar } from '@vigie/tokens';
import type { APIRoute } from 'astro';
import satori from 'satori';

const NAVY = colors.navy900;
const TEAL = colors.vigie400;
const TEAL_MID = colors.vigie300;
const CREAM = colors.cream50;
const SLATE = 'rgba(139,156,175,0.75)';

const _require = createRequire(import.meta.url);
function localFont(pkg: string, file: string): Buffer {
  return readFileSync(_require.resolve(`${pkg}/files/${file}`));
}

// biome-ignore lint/suspicious/noExplicitAny: Satori VNode
type VNode = { type: string; props: Record<string, any> };
// biome-ignore lint/suspicious/noExplicitAny: Satori VNode
function h(type: string, props: Record<string, any>): VNode {
  return { type, props };
}

function radarSvg(size: number, opacity: number): VNode {
  const { cx, cy, outerR, middleR, innerR, centerR, rays, gradient } = radar;
  return h('div', {
    style: {
      position: 'absolute',
      right: '60px',
      top: '95px',
      width: `${size}px`,
      height: `${size}px`,
      opacity,
      display: 'flex',
    },
    children: [
      h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: radar.viewBox,
        width: `${size}`,
        height: `${size}`,
        children: [
          // Concentric circles
          h('circle', {
            cx: `${cx}`,
            cy: `${cy}`,
            r: `${outerR}`,
            fill: 'none',
            stroke: gradient.start,
            strokeWidth: '2.5',
          }),
          h('circle', {
            cx: `${cx}`,
            cy: `${cy}`,
            r: `${middleR}`,
            fill: 'none',
            stroke: gradient.start,
            strokeWidth: '1.5',
          }),
          h('circle', {
            cx: `${cx}`,
            cy: `${cy}`,
            r: `${innerR}`,
            fill: 'none',
            stroke: gradient.start,
            strokeWidth: '1',
          }),
          // Center dot
          h('circle', {
            cx: `${cx}`,
            cy: `${cy}`,
            r: `${centerR}`,
            fill: gradient.start,
          }),
          // Rays
          ...rays.map((ray) =>
            h('line', {
              x1: `${ray.x1}`,
              y1: `${ray.y1}`,
              x2: `${ray.x2}`,
              y2: `${ray.y2}`,
              stroke: gradient.start,
              strokeWidth: '2',
              strokeLinecap: 'round',
            })
          ),
        ],
      }),
    ],
  });
}

function radarSmall(size: number): VNode {
  const { cx, cy, outerR, middleR, innerR, centerR, rays, gradient } = radar;
  return h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: radar.viewBox,
    width: `${size}`,
    height: `${size}`,
    children: [
      h('circle', {
        cx: `${cx}`,
        cy: `${cy}`,
        r: `${outerR}`,
        fill: 'none',
        stroke: gradient.start,
        strokeWidth: '2.5',
      }),
      h('circle', {
        cx: `${cx}`,
        cy: `${cy}`,
        r: `${middleR}`,
        fill: 'none',
        stroke: gradient.start,
        strokeWidth: '1.5',
      }),
      h('circle', {
        cx: `${cx}`,
        cy: `${cy}`,
        r: `${innerR}`,
        fill: 'none',
        stroke: gradient.start,
        strokeWidth: '1',
      }),
      h('circle', {
        cx: `${cx}`,
        cy: `${cy}`,
        r: `${centerR}`,
        fill: gradient.start,
      }),
      ...rays.map((ray) =>
        h('line', {
          x1: `${ray.x1}`,
          y1: `${ray.y1}`,
          x2: `${ray.x2}`,
          y2: `${ray.y2}`,
          stroke: gradient.start,
          strokeWidth: '2',
          strokeLinecap: 'round',
        })
      ),
    ],
  });
}

function buildTree(): VNode {
  const radarCx = 920;
  const radarCy = 315;

  return h('div', {
    style: {
      width: '1200px',
      height: '630px',
      background: `radial-gradient(ellipse at 77% 50%, rgba(78,207,176,0.08) 0%, transparent 52%), ${NAVY}`,
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
    },
    children: [
      // Concentric rings — radar effect, centered on radar mark
      ...[580, 460, 350].map((d) =>
        h('div', {
          style: {
            position: 'absolute',
            left: `${radarCx - d / 2}px`,
            top: `${radarCy - d / 2}px`,
            width: `${d}px`,
            height: `${d}px`,
            borderRadius: '50%',
            border: `1px solid rgba(78,207,176,${d === 580 ? 0.06 : d === 460 ? 0.09 : 0.12})`,
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
          background: `linear-gradient(to bottom, transparent, rgba(78,207,176,0.2) 25%, rgba(78,207,176,0.2) 75%, transparent)`,
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
          backgroundColor: TEAL,
          opacity: 0.5,
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
          backgroundColor: TEAL,
          opacity: 0.25,
        },
      }),
      // Large radar — right side
      radarSvg(440, 0.18),
      // Content — left side
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 96px',
          width: '680px',
        },
        children: [
          // Radar icon + pronunciation
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '24px',
            },
            children: [
              radarSmall(44),
              h('div', {
                style: {
                  fontFamily: fonts.mono,
                  fontSize: 14,
                  fontWeight: 500,
                  color: `rgba(78,207,176,0.5)`,
                  letterSpacing: '1px',
                },
                children: '/vi.ʒi/',
              }),
            ],
          }),
          // Hero "vigie" — large, prominent, matching landing hero
          h('div', {
            style: {
              fontFamily: fonts.display,
              fontWeight: 400,
              fontSize: 96,
              color: TEAL,
              lineHeight: 1,
              marginBottom: '16px',
              letterSpacing: '-0.02em',
            },
            children: 'vigie',
          }),
          // Tagline — italic, cream
          h('div', {
            style: {
              fontFamily: fonts.display,
              fontWeight: 400,
              fontStyle: 'italic',
              fontSize: 30,
              color: CREAM,
              lineHeight: 1.3,
              marginBottom: '28px',
            },
            children: 'Eyes on the horizon.',
          }),
          // Divider
          h('div', {
            style: {
              width: '64px',
              height: '2px',
              backgroundColor: TEAL_MID,
              marginBottom: '24px',
              opacity: 0.6,
            },
          }),
          // Description
          h('div', {
            style: {
              fontFamily: fonts.mono,
              fontSize: 16,
              fontWeight: 500,
              color: SLATE,
              marginBottom: '10px',
            },
            children: 'AI Agent Supervision',
          }),
          // Sub-description
          h('div', {
            style: {
              fontFamily: fonts.mono,
              fontSize: 13,
              fontWeight: 500,
              color: `rgba(78,207,176,0.45)`,
              letterSpacing: '2px',
            },
            children: 'Open Source · Local-First',
          }),
        ],
      }),
    ],
  });
}

export const GET: APIRoute = async () => {
  const instrumentSerif = localFont(
    '@fontsource/instrument-serif',
    'instrument-serif-latin-400-normal.woff'
  );
  const instrumentSerifItalic = localFont(
    '@fontsource/instrument-serif',
    'instrument-serif-latin-400-italic.woff'
  );
  const jetbrainsMono = localFont(
    '@fontsource/jetbrains-mono',
    'jetbrains-mono-latin-500-normal.woff'
  );

  // biome-ignore lint/suspicious/noExplicitAny: Satori accepts our VNode structure
  const svg = await satori(buildTree() as any, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: 'Instrument Serif',
        data: instrumentSerif,
        weight: 400,
        style: 'normal',
      },
      {
        name: 'Instrument Serif',
        data: instrumentSerifItalic,
        weight: 400,
        style: 'italic',
      },
      {
        name: 'JetBrains Mono',
        data: jetbrainsMono,
        weight: 500,
        style: 'normal',
      },
    ],
  });

  const png = new Resvg(svg).render().asPng();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
