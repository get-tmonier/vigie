// Helm (WheelMark) geometry — single source of truth for all SVG renderings
const _helmCx = 32;
const _helmCy = 32;
const _helmAngles = [0, 45, 90, 135, 180, 225, 270, 315];
function _helmPoint(r: number, deg: number): string {
  const rad = ((deg - 90) * Math.PI) / 180;
  return `${(_helmCx + r * Math.cos(rad)).toFixed(1)},${(_helmCy + r * Math.sin(rad)).toFixed(1)}`;
}

export const helm = {
  viewBox: '0 0 64 64',
  cx: _helmCx,
  cy: _helmCy,
  spokesD: _helmAngles.map((a) => `M${_helmPoint(8, a)} L${_helmPoint(22, a)}`).join(' '),
  handlesD: _helmAngles.map((a) => `M${_helmPoint(19, a)} L${_helmPoint(31, a)}`).join(' '),
} as const;

export const colors = {
  navyDeep: '#0b1a2e',
  navyMid: '#1d3557',
  navyLight: '#2a4a7f',
  gold: '#c49a2b',
  goldLight: '#d4aa3c',
  goldPale: '#e0bc5a',
  goldDark: '#a67c1a',
  cream: '#f5f0e8',
  creamDark: '#e8e0d0',
  slate: '#8b9caf',
  success: '#22c55e',
  error: '#ef4444',
  signalGreen: '#28c840',
  signalRed: '#ff5f57',
  signalAmber: '#ffbd2e',
  signalOrange: '#ff8c42',
} as const;

export const fonts = {
  vollkornSc: '"Vollkorn SC", serif',
  vollkorn: '"Vollkorn", serif',
  sourceSerif: '"Source Serif 4", serif',
  mono: '"JetBrains Mono", monospace',
} as const;
