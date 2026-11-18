import { ImageResponse } from 'next/og';

export const alt = 'Vigas — One key for every AI model';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default social card for every page. */
export default function OpenGraphImage() {
  const pillars = [1, 0.82, 0.73, 0.68, 0.65, 0.61];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#12110F', color: '#EFEAE1', padding: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
              borderRadius: 15,
              background: '#171614',
              border: '1px solid rgba(239,234,225,0.18)',
            }}
          >
            <svg viewBox="5 26 90 50" width="44" height="24" fill="none">
              <circle cx="29" cy="50" r="17" stroke="#EFEAE1" strokeWidth="6.5" />
              <circle cx="71" cy="50" r="17" stroke="#EFEAE1" strokeWidth="6.5" />
              <line x1="29" y1="67" x2="71" y2="67" stroke="#EFEAE1" strokeWidth="6.5" strokeLinecap="round" />
              <circle cx="29" cy="50" r="6.2" fill="#FF6A1A" />
              <circle cx="71" cy="50" r="3.4" fill="#EFEAE1" />
            </svg>
          </div>
          <div style={{ fontSize: 52, letterSpacing: -1 }}>Vigas</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 720 }}>
            <div style={{ fontSize: 84, lineHeight: 1, letterSpacing: -3 }}>One key.</div>
            <div style={{ fontSize: 84, lineHeight: 1.05, letterSpacing: -3, color: '#E3B65C' }}>Every frontier model.</div>
            <div style={{ fontSize: 28, color: '#A9A298', marginTop: 28 }}>API gateway · AI leaderboard · AI news · AI tools</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 280 }}>
            {pillars.map((h, i) => (
              <div key={i} style={{ display: 'flex', width: 38, height: Math.round(h * 280), borderRadius: '6px 6px 0 0', background: i === 0 ? '#FF6A1A' : i < 3 ? '#E3B65C' : '#3A3631' }} />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
