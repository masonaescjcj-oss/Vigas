import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * Stroke icons, 24×24, 1.8 stroke with round caps — the `.i` class in the design files.
 * Paths are copied from `design/premium/Android*.dc.html`; the few extras follow the same grid.
 */
export const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  explore: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  chat: 'M4 5h16v11H9l-5 4z',
  ranks: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z',
  wallet: 'M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11v3M16 13h1',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  back: 'M15 6l-6 6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronUp: 'M6 15l6-6 6 6',
  check: 'M5 12.5 10 17l9-10',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  regenerate: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  plus: 'M12 5v14M5 12h14',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  arena: 'M4 4h7v16H4zM13 4h7v16h-7z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5',
  key: 'M12 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM10.8 12.2 20 3M17 6l2.5 2.5M14.5 8.5l2 2',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M19 13a10 10 0 0 0-2.2-1.6M2 9.5a15 15 0 0 1 4.3-2.8M22 9.5A15 15 0 0 0 11 5.1M12 20h.01',
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Fill for closed shapes (e.g. a saved bookmark). */
  fill?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = colors.ink, fill = 'none', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={ICONS[name]}
        fill={fill}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Filled square used by the "stop generating" button. */
export function StopGlyph({ size = 14, color = colors.onOrange }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" accessible={false}>
      <Rect x={1} y={1} width={12} height={12} rx={2.5} fill={color} />
    </Svg>
  );
}

/** The Vigas colonnade mark. */
export function LogoMark({ size = 22, color = colors.orange }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Rect x={2.5} y={3} width={19} height={2.6} rx={0.6} fill={color} />
      <Path d="M4 6.4h16l-1 1.6H5z" fill={color} />
      <Rect x={5.2} y={9} width={2.4} height={9} rx={0.3} fill={color} />
      <Rect x={10.8} y={9} width={2.4} height={9} rx={0.3} fill={color} />
      <Rect x={16.4} y={9} width={2.4} height={9} rx={0.3} fill={color} />
      <Rect x={3.5} y={18.6} width={17} height={2.4} rx={0.6} fill={color} />
    </Svg>
  );
}
