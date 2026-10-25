import type { ReactNode } from 'react';
import type { TilePattern } from '../model/background';

/**
 * Canvas background motifs as SVG pattern tiles, drawn for this project as simple geometry (the batik
 * motifs are loose re-interpretations: kawung's four ovals, parang's diagonal bands, truntum's small
 * flowers; nothing is copied). Loaded only when a motif is chosen or exported.
 */
export interface MotifTile {
  width: number;
  height: number;
  node: ReactNode;
}

const H = 10.392; // half the height of a flat-topped hexagon with radius 12

export function motifTile(pattern: TilePattern, color: string): MotifTile {
  const stroke = { fill: 'none', stroke: color, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (pattern) {
    case 'dots':
      return { width: 18, height: 18, node: <circle cx={9} cy={9} r={1.8} fill={color} /> };
    case 'diagonal':
      return { width: 14, height: 14, node: <path d="M-3.5 3.5L3.5-3.5M0 14L14 0M10.5 17.5L17.5 10.5" {...stroke} /> };
    case 'hex':
      return { width: 36, height: 2 * H, node: <path d={`M0 ${H}L6 0H18L24 ${H}L18 ${2 * H}H6ZM24 ${H}H36`} {...stroke} /> };
    case 'kawung': {
      const petal = (cx: number, cy: number, rot: number) => (
        <g key={`${cx}-${cy}`} transform={`rotate(${rot} ${cx} ${cy})`}>
          <ellipse cx={cx} cy={cy} rx={7.2} ry={4} {...stroke} />
          <circle cx={cx} cy={cy} r={1} fill={color} />
        </g>
      );
      return {
        width: 32,
        height: 32,
        node: (
          <>
            {petal(10, 10, 45)}
            {petal(22, 10, -45)}
            {petal(10, 22, -45)}
            {petal(22, 22, 45)}
            <circle cx={16} cy={16} r={1.6} fill={color} />
            {[0, 32].flatMap((x) => [0, 32].map((y) => <circle key={`c${x}${y}`} cx={x} cy={y} r={1.6} fill={color} />))}
          </>
        ),
      };
    }
    case 'parang':
      return {
        width: 28,
        height: 28,
        node: (
          <>
            <path d="M0 28L28 0M-14 14L14-14M14 42L42 14" {...stroke} strokeWidth={2.2} />
            <path d="M7 3.5L10.5 7L7 10.5L3.5 7ZM21 17.5L24.5 21L21 24.5L17.5 21Z" {...stroke} />
          </>
        ),
      };
    case 'truntum': {
      const flower = (cx: number, cy: number, petals: number, r: number) => (
        <g key={`${cx}`}>
          <circle cx={cx} cy={cy} r={1.5} fill={color} />
          {Array.from({ length: petals }, (_, i) => {
            const a = (i / petals) * Math.PI * 2;
            return <circle key={i} cx={+(cx + r * Math.cos(a)).toFixed(2)} cy={+(cy + r * Math.sin(a)).toFixed(2)} r={1.1} fill={color} />;
          })}
        </g>
      );
      return { width: 30, height: 30, node: <>{flower(8, 8, 8, 4.5)}{flower(23, 23, 5, 3)}</> };
    }
  }
}
