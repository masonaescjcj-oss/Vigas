import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { orgMark, withAlpha } from '@vigas/tokens';
import type { JsonLdObject } from '@/lib/seo';

export const ICONS = {
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevDown: 'M6 9l6 6 6-6',
  chevRight: 'M9 6l6 6-6 6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  check: 'M5 12.5 10 17l9-10',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  up: 'M6 15l6-6 6 6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6z',
  wallet: 'M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11v3M16 13h1',
  chart: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6',
  chat: 'M4 5h16v11H9l-5 4z',
  arena: 'M4 4h7v16H4zM13 4h7v16h-7z',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14',
  send: 'M12 19V5M6 11l6-6 6 6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  text: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  verified:
    'M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9L3.3 14.7l1-2.8-1-2.8 2.4-1.8.9-2.9 3 .2zM8.5 12l2.5 2.5 4.5-5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  key: 'M12 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM10.8 12.2 20 3M17 6l2.5 2.5M14.5 8.5l2 2',
  cube: 'M12 3 20 7.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  x: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  stop: 'M7 7h10v10H7z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  bars: 'M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  style,
  className,
  label,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={className ? `i ${className}` : 'i'}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={style}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/** The Vigas colonnade mark. */
export function LogoMark({ size = 24, color = 'var(--vg-orange)' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true">
      <rect x="2.5" y="3" width="19" height="2.6" rx=".6" />
      <path d="M4 6.4h16l-1 1.6H5z" />
      <rect x="5.2" y="9" width="2.4" height="9" rx=".3" />
      <rect x="10.8" y="9" width="2.4" height="9" rx=".3" />
      <rect x="16.4" y="9" width="2.4" height="9" rx=".3" />
      <rect x="3.5" y="18.6" width="17" height="2.4" rx=".6" />
    </svg>
  );
}

/** Monogram tile (model maker, tool or author). */
export function Mark({
  color,
  letter,
  size = 30,
  radius,
  fontSize,
  ring = true,
  style,
}: {
  color: string;
  letter: string;
  size?: number;
  radius?: number;
  fontSize?: number;
  ring?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.29),
        display: 'grid',
        placeItems: 'center',
        font: `400 ${fontSize ?? Math.round(size * 0.5)}px var(--vg-font-serif)`,
        flexShrink: 0,
        background: withAlpha(color, 0.15),
        color,
        boxShadow: ring ? `inset 0 0 0 1px ${withAlpha(color, 0.3)}` : undefined,
        ...style,
      }}
    >
      {letter}
    </span>
  );
}

export function OrgMark({ org, ...rest }: { org: string } & Omit<Parameters<typeof Mark>[0], 'color' | 'letter'>) {
  const m = orgMark(org);
  return <Mark color={m.color} letter={m.letter} {...rest} />;
}

/** Round initials avatar, e.g. for authors. */
export function Avatar({ name, color, size = 26 }: { name: string; color: string; size?: number }) {
  const ini = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        color: 'var(--vg-on-orange)',
        display: 'grid',
        placeItems: 'center',
        font: `600 ${Math.max(11, Math.round(size * 0.34))}px var(--vg-font-sans)`,
        flexShrink: 0,
      }}
    >
      {ini}
    </span>
  );
}

export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\\u003c') }}
        />
      ))}
    </>
  );
}

export function Breadcrumb({
  items,
  center = false,
  style,
}: {
  items: Array<{ name: string; href?: string; accent?: boolean }>;
  center?: boolean;
  style?: CSSProperties;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mn"
      style={{ fontSize: 12, color: 'var(--vg-ink3)', ...style }}
    >
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: center ? 'center' : undefined,
        }}
      >
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} style={{ display: 'flex', gap: 8 }}>
              {it.href && !last ? (
                <Link href={it.href} style={{ color: it.accent ? 'var(--vg-orange-text)' : 'var(--vg-ink3)' }}>
                  {it.name}
                </Link>
              ) : it.href && last ? (
                <Link
                  href={it.href}
                  aria-current="page"
                  style={{ color: it.accent ? 'var(--vg-orange-text)' : 'var(--vg-ink)' }}
                >
                  {it.name}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} style={{ color: last ? 'var(--vg-ink)' : undefined }}>
                  {it.name}
                </span>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ArrowLink({ href, children, style }: { href: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <Link href={href} className="link-arrow" style={style}>
      {children}
      <Icon name="arrow" size={15} />
    </Link>
  );
}

/** Section heading pattern: mono label + serif h2 with an italic sand accent. */
export function SectionHead({
  label,
  title,
  accent,
  after,
  id,
  size = 'lg',
  style,
}: {
  label?: string;
  title: ReactNode;
  accent?: ReactNode;
  after?: ReactNode;
  id?: string;
  size?: 'lg' | 'md';
  style?: CSSProperties;
}) {
  return (
    <div>
      {label && <div className="lbl">{label}</div>}
      <h2
        id={id}
        className="sf"
        style={{
          fontSize: size === 'lg' ? 'clamp(38px,4.4vw,60px)' : 'clamp(32px,3.4vw,46px)',
          lineHeight: 1.02,
          letterSpacing: '-.024em',
          margin: label ? '12px 0 0' : 0,
          ...style,
        }}
      >
        {title}
        {accent && (
          <>
            {' '}
            <em className="hi">{accent}</em>
          </>
        )}
        {after}
      </h2>
    </div>
  );
}

/** Splits "Headline — tail" so the tail can be set in italic sand, as in the design. */
export function SplitTitle({ title }: { title: string }) {
  const i = title.indexOf(' — ');
  if (i < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, i)} — <em className="hi">{title.slice(i + 3)}</em>
    </>
  );
}
