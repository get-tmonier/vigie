// Generates public/og-image.png (1200×630) using Satori + @resvg/resvg-js.
// Run via: node scripts/gen-og.mjs  (or automatically as part of `pnpm build`)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const require = createRequire(import.meta.url);

function font(pkg, file) {
  return readFileSync(require.resolve(`${pkg}/files/${file}`));
}

const fonts = [
  {
    name: 'Vollkorn SC',
    data: font('@fontsource/vollkorn-sc', 'vollkorn-sc-latin-900-normal.woff'),
    weight: 900,
    style: 'normal',
  },
  {
    name: 'Source Serif 4',
    data: font('@fontsource/source-serif-4', 'source-serif-4-latin-400-normal.woff'),
    weight: 400,
    style: 'normal',
  },
  {
    name: 'JetBrains Mono',
    data: font('@fontsource/jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'),
    weight: 500,
    style: 'normal',
  },
  {
    name: 'JetBrains Mono',
    data: font('@fontsource/jetbrains-mono', 'jetbrains-mono-latin-600-normal.woff'),
    weight: 600,
    style: 'normal',
  },
];

const GOLD = '#C49A2B';
const NAVY = '#0B1A2E';
const CREAM = '#F5F0E8';
const MUTED = '#8B9CAF';

const pills = ['Local-first', 'Human-in-the-loop', 'Ticket -> Production', 'BYOA - zero markup'];

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        background: NAVY,
        display: 'flex',
        flexDirection: 'column',
        padding: '72px 96px',
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        // Brand row
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '36px' },
            children: [
              {
                type: 'span',
                props: {
                  style: {
                    fontFamily: 'Vollkorn SC',
                    fontWeight: 900,
                    fontSize: '42px',
                    color: GOLD,
                    letterSpacing: '3px',
                  },
                  children: 'Tmonier',
                },
              },
              {
                type: 'span',
                props: {
                  style: {
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 600,
                    fontSize: '12px',
                    letterSpacing: '4px',
                    textTransform: 'uppercase',
                    color: 'rgba(139,156,175,0.5)',
                  },
                  children: 'You hold the helm.',
                },
              },
            ],
          },
        },
        // Headline
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Vollkorn SC',
              fontWeight: 900,
              fontSize: '86px',
              color: CREAM,
              lineHeight: 1.0,
              letterSpacing: '-0.01em',
              marginBottom: '28px',
            },
            children: [
              { type: 'span', props: { children: 'Ship 10x faster.' } },
              { type: 'span', props: { children: 'Break nothing.' } },
            ],
          },
        },
        // Subtitle
        {
          type: 'p',
          props: {
            style: {
              fontFamily: 'Source Serif 4',
              fontWeight: 400,
              fontSize: '22px',
              color: MUTED,
              lineHeight: 1.6,
              maxWidth: '560px',
              marginBottom: '48px',
            },
            children: 'You design. The AI agents crew executes. Nothing merges without your signal.',
          },
        },
        // Pills
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' },
            children: pills.map((label) => ({
              type: 'span',
              props: {
                style: {
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 500,
                  fontSize: '13px',
                  color: 'rgba(245,240,232,0.5)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                  padding: '6px 14px',
                },
                children: label,
              },
            })),
          },
        },
        // Spacer + URL bottom-left
        { type: 'div', props: { style: { flex: '1' } } },
        {
          type: 'p',
          props: {
            style: {
              margin: '0 0 0 0',
              fontFamily: 'JetBrains Mono',
              fontWeight: 600,
              fontSize: '14px',
              color: 'rgba(196,154,43,0.4)',
              letterSpacing: '2px',
            },
            children: 'tmonier.com',
          },
        },
        // Bottom gold bar
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '0',
              left: '0',
              right: '0',
              height: '3px',
              background: `linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD} 70%, transparent)`,
              opacity: 0.4,
            },
          },
        },
      ],
    },
  },
  {
    width: 1200,
    height: 630,
    fonts,
  },
);

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
writeFileSync(new URL('../public/og-image.png', import.meta.url), png);
console.log('✓ og-image.png generated (1200×630)');
