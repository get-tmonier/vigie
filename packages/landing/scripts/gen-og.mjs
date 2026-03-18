// Generates public/og-image.png (1200×630) using Satori + @resvg/resvg-js.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

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

import { colors } from '@tmonier/tokens';

const GOLD = colors.gold;
const NAVY = colors.navyDeep;
const CREAM = colors.cream;

function pill(label) {
  return {
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
  };
}

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
        justifyContent: 'center',
        padding: '72px 96px',
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        // Brand row
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '36px',
            },
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
                  children: 'You Keep The Helm.',
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
              fontFamily: 'Vollkorn SC',
              fontWeight: 900,
              fontSize: '56px',
              color: CREAM,
              lineHeight: 1.2,
              marginBottom: '12px',
            },
            children: 'Senior Fullstack Engineer',
          },
        },
        // Subtitle
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'JetBrains Mono',
              fontSize: '22px',
              fontWeight: 500,
              color: 'rgba(139,156,175,0.7)',
              marginBottom: '28px',
            },
            children: 'Freelance · Brussels',
          },
        },
        // Pills
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
            children: ['TypeScript', 'React', 'Node.js', 'Effect-TS', 'PostgreSQL'].map(pill),
          },
        },
        // URL
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '48px',
              left: '96px',
              fontFamily: 'JetBrains Mono',
              fontSize: '14px',
              fontWeight: 600,
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
  }
);

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
writeFileSync(new URL('../public/og-image.png', import.meta.url), png);
console.log('✓ og-image.png generated (1200×630)');
