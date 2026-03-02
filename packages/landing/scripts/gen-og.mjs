// Generates public/og-image.png (1200×630) using Satori + @resvg/resvg-js.
// Run via: node scripts/gen-og.mjs  (or automatically as part of `pnpm build`)
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

// Import color tokens to stay in sync with design system
import { colors } from '@tmonier/tokens';

const GOLD = colors.gold;
const NAVY = colors.navyDeep;
const CREAM = colors.cream;

// Load mascot as base64 data URI
const mascotPath = new URL('../src/assets/helmsman.jpg', import.meta.url);
const mascotBase64 = readFileSync(mascotPath).toString('base64');
const mascotDataUri = `data:image/jpeg;base64,${mascotBase64}`;

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        background: NAVY,
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        // Left column: text
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              padding: '72px 0 72px 96px',
              flex: '1',
              justifyContent: 'center',
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
                    fontSize: '64px',
                    color: CREAM,
                    lineHeight: 1.1,
                    letterSpacing: '-0.01em',
                    marginBottom: '32px',
                  },
                  children: [
                    { type: 'span', props: { children: 'Your crew.' } },
                    { type: 'span', props: { children: 'Under your watch.' } },
                  ],
                },
              },
              // Pills
              {
                type: 'div',
                props: {
                  style: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' },
                  children: [
                    'Real-time monitoring',
                    'Human-in-the-loop',
                    'Local-first',
                    'Zero markup',
                  ].map((label) => ({
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
              // URL
              {
                type: 'p',
                props: {
                  style: {
                    margin: '0',
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 600,
                    fontSize: '14px',
                    color: 'rgba(196,154,43,0.4)',
                    letterSpacing: '2px',
                  },
                  children: 'tmonier.com',
                },
              },
            ],
          },
        },
        // Right column: mascot
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              width: '340px',
              flexShrink: 0,
              overflow: 'hidden',
            },
            children: [
              {
                type: 'img',
                props: {
                  src: mascotDataUri,
                  width: 340,
                  height: 434,
                  style: {
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    opacity: 0.85,
                  },
                },
              },
            ],
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
